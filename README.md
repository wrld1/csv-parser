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

Push the database schema (creates the necessary tables):

```bash
npx drizzle-kit push
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

To run the import with maximum speed, we use the `--withUnlogged=true` flag. This temporarily disables PostgreSQL's Write-Ahead Log (WAL) for the table, instantly cutting disk writes in half.

```bash
npm run import -- data/1gb-test.csv --withUnlogged=true
```

---

## 4. Database Maintenance

If you need to wipe the database clean to run another benchmark, use these tools:

**The "Nuclear Option" (Docker Volume Reset):**
If a script was canceled forcefully and the database is locked, obliterate the Docker volume and start fresh:

```bash
docker compose down -v
docker compose up -d
npx drizzle-kit migrate
```
