import { query } from "../config/db.js";
import { serializeLog } from "../utils/serialize.js";
import { ok } from "../utils/http.js";

export async function getLogs(req, res) {
  const { rows } = await query(
    `SELECT l.id, l.action, l.resource_type, l.resource_id, l.success, l.ip,
            l.user_agent, l.details, l.created_at, f.original_name AS file_name
     FROM access_logs l
     LEFT JOIN files f ON (f.id = l.resource_id AND l.resource_type = 'file')
     WHERE l.user_id=$1
     ORDER BY l.created_at DESC
     LIMIT 200`,
    [req.user.id]
  );
  return ok(res, { logs: rows.map(serializeLog) });
}