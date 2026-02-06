
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

// Inline model definitions to avoid import issues
const conversationSchema = new mongoose.Schema({
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
    lastMessageAt: { type: Date },
}, { timestamps: true });

const messageSchema = new mongoose.Schema({
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation" },
    from: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    to: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    body: String,
    status: String,
}, { timestamps: true });

const userSchema = new mongoose.Schema({
    name: String,
    email: String,
    role: String,
});

const Conversation = mongoose.model("Conversation", conversationSchema);
const Message = mongoose.model("Message", messageSchema);
const User = mongoose.model("User", userSchema);

const cleanup = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ MongoDB connected...");

        console.log("\n🔍 Finding all conversations...");
        const allConvs = await Conversation.find({}).populate('participants', 'name email');

        console.log(`Found ${allConvs.length} total conversations.\n`);

        // Group by sorted participant IDs
        const groups = {};
        for (const conv of allConvs) {
            const key = conv.participants.map(p => p._id.toString()).sort().join('_');
            if (!groups[key]) groups[key] = [];
            groups[key].push(conv);
        }

        let duplicateCount = 0;
        for (const key in groups) {
            if (groups[key].length > 1) {
                duplicateCount++;
                const convs = groups[key];
                const names = convs[0].participants.map(p => p.name).join(' <-> ');
                console.log(`⚠️ DUPLICATE: "${names}" has ${convs.length} conversations`);
                
                // Sort: keep most recent one first
                convs.sort((a, b) => {
                    const dateA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : new Date(a.createdAt).getTime();
                    const dateB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : new Date(b.createdAt).getTime();
                    return dateB - dateA;
                });

                const keeper = convs[0];
                console.log(`   ✅ Keeping: ${keeper._id}`);

                for (let i = 1; i < convs.length; i++) {
                    const dup = convs[i];
                    console.log(`   🗑️ Deleting duplicate: ${dup._id}`);
                    
                    // Move any messages to keeper
                    const result = await Message.updateMany(
                        { conversation: dup._id },
                        { conversation: keeper._id }
                    );
                    if (result.modifiedCount > 0) {
                        console.log(`      Moved ${result.modifiedCount} messages`);
                    }

                    // Delete the duplicate conversation
                    await Conversation.findByIdAndDelete(dup._id);
                }
            }
        }

        if (duplicateCount === 0) {
            console.log("✅ No duplicate conversations found.");
        } else {
            console.log(`\n✅ Cleaned up ${duplicateCount} duplicate conversation groups.`);
        }

    } catch (err) {
        console.error("❌ Error:", err);
    } finally {
        await mongoose.disconnect();
        console.log("\n🔌 Disconnected from MongoDB.");
    }
};

cleanup();
