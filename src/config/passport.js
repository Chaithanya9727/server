// src/config/passport.js
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as GitHubStrategy } from "passport-github2";
import User from "../models/User.js";
import dotenv from "dotenv";

dotenv.config();

/* ============================================================
   🌐 ENVIRONMENT SWITCH
   ============================================================ */
const isProduction = process.env.NODE_ENV === "production";

const CLIENT_URL = isProduction
  ? "https://onestop-frontend.netlify.app"
  : "http://localhost:5173";

const SERVER_URL = isProduction
  ? "https://server-hv9f.onrender.com"
  : "http://localhost:5000";

/* ============================================================
   🚀 GOOGLE STRATEGY (Conditional)
   ============================================================ */
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${SERVER_URL}/api/auth/google/callback`,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value?.toLowerCase();
          if (!email) return done(new Error("Google account missing email."));

          let user = await User.findOne({ email });
          if (!user) {
            user = await User.create({
              name: profile.displayName,
              email,
              password: Math.random().toString(36).slice(-8),
              role: "candidate",
            });
          }

          console.log("✅ Google login success:", email);
          return done(null, user);
        } catch (err) {
          console.error("Google OAuth Error:", err);
          return done(err, null);
        }
      }
    )
  );
} else {
  console.log("⚠️ GOOGLE_CLIENT_ID missing. Google Login disabled (Server Safe Mode).");
}

/* ============================================================
   🐙 GITHUB STRATEGY (Conditional)
   ============================================================ */
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use(
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: `${SERVER_URL}/api/auth/github/callback`,
        scope: ["user:email"],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email =
            profile.emails?.[0]?.value?.toLowerCase() ||
            `${profile.username}@githubuser.com`; // fallback if private email

          let user = await User.findOne({ email });
          if (!user) {
            user = await User.create({
              name: profile.displayName || profile.username,
              email,
              password: Math.random().toString(36).slice(-8),
              role: "candidate",
            });
          }

          console.log("✅ GitHub login success:", profile.username);
          return done(null, user);
        } catch (err) {
          console.error("GitHub OAuth Error:", err);
          return done(err, null);
        }
      }
    )
  );
} else {
  console.log("⚠️ GITHUB_CLIENT_ID missing. GitHub Login disabled (Server Safe Mode).");
}

/* ============================================================
   🔁 SERIALIZE & DESERIALIZE
   ============================================================ */
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

export default passport;
