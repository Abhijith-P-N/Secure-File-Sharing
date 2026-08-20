import { fileTypeFromBuffer } from "file-type";

export class FileValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "FileValidationError";
  }
}

// Types that have reliable magic-byte signatures.
const SIGNATURE_TYPES = new Map([
  ["application/pdf", "pdf"],
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/gif", "gif"],
  ["application/zip", "zip"]
]);

// Types with no signature bytes; validated as plain text only.
const TEXTUAL_TYPES = new Set(["text/plain", "application/json"]);

function looksBinary(head) {
  // Heuristic: text files rarely contain NUL bytes in the first 1 KiB.
  for (let i = 0; i < head.length; i += 1) {
    if (head[i] === 0) return true;
  }
  return false;
}

export async function validateFileSignature(buffer, declaredMime) {
  if (!buffer || buffer.length === 0) {
    throw new FileValidationError("Empty files are not allowed");
  }

  if (TEXTUAL_TYPES.has(declaredMime)) {
    if (looksBinary(buffer.subarray(0, 1024))) {
      throw new FileValidationError(`Content does not match declared type ${declaredMime}`);
    }
    return true;
  }

  const detected = await fileTypeFromBuffer(buffer);
  if (!detected) {
    throw new FileValidationError("File signature could not be determined");
  }
  if (SIGNATURE_TYPES.get(declaredMime) !== detected.ext || detected.mime !== declaredMime) {
    throw new FileValidationError("File content does not match its declared type");
  }
  return true;
}