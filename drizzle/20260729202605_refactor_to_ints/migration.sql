DROP INDEX "import_cells_column_id_idx";--> statement-breakpoint
DROP INDEX "import_cells_row_number_idx";--> statement-breakpoint
ALTER TABLE "import_cells" ALTER COLUMN "column_id" SET DATA TYPE integer USING "column_id"::integer;--> statement-breakpoint
ALTER TABLE "import_cells" ALTER COLUMN "row_number" SET DATA TYPE integer USING "row_number"::integer;--> statement-breakpoint
ALTER TABLE "import_columns" ALTER COLUMN "id" SET DATA TYPE integer USING "id"::integer;--> statement-breakpoint
ALTER TABLE "import_columns" ALTER COLUMN "id" SET MAXVALUE 2147483647;--> statement-breakpoint
ALTER TABLE "import_columns" ALTER COLUMN "import_id" SET DATA TYPE integer USING "import_id"::integer;--> statement-breakpoint
ALTER TABLE "imports" ALTER COLUMN "id" SET DATA TYPE integer USING "id"::integer;--> statement-breakpoint
ALTER TABLE "imports" ALTER COLUMN "id" SET MAXVALUE 2147483647;