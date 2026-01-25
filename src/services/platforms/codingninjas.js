import https from "https";

export const fetchCodingNinjasContests = async () => {
  const url = "https://api.codingninjas.com/api/v4/public_section/contest_list";

  try {
    const data = await new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if(res.statusCode !== 200) reject(new Error('CodingNinjas Error'));
            let d = "";
            res.on('data', c => d+=c);
            res.on('end', () => resolve(d));
        }).on('error', reject);
    });

    const json = JSON.parse(data);
    const events = json.data?.events || [];
    const nowUnix = Math.floor(Date.now() / 1000);

    const filtered = events.filter(c => c.event_start_time > nowUnix);

    return filtered.map((c) => ({
        host: "codingninjas",
        site: "CodingNinjas",
        name: c.name,
        vanity: c.slug,
        url: `https://codingninjas.com/studio/contests/${c.slug}`,
        startTime: new Date(c.event_start_time * 1000).toISOString(),
        duration: Math.floor((c.event_end_time - c.event_start_time) / 60), // minutes
        status: 'UPCOMING'
    }));

  } catch (error) {
    console.error("Failed to fetch CodingNinjas contests:", error);
    return [];
  }
};
