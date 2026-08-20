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
