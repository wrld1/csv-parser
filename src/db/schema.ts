import { bigint, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const imports = pgTable("imports", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  fileName: text("file_name").notNull(),
  fileSize: bigint("file_size", { mode: "number" }).notNull().default(0),
  status: text("status", { enum: ["running", "failed", "completed"] })
    .notNull()
    .default("running"),
  lastRowNumber: integer("last_row_number").notNull().default(0),
  lastByteOffset: bigint("last_byte_offset", { mode: "number" })
    .notNull()
    .default(0),
  failedRowNumber: integer("failed_row_number"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const importColumns = pgTable("import_columns", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  importId: integer("import_id")
    .notNull()
    .references(() => imports.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
});

export const importCells = pgTable("import_cells", {
  id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  columnId: integer("column_id")
    .notNull()
    .references(() => importColumns.id, { onDelete: "cascade" }),
  rowNumber: integer("row_number").notNull(),
  value: text("value").notNull(),
});

export type NewImportCell = typeof importCells.$inferInsert;
