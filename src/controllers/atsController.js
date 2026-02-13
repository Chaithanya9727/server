import Groq from "groq-sdk";
import asyncHandler from "express-async-handler";
import fs from "fs";
import { performAnalysis } from "../utils/atsUtils.js";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");

/* =====================================================
   📊 AI ATS ANALYZER (GROQ POWERED)
===================================================== */

export const analyzeResume = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error("Please upload a PDF resume");
  }

  const dataBuffer = fs.readFileSync(req.file.path);
  console.log(`📂 Analyzing: ${req.file.path}, Size: ${dataBuffer.length}`);

  let text = ""; 

  try {
    // 1. Extract text from PDF
    const data = await pdf(dataBuffer);
    text = data.text;
    
    // cleanup file immediately
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    
    if(!process.env.GROQ_API_KEY) {
       console.log("No Groq Key found - Falling back to local analysis");
       return res.json(performAnalysis(text));
    }

    // 2. Send to Groq for Deep Analysis
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    
    const prompt = `
      Act as an expert ATS (Applicant Tracking System) and Senior Technical Recruiter.
      Analyze this resume text and provide a structured JSON response.
      
      RESUME TEXT:
      ${text.substring(0, 15000)}

      Analyze for:
      1. Action Verbs: Are they weak (e.g. "Worked on") or strong (e.g. "Orchestrated", "Engineered")?
      2. Quantifiable Impact: Does it have numbers (e.g. "Improved latency by 20%")?
      3. Skills Gaps: What critical modern skills are missing based on the context?
      4. Fatal Errors: Formatting issues, typos, or lack of contact info.

      RETURN JSON ONLY (No markdown, no explanation):
      {
        "score": number (0-100),
        "verdict": string ("Excellent", "Good", "Needs Improvement"),
        "feedback": {
           "critical": ["Fatal error 1", "Fatal error 2"],
           "improvements": ["Suggestion 1", "Suggestion 2"],
           "strengths": ["Good point 1", "Good point 2"]
        },
        "details": {
           "wordCount": number,
           "skillsDetected": ["Skill 1", "Skill 2"]
        }
      }
    `;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile",
      temperature: 0.1, // Low temperature for consistent JSON
    });

    const outputText = chatCompletion.choices[0]?.message?.content || "";
    const jsonString = outputText.replace(/```json/g, "").replace(/```/g, "").trim();
    
    const aiAnalysis = JSON.parse(jsonString);
    res.json({ ...aiAnalysis, fullText: text });

  } catch (error) {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    console.error("AI Analysis Failed, using fallback:", error.message);
    
    // Fallback to local logic if AI fails
    if (text) {
      res.json(performAnalysis(text));
    } else {
      res.status(500).json({ 
        message: "Failed to read PDF file", 
        error: error.message 
      });
    }
  }
});
