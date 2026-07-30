import { stat } from "node:fs/promises";
import { basename } from "node:path";
import { asc, desc, eq, sql } from "drizzle-orm";
import {
  isRecordBoundary,
  pickEvenColumns,
  readHeader,
  readRows,
} from "./csv.js";
import { db } from "./db/index.js";
import {
  imports,
  importColumns,
  importCells,
  type NewImportCell,
} from "./db/schema.js";
import { describeError, RowImportError } from "./errors.js";

const BATCH_SIZE = 20000;
const EVEN_OFFSET = 1;

type ImportPlan = {
  importId: number;
  columnIds: number[];
  startRowNumber: number;
  startByteOffset: number;
};

function parseArgs(argv: string[]) {
  let file = "data/10gb-test.csv";
  let withUnlogged = false;
  let restart = false;

  for (const arg of argv) {
    if (arg.startsWith("--withUnlogged=")) {
      withUnlogged = arg.split("=")[1] === "true";
    } else if (arg === "--restart") {
      restart = true;
    } else if (!arg.startsWith("--")) {
      file = arg;
    }
  }

  return { file, withUnlogged, restart };
}

function preview(value: string) {
  return value.length > 80 ? `${value.slice(0, 80)}…` : value;
}

async function planImport(options: {
  file: string;
  fileSize: number;
  headerOffset: number;
  columnNames: string[];
  restart: boolean;
}): Promise<ImportPlan | null> {
  const { file, fileSize, headerOffset, columnNames, restart } = options;
  const fileName = basename(file);

  const [previous] = await db
    .select()
    .from(imports)
    .where(eq(imports.fileName, fileName))
    .orderBy(desc(imports.id))
    .limit(1);

  if (previous?.status === "completed" && !restart) {
    console.log(
      `"${fileName}" was already imported as import #${previous.id} ` +
        `(${previous.lastRowNumber} rows). Re-run with --restart to import it again.`,
    );
    return null;
  }

  const resumable =
    previous && previous.status !== "completed" ? previous : null;

  if (resumable && restart) {
    console.log(
      `--restart: deleting unfinished import #${resumable.id} ` +
        `(${resumable.lastRowNumber} rows) and starting over...`,
    );
    await db.delete(imports).where(eq(imports.id, resumable.id));
  }

  if (resumable && !restart) {
    const storedColumns = await db
      .select()
      .from(importColumns)
      .where(eq(importColumns.importId, resumable.id))
      .orderBy(asc(importColumns.id));

    const sameColumns =
      storedColumns.length === columnNames.length &&
      storedColumns.every((column, i) => column.name === columnNames[i]);

    if (!sameColumns) {
      throw new Error(
        `Header of "${fileName}" no longer matches import #${resumable.id} ` +
          `(${storedColumns.map((column) => column.name).join(", ")}). Re-run with --restart.`,
      );
    }

    if (resumable.lastByteOffset > fileSize) {
      throw new Error(
        `Checkpoint of import #${resumable.id} is past the end of "${fileName}" ` +
          `(${resumable.lastByteOffset} > ${fileSize} bytes). The file was replaced or truncated. ` +
          `Re-run with --restart.`,
      );
    }

    const startRowNumber = resumable.lastRowNumber;
    const startByteOffset =
      startRowNumber > 0 ? resumable.lastByteOffset : headerOffset;

    if (!(await isRecordBoundary(file, startByteOffset))) {
      throw new Error(
        `Checkpoint of import #${resumable.id} (byte ${startByteOffset}) does not land on a ` +
          `row boundary — the file was edited before that point. Re-run with --restart.`,
      );
    }

    await db
      .update(imports)
      .set({
        status: "running",
        fileSize,
        failedRowNumber: null,
        errorMessage: null,
        updatedAt: sql`now()`,
      })
      .where(eq(imports.id, resumable.id));

    console.log(
      `Resuming import #${resumable.id} for ${fileName} at row ${startRowNumber + 1} ` +
        `(byte ${startByteOffset} of ${fileSize}).`,
    );

    if (resumable.fileSize !== fileSize) {
      console.log(
        `Note: file size changed since the last run (${resumable.fileSize} -> ${fileSize} bytes). ` +
          `That is expected if you fixed the failing row; edits before byte ${startByteOffset} would be skipped.`,
      );
    }

    return {
      importId: resumable.id,
      columnIds: storedColumns.map((column) => column.id),
      startRowNumber,
      startByteOffset,
    };
  }

  const [createdImport] = await db
    .insert(imports)
    .values({ fileName, fileSize })
    .returning({ id: imports.id });

  const importId = createdImport!.id;

  const createdColumns = await db
    .insert(importColumns)
    .values(columnNames.map((name) => ({ importId, name })))
    .returning({ id: importColumns.id });

  console.log(
    `Setup complete. Starting data import #${importId} for ${fileName}...`,
  );

  return {
    importId,
    columnIds: createdColumns.map((column) => column.id),
    startRowNumber: 0,
    startByteOffset: headerOffset,
  };
}

