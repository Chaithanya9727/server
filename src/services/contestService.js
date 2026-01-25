import { fetchCodeforcesContests } from './platforms/codeforces.js';
import { fetchLeetCodeContests } from './platforms/leetcode.js';
import { fetchAtCoderContests } from './platforms/atcoder.js';
import { fetchCodeChefContests } from './platforms/codechef.js';
import { fetchGFGContests } from './platforms/gfg.js';
import { fetchCodingNinjasContests } from './platforms/codingninjas.js';

import { fetchUnstopHackathons } from './platforms/unstop.js';
import { fetchDevpostHackathons } from './platforms/devpost.js';

/**
 * Get aggregated coding contests
 */
export const getContests = async () => {
    try {
        const results = await Promise.allSettled([
            fetchCodeforcesContests(),
            fetchLeetCodeContests(),
            fetchAtCoderContests(),
            fetchCodeChefContests(),
            fetchGFGContests(),
            fetchCodingNinjasContests()
        ]);
        
        let allContests = [];
        results.forEach(res => {
            if(res.status === 'fulfilled' && Array.isArray(res.value)) {
                allContests = [...allContests, ...res.value];
            }
        });

        // Sort by startTime
        return allContests.sort((a, b) => {
            return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
        });

    } catch (error) {
        console.error("Error aggregating contests:", error);
        return [];
    }
};

/**
 * Get aggregated hackathons
 */
export const getHackathons = async () => {
    try {
        const results = await Promise.allSettled([
            fetchUnstopHackathons(),
            fetchDevpostHackathons()
        ]);

        let allHackathons = [];
        results.forEach(res => {
             if(res.status === 'fulfilled' && Array.isArray(res.value)) {
                allHackathons = [...allHackathons, ...res.value];
             }
        });

        return allHackathons.sort((a, b) => {
             const tA = a.startTime ? new Date(a.startTime).getTime() : Infinity;
             const tB = b.startTime ? new Date(b.startTime).getTime() : Infinity;
             return tA - tB;
        });
    } catch (error) {
         console.error("Error aggregating hackathons:", error);
         return [];
    }
};
