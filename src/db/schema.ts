import { bigint, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const imports = pgTable("imports", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  fileName: text("file_name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
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

export type ImportRow = typeof imports.$inferSelect;
export type ImportColumnRow = typeof importColumns.$inferSelect;
export type ImportCellRow = typeof importCells.$inferSelect;
export type NewImportCell = typeof importCells.$inferInsert;
