# VaultGuard — Secure File Sharing Platform
# Presentation & Demo Script (Team of 4)

> **Project:** Secure File Sharing Platform ("VaultGuard")
> **Team Lead / Presenter 1:** You (the leader) — opens & closes, demo flow
> **Members:** Abhijith (DB/Storage/DevOps), Adhil (Security/Encryption), Azin (Backend/API), Haroon (Frontend/UI)

**Time target:** 12–15 minutes total (suggest ~3–4 min each, don't overlap).
**Golden rules for the demo day:**
1. Have the app already running BEFORE the audience enters (see Run Checklist).
2. Have a **backup tab** logged in with a second account for the "unauthorized access / IDOR" demo.
3. Do NOT rush — pause and let each feature show on screen.
4. Every claim you make ("encrypted", "audit logged") should be **shown live**, not just said.

---

## RUN CHECKLIST (do this morning before presenters)

```bash
# Backend
cd secure-file-backend
npm install
cp .env.example .env        # configure keys (see README)
npm run dev                 # or: npm start

# Seed admin (if not done)
npm run seed:admin          # admin@secure-share.local / ChangeMe_Admin_2026

# Frontend (separate terminal)
cd frontend
npm install
npm run dev                 # runs on http://localhost:5173
```

Verification before demo:
- [ ] Login page loads
- [ ] Upload a small file works
- [ ] Admin login works (seed-admin)
- [ ] A demo `sample.pptx`, `config.ovpn`, and `access.log` ready on desktop
- [ ] Internet/TLS not required (this is localhost)

---

## PART 0 — OPENING (Team Lead, ~1 min)

> "Good morning everyone. Today we're presenting **VaultGuard** — a secure file-sharing platform.
> The problem we're solving is simple but important: **most file-sharing tools store your files in plaintext on the server.** That means the company hosting your files can read them, and a database or storage breach leaks everything.
>
> VaultGuard is built on one core promise: **the server never holds your plaintext.** Files are encrypted before they leave your browser, and we audit every single access. We'll show you the whole thing live. Let me hand over to Adhil, who owns our security layer."

---

## PART 1 — SECURITY & CRYPTO OVERVIEW (Adhil, ~2.5 min)

**Slide points:**
- Zero-dependency crypto — built on Node's native `crypto` (OpenSSL), no hand-rolled algorithms.
- AES-256-GCM encryption **at rest** with envelope encryption.
- SHA-256 integrity verification on every download.
- Password hashing with bcrypt (12 rounds) for users, scrypt for share passwords.
- JWT (HS256) auth with refresh-token rotation.
- Helmet security headers, Zod input validation, rate limiting, magic-byte file validation.

**Talk track:**
> "The security layer is designed around a clear **threat model** — we treat every request as untrusted.
> - **Confidentiality:** every file is encrypted with AES-256-GCM before it's stored. We use *envelope encryption*: each file gets its own random data-encryption key, and that key is itself wrapped by a master key. So even if the storage disk is stolen, the attacker only has ciphertext — no plaintext.
> - **Integrity:** AES-GCM already authenticates data, but we go further — we compute a **SHA-256 hash** at upload and **re-verify it on every download**. If anyone flips a single bit in storage, the download fails the check.
> - **Access control:** ownership is checked on *every* request — that's the **zero-trust** principle. No tricky URL guessing can read another user's file.
> - Finally, we **audit everything**: logins, uploads, downloads, even *failed* access attempts.
>
> Let me give the floor to Azin, who built the API that enforces all of this."

**Demo you can run here (optional, ~30s):**
- Show `security/` folder and run `cd security && npm test` → "59 automated crypto tests, all passing."

---

## PART 2 — BACKEND & API ARCHITECTURE (Azin, ~3 min)

**Slide points:**
- Node.js 20+, Express 5, PostgreSQL 16.
- REST API with Zod validation on every route input.
- Async/error-handling middleware — consistent JSON error responses.
- Parameterized SQL queries throughout (SQL-injection safe).
- Endpoints:
  - Auth: register, login, refresh, logout
  - Files: upload, list, get, download, delete
  - Shares: create, list, download, revoke
  - Logs & Admin

**Talk track (can run with the live app):**
> "The backend is a REST API. Every route is locked behind JWT authentication, and every input is validated with **Zod** before it touches the database. All SQL uses **parameterized queries**, so SQL injection isn't a concern.
>
> The upload pipeline is where the magic happens:
> 1. Multer receives the file in memory.
> 2. We validate the **magic bytes** — we don't trust the MIME type a browser sends, we check the actual file content with the `file-type` library. That's why uploading works for PDFs, images, zips, and our newly supported office/log/VPN config files.
> 3. The file is encrypted and stored; only the hash and metadata go to the database.
>
> Let me now show that live. **Haroon, take over the demo from here."**

---

## PART 3 — FRONTEND & LIVE DEMO (Haroon, ~4 min) — THE MAIN SHOW

**Slide points:**
- React 19, Vite, Tailwind CSS 4, React Router.
- Role-based protected routes, dark mode.
- Pages: Dashboard, Upload, Files, File Details, Shares, Logs, Profile, Admin.

**Demo walkthrough (this is the part people remember — go slowly):**

1. **Landing page** — "This is the public landing page. You register or log in."
2. **Register a new account** (use a demo email) → land on dashboard.
   > "Notice we now have an authenticated session. JWT is stored securely, and refreshing rotates the token."
3. **Go to Upload page.** Open the folder of sample files.
   > "Let's upload three files: a `.pptx` presentation, a `config.ovpn` VPN config, and an `access.log`. These look like common files — you'd reasonably want to share any of them securely."
   - Drag-and-drop or choose the `.pptx` → click **Upload File**.
   - Watch the progress bar. When done: *"has been securely uploaded and encrypted."*
   - Repeat for the `.ovpn` and `.log` (mention they now pass our validation).
4. **Files page** — show the three uploaded files with metadata (size, date).
   > "Each file shows its owner-only metadata. The actual content is ciphertext on disk — you never see plaintext here."
5. **Open a file details page** → **Download it.** 
   > "Download triggers a server-side **SHA-256 re-verification** — if the stored blob had been tampered with, this would fail, proving integrity."
6. **Create a Share link**:
   > "Now the useful part. I'll create a **secure share link** for the presentation. I can set it to be **password-protected**, give it an **expiry** (say 24 hours), and a **download limit** of 3."
   - Copy the generated link (note it's a long, unpredictable token — CSPRNG-generated).
7. **Open the share link in an incognito/private window** (or second tab).
   - Enter the share password → download once.
   - Go back and **revoke** the share from the Shares page → try the link again → it should now be **denied**.
   > "See? Revocation is instant. And if we hit the download limit or expiry, the link stops working server-side."
8. **Security demo (IDOR / unauthorized access):**
   > "Let's prove the zero-trust claim. I'm logged in as User A. Try to open a file URL / ID belonging to User B (from the backup tab)."
   - Show the **403 Forbidden** response — access denied.
9. **Logs page** — 
   > "Every one of these actions was recorded. Here's the audit trail: the upload, the share creation, the download through the link, and even the failed unauthorized access attempt."
10. **Admin dashboard** (log in as admin) — show stats, all users, all files.
    > "Admins have a full overview: user management, all files, and platform security events."

**Backup**: if a file type fails at the last minute, fall back to a plain `.txt`. Keep `sample.txt` ready too.

---

## PART 4 — DATABASE, STORAGE & DEV-OPS (Abhijith, ~3 min)

**Slide points:**
- PostgreSQL 16 — metadata & hashes only (no plaintext, no DEKs).
- Chunked/resumable uploads for large files with SHA-256 verification.
- Full-text search over metadata using PostgreSQL `tsvector`.
- Docker Compose (Postgres + backend + frontend), Nginx, GitHub Actions CI/CD, Render Blueprint for one-click deploy.
- Embedded Postgres for local dev (`npm run db:local`).

**Demo you can run:**
- Open `database1/` — show schema/migrations: "the DB stores original names, MIME, size, SHA-256 — but **no plaintext** and **no encryption keys**."
- Run full-text search: in the Files search bar type a term from a filename → instant results.
- Upload a large file (>5MB) → show it using **chunked upload** with progress.

**Talk track:**
> "Storage is deliberately 'dumb.' The database holds metadata — name, size, hash, timestamps — plus relationship tables, shares, and audit logs. But it never holds file contents or the encryption keys.
> The actual bytes live as encrypted blobs, so a wiped DB or stolen disk reveals nothing useful.
> For deployment, Docker Compose spins up Postgres, the API, and the frontend. We also ship a Render Blueprint so the whole stack deploys to production with one click, and GitHub Actions runs our CI test suite on every push."

---

## PART 5 — TESTING & SECURITY VALIDATION (Adhil + Abhijith, ~1.5 min)

**Slide points:**
- Backend: `npm test` (unit + integration with supertest/pg-mem).
- Frontend: Vitest component tests.
- Security module: **59 automated crypto tests** + **36 live curl-based security checks**.
- CI/CD enforces all tests before merge.

**Demo:**
```bash
cd security && npm test          # 59 tests
npm run security:test            # 36 live HTTP security checks
```
> "This isn't just a demo app — it ships with a real test suite. 59 crypto/security tests and 36 live HTTP security probes that actually attack the running server, all run in CI on every push."

---

## PART 6 — CLOSING (Team Lead, ~30 sec)

> "To summarize: **VaultGuard keeps files confidential (AES-256-GCM), intact (SHA-256), and controlled (zero-trust, revocable expiring shares), with a full audit trail on every action.**
> We're proud of three things:
> 1. Security is built-in, not bolted-on — and it's **tested**, not assumed.
> 2. The whole team owns quality — DB, crypto, API, and UI all have tests in CI.
> 3. It's production-ready to deploy with Docker or Render.
>
> Thank you — we're happy to take questions."

---

## ATTACK DEMOS (choose the ones that fit your time — each ~1–2 min)

> These are **safe, live attacks** you run against your own running server to *prove* the
> defenses work. They demonstrate real vulnerability classes from the threat model and are
> the most memorable part of the demo. **Run them from the CLI** (they look impressive and are
> reproducible). Have the server running, get a token, and substitute your real IDs.

**Setup — get a user token:**
```bash
# Login and capture the access token
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@example.com","password":"SomePass1"}' \
  | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
echo "TOKEN=$TOKEN"
```

---

**ATTACK 1 — IDOR (accessing someone else's file by guessing the ID) — Azin/backend claim**

Exploit attempt: log in as User B, guess a file ID belonging to User A and fetch it.
```bash
# As User B, try to read User A's file (use A's real file ID from the DB or UI)
curl -s http://localhost:8000/api/files/<USER_A_FILE_UUID> \
  -H "Authorization: Bearer $TOKEN_B"
# -> 403 Forbidden
```
**What to say:** "This is *IDOR* — insecure direct object reference. On a naive app, changing the ID in the URL would leak another user's file. Here the owner check runs on **every** request, so you get a clean **403**. And watch the audit log — this failed attempt is recorded."

---

**ATTACK 2 — Guess/brute-force a share token — Adhil/security claim**

Exploit attempt: try random guesses at `/api/shares/<random>`.
```bash
for i in $(seq 1 5); do
  curl -s http://localhost:8000/api/shares/$(openssl rand -hex 8) -o /dev/null -w '%{http_code}\n'
done
# -> 404 (not found) — tokens are CSPRNG 256-bit, effectively unguessable
```
**What to say:** "Share links use a **CSPRNG-generated 256-bit token** stored only as a hash. Guessing one is mathematically infeasible — the server just returns 404. We don't leak whether a token is 'close.'"

---

**ATTACK 3 — Wrong share password (brute-force mitigation + logging) — Adhil**

Exploit attempt: try a wrong password on a password-protected share.
```bash
curl -s -X POST http://localhost:8000/api/shares/<TOKEN>/download \
  -H 'Content-Type: application/json' \
  -d '{"password":"wrongpassword"}'
# -> 401 Incorrect share password
# Run it several times fast -> rate limiter kicks in (429)
```
**What to say:** "Password-protected shares verify with **bcrypt** and are wrapped in a **rate limiter** — hammer it and you get **429 Too Many Requests**. Every wrong guess is logged as `FAILED_SHARE_PASSWORD`."

---

**ATTACK 4 — Expired + revoked share links — Abhijith/Azin**

Exploit attempt: reuse a share after it was **revoked** (or expired, or downloads exhausted).
```bash
# After revoking a share in the UI, try the old link again:
curl -s http://localhost:8000/api/shares/<REVOKED_TOKEN>
# -> 410 Share link has been revoked
```
**What to say:** "Old links don't linger. A **revoked**, **expired**, or **download-limit-exhausted** link returns **410 Gone** — access is cut server-side instantly, no cache."

---

**ATTACK 5 — Fake MIME type / content smuggling — Azin (this is the bug we fixed!)**

Exploit attempt: send a file claiming to be a PDF but whose bytes are actually executable/text.
```bash
# Declare image/png but send plain text bytes -> magic-byte validation rejects it
echo "not a real png" > fake.png
curl -s -X POST http://localhost:8000/api/files/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@fake.png;type=image/png"
# -> 400 (file content does not match declared type)
```
**What to say:** "We never trust the MIME type a client declares. The server checks **magic bytes** with the `file-type` library — a `.png` that isn't a real PNG is rejected. This is exactly the layer we hardened for the new **.pptx / .log / .ovpn** support."

---

**ATTACK 6 — Brute-force / plaintext in DB — Abhijith (data at rest)**

Show (read-only, safe):
```bash
# Inspect the DB schema — confirm no plaintext files and no DEKs are stored
cd secure-file-backend && npm run db:local   # opens local Postgres
psql -c "\d files"                            # show columns: only metadata + sha256
```
**What to say:** "Even the database admin cannot read file contents — the DB stores name, size, and a **SHA-256 hash**, but **never the plaintext or the encryption keys.** A stolen database dump is useless."

---

## ATTACK 7 — Email-OTP verification: the honest Burp Suite demo (Adhil)

> This is the demo to do **with Burp Suite**. Present the security properties **your code already
> enforces** — do NOT stage "intercepting the OTP from the wire," which is just normal TLS that an
> attacker cannot read without a custom CA. The impressive, honest story is:
> **the OTP is single-use, short-lived, rate-limited, and logged.**

### The share flow your API implements
```
1. POST /api/shares/:token/request-access   { email }          -> emails a 6-digit code
2. POST /api/shares/:token/verify-access    { email, code }    -> returns downloadToken (5 min)
3. POST /api/shares/:token/download         { downloadToken }  -> downloads the file
```

### How to drive it through Burp (Burp Suite Community is fine)

1. **Proxy setup:** Browser -> manual proxy `127.0.0.1:8080` (Burp). Enable Burp's CA for HTTPS, *or* run the server over HTTP on localhost and point a `curl`/Repeater at it directly.
2. Create an **email-restricted share** in the UI (set an `allowedEmail`). Copy the share token.
3. **Burp Repeater — request-access:**
   ```
   POST /api/shares/<TOKEN>/request-access
   Content-Type: application/json

   {"email":"recipient@example.com"}
   ```
   -> `200` + "Access code sent to your email".
4. Read the real 6-digit code from the recipient mailbox (you own the test inbox).
5. **Burp Repeater — verify-access (correct code):**
   ```
   POST /api/shares/<TOKEN>/verify-access
   Content-Type: application/json

   {"email":"recipient@example.com","code":"123456"}
   ```
   -> `200` + `downloadToken`.

### The three "attacks" that demonstrate real security (run each in Repeater with Burp):

**(a) OTP reuse — single-use enforcement** *(most impressive)*
- Replay the *same* `verify-access` request (same email + code) a second time.
- -> `400 No valid code found. Please request a new one.` (code row is marked `used_at` at `share.controller.js:352`).
- **Say:** "Even if an attacker sniffs a legit code, it works exactly **once**. Replaying the same captured request is rejected — the code is single-use."

**(b) Wrong-code attempt — log + rate limit**
- Fire many `verify-access` requests with wrong codes via Burp **Intruder** (position on `code`, payload = number list).
- -> `401 Incorrect code` each time, and after the `shareLimiter` window (60 req / 15 min, `rateLimit.js:28`) -> `429 Too many share requests`.
- **Say:** "6-digit codes can't be brute-forced here: each failure is logged as `FAILED_ACCESS_CODE` and the endpoint is **rate-limited**, so an attacker can't grind through the 1M-combination space."

**(c) Download-token is short-lived**
- Wait >5 minutes, then use a captured `downloadToken` in `POST /api/shares/<TOKEN>/download`.
- -> `403 Invalid or expired verification token...` (token expiry at `share.controller.js:362`).
- **Say:** "Even a captured download token dies in **5 minutes** — a stale stolen token is useless."

### Cleanup / honesty note
- The OTP **travels over TLS** in production — the client (Burp) only gets it because it's acting as the *legitimate recipient* submitting the code the user received. Frame the demo as "we put the recipient's browser through Burp to show the replay defenses," **not** as "we hacked the email."

---

## Q&A — LIKELY QUESTIONS & ANSWERS

**Q: "Where would you actually use this? Why is it needed?"**

> **Answer (Team Lead):**
>
> "Because **the #1 risk with normal file-sharing tools isn't the link leaking — it's the server holding plaintext.**
>
> **Where we use it:**
> - **Inside organizations** — sharing confidential docs (contracts, payroll, legal, VPN configs, credentials) where the *platform admin shouldn't be able to read them* (zero-trust / internal-security requirement).
> - **Cross-team/cross-org exchanges** — sending files to partners or clients via link, but with **control**: password, expiry, download limit, and one-click **revocation**.
> - **Regulated environments** (health, finance, legal) that demand encryption-at-rest, integrity verification, and **audit trails** for compliance.
> - **Personally** — sending sensitive files where you want to know *exactly* who downloaded them and when.
>
> **Why it's needed (the pain it removes):**
> - **Confidentiality:** with most tools, if the storage or database is breached, files are readable. Ours are ciphertext — useless to an attacker.
> - **Integrity:** files are cryptographically verified on every download — you'll *know* if anything was tampered with.
> - **Access control:** no deleting shares by hand — with **revocable, expiring links** you can cut access instantly, unlike an email attachment you can never take back.
> - **Accountability:** every access (including *failed* ones) is logged — so if a rogue download happens, you can trace it.
> - **UX vs. email:** sharing a file should be as easy as 'send a link,' but with **security, not just convenience**."
>
> **Short 1-line version** if time is tight:
>
> > "We use it to share sensitive files with full control — password, expiry, revocation, and audit — and because files stay encrypted on the server, a breach or even the admin can't read the contents."

**Q: "Is the file ever decrypted on the server?"**
A: No — files are encrypted before leaving the client and decrypted in memory only when an authorized owner or shareholder downloads. Plaintext is never persisted.

**Q: "What happens if the master encryption key leaks?"**
A: The master key wraps per-file keys. It's held in server env config, not in the DB. Rotating it is a documented ops procedure; it never touches file content directly (envelope encryption).

**Q: "How do you stop someone brute-forcing a share password?"**
A: Share-download endpoints are rate-limited, and every failed attempt is audit-logged.

**Q: "Why zero dependencies for crypto?"**
A: Using Node's native `crypto` (backed by OpenSSL) means no third-party cryptographic code to audit or accidentally misconfigure — the algorithms are battle-tested, and we just configure them correctly.

**Q: "Can admins read users' files?"**
A: No. Even admins only see metadata and audit logs. Because the server never stores plaintext, there's no way to read file contents without the owner's decryption flow.

**Q: "What about very large files?"**
A: We support chunked/resumable uploads (>5MB threshold) with SHA-256 verification across all chunks, up to 2GB.

---

## TEAM ROLE CHEAT-SHEET (who says what)

| Speaker | Part | Core message |
|---|---|---|
| **Team Lead** | 0 + 6 | Open, keep flow, close |
| **Adhil** | 1 + part of 5 | Security & crypto |
| **Azin** | 2 | Backend & API |
| **Haroon** | 3 | Frontend + live demo |
| **Abhijith** | 4 + part of 5 | DB, storage, DevOps, testing |
| **All** | Q&A | Answer from your own domain |
