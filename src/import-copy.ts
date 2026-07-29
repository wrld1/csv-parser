import { createReadStream } from "node:fs";
import { basename } from "node:path";
import { Transform } from "node:stream";
import { parse } from "csv-parse";
import { sql } from "drizzle-orm";
import pg from "pg";
import { from as copyFrom } from "pg-copy-streams";
import { db } from "./db/index.js";
import { imports, importColumns } from "./db/schema.js";
import "dotenv/config";

const EVEN_OFFSET = 1;

async function main() {
  const file = process.argv[2] || "data/10gb-test.csv";

  const parser = createReadStream(file).pipe(
    parse({
      bom: true,
      skip_empty_lines: true,
      relax_column_count: true,
      relax_quotes: true,
    }),
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

  console.log(`Setup complete. Starting COPY import for ${basename(file)}...`);

  console.log("Setting table to UNLOGGED for maximum speed...");
  await db.execute(sql`ALTER TABLE import_cells SET UNLOGGED;`);

  console.time("Total Copy Import Time");

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const copyStream = client.query(
    copyFrom("COPY import_cells (column_id, row_number, value) FROM STDIN CSV"),
  );

  let rowNumber = 0;
  let cellsProcessed = 0;

  const transform = new Transform({
    objectMode: true,
    transform(row, encoding, callback) {
      rowNumber++;
      let chunk = "";

      for (let j = 0; j < evenIndexes.length; j++) {
        const csvIndex = evenIndexes[j];
        const columnId = createdColumns[j]!.id;

        let val = row[csvIndex] || "";

        if (val.includes('"') || val.includes(",") || val.includes("\n")) {
          val = `"${val.replace(/"/g, '""')}"`;
        }

        chunk += `${columnId},${rowNumber},${val}\n`;
        cellsProcessed++;
      }

      if (rowNumber % 10000 === 0) {
        const ramMB = Math.round(process.memoryUsage().rss / 1024 / 1024);
        console.log(
          `Piping ${cellsProcessed} cells (passed row ${rowNumber}) | RAM: ${ramMB} MB...`,
        );
      }

      callback(null, chunk);
    },
  });

  try {
    await new Promise((resolve, reject) => {
      parser.on("error", reject);
      transform.on("error", reject);
      copyStream.on("error", reject);

      copyStream.on("finish", resolve);

      parser.pipe(transform).pipe(copyStream);
    });
  } catch (err) {
    console.error("Stream failed.", err);
    throw err;
  } finally {
    await client.end();
  }

  console.log("Restoring table to LOGGED mode...");
  await db.execute(sql`ALTER TABLE import_cells SET LOGGED;`);

  console.timeEnd("Total Copy Import Time");
  console.log(
    `Done! Processed ${rowNumber} rows and inserted ${cellsProcessed} cells.`,
  );
}

main()
  .catch(console.error)
  .finally(() => db.$client.end());