function reportFailure(options: {
  file: string;
  importId: number;
  error: unknown;
  reason: string;
  checkpoint: { lastRowNumber: number; lastByteOffset: number };
  columnNames: string[];
  columnIds: number[];
}) {
  const { file, importId, error, reason, checkpoint, columnNames, columnIds } =
    options;

  const failedRow = error instanceof RowImportError ? error.rowNumber : null;

  console.error(
    `Import #${importId} stopped${failedRow ? ` at row ${failedRow}` : ""}.`,
  );
  console.error(`  Postgres: ${reason}`);
  console.error(
    `  Committed up to row ${checkpoint.lastRowNumber} (byte ${checkpoint.lastByteOffset}); ` +
      `nothing after that was written.`,
  );

  if (error instanceof RowImportError) {
    console.error("  Offending row:");
    for (const cell of error.cells) {
      const name = columnNames[columnIds.indexOf(cell.columnId)];
      console.error(
        `    ${name}: ${cell.value.length} chars — ${JSON.stringify(preview(cell.value))}`,
      );
    }
  }

  console.error(
    ` Fix the row in ${file} (or widen the column), then run the same command again — ` +
      `it resumes from the checkpoint. Use --restart to discard import #${importId} and start over.`,
  );
}

async function main() {
  const { file, withUnlogged, restart } = parseArgs(process.argv.slice(2));

  const { size: fileSize } = await stat(file);
  const header = await readHeader(file);
  const columns = pickEvenColumns(header.columnNames, EVEN_OFFSET);

  const plan = await planImport({
    file,
    fileSize,
    headerOffset: header.offset,
    columnNames: columns.names,
    restart,
  });

  if (!plan) return;

  const { importId, columnIds, startRowNumber, startByteOffset } = plan;
  const cellsPerRow = columns.indexes.length;

  console.log(`Only importing even columns: ${columns.names.join(", ")}`);

  if (withUnlogged) {
    console.log("Setting table to UNLOGGED for maximum speed...");
    console.log(
      "Warning: an UNLOGGED table is truncated after an unclean shutdown, which invalidates the checkpoint.",
    );
    await db.execute(sql`ALTER TABLE import_cells SET UNLOGGED;`);
  }

  console.time("Total Import Time");

  let rowNumber = startRowNumber;
  let insertedCellsCount = 0;
  let batch: NewImportCell[] = [];
  let offsets: number[] = [];
  let batchFirstRow = rowNumber + 1;

  const commit = async (
    cells: NewImportCell[],
    lastRow: number,
    byteOffset: number,
  ) => {
    await db.transaction(async (tx) => {
      await tx.insert(importCells).values(cells);
      await tx
        .update(imports)
        .set({
          lastRowNumber: lastRow,
          lastByteOffset: byteOffset,
          updatedAt: sql`now()`,
        })
        .where(eq(imports.id, importId));
    });
  };

  const flush = async () => {
    if (batch.length === 0) return;

    const cells = batch;
    const rowOffsets = offsets;
    const firstRow = batchFirstRow;
    batch = [];
    offsets = [];
    batchFirstRow = rowNumber + 1;

    try {
      await commit(cells, firstRow + rowOffsets.length - 1, rowOffsets.at(-1)!);
    } catch (batchError) {
      for (let i = 0; i < rowOffsets.length; i++) {
        const rowCells = cells.slice(i * cellsPerRow, (i + 1) * cellsPerRow);
        try {
          await commit(rowCells, firstRow + i, rowOffsets[i]!);
        } catch (rowError) {
          throw new RowImportError(firstRow + i, rowCells, rowError);
        }
      }

      console.warn(
        `Batch insert failed but all ${rowOffsets.length} rows inserted individually, continuing. ` +
          `Cause: ${describeError(batchError)}`,
      );
    }

    insertedCellsCount += cells.length;
  };

  try {
    for await (const { record: row, info } of readRows(file, startByteOffset)) {
      rowNumber++;

      for (let j = 0; j < cellsPerRow; j++) {
        batch.push({
          columnId: columnIds[j]!,
          rowNumber,
          value: row[columns.indexes[j]!] || "",
        });
      }

      offsets.push(startByteOffset + info.bytes);

      if (batch.length >= BATCH_SIZE) {
        await flush();

        const ramMB = Math.round(process.memoryUsage().rss / 1024 / 1024);
        console.log(
          `Inserted ${insertedCellsCount} cells (passed row ${rowNumber}) | RAM: ${ramMB} MB...`,
        );
      }
    }

    await flush();
  } catch (error) {
    const failedRow = error instanceof RowImportError ? error.rowNumber : null;
    const reason = describeError(error);

    await db
      .update(imports)
      .set({
        status: "failed",
        failedRowNumber: failedRow,
        errorMessage: reason.slice(0, 2000),
        updatedAt: sql`now()`,
      })
      .where(eq(imports.id, importId));

    const [checkpoint] = await db
      .select({
        lastRowNumber: imports.lastRowNumber,
        lastByteOffset: imports.lastByteOffset,
      })
      .from(imports)
      .where(eq(imports.id, importId));

    console.timeEnd("Total Import Time");
    reportFailure({
      file,
      importId,
      error,
      reason,
      checkpoint: checkpoint!,
      columnNames: columns.names,
      columnIds,
    });

    return;
  }

  await db
    .update(imports)
    .set({ status: "completed", updatedAt: sql`now()` })
    .where(eq(imports.id, importId));

  console.timeEnd("Total Import Time");
  console.log(
    `Done! Processed ${rowNumber} rows and inserted ${insertedCellsCount} cells` +
      `${startRowNumber > 0 ? ` (${startRowNumber} rows were already imported before this run)` : ""}.`,
  );
}

main()
  .catch(console.error)
  .finally(() => db.$client.end());
