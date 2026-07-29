import { createReadStream } from "node:fs";
import { basename } from "node:path";
import { parse } from "csv-parse";
import { sql } from "drizzle-orm";
import { db } from "./db/index.js";
import {
  imports,
  importColumns,
  importCells,
  type NewImportCell,
} from "./db/schema.js";

const BATCH_SIZE = 20000;
const EVEN_OFFSET = 1;

async function main() {
  let file = "data/10gb-test.csv";
  let withUnlogged = false;

  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--withUnlogged=")) {
      withUnlogged = arg.split("=")[1] === "true";
    } else if (!arg.startsWith("--")) {
      file = arg;
    }
  }

  const parser = createReadStream(file).pipe(
    parse({
      bom: true,
      skip_empty_lines: true,
      relax_column_count: true,
      relax_quotes: true,
    })
  );

  await new Promise((resolve) => parser.once("readable", resolve));
  const columnNames = parser.read();
  if (!columnNames) throw new Error("File is empty!");

  const evenIndexes = columnNames
    .map((_: any, i: number) => i)
    .filter((i: number) => i % 2 === EVEN_OFFSET);

  const evenColumnNames = evenIndexes.map((i: number) => columnNames[i]);

  const [createdImport] = await db
    .insert(imports)
    .values({ fileName: basename(file) })
    .returning({ id: imports.id });

  const createdColumns = await db
    .insert(importColumns)
    .values(
      evenColumnNames.map((name: string) => ({
        importId: createdImport!.id,
        name,
      })),
    )
    .returning({ id: importColumns.id });

  console.log(`Setup complete. Starting data import for ${basename(file)}...`);
  console.log(`Only importing even columns: ${evenColumnNames.join(", ")}`);

  if (withUnlogged) {
    console.log("Setting table to UNLOGGED for maximum speed...");
    await db.execute(sql`ALTER TABLE import_cells SET UNLOGGED;`);
  }

  console.time("Total Import Time");

  let rowNumber = 0;
  let insertedCellsCount = 0;
  let batch: NewImportCell[] = [];

  for await (const row of parser) {
    rowNumber++;

    for (let j = 0; j < evenIndexes.length; j++) {
      const csvIndex = evenIndexes[j];
      const columnId = createdColumns[j]!.id;

      batch.push({
        columnId,
        rowNumber,
        value: row[csvIndex] || "",
      });
    }

    if (batch.length >= BATCH_SIZE) {
      await db.insert(importCells).values(batch);
      insertedCellsCount += batch.length;
      batch = [];

      const ramMB = Math.round(process.memoryUsage().rss / 1024 / 1024);
      console.log(
        `Inserted ${insertedCellsCount} cells (passed row ${rowNumber}) | RAM: ${ramMB} MB...`,
      );
    }
  }

  if (batch.length > 0) {
    await db.insert(importCells).values(batch);
    insertedCellsCount += batch.length;
  }

  if (withUnlogged) {
    console.log(
      "Restoring table to LOGGED mode (this might take a moment to sync to disk)...",
    );
    await db.execute(sql`ALTER TABLE import_cells SET LOGGED;`);
  }

  console.timeEnd("Total Import Time");
  console.log(
    `Done! Processed ${rowNumber} rows and inserted ${insertedCellsCount} cells.`,
  );
}

main()
  .catch(console.error)
  .finally(() => db.$client.end());
