import axios from "axios";

export const fetchJobicyJobs = async () => {
  // Jobicy Public Feed (Remote jobs mostly)
  const url = "https://jobicy.com/api/v2/remote-jobs?count=20";

  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache"
      }
    });

    const jobs = response.data.jobs || [];

    return jobs.map((job) => ({
        // Map to our Job Schema (virtual structure)
        title: job.jobTitle,
        company: job.companyName,
        logo: job.companyLogo || "", 
        location: job.jobGeo || "Remote",
        type: job.jobType ? (job.jobType.includes('Full') ? 'Full-time' : 'Contract') : 'Full-time',
        salary: job.annualSalaryMin ? `$${job.annualSalaryMin} - $${job.annualSalaryMax}` : "Not Disclosed",
        description: job.jobDescription || "Check details link.",
        url: job.url, // External Link
        source: "Jobicy",
        postedBy: null, // External
        createdAt: new Date(job.pubDate || new Date()).toISOString(),
        isExternal: true
    }));

  } catch (error) {
    if (error.response) {
      console.error(`Failed to fetch Jobicy jobs: Jobicy API Error: ${error.response.status}`);
    } else {
      console.error("Failed to fetch Jobicy jobs:", error.message);
    }
    return [];
  }
};
