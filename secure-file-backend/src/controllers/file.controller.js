import { query } from "../config/db.js";
import { saveEncryptedFile, getOwnedFile, getFileById, readVerifiedFile, deleteOwnedFile } from "../services/file.service.js";
import { securityLog } from "../services/log.service.js";
import { serializeFile } from "../utils/serialize.js";
import { validateFileSignature, FileValidationError } from "../utils/fileSignature.js";
import { fail, ok } from "../utils/http.js";

export async function uploadFile(req, res) {
  if (!req.file) return fail(res, 400, "A file is required");

  try {
    await validateFileSignature(req.file.buffer, req.file.mimetype);
  } catch (e) {
    if (e instanceof FileValidationError) {
      return fail(res, 400, e.message);
    }
    throw e;
  }

  const file = await saveEncryptedFile({ ownerId: req.user.id, file: req.file });
  await securityLog({
    userId: req.user.id, action: "FILE_UPLOAD",
    resourceType: "file", resourceId: file.id, req
  });

  return ok(res, { file: serializeFile(file) }, 201);
}

export async function searchFiles(req, res) {
  const { q } = req.query;
  if (!q || q.trim().length === 0) {
    return fail(res, 400, "Search query is required");
  }

  const searchTerm = q.trim();
  
  const { rows } = await query(
    `SELECT id, owner_id, original_name, mime_type, size_bytes, sha256, created_at,
            ts_rank(search_vector, plainto_tsquery('english', $2)) AS rank
     FROM files
     WHERE owner_id=$1 
       AND deleted_at IS NULL
       AND search_vector @@ plainto_tsquery('english', $2)
     ORDER BY rank DESC, created_at DESC
     LIMIT 50`,
    [req.user.id, searchTerm]
  );

  return ok(res, { files: rows.map(serializeFile), query: searchTerm });
}

export async function listFiles(req, res) {
  const { rows } = await query(
    `SELECT id, owner_id, original_name, mime_type, size_bytes, sha256, created_at
     FROM files
     WHERE owner_id=$1 AND deleted_at IS NULL
     ORDER BY created_at DESC`,
    [req.user.id]
  );

  const { rows: counts } = await query(
    `SELECT s.file_id, COUNT(*)::int AS share_count
     FROM shares s JOIN files f ON f.id = s.file_id
     WHERE f.owner_id=$1 AND s.deleted_at IS NULL
     GROUP BY s.file_id`,
    [req.user.id]
  );
  const countByFile = new Map(counts.map((c) => [c.file_id, c.share_count]));

  return ok(res, {
    files: rows.map((row) => {
      const shareCount = countByFile.get(row.id) || 0;
      return {
        ...serializeFile(row),
        isShared: shareCount > 0,
        shareCount
      };
    })
  });
}

export async function getFile(req, res) {
  const file = await getFileById(req.params.id);
  if (!file) return fail(res, 404, "File not found");
  if (file.owner_id !== req.user.id) {
    await securityLog({
      userId: req.user.id, action: "UNAUTHORIZED_FILE_ACCESS",
      resourceType: "file", resourceId: file.id, success: false, req
    });
    return fail(res, 403, "Forbidden");
  }
  return ok(res, { file: serializeFile(file) });
}

export async function downloadOwnedFile(req, res) {
  const file = await getOwnedFile(req.params.id, req.user.id);
  if (!file) return fail(res, 403, "Forbidden");

  const data = await readVerifiedFile(file);
  await securityLog({
    userId: req.user.id, action: "FILE_DOWNLOAD",
    resourceType: "file", resourceId: file.id, req
  });

  res.setHeader("Content-Type", file.mime_type);
  res.setHeader("Content-Length", data.length);
  res.setHeader("Content-Disposition", `attachment; filename="${file.original_name.replace(/"/g, "")}"`);
  return res.send(data);
}

export async function deleteFile(req, res) {
  const file = await deleteOwnedFile(req.params.id, req.user.id);
  if (!file) return fail(res, 403, "Forbidden");

  await securityLog({
    userId: req.user.id, action: "FILE_DELETE",
    resourceType: "file", resourceId: file.id, req
  });
  return ok(res, { message: "File deleted" });
}
