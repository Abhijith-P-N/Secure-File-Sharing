import { query } from "../config/db.js";
import { saveEncryptedFile, getOwnedFile, getFileById, readVerifiedFile, deleteOwnedFile } from "../services/file.service.js";
import { securityLog } from "../services/log.service.js";
import { fail, ok } from "../utils/http.js";

export async function uploadFile(req, res) {
  if (!req.file) return fail(res, 400, "A file is required");

  const file = await saveEncryptedFile({ ownerId: req.user.id, file: req.file });
  await securityLog({
    userId: req.user.id, action: "FILE_UPLOAD",
    resourceType: "file", resourceId: file.id, req
  });

  return ok(res, { file }, 201);
}

export async function listFiles(req, res) {
  const { rows } = await query(
    `SELECT id, original_name, mime_type, size_bytes, sha256, created_at
     FROM files WHERE owner_id=$1 ORDER BY created_at DESC`,
    [req.user.id]
  );
  return ok(res, { files: rows });
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
  return ok(res, { file: {
    id: file.id, original_name: file.original_name, mime_type: file.mime_type,
    size_bytes: file.size_bytes, sha256: file.sha256, created_at: file.created_at
  }});
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
