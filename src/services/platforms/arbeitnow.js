import axios from "axios";

export const fetchArbeitNowJobs = async () => {
  // ArbeitNow API (Europe/Remote focus)
  const url = "https://www.arbeitnow.com/api/job-board-api";

  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Accept": "application/json"
      }
    });

    const jobs = response.data.data || [];

    return jobs.slice(0, 15).map((job) => ({
        title: job.title,
        company: job.company_name,
        logo: "", // ArbeitNow often doesn't give logo URLs directly in list
        location: job.location,
        type: job.remote ? 'Remote' : 'On-site',
        salary: "Check link", // Usually not provided in free tier
        description: "Check official application.",
        url: job.url, 
        source: "ArbeitNow",
        postedBy: null,
        createdAt: new Date(job.created_at * 1000).toISOString(),
        isExternal: true
    }));

  } catch (error) {
    if (error.response) {
      console.error(`Failed to fetch ArbeitNow jobs: ArbeitNow API Error: ${error.response.status}`);
    } else {
      console.error("Failed to fetch ArbeitNow jobs:", error.message);
    }
    return [];
  }
};
