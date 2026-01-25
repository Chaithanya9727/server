import https from "https";

export const fetchCodeChefContests = async () => {
  const url = "https://www.codechef.com/api/list/contests/all";

  try {
    const data = await new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if(res.statusCode !== 200) reject(new Error('CodeChef Error'));
            let d = "";
            res.on('data', c => d+=c);
            res.on('end', () => resolve(d));
        }).on('error', reject);
    });

    const json = JSON.parse(data);
    const futureContests = json.future_contests || [];

    return futureContests.map((c) => ({
        host: "codechef",
        site: "CodeChef",
        name: c.contest_name,
        vanity: c.contest_code,
        url: `https://www.codechef.com/${c.contest_code}`,
        startTime: new Date(c.contest_start_date_iso).toISOString(),
        startTimeUnix: Math.floor(new Date(c.contest_start_date_iso).getTime() / 1000),
        duration: c.contest_duration, // usually in minutes
        status: 'UPCOMING'
    }));

  } catch (error) {
    console.error("Failed to fetch CodeChef contests:", error);
    return [];
  }
};
