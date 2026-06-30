"use server";

import {
    getAccount,
    getLeagueEntries,
    getMatchDetail,
    getMatchIds,
    getSummonerByPuuid,
    LeagueEntry,
    RiotMatchDetail,
} from "@/lib/riot";

export interface MatchParticipant {
    gameName: string;
    tagLine: string;
    championName: string;
}

export interface SquadMemberPerformance {
    gameName: string;
    tagLine: string;
    role: PlayerRole;
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

export type PlayerRole = "TOP" | "JUNGLE" | "MIDDLE" | "BOTTOM" | "UTILITY" | "UNKNOWN";

interface ParticipantChallenges {
    baronTakedowns?: number;
    dragonTakedowns?: number;
    riftHeraldTakedowns?: number;
    objectivesStolen?: number;
}

interface ScoringParticipant {
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
    challenges?: ParticipantChallenges;
}

interface ParticipantMetrics {
    killParticipation: number;
    damagePerMinute: number;
    damageShare: number;
    damagePerGold: number;
    tankingPerMinute: number;
    turretDamagePerMinute: number;
    csPerMinute: number;
    visionPerMinute: number;
    deathsPerMinute: number;
    ccPerMinute: number;
    utilityPerMinute: number;
    objectiveParticipation: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const getPlayerRole = (participant: ScoringParticipant): PlayerRole => {
    const role = participant.teamPosition;
    if (role === "TOP" || role === "JUNGLE" || role === "MIDDLE" || role === "BOTTOM" || role === "UTILITY") {
        return role;
    }
    return "UNKNOWN";
};

const averageMetrics = (metrics: ParticipantMetrics[]): ParticipantMetrics => {
    const keys = Object.keys(metrics[0]) as Array<keyof ParticipantMetrics>;
    return keys.reduce<ParticipantMetrics>((result, key) => {
        result[key] = metrics.reduce((sum, metric) => sum + metric[key], 0) / metrics.length;
        return result;
    }, { ...metrics[0] });
};

const compareMetric = (value: number, reference: number, weight: number, minimumScale: number) => {
    const scale = Math.max((Math.abs(value) + Math.abs(reference)) / 2, minimumScale);
    return clamp((value - reference) / scale, -1, 1) * weight;
};

const getParticipantMetrics = (
    participant: ScoringParticipant,
    participants: ScoringParticipant[],
): ParticipantMetrics => {
    const minutes = Math.max((participant.timePlayed || 1800) / 60, 1);
    const teammates = participants.filter(member => member.teamId === participant.teamId);
    const teamKills = teammates.reduce((sum, member) => sum + member.kills, 0);
    const teamDamage = teammates.reduce((sum, member) => sum + member.totalDamageDealtToChampions, 0);
    const challenges = participant.challenges;

    return {
        killParticipation: teamKills > 0 ? (participant.kills + participant.assists) / teamKills : 0,
        damagePerMinute: participant.totalDamageDealtToChampions / minutes,
        damageShare: teamDamage > 0 ? participant.totalDamageDealtToChampions / teamDamage : 0,
        damagePerGold: participant.totalDamageDealtToChampions / Math.max(participant.goldEarned, 1),
        tankingPerMinute:
            (participant.totalDamageTaken + (participant.damageSelfMitigated || 0) * 0.5) / minutes,
        turretDamagePerMinute: (participant.damageDealtToTurrets || 0) / minutes,
        csPerMinute:
            ((participant.totalMinionsKilled || 0) + (participant.neutralMinionsKilled || 0)) / minutes,
        visionPerMinute: participant.visionScore / minutes,
        deathsPerMinute: participant.deaths / minutes,
        ccPerMinute: (participant.timeCCingOthers ?? participant.totalTimeCCDealt ?? 0) / minutes,
        utilityPerMinute:
            ((participant.totalHealsOnTeammates || 0) +
                (participant.totalDamageShieldedOnTeammates || 0)) /
            minutes,
        objectiveParticipation:
            (challenges?.dragonTakedowns || 0) +
            (challenges?.baronTakedowns || 0) +
            (challenges?.riftHeraldTakedowns || 0) +
            (challenges?.objectivesStolen || 0) * 2,
    };
};

/**
 * 동일 경기의 상대 동일 포지션을 기준으로 기여도를 평가한다.
 * 포지션 정보가 없는 모드는 상대 팀 평균을 기준으로 평가한다.
 */
function calculateContributionScore(
    participant: ScoringParticipant,
    participants: ScoringParticipant[],
) {
    const role = getPlayerRole(participant);
    const metrics = getParticipantMetrics(participant, participants);
    const sameRoleOpponents = participants.filter(
        member => member.teamId !== participant.teamId && getPlayerRole(member) === role,
    );
    const referencePlayers = sameRoleOpponents.length > 0
        ? sameRoleOpponents
        : participants.filter(member => member.teamId !== participant.teamId);
    const reference = averageMetrics(
        referencePlayers.map(member => getParticipantMetrics(member, participants)),
    );

    let baseImpact = compareMetric(metrics.killParticipation, reference.killParticipation, 8, 0.15);
    let visionImpact = 0;
    let damageImpact = 0;

    switch (role) {
        case "TOP":
            damageImpact += compareMetric(metrics.damagePerMinute, reference.damagePerMinute, 8, 100);
            damageImpact += compareMetric(metrics.damageShare, reference.damageShare, 5, 0.05);
            damageImpact += compareMetric(metrics.damagePerGold, reference.damagePerGold, 4, 0.2);
            damageImpact += compareMetric(metrics.tankingPerMinute, reference.tankingPerMinute, 5, 100);
            damageImpact += compareMetric(metrics.turretDamagePerMinute, reference.turretDamagePerMinute, 4, 10);
            damageImpact += compareMetric(metrics.csPerMinute, reference.csPerMinute, 4, 1);
            visionImpact += compareMetric(metrics.visionPerMinute, reference.visionPerMinute, 4, 0.1);
            break;
        case "JUNGLE":
            baseImpact += compareMetric(
                metrics.objectiveParticipation,
                reference.objectiveParticipation,
                10,
                0.5,
            );
            damageImpact += compareMetric(metrics.damagePerMinute, reference.damagePerMinute, 6, 100);
            damageImpact += compareMetric(metrics.damageShare, reference.damageShare, 3, 0.05);
            damageImpact += compareMetric(metrics.damagePerGold, reference.damagePerGold, 3, 0.2);
            damageImpact += compareMetric(metrics.tankingPerMinute, reference.tankingPerMinute, 3, 100);
            damageImpact += compareMetric(metrics.csPerMinute, reference.csPerMinute, 4, 1);
            visionImpact += compareMetric(metrics.visionPerMinute, reference.visionPerMinute, 8, 0.1);
            break;
        case "MIDDLE":
            damageImpact += compareMetric(metrics.damagePerMinute, reference.damagePerMinute, 10, 100);
            damageImpact += compareMetric(metrics.damageShare, reference.damageShare, 6, 0.05);
            damageImpact += compareMetric(metrics.damagePerGold, reference.damagePerGold, 4, 0.2);
            damageImpact += compareMetric(metrics.turretDamagePerMinute, reference.turretDamagePerMinute, 2, 10);
            damageImpact += compareMetric(metrics.csPerMinute, reference.csPerMinute, 4, 1);
            visionImpact += compareMetric(metrics.visionPerMinute, reference.visionPerMinute, 5, 0.1);
            break;
        case "BOTTOM":
            damageImpact += compareMetric(metrics.damagePerMinute, reference.damagePerMinute, 12, 100);
            damageImpact += compareMetric(metrics.damageShare, reference.damageShare, 8, 0.05);
            damageImpact += compareMetric(metrics.damagePerGold, reference.damagePerGold, 6, 0.2);
            damageImpact += compareMetric(metrics.turretDamagePerMinute, reference.turretDamagePerMinute, 3, 10);
            damageImpact += compareMetric(metrics.csPerMinute, reference.csPerMinute, 5, 1);
            visionImpact += compareMetric(metrics.visionPerMinute, reference.visionPerMinute, 3, 0.1);
            break;
        case "UTILITY":
            baseImpact += compareMetric(metrics.ccPerMinute, reference.ccPerMinute, 7, 5);
            baseImpact += compareMetric(metrics.utilityPerMinute, reference.utilityPerMinute, 7, 10);
            damageImpact += compareMetric(metrics.damagePerMinute, reference.damagePerMinute, 3, 50);
            damageImpact += compareMetric(metrics.damageShare, reference.damageShare, 2, 0.03);
            visionImpact += compareMetric(metrics.visionPerMinute, reference.visionPerMinute, 14, 0.1);
            break;
        case "UNKNOWN":
            damageImpact += compareMetric(metrics.damagePerMinute, reference.damagePerMinute, 10, 100);
            damageImpact += compareMetric(metrics.damageShare, reference.damageShare, 8, 0.05);
            damageImpact += compareMetric(metrics.damagePerGold, reference.damagePerGold, 5, 0.2);
            baseImpact += compareMetric(metrics.ccPerMinute, reference.ccPerMinute, 4, 5);
            visionImpact += compareMetric(metrics.visionPerMinute, reference.visionPerMinute, 3, 0.1);
            break;
    }

    const survivalWeight = role === "BOTTOM" || role === "UTILITY" ? 12 : 10;
    const survivalImpact = -compareMetric(
        metrics.deathsPerMinute,
        reference.deathsPerMinute,
        survivalWeight,
        0.05,
    );
    const outcomeImpact = participant.win ? 3 : -3;
    const breakdown = {
        base: Math.round(100 + outcomeImpact + baseImpact),
        vision: Math.round(visionImpact),
        dmg: Math.round(damageImpact),
        deaths: Math.round(survivalImpact),
    };
    const rawScore = breakdown.base + breakdown.vision + breakdown.dmg + breakdown.deaths;
    const score = clamp(rawScore, 40, 160);

    if (score !== rawScore) {
        breakdown.base += score - rawScore;
    }

    return { score, breakdown };
}

export async function analyzeSummoner(gameName: string, tagLine: string): Promise<AnalysisResult | null> {
    try {
        const account = await getAccount(gameName, tagLine);
        if (!account) return null;

        const summoner = await getSummonerByPuuid(account.puuid);
        if (!summoner) return null;

        let leagues: LeagueEntry[] = [];
        try {
            leagues = await getLeagueEntries(account.puuid) || [];
        } catch (lError: unknown) {
            const message = lError instanceof Error ? lError.message : String(lError);
            console.warn(`⚠️ 리그 조회 실패:`, message);
            leagues = [];
        }

        const soloRank = leagues.find(league => league.queueType === "RANKED_SOLO_5x5");
        const flexRank = leagues.find(league => league.queueType === "RANKED_FLEX_SR");
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
        const matchesRaw: Array<RiotMatchDetail | null> = [];

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

        const filteredMatchesRaw = matchesRaw.filter(
            (match): match is RiotMatchDetail => match !== null,
        );

        const analyzedMatches: AnalyzedMatch[] = filteredMatchesRaw
            .filter((m) => m && m.info)
            .map((match) => {
                const participant = match.info.participants.find(p => p.puuid === account.puuid);
                if (!participant) return null;

                const now = Date.now();
                const hoursAgo = Math.floor((now - match.info.gameEndTimestamp) / (1000 * 60 * 60));
                const dateStr = hoursAgo < 24 ? `${hoursAgo}시간 전` : `${Math.floor(hoursAgo / 24)}일 전`;

                const allParticipants: SquadMemberPerformance[] = match.info.participants.map(p => {
                    const analysis = calculateContributionScore(p, match.info.participants);
                    return {
                        gameName: p.riotIdGameName || p.summonerName || "Unknown",
                        tagLine: p.riotIdTagline || "KR1",
                        role: getPlayerRole(p),
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

                const mainAnalysis = calculateContributionScore(participant, match.info.participants);

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
                    participants: match.info.participants.map(p => ({
                        gameName: p.riotIdGameName || p.summonerName || "Unknown",
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
    } catch (error: unknown) {
        console.error("❌ 분석 중 치명적 에러 발생:", error);
        return null;
    }
}
