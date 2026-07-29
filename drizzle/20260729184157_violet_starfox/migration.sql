CREATE TABLE "import_cells" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "import_cells_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"column_id" bigint NOT NULL,
	"row_number" bigint NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_columns" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "import_columns_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"import_id" bigint NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "imports" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "imports_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"file_name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "import_cells" ADD CONSTRAINT "import_cells_column_id_import_columns_id_fkey" FOREIGN KEY ("column_id") REFERENCES "import_columns"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "import_columns" ADD CONSTRAINT "import_columns_import_id_imports_id_fkey" FOREIGN KEY ("import_id") REFERENCES "imports"("id") ON DELETE CASCADE;