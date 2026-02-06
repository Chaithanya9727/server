
import mongoose from "mongoose";
import dotenv from "dotenv";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";

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

const cleanup = async () => {
    await connectDB();

    console.log("🔍 Scanning for duplicate conversations...");
    const allConvs = await Conversation.find({});
    
    // Group by participants
    const groups = {};

    for (const conv of allConvs) {
        // Create a unique key for the participant pair
        const key = conv.participants.map(p => p.toString()).sort().join('_');
        
        if (!groups[key]) {
            groups[key] = [];
        }
        groups[key].push(conv);
    }

    let fixedCount = 0;

    for (const key in groups) {
        const conversations = groups[key];
        
        if (conversations.length > 1) {
            console.log(`⚠️ Found duplicate group: ${key} (${conversations.length} copies)`);

            // Sort to keep the one with the most recent activity or just the first created if no activity
            conversations.sort((a, b) => {
                const dateA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
                const dateB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
                return dateB - dateA; // Descending
            });

            const keeper = conversations[0];
            const duplicates = conversations.slice(1);

            console.log(`   👉 Keeping: ${keeper._id} (Last Active: ${keeper.lastMessageAt})`);

            for (const dup of duplicates) {
                console.log(`   🗑️ Merging & Deleting: ${dup._id}`);
                
                // Move messages
                const result = await Message.updateMany(
                    { conversation: dup._id },
                    { conversation: keeper._id }
                );
                console.log(`      ↳ Moved ${result.modifiedCount} messages.`);

                // Delete duplicate
                await Conversation.findByIdAndDelete(dup._id);
            }
            fixedCount++;
        }
    }

    console.log(`✅ Cleanup complete! Fixed ${fixedCount} duplicate groups.`);
    process.exit(0);
};

cleanup();
