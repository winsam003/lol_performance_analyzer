const API_KEY = process.env.NEXT_PUBLIC_RIOT_API_KEY || process.env.RIOT_API_KEY;
const REGION = "kr"; // Platform routing value (e.g., kr, na1)
const MASS_REGION = "asia"; // Regional routing value (e.g., asia, americas)

console.log("[DEBUG] Env Vars Check:");
console.log(`- NEXT_PUBLIC_RIOT_API_KEY: ${process.env.NEXT_PUBLIC_RIOT_API_KEY ? "Found" : "Missing"}`);
console.log(`- RIOT_API_KEY: ${process.env.RIOT_API_KEY ? "Found" : "Missing"}`);
console.log(`- Loaded API_KEY: ${API_KEY ? "Found" : "Missing"}`);

if (!API_KEY) {
    console.warn("RIOT_API_KEY is missing in environment variables.");
} else {
    console.log(`[DEBUG] API Key loaded. Length: ${API_KEY.length}, Preview: ${API_KEY.substring(0, 5)}...`);
}

const fetchWithAuth = async (url: string) => {
    // Check for whitespace
    const cleanKey = API_KEY?.trim();

    console.log(`[DEBUG] Fetching: ${url}`);

    const res = await fetch(url, {
        headers: {
            "X-Riot-Token": cleanKey || "",
        },
        next: { revalidate: 60 }, // Cache for 60 seconds
    });

    if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error(`Riot API Error: ${res.status} ${res.statusText} at ${url}`);
    }
    return res.json();
};

export interface RiotAccount {
    puuid: string;
    gameName: string;
    tagLine: string;
}

export interface RiotSummoner {
    id: string; // Encrypted summoner ID
    accountId: string;
    puuid: string;
    name: string;
    profileIconId: number;
    revisionDate: number;
    summonerLevel: number;
}

export interface LeagueEntry {
    leagueId: string;
    queueType: string;
    tier: string;
    rank: string;
    summonerId: string;
    summonerName: string;
    leaguePoints: number;
    wins: number;
    losses: number;
    veteran: boolean;
    inactive: boolean;
    freshBlood: boolean;
    hotStreak: boolean;
}

export const getAccount = async (gameName: string, tagLine: string): Promise<RiotAccount | null> => {
    const url = `https://${MASS_REGION}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
    return fetchWithAuth(url);
};

export const getSummonerByPuuid = async (puuid: string): Promise<RiotSummoner | null> => {
    const url = `https://${REGION}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`;
    return fetchWithAuth(url);
};

export const getLeagueEntries = async (encryptedSummonerId: string): Promise<LeagueEntry[]> => {
    const url = `https://${REGION}.api.riotgames.com/lol/league/v4/entries/by-summoner/${encryptedSummonerId}`;
    const data = await fetchWithAuth(url);
    return data || [];
};

export const getMatchIds = async (puuid: string, count: number = 20): Promise<string[]> => {
    const url = `https://${MASS_REGION}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=${count}`;
    const data = await fetchWithAuth(url);
    return data || [];
};

export const getMatchDetail = async (matchId: string): Promise<any> => {
    const url = `https://${MASS_REGION}.api.riotgames.com/lol/match/v5/matches/${matchId}`;
    return fetchWithAuth(url);
};
