import axios from "axios";

export const fetchRemotiveJobs = async () => {
    // Remotive Public API
    const url = "https://remotive.com/api/remote-jobs?limit=20";

    try {
        const response = await axios.get(url, {
            timeout: 10000,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
                "Accept": "application/json"
            }
        });

        const jobs = response.data.jobs || [];

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
        if (error.response) {
            console.error(`Failed to fetch Remotive jobs: Remotive API Error: ${error.response.status}`);
        } else {
            console.error("Failed to fetch Remotive jobs:", error.message);
        }
        return [];
    }
};
