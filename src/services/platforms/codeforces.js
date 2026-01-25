import https from "https";

export const fetchCodeforcesContests = async () => {
  const url = "https://codeforces.com/api/contest.list";

  try {
    const responseData = await new Promise((resolve, reject) => {
      https.get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`Codeforces API Error: ${res.statusCode}`));
          return;
        }
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      }).on("error", (err) => reject(err));
    });

    const contestList = JSON.parse(responseData);
    
    // Logic from original: filter contest.relativeTimeSeconds < 0 (Future contests)
    // Note: relativeTimeSeconds < 0 means startTime is in the future relative to now.
    const upcomingContests = contestList.result.filter(
      (contest) => contest.relativeTimeSeconds < 0 || contest.phase === 'CODING'
    );

    return upcomingContests.map((contest) => ({
      host: "codeforces",
      name: contest.name,
      vanity: contest.id,
      url: "https://codeforces.com/contests/" + contest.id,
      startTimeUnix: contest.startTimeSeconds,
      startTime: new Date(contest.startTimeSeconds * 1000).toISOString(),
      endTime: new Date((contest.startTimeSeconds + contest.durationSeconds) * 1000).toISOString(),
      duration: Math.floor(contest.durationSeconds / 60), // in minutes as per original
      status: contest.phase === 'CODING' ? 'ONGOING' : 'UPCOMING',
      site: 'Codeforces'
    }));
  } catch (error) {
    console.error("Failed to fetch Codeforces contests:", error);
    return [];
  }
};
