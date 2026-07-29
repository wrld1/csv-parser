import { sql } from "drizzle-orm";
import { db } from "./src/db/index.js";

async function main() {
  const result = await db.execute(sql`SELECT count(*) FROM import_cells`);
  console.log("Total rows in import_cells:", result.rows[0].count);
}

main().catch(console.error).finally(() => db.$client.end());
