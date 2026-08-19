/**
 * Reference security demo server.
 *
 * A minimal, zero-dependency HTTP server (node:http) that wires the security
 * module into real request flows so the team can exercise it with curl, Postman,
 * Burp Suite and OWASP ZAP. This is a REFERENCE implementation owned by the
 * security layer — Azin owns the production backend/API; the patterns here
 * (envelope encryption, token fingerprinting, share state machine, atomic
 * download counter, rate limiting, sanitized errors) are what the production
 * API must adopt.
 *
 * Run:
 *   FILE_ENCRYPTION_KEY=$(openssl rand -base64 32) node examples/securityServer.mjs
 *   (dev: ALLOW_EPHEMERAL_KEY=1 to run with an in-memory key)
 *
 * Demo owners "alice" and "bob" are created at startup; bearer tokens are
 * written to <STORAGE_DIR>/../demo-owners.json.
 *
 * NOTE: this demo stores metadata in memory and files to <storage>/files/*.enc.
 * Restarting drops metadata (in-memory), which is expected for a demo only.
 */

import http from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import {
  loadMasterKey,
  encryptFile,
  decryptFile,
  sha256,
  verifyIntegrity,
  generateShareToken,
  fingerprintShareToken,
  hashPassword,
  computeShareState,
  authorizeShareDownload,
  authorizeOwner,
  sanitizeStoredName,
  AttemptLimiter,
  randomId,
  ShareState,
  SecurityError,
} from '../src/security/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8080);
const ROOT = path.resolve(__dirname, '..');
const STORAGE_DIR = path.resolve(process.env.STORAGE_DIR || path.join(ROOT, 'data', 'files'));
const OWNERS_FILE = path.join(path.dirname(STORAGE_DIR), 'demo-owners.json');
const MAX_BODY = 5 * 1024 * 1024; // 5 MB (demo)

const warn = (msg) => console.warn(msg);
const masterKey = loadMasterKey(process.env, { allowEphemeral: !!process.env.ALLOW_EPHEMERAL_KEY, warn });

fs.mkdirSync(STORAGE_DIR, { recursive: true });

// --------------------------------------------------------------------------
// In-memory stores (production: Azin's DB + Abhi's object storage)
// --------------------------------------------------------------------------
const owners = new Map(); // bearerToken -> { id }
const files = new Map(); // fileId -> { id, ownerId, name, sha256, encPath }
const shares = new Map(); // tokenHash -> share row
const sharePasswordLimiter = new AttemptLimiter({ max: 5, windowMs: 15 * 60 * 1000 });

function addOwner(name) {
  const token = process.env.DEMO_OWNER_TOKEN ? Buffer.from(process.env.DEMO_OWNER_TOKEN, 'base64').toString('base64url') : randomId(16);
  owners.set(token, { id: String(name), name: String(name) });
  return { id: String(name), token };
}

// Demo owners
const alice = addOwner('alice');
const bob = addOwner('bob');
fs.writeFileSync(OWNERS_FILE, JSON.stringify({ alice, bob }, null, 2));
console.log(`[security-server] demo owner tokens written to ${OWNERS_FILE}`);

