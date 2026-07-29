import { db } from "./src/db/index.js";
import { imports } from "./src/db/schema.js";

async function clear() {
  console.log("Deleting all import data...");

  await db.delete(imports);
  console.log("Database is clean!");
  process.exit(0);
}

clear().catch(console.error);
