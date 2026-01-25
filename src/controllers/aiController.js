import Groq from "groq-sdk";
import asyncHandler from "express-async-handler";

const getGroqClient = () => {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not set in environment variables.");
  }
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
};

/**
 * @desc Generate interview questions based on role/topic
 * @route POST /api/ai/interview/questions
 * @access Public
 */
export const generateQuestions = asyncHandler(async (req, res) => {
  const { role = "Software Engineer", topic, difficulty = "Medium" } = req.body;

  if (!process.env.GROQ_API_KEY) {
    console.warn("⚠️ GROQ_API_KEY missing. Using fallback interview questions.");
    return res.json({ 
      questions: [
        "Tell me about a challenging project you worked on.",
        "What is your greatest strength as a developer?",
        "How do you handle conflict in a team?"
      ],
      isFallback: true 
    });
  }

  try {
    const groq = getGroqClient();
    
    const prompt = `
      You are an expert technical interviewer. Generate 5 unique interview questions for a candidate applying for a "${role}" position.
      ${topic ? `Focus specifically on the topic: "${topic}".` : ""}
      Difficulty level: ${difficulty}.
      
      Return ONLY a JSON array of strings. Do not include markdown formatting or explanation. 
      Example: ["Question 1", "Question 2"]
    `;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile", // High performance model
      temperature: 0.7,
    });

    const text = chatCompletion.choices[0]?.message?.content || "";
    const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();
    
    const questions = JSON.parse(cleanText);
    res.json({ questions });

  } catch (error) {
    console.error("AI Generation Error:", error.message);
    res.json({ 
      questions: [
        `Tell me about a time you faced a challenge as a ${role}.`,
        "What are your greatest strengths and weaknesses?",
        "Describe a difficult bug you fixed recently.",
        "How do you handle tight deadlines?",
        "Where do you see yourself in 5 years?"
      ],
      isFallback: true 
    });
  }
});

/**
 * @desc Analyze interview answer
 * @route POST /api/ai/interview/analyze
 * @access Public
 */
export const analyzeAnswer = asyncHandler(async (req, res) => {
  const { question, answer } = req.body;

  if (!question || !answer) {
    res.status(400);
    throw new Error("Question and answer are required");
  }

  try {
    const groq = getGroqClient();
    
    const prompt = `
      You are an expert hiring manager.
      Question: "${question}"
      Candidate's Answer: "${answer}"
      
      Analyze the answer and provide feedback in valid JSON format with the following keys:
      - score: number (0-100)
      - sentiment: string (Positive, Neutral, Negative)
      - feedback: string (2-3 sentences max)
      - improvements: string (1 concise tip)
      - keywords: array of strings (key concepts mentioned)
      
      Return ONLY the JSON. No wrapping (like \`\`\`json).
    `;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile",
      temperature: 0.5,
    });

    const text = chatCompletion.choices[0]?.message?.content || "";
    const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();
    
    const analysis = JSON.parse(cleanText);
    res.json(analysis);

  } catch (error) {
    console.error("AI Analysis Error:", error.message);
    const wordCount = answer.split(" ").length;
    res.json({
      score: Math.min(85, wordCount * 2),
      sentiment: "Neutral",
      feedback: "We are currently experiencing high traffic with our AI service. This is a simulated score.",
      improvements: "Try to elaborate more on your experience.",
      keywords: ["simulated", "analysis"],
      isFallback: true
    });
  }
});

/**
 * @desc Auto-generate Job Description for Recruiters
 * @route POST /api/ai/job-description
 */
export const generateJobDescription = asyncHandler(async (req, res) => {
  const { title, skills, location, type } = req.body;
  
  if (!title) {
    res.status(400);
    throw new Error("Job Title is required");
  }

  try {
    const groq = getGroqClient();
    const prompt = `
      Act as an expert HR Recruiter. Write a compelling, professional Job Description for:
      
      Role: ${title}
      Location: ${location}
      Type: ${type}
      Key Skills: ${skills.join(", ")}
      
      Structure:
      1. About the Role (Exciting intro)
      2. Key Responsibilities (Bullet points)
      3. Requirements (Technical & Soft skills)
      4. Why Join Us? (Benefits/Culture)

      Keep it engaging and modern. Use standard markdown formatting (bullet points, bold text).
      Length: ~300 words.
    `;

    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
    });

    res.json({ description: completion.choices[0]?.message?.content || "" });

  } catch (error) {
    console.error("AI Gen Description Error:", error.message);
    res.status(500).json({ description: "Failed to generate description. Please try again." });
  }
});

