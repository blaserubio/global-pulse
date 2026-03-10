import { createHash } from 'crypto';

/**
 * Generate word n-grams (shingles) from text.
 * @param {string} text
 * @param {number} n - gram size (default 3)
 * @returns {string[]}
 */
function shingles(text, n = 3) {
  const words = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean);
  if (words.length < n) return [words.join(' ')];
  const result = [];
  for (let i = 0; i <= words.length - n; i++) {
    result.push(words.slice(i, i + n).join(' '));
  }
  return result;
}

/**
 * Hash a string to a 64-bit BigInt using MD5 (first 8 bytes).
 * @param {string} str
 * @returns {bigint}
 */
function hash64(str) {
  const md5 = createHash('md5').update(str).digest();
  // Read first 8 bytes as unsigned 64-bit big-endian
  return md5.readBigUInt64BE(0);
}

/**
 * Compute a SimHash fingerprint for the given text.
 * @param {string} text
 * @returns {string} Hex string of the 64-bit fingerprint
 */
export function simhash(text) {
  if (!text || text.trim().length === 0) return '0000000000000000';

  const shingleList = shingles(text);
  const bits = new Array(64).fill(0);

  for (const shingle of shingleList) {
    const h = hash64(shingle);
    for (let i = 0; i < 64; i++) {
      if ((h >> BigInt(i)) & 1n) {
        bits[i] += 1;
      } else {
        bits[i] -= 1;
      }
    }
  }

  let fingerprint = 0n;
  for (let i = 0; i < 64; i++) {
    if (bits[i] > 0) {
      fingerprint |= (1n << BigInt(i));
    }
  }

  return fingerprint.toString(16).padStart(16, '0');
}

/**
 * Compute the Hamming distance between two hex fingerprints.
 * @param {string} a - Hex fingerprint
 * @param {string} b - Hex fingerprint
 * @returns {number} Number of differing bits
 */
export function hammingDistance(a, b) {
  const va = BigInt('0x' + a);
  const vb = BigInt('0x' + b);
  let xor = va ^ vb;
  let count = 0;
  while (xor > 0n) {
    count += Number(xor & 1n);
    xor >>= 1n;
  }
  return count;
}

/**
 * Check if two fingerprints are near-duplicates (Hamming distance <= threshold).
 * @param {string} a
 * @param {string} b
 * @param {number} threshold - Maximum bit difference (default 6)
 * @returns {boolean}
 */
export function isNearDuplicate(a, b, threshold = 6) {
  return hammingDistance(a, b) <= threshold;
}
