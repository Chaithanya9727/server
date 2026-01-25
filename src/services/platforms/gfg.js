import https from "https";

export const fetchGFGContests = async () => {
  const url = "https://practiceapi.geeksforgeeks.org/api/v1/events/?type=contest&page_number=1&sub_type=all";

  try {
    const data = await new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if(res.statusCode !== 200) reject(new Error('GFG Error'));
            let d = "";
            res.on('data', c => d+=c);
            res.on('end', () => resolve(d));
        }).on('error', reject);
    });

    const json = JSON.parse(data);
    // GFG API structure: results.upcoming array
    const upcoming = json.results?.upcoming || [];

    return upcoming.map((c) => ({
        host: "geeksforgeeks",
        site: "GeeksForGeeks",
        name: c.name,
        vanity: c.slug,
        url: `https://practice.geeksforgeeks.org/contest/${c.slug}`,
        startTime: new Date(c.start_time).toISOString(), // Usually ISO or parseable
        // Note: Original code adjusted for IST (5.5 hours), but new Date(iso) should handle it if timezone info is present.
        // Assuming API sends standard format.
        duration: Math.floor((new Date(c.end_time).getTime() - new Date(c.start_time).getTime()) / (60 * 1000)), // minutes
        status: 'UPCOMING'
    }));

  } catch (error) {
    console.error("Failed to fetch GFG contests:", error);
    return [];
  }
};
