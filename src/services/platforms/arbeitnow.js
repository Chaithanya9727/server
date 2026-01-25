import https from "https";

export const fetchArbeitNowJobs = async () => {
  // ArbeitNow API (Europe/Remote focus)
  const url = "https://www.arbeitnow.com/api/job-board-api";

  try {
    const data = await new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if(res.statusCode !== 200) reject(new Error(`ArbeitNow API Error: ${res.statusCode}`));
            let d = "";
            res.on('data', c => d+=c);
            res.on('end', () => resolve(d));
        }).on('error', reject);
    });

    const json = JSON.parse(data);
    const jobs = json.data || [];

    return jobs.slice(0, 15).map((job) => ({
        title: job.title,
        company: job.company_name,
        logo: "", // ArbeitNow often doesn't give logo URLs directly in list
        location: job.location,
        type: job.remote ? 'Remote' : 'On-site',
        salary: "Ckec link", // Usually not provided in free tier
        description: "Check official application.",
        url: job.url, 
        source: "ArbeitNow",
        postedBy: null,
        createdAt: new Date(job.created_at * 1000).toISOString(),
        isExternal: true
    }));

  } catch (error) {
    console.error("Failed to fetch ArbeitNow jobs:", error.message);
    return [];
  }
};
