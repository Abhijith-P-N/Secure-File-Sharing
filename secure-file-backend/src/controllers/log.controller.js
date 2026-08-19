import { query } from "../config/db.js";
import { ok } from "../utils/http.js";

export async function getLogs(req, res) {
  const { rows } = await query(
    `SELECT id,action,resource_type,resource_id,success,ip,user_agent,details,created_at
     FROM access_logs WHERE user_id=$1 ORDER BY created_at DESC LIMIT 200`,
    [req.user.id]
  );
  return ok(res, { logs: rows });
}
