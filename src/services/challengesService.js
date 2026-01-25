import axios from "axios";

// LeetCode POTD
export const fetchLeetCodePOTD = async () => {
    const query = {
        operationName: "activeDailyCodingChallengeQuestion",
        variables: {},
        query: `
        query activeDailyCodingChallengeQuestion {
            activeDailyCodingChallengeQuestion {
                link
                date
                question {
                    title
                }
            }
        }
    `
    };

    try {
        const { data } = await axios.post('https://leetcode.com/graphql', query);
        const q = data?.data?.activeDailyCodingChallengeQuestion;
        
        if(!q) return null;

        return {
            id: `lc_potd_${q.date}`,
            name: q.question?.title || "LeetCode Daily Challenge",
            url: "https://leetcode.com" + q.link,
            platform: "LeetCode",
            status: "ACTIVE",
            date: q.date,
            prize: "Daily Streak"
        };
    } catch (error) {
        console.error("Error fetching LeetCode POTD:", error);
        return null;
    }
};

// GFG POTD
export const fetchGFGPOTD = async () => {
    try {
        // API from potdController
        const { data } = await axios.get('https://practiceapi.geeksforgeeks.org/api/vr/problems-of-day/problem/today');
        
        return {
            id: `gfg_potd_${new Date().toISOString().split('T')[0]}`,
            name: data.problem_name,
            url: data.problem_url,
            platform: "GeeksForGeeks",
            status: "ACTIVE",
            prize: "GeekBits"
        };
    } catch (error) {
        console.error("Error fetching GFG POTD:", error);
        return null;
    }
};

export const getAggregatedChallenges = async () => {
    try {
        const [lc, gfg] = await Promise.allSettled([
            fetchLeetCodePOTD(),
            fetchGFGPOTD()
        ]);
        
        const challenges = [];
        if (lc.status === 'fulfilled' && lc.value) challenges.push(lc.value);
        if (gfg.status === 'fulfilled' && gfg.value) challenges.push(gfg.value);
        
        return challenges;
    } catch (e) {
        return [];
    }
}
