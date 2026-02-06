import axios from "axios";

async function fetchPageWise (url, page) {
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Accept": "application/json"
      }
    });

    const hackathonsList = response.data;
    const dataArray = hackathonsList?.data?.data || [];
    
    return dataArray.map((h) => ({
        id: `unstop_${h.id}`,
        name: h.title,
        url: `https://unstop.com/${h.public_url}`,
        startTime: h.start_date,
        endTime: h.end_date,
        applicationCloseTime: h.regnRequirements?.end_regn_dt,
        platforms: ['Unstop'],
        status: 'UPCOMING',
        imageUrl: h.banner_mobile?.url || h.banner_desktop?.url,
        host: "unstop"
    }));
  } catch (e) {
    if (e.response) {
      console.error(`Unstop API Error page ${page}: ${e.response.status}`);
    } else {
      console.error(`Unstop fetch error page ${page}:`, e.message);
    }
    return [];
  }
}

export const fetchUnstopHackathons = async () => {
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
   const baseUrl = `https://unstop.com/api/public/opportunity/search-result?opportunity=jobs&per_page=15&oppstatus=open`;
   
   try {
     const response = await axios.get(baseUrl + '&page=1', {
       timeout: 10000,
       headers: {
         "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
         "Accept": "application/json"
       }
     });

     const items = response.data?.data?.data || [];
     
     return items.map(item => ({
         title: item.title,
         company: item.organisation?.name || "Unstop Partner",
         logo: item.organisation?.logo_url || item.banner_mobile?.url || "", 
         location: item.job_location || "India",
         type: item.job_type === 'full_time' ? 'Full-time' : 'Internship',
         salary: item.job_salary ? item.job_salary : "Not Disclosed",
         description: "Check Unstop for details.",
         url: `https://unstop.com/${item.public_url}`, 
         source: "Unstop",
         postedBy: null,
         createdAt: new Date(item.start_date || Date.now()).toISOString(),
         isExternal: true
     }));
   } catch (e) {
       if (e.response) {
         console.error(`Unstop Jobs API Error: ${e.response.status}`);
       } else {
         console.error("Unstop Jobs fetch error", e.message);
       }
       return [];
   }
}
