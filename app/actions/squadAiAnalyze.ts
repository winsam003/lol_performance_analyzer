'use server';

import { reuseAiReport, validateAiInput, hasNumericFields } from '@/lib/ai';
import {
  buildSquadPrompt,
  parseSquadReport,
  ROLE_LABELS,
  type SquadFeedbackResult,
} from '@/lib/squad-report';
import {
  FinishReason,
  GoogleGenerativeAI,
  SchemaType,
  type ResponseSchema,
} from '@google/generative-ai';

const API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY || '');

export interface SquadAiMember {
  name: string;
  tag: string;
  matchCount: number;
  wins: number;
  losses: number;
  primaryRole: string;
  roleDistribution: Record<string, number>;
  championDistribution: Record<string, number>;
  avgScore: number;
  avgKDA: string;
  avgKills: number;
  avgDeaths: number;
  avgAssists: number;
  avgDamage: number;
  avgGold: number;
  avgVision: number;
  damageEfficiency: number;
  advancedMetrics: {
    killParticipationPercent: number;
    damageSharePercent: number;
    damagePerMinute: number;
    damageTakenPerMinute: number;
    damageMitigatedPerMinute: number;
    turretDamagePerMinute: number;
    csPerMinute: number;
    ccSecondsPerMinute: number;
    allyHealingPerMinute: number;
    allyShieldingPerMinute: number;
  };
  objectivesPerMatch: {
    dragons: number;
    barons: number;
    heralds: number;
    steals: number;
  };
  scoreBreakdown: {
    baseline: number;
    vision: number;
    role: number;
    survival: number;
  };
}

export interface SquadAiContext {
  matchCount: number;
  mode: 'SUMMONERS_RIFT' | 'ARAM' | 'MIXED' | 'OTHER';
  queueDistribution: Array<{
    queueId: number;
    label: string;
    count: number;
  }>;
}

const REPORT_SCHEMA: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    teamSummary: { type: SchemaType.STRING },
    players: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          playerId: { type: SchemaType.STRING },
          roast: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            minItems: 2,
            maxItems: 2,
          },
        },
        required: ['playerId', 'roast'],
      },
    },
    shareLine: { type: SchemaType.STRING },
  },
  required: ['teamSummary', 'players', 'shareLine'],
};

export async function getSquadAiFeedback(
  members: SquadAiMember[],
  context: SquadAiContext,
): Promise<SquadFeedbackResult> {
  if (!API_KEY) return { error: '시스템 에러: API 키 설정이 필요합니다.' };
  try {
    validateAiInput({ members, context });
    if (
      !Array.isArray(members) ||
      members.length < 1 ||
      members.length > 5 ||
      !context ||
      !Number.isInteger(context.matchCount) ||
      context.matchCount < 1 ||
      context.matchCount > 20
    )
      return { error: '분석 입력을 확인해주세요.' };
    const numericFields = [
      'matchCount',
      'wins',
      'losses',
      'avgScore',
      'avgKills',
      'avgDeaths',
      'avgAssists',
      'avgDamage',
      'avgGold',
      'avgVision',
      'damageEfficiency',
    ];
    if (
      !['SUMMONERS_RIFT', 'ARAM', 'MIXED', 'OTHER'].includes(context.mode) ||
      !Array.isArray(context.queueDistribution) ||
      !context.queueDistribution.every(
        (queue) => hasNumericFields(queue, ['queueId', 'count']) && typeof queue.label === 'string',
      ) ||
      !members.every(
        (member) =>
          member &&
          typeof member.name === 'string' &&
          typeof member.tag === 'string' &&
          typeof member.avgKDA === 'string' &&
          Object.hasOwn(ROLE_LABELS, member.primaryRole) &&
          hasNumericFields(member, numericFields) &&
          member.matchCount === context.matchCount &&
          Number.isInteger(member.wins) &&
          Number.isInteger(member.losses) &&
          member.wins >= 0 &&
          member.losses >= 0 &&
          member.wins + member.losses === member.matchCount &&
          [
            member.roleDistribution,
            member.championDistribution,
            member.advancedMetrics,
            member.objectivesPerMatch,
            member.scoreBreakdown,
          ].every(
            (record) =>
              record &&
              Object.keys(record).length > 0 &&
              hasNumericFields(record, Object.keys(record)),
          ),
      )
    ) {
      return { error: '분석 입력을 확인해주세요.' };
    }
  } catch {
    return { error: '분석 입력을 확인해주세요.' };
  }

  try {
    const prompt = buildSquadPrompt(members, context);
    const raw = await reuseAiReport(prompt, async () => {
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
          temperature: 0.85,
          topP: 0.9,
          maxOutputTokens: 12288,
          responseMimeType: 'application/json',
          responseSchema: REPORT_SCHEMA,
        },
      });
      const result = await model.generateContent(prompt, { timeout: 90_000 });
      if (result.response.candidates?.[0]?.finishReason !== FinishReason.STOP) {
        throw new Error('리포트가 완성되지 않았습니다.');
      }
      const text = result.response.text();
      // Validate before caching: incomplete, duplicate or missing players are retryable.
      parseSquadReport(text, members, context);
      return text;
    });
    return { report: parseSquadReport(raw, members, context) };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('스쿼드 코치 리포트 생성 실패:', message);
    if (message.includes('429') || message.includes('분석 요청이 많습니다'))
      return { error: '분석 요청이 많습니다. 잠시 후 다시 시도해주세요.' };
    return { error: '리포트를 완성하지 못했습니다. 다시 분석해주세요.' };
  }
}
