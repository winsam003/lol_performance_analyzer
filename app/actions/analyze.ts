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
 * 인분 점수 계산 및 상세 내역 반환 로직 (황금 밸런스 패치 완료)
 */
function calculateContributionScore(p: any) {
    // 게임 시간(분) 구하기 (Riot API v5 기준 timePlayed 제공, 없으면 기본 30분)
    const minutes = (p.timePlayed || 1800) / 60;

    // 1. KDA 기반 기본 점수 (최대치 제한으로 킬 먹방러의 점수 뻥튀기 방지)
    const rawKda = p.deaths === 0 ? (p.kills + p.assists) * 1.2 : (p.kills + p.assists) / p.deaths;
    // KDA 효과는 최대 15까지만 적용 (학살해도 무한정 오르지 않음)
    let baseScore = Math.floor(Math.sqrt(Math.min(rawKda, 15)) * 40);
    if (p.win) baseScore += 20;

    // 2. 분당 지표(Per Minute)를 활용한 포지션별 기여도 보정
    const dpm = p.totalDamageDealtToChampions / minutes;       // 분당 딜량
    const vpm = p.visionScore / minutes;                       // 분당 시야점수
    const dtpm = p.totalDamageTaken / minutes;                 // 분당 받은 피해량(탱킹)

    let visionImpact = 0;
    let dmgImpact = 0;
    let tankingImpact = 0;
    let assistImpact = 0;
    const role = p.teamPosition;

    switch (role) {
        case "BOTTOM": // 원딜 (딜 중심)
            // DPM 400부터 점수 상승, 최대 45점 (상한선 도입)
            dmgImpact = Math.min(45, Math.max(0, Math.floor((dpm - 400) / 20)));
            visionImpact = Math.min(10, Math.max(0, Math.floor(vpm * 10)));
            break;

        case "MIDDLE": // 미드 (딜 + 맵 리딩)
            dmgImpact = Math.min(40, Math.max(0, Math.floor((dpm - 350) / 20)));
            visionImpact = Math.min(15, Math.max(0, Math.floor(vpm * 12)));
            break;

        case "TOP": // 탑 (탱킹 + 딜 + 스플릿)
            dmgImpact = Math.min(25, Math.max(0, Math.floor((dpm - 300) / 20)));
            // DTPM(분당 탱킹) 보너스 최대 25점
            tankingImpact = Math.min(25, Math.max(0, Math.floor((dtpm - 600) / 40)));
            visionImpact = Math.min(10, Math.max(0, Math.floor(vpm * 10)));
            break;

        case "JUNGLE": // 정글 (오브젝트, 갱킹, 시야)
            dmgImpact = Math.min(20, Math.max(0, Math.floor((dpm - 250) / 25)));
            tankingImpact = Math.min(15, Math.max(0, Math.floor((dtpm - 500) / 50)));
            visionImpact = Math.min(20, Math.max(0, Math.floor(vpm * 15)));
            // 정글은 킬관여(어시스트) 보너스 추가 (최대 10점)
            assistImpact = Math.min(10, Math.floor(p.assists * 0.8));
            break;

        case "UTILITY": // 서포터 (시야 + 킬관여 중심)
            // VPM 최대 35점 보너스 (서포터의 딜량 상한선을 시야가 대체)
            visionImpact = Math.min(35, Math.max(0, Math.floor((vpm - 1.0) * 14)));
            // 어시스트 보너스 최대 25점
            assistImpact = Math.min(25, Math.floor(p.assists * 1.2));
            dmgImpact = Math.min(10, Math.max(0, Math.floor(dpm / 30)));
            break;
    }

    // 3. 데스 페널티 (트롤링 감별)
    let deathPenalty = 0;
    if (role === "TOP" || role === "UTILITY" || role === "JUNGLE") {
        deathPenalty = Math.floor(p.deaths * 2.0); // 이니시에이터 완화
    } else {
        deathPenalty = Math.floor(p.deaths * 2.5); // 딜러 엄격하게 적용
    }

    // '지나치게 많이 죽은 뇌절' 추가 페널티 (8데스 이상부터 데스당 2점 추가 감점)
    if (p.deaths >= 8) {
        deathPenalty += Math.floor((p.deaths - 7) * 2);
    }

    const finalScore = baseScore + visionImpact + dmgImpact + tankingImpact + assistImpact - deathPenalty;

    return {
        score: Math.max(5, Math.min(250, finalScore)),
        breakdown: {
            base: baseScore + assistImpact, // 어시스트 보너스는 기본 점수에 병합 표시
            vision: visionImpact,
            dmg: dmgImpact + tankingImpact, // 탱킹은 전투 기여도로 딜에 병합 표시
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

        const matchIds = await getMatchIds(account.puuid, 20);
        const matchesRaw = [];

        const chunkSize = 4;

        for (let i = 0; i < matchIds.length; i += chunkSize) {
            const chunk = matchIds.slice(i, i + chunkSize);
            
            const chunkResults = await Promise.all(
                chunk.map(id => getMatchDetail(id))
            );
            
            matchesRaw.push(...chunkResults);

            if (i + chunkSize < matchIds.length) {
                await delay(150);
            }
        }

        const filteredMatchesRaw = matchesRaw.filter(Boolean);

        const analyzedMatches: AnalyzedMatch[] = filteredMatchesRaw
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
                        item0: p.item0,
                        item1: p.item1,
                        item2: p.item2,
                        item3: p.item3,
                        item4: p.item4,
                        item5: p.item5,
                        item6: p.item6,
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