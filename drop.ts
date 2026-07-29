import { db } from "./src/db/index.js";
import { sql } from "drizzle-orm";

async function drop() {
  console.log("Dropping old tables...");
  await db.execute(sql`DROP TABLE IF EXISTS "records" CASCADE;`);
  await db.execute(sql`DROP TABLE IF EXISTS "imports" CASCADE;`);
  await db.execute(sql`DROP TABLE IF EXISTS "import_columns" CASCADE;`);
  await db.execute(sql`DROP TABLE IF EXISTS "import_cells" CASCADE;`);
  console.log("Done!");
  process.exit(0);
}

drop().catch(console.error);
