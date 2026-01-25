import https from "https";
import axios from "axios";
import * as cheerio from "cheerio"; // Syntax might differ based on version, imports

async function fetchPageWise (url, page) {
    return new Promise((resolve) => {
        https.get(url, (res) => {
             if (res.statusCode !== 200) {
                 resolve([]); 
                 return;
             }
             let list = "";
             res.on("data", c => list += c);
             res.on("end", async () => {
                 try {
                     const json = JSON.parse(list);
                     const hackathons = json.hackathons || [];
                     
                     // Helper to process one hackathon
                     const processHackathon = async (h) => {
                         const info = {
                             id: `devpost_${h.id}`,
                             name: h.title,
                             url: h.url,
                             host: 'devpost',
                             platforms: ['Devpost'],
                             status: 'UPCOMING'
                         };

                         // Scrape for dates - Devpost API main list doesn't have exact start/end sometimes??
                         // The original controller scrapes details/dates
                         // We will try safeguards.
                         try {
                              const detailUrl = `${h.url}details/dates`;
                              const detailRes = await axios.get(detailUrl);
                              const $ = cheerio.load(detailRes.data);
                              
                              // Selectors from original logic
                              const htmlElement = `#container .row .small-12 .row .large-12 table tbody > tr:first-child`;
                               // Devpost might have changed their UI. If this fails, we just don't have dates.
                              const starts_at_iso = $(`${htmlElement} td:nth-child(2)`).attr("data-iso-date");
                              const ends_at_iso = $(`${htmlElement} td:nth-child(3)`).attr("data-iso-date");

                              if(starts_at_iso) info.startTime = starts_at_iso;
                              if(ends_at_iso) info.endTime = ends_at_iso;
                              if(ends_at_iso) info.applicationCloseTime = ends_at_iso; // assumption
                         } catch (err) {
                             // console.log("Devpost scrape error for " + h.url);
                         }

                         return info;
                     };

                     const promises = hackathons.map(h => processHackathon(h));
                     const results = await Promise.all(promises);
                     resolve(results);
                 } catch (e) {
                     console.error("Devpost parse error", e);
                     resolve([]);
                 }
             });
        }).on('error', () => resolve([]));
    });
}

export const fetchDevpostHackathons = async () => {
    // Only fetch page 1
    const url = `https://devpost.com/api/hackathons?challenge_type[]=online&status[]=upcoming&status[]=open&page=1`;
    try {
        const hacks = await fetchPageWise(url, 1);
        return hacks;
    } catch (e) {
        console.error("Devpost fetch error", e);
        return [];
    }
}