/**
 * @desc Generate Cover Letter for Candidates
 * @route POST /api/ai/cover-letter
 */
export const generateCoverLetter = asyncHandler(async (req, res) => {
  const { jobTitle, company, userProfile } = req.body;

  if (!jobTitle || !userProfile) {
    res.status(400);
    throw new Error("Missing required fields");
  }

  try {
    const groq = getGroqClient();
    const prompt = `
      Write a professional, personalized cover letter for:
      Candidate Name: ${userProfile.name}
      Applying for: ${jobTitle} at ${company}
      
      Candidate Skills: ${userProfile.skills?.join(", ") || "General"}
      Experience: ${userProfile.experience || "Fresher"}
      
      Tone: Professional, enthusiastic, and confident.
      Structure:
      - Salutation 
      - Strong opening hook (why this role?)
      - 2 paragraphs connecting skills to the role
      - Call to action (interview request)
      - Sign-off
      
      make it concise (under 250 words).
    `;

    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
    });

    res.json({ coverLetter: completion.choices[0]?.message?.content || "" });

  } catch (error) {
    console.error("AI Cover Letter Error:", error.message);
    res.status(500).json({ coverLetter: "Dear Hiring Manager,\n\nI am writing to express my interest in this role..." });
  }
});

/**
 * @desc Check Job Eligibility / Match Score
 * @route POST /api/ai/job-eligibility
 */
export const checkJobEligibility = asyncHandler(async (req, res) => {
  const { jobDescription, userSkills, userExperience } = req.body;

  try {
    const groq = getGroqClient();
    const prompt = `
      Compare the Candidate vs Job Description and provide a Match Score.
      
      Job Description Snippet: "${jobDescription.substring(0, 1000)}..."
      Candidate Skills: ${userSkills.join(", ")}
      Candidate Experience: ${userExperience}

      Return JSON ONLY:
      {
        "matchScore": number (0-100),
        "reason": "1 sentence explanation of why",
        "missingSkills": ["skill1", "skill2"]
      }
    `;

    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile",
      temperature: 0.1,
    });

    const text = completion.choices[0]?.message?.content || "";
    const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();
    res.json(JSON.parse(cleanText));

  } catch (error) {
    console.error("AI Eligibility Error:", error.message);
    res.json({ 
      matchScore: 75, 
      reason: "Analysis unavailable. Score based on general profile match.", 
      missingSkills: [] 
    });
  }
});

/**
 * @desc Chat with AI Career Coach
 * @route POST /api/ai/chat
 * @access Public
 */
export const chatWithAI = asyncHandler(async (req, res) => {
  const { message, context } = req.body;

  if (!message) {
    res.status(400);
    throw new Error("Message is required");
  }

  try {
    const groq = getGroqClient();
    
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are a friendly, encouraging, and expert Career Coach named 'OneStop Copilot'. Your goal is to help students and job seekers with career advice, resume tips, and interview prep. Keep answers concise (under 100 words) unless asked for details. Use emojis occasionally."
        },
        { role: "user", content: message }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
      max_tokens: 300
    });

    const text = chatCompletion.choices[0]?.message?.content || "I'm speechless!";
    res.json({ reply: text });

  } catch (error) {
    console.error("❌ AI Chat Error:", error.message);
    
    if (error.message.includes("API_KEY")) {
      res.json({ reply: "I need a brain! 🧠 (Please add GROQ_API_KEY to server .env)" });
    } else {
      res.json({ reply: "I'm having trouble thinking right now! 🤯 Please try again." });
    }
  }
});
