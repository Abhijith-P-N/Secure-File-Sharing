import { query } from "../config/db.js";
import { ok } from "../utils/http.js";

export async function users(_req, res) {
  const { rows } = await query(
    `SELECT id,email,role,created_at FROM users ORDER BY created_at DESC`
  );
  return ok(res, { users: rows });
}

export async function files(_req, res) {
  const { rows } = await query(
    `SELECT f.id,f.owner_id,f.original_name,f.mime_type,f.size_bytes,f.sha256,f.created_at,u.email owner_email
     FROM files f JOIN users u ON u.id=f.owner_id ORDER BY f.created_at DESC`
  );
  return ok(res, { files: rows });
}

export async function stats(_req, res) {
  const { rows } = await query(`
    SELECT
      (SELECT COUNT(*) FROM users)::int AS users,
      (SELECT COUNT(*) FROM files)::int AS files,
      (SELECT COALESCE(SUM(size_bytes),0) FROM files)::bigint AS bytes,
      (SELECT COUNT(*) FROM shares)::int AS shares,
      (SELECT COUNT(*) FROM access_logs WHERE success=false)::int AS failed_security_events
  `);
  return ok(res, { stats: rows[0] });
}

export async function securityEvents(_req, res) {
  const { rows } = await query(
    `SELECT id,user_id,action,resource_type,resource_id,success,ip,user_agent,details,created_at
     FROM access_logs
     WHERE success=false OR action LIKE '%UNAUTHORIZED%' OR action LIKE '%FAILED%'
     ORDER BY created_at DESC LIMIT 500`
  );
  return ok(res, { events: rows });
}
