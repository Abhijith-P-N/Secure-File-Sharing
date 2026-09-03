import { query } from "../config/db.js";
import { serializeUser, serializeFile, serializeLog } from "../utils/serialize.js";
import { ok, fail } from "../utils/http.js";
import { adminAuditLog } from "../services/log.service.js";

export async function users(_req, res) {
  const { rows } = await query(
    `SELECT id,email,role,name,created_at,deleted_at FROM users WHERE deleted_at IS NULL ORDER BY created_at DESC`
  );
  return ok(res, { users: rows.map(serializeUser) });
}

export async function files(_req, res) {
  const { rows } = await query(
    `SELECT f.id,f.owner_id,f.original_name,f.mime_type,f.size_bytes,f.sha256,f.created_at,f.deleted_at,
            u.email AS owner_email
     FROM files f JOIN users u ON u.id=f.owner_id WHERE f.deleted_at IS NULL ORDER BY f.created_at DESC`
  );
  return ok(res, { files: rows.map(serializeFile) });
}

export async function stats(_req, res) {
  const { rows } = await query(`
    SELECT
      (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL)::int AS users,
      (SELECT COUNT(*) FROM files WHERE deleted_at IS NULL)::int AS files,
      (SELECT COALESCE(SUM(size_bytes),0) FROM files WHERE deleted_at IS NULL)::bigint AS bytes,
      (SELECT COUNT(*) FROM shares WHERE deleted_at IS NULL)::int AS shares,
      (SELECT COUNT(*) FROM shares WHERE deleted_at IS NULL AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > NOW()))::int AS active_shares,
      (SELECT COUNT(*) FROM shares WHERE expires_at IS NOT NULL AND expires_at <= NOW() AND deleted_at IS NULL)::int AS expired_shares,
      (SELECT COALESCE(SUM(download_count),0) FROM shares WHERE deleted_at IS NULL)::bigint AS downloads,
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

export async function updateUserRole(req, res) {
  const { userId } = req.params;
  const { role } = req.body;

  if (!["user", "admin"].includes(role)) {
    return fail(res, 400, "Invalid role");
  }

  const { rows } = await query(
    `UPDATE users SET role = $1 WHERE id = $2 AND deleted_at IS NULL RETURNING id, email, role, name`,
    [role, userId]
  );

  if (!rows[0]) {
    return fail(res, 404, "User not found");
  }

  await adminAuditLog({
    adminId: req.user.id,
    action: "update_role",
    targetType: "user",
    targetId: userId,
    details: { newRole: role, targetEmail: rows[0].email },
    req
  });

  return ok(res, { user: serializeUser(rows[0]) });
}

export async function deleteUser(req, res) {
  const { userId } = req.params;

  if (userId === req.user.id) {
    return fail(res, 400, "Cannot delete yourself");
  }

  const { rowCount } = await query(
    `UPDATE users SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL`,
    [userId]
  );

  if (rowCount === 0) {
    return fail(res, 404, "User not found");
  }

  await adminAuditLog({
    adminId: req.user.id,
    action: "delete_user",
    targetType: "user",
    targetId: userId,
    req
  });

  return ok(res, { message: "User deleted" });
}

export async function revokeAllShares(req, res) {
  const { userId } = req.params;

  const { rowCount } = await query(
    `UPDATE shares SET revoked_at = NOW() WHERE created_by = $1 AND revoked_at IS NULL AND deleted_at IS NULL`,
    [userId]
  );

  await adminAuditLog({
    adminId: req.user.id,
    action: "revoke_all_shares",
    targetType: "user",
    targetId: userId,
    details: { revokedCount: rowCount },
    req
  });

  return ok(res, { message: `Revoked ${rowCount} shares` });
}