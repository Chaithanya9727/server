import https from "https";

async function fetchPageWise (url, page) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
        if (res.statusCode !== 200) {
            resolve([]); // resolving empty on error to not break the chain
            return;
        }
        let list = "";
        res.on("data", (chunk) => (list += chunk));
        res.on("end", () => {
            try {
                const hackathonsList = JSON.parse(list);
                // The API format from the controller was data.data
                const dataArray = hackathonsList?.data?.data || [];
                
                const formatted = dataArray.map((h) => ({
                    id: `unstop_${h.id}`,
                    name: h.title,
                    url: `https://unstop.com/${h.public_url}`,
                    startTime: h.start_date, // Unstop provides ISO strings usually, or check controller logic
                    endTime: h.end_date,
                    applicationCloseTime: h.regnRequirements?.end_regn_dt,
                    platforms: ['Unstop'],
                    status: 'UPCOMING', // Simplified, better logic would check dates
                    imageUrl: h.banner_mobile?.url || h.banner_desktop?.url, // Bonus: use image if available
                    host: "unstop"
                }));
                // Return tuple like original controller if needed, or just data
                // For simplicity here, just returning data
                 resolve(formatted);
            } catch (e) {
                console.error("Unstop parse error page " + page, e);
                resolve([]);
            }
        });
    }).on('error', e => resolve([]));
  });
}

export const fetchUnstopHackathons = async () => {
   // Just fetch page 1 for now to be fast, or maybe 2 pages.
   // Original code fetched ALL pages. That might be slow. Let's fetch 2 pages.
   const baseUrl = `https://unstop.com/api/public/opportunity/search-result?opportunity=hackathons&per_page=15&oppstatus=open`;
   
   try {
       const p1 = await fetchPageWise(`${baseUrl}&page=1`, 1);
       return [...p1];
   } catch (e) {
       console.error("Unstop fetch error", e);
       return [];
   }
}

export const fetchUnstopJobs = async () => {
   // Fetch "jobs" opportunity from Unstop API
   // Using similar endpoint pattern but opportunity=jobs
   const baseUrl = `https://unstop.com/api/public/opportunity/search-result?opportunity=jobs&per_page=15&oppstatus=open`;
   
   try {
       const data = await new Promise((resolve, reject) => {
        https.get(baseUrl + '&page=1', (res) => {
            if (res.statusCode !== 200) {
                resolve([]);
                return;
            }
            let list = "";
            res.on("data", (chunk) => (list += chunk));
            res.on("end", () => {
                try {
                    const json = JSON.parse(list);
                    const items = json?.data?.data || [];
                    
                    const jobs = items.map(item => ({
                        title: item.title,
                        company: item.organisation?.name || "Unstop Partner",
                        logo: item.organisation?.logo_url || item.banner_mobile?.url || "", 
                        location: item.job_location || "India", // Unstop is mostly India
                        type: item.job_type === 'full_time' ? 'Full-time' : 'Internship',
                        salary: item.job_salary ? item.job_salary : "Not Disclosed",
                        description: "Check Unstop for details.",
                        url: `https://unstop.com/${item.public_url}`, 
                        source: "Unstop",
                        postedBy: null,
                        createdAt: new Date(item.start_date || Date.now()).toISOString(),
                        isExternal: true
                    }));
                    resolve(jobs);
                } catch(e) {
                    console.error("Unstop Jobs Parse Error", e);
                    resolve([]);
                }
            });
        }).on('error', e => resolve([]));
       });

       return data;
   } catch (e) {
       console.error("Unstop Jobs fetch error", e);
       return [];
   }
}
