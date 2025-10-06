// src/utils/sendEmail.js
import nodemailer from "nodemailer"


export const sendEmail = async (to, subject, text, html) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail", // or Outlook/SMTP
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    })

    await transporter.sendMail({
      from: `"OneStopHub" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text, // fallback plain text
      html, // styled HTML version
    })

    console.log("✅ Email sent to:", to)
  } catch (err) {
    console.error("❌ Email send error:", err.message)
  }
}
