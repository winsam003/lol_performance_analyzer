const API_KEY = process.env.NEXT_PUBLIC_RIOT_API_KEY || process.env.RIOT_API_KEY;
const REGION = "kr"; // Platform routing value (e.g., kr, na1)
const MASS_REGION = "asia"; // Regional routing value (e.g., asia, americas)

const fetchWithAuth = async (url: string) => {
    const cleanKey = API_KEY?.trim();

    // 1. 요청 시작 로그 (무조건 찍힘)
    console.log(`[RIOT_REQUEST_START] URL: ${url}`);

    const res = await fetch(url, {
        headers: {
            "X-Riot-Token": cleanKey || "",
        },
        next: { revalidate: 60 },
    });

    // 2. 결과 로그 (여기서 status 확인 가능)
    console.log(`[RIOT_RESPONSE_RESULT] Status: ${res.status} | URL: ${url}`);

    if (!res.ok) {
        const errorBody = await res.text();
        console.error(`[RIOT_ERROR_BODY] ${errorBody}`);

        if (res.status === 404) return null;
        throw new Error(`Riot API Error: ${res.status} ${res.statusText} at ${url} | Body: ${errorBody}`);
    }

    const data = await res.json();

    return data;
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
    const data = await fetchWithAuth(url);

    if (!data) return null;

    if (!data.id) {
        console.warn(`[RIOT_FIX] Summoner ID missing for ${puuid}. Attempting to fetch via Match API...`);
        try {
            const matches = await getMatchIds(puuid, 1);
            if (matches.length > 0) {
                const match = await getMatchDetail(matches[0]);
                if (match && match.info) {
                    const participant = match.info.participants.find((p: any) => p.puuid === puuid);
                    if (participant && participant.summonerId) {
                        console.log(`[RIOT_FIX] Found Summoner ID via Match API: ${participant.summonerId}`);
                        data.id = participant.summonerId;
                    }
                }
            }
        } catch (e) {
            console.error("[RIOT_FIX] Failed to recover Summoner ID via Match API", e);
        }
    }

    return data;
};

export const getLeagueEntries = async (encryptedSummonerId: string): Promise<LeagueEntry[]> => {
    const url = `https://${REGION}.api.riotgames.com/lol/league/v4/entries/by-summoner/${encryptedSummonerId}`;
    try {
        const data = await fetchWithAuth(url);
        return data || [];
    } catch (error) {
        console.warn(`[RIOT_LEAGUE_WARNING] Failed to fetch league entries: ${error}`);
        return [];
    }
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
