import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

console.log("🧪 Testing Email Configuration...");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("📧 EMAIL_USER:", process.env.EMAIL_USER);
console.log("🔑 EMAIL_PASS:", process.env.EMAIL_PASS ? "✓ Set" : "✗ Missing");
console.log("🌐 EMAIL_HOST:", process.env.EMAIL_HOST || "smtp.gmail.com");
console.log("🔌 EMAIL_PORT:", process.env.EMAIL_PORT || "465");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

async function testEmail() {
  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      connectionTimeout: 20000,
      greetingTimeout: 20000,
      socketTimeout: 20000,
    });

    console.log("📤 Sending test email...");
    
    const info = await transporter.sendMail({
      from: `"OneStop Test" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      subject: "✅ Email Configuration Test",
      text: "If you received this, your email configuration is working!",
      html: "<h2>✅ Success!</h2><p>Your email configuration is working correctly.</p>",
    });

    console.log("✅ Email sent successfully!");
    console.log("📨 Message ID:", info.messageId);
    console.log("📬 Response:", info.response);
    process.exit(0);
  } catch (error) {
    console.error("❌ Email test failed!");
    console.error("Error:", error.message);
    if (error.code) console.error("Error Code:", error.code);
    process.exit(1);
  }
}

testEmail();
