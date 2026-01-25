export const performAnalysis = (text) => {
  const cleanText = text.toLowerCase();
  
  // 1. SCORING WEIGHTS
  let score = 0;
  const feedback = {
    critical: [],
    improvements: [],
    strengths: []
  };

  // 2. CHECK SECTIONS (20 pts)
  const sections = ["education", "experience", "skills", "projects"];
  const missingSections = sections.filter(s => !cleanText.includes(s));
  
  if (missingSections.length === 0) {
    score += 20;
    feedback.strengths.push("✅ All key sections (Education, Experience, Skills, Projects) found.");
  } else {
    score += (20 - (missingSections.length * 5));
    feedback.critical.push(`❌ Missing key sections: ${missingSections.join(", ")}. ATS bots look for these specific headers.`);
  }

  // 3. CONTACT INFO (10 pts)
  const hasEmail = /@/.test(cleanText);
  const hasPhone = /\d{10}/.test(cleanText.replace(/[^0-9]/g, "")) || /\+\d+/.test(cleanText);
  // Simple link check (http or www or linkedin)
  const hasLinks = /http|www|linkedin|github/.test(cleanText);

  if (hasEmail && hasPhone) {
    score += 10;
    feedback.strengths.push("✅ Contact information is clear.");
  } else {
    feedback.critical.push("❌ Contact info (Email/Phone) is unclear or missing.");
  }
  
  if (hasLinks) {
     feedback.strengths.push("✅ Includes portfolio/LinkedIn links.");
     score += 5;
  } else {
     feedback.improvements.push("💡 Add links to LinkedIn or GitHub to boost credibility.");
  }

  // 4. ACTION VERBS (20 pts)
  // Strong verbs denote leadership and ownership
  const strongVerbs = ["developed", "led", "engineered", "built", "created", "designed", "implemented", "managed", "optimized", "spearheaded"];
  const foundVerbs = strongVerbs.filter(v => cleanText.includes(v));

  if (foundVerbs.length >= 5) {
     score += 20;
     feedback.strengths.push("✅ Uses strong action verbs (Developed, Led, etc.)");
  } else if (foundVerbs.length >= 2) {
     score += 10;
     feedback.improvements.push(`💡 Use more strong action verbs. Found only: ${foundVerbs.join(", ")}.`);
  } else {
     feedback.improvements.push("💡 Your resume lacks 'Power Words'. Start bullets with words like 'Led', 'Built', 'Optimized'.");
  }

  // 5. MEASURABLE RESULTS / NUMBERS (20 pts)
  // Look for %, $, numbers followed by words like shorter, faster, revenue
  // Simplified: look for % and numbers in context
  const numberMatches = (cleanText.match(/\d+%/g) || []).length + (cleanText.match(/\$\d+/g) || []).length;
  
  if (numberMatches >= 3) {
      score += 20;
      feedback.strengths.push("✅ Good use of metrics (%, $) to prove impact.");
  } else {
      score += 10;
      feedback.improvements.push("💡 quantify your achievements! E.g., 'Increased efficiency by 20%'.");
  }

  // 6. LENGTH CHECK (10 pts)
  // Rough estimate: 3000 chars is approx 1 page dense text. 6000 is 2 pages.
  if (cleanText.length > 500 && cleanText.length < 5000) {
      score += 10;
      feedback.strengths.push("✅ Resume length is appropriate (likely 1-2 pages).");
  } else if (cleanText.length <= 500) {
      feedback.critical.push("❌ Resume is too short. Expand on your details.");
  } else {
      feedback.improvements.push("💡 Resume might be too long. Aim for concise 1-2 pages.");
  }

  // 7. TECH KEYWORDS (Simulated for Tech Roles) - 15 pts
  const techKeywords = ["javascript", "react", "node", "python", "java", "sql", "aws", "docker", "git", "api", "html", "css"];
  const foundTech = techKeywords.filter(k => cleanText.includes(k));

  if (foundTech.length >= 5) {
      score += 15;
      feedback.strengths.push(`✅ Good technical skill density (${foundTech.length} keywords found).`);
  } else {
      score += 5;
      feedback.improvements.push("💡 Missing common tech keywords. If you are technical, list your stack clearly.");
  }

  // Clamp Score
  score = Math.min(Math.max(score, 0), 100);

  // Verdict
  let verdict = "Needs Work";
  if (score >= 90) verdict = "Excellent";
  else if (score >= 75) verdict = "Good";
  else if (score >= 60) verdict = "Average";

  return {
      score,
      verdict,
      details: {
          wordCount: cleanText.split(/\s+/).length,
          sectionAnalysis: { missing: missingSections },
          skillsDetected: foundTech
      },
      feedback
  };
};
