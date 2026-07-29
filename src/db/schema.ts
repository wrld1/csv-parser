import { bigint, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const imports = pgTable("imports", {
  id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  fileName: text("file_name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const importColumns = pgTable("import_columns", {
  id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  importId: bigint("import_id", { mode: "number" })
    .notNull()
    .references(() => imports.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
});

export const importCells = pgTable(
  "import_cells",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    columnId: bigint("column_id", { mode: "number" })
      .notNull()
      .references(() => importColumns.id, { onDelete: "cascade" }),
    rowNumber: bigint("row_number", { mode: "number" }).notNull(),
    value: text("value").notNull(),
  }
);

export type ImportRow = typeof imports.$inferSelect;
export type ImportColumnRow = typeof importColumns.$inferSelect;
export type ImportCellRow = typeof importCells.$inferSelect;
export type NewImportCell = typeof importCells.$inferInsert;
