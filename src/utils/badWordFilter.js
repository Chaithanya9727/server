
const BAD_WORDS = [
  // Common Profanity
  "abuse", "idiot", "stupid", "hell", "damn", "ass", "bitch", "bastard", "fuck", "shit", 
  "sex", "kill", "die", "hate", "racist", "nigger", "faggot", "whore", "slut", "cunt",
  "dick", "cock", "pussy", "bullshit", "suck", "jerk", "dumb", "crap", "piss",
  
  // Severe & Offensive
  "motherfucker", "fucker", "asshole", "sonofabitch", "bollocks", "bugger", "wanker",
  "prick", "twat", "dyke", "kike", "chink", "spic", "gook", "retard", "spastic",
  "rapist", "pedo", "pedophile", "incest", "beastiality", "masturbate", "orgasm",
  "penis", "vagina", "clitoris", "anus", "rectum", "nipple", "erection", "ejaculate",
  
  // Harassment & toxic behavior terms
  "kys", "kill yourself", "suicide", "trash", "loser", "ugly", "fat", "disgusting",
  "worthless", "useless", "scum", "moron", "imbecile", "lunatic", "psycho", "maniac",
  "terrorist", "bomb", "shoot", "murder", "stfu", "shut up", "shut the fuck up",
  "fk", "f u", "stfu", "wtf", "omg", "lmao", "lmfao" // Contextual, but user asked for strict
];

export const isProfane = (text) => {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  
  // Check for exact words using word boundaries
  const exactMatch = BAD_WORDS.some(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    return regex.test(lowerText);
  });

  if (exactMatch) return true;

  // STRICT MODE EXTENSIONS
  
  // 1. Check for spaced out words (e.g. "f u c k")
  // We'll remove spaces and check for main bad words
  const nospace = lowerText.replace(/\s+/g, '');
  if (['fuck', 'shit', 'bitch', 'nigger', 'cunt'].some(w => nospace.includes(w))) {
     return true;
  }

  return false;
};
