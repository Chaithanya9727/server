import https from "https";
import * as cheerio from "cheerio";

export const fetchAtCoderContests = async () => {
  const url = "https://atcoder.jp/contests";

  try {
    const data = await new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if(res.statusCode !== 200) reject(new Error('AtCoder Error'));
            let d = "";
            res.on('data', c => d+=c);
            res.on('end', () => resolve(d));
        }).on('error', reject);
    });

    const $ = cheerio.load(data);
    const upcomingContests = [];

    $("#contest-table-upcoming tbody tr").each((index, element) => {
        try {
            const contestInfo = {};
            const startTimeElement = $(element).find(".text-center a");
            const startTimeLink = startTimeElement.attr("href");
            const contestURL = $(element).find("td:nth-of-type(2) a").attr("href");
            
            // ID from URL
            const parts = contestURL.split("/");
            const lastPart = parts[parts.length - 1]; // e.g. abc300

            // Start Time Parsing (ISO from link)
            const isoMatch = startTimeLink.match(/iso=([^&]+)/);
            if(isoMatch) {
                const iso = isoMatch[1];
                const year = parseInt(iso.substring(0, 4));
                const month = parseInt(iso.substring(4, 6)) - 1;
                const day = parseInt(iso.substring(6, 8));
                const hour = parseInt(iso.substring(9, 11));
                const minute = parseInt(iso.substring(11, 13));
                
                // AtCoder time is usually JST (UTC+9)? The ISO param in link is usually YYYYMMDDTHHMM
                // The original code had: const unixTimestamp = date.getTime() / 1000 - 9 * 60 * 60;
                // Let's assume the link ISO is local time or we construct Date carefully.
                // Simpler approach: Create date and assuming it's UTC or correcting.
                // Actually the link is usually timeanddate.com which takes ISO.
                // Let's trust the original logic's intent but simplify:
                
                // Constructing UTC date from the components if the ISO is in simple format
                // The original code manually parsed. We can try to use standard date parsing if possible or stick to manual.
                // Original: new Date(year, month, day, hour, minute) -> Local Time
                // Then subtracted 9 hours. This implies the ISO was JST.
                
                const date = new Date(year, month, day, hour, minute);
                // Adjust for JST (-9 hours) to get UTC if server is UTC? 
                // Wait, if I create new Date(...) it creates in local server time.
                // Let's store ISO string mostly.
                // If we assume the input YYYYMMDDTHHMM is JST:
                const jstDate = new Date(Date.UTC(year, month, day, hour - 9, minute));
                
                contestInfo.startTime = jstDate.toISOString();
                contestInfo.startTimeUnix = jstDate.getTime() / 1000;
            }

            contestInfo.name = $(element).find("td:nth-of-type(2) a").text().trim();
            contestInfo.host = "atcoder";
            contestInfo.site = "AtCoder"; // for Frontend
            contestInfo.vanity = lastPart;
            contestInfo.url = `https://atcoder.jp/contests/${lastPart}`;

            // Duration
            const durationText = $(element).find("td:nth-of-type(3)").text().trim();
            const [hours, minutes] = durationText.split(":").map(Number);
            contestInfo.duration = hours * 60 + minutes + ''; // string or number? Service uses number usually

            upcomingContests.push(contestInfo);
        } catch(e) {
            // skip row on error
        }
    });

    return upcomingContests;

  } catch (error) {
    console.error("Failed to fetch AtCoder contests:", error);
    return [];
  }
};
