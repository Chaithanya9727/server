// src/config/passport.js
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as GitHubStrategy } from "passport-github2";
import User from "../models/User.js";
import dotenv from "dotenv";

dotenv.config();

/* ============================================================
   🌐 OAuth Config (Auto Switch for Local / Production)
   ============================================================ */
const isProduction = process.env.NODE_ENV === "production";

const CLIENT_URL = isProduction
  ? "https://onestop-frontend.netlify.app"
  : "http://localhost:5173";

const SERVER_URL = isProduction
  ? "https://onestop-backend.onrender.com"
  : "http://localhost:5000";

/* ============================================================
   🚀 GOOGLE STRATEGY
   ============================================================ */
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${SERVER_URL}/api/auth/google/callback`,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) return done(new Error("Google account missing email."));

        let user = await User.findOne({ email });
        if (!user) {
          user = await User.create({
            name: profile.displayName,
            email,
            password: Math.random().toString(36).slice(-8),
            role: "student",
            googleId: profile.id,
          });
        }

        return done(null, user);
      } catch (err) {
        console.error("Google OAuth Error:", err);
        return done(err, null);
      }
    }
  )
);

/* ============================================================
   🐙 GITHUB STRATEGY
   ============================================================ */
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
        let email =
          profile.emails?.[0]?.value ||
          `${profile.username}@githubuser.com`; // fallback for private email

        let user = await User.findOne({ email });
        if (!user) {
          user = await User.create({
            name: profile.displayName || profile.username,
            email,
            password: Math.random().toString(36).slice(-8),
            role: "student",
            githubId: profile.id,
          });
        }

        return done(null, user);
      } catch (err) {
        console.error("GitHub OAuth Error:", err);
        return done(err, null);
      }
    }
  )
);

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
