"use server";

import { getAccount, getLeagueEntries, getMatchDetail, getMatchIds, getSummonerByPuuid } from "@/lib/riot";

export interface AnalyzedMatch {
    id: string; // matchId
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
    tier: string; // "GOLD II"
    lp: number;
    wins: number;
    losses: number;
    winRate: string; // "52%"
}

export interface AnalysisResult {
    profile: SummonerProfile;
    matches: AnalyzedMatch[];
}

export async function analyzeSummoner(gameName: string, tagLine: string): Promise<AnalysisResult | null> {
    try {
        // 1. Get Account (PUUID)
        const account = await getAccount(gameName, tagLine);
        if (!account) throw new Error("Account not found");

        // 2. Get Summoner Info (ID, Level)
        const summoner = await getSummonerByPuuid(account.puuid);
        if (!summoner) throw new Error("Summoner not found");

        // 3. Get League Info (Rank, Winrate)
        const leagues = await getLeagueEntries(summoner.id);
        const soloRank = leagues.find((l) => l.queueType === "RANKED_SOLO_5x5");

        const profile: SummonerProfile = {
            name: account.gameName,
            tag: account.tagLine,
            level: summoner.summonerLevel,
            iconId: summoner.profileIconId,
            tier: soloRank ? `${soloRank.tier} ${soloRank.rank}` : "UNRANKED",
            lp: soloRank ? soloRank.leaguePoints : 0,
            wins: soloRank ? soloRank.wins : 0,
            losses: soloRank ? soloRank.losses : 0,
            winRate: soloRank
                ? Math.round((soloRank.wins / (soloRank.wins + soloRank.losses)) * 100) + "%"
                : "0%",
        };
        console.log(profile)

        // 4. Get Matches
        const matchIds = await getMatchIds(account.puuid, 15); // limit to 15 for speed

        // Parallel Fetching Details
        const matchPromises = matchIds.map((id) => getMatchDetail(id));
        const matchesRaw = await Promise.all(matchPromises);

        // 5. Process Match Data
        const analyzedMatches: AnalyzedMatch[] = matchesRaw
            .filter((m) => m && m.info) // Filter invalid/null matches
            .map((match) => {
                const participant = match.info.participants.find((p: any) => p.puuid === account.puuid);
                if (!participant) return null;

                // Time check
                const now = Date.now();
                const gameEnd = match.info.gameEndTimestamp;
                const hoursAgo = Math.floor((now - gameEnd) / (1000 * 60 * 60));
                const dateStr = hoursAgo < 24 ? `${hoursAgo}시간 전` : `${Math.floor(hoursAgo / 24)}일 전`;

                // Calculate Score (Simple Algo for now)
                // Base: (K+A)/D * 10 + (Dmg/1000) + (Vision * 0.5)
                // Normalize to roughly 0~150 range
                const kdaValue = participant.deaths === 0
                    ? (participant.kills + participant.assists) * 2
                    : (participant.kills + participant.assists) / participant.deaths;

                let score = Math.floor(
                    (kdaValue * 10) +
                    (participant.totalDamageDealtToChampions / 1500) +
                    (participant.visionScore * 1)
                );

                // Cap/Bonus logic
                if (participant.win) score += 20;
                if (score > 160) score = 160;

                // Tags Logic
                const tags: AnalyzedMatch["tags"] = [];
                if (participant.totalDamageDealtToChampions > 30000) {
                    tags.push({ type: "Dmg", label: "딜킹", color: "text-red-400", bg: "bg-red-500/20" });
                }
                if (participant.visionScore > 40) {
                    tags.push({ type: "Vision", label: "시야", color: "text-blue-400", bg: "bg-blue-500/20" });
                }
                if (participant.deaths <= 2) {
                    tags.push({ type: "Survival", label: "생존", color: "text-green-400", bg: "bg-green-500/20" });
                }
                if (participant.pentaKills > 0) {
                    tags.push({ type: "KDA", label: "PENTA", color: "text-yellow-400", bg: "bg-yellow-500/20" });
                }

                return {
                    id: match.metadata.matchId,
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
                    tags: tags,
                    detail: {
                        kills: participant.kills,
                        deaths: participant.deaths,
                        assists: participant.assists,
                        totalDamageDealtToChampions: participant.totalDamageDealtToChampions,
                        visionScore: participant.visionScore
                    }
                };
            })
            .filter((m): m is AnalyzedMatch => m !== null);

        return {
            profile,
            matches: analyzedMatches,
        };
    } catch (error) {
        console.error("Failed to analyze summoner:", error);
        return null;
    }
}
