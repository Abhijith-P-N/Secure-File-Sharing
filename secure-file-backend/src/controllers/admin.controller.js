import { query } from "../config/db.js";
import { serializeUser, serializeFile, serializeLog } from "../utils/serialize.js";
import { ok } from "../utils/http.js";

export async function users(_req, res) {
  const { rows } = await query(
    `SELECT id,email,role,name,created_at FROM users ORDER BY created_at DESC`
  );
  return ok(res, { users: rows.map(serializeUser) });
}

export async function files(_req, res) {
  const { rows } = await query(
    `SELECT f.id,f.owner_id,f.original_name,f.mime_type,f.size_bytes,f.sha256,f.created_at,
            u.email AS owner_email
     FROM files f JOIN users u ON u.id=f.owner_id ORDER BY f.created_at DESC`
  );
  return ok(res, { files: rows.map(serializeFile) });
}

export async function stats(_req, res) {
  const { rows } = await query(`
    SELECT
      (SELECT COUNT(*) FROM users)::int AS users,
      (SELECT COUNT(*) FROM files)::int AS files,
      (SELECT COALESCE(SUM(size_bytes),0) FROM files)::bigint AS bytes,
      (SELECT COUNT(*) FROM shares)::int AS shares,
      (SELECT COUNT(*) FROM shares WHERE revoked_at IS NULL AND (expires_at IS NULL OR expires_at > NOW()))::int AS active_shares,
      (SELECT COUNT(*) FROM shares WHERE expires_at IS NOT NULL AND expires_at <= NOW())::int AS expired_shares,
      (SELECT COALESCE(SUM(download_count),0) FROM shares)::bigint AS downloads,
      (SELECT COUNT(*) FROM access_logs WHERE success=false)::int AS failed_security_events
  `);
  return ok(res, { stats: {
    ...rows[0],
    users: Number(rows[0].users),
    files: Number(rows[0].files),
    bytes: Number(rows[0].bytes),
    shares: Number(rows[0].shares),
    activeShares: Number(rows[0].active_shares),
    expiredShares: Number(rows[0].expired_shares),
    downloads: Number(rows[0].downloads),
    failedSecurityEvents: Number(rows[0].failed_security_events)
  } });
}

export async function securityEvents(_req, res) {
  const { rows } = await query(
    `SELECT l.id,l.user_id,l.action,l.resource_type,l.resource_id,l.success,l.ip,
            l.user_agent,l.details,l.created_at, f.original_name AS file_name
     FROM access_logs l
     LEFT JOIN files f ON (f.id = l.resource_id AND l.resource_type = 'file')
     WHERE l.success=false OR l.action LIKE '%UNAUTHORIZED%' OR l.action LIKE '%FAILED%'
     ORDER BY l.created_at DESC LIMIT 500`
  );
  return ok(res, { events: rows.map(serializeLog) });
}