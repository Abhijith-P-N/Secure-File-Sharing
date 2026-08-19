#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Live security testing against the reference server, using curl.
# Covers: IDOR, broken access control, token guessing, brute force, weak
# passwords, file manipulation, hash integrity, expiry, revocation, download
# limit, unauthorized downloads.
#
# Usage:  bash scripts/security-test.sh
# Tip:    rerun the SAME scenarios through Burp Suite / OWASP ZAP to capture
#         them as evidence for the security report.
# ---------------------------------------------------------------------------
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT=${PORT:-8181}
BASE="http://127.0.0.1:$PORT"
TEST_STORAGE="$ROOT/data/security-test/files"
SERVER_PID=""
PASS=0
FAIL=0

cleanup() {
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null
  rm -rf "$ROOT/data/security-test"
}
trap cleanup EXIT

check() { # <name> <expected> <actual>
  if [ "$2" = "$3" ]; then
    PASS=$((PASS+1)); printf '  PASS  %s\n' "$1"
  else
    FAIL=$((FAIL+1)); printf '  FAIL  %s (expected=%s actual=%s)\n' "$1" "$2" "$3"
  fi
}

# code only, discard body and headers
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
# code + save body to the scratch file
code_body() { curl -s -o "$ROOT/data/security-test/.body" -w '%{http_code}' "$@"; }
field() { [ -f "$ROOT/data/security-test/.body" ] || { echo ''; return; }; \
  node -e "const d=require('fs').readFileSync('$ROOT/data/security-test/.body','utf8');try{process.stdout.write(String(JSON.parse(d).$1??''))}catch{process.stdout.write('')}"; }

echo "[*] starting security reference server (port $PORT, ephemeral key)..."
mkdir -p "$ROOT/data/security-test"
ALLOW_EPHEMERAL_KEY=1 PORT=$PORT STORAGE_DIR="$TEST_STORAGE" \
  node "$ROOT/examples/securityServer.mjs" >"$ROOT/data/security-test-server.log" 2>&1 &
SERVER_PID=$!

for _ in $(seq 1 50); do
  curl -s -o /dev/null "$BASE/api/health" 2>/dev/null && break
  sleep 0.2
done
curl -s -o /dev/null "$BASE/api/health" || { echo "[!] server failed to start"; cat "$ROOT/data/security-test-server.log"; exit 1; }

mkdir -p "$ROOT/data/security-test"
TOK_ALICE=$(node -e "process.stdout.write(require('$ROOT/data/security-test/demo-owners.json').alice.token)")
TOK_BOB=$(node -e "process.stdout.write(require('$ROOT/data/security-test/demo-owners.json').bob.token)")

head -c 2048 /dev/urandom > "$ROOT/data/security-test/source.bin"

echo ""
echo "[*] 1. UPLOAD & OWNER ACCESS"
h=$(code_body -X POST -H "Authorization: Bearer $TOK_ALICE" -H "X-File-Name: report.pdf" \
  --data-binary "@$ROOT/data/security-test/source.bin" "$BASE/api/files/upload")
check "upload -> 201" 201 "$h"
FILE_ID=$(field fileId)
UP_SHA=$(field sha256)

check "owner GET file -> 200" 200 "$(code -H "Authorization: Bearer $TOK_ALICE" "$BASE/api/files/$FILE_ID")"
check "Bob GET Alice file -> 403 (IDOR)" 403 "$(code -H "Authorization: Bearer $TOK_BOB" "$BASE/api/files/$FILE_ID")"
check "anonymous GET file -> 401" 401 "$(code "$BASE/api/files/$FILE_ID")"
check "modified file id -> 404" 404 "$(code -H "Authorization: Bearer $TOK_BOB" "$BASE/api/files/${FILE_ID%?}0")"

echo ""
echo "[*] 2. DOWNLOAD INTEGRITY (X-Sha256 of served bytes == upload sha256)"
curl -s -D "$ROOT/data/security-test/.headers" -o "$ROOT/data/security-test/download.bin" \
  -H "Authorization: Bearer $TOK_ALICE" "$BASE/api/files/$FILE_ID"
DL_SHA=$(sed -n 's/^X-Sha256:[[:space:]]*\([0-9a-f]*\).*/\1/Ip' "$ROOT/data/security-test/.headers" | tr -d '\r')
check "served bytes hash matches stored sha256" "$UP_SHA" "$DL_SHA"
cmp -s "$ROOT/data/security-test/source.bin" "$ROOT/data/security-test/download.bin" \
  && check "served plaintext equals original file" "identical" "identical" \
  || { check "served plaintext equals original file" "identical" "DIFFERENT"; }

echo ""
echo "[*] 3. SHARE WITH PASSWORD + DOWNLOAD LIMIT + EXPIRY (24h)"
h=$(code_body -X POST -H "Authorization: Bearer $TOK_ALICE" -H 'Content-Type: application/json' \
  -d '{"password":"just-a-strong-password","maxDownloads":3,"expiresInMinutes":1440}' \
  "$BASE/api/files/$FILE_ID/shares")
