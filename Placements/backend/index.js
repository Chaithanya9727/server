import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import bodyParser from "body-parser";
import admin from "firebase-admin";
import path from "path";
import { fileURLToPath } from "url";

import dataSyncer from "./contest/controllers/DataSyncController.js";
import contestSyncer from "./contest/controllers/contestController.js";
import contestRoutes from "./contest/routes/contestRoutes.js";
import communityRoutes from "./community/routes/communityRoutes.js";
import userRoutes from "./users/routes/userRoutes.js";
import adminRoutes from "./users/routes/adminRoutes.js";
import fetchContestsData from "./fetchContests.js";
import { routeLogging } from "./users/middlewares/authMiddleware.js";
import sheetRoutes from "./DSA_sheets/routes/sheetRoutes.js";
import questionRoutes from "./DSA_sheets/routes/questionRoutes.js";
import potdRoutes from "./potd/routes/potdRoutes.js";
import hackathonAPISyncer from "./hackathons/controllers/hackathonApiSyncController.js";
import hackathonDBSyncer from "./hackathons/controllers/hackathonDbSyncController.js";
import hackathonRoutes from "./hackathons/routes/hackathonRoutes.js";

dotenv.config();

const app = express();
let appServer;

/* -------------------- PATH FIX FOR ES MODULE -------------------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* -------------------- FIREBASE INITIALIZATION -------------------- */
admin.initializeApp({
  credential: admin.credential.cert(
    path.join(__dirname, "firebase.json")
  ),
});

/* -------------------- MIDDLEWARE -------------------- */
if (process.env.NODE_ENV === "production") {
  app.use(routeLogging);
}

app.use(cors());
app.use(bodyParser.json());

/* -------------------- ERROR HANDLING -------------------- */
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err.message);
  process.exit(1);
});

process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err.message);
  appServer?.close(() => process.exit(1));
});

/* -------------------- HELPERS -------------------- */
async function main() {
  try {
    console.log("Pinging...");
    await fetchContestsData();
    console.log("Pong!");
  } catch (error) {
    console.error("Ping error:", error);
  }
}

/* -------------------- SERVERS -------------------- */
async function setupUserServer() {
  console.log("Firebase initialized ✔");

  app.use("/user", userRoutes);
  app.use("/admin", adminRoutes);
  app.use("/sheets", sheetRoutes);
  app.use("/questions", questionRoutes);
}

async function setupExtensionServer() {
  app.use("/potd", potdRoutes);
}

async function setupContestServer() {
  await dataSyncer.syncContests();
  setInterval(dataSyncer.syncContests, 90 * 60 * 1000);

  await contestSyncer.updateContests();
  setInterval(contestSyncer.updateContests, 60 * 60 * 1000);

  setInterval(main, 13 * 60 * 1000);

  app.use("/contests", contestRoutes);
}

async function setupCommunityServer() {
  app.use("/community", communityRoutes);
}

async function setupHackathonServer() {
  await hackathonAPISyncer.syncHackathons();
  setInterval(hackathonAPISyncer.syncHackathons, 90 * 60 * 1000);

  await hackathonDBSyncer.updateHackathons();
  setInterval(hackathonDBSyncer.updateHackathons, 60 * 60 * 1000);

  app.use("/hackathons", hackathonRoutes);
}

/* -------------------- START DEV SERVER -------------------- */
async function startServersDev() {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    console.log("MongoDB Connected.");

    const servers = [];

    if (process.env.USERS === "true") {
      await setupUserServer();
      servers.push("User");

      await setupCommunityServer();
      servers.push("Community");

      await setupExtensionServer();
      servers.push("Extension");
    }

    if (process.env.CONTESTS === "true") {
      await setupContestServer();
      servers.push("Contest");
    }

    if (process.env.HACKATHONS === "true") {
      await setupHackathonServer();
      servers.push("Hackathon");
    }

    app.all("*", (req, res) => {
      res.status(404).json({ error: `${req.originalUrl} route not found` });
    });

    console.log("┌──────────────────────────────────┐");
    servers.forEach((s) =>
      console.log(`│ Server active: ${s.padEnd(16)}│`)
    );
    console.log("├──────────────────────────────────┤");

    const port = process.env.PORT || 5000;
    appServer = app.listen(port, () => {
      console.log(`│ Server listening on ${port}`.padEnd(35) + "│");
      console.log("└──────────────────────────────────┘");
    });
  } catch (err) {
    console.error("Error starting servers:", err);
  }
}

/* -------------------- START PROD SERVER -------------------- */
async function startServersProduction() {
  await startServersDev();
}

/* -------------------- BOOT -------------------- */
if (process.env.NODE_ENV === "development") {
  startServersDev();
} else if (process.env.NODE_ENV === "production") {
  startServersProduction();
} else {
  console.error("NODE_ENV not set");
}
