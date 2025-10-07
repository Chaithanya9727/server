// src/utils/sendEmail.js
import nodemailer from "nodemailer";

let transporter;

/**
 * Create/reuse a pooled transporter (faster + stable).
 */
function getTransporter() {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: Number(process.env.EMAIL_PORT || 587),
    secure: false, // STARTTLS on 587
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS, // Gmail App Password (16 chars, no spaces)
    },
    pool: true,
    maxConnections: 3,
    maxMessages: 50,
    rateDelta: 1000,
    rateLimit: 5,
    logger: !!process.env.EMAIL_DEBUG, // set EMAIL_DEBUG=1 to see SMTP logs
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });

  return transporter;
}

/**
 * Send an email. Returns true/false.
 */
export const sendEmail = async (to, subject, text, html) => {
  try {
    const tx = getTransporter();

    const info = await tx.sendMail({
      from: `"OneStop Campus Hub" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text: text || undefined,
      html: html || undefined,
    });

    console.log(`✅ Email sent to ${to} :: ${info.response || info.messageId}`);
    return true;
  } catch (err) {
    console.error("❌ Email send error:", err && err.message ? err.message : err);
    return false;
  }
};
