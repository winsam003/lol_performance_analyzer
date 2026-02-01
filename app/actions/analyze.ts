"use server";

import { getAccount, getLeagueEntries, getMatchDetail, getMatchIds, getSummonerByPuuid } from "@/lib/riot";

export interface AnalyzedMatch {
    id: string;
    queueId: number;
    champion: string;
    role: "TOP" | "JNG" | "MID" | "ADC" | "SUP";
    result: "WIN" | "LOSE";
    kda: string;
    score: number;
    date: string;
    tags: Array<{ type: "Vision" | "Dmg" | "Survival" | "KDA"; label: string; color: string; bg: string }>;
    detail: {
        kills: number;
        deaths: number;
        assists: number;
        totalDamageDealtToChampions: number;
        visionScore: number;
    };
}

export interface SummonerProfile {
    name: string;
    tag: string;
    level: number;
    iconId: number;
    tier: string;
    lp: number;
    wins: number;
    losses: number;
    winRate: string;
}

export interface AnalysisResult {
    profile: SummonerProfile;
    matches: AnalyzedMatch[];
}
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function analyzeSummoner(gameName: string, tagLine: string): Promise<AnalysisResult | null> {
    try {
        // 1. 계정 정보 조회 (PUUID 획득)
        const account = await getAccount(gameName, tagLine);
        if (!account) return null;

        // 2. 소환사 기본 정보 조회
        const summoner = await getSummonerByPuuid(account.puuid);
        if (!summoner) return null;

        // 3. 리그 정보 조회 (중요: summoner.id 대신 account.puuid 사용)
        let leagues: any[] = [];
        try {
            // 보내주신 API 리스트의 entries/by-puuid 엔드포인트 호출
            // lib/riot.ts의 getLeagueEntries가 puuid를 받도록 되어있는지 확인하세요!
            leagues = await getLeagueEntries(account.puuid) || [];
        } catch (lError: any) {
            console.warn(`⚠️ 리그 조회 실패:`, lError.message);
            leagues = [];
        }

        const soloRank = leagues.find((l: any) => l.queueType === "RANKED_SOLO_5x5");
        const flexRank = leagues.find((l: any) => l.queueType === "RANKED_FLEX_SR");
        const mainLeague = soloRank || flexRank;

        const profile: SummonerProfile = {
            name: account.gameName,
            tag: account.tagLine,
            level: summoner.summonerLevel,
            iconId: summoner.profileIconId,
            tier: mainLeague ? `${mainLeague.tier} ${mainLeague.rank}` : "UNRANKED",
            lp: mainLeague ? mainLeague.leaguePoints : 0,
            wins: mainLeague ? mainLeague.wins : 0,
            losses: mainLeague ? mainLeague.losses : 0,
            winRate: mainLeague && (mainLeague.wins + mainLeague.losses) > 0
                ? Math.round((mainLeague.wins / (mainLeague.wins + mainLeague.losses)) * 100) + "%"
                : "0%",
        };

        // 429 방지를 위한 딜레이 후 매치 조회 시작
        await delay(500);

        const matchIds = await getMatchIds(account.puuid, 20);
        const matchesRaw = [];

        // 매치 상세 정보 순차 조회 (안정성 최우선)
        for (const id of matchIds) {
            const detail = await getMatchDetail(id);
            if (detail) matchesRaw.push(detail);
            await delay(50);
        }

        const analyzedMatches: AnalyzedMatch[] = matchesRaw
            .filter((m) => m && m.info)
            .map((match) => {
                const participant = match.info.participants.find((p: any) => p.puuid === account.puuid);
                if (!participant) return null;

                const now = Date.now();
                const hoursAgo = Math.floor((now - match.info.gameEndTimestamp) / (1000 * 60 * 60));
                const dateStr = hoursAgo < 24 ? `${hoursAgo}시간 전` : `${Math.floor(hoursAgo / 24)}일 전`;

                const kdaValue = participant.deaths === 0
                    ? (participant.kills + participant.assists) * 1.5
                    : (participant.kills + participant.assists) / participant.deaths;

                let score = Math.floor((kdaValue * 10) + (participant.totalDamageDealtToChampions / 1500) + (participant.visionScore * 1));
                if (participant.win) score += 20;
                if (score > 160) score = 160;

                const resultMatch: AnalyzedMatch = {
                    id: match.metadata.matchId,
                    queueId: match.info.queueId,
                    champion: participant.championName,
                    role: participant.teamPosition === "UTILITY" ? "SUP"
                        : participant.teamPosition === "JUNGLE" ? "JNG"
                            : participant.teamPosition === "BOTTOM" ? "ADC"
                                : participant.teamPosition === "MIDDLE" ? "MID"
                                    : participant.teamPosition === "TOP" ? "TOP" : "MID",
                    result: participant.win ? "WIN" : "LOSE",
                    kda: `${participant.kills}/${participant.deaths}/${participant.assists}`,
                    score: score,
                    date: dateStr,
                    tags: [],
                    detail: {
                        kills: participant.kills,
                        deaths: participant.deaths,
                        assists: participant.assists,
                        totalDamageDealtToChampions: participant.totalDamageDealtToChampions,
                        visionScore: participant.visionScore
                    }
                };
                return resultMatch;
            })
            .filter((m): m is AnalyzedMatch => m !== null);

        return { profile, matches: analyzedMatches };
    } catch (error: any) {
        console.error("❌ 분석 중 치명적 에러 발생:", error);
        return null;
    }
}