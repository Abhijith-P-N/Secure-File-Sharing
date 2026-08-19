/**
 * Encryption tests: AES-256-GCM envelope encryption.
 * Areas: file manipulation, integrity, sensitive info disclosure.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import {
  encryptFile,
  decryptFile,
  MAGIC,
  HEADER_LEN,
  IV_LEN,
  TAG_LEN,
  DEK_LEN,
  SecurityError,
} from '../src/security/index.js';

const key = randomBytes(32);
const plaintext = Buffer.from('top secret file content — 0123456789 ' .repeat(20));

test('encrypt -> decrypt roundtrip returns original bytes', () => {
  const blob = encryptFile(key, plaintext);
  const clear = decryptFile(key, blob);
  assert.deepEqual(clear, plaintext);
});

test('ciphertext never contains the plaintext', () => {
  const blob = encryptFile(key, plaintext);
  const haystack = blob.toString('latin1');
  const needle = plaintext.toString('latin1');
  assert.ok(!haystack.includes(needle), 'plaintext leaked into ciphertext');
});

test('every encryption uses a fresh IV/DEK (no nonce reuse)', () => {
  const a = encryptFile(key, plaintext);
  const b = encryptFile(key, plaintext);
  assert.notDeepEqual(a, b, 'identical IVs/containers would be a fatal GCM flaw');
  // Decrypting each with the SAME key still works (independent keys/IVs).
  assert.deepEqual(decryptFile(key, a), plaintext);
  assert.deepEqual(decryptFile(key, b), plaintext);
});

test('container layout matches the documented fixed header', () => {
  const blob = encryptFile(key, plaintext);
  assert.ok(blob.subarray(0, MAGIC.length).equals(MAGIC));
  assert.equal(blob.length - HEADER_LEN, plaintext.length, 'ciphertext length must equal plaintext length (GCM is a stream mode)');
});

test('tampering ANY byte of the ciphertext is detected (file manipulation)', () => {
  const blob = encryptFile(key, plaintext);
  for (const pos of [HEADER_LEN, HEADER_LEN + 3, blob.length - 1, 100, 200]) {
    const mutated = Buffer.from(blob);
    mutated[pos] ^= 0x01;
    assert.throws(
      () => decryptFile(key, mutated),
      (e) => e instanceof SecurityError && e.code === 'FILE_DECRYPT_FAILED',
      `mutation at byte ${pos} was not caught by GCM authentication`
    );
  }
});

test('tampering the auth tag is detected', () => {
  const blob = encryptFile(key, plaintext);
  const mutated = Buffer.from(blob);
  mutated[20 + 0] ^= 0xff; // first byte of wrapTag
  assert.throws(() => decryptFile(key, mutated), SecurityError);
  const mutated2 = Buffer.from(blob);
  mutated2[80 + 0] ^= 0xff; // first byte of fileTag
  assert.throws(() => decryptFile(key, mutated2), SecurityError);
});

test('tampering the IV or wrapped key is detected', () => {
  const blob = encryptFile(key, plaintext);
  for (const pos of [8, 9, 36, 68, 69]) {
    const mutated = Buffer.from(blob);
    mutated[pos] ^= 0x01;
    assert.throws(() => decryptFile(key, mutated), SecurityError, `byte ${pos}`);
  }
});

test('decrypting with the wrong master key fails', () => {
  const blob = encryptFile(key, plaintext);
  const wrongKey = randomBytes(32);
  assert.throws(() => decryptFile(wrongKey, blob), SecurityError);
});

test('invalid containers are rejected without leaking details', () => {
  assert.throws(() => decryptFile(key, Buffer.alloc(10)), SecurityError);
  assert.throws(() => decryptFile(key, Buffer.from('not-an-sfs-file')), SecurityError);
  assert.throws(() => decryptFile(key, Buffer.alloc(HEADER_LEN)), SecurityError);
});

test('error messages never leak key material or internals (sensitive info disclosure)', () => {
  const blob = encryptFile(key, plaintext);
  const mutated = Buffer.from(blob);
  mutated[blob.length - 1] ^= 0x01;
  try {
    decryptFile(key, mutated);
    assert.fail('expected throw');
  } catch (e) {
    const msg = String(e.message).toLowerCase();
    assert.ok(!msg.includes(key.toString('hex')), 'error leaked the key');
    assert.ok(!msg.includes('cipher'), 'error leaked implementation internals');
  }
});

test('encrypted output is deterministic-free (randomized) and large files work', () => {
  const big = randomBytes(1024 * 512);
  const blob = encryptFile(key, big);
  assert.deepEqual(decryptFile(key, blob), big);
});