function getRequester(req) {
  const auth = req.headers.authorization || '';
  const m = /^Bearer\s+(\S+)$/.exec(auth);
  if (!m) return null;
  return owners.get(m[1]) || null;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new SecurityError('payload too large', 'PAYLOAD_TOO_LARGE'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function json(body = {}) {
  return Buffer.from(JSON.stringify(body), 'utf8');
}

function send(res, status, headers, body) {
  res.writeHead(status, {
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'",
    ...headers,
  });
  res.end(body);
}

function sendJson(res, status, payload) {
  send(res, status, { 'Content-Type': 'application/json' }, json(payload));
}

function sendError(res, status, err) {
  const code = err && err.code ? err.code : 'INTERNAL_ERROR';
  const message = err instanceof SecurityError ? err.message : 'internal error';
  sendJson(res, status, { error: { code, message } });
}

// --------------------------------------------------------------------------
// Route handlers
// --------------------------------------------------------------------------
async function handleUpload(req, res) {
  const requester = getRequester(req);
  if (!requester) return sendJson(res, 401, { error: { code: 'UNAUTHORIZED', message: 'authentication required' } });
  const rawName = req.headers['x-file-name'];
  const safeName = sanitizeStoredName(rawName);
  if (!safeName) return sendJson(res, 400, { error: { code: 'INVALID_FILENAME', message: 'invalid file name' } });
  const body = await readBody(req);
  if (body.length === 0) return sendJson(res, 400, { error: { code: 'EMPTY_FILE', message: 'empty file' } });

  const fileId = randomId(16);
  const digest = sha256(body);
  const container = encryptFile(masterKey, body);
  const encPath = path.join(STORAGE_DIR, `${fileId}.enc`);
  fs.writeFileSync(encPath, container);

  files.set(fileId, { id: fileId, ownerId: requester.id, name: safeName, sha256: digest, encPath });
  sendJson(res, 201, { fileId, sha256: digest, size: body.length, name: safeName });
}

function handleGetFile(req, res, fileId) {
  const requester = getRequester(req);
  if (!requester) return sendJson(res, 401, { error: { code: 'UNAUTHORIZED', message: 'authentication required' } });
  const file = files.get(fileId);
  if (!file) return sendJson(res, 404, { error: { code: 'NOT_FOUND', message: 'file not found' } });
  const ownerCheck = authorizeOwner({ requesterId: requester.id, ownerId: file.ownerId });
  if (!ownerCheck.allowed) return sendJson(res, 403, { error: { code: 'FORBIDDEN', message: 'forbidden' } });

  let plain;
  try {
    plain = decryptFile(masterKey, fs.readFileSync(file.encPath));
  } catch (err) {
    return sendError(res, 500, err);
  }
  const integrity = verifyIntegrity(plain, file.sha256);
  if (!integrity.valid) {
    return sendJson(res, 500, { error: { code: 'INTEGRITY_FAILED', message: 'integrity verification failed' } });
  }
  send(res, 200, {
    'Content-Type': 'application/octet-stream',
    'Content-Length': plain.length,
    'Content-Disposition': `attachment; filename="${file.name}"`,
    'X-Sha256': file.sha256,
  }, plain);
}

async function handleCreateShare(req, res, fileId) {
  const requester = getRequester(req);
  if (!requester) return sendJson(res, 401, { error: { code: 'UNAUTHORIZED', message: 'authentication required' } });
  const file = files.get(fileId);
  if (!file) return sendJson(res, 404, { error: { code: 'NOT_FOUND', message: 'file not found' } });
  const ownerCheck = authorizeOwner({ requesterId: requester.id, ownerId: file.ownerId });
  if (!ownerCheck.allowed) return sendJson(res, 403, { error: { code: 'FORBIDDEN', message: 'forbidden' } });

  let payload = {};
  try {
    payload = JSON.parse((await readBody(req)).toString('utf8') || '{}');
  } catch {
    return sendJson(res, 400, { error: { code: 'BAD_JSON', message: 'invalid JSON body' } });
  }

  const now = Date.now();
  let expiresAt = null;
  if (payload.expiresInSeconds != null) {
    if (!Number.isInteger(payload.expiresInSeconds) || payload.expiresInSeconds < 1 || payload.expiresInSeconds > 2592000) {
      return sendJson(res, 400, { error: { code: 'INVALID_EXPIRATION', message: 'invalid expiration' } });
    }
    expiresAt = now + payload.expiresInSeconds * 1000;
  } else if (payload.expiresInMinutes != null) {
    if (!Number.isInteger(payload.expiresInMinutes) || payload.expiresInMinutes < 1 || payload.expiresInMinutes > 43200) {
      return sendJson(res, 400, { error: { code: 'INVALID_EXPIRATION', message: 'invalid expiration' } });
    }
    expiresAt = now + payload.expiresInMinutes * 60 * 1000;
  }

  let maxDownloads = null;
  if (payload.maxDownloads != null) {
    if (!Number.isInteger(payload.maxDownloads) || payload.maxDownloads < 1 || payload.maxDownloads > 1000) {
      return sendJson(res, 400, { error: { code: 'INVALID_LIMIT', message: 'invalid download limit' } });
    }
    maxDownloads = payload.maxDownloads;
  }

  let passwordHash = null;
  if (payload.password != null) {
    try {
      const { validateSharePassword } = await import('../src/security/index.js');
      validateSharePassword(payload.password);
      passwordHash = hashPassword(payload.password);
    } catch (err) {
      return sendError(res, 400, err);
    }
  }

  const token = generateShareToken();
  const tokenHash = fingerprintShareToken(token);
  const row = {
    tokenHash,
    fileId,
    ownerId: requester.id,
    passwordHash,
    maxDownloads,
    downloadsUsed: 0,
    expiresAt,
    revoked: false,
    revokedAt: null,
  };
  shares.set(tokenHash, row);
  sendJson(res, 201, {
    token,
    url: `/api/shares/${token}`,
    state: computeShareState(row, now),
  });
}

function handleShareStatus(req, res, token) {
  const row = shares.get(fingerprintShareToken(token));
  const state = row ? computeShareState(row, Date.now()) : ShareState.EXPIRED; // indistinguishable for unknown
  sendJson(res, 200, { state });
}

function handleShareDownload(req, res, token) {
  const tokenHash = fingerprintShareToken(token);
  const row = shares.get(tokenHash);
  if (!row) return sendJson(res, 403, { error: { code: 'FORBIDDEN', message: 'forbidden' } });

  let suppliedPassword = null;
  const q = new URL(req.url, 'http://localhost');
  suppliedPassword = q.searchParams.get('password') || req.headers['x-share-password'] || null;

  // Brute-force guard: gate before doing expensive scrypt work.
  const limiterCheck = sharePasswordLimiter.check(tokenHash);
  if (!limiterCheck.allowed) {
    res.setHeader('Retry-After', String(Math.ceil(limiterCheck.retryAfterMs / 1000)));
    return sendJson(res, 429, { error: { code: 'RATE_LIMITED', message: 'too many attempts' } });
  }

  const decision = authorizeShareDownload({ share: row, suppliedPassword, now: Date.now() });
  if (!decision.allowed) {
    if (row.passwordHash && suppliedPassword) sharePasswordLimiter.recordFailure(tokenHash);
    return sendJson(res, 403, { error: { code: 'FORBIDDEN', message: 'forbidden' } });
  }

  const file = files.get(row.fileId);
  if (!file) {
    row.revoked = true;
    row.revokedAt = Date.now();
    return sendJson(res, 403, { error: { code: 'FORBIDDEN', message: 'forbidden' } });
  }

  // Consume a download. Single-process check-and-increment is race-free here;
  // production must use one atomic conditional UPDATE:
  //   UPDATE shares SET downloads_used = downloads_used + 1
  //   WHERE token_hash = $1 AND downloads_used < max_downloads
  if (row.maxDownloads != null && row.downloadsUsed >= row.maxDownloads) {
    return sendJson(res, 403, { error: { code: 'LIMIT_REACHED', message: 'forbidden' } });
  }
  row.downloadsUsed += 1;
  sharePasswordLimiter.reset(tokenHash);

  let plain;
  try {
    plain = decryptFile(masterKey, fs.readFileSync(file.encPath));
  } catch (err) {
    return sendError(res, 500, err);
  }
  const integrity = verifyIntegrity(plain, file.sha256);
  if (!integrity.valid) {
    return sendJson(res, 500, { error: { code: 'INTEGRITY_FAILED', message: 'integrity verification failed' } });
  }

  send(res, 200, {
    'Content-Type': 'application/octet-stream',
    'Content-Length': plain.length,
    'Content-Disposition': `attachment; filename="${file.name}"`,
    'X-Sha256': file.sha256,
    'X-Remaining-Downloads': String(Math.max(0, (row.maxDownloads ?? Infinity) - row.downloadsUsed)),
  }, plain);
}

function handleRevoke(req, res, token) {
  const requester = getRequester(req);
  if (!requester) return sendJson(res, 401, { error: { code: 'UNAUTHORIZED', message: 'authentication required' } });
  const row = shares.get(fingerprintShareToken(token));
  if (!row) return sendJson(res, 404, { error: { code: 'NOT_FOUND', message: 'share not found' } });
  const ownerCheck = authorizeOwner({ requesterId: requester.id, ownerId: row.ownerId });
  if (!ownerCheck.allowed) return sendJson(res, 403, { error: { code: 'FORBIDDEN', message: 'forbidden' } });
  row.revoked = true;
  row.revokedAt = Date.now();
  sendJson(res, 200, { state: ShareState.REVOKED, revokedAt: row.revokedAt });
}

function handleCreateOwner(req, res) {
  readBody(req)
    .then((buf) => {
      let name = 'anon';
      try {
        const p = JSON.parse(buf.toString('utf8') || '{}');
        if (p.name) name = String(p.name).slice(0, 64);
      } catch { /* keep default */ }
      const o = addOwner(name);
      sendJson(res, 201, { ownerId: o.id, token: o.token });
    })
    .catch((err) => sendError(res, 500, err));
}

// --------------------------------------------------------------------------
// Router
// --------------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (req.method === 'GET' && pathname === '/api/health') {
      return sendJson(res, 200, { ok: true });
    }
    if (req.method === 'POST' && pathname === '/api/owners') {
      return handleCreateOwner(req, res);
    }
    if (req.method === 'POST' && pathname === '/api/files/upload') {
      return await handleUpload(req, res);
    }
    let m = /^\/api\/files\/([0-9a-f]{32})$/.exec(pathname);
    if (req.method === 'GET' && m) return handleGetFile(req, res, m[1]);
    m = /^\/api\/files\/([0-9a-f]{32})\/shares$/.exec(pathname);
    if (req.method === 'POST' && m) return await handleCreateShare(req, res, m[1]);
    m = /^\/api\/shares\/([^/]+)$/.exec(pathname);
    if (req.method === 'GET' && m) return handleShareDownload(req, res, m[1]);
    if (req.method === 'DELETE' && m) return handleRevoke(req, res, m[1]);
    if (req.method === 'GET') {
      const st = /^\/api\/shares\/([^/]+)\/status$/.exec(pathname);
      if (st) return handleShareStatus(req, res, st[1]);
    }
    return sendJson(res, 404, { error: { code: 'NOT_FOUND', message: 'not found' } });
  } catch (err) {
    if (err instanceof SecurityError) return sendError(res, 400, err);
    console.error('[security-server] unhandled error (details never returned to clients)', err);
    return sendJson(res, 500, { error: { code: 'INTERNAL_ERROR', message: 'internal error' } });
  }
});

server.listen(PORT, () => {
  console.log(`[security-server] listening on http://127.0.0.1:${PORT}`);
  console.log(`[security-server] storage: ${STORAGE_DIR}`);
});