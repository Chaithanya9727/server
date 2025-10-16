// utils/sendEmail.js
import nodemailer from "nodemailer";

export const sendEmail = async (to, subject, text, html = "") => {
  try {
    // ✅ Create reusable transporter object using Gmail SMTP
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false, // use TLS
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, // Gmail App Password
      },
    });

    // ✅ Default HTML template (if not provided)
    const defaultHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px; background: #f9fafc;">
        <h2 style="color: #4F46E5;">OneStop Hub</h2>
        <p style="font-size: 16px; color: #333;">${text.replace(/\n/g, "<br/>")}</p>
        <p style="margin-top: 30px; font-size: 14px; color: #777;">
          — Team OneStop Hub<br/>
          <a href="mailto:${process.env.EMAIL_USER}" style="color:#4F46E5;">${process.env.EMAIL_USER}</a>
        </p>
      </div>
    `;

    const mailOptions = {
      from: `"OneStop Hub" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html: html || defaultHtml,
    };

    // ✅ Send email
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent successfully to: ${to} (${info.response})`);
    return true;
  } catch (err) {
    console.error("❌ Email send error:", err.message);
    return false;
  }
};
