import https from "https";

export const fetchJobicyJobs = async () => {
  // Jobicy Public Feed (Remote jobs mostly)
  // https://jobicy.com/api/v2/remote-jobs
  const url = "https://jobicy.com/api/v2/remote-jobs?count=20";

  try {
    const data = await new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if(res.statusCode !== 200) reject(new Error(`Jobicy API Error: ${res.statusCode}`));
            let d = "";
            res.on('data', c => d+=c);
            res.on('end', () => resolve(d));
        }).on('error', reject);
    });

    const json = JSON.parse(data);
    const jobs = json.jobs || [];

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
        createdAt: new Date(job.pubDate).toISOString(),
        isExternal: true
    }));

  } catch (error) {
    console.error("Failed to fetch Jobicy jobs:", error.message);
    return [];
  }
};
