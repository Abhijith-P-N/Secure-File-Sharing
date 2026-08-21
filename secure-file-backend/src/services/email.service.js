import nodemailer from "nodemailer";
import { logger } from "../utils/logger.js";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS?.replace(/\s/g, "");
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER || "VaultGuard <noreply@vaultguard.local>";

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });
  return transporter;
}

export async function sendAccessCode(to, code, fileName) {
  const subject = `Your download code for "${fileName}"`;
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#0891b2">VaultGuard — File Access Code</h2>
      <p>You requested access to download <strong>${fileName}</strong>.</p>
      <div style="background:#f1f5f9;border-radius:8px;padding:16px;text-align:center;margin:20px 0">
        <p style="font-size:12px;color:#64748b;margin:0 0 4px">Your one-time code</p>
        <p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#0f172a;margin:0">${code}</p>
      </div>
      <p style="color:#64748b;font-size:13px">This code expires in 10 minutes. If you did not request this, you can safely ignore this email.</p>
    </div>
  `;

  const transport = getTransporter();
  if (transport) {
    try {
      await transport.sendMail({ from: SMTP_FROM, to, subject, html });
      logger.info("Access code email sent", { to, fileName });
    } catch (err) {
      logger.error("Failed to send email", { to, error: err.message });
      throw err;
    }
  } else {
    logger.info("Access code (no SMTP configured — logged only)", { to, code, fileName });
  }
}
