
# Start Here — Windows + VS Code

## 1. Requirements

Install:
- Node.js 20+
- PostgreSQL 14+
- VS Code

## 2. Open the project

Extract this ZIP and open the `secure-file-backend` folder in VS Code.

Open:
**Terminal → New Terminal**

The terminal should be inside the project folder, for example:

```powershell
PS C:\Users\YourName\Downloads\secure-file-backend>
```

## 3. Install dependencies

```powershell
npm install
```

## 4. Create `.env`

Run:

```powershell
Copy-Item .env.example .env
```

Open `.env` and set your PostgreSQL password.

Example:

```env
DATABASE_URL=postgres://postgres:YOUR_PASSWORD@localhost:5432/secure_files
JWT_SECRET=change-this-to-a-long-random-secret
FILE_ENCRYPTION_KEY=change-this-to-another-long-random-secret
```

Do not commit `.env` to Git.

## 5. Create the database

In pgAdmin:
1. Create a database named `secure_files`.
2. Open Query Tool for `secure_files`.
3. Open `src/config/schema.sql`.
4. Run the whole SQL file.

Or, if `psql` is configured:

```powershell
psql -U postgres -d secure_files -f src/config/schema.sql
```

## 6. Start

```powershell
npm start
```

Expected:

```text
Secure file backend listening on http://localhost:3000
```

## 7. Test

Open:

```text
http://localhost:3000/health
```

Expected JSON:

```json
{
  "success": true,
  "message": "API is healthy"
}
```

## 8. Test with Postman or Thunder Client

Register:

```http
POST http://localhost:3000/api/auth/register
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "StrongPass123!"
}
```

Login:

```http
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "StrongPass123!"
}
```

Copy the returned `accessToken`.

For protected endpoints use:

```http
Authorization: Bearer YOUR_TOKEN
```

## 9. Upload

Use:

```http
POST http://localhost:3000/api/files/upload
Authorization: Bearer YOUR_TOKEN
Content-Type: multipart/form-data
```

Form field:

```text
file = choose a file
```

## 10. If `npm start` says "Missing script: start"

Make sure you opened THIS project folder and that `package.json` contains:

```json
"scripts": {
  "start": "node server.js",
  "dev": "node --watch server.js",
  "test": "node --test"
}
```

Then run:

```powershell
npm run
```

You should see `start`, `dev`, and `test`.

## 11. Security note

The project contains an adapter for Adhil's security module and a database
adapter for Abhi's implementation. Before team integration, connect those
adapters to the actual team modules instead of creating duplicate DB/security
implementations.
