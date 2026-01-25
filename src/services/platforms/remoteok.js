import https from "https";

export const fetchRemoteOKJobs = async () => {
  // RemoteOK API
  const url = "https://remoteok.com/api";

  try {
    const data = await new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'OneStop-Agency/1.0' } }, (res) => {
            if(res.statusCode !== 200) reject(new Error(`RemoteOK API Error: ${res.statusCode}`));
            let d = "";
            res.on('data', c => d+=c);
            res.on('end', () => resolve(d));
        }).on('error', reject);
    });

    const json = JSON.parse(data);
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
    console.error("Failed to fetch RemoteOK jobs:", error.message);
    return [];
  }
};
