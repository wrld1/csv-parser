# High-Performance CSV Importer

This project is designed to safely and quickly parse massive CSV files (up to 10GB+) and insert them into a PostgreSQL database using highly optimized streaming and relational mapping techniques.

## Prerequisites

- Node.js
- Docker & Docker Compose (for the local database)

## 1. Initial Setup

First, install the required dependencies:

```bash
npm install
```

Start the local PostgreSQL database using Docker:

```bash
docker compose up -d
```

Run the migrations (creates the necessary tables):

```bash
npx drizzle-kit migrate
```

---

## 2. Generate Test Data

If you need a massive CSV file to test with, you can generate one using the built-in generator script. By default it creates a 10GB file, but you can pass a `--size` flag for smaller files. The file will be saved in the `data/` folder (which is git-ignored).

```bash
# Generate a 1GB test file
npx tsx src/generate.ts --size=1gb
```

---

## 3. Running the Import

This project normalizes the flat CSV data into an Entity-Attribute-Value (EAV) structure (`import_cells`) to handle dynamic columns.

```bash
npm run import data/1gb-test.csv
```

---

## 4. Checkpointing & Resuming

The import is restartable. Every batch is written in a single transaction that
inserts the cells **and** advances the checkpoint on the `imports` row
(`last_row_number` + `last_byte_offset`), so the checkpoint can never claim more
rows than the database actually holds.

**If a row is rejected** (value longer than the column allows, constraint
violation, bad data), the failing batch is rolled back and replayed one row at a
time: every good row before the bad one is committed, then the import stops and
prints exactly which row and which column broke it:

```
Import #1 stopped at row 17.
  Postgres: new row for relation "import_cells" violates check constraint "value_max_len"
  Committed up to row 16 (byte 917); nothing after that was written.
  Offending row:
    c6: 60 chars — "XXXXXXXXXX…"
```

Fix that row in the CSV (or widen the column) and run the **same command** again.
The importer reuses the same import id and seeks straight to the checkpoint byte
offset — it does not re-read or re-insert the rows already imported:

```bash
npm run import data/1gb-test.csv
```

The same applies to a crash or a `Ctrl+C`: the last committed batch is the
resume point.

**Re-running a finished import** does nothing instead of creating duplicates:

```
"1gb-test.csv" was already imported as import #1 (5679858 rows). Re-run with --restart to import it again.
```

**`--restart`** discards the unfinished import for that file (cells are removed
via `ON DELETE CASCADE`) and starts from row 1:

```bash
npm run import data/1gb-test.csv --restart
```

Notes:

- Resuming refuses to run if the header no longer matches the stored columns, if
  the checkpoint is past the end of the file, or if it no longer lands on a row
  boundary (i.e. the file was edited _before_ the checkpoint). Editing the file
  _after_ the checkpoint — such as fixing the row that failed — is safe.

---

## 5. Database Maintenance

If you need to wipe the database clean to run another benchmark, use these tools:

**The "Nuclear Option" (Docker Volume Reset):**
If a script was canceled forcefully and the database is locked, obliterate the Docker volume and start fresh:

```bash
docker compose down -v
docker compose up -d
npx drizzle-kit migrate
```

result: Total Import Time: 4:39.565 (m:ss.mmm)
Done! Processed 5679858 rows and inserted 28399290 cells.
Without unlogged
