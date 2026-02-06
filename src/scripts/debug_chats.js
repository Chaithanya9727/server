
import mongoose from "mongoose";
import dotenv from "dotenv";
import Conversation from "../models/Conversation.js";
import User from "../models/User.js";

dotenv.config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log("✅ MongoDB connected...");
    } catch (err) {
        console.error("❌ MongoDB connection failed:", err.message);
        process.exit(1);
    }
};

const debug = async () => {
    await connectDB();

    console.log("🔍 Debugging 'Internet Expert' chats...");
    
    // Find users with that name
    const users = await User.find({ name: /Internet Expert/i });
    console.log(`Found ${users.length} users named 'Internet Expert':`);
    users.forEach(u => console.log(` - ID: ${u._id}, Email: ${u.email}, Role: ${u.role}`));

    if (users.length === 0) {
        console.log("No users found.");
        process.exit(0);
    }

    // Find conversations involving these users
    for (const u of users) {
        const convs = await Conversation.find({ participants: u._id }).populate('participants', 'name email');
        console.log(`\nConversations for User ${u._id} (${u.name}):`);
        convs.forEach(c => {
             const names = c.participants.map(p => `${p.name} (${p._id})`).join(', ');
             console.log(` - ConvID: ${c._id}, Started: ${c.createdAt}, LastMsgAt: ${c.lastMessageAt}`);
             console.log(`   Participants: ${names}`);
        });
    }

    process.exit(0);
};

debug();
