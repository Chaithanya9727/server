import https from "https";

export const fetchRemotiveJobs = async () => {
    // Remotive Public API
    const url = "https://remotive.com/api/remote-jobs?limit=20";

    try {
        const data = await new Promise((resolve, reject) => {
            https.get(url, (res) => {
                if (res.statusCode !== 200) {
                    reject(new Error(`Remotive API Error: ${res.statusCode}`));
                    return;
                }
                let d = "";
                res.on('data', c => d += c);
                res.on('end', () => resolve(d));
            }).on('error', reject);
        });

        const json = JSON.parse(data);
        const jobs = json.jobs || [];

        return jobs.map(job => ({
            title: job.title,
            company: job.company_name,
            logo: job.company_logo_url || "",
            location: job.candidate_required_location || "Remote",
            type: job.job_type === 'full_time' ? 'Full-time' : 'Contract',
            salary: job.salary || "Competitive",
            description: "Check official listing for details.",
            url: job.url,
            source: "Remotive",
            postedBy: null,
            createdAt: new Date(job.publication_date).toISOString(),
            isExternal: true
        }));

    } catch (error) {
        console.error("Failed to fetch Remotive jobs:", error.message);
        return [];
    }
};
