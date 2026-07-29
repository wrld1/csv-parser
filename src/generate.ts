import { createWriteStream, mkdirSync } from "node:fs";
import { join } from "node:path";

const COLUMNS = 10;

async function generate() {
  let sizeGb = 10;
  const sizeArg = process.argv.find((arg) => arg.startsWith("--size="));

  if (sizeArg) {
    const match = sizeArg.match(/--size=(\d+)gb/i);
    if (match && match[1]) {
      sizeGb = parseInt(match[1], 10);
    } else {
      console.error("Error: Invalid size format. Use --size=2gb");
      process.exit(1);
    }
  }

  const dataDir = "data";
  mkdirSync(dataDir, { recursive: true });

  const TARGET_SIZE_BYTES = sizeGb * 1024 * 1024 * 1024;
  const FILE_NAME = join(dataDir, `${sizeGb}gb-test.csv`);

  const stream = createWriteStream(FILE_NAME);

  const header =
    Array.from({ length: COLUMNS }, (_, i) => `c${i + 1}`).join(",") + "\n";
  stream.write(header);

  let bytesWritten = Buffer.byteLength(header);
  let rowCount = 1;

  console.log(`Starting generation of ${FILE_NAME} (${sizeGb} GB)...`);

  while (bytesWritten < TARGET_SIZE_BYTES) {
    const row =
      Array.from(
        { length: COLUMNS },
        (_, i) => `c${i + 1} text row${rowCount}`,
      ).join(",") + "\n";

    const canContinue = stream.write(row);
    bytesWritten += Buffer.byteLength(row);
    rowCount++;

    if (!canContinue) {
      await new Promise((resolve) => stream.once("drain", resolve));
    }

    if (rowCount % 1_000_000 === 0) {
      console.log(
        `Progress: ${(bytesWritten / 1024 / 1024 / 1024).toFixed(2)} GB written...`,
      );
    }
  }

  stream.end();
  console.log(`Done! Created ${rowCount - 1} rows.`);
}

generate();
