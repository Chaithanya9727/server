import axios from "axios";

export const fetchRemoteOKJobs = async () => {
  // RemoteOK API
  const url = "https://remoteok.com/api";

  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'referer': 'https://remoteok.com/'
      }
    });

    const json = response.data;
    // RemoteOK returns array, first element is legal disclaimer usually
    const jobs = Array.isArray(json) ? json.slice(1) : []; 

    return jobs.slice(0, 15).map((job) => ({
        title: job.position,
        company: job.company,
        logo: job.company_logo || "", 
        location: job.location || "Remote",
        type: 'Full-time', // RemoteOK mostly fulltime
        salary: job.salary_min ? `$${job.salary_min} - $${job.salary_max}` : "Not Disclosed",
        description: "Apply on RemoteOK",
        url: job.apply_url, 
        source: "RemoteOK",
        postedBy: null,
        createdAt: new Date(job.date).toISOString(),
        isExternal: true
    }));

  } catch (error) {
    if (error.response) {
      console.error(`Failed to fetch RemoteOK jobs: RemoteOK API Error: ${error.response.status}`);
    } else {
      console.error("Failed to fetch RemoteOK jobs:", error.message);
    }
    return [];
  }
};
