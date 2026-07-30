import { createReadStream } from "node:fs";
import { open } from "node:fs/promises";
import { parse, type Options as ParserOptions } from "csv-parse";

const PARSER_OPTIONS: ParserOptions = {
  bom: true,
  skip_empty_lines: true,
  relax_column_count: true,
  relax_quotes: true,
  info: true,
};

export function readRows(file: string, startByteOffset: number) {
  return createReadStream(file, { start: startByteOffset }).pipe(
    parse(PARSER_OPTIONS),
  );
}

export async function readHeader(file: string) {
  const source = createReadStream(file);
  const parser = source.pipe(parse(PARSER_OPTIONS));

  try {
    for await (const { record, info } of parser) {
      return { columnNames: record, offset: info.bytes };
    }
  } finally {
    parser.destroy();
    source.destroy();
  }

  throw new Error("File is empty!");
}

export function pickEvenColumns(columnNames: string[], offset: number) {
  const indexes = columnNames.map((_, i) => i).filter((i) => i % 2 === offset);

  return { indexes, names: indexes.map((i) => columnNames[i]!) };
}

export async function isRecordBoundary(file: string, offset: number) {
  if (offset === 0) return true;

  const handle = await open(file, "r");
  try {
    const { buffer, bytesRead } = await handle.read(
      Buffer.alloc(1),
      0,
      1,
      offset - 1,
    );
    return bytesRead === 1 && (buffer[0] === 0x0a || buffer[0] === 0x0d);
  } finally {
    await handle.close();
  }
}
