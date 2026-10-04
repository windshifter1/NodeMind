/** Minimal ZIP store (method 0) writer/reader — no compression dependency. */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function u16(n) {
  const b = new Uint8Array(2);
  new DataView(b.buffer).setUint16(0, n, true);
  return b;
}

function u32(n) {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n, true);
  return b;
}

function concatBytes(parts) {
  let total = 0;
  for (const part of parts) total += part.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

async function toUint8Array(data) {
  if (data == null) return new Uint8Array(0);
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    return new Uint8Array(await data.arrayBuffer());
  }
  if (typeof data === 'string') return encoder.encode(data);
  throw new Error('Unsupported zip entry data');
}

/**
 * @param {{ name: string, data: string|Uint8Array|ArrayBuffer|Blob }[]} entries
 * @returns {Promise<Blob>}
 */
export async function createZipBlob(entries = []) {
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const entry of entries) {
    const name = String(entry.name || '').replace(/^\/+/, '');
    if (!name) continue;
    const nameBytes = encoder.encode(name);
    const data = await toUint8Array(entry.data);
    const checksum = crc32(data);
    const local = concatBytes([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(checksum),
      u32(data.length),
      u32(data.length),
      u16(nameBytes.length),
      u16(0),
      nameBytes,
      data,
    ]);
    const central = concatBytes([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(checksum),
      u32(data.length),
      u32(data.length),
      u16(nameBytes.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      nameBytes,
    ]);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }

  const centralStart = offset;
  const centralBytes = concatBytes(centrals);
  const end = concatBytes([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(centrals.length),
    u16(centrals.length),
    u32(centralBytes.length),
    u32(centralStart),
    u16(0),
  ]);

  return new Blob([concatBytes([...locals, centralBytes, end])], { type: 'application/zip' });
}

function findEndOfCentralDirectory(bytes) {
  // EOCD is at least 22 bytes; comment can make it longer. Scan from end.
  const min = 22;
  if (bytes.length < min) return -1;
  const maxScan = Math.min(bytes.length, 22 + 0xffff);
  for (let i = bytes.length - min; i >= bytes.length - maxScan; i -= 1) {
    if (
      bytes[i] === 0x50 &&
      bytes[i + 1] === 0x4b &&
      bytes[i + 2] === 0x05 &&
      bytes[i + 3] === 0x06
    ) {
      return i;
    }
  }
  return -1;
}

/**
 * @param {Blob|ArrayBuffer|Uint8Array} input
 * @returns {Promise<Map<string, Uint8Array>>}
 */
export async function readZipEntries(input) {
  const bytes =
    input instanceof Uint8Array
      ? input
      : new Uint8Array(
          input instanceof ArrayBuffer
            ? input
            : await (input instanceof Blob ? input.arrayBuffer() : Promise.reject(new Error('Invalid zip')))
        );

  const eocd = findEndOfCentralDirectory(bytes);
  if (eocd < 0) throw new Error('Not a valid NodeMind backup zip');

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const entriesCount = view.getUint16(eocd + 10, true);
  let centralOffset = view.getUint32(eocd + 16, true);
  const out = new Map();

  for (let i = 0; i < entriesCount; i += 1) {
    if (view.getUint32(centralOffset, true) !== 0x02014b50) {
      throw new Error('Corrupt zip central directory');
    }
    const compression = view.getUint16(centralOffset + 10, true);
    const compressedSize = view.getUint32(centralOffset + 20, true);
    const nameLen = view.getUint16(centralOffset + 28, true);
    const extraLen = view.getUint16(centralOffset + 30, true);
    const commentLen = view.getUint16(centralOffset + 32, true);
    const localOffset = view.getUint32(centralOffset + 42, true);
    const name = decoder.decode(bytes.subarray(centralOffset + 46, centralOffset + 46 + nameLen));

    if (view.getUint32(localOffset, true) !== 0x04034b50) {
      throw new Error(`Corrupt zip entry: ${name}`);
    }
    const localNameLen = view.getUint16(localOffset + 26, true);
    const localExtraLen = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const data = bytes.subarray(dataStart, dataStart + compressedSize);

    if (compression !== 0) {
      throw new Error(`Unsupported zip compression in ${name}`);
    }
    out.set(name, data);

    centralOffset += 46 + nameLen + extraLen + commentLen;
  }

  return out;
}

export function zipEntryText(entries, name) {
  const data = entries.get(name);
  if (!data) return null;
  return decoder.decode(data);
}

export function zipEntryJson(entries, name) {
  const text = zipEntryText(entries, name);
  if (text == null) return null;
  return JSON.parse(text);
}
