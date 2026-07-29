import { createWriteStream } from "node:fs";

const TARGET_SIZE_BYTES = 10 * 1024 * 1024 * 1024;
const FILE_NAME = "10gb-test.csv";
const COLUMNS = 10;

async function generate() {
  const stream = createWriteStream(FILE_NAME);

  const header =
    Array.from({ length: COLUMNS }, (_, i) => `c${i + 1}`).join(",") + "\n";
  stream.write(header);

  let bytesWritten = Buffer.byteLength(header);
  let rowCount = 1;

  console.log(`Starting generation of ${FILE_NAME}...`);

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