check "create protected share -> 201" 201 "$h"
TOKEN=$(field token)
echo "      share token=$TOKEN"
code_body "$BASE/api/shares/$TOKEN/status" >/dev/null
check "share status ACTIVE" "ACTIVE" "$(field state)"
check "download without password -> 403" 403 "$(code "$BASE/api/shares/$TOKEN")"
check "download wrong password -> 403" 403 "$(code -H 'X-Share-Password: nope' "$BASE/api/shares/$TOKEN")"
for i in 1 2 3; do
  check "download $i/3 with password -> 200" 200 \
    "$(code -H 'X-Share-Password: just-a-strong-password' "$BASE/api/shares/$TOKEN")"
done
check "download 4/3 -> 403 (limit reached)" 403 \
  "$(code -H 'X-Share-Password: just-a-strong-password' "$BASE/api/shares/$TOKEN")"
code_body "$BASE/api/shares/$TOKEN/status" >/dev/null
check "share status LIMIT_REACHED" "LIMIT_REACHED" "$(field state)"

echo ""
echo "[*] 4. BRUTE FORCE / RATE LIMITING"
h=$(code_body -X POST -H "Authorization: Bearer $TOK_ALICE" -H 'Content-Type: application/json' \
  -d '{"password":"still-a-strong-password"}' "$BASE/api/files/$FILE_ID/shares")
BFTOK=$(field token)
for i in 1 2 3 4 5; do
  check "wrong password attempt $i -> 403" 403 "$(code -H 'X-Share-Password: wrong' "$BASE/api/shares/$BFTOK")"
done
check "6th wrong attempt -> 429 (rate limited)" 429 \
  "$(code -H 'X-Share-Password: wrong' "$BASE/api/shares/$BFTOK")"

echo ""
echo "[*] 5. WEAK PASSWORD POLICY"
check "short password rejected -> 400" 400 \
  "$(code -X POST -H "Authorization: Bearer $TOK_ALICE" -H 'Content-Type: application/json' \
    -d '{"password":"short"}' "$BASE/api/files/$FILE_ID/shares")"

echo ""
echo "[*] 6. REVOCATION (terminal state)"
h=$(code_body -X POST -H "Authorization: Bearer $TOK_ALICE" -H 'Content-Type: application/json' \
  -d '{"maxDownloads":10}' "$BASE/api/files/$FILE_ID/shares")
RVTOK=$(field token)
check "download before revoke -> 200" 200 "$(code "$BASE/api/shares/$RVTOK")"
check "owner revoke -> 200" 200 "$(code -X DELETE -H "Authorization: Bearer $TOK_ALICE" "$BASE/api/shares/$RVTOK")"
code_body "$BASE/api/shares/$RVTOK/status" >/dev/null
check "post-revoke status REVOKED" "REVOKED" "$(field state)"
check "download after revoke -> 403" 403 "$(code "$BASE/api/shares/$RVTOK")"
check "revoke by non-owner -> 403" 403 "$(code -X DELETE -H "Authorization: Bearer $TOK_BOB" "$BASE/api/shares/$RVTOK")"

echo ""
echo "[*] 7. EXPIRATION (1-second expiry)"
h=$(code_body -X POST -H "Authorization: Bearer $TOK_ALICE" -H 'Content-Type: application/json' \
  -d '{"expiresInSeconds":1}' "$BASE/api/files/$FILE_ID/shares")
EXTOK=$(field token)
code_body "$BASE/api/shares/$EXTOK/status" >/dev/null
check "before expiry status ACTIVE" "ACTIVE" "$(field state)"
sleep 2
code_body "$BASE/api/shares/$EXTOK/status" >/dev/null
check "after expiry status EXPIRED" "EXPIRED" "$(field state)"
check "download after expiry -> 403" 403 "$(code "$BASE/api/shares/$EXTOK")"

echo ""
echo "[*] 8. TOKEN GUESSING"
GUESS=$(head -c 32 /dev/urandom | base64 | tr '+/' '-_' | tr -d '=' | cut -c1-43)
check "random 256-bit token guess -> 403" 403 "$(code "$BASE/api/shares/$GUESS")"

echo ""
echo "[*] 9. FILE MANIPULATION (corrupted stored ciphertext)"
ENC_FILE="$TEST_STORAGE/$FILE_ID.enc"
if [ -f "$ENC_FILE" ]; then
  printf '\x00' | dd of="$ENC_FILE" bs=1 seek=100 count=1 conv=notrunc 2>/dev/null
  h=$(code_body -H "Authorization: Bearer $TOK_ALICE" "$BASE/api/files/$FILE_ID")
  TAMPER_CODE=$(field error.code)
  check "tampered blob -> 500 (GCM/integrity)" "FILE_DECRYPT_FAILED" "$TAMPER_CODE"
  CTYPE=$(curl -s -o /dev/null -w '%{content_type}' -H "Authorization: Bearer $TOK_ALICE" "$BASE/api/files/$FILE_ID")
  check "tampered response is JSON, not file bytes" "application/json" "$CTYPE"
else
  echo "  SKIP  encrypted blob not found ($ENC_FILE)"
fi

echo ""
echo "[*] 10. PATH TRAVERSAL (file name sanitization)"
h=$(code_body -X POST -H "Authorization: Bearer $TOK_ALICE" -H "X-File-Name: ../../../../etc/passwd" \
  --data-binary "x" "$BASE/api/files/upload")
check "upload with traversal name -> 201 (sanitized)" 201 "$h"
check "stored name is clean basename" "passwd" "$(field name)"

echo ""
echo "RESULT: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
echo "   All live security checks passed."