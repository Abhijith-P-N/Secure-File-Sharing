export function serializeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    createdAt: user.created_at || user.createdAt || null
  };
}

export function serializeFile(file) {
  if (!file) return null;
  const name = file.original_name || file.originalName;
  const mimeType = file.mime_type || file.mimeType;
  const size = Number(file.size_bytes ?? file.sizeBytes ?? file.file_size ?? file.size ?? 0);
  const createdAt = file.created_at || file.createdAt;
  return {
    id: file.id,
    name,
    originalName: name,
    mimeType,
    type: mimeType,
    size,
    sizeBytes: size,
    sha256: file.sha256 || file.file_hash || null,
    uploadedAt: createdAt,
    createdAt,
    ownerId: file.owner_id || file.ownerId || null,
    integrityStatus: file.integrity_status || "Verified"
  };
}

export function serializeShare(share) {
  if (!share) return null;
  const size = Number(share.size_bytes ?? share.file_size ?? 0);
  const downloads = Number(share.download_count ?? share.downloadCount ?? 0);
  const passwordProtected = Boolean(share.password_hash || share.passwordHash);
  return {
    id: share.id,
    fileId: share.file_id || share.fileId || null,
    fileName: share.original_name || share.originalName || null,
    fileSize: size,
    mimeType: share.mime_type || share.mimeType || null,
    sha256: share.sha256 || null,
    passwordProtected,
    passwordRequired: passwordProtected,
    allowedEmail: share.allowed_email || null,
    emailProtected: Boolean(share.allowed_email),
    expiresAt: share.expires_at || share.expiresAt || null,
    maxDownloads: share.max_downloads ?? share.maxDownloads ?? null,
    downloads,
    downloadCount: downloads,
    revokedAt: share.revoked_at || share.revokedAt || null,
    token: share.token || null,
    createdAt: share.created_at || share.createdAt || null,
    owner: share.owner_email || null
  };
}

export function serializeLog(log) {
  if (!log) return null;
  const failed = log.success === false;
  return {
    id: log.id,
    action: log.action,
    result: failed ? "Failed" : "Success",
    success: log.success !== false,
    file: log.file_name || null,
    resourceType: log.resource_type || null,
    resourceId: log.resource_id || null,
    ip: log.ip || null,
    userAgent: log.user_agent || null,
    timestamp: log.created_at || log.timestamp || null,
    createdAt: log.created_at || log.timestamp || null,
    securityEventType: failed ? "Security event" : "Verified event"
  };
}