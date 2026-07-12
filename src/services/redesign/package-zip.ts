import { inflateRawSync } from "node:zlib";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const MAX_ENTRY_COUNT = 256;
const MAX_TOTAL_UNCOMPRESSED_BYTES = 10 * 1024 * 1024;

export class ZipFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ZipFormatError";
  }
}

export type ZipEntry = {
  name: string;
  bytes: Uint8Array;
};

export function createZip(entries: ZipEntry[]) {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    assertSafeEntryName(entry.name);
    const nameBytes = textEncoder.encode(entry.name);
    const payload = entry.bytes;
    const crc = crc32(payload);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, 0, true);
    localView.setUint16(12, 0, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, payload.length, true);
    localView.setUint32(22, payload.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 0, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, payload.length, true);
    centralView.setUint32(24, payload.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);

    localParts.push(localHeader, payload);
    centralParts.push(centralHeader);
    offset += localHeader.length + payload.length;
  }

  const centralDirectory = concatBytes(centralParts);
  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralDirectory.length, true);
  endView.setUint32(16, offset, true);
  endView.setUint16(20, 0, true);

  return concatBytes([...localParts, centralDirectory, endRecord]);
}

export function readZip(bytes: Uint8Array) {
  const eocdOffset = findEndOfCentralDirectory(bytes);
  const eocd = new DataView(bytes.buffer, bytes.byteOffset + eocdOffset, 22);
  const entryCount = eocd.getUint16(10, true);
  if (entryCount > MAX_ENTRY_COUNT) {
    throw new ZipFormatError(`ZIP contains too many entries: ${entryCount}`);
  }

  const centralDirectoryOffset = eocd.getUint32(16, true);
  let cursor = centralDirectoryOffset;
  let totalBytes = 0;
  const entries: ZipEntry[] = [];

  for (let index = 0; index < entryCount; index += 1) {
    const header = new DataView(bytes.buffer, bytes.byteOffset + cursor, 46);
    if (header.getUint32(0, true) !== 0x02014b50) {
      throw new ZipFormatError("Invalid central directory header");
    }

    const compressionMethod = header.getUint16(10, true);
    const compressedSize = header.getUint32(20, true);
    const uncompressedSize = header.getUint32(24, true);
    const nameLength = header.getUint16(28, true);
    const extraLength = header.getUint16(30, true);
    const commentLength = header.getUint16(32, true);
    const localHeaderOffset = header.getUint32(42, true);
    const nameStart = cursor + 46;
    const name = textDecoder.decode(
      bytes.subarray(nameStart, nameStart + nameLength),
    );
    assertSafeEntryName(name);

    totalBytes += uncompressedSize;
    if (totalBytes > MAX_TOTAL_UNCOMPRESSED_BYTES) {
      throw new ZipFormatError("ZIP exceeds total uncompressed size limit");
    }

    const localHeader = new DataView(bytes.buffer, bytes.byteOffset + localHeaderOffset, 30);
    if (localHeader.getUint32(0, true) !== 0x04034b50) {
      throw new ZipFormatError("Invalid local file header");
    }
    const localNameLength = localHeader.getUint16(26, true);
    const localExtraLength = localHeader.getUint16(28, true);
    const payloadOffset = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const payload = bytes.subarray(payloadOffset, payloadOffset + compressedSize);

    let entryBytes: Uint8Array;
    if (compressionMethod === 0) {
      entryBytes = payload;
    } else if (compressionMethod === 8) {
      try {
        entryBytes = inflateRawSync(payload, {
          // Do not trust the compressed stream to honor its declared size.
          // This caps allocation before checking the exact size below.
          maxOutputLength: uncompressedSize + 1,
        });
      } catch {
        throw new ZipFormatError(`ZIP entry could not be safely inflated: ${name}`);
      }
    } else {
      throw new ZipFormatError(`Unsupported ZIP compression method: ${compressionMethod}`);
    }

    if (entryBytes.length !== uncompressedSize) {
      throw new ZipFormatError(`ZIP entry size mismatch for ${name}`);
    }

    entries.push({ name, bytes: entryBytes });
    cursor += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

export function decodeText(bytes: Uint8Array) {
  return textDecoder.decode(bytes);
}

export function encodeText(value: string) {
  return textEncoder.encode(value);
}

function concatBytes(parts: Uint8Array[]) {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    combined.set(part, offset);
    offset += part.length;
  }
  return combined;
}

function findEndOfCentralDirectory(bytes: Uint8Array) {
  for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 65557); index -= 1) {
    if (
      bytes[index] === 0x50 &&
      bytes[index + 1] === 0x4b &&
      bytes[index + 2] === 0x05 &&
      bytes[index + 3] === 0x06
    ) {
      return index;
    }
  }
  throw new ZipFormatError("End of central directory not found");
}

function assertSafeEntryName(name: string) {
  if (name.length === 0) throw new ZipFormatError("ZIP entry name must not be empty");
  if (name.startsWith("/") || name.startsWith("\\") || name.includes("\\")) {
    throw new ZipFormatError(`Unsafe ZIP entry path: ${name}`);
  }
  const segments = name.split("/");
  if (segments.some((segment) => segment === "..")) {
    throw new ZipFormatError(`Unsafe ZIP entry path: ${name}`);
  }
}

const CRC_TABLE = new Uint32Array(256).map((_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
