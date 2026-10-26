import { unstable_cache } from 'next/cache';

const API_KEY = process.env.RIOT_API_KEY || process.env.NEXT_PUBLIC_RIOT_API_KEY;
const REGION = 'kr'; // Platform routing value (e.g., kr, na1)
const MASS_REGION = 'asia'; // Regional routing value (e.g., asia, americas)
const MAX_RATE_LIMIT_RETRIES = 2;
const MAX_RATE_LIMIT_WAIT_MS = 10_000;
let rateLimitUntil = 0;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getRetryAfterMs = (retryAfter: string | null, attempt: number) => {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(seconds * 1000, 1000);

    const retryDate = Date.parse(retryAfter);
    if (Number.isFinite(retryDate)) return Math.max(retryDate - Date.now(), 1000);
  }

  return 1000 * 2 ** attempt;
};

// All callers in this server process share the same request budget.
// Persistent cache hits bypass this queue entirely.
const requestStarts: number[] = [];
let queue: Promise<unknown> = Promise.resolve();
const activeRequests = new Set<Promise<unknown>>();
let startQueue: Promise<unknown> = Promise.resolve();
const inFlight = new Map<string, Promise<unknown>>();

async function requestFromRiot<T>(url: string): Promise<T | null> {
  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt += 1) {
    const admission = startQueue.then(async () => {
      // A concurrent 429 may extend the cooldown while this request is waiting.
      while (true) {
        const now = Date.now();
        while (requestStarts.length && requestStarts[0] <= now - 120_000) requestStarts.shift();
        const shortWindow = requestStarts.filter((start) => start > now - 750);
        const waitUntil = Math.max(
          rateLimitUntil,
          shortWindow.length >= 3 ? shortWindow[shortWindow.length - 3] + 750 : 0,
          requestStarts.length >= 90 ? requestStarts[requestStarts.length - 90] + 120_000 : 0,
        );
        const waitMs = waitUntil - Date.now();
        if (waitMs > MAX_RATE_LIMIT_WAIT_MS) {
          throw new Error(
            `Riot API 요청 제한 중입니다. ${Math.ceil(waitMs / 1000)}초 후 다시 시도해주세요.`,
          );
        }
        if (waitMs <= 0) break;
        await wait(waitMs);
      }
      requestStarts.push(Date.now());
    });
    startQueue = admission.catch(() => undefined);
    await admission;
    const res = await fetch(url, {
      headers: { 'X-Riot-Token': API_KEY?.trim() || '' },
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 404) return null;
    if (res.status === 429) {
      const retryMs = getRetryAfterMs(res.headers.get('retry-after'), attempt);
      rateLimitUntil = Math.max(rateLimitUntil, Date.now() + retryMs);
      if (attempt < MAX_RATE_LIMIT_RETRIES && retryMs <= MAX_RATE_LIMIT_WAIT_MS) continue;
      throw new Error(
        `Riot API 요청 한도를 초과했습니다. ${Math.ceil(retryMs / 1000)}초 후 다시 시도해주세요.`,
      );
    }
    if (!res.ok) throw new Error(`Riot API 조회 실패 (${res.status}). 잠시 후 다시 시도해주세요.`);
    return (await res.json()) as T;
  }
  throw new Error('Riot API 조회에 실패했습니다.');
}

async function fetchWithAuth<T>(url: string, revalidateSeconds: number): Promise<T | null> {
  const existing = inFlight.get(url);
  if (existing) return existing as Promise<T | null>;
  const cached = unstable_cache(
    async () => {
      const admission = queue.then(async () => {
        if (activeRequests.size >= 3) await Promise.race(activeRequests);
        const request = requestFromRiot<T>(url);
        const completion = request.then(
          () => undefined,
          () => undefined,
        );
        activeRequests.add(completion);
        void completion.then(() => activeRequests.delete(completion));
        return { request };
      });
      queue = admission.then(
        () => undefined,
        () => undefined,
      );
      return (await admission).request;
    },
    ['riot-v2', url],
    { revalidate: revalidateSeconds },
  );
  const request = cached();
  inFlight.set(url, request);
  try {
    return await request;
  } finally {
    inFlight.delete(url);
  }
}

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

export const getAccount = async (
  gameName: string,
  tagLine: string,
): Promise<RiotAccount | null> => {
  const url = `https://${MASS_REGION}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
  return fetchWithAuth<RiotAccount>(url, 300);
};

export const getSummonerByPuuid = async (puuid: string): Promise<RiotSummoner | null> => {
  const url = `https://${REGION}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`;
  return fetchWithAuth<RiotSummoner>(url, 300);
};

export async function getLeagueEntries(puuid: string): Promise<LeagueEntry[]> {
  const url = `https://${REGION}.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`;
  return (await fetchWithAuth<LeagueEntry[]>(url, 60)) || [];
}

export const getMatchIds = async (puuid: string, count: number = 20): Promise<string[]> => {
  const url = `https://${MASS_REGION}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=${count}`;
  const data = await fetchWithAuth<string[]>(url, 60);
  return data || [];
};

export const getMatchDetail = async (matchId: string): Promise<RiotMatchDetail | null> => {
  const url = `https://${MASS_REGION}.api.riotgames.com/lol/match/v5/matches/${matchId}`;
  return fetchWithAuth<RiotMatchDetail>(url, 86_400);
};
