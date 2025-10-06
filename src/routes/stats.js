import express from "express"
import Notice from "../models/Notice.js"
import Resource from "../models/Resource.js"
import Event from "../models/Event.js"
import User from "../models/User.js"
import { protect, authorize } from "../middleware/auth.js"

const router = express.Router()

// 📊 Dashboard Stats
router.get("/", protect, async (req, res) => {
  try {
    const [notices, resources, events] = await Promise.all([
      Notice.countDocuments(),
      Resource.countDocuments(),
      Event.countDocuments(),
    ])

    let users = 0
    if (req.user.role === "admin") {
      users = await User.countDocuments()
    }

    res.json({ notices, resources, events, users })
  } catch (err) {
    console.error("Stats fetch error:", err)
    res.status(500).json({ message: "Error fetching stats" })
  }
})

export default router
