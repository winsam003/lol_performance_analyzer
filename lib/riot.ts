const API_KEY = process.env.NEXT_PUBLIC_RIOT_API_KEY || process.env.RIOT_API_KEY;
const REGION = "kr"; // Platform routing value (e.g., kr, na1)
const MASS_REGION = "asia"; // Regional routing value (e.g., asia, americas)

const fetchWithAuth = async <T>(url: string): Promise<T | null> => {
    const cleanKey = API_KEY?.trim();

    const res = await fetch(url, {
        headers: {
            "X-Riot-Token": cleanKey || "",
        },
        cache: "no-store", // Disable cache to debug missing fields
    });

    if (!res.ok) {
        const errorBody = await res.text(); // 에러 내용 확인
        console.error(`[RIOT_ERROR_BODY] ${errorBody}`);

        if (res.status === 404) return null;
        throw new Error(`Riot API Error: ${res.status} ${res.statusText} at ${url}`);
    }

    const data = await res.json() as T;

    return data;
};

export interface RiotAccount {
    puuid: string;
    gameName: string;
    tagLine: string;
}

export interface RiotSummoner {
    id?: string; // Encrypted summoner ID (신규 응답에서는 없을 수 있음)
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

export interface RiotMatchParticipant {
    puuid: string;
    summonerId?: string;
    riotIdGameName?: string;
    riotIdTagline?: string;
    summonerName?: string;
    championName: string;
    teamId: number;
    teamPosition?: string;
    kills: number;
    deaths: number;
    assists: number;
    goldEarned: number;
    totalDamageDealtToChampions: number;
    totalDamageTaken: number;
    damageSelfMitigated?: number;
    damageDealtToTurrets?: number;
    totalMinionsKilled?: number;
    neutralMinionsKilled?: number;
    visionScore: number;
    timeCCingOthers?: number;
    totalTimeCCDealt?: number;
    totalHealsOnTeammates?: number;
    totalDamageShieldedOnTeammates?: number;
    timePlayed?: number;
    win: boolean;
    item0?: number;
    item1?: number;
    item2?: number;
    item3?: number;
    item4?: number;
    item5?: number;
    item6?: number;
    challenges?: {
        baronTakedowns?: number;
        dragonTakedowns?: number;
        riftHeraldTakedowns?: number;
        objectivesStolen?: number;
    };
}

export interface RiotMatchDetail {
    metadata: {
        matchId: string;
    };
    info: {
        gameEndTimestamp: number;
        queueId: number;
        participants: RiotMatchParticipant[];
    };
}

export const getAccount = async (gameName: string, tagLine: string): Promise<RiotAccount | null> => {
    const url = `https://${MASS_REGION}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
    return fetchWithAuth<RiotAccount>(url);
};

export const getSummonerByPuuid = async (puuid: string): Promise<RiotSummoner | null> => {
    const url = `https://${REGION}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`;
    const data = await fetchWithAuth<RiotSummoner>(url);

    if (!data) return null;

    if (!data.id) {
        console.warn(`[RIOT_FIX] Summoner ID missing for ${puuid}. Attempting to fetch via Match API...`);
        try {
            const matches = await getMatchIds(puuid, 1);
            if (matches.length > 0) {
                const match = await getMatchDetail(matches[0]);
                if (match && match.info) {
                    const participant = match.info.participants.find(p => p.puuid === puuid);
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

export async function getLeagueEntries(puuid: string): Promise<LeagueEntry[]> {
    // const url = `https://${REGION}.api.riotgames.com/lol/league/v4/entries/by-summoner/${encryptedSummonerId}`;
    const url = `https://kr.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`;
    try {
        const data = await fetchWithAuth<LeagueEntry[]>(url);
        return data || [];
    } catch (error) {
        console.warn(`[RIOT_LEAGUE_WARNING] Failed to fetch league entries: ${error}`);
        return [];
    }
};

export const getMatchIds = async (puuid: string, count: number = 20): Promise<string[]> => {
    const url = `https://${MASS_REGION}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=${count}`;
    const data = await fetchWithAuth<string[]>(url);
    return data || [];
};

export const getMatchDetail = async (matchId: string): Promise<RiotMatchDetail | null> => {
    const url = `https://${MASS_REGION}.api.riotgames.com/lol/match/v5/matches/${matchId}`;
    return fetchWithAuth<RiotMatchDetail>(url);
};
