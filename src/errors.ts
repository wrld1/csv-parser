import type { NewImportCell } from "./db/schema.js";

export class RowImportError extends Error {
  constructor(
    readonly rowNumber: number,
    readonly cells: NewImportCell[],
    cause: unknown,
  ) {
    super(`Row ${rowNumber} could not be imported`, { cause });
  }
}

export function describeError(error: unknown) {
  let root = error;
  while (root instanceof Error && root.cause !== undefined) root = root.cause;

  const message = root instanceof Error ? root.message : String(root);
  const detail = (root as { detail?: string })?.detail;

  return detail ? `${message} (${detail})` : message;
}
