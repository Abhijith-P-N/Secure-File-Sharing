import { query } from "../config/db.js";
import { ok, fail } from "../utils/http.js";
import * as uploadService from "../services/upload.service.js";
import { z } from "zod";

const createSessionSchema = z.object({
  body: z.object({
    originalName: z.string().min(1).max(255),
    mimeType: z.string().min(1).max(255),
    totalSize: z.number().int().positive(),
    chunkSize: z.number().int().positive().optional()
  })
});

const uploadChunkSchema = z.object({
  body: z.object({
    sessionId: z.string().uuid(),
    chunkIndex: z.number().int().min(0),
    chunkData: z.string() // base64 encoded
  })
});

const completeSchema = z.object({
  body: z.object({
    sessionId: z.string().uuid(),
    expectedSha256: z.string().length(64).optional()
  })
});

export async function createUploadSession(req, res) {
  try {
    const { originalName, mimeType, totalSize, chunkSize } = req.body;
    const result = await uploadService.createUploadSession({
      userId: req.user.id,
      originalName,
      mimeType,
      totalSize,
      chunkSize
    });
    return ok(res, result, 201);
  } catch (error) {
    return fail(res, 400, error.message);
  }
}

export async function uploadChunk(req, res) {
  try {
    const { sessionId, chunkIndex, chunkData } = req.body;
    const chunkBuffer = Buffer.from(chunkData, "base64");
    const result = await uploadService.uploadChunk({
      sessionId,
      userId: req.user.id,
      chunkIndex,
      chunkData: chunkBuffer
    });
    return ok(res, result);
  } catch (error) {
    return fail(res, 400, error.message);
  }
}

export async function completeUpload(req, res) {
  try {
    const { sessionId, expectedSha256 } = req.body;
    const result = await uploadService.completeUpload(sessionId, req.user.id, expectedSha256);
    return ok(res, result, 201);
  } catch (error) {
    return fail(res, 400, error.message);
  }
}

export async function getUploadSession(req, res) {
  const { sessionId } = req.params;
  const session = await uploadService.getUploadSession(sessionId, req.user.id);
  if (!session) {
    return fail(res, 404, "Upload session not found");
  }
  return ok(res, { session });
}

export async function deleteUploadSession(req, res) {
  const { sessionId } = req.params;
  await uploadService.deleteUploadSession(sessionId, req.user.id);
  return ok(res, { message: "Upload session deleted" });
}