import https from "https";

export const fetchLeetCodeContests = async () => {
    return new Promise((resolve, reject) => {
        const postFields = JSON.stringify({
            operationName: null,
            variables: {},
            query: `{
            allContests {
              title
              titleSlug
              description
              startTime
              duration
            }
          }`,
        });

        const options = {
            hostname: "leetcode.com",
            path: "/graphql",
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": postFields.length,
            },
        };

        const req = https.request(options, (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
                try {
                    const json = JSON.parse(data);
                    if (!json.data || !json.data.allContests) {
                        resolve([]);
                        return;
                    }

                    const currentTimestamp = Math.floor(Date.now() / 1000);
                    const contests = json.data.allContests
                        .filter((c) => c.startTime > currentTimestamp)
                        .map((c) => ({
                            host: "leetcode",
                            name: c.title,
                            vanity: c.titleSlug,
                            url: `https://leetcode.com/contest/${c.titleSlug}`,
                            startTimeUnix: c.startTime,
                            startTime: new Date(c.startTime * 1000).toISOString(),
                            endTime: new Date((c.startTime + c.duration) * 1000).toISOString(),
                            duration: c.duration / 60.0, // minutes
                            site: 'LeetCode',
                            status: 'UPCOMING'
                        }));
                    resolve(contests);
                } catch (e) {
                    console.error("LeetCode parse error:", e);
                    resolve([]);
                }
            });
        });

        req.on("error", (e) => {
            console.error("LeetCode request error:", e);
            resolve([]);
        });
        
        req.write(postFields);
        req.end();
    });
};
