import dotenv from "dotenv";
dotenv.config();

export const isProduction = process.env.NODE_ENV === "production" || process.env.RENDER || process.env.VERCEL || process.env.ONRENDER;

// 🌐 Client URL (Frontend)
export const CLIENT_URL = isProduction
  ? "https://onestopfrontend.vercel.app"
  : process.env.CLIENT_URL || "http://localhost:5173";

// 🚀 Server URL (Backend)
export const SERVER_URL = isProduction
  ? "https://server-qm14.onrender.com"
  : process.env.SERVER_URL || "http://localhost:5000";
