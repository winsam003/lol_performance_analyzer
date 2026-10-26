import type { AnalyzedMatch } from '@/app/actions/analyze';
import type { SquadAiMember } from '@/app/actions/squadAiAnalyze';

interface AiStatsAccumulator {
  name: string;
  tag: string;
  totalScore: number;
  matchCount: number;
  wins: number;
  deaths: number;
  kills: number;
  assists: number;
  dmg: number;
  gold: number;
  vision: number;
  roleCounts: Record<string, number>;
  championCounts: Record<string, number>;
  metrics: {
    killParticipation: number;
    damagePerMinute: number;
    damageShare: number;
    damageTakenPerMinute: number;
    damageMitigatedPerMinute: number;
    turretDamagePerMinute: number;
    csPerMinute: number;
    ccPerMinute: number;
    healingPerMinute: number;
    shieldingPerMinute: number;
  };
  objectives: {
    dragons: number;
    barons: number;
    heralds: number;
    steals: number;
  };
  breakdown: {
    base: number;
    vision: number;
    dmg: number;
    deaths: number;
  };
}

export function aggregateSquad(
  targetMatches: AnalyzedMatch[],
  squadTargetList: string[],
): SquadAiMember[] {
  const aiStatsMap: Record<string, AiStatsAccumulator> = {};
  targetMatches.forEach((match) => {
    match.allParticipants.forEach((p) => {
      const pFullId = `${p.gameName}#${p.tagLine}`.toUpperCase().replace(/\s/g, '');
      if (squadTargetList.includes(pFullId)) {
        if (!aiStatsMap[pFullId]) {
          aiStatsMap[pFullId] = {
            name: p.gameName,
            tag: p.tagLine,
            totalScore: 0,
            matchCount: 0,
            wins: 0,
            deaths: 0,
            kills: 0,
            assists: 0,
            dmg: 0,
            gold: 0,
            vision: 0,
            roleCounts: {},
            championCounts: {},
            metrics: {
              killParticipation: 0,
              damagePerMinute: 0,
              damageShare: 0,
              damageTakenPerMinute: 0,
              damageMitigatedPerMinute: 0,
              turretDamagePerMinute: 0,
              csPerMinute: 0,
              ccPerMinute: 0,
              healingPerMinute: 0,
              shieldingPerMinute: 0,
            },
            objectives: { dragons: 0, barons: 0, heralds: 0, steals: 0 },
            breakdown: { base: 0, vision: 0, dmg: 0, deaths: 0 },
          };
        }
        aiStatsMap[pFullId].totalScore += p.score;
        aiStatsMap[pFullId].matchCount += 1;
        aiStatsMap[pFullId].wins += p.win ? 1 : 0;
        aiStatsMap[pFullId].deaths += p.deaths;
        const [k, , a] = p.kda.split('/').map(Number);
        aiStatsMap[pFullId].kills += k;
        aiStatsMap[pFullId].assists += a;
        aiStatsMap[pFullId].dmg += p.damage;
        aiStatsMap[pFullId].gold += p.gold;
        aiStatsMap[pFullId].vision += p.visionScore || 0;
        aiStatsMap[pFullId].roleCounts[p.role] = (aiStatsMap[pFullId].roleCounts[p.role] || 0) + 1;
        aiStatsMap[pFullId].championCounts[p.championName] =
          (aiStatsMap[pFullId].championCounts[p.championName] || 0) + 1;
        aiStatsMap[pFullId].metrics.killParticipation += p.metrics.killParticipation;
        aiStatsMap[pFullId].metrics.damagePerMinute += p.metrics.damagePerMinute;
        aiStatsMap[pFullId].metrics.damageShare += p.metrics.damageShare;
        aiStatsMap[pFullId].metrics.damageTakenPerMinute += p.metrics.damageTakenPerMinute;
        aiStatsMap[pFullId].metrics.damageMitigatedPerMinute += p.metrics.damageMitigatedPerMinute;
        aiStatsMap[pFullId].metrics.turretDamagePerMinute += p.metrics.turretDamagePerMinute;
        aiStatsMap[pFullId].metrics.csPerMinute += p.metrics.csPerMinute;
        aiStatsMap[pFullId].metrics.ccPerMinute += p.metrics.ccPerMinute;
        aiStatsMap[pFullId].metrics.healingPerMinute += p.metrics.healingPerMinute;
        aiStatsMap[pFullId].metrics.shieldingPerMinute += p.metrics.shieldingPerMinute;
        aiStatsMap[pFullId].objectives.dragons += p.objectives.dragons;
        aiStatsMap[pFullId].objectives.barons += p.objectives.barons;
        aiStatsMap[pFullId].objectives.heralds += p.objectives.heralds;
        aiStatsMap[pFullId].objectives.steals += p.objectives.steals;
        if (p.breakdown) {
          aiStatsMap[pFullId].breakdown.base += p.breakdown.base;
          aiStatsMap[pFullId].breakdown.vision += p.breakdown.vision;
          aiStatsMap[pFullId].breakdown.dmg += p.breakdown.dmg;
          aiStatsMap[pFullId].breakdown.deaths += p.breakdown.deaths;
        }
      }
    });
  });

  return Object.values(aiStatsMap)
    .map((s) => {
      const primaryRole =
        Object.entries(s.roleCounts).sort(([, countA], [, countB]) => countB - countA)[0]?.[0] ||
        'UNKNOWN';

      return {
        name: s.name,
        tag: s.tag,
        matchCount: s.matchCount,
        wins: s.wins,
        losses: s.matchCount - s.wins,
        primaryRole,
        roleDistribution: s.roleCounts,
        championDistribution: s.championCounts,
        avgScore: Math.round(s.totalScore / s.matchCount),
        avgKDA: `${(s.kills / s.matchCount).toFixed(1)}/${(s.deaths / s.matchCount).toFixed(1)}/${(s.assists / s.matchCount).toFixed(1)}`,
        avgKills: Number((s.kills / s.matchCount).toFixed(1)),
        avgDeaths: Number((s.deaths / s.matchCount).toFixed(1)),
        avgAssists: Number((s.assists / s.matchCount).toFixed(1)),
        avgDamage: Math.round(s.dmg / s.matchCount),
        avgGold: Math.round(s.gold / s.matchCount),
        avgVision: Number((s.vision / s.matchCount).toFixed(1)),
        damageEfficiency: Math.round((s.dmg / (s.gold || 1)) * 100),
        advancedMetrics: {
          killParticipationPercent: Math.round((s.metrics.killParticipation / s.matchCount) * 100),
          damageSharePercent: Math.round((s.metrics.damageShare / s.matchCount) * 100),
          damagePerMinute: Math.round(s.metrics.damagePerMinute / s.matchCount),
          damageTakenPerMinute: Math.round(s.metrics.damageTakenPerMinute / s.matchCount),
          damageMitigatedPerMinute: Math.round(s.metrics.damageMitigatedPerMinute / s.matchCount),
          turretDamagePerMinute: Math.round(s.metrics.turretDamagePerMinute / s.matchCount),
          csPerMinute: Number((s.metrics.csPerMinute / s.matchCount).toFixed(1)),
          ccSecondsPerMinute: Number((s.metrics.ccPerMinute / s.matchCount).toFixed(1)),
          allyHealingPerMinute: Math.round(s.metrics.healingPerMinute / s.matchCount),
          allyShieldingPerMinute: Math.round(s.metrics.shieldingPerMinute / s.matchCount),
        },
        objectivesPerMatch: {
          dragons: Number((s.objectives.dragons / s.matchCount).toFixed(1)),
          barons: Number((s.objectives.barons / s.matchCount).toFixed(1)),
          heralds: Number((s.objectives.heralds / s.matchCount).toFixed(1)),
          steals: Number((s.objectives.steals / s.matchCount).toFixed(1)),
        },
        scoreBreakdown: {
          baseline: Math.round(s.breakdown.base / s.matchCount),
          vision: Math.round(s.breakdown.vision / s.matchCount),
          role: Math.round(s.breakdown.dmg / s.matchCount),
          survival: Math.round(s.breakdown.deaths / s.matchCount),
        },
      };
    })
    .sort((a, b) => b.avgScore - a.avgScore);
}
