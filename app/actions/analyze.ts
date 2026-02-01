"use server";

import { getAccount, getLeagueEntries, getMatchDetail, getMatchIds, getSummonerByPuuid } from "@/lib/riot";

export interface MatchParticipant {
    gameName: string;
    tagLine: string;
    championName: string;
}

export interface SquadMemberPerformance {
    gameName: string;
    tagLine: string;
    score: number;
    kda: string;
    damage: number;
    deaths: number;
    gold: number;
    win: boolean;
    championName: string;
    visionScore: number; // 시야 점수 타입 추가
}

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
    participants: MatchParticipant[];
    allParticipants: SquadMemberPerformance[];
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

/**
 * 인분 점수 계산 공통 로직
 */
function calculateContributionScore(p: any): number {
    const kdaValue = p.deaths === 0
        ? (p.kills + p.assists) * 1.5
        : (p.kills + p.assists) / p.deaths;

    // 시야 점수(visionScore)를 계산식에 포함
    let score = Math.floor((kdaValue * 10) + (p.totalDamageDealtToChampions / 1500) + (p.visionScore * 1));
    if (p.win) score += 20;

    return score > 160 ? 160 : score;
}

export async function analyzeSummoner(gameName: string, tagLine: string): Promise<AnalysisResult | null> {
    try {
        // 1. 계정 정보 조회 (PUUID 획득)
        const account = await getAccount(gameName, tagLine);
        if (!account) return null;

        // 2. 소환사 기본 정보 조회
        const summoner = await getSummonerByPuuid(account.puuid);
        if (!summoner) return null;

        // 3. 리그 정보 조회
        let leagues: any[] = [];
        try {
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

        // 429 에러 방지 딜레이
        await delay(500);

        const matchIds = await getMatchIds(account.puuid, 20);
        const matchesRaw = [];

        // 매치 상세 정보 순차 조회
        for (const id of matchIds) {
            const detail = await getMatchDetail(id);
            if (detail) matchesRaw.push(detail);
            await delay(250);
        }

        const analyzedMatches: AnalyzedMatch[] = matchesRaw
            .filter((m) => m && m.info)
            .map((match) => {
                const participant = match.info.participants.find((p: any) => p.puuid === account.puuid);
                if (!participant) return null;

                const now = Date.now();
                const hoursAgo = Math.floor((now - match.info.gameEndTimestamp) / (1000 * 60 * 60));
                const dateStr = hoursAgo < 24 ? `${hoursAgo}시간 전` : `${Math.floor(hoursAgo / 24)}일 전`;

                // 해당 매치의 10명 전원 정보 추출 (스쿼드 비교용)
                const allParticipants: SquadMemberPerformance[] = match.info.participants.map((p: any) => ({
                    gameName: p.riotIdGameName || p.summonerName,
                    tagLine: p.riotIdTagline || "KR1",
                    score: calculateContributionScore(p),
                    kda: `${p.kills}/${p.deaths}/${p.assists}`,
                    damage: p.totalDamageDealtToChampions,
                    deaths: p.deaths,
                    gold: p.goldEarned,
                    win: p.win,
                    championName: p.championName,
                    visionScore: p.visionScore // 시야 점수 데이터 주입
                }));

                const simplifiedParticipants: MatchParticipant[] = match.info.participants.map((p: any) => ({
                    gameName: p.riotIdGameName || p.summonerName,
                    tagLine: p.riotIdTagline || "KR1",
                    championName: p.championName
                }));

                return {
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
                    score: calculateContributionScore(participant),
                    date: dateStr,
                    tags: [],
                    participants: simplifiedParticipants,
                    allParticipants: allParticipants,
                    detail: {
                        kills: participant.kills,
                        deaths: participant.deaths,
                        assists: participant.assists,
                        totalDamageDealtToChampions: participant.totalDamageDealtToChampions,
                        visionScore: participant.visionScore
                    }
                } as AnalyzedMatch;
            })
            .filter((m): m is AnalyzedMatch => m !== null);

        return { profile, matches: analyzedMatches };
    } catch (error: any) {
        console.error("❌ 분석 중 치명적 에러 발생:", error);
        return null;
    }
}