import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const digestAlgorithm = 'sha256-utf8-lf-v1';

// Normalize only the UTF-8 BOM and CRLF line endings, never whitespace or content.
export function configDigest(bytes) {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  return createHash('sha256').update(text.replace(/\r\n/g, '\n'), 'utf8').digest('hex');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length < 3) throw new Error('Usage: node scripts/config-digest.mjs <file> [...]');
  for (const path of process.argv.slice(2)) {
    console.log(JSON.stringify({ path, algorithm: digestAlgorithm, digest: configDigest(readFileSync(path)) }));
  }
}
