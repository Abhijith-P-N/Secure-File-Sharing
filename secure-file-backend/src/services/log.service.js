import { query } from "../config/db.js";

export async function securityLog({
  userId = null,
  action,
  resourceType = null,
  resourceId = null,
  success = true,
  req,
  details = {}
}) {
  await query(
    `INSERT INTO access_logs
      (user_id, action, resource_type, resource_id, success, ip, user_agent, details)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      userId,
      action,
      resourceType,
      resourceId,
      success,
      req?.ip || null,
      req?.get("user-agent") || null,
      JSON.stringify(details)
    ]
  );
}

export async function adminAuditLog({
  adminId,
  action,
  targetType,
  targetId = null,
  details = {},
  req
}) {
  await query(
    `INSERT INTO access_logs
      (user_id, action, resource_type, resource_id, success, ip, user_agent, details)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      adminId,
      `admin_${action}`,
      targetType,
      targetId,
      true,
      req?.ip || null,
      req?.get("user-agent") || null,
      JSON.stringify({ ...details, adminAction: true })
    ]
  );
}
