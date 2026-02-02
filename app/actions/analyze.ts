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
    // 계산 근거를 저장할 필드 추가
    breakdown: {
        base: number;
        vision: number;
        dmg: number;
        deaths: number;
    };
    kda: string;
    damage: number;
    deaths: number;
    gold: number;
    win: boolean;
    championName: string;
    visionScore: number;
}

export interface AnalyzedMatch {
    id: string;
    queueId: number;
    champion: string;
    role: "TOP" | "JNG" | "MID" | "ADC" | "SUP";
    result: "WIN" | "LOSE";
    kda: string;
    score: number;
    // 메인 분석 결과에도 breakdown 포함
    breakdown: {
        base: number;
        vision: number;
        dmg: number;
        deaths: number;
    };
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
 * 인분 점수 계산 및 상세 내역 반환 로직
 */
function calculateContributionScore(p: any) {
    // 1. KDA 기반 기본 점수 (기존 유지)
    const rawKda = p.deaths === 0
        ? (p.kills + p.assists) * 1.1
        : (p.kills + p.assists) / p.deaths;

    let baseScore = Math.floor(Math.sqrt(rawKda) * 40);
    if (p.win) baseScore += 20;

    // 2. 포지션별 기여도 보정
    let visionImpact = 0;
    let dmgImpact = 0;
    let tankingImpact = 0;
    const role = p.teamPosition;

    switch (role) {
        case "BOTTOM": // 원딜 (가장 강력한 딜 보너스)
            // [버프] 800딜당 1점 (기존 1000~1200). 3만딜 넣으면 약 +25점
            dmgImpact = Math.max(0, Math.floor((p.totalDamageDealtToChampions - 10000) / 800));
            visionImpact = Math.floor((p.visionScore - 10) / 4);
            break;

        case "MIDDLE": // 미드
            // [버프] 900딜당 1점. 3만딜 넣으면 약 +22점
            dmgImpact = Math.max(0, Math.floor((p.totalDamageDealtToChampions - 10000) / 900));
            visionImpact = Math.floor((p.visionScore - 12) / 3);
            break;

        case "TOP": // 탑
            // [버프] 1100딜당 1점 + 탱킹 점수 강화
            dmgImpact = Math.max(0, Math.floor((p.totalDamageDealtToChampions - 12000) / 1100));
            visionImpact = Math.floor((p.visionScore - 12) / 4);
            tankingImpact = p.totalDamageTaken > 15000
                ? Math.min(25, Math.floor((p.totalDamageTaken - 15000) / 1000)) : 0;
            break;

        case "JUNGLE": // 정글
            dmgImpact = Math.max(0, Math.floor((p.totalDamageDealtToChampions - 10000) / 1100));
            visionImpact = Math.floor((p.visionScore - 15) / 3);
            break;

        case "UTILITY": // 서포터
            visionImpact = Math.floor((p.visionScore - 25) / 3);
            dmgImpact = p.totalDamageDealtToChampions > 8000
                ? Math.floor((p.totalDamageDealtToChampions - 8000) / 1200) : 0;
            if (p.assists > 10) dmgImpact += (p.assists - 10) * 1.5;
            break;
    }

    // 3. [추가 완화] 데스 페널티 하향
    // 데스당 감점 폭을 더 줄여서 딜 점수가 데스 감점을 압도하게 만듭니다.
    let deathPenalty = 0;
    if (role === "TOP" || role === "UTILITY") {
        // 탑, 서폿: 데스당 1.5점 (거의 안 깎이는 수준)
        deathPenalty = Math.floor(p.deaths * 1.5);
    } else {
        // 나머지: 데스당 2.5점 (기존 4~6점에서 대폭 하향)
        deathPenalty = Math.floor(p.deaths * 2.5);
    }

    const finalScore = baseScore + visionImpact + dmgImpact + tankingImpact - deathPenalty;

    return {
        score: Math.max(5, Math.min(250, finalScore)),
        breakdown: {
            base: baseScore + tankingImpact,
            vision: visionImpact,
            dmg: dmgImpact,
            deaths: -deathPenalty
        }
    };
}

export async function analyzeSummoner(gameName: string, tagLine: string): Promise<AnalysisResult | null> {
    try {
        const account = await getAccount(gameName, tagLine);
        if (!account) return null;

        const summoner = await getSummonerByPuuid(account.puuid);
        if (!summoner) return null;

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

        await delay(500);
        const matchIds = await getMatchIds(account.puuid, 20);
        const matchesRaw = [];

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

                const allParticipants: SquadMemberPerformance[] = match.info.participants.map((p: any) => {
                    const analysis = calculateContributionScore(p);
                    return {
                        gameName: p.riotIdGameName || p.summonerName,
                        tagLine: p.riotIdTagline || "KR1",
                        score: analysis.score,
                        breakdown: analysis.breakdown,
                        kda: `${p.kills}/${p.deaths}/${p.assists}`,
                        // --- 아이템 데이터 추가 ---
                        item0: p.item0,
                        item1: p.item1,
                        item2: p.item2,
                        item3: p.item3,
                        item4: p.item4,
                        item5: p.item5,
                        item6: p.item6,
                        // -----------------------
                        damage: p.totalDamageDealtToChampions,
                        deaths: p.deaths,
                        gold: p.goldEarned,
                        win: p.win,
                        championName: p.championName,
                        visionScore: p.visionScore
                    };
                });

                const mainAnalysis = calculateContributionScore(participant);

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
                    score: mainAnalysis.score,
                    breakdown: mainAnalysis.breakdown,
                    date: dateStr,
                    tags: [],
                    participants: match.info.participants.map((p: any) => ({
                        gameName: p.riotIdGameName || p.summonerName,
                        tagLine: p.riotIdTagline || "KR1",
                        championName: p.championName
                    })),
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