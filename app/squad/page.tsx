'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Loader2,
  Users,
  Trophy,
  TrendingUp,
  ShieldAlert,
  CheckCircle2,
  Search,
  ArrowLeft,
  Layers,
  User,
  Eye,
  Skull,
  Info,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { analyzeSummoner, AnalysisResult } from '../actions/analyze';
import { getSquadAiFeedback } from '../actions/squadAiAnalyze';
import type { SquadAiContext, SquadAiMember } from '../actions/squadAiAnalyze';
import { Suspense } from 'react';
import Link from 'next/link';
import AdBanner from '@/components/AdBanner';

const QUEUE_TYPES = [
  { id: 'all', label: '전체 매치', icon: <Layers size={14} /> },
  { id: '420', label: '솔랭/듀오', icon: <User size={14} /> },
  { id: '440', label: '자유 랭크', icon: <Users size={14} /> },
];

const SUMMONERS_RIFT_QUEUE_IDS = new Set([400, 420, 430, 440, 490]);

const QUEUE_LABELS: Record<number, string> = {
  400: '일반 드래프트',
  420: '솔로 랭크',
  430: '일반 선택',
  440: '자유 랭크',
  450: '칼바람 나락',
  490: '빠른 대전',
};

interface AiStatsAccumulator {
  name: string;
  tag: string;
  totalScore: number;
  matchCount: number;
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

// 💡 새로 추가된 코치 라인업 상수
const COACH_TYPES = [
  { id: 'basic', label: '기본', emoji: '👕' },
  { id: 'kkoma', label: '김정균 코치', emoji: '👔' },
  { id: 'cvmax', label: '씨맥스 코치', emoji: '🤬' },
  { id: 'hanmoonchul', label: '한문철 변호사', emoji: '⚖️' },
  { id: 'ahn', label: '안정환 감독', emoji: '⚽' },
];

const TITLES = {
  DEATHS: (isBad: boolean) =>
    isBad
      ? {
          title: '적팀의 산타클로스',
          desc: '숨쉬듯 데스를 기록하며 상대의 성장을 주도한 일등공신',
          color: 'red',
        }
      : {
          title: '살신성인 선봉장',
          desc: '팀을 위해 기꺼이 목숨을 던져 한타를 승리로 이끎',
          color: 'orange',
        },
  EFFICIENCY: (isBad: boolean) =>
    isBad
      ? {
          title: '국가부도의 주범',
          desc: '골드는 다 빨아먹고 모기딜을 넣는 기적의 세금 도둑',
          color: 'stone',
        }
      : {
          title: '인간 창조경제',
          desc: '적은 골드로도 팀의 승리를 견인하는 미친 가성비',
          color: 'emerald',
        },
  VISION: (isBad: boolean) =>
    isBad
      ? {
          title: '협곡의 심청이',
          desc: '미니맵 구독을 해지하여 평생 암흑 속에서 게임을 즐김',
          color: 'slate',
        }
      : {
          title: '은밀한 그림자',
          desc: '시야보다는 동물적인 감각과 피지컬로 협곡을 누빔',
          color: 'cyan',
        },
  DAMAGE: (isBad: boolean) =>
    isBad
      ? {
          title: '비폭력 평화주의자',
          desc: '적을 때리는 것을 혐오하여 딜량 그래프가 땅에 처박힘',
          color: 'green',
        }
      : {
          title: '통곡의 벽',
          desc: '딜은 남에게 맡기고 묵묵히 적의 공격을 다 받아낸 든든한 방패',
          color: 'blue',
        },
  SUSPECT: (isBad: boolean) =>
    isBad
      ? {
          title: '🚨 공개 수배자',
          desc: '패배의 핵심 원흉. 상대팀의 6번째 멤버로 활약함',
          color: 'orange',
        }
      : {
          title: '억울한 희생양',
          desc: '지표는 가장 낮지만, 승리를 위해 보이지 않는 곳에서 헌신함',
          color: 'purple',
  },
};

const IDENTITY_TITLE_POOLS = {
  terminal: ['인간 넥서스', '이동식 현상금 ATM', '적팀 복지재단 이사장', '죽음의 회전문 관리자'],
  disaster: ['협곡의 재앙', '패배 지분 최대주주', '팀 골드 긴급재난문자', '15분 서렌 명예홍보대사'],
  god: ['강림한 신(GOD)', '매칭 시스템의 사과문', '혼자 장르가 다른 사람', '승리 외주 독점사업자'],
  lehman: ['협곡의 리먼 브라더스', '딜 효율 상장폐지', '골드 증발 감사위원장', '투자 대비 수익률 실종자'],
  waste: ['폐급 폐기물', '기여도 측정기 오류 원인', '팀 슬롯 무상임대자', '통계청 집계 제외 대상'],
  topTank: ['국가대표 고기방패', '상체 산업재해 방지벽', '탑라인 철근 콘크리트', '한타용 이동식 방음벽'],
  topEfficient: ['강화 대리석 척추', '저비용 고효율 국밥탑', '상체 가성비 심사위원', '탑라인 원가절감 전문가'],
  topSolo: ['고독한 탑신병자', '탑라인 1인 가구', '협곡 북부 독립정부', '지원금 없이 큰 자영업자'],
  topIsland: ['탑 지박령', '텔레포트 미가입 고객', '상체 장기주차 차량', '협곡 북부 자연인'],
  topPaper: ['친환경 종이박스', '한타 전용 완충 포장재', '방어력 무첨가 탑솔러', '맞으면 접히는 폴더블 탑'],
  jungleAssist: ['협곡의 홍길동', '전 라인 출장 서비스', '킬 관여 출장뷔페 사장', '어시스트 유통 총판'],
  jungleCarry: ['스쿼드 실질적 가장', '정글 차이 공식 납품업체', '전 라인 생활비 지급자', '승리 배달 플랫폼 기사'],
  junglePve: ['야생 버섯 채집가', '정글몹 전담 공무원', '갱킹 없는 친환경 정글러', '캠프 순환근무 모범사원'],
  jungleVision: ['바론/용 세콤(SECOM)', '오브젝트 CCTV 관제센터', '강가 방범대 총책임자', '용 앞 주차단속반장'],
  jungleDeath: ['보호구역 멸종위기 백정', '카정 피해 신고센터장', '정글 동선 무료공개자', '적 정글 성장지원 담당관'],
  midValue: ['가성비 권익위원회장', '미드라인 창조경제부 장관', '저예산 고화력 연구소장', '골드 대비 딜량 감사원장'],
  midEmperor: ['황족 미드', '중앙선거 압승 후보', '미드 통행세 징수원', '협곡 중앙정부 대통령'],
  midAccounting: ['KDA 분식회계사', '딜량 장부 누락 담당자', '킬 세탁 전문 세무사', '스코어보드 미화 전문가'],
  midTax: ['세금 포탈 상습범', '미드 지원금 부정수급자', '골드 먹튀 특별관리대상', '딜 납부 장기체납자'],
  midRoad: ['고속도로 프리패스', '미드 1차 개방사업자', '로밍 맛집 공식 지정점', '중앙선 무인 통과 게이트'],
  adcEfficient: ['풀악셀 7성구 기사', '원딜 투자수익률 1위', '평타 복리 투자 전문가', '골드당 화력 최저가 보장'],
  adcCeo: ['대기업 전문 경영인', '후반 캐리 지주회사 회장', '딜량 코스피 시가총액 1위', '원딜 산업단지 대표이사'],
  adcCircus: ['외줄타기 서커스단장', '생존과 딜의 선물거래자', '한타 심박수 총괄책임자', '목숨 담보 풀매수 전문가'],
  adcGlass: ['유리대포 시한폭탄', '보호자 동반 필수 딜러', '클릭 한 번에 파손주의', '생존보험 가입 거절 고객'],
  adcBankrupt: ['국가부도 주범', '원딜 성장예산 유용자', '후반 캐리 납품 지연업체', '골드 블랙홀 운영위원장'],
  supportVision: ['어둠 속의 눈동자', '협곡 CCTV 통합관제실장', '시야정보원 비공식 국장', '부시 조명사업 총괄본부장'],
  supportAssist: ['마더 테레사', '어시스트 무상급식소장', '킬 배달 무료봉사자', '팀원 KDA 복지부 장관'],
  supportKill: ['합법적 강도', '킬 압류 집행관', '원딜 월급 가압류 담당자', '막타 민영화 추진위원장'],
  supportBlind: ['장님 안내견 가출', '와드 구매 선택적 기억상실', '시야석 포장 미개봉 고객', '미니맵 개인정보 보호위원'],
  supportSaving: ['와드 아끼다 집 장만', '제어와드 긴축재정부 장관', '75골드 절약운동 본부장', '시야예산 삭감 전문위원'],
  supportCreator: ['협곡의 창조주', '팀원 가치상승 컨설턴트', '한타 설계 특허 보유자', '캐리 제조업 명장'],
  ace: ['에이스(ACE)', '승리 지분 과점주주', '팀 성적 우량채권', '매칭 성공사례 1호'],
  breadwinner: ['소년가장', '4인 가족 부양책임자', '팀 전력비 대납자', '승점 생계형 노동자'],
  carry: ['승리의 주역', '한타 실적 우수사원', '승리 납품 우수업체', '팀 기여도 모범납세자'],
  wanted: ['지명수배자', '패배 원인 참고인 1호', '리플레이 출석 요구 대상', '감독 면담 우선예약자'],
  mascot: ['행복롤 깍두기', '팀 분위기 전담 인턴', '승패 무관 관광홍보대사', '스쿼드 단체사진 필수인원'],
  value: ['가성비 괴물', '골드 효율 공인중개사', '저예산 캐리 납품업자', '협곡 다이소 명예점장'],
  vision: ['인간 와드', '이동식 미니맵 확장팩', '부시 실명제 추진위원', '협곡 조명공사 현장소장'],
  deaths: ['300원 맛집', '현상금 무한리필 식당', '적팀 성장쿠폰 발급기', '귀환보다 빠른 회색화면'],
  kills: ['학살자', '킬 로그 도배 전문업체', '적팀 화면 흑백화 기사', '300원 수금 대행업자'],
  assists: ['친절한 이웃', '킬 관여 도장깨기 장인', '어시스트 공동구매 총대', '팀 KDA 품앗이 회장'],
  citizen: ['평범한 시민', '협곡 중산층 직장인', '정시 출근 정시 퇴근형', '무난함 품질인증 통과자'],
} as const;

type IdentityTitleKey = keyof typeof IDENTITY_TITLE_POOLS;

interface IdentityStats {
  name: string;
  tag: string;
  avgScore: number;
  avgKills: string;
  avgDeaths: string;
  avgAssists: string;
  avgVision: string;
  efficiency: number;
  role: string;
}

const pickIdentityTitle = (key: IdentityTitleKey, member: IdentityStats) => {
  const seed = [
    member.name,
    member.tag,
    member.avgScore,
    member.avgKills,
    member.avgDeaths,
    member.avgAssists,
    member.avgVision,
    member.efficiency,
    key,
  ].join(':');
  const hash = Array.from(seed).reduce((value, character) => {
    return (value * 31 + character.charCodeAt(0)) >>> 0;
  }, 0);
  const titles = IDENTITY_TITLE_POOLS[key];

  return titles[hash % titles.length];
};

function SquadAnalysisContent() {
  const searchParams = useSearchParams();
  const summonerParam = searchParams.get('summoner') || '';
  const squadParam = searchParams.get('squad') || '';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<AnalysisResult | null>(null);
  const [selectedQueue, setSelectedQueue] = useState('all');

  // 💡 선택된 코치 성향 상태 (기본값은 kkOma 스타일)
  const [selectedCoach, setSelectedCoach] = useState('basic');

  const [aiReport, setAiReport] = useState<string>('');
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);

  const [selectedMatchIds, setSelectedMatchIds] = useState<Set<string>>(new Set());

  const squadTargetList = useMemo(() => {
    const squad = squadParam ? squadParam.split(',') : [];
    return [summonerParam, ...squad].filter(Boolean).map((m) => m.toUpperCase().replace(/\s/g, ''));
  }, [summonerParam, squadParam]);

  const fetchSquadData = useCallback(
    async (isRefresh = false) => {
      if (!summonerParam) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const [name, tag] = summonerParam.split('#');
        const result = await analyzeSummoner(name, tag);
        setData(result);
        setAiReport('');
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [summonerParam],
  );

  useEffect(() => {
    fetchSquadData();
  }, [fetchSquadData]);

  const commonMatches = useMemo(() => {
    if (!data) return [];
    return data.matches.filter((match) => {
      const matchQueueId = (match as any).queueId?.toString();
      const isCorrectQueue = selectedQueue === 'all' || matchQueueId === selectedQueue;
      if (!isCorrectQueue) return false;

      const matchParticipantIds = match.allParticipants.map((p) =>
        `${p.gameName}#${p.tagLine}`.toUpperCase().replace(/\s/g, ''),
      );
      return squadTargetList.every((targetId) => matchParticipantIds.includes(targetId));
    });
  }, [data, squadTargetList, selectedQueue]);

  useEffect(() => {
    setSelectedMatchIds(new Set(commonMatches.map((m) => m.id)));
  }, [commonMatches]);

  const filteredHierarchy = useMemo(() => {
    if (commonMatches.length === 0) return [];
    const statsMap: Record<string, any> = {};

    commonMatches.forEach((match) => {
      match.allParticipants.forEach((p) => {
        const pFullId = `${p.gameName}#${p.tagLine}`.toUpperCase().replace(/\s/g, '');
        if (squadTargetList.includes(pFullId)) {
          if (!statsMap[pFullId]) {
            statsMap[pFullId] = {
              name: p.gameName,
              tag: p.tagLine,
              totalScore: 0,
              matchCount: 0,
              deaths: 0,
              kills: 0,
              assists: 0,
              dmg: 0,
              gold: 0,
              vision: 0,
              role: (p as any).role || (p as any).teamPosition || '',
              breakdown: { base: 0, vision: 0, dmg: 0, deaths: 0 },
            };
          }

          statsMap[pFullId].totalScore += p.score;
          statsMap[pFullId].matchCount += 1;
          statsMap[pFullId].deaths += p.deaths;
          const [k, , a] = p.kda.split('/').map(Number);
          statsMap[pFullId].kills += k;
          statsMap[pFullId].assists += a;
          statsMap[pFullId].dmg += p.damage;
          statsMap[pFullId].gold += p.gold;
          statsMap[pFullId].vision += (p as any).visionScore || 0;

          if (p.breakdown) {
            statsMap[pFullId].breakdown.base += p.breakdown.base;
            statsMap[pFullId].breakdown.vision += p.breakdown.vision;
            statsMap[pFullId].breakdown.dmg += p.breakdown.dmg;
            statsMap[pFullId].breakdown.deaths += p.breakdown.deaths;
          }
        }
      });
    });

    const result = Object.values(statsMap).map((s: any) => ({
      ...s,
      avgScore: Math.floor(s.totalScore / s.matchCount),
      avgKDA: `${(s.kills / s.matchCount).toFixed(1)}/${(s.deaths / s.matchCount).toFixed(1)}/${(s.assists / s.matchCount).toFixed(1)}`,
      avgKills: (s.kills / s.matchCount).toFixed(1),
      avgAssists: (s.assists / s.matchCount).toFixed(1),
      avgDmg: Math.floor(s.dmg / s.matchCount),
      avgVision: (s.vision / s.matchCount).toFixed(1),
      efficiency: Math.floor((s.dmg / (s.gold || 1)) * 100),
      avgDeaths: (s.deaths / s.matchCount).toFixed(1),
    }));

    return result.sort((a, b) => b.avgScore - a.avgScore);
  }, [commonMatches, squadTargetList]);

  const handleAiAnalysis = async () => {
    const targetMatches = commonMatches.filter((m) => selectedMatchIds.has(m.id));

    if (targetMatches.length === 0) {
      alert('AI 분석을 진행할 매치를 최소 1개 이상 선택해주세요.');
      return;
    }

    setIsAiAnalyzing(true);

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
          aiStatsMap[pFullId].deaths += p.deaths;
          const [k, , a] = p.kda.split('/').map(Number);
          aiStatsMap[pFullId].kills += k;
          aiStatsMap[pFullId].assists += a;
          aiStatsMap[pFullId].dmg += p.damage;
          aiStatsMap[pFullId].gold += p.gold;
          aiStatsMap[pFullId].vision += p.visionScore || 0;
          aiStatsMap[pFullId].roleCounts[p.role] =
            (aiStatsMap[pFullId].roleCounts[p.role] || 0) + 1;
          aiStatsMap[pFullId].championCounts[p.championName] =
            (aiStatsMap[pFullId].championCounts[p.championName] || 0) + 1;
          aiStatsMap[pFullId].metrics.killParticipation += p.metrics.killParticipation;
          aiStatsMap[pFullId].metrics.damagePerMinute += p.metrics.damagePerMinute;
          aiStatsMap[pFullId].metrics.damageShare += p.metrics.damageShare;
          aiStatsMap[pFullId].metrics.damageTakenPerMinute += p.metrics.damageTakenPerMinute;
          aiStatsMap[pFullId].metrics.damageMitigatedPerMinute +=
            p.metrics.damageMitigatedPerMinute;
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

    const aiHierarchy: SquadAiMember[] = Object.values(aiStatsMap)
      .map((s) => {
        const primaryRole = Object.entries(s.roleCounts)
          .sort(([, countA], [, countB]) => countB - countA)[0]?.[0] || 'UNKNOWN';

        return {
          name: s.name,
          tag: s.tag,
          matchCount: s.matchCount,
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
            killParticipationPercent: Math.round(
              (s.metrics.killParticipation / s.matchCount) * 100,
            ),
            damageSharePercent: Math.round((s.metrics.damageShare / s.matchCount) * 100),
            damagePerMinute: Math.round(s.metrics.damagePerMinute / s.matchCount),
            damageTakenPerMinute: Math.round(s.metrics.damageTakenPerMinute / s.matchCount),
            damageMitigatedPerMinute: Math.round(
              s.metrics.damageMitigatedPerMinute / s.matchCount,
            ),
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

    const queueCounts = targetMatches.reduce<Map<number, number>>((counts, match) => {
      counts.set(match.queueId, (counts.get(match.queueId) || 0) + 1);
      return counts;
    }, new Map());
    const queueDistribution = Array.from(queueCounts.entries()).map(([queueId, count]) => ({
      queueId,
      label: QUEUE_LABELS[queueId] || `기타 큐(${queueId})`,
      count,
    }));
    const detectedModes = new Set(
      targetMatches.map((match) => {
        if (match.queueId === 450) return 'ARAM';
        if (SUMMONERS_RIFT_QUEUE_IDS.has(match.queueId)) return 'SUMMONERS_RIFT';
        return 'OTHER';
      }),
    );
    const context: SquadAiContext = {
      matchCount: targetMatches.length,
      mode: detectedModes.size === 1
        ? Array.from(detectedModes)[0] as SquadAiContext['mode']
        : 'MIXED',
      queueDistribution,
    };

    try {
      const report = await getSquadAiFeedback(aiHierarchy, context, selectedCoach);
      setAiReport(report);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  const getIdentity = (m: IdentityStats, idx: number, total: number) => {
    const k = Number(m.avgKills);
    const d = Number(m.avgDeaths);
    const a = Number(m.avgAssists);
    const v = Number(m.avgVision);
    const eff = Number(m.efficiency);
    const score = Number(m.avgScore);
    const r = (m.role || '').toUpperCase();

    const isTop = r.includes('TOP');
    const isJng = r.includes('JNG') || r.includes('JUNGLE');
    const isMid = r.includes('MID') || r.includes('MIDDLE');
    const isAdc = r.includes('ADC') || r.includes('BOTTOM');
    const isSup = r.includes('SUP') || r.includes('UTILITY');

    const identity = (key: IdentityTitleKey, color: string) => ({
      label: pickIdentityTitle(key, m),
      color,
    });

    if (d >= 12) return identity('terminal', 'bg-red-950');
    if (d >= 9 && score < 80) return identity('disaster', 'bg-red-900');
    if (idx === 0 && score >= 150) return identity('god', 'bg-purple-600');
    if (eff < 30) return identity('lehman', 'bg-stone-800');
    if (idx === total - 1 && score < 60) return identity('waste', 'bg-red-800');

    if (isTop) {
      if (score >= 120 && eff > 100) return identity('topTank', 'bg-blue-700');
      if (eff > 110 && d < 5) return identity('topEfficient', 'bg-emerald-600');
      if (a <= 3 && score >= 100) return identity('topSolo', 'bg-slate-700');
      if (k + a <= 4 && score < 90) return identity('topIsland', 'bg-stone-700');
      if (d >= 8) return identity('topPaper', 'bg-orange-700');
    } else if (isJng) {
      if (a >= 12 && score >= 110) return identity('jungleAssist', 'bg-sky-600');
      if (k >= 8 && score >= 120) return identity('jungleCarry', 'bg-emerald-500');
      if (eff < 60 && a < 5) return identity('junglePve', 'bg-green-800');
      if (v >= 30) return identity('jungleVision', 'bg-cyan-700');
      if (d >= 7) return identity('jungleDeath', 'bg-stone-600');
    } else if (isMid) {
      if (eff >= 140 && score >= 110)
        return identity('midValue', 'bg-emerald-500');
      if (k >= 10 && score >= 120) return identity('midEmperor', 'bg-purple-500');
      if (k > 5 && eff < 70) return identity('midAccounting', 'bg-rose-700');
      if (eff < 60 && score < 90) return identity('midTax', 'bg-orange-600');
      if (d >= 8) return identity('midRoad', 'bg-red-700');
    } else if (isAdc) {
      if (eff >= 130 && score >= 120) return identity('adcEfficient', 'bg-sky-500');
      if (k >= 12) return identity('adcCeo', 'bg-emerald-600');
      if (d >= 8 && k >= 8) return identity('adcCircus', 'bg-rose-600');
      if (d >= 8) return identity('adcGlass', 'bg-red-600');
      if (eff < 60 && score < 90) return identity('adcBankrupt', 'bg-stone-700');
    } else if (isSup) {
      if (v >= 40 && score >= 110) return identity('supportVision', 'bg-cyan-600');
      if (a >= 20) return identity('supportAssist', 'bg-yellow-600');
      if (k >= 6 && a < 10) return identity('supportKill', 'bg-rose-700');
      if (v < 15 && score < 90) return identity('supportBlind', 'bg-slate-800');
      if (v < 25) return identity('supportSaving', 'bg-stone-600');
      if (score >= 120) return identity('supportCreator', 'bg-purple-500');
    }

    if (idx === 0 && score >= 115) return identity('ace', 'bg-blue-600');
    if (idx === 0) return identity('breadwinner', 'bg-sky-700');
    if (score >= 120) return identity('carry', 'bg-blue-500');
    if (idx === total - 1 && score < 85) return identity('wanted', 'bg-red-600');
    if (idx === total - 1) return identity('mascot', 'bg-orange-500');
    if (eff >= 120) return identity('value', 'bg-emerald-500');
    if (v >= 35) return identity('vision', 'bg-cyan-600');
    if (d >= 8) return identity('deaths', 'bg-red-600');
    if (k >= 10) return identity('kills', 'bg-rose-600');
    if (a >= 15) return identity('assists', 'bg-yellow-600');

    return identity('citizen', 'bg-slate-700');
  };

  if (loading)
    return (
      <main className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center text-white">
        <Loader2 className="animate-spin text-blue-500 mb-6" size={60} />
        <h2 className="text-2xl font-black italic animate-pulse">SQUAD SUSPECT SCANNING...</h2>
      </main>
    );

  return (
    <main className="min-h-screen bg-[#060606] text-slate-200 pb-20 font-sans">
      <div className="bg-gradient-to-b from-blue-900/10 to-transparent border-b border-white/5 py-16">
        <div className="container mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-4 mb-8 mx-auto relative z-30 flex-wrap">
            {/* 큐 타입 선택 UI */}
            <div className="flex bg-[#111] p-1 rounded-xl border border-white/5 w-fit">
              {QUEUE_TYPES.map((q) => (
                <button
                  key={q.id}
                  onClick={() => setSelectedQueue(q.id)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all',
                    selectedQueue === q.id
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-500 hover:text-slate-300',
                  )}
                >
                  {q.icon} {q.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => fetchSquadData(true)}
              disabled={refreshing}
              className="bg-white/5 hover:bg-white/10 border border-white/5 p-3 rounded-xl transition-all disabled:opacity-50 group"
            >
              <RefreshCw
                size={18}
                className={cn('text-blue-500 transition-all', refreshing && 'animate-spin')}
              />
            </button>
          </div>

          {commonMatches.length > 0 ? (
            <>
              <div className="flex items-center justify-center gap-2 text-blue-500 font-bold mb-4 bg-blue-500/10 px-4 py-1 rounded-full border border-blue-500/20 text-xs tracking-tighter uppercase w-fit mx-auto">
                <CheckCircle2 size={14} /> Full Squad Match: {commonMatches.length} Games
              </div>
              <h1 className="text-5xl md:text-7xl font-black italic tracking-tighter text-white mb-12 uppercase">
                SQUAD <span className="text-blue-500">HIERARCHY</span>
              </h1>
              {/* 💡 [수정 구역 2] 코치 성향 선택 UI 추가 */}
              <div className="flex bg-[#111] p-1 rounded-xl border border-white/5 w-fit mx-auto mb-8">
                {COACH_TYPES.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCoach(c.id)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all',
                      selectedCoach === c.id
                        ? 'bg-purple-600 text-white'
                        : 'text-slate-500 hover:text-slate-300',
                    )}
                  >
                    <span className="text-sm">{c.emoji}</span> {c.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-col items-center mb-12">
                <button
                  onClick={handleAiAnalysis}
                  disabled={
                    isAiAnalyzing || commonMatches.length === 0 || selectedMatchIds.size === 0
                  }
                  className="group relative px-10 py-4 bg-[#111] border border-blue-500/30 rounded-2xl font-black italic uppercase tracking-tighter text-white hover:bg-blue-600 transition-all disabled:opacity-50 overflow-hidden shadow-[0_0_20px_rgba(59,130,246,0.2)]"
                >
                  <div className="relative z-10 flex items-center gap-3">
                    {isAiAnalyzing ? (
                      <>
                        <RefreshCw className="animate-spin text-blue-400" size={20} />
                        <span>분석 중...</span>
                      </>
                    ) : (
                      <>
                        <TrendingUp className="text-blue-500 group-hover:text-white" size={20} />
                        <span>
                          AI 스쿼드 리포트 ({COACH_TYPES.find((c) => c.id === selectedCoach)?.emoji}
                          )
                        </span>
                      </>
                    )}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600/0 via-blue-600/10 to-blue-600/0 transform translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                </button>
                <div className="w-full flex flex-col items-center py-12 my-4 border-y border-white/[0.03] bg-white/[0.01]">
                  <div className="relative min-h-[250px] w-full flex justify-center items-center overflow-hidden">
                    <AdBanner unitId="DAN-kPapG5XifUmSgwJo" width="300" height="250" />
                  </div>
                </div>
                {aiReport && (
                  <div className="mt-8 w-full max-w-4xl p-8 bg-[#0a0a0a] border border-blue-500/20 rounded-[2.5rem] shadow-2xl animate-in slide-in-from-top-4 duration-500 relative overflow-hidden text-left">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                      <ShieldAlert size={120} />
                    </div>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-1.5 h-6 bg-blue-500 rounded-full"></div>
                      <h2 className="text-xl font-black italic text-white tracking-widest uppercase text-left">
                        Squad Strategy Report
                      </h2>
                    </div>
                    <p className="text-slate-300 leading-relaxed whitespace-pre-wrap font-medium text-sm md:text-base">
                      {aiReport}
                    </p>
                    <div className="mt-6 pt-4 border-t border-white/5 flex justify-end">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 italic">
                        AI Strategic Analysis System v2.5
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 max-w-7xl mx-auto">
                <SquadCard
                  title="팀의 심장"
                  member={filteredHierarchy[0]}
                  color="blue"
                  description="평균 인분 점수 1위"
                />
                <SquadCard
                  title="가성비 괴물"
                  member={[...filteredHierarchy].sort((a, b) => b.efficiency - a.efficiency)[0]}
                  color="emerald"
                  subText={`효율 ${[...filteredHierarchy].sort((a, b) => b.efficiency - a.efficiency)[0]?.efficiency}%`}
                  description="적은 골드로 엄청난 딜을 뽑아내는 효율 깡패"
                />
                <SquadCard
                  title="학살자"
                  member={
                    [...filteredHierarchy].sort(
                      (a, b) => Number(b.avgKills) - Number(a.avgKills),
                    )[0]
                  }
                  color="rose"
                  subText={`평균 ${[...filteredHierarchy].sort((a, b) => Number(b.avgKills) - Number(a.avgKills))[0]?.avgKills}킬`}
                  description="킬 결정력이 가장 높은 핵심 공격수"
                />
                <SquadCard
                  title="마더 테레사"
                  member={
                    [...filteredHierarchy].sort(
                      (a, b) => Number(b.avgAssists) - Number(a.avgAssists),
                    )[0]
                  }
                  color="yellow"
                  subText={`평균 ${[...filteredHierarchy].sort((a, b) => Number(b.avgAssists) - Number(a.avgAssists))[0]?.avgAssists}어시`}
                  description="아군을 돕는 데 가장 헌신적인 멤버"
                />
                <SquadCard
                  title="협곡 등대"
                  member={
                    [...filteredHierarchy].sort(
                      (a, b) => Number(b.avgVision) - Number(a.avgVision),
                    )[0]
                  }
                  color="cyan"
                  isVision
                  description="시야 장악으로 팀의 생존을 책임짐"
                />

                {(() => {
                  const isBad = (m: any) => m.avgScore < 90;
                  const worstDeath = [...filteredHierarchy].sort(
                    (a, b) => Number(b.avgDeaths) - Number(a.avgDeaths),
                  )[0];
                  const tDeath = TITLES.DEATHS(isBad(worstDeath));
                  const worstEff = [...filteredHierarchy].sort(
                    (a, b) => a.efficiency - b.efficiency,
                  )[0];
                  const tEff = TITLES.EFFICIENCY(isBad(worstEff));
                  const worstVision = [...filteredHierarchy].sort(
                    (a, b) => Number(a.avgVision) - Number(b.avgVision),
                  )[0];
                  const tVision = TITLES.VISION(isBad(worstVision));
                  const worstDmg = [...filteredHierarchy].sort((a, b) => a.avgDmg - b.avgDmg)[0];
                  const tDmg = TITLES.DAMAGE(isBad(worstDmg));
                  const worstScore = filteredHierarchy[filteredHierarchy.length - 1];
                  const tScore = TITLES.SUSPECT(isBad(worstScore));

                  return (
                    <>
                      <SquadCard
                        title={tDeath.title}
                        member={worstDeath}
                        color={tDeath.color}
                        description={tDeath.desc}
                        subText={`평균 ${worstDeath?.avgDeaths}데스`}
                      />
                      <SquadCard
                        title={tEff.title}
                        member={worstEff}
                        color={tEff.color}
                        description={tEff.desc}
                        subText={`딜 효율 ${worstEff?.efficiency}%`}
                      />
                      <SquadCard
                        title={tVision.title}
                        member={worstVision}
                        color={tVision.color}
                        description={tVision.desc}
                        subText={`시야 ${worstVision?.avgVision}점`}
                      />
                      <SquadCard
                        title={tDmg.title}
                        member={worstDmg}
                        color={tDmg.color}
                        description={tDmg.desc}
                        subText={`평균 딜 ${worstDmg?.avgDmg.toLocaleString()}`}
                      />
                      <SquadCard
                        title={tScore.title}
                        member={worstScore}
                        color={tScore.color}
                        description={tScore.desc}
                        subText="최종 평가"
                      />
                    </>
                  );
                })()}
              </div>
            </>
          ) : (
            <div className="py-20 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
              <Search size={64} className="text-slate-800 mb-6" />
              <h2 className="text-3xl font-black italic text-slate-500 mb-2 uppercase">
                NO DATA FOUND
              </h2>
              <p className="text-slate-600 font-bold">
                해당 큐 타입으로 함께 플레이한 매치가 없습니다.
              </p>
            </div>
          )}
        </div>
      </div>

      {commonMatches.length > 0 && (
        <>
          <div className="container mx-auto px-6 -mt-10 relative z-20 mb-20">
            <div className="bg-[#111] border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/5 text-[10px] font-black uppercase tracking-widest text-slate-500">
                    <th className="px-8 py-5">순위</th>
                    <th className="px-8 py-5">멤버</th>
                    <th className="px-8 py-5">게임당 평균 스탯</th>
                    <th className="px-8 py-5 text-center">평균 인분 점수</th>
                    <th className="px-8 py-5 text-right">정체성</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredHierarchy.map((m, idx) => {
                    const iden = getIdentity(m, idx, filteredHierarchy.length);
                    return (
                      <tr key={idx} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="px-8 py-6 font-black italic text-xl text-slate-700 group-hover:text-blue-500">
                          #{idx + 1}
                        </td>
                        <td className="px-8 py-6 font-bold text-white">
                          {m.name}{' '}
                          <span className="text-[10px] text-slate-600 font-mono ml-1">
                            #{m.tag}
                          </span>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex gap-6 items-center">
                            <div className="flex flex-col">
                              <span className="text-[10px] text-slate-500 uppercase font-bold">
                                KDA
                              </span>
                              <span className="text-xs text-slate-300 font-mono">{m.avgKDA}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[10px] text-slate-500 uppercase font-bold">
                                평균딜량
                              </span>
                              <span className="text-xs text-slate-300 font-mono">
                                {m.avgDmg.toLocaleString()}
                              </span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[10px] text-slate-500 uppercase font-bold text-blue-400">
                                시야점수
                              </span>
                              <span className="text-xs text-blue-200 font-mono">{m.avgVision}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6 text-center">
                          <div className="flex flex-col items-center">
                            <span
                              className={cn(
                                'text-2xl font-black italic',
                                idx === 0 ? 'text-blue-500' : 'text-slate-400',
                              )}
                            >
                              {m.avgScore}
                            </span>
                            {m.breakdown && (
                              <div className="text-[9px] text-slate-500 font-mono mt-1 flex gap-1 bg-white/5 px-2 py-0.5 rounded-full">
                                <span className="text-slate-400">
                                  기준 {Math.round(m.breakdown.base / m.matchCount)}
                                </span>
                                <span
                                  className={
                                    m.breakdown.vision >= 0 ? 'text-blue-400' : 'text-red-400'
                                  }
                                >
                                  {m.breakdown.vision >= 0 ? '+' : ''}
                                  {Math.round(m.breakdown.vision / m.matchCount)}시야
                                </span>
                                <span
                                  className={
                                    m.breakdown.dmg >= 0 ? 'text-emerald-400' : 'text-red-400'
                                  }
                                >
                                  {m.breakdown.dmg >= 0 ? '+' : ''}
                                  {Math.round(m.breakdown.dmg / m.matchCount)}역할
                                </span>
                                <span
                                  className={
                                    m.breakdown.deaths >= 0 ? 'text-emerald-400' : 'text-red-400'
                                  }
                                >
                                  {m.breakdown.deaths >= 0 ? '+' : ''}
                                  {Math.round(m.breakdown.deaths / m.matchCount)}생존
                                </span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <span
                            className={cn(
                              'text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-tighter text-white',
                              iden.color,
                            )}
                          >
                            {iden.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div className="w-full flex flex-col items-center py-12 my-4 border-y border-white/[0.03] bg-white/[0.01]">
            <div className="relative min-h-[250px] w-full flex justify-center items-center overflow-hidden">
              <AdBanner unitId="DAN-me3iQo7eaz8bwxv2" width="300" height="250" />
            </div>
          </div>
          <div className="container mx-auto px-6 pb-20">
            <div className="flex flex-col gap-6 max-w-6xl mx-auto">
              {commonMatches.map((match) => {
                const squadPerformances = match.allParticipants
                  .filter((p) =>
                    squadTargetList.includes(
                      `${p.gameName}#${p.tagLine}`.toUpperCase().replace(/\s/g, ''),
                    ),
                  )
                  .sort((a, b) => a.score - b.score);

                const lowestScore = squadPerformances[0]?.score;
                const highestScore = squadPerformances[squadPerformances.length - 1]?.score;
                const hasSuspect = lowestScore < 85 && highestScore - lowestScore >= 30;
                const suspectId = hasSuspect
                  ? `${squadPerformances[0].gameName}#${squadPerformances[0].tagLine}`
                  : null;

                return (
                  <div
                    key={match.id}
                    className={cn(
                      'relative border rounded-2xl overflow-hidden transition-all',
                      match.result === 'WIN'
                        ? 'bg-[#111] border-blue-500/10 hover:border-blue-500/30'
                        : 'bg-red-500/5 border-red-500/10 hover:border-red-500/30',
                    )}
                  >
                    <div
                      className={cn(
                        'px-6 py-2 flex justify-between items-center border-b border-white/5',
                        match.result === 'WIN' ? 'bg-blue-500/10' : 'bg-red-500/10',
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <input
                          type="checkbox"
                          className="w-4 h-4 cursor-pointer accent-blue-500"
                          checked={selectedMatchIds.has(match.id)}
                          onChange={() => {
                            setSelectedMatchIds((prev) => {
                              const newSet = new Set(prev);
                              if (newSet.has(match.id)) newSet.delete(match.id);
                              else newSet.add(match.id);
                              return newSet;
                            });
                          }}
                        />
                        <span
                          className={cn(
                            'font-black italic text-sm',
                            match.result === 'WIN' ? 'text-blue-400' : 'text-red-400',
                          )}
                        >
                          {match.result === 'WIN' ? 'VICTORY' : 'DEFEAT'}
                        </span>
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                          {match.date}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest italic ml-4">
                        Squad Performance Report
                      </div>
                    </div>

                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                      {squadPerformances.map((p, i) => {
                        const isSuspect = suspectId === `${p.gameName}#${p.tagLine}`;
                        return (
                          <div
                            key={i}
                            className={cn(
                              'bg-white/5 rounded-xl p-4 border transition-all relative overflow-hidden',
                              isSuspect
                                ? 'border-orange-500/50 bg-orange-500/5 shadow-[inset_0_0_20px_rgba(249,115,22,0.1)]'
                                : 'border-white/5',
                            )}
                          >
                            {isSuspect && (
                              <Skull
                                className="absolute -right-2 -bottom-2 text-orange-500/10"
                                size={60}
                              />
                            )}
                            <div className="flex items-center gap-3 mb-3 relative z-10">
                              <div className="relative shrink-0">
                                <img
                                  src={`https://ddragon.leagueoflegends.com/cdn/16.3.1/img/champion/${p.championName}.png`}
                                  className={cn(
                                    'w-10 h-10 rounded-lg border',
                                    isSuspect ? 'border-orange-500' : 'border-white/10',
                                  )}
                                  alt={p.championName}
                                />
                                <div
                                  className={cn(
                                    'absolute -top-1 -right-1 text-[8px] font-black px-1 rounded italic text-white shadow-lg',
                                    isSuspect ? 'bg-orange-600' : 'bg-blue-600',
                                  )}
                                >
                                  {p.score}
                                </div>
                              </div>
                              <div className="min-w-0">
                                <div
                                  className={cn(
                                    'text-xs font-black truncate',
                                    isSuspect ? 'text-orange-400' : 'text-white',
                                  )}
                                >
                                  {p.gameName}
                                </div>
                                <div className="text-[9px] text-slate-500 font-bold uppercase truncate">
                                  {(p as any).role || ''} {p.championName}
                                </div>
                              </div>
                            </div>
                            <div className="space-y-2 pt-2 border-t border-white/5 relative z-10">
                              <div className="flex justify-between items-center">
                                <span className="text-[9px] text-slate-500 font-bold uppercase">
                                  KDA
                                </span>
                                <span className="text-[10px] text-slate-300 font-mono font-bold">
                                  {p.kda}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-[9px] text-slate-500 font-bold uppercase flex items-center gap-1">
                                  <Eye size={10} /> Vision
                                </span>
                                <span className="text-[10px] text-blue-400 font-mono font-bold">
                                  {p.visionScore || 0}
                                </span>
                              </div>
                            </div>
                            <div className="mt-3 relative z-10">
                              <span
                                className={cn(
                                  'text-[8px] px-2 py-0.5 rounded-full font-black uppercase block text-center truncate shadow-sm',
                                  isSuspect
                                    ? 'bg-orange-600 text-white animate-bounce'
                                    : p.score >= 150
                                      ? 'bg-purple-600 text-white'
                                      : p.score >= 135
                                        ? 'bg-red-600 text-white'
                                        : p.score >= 115
                                          ? 'bg-blue-600 text-white'
                                          : p.score >= 95
                                            ? 'bg-emerald-600 text-white'
                                            : p.score >= 75
                                              ? 'bg-slate-600 text-white'
                                              : 'bg-stone-800 text-slate-400',
                                )}
                              >
                                {isSuspect
                                  ? '🚨 이 판의 확정 범인'
                                  : p.score >= 150
                                    ? '👑 협곡의 지배자'
                                    : p.score >= 135
                                      ? '🔥 멱살 하드캐리'
                                      : p.score >= 115
                                        ? '⭐ 빛나는 에이스'
                                        : p.score >= 95
                                          ? '👍 든든한 1인분'
                                          : p.score >= 75
                                            ? '🚌 무임승차 승객'
                                            : '💸 구제불능 세금도둑'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </main>
  );
}

function SquadCard({ title, member, color, isVision, subText, description }: any) {
  const colorConfigs: Record<string, string> = {
    blue: 'text-blue-500 border-blue-500/30 shadow-[0_0_20px_-12px_rgba(59,130,246,0.3)]',
    red: 'text-red-500 border-red-500/50 shadow-[0_0_30px_-10px_rgba(239,68,68,0.4)]',
    cyan: 'text-cyan-500 border-cyan-500/20',
    emerald: 'text-emerald-500 border-emerald-500/30',
    rose: 'text-rose-500 border-rose-500/30',
    yellow: 'text-yellow-500 border-yellow-500/30',
    orange: 'text-orange-500 border-orange-500/30',
    stone: 'text-stone-500 border-stone-500/50',
    slate: 'text-slate-500 border-slate-500/20',
    green: 'text-green-500 border-green-500/20',
    purple: 'text-purple-500 border-purple-500/30 shadow-[0_0_20px_-12px_rgba(168,85,247,0.3)]',
  };

  if (!member) return null;

  return (
    <div
      className={cn(
        'bg-[#111] border rounded-[2rem] p-6 transition-all duration-500 hover:scale-[1.02] relative group cursor-help',
        colorConfigs[color],
      )}
    >
      <div className="absolute inset-x-0 -top-12 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none z-[100] transform group-hover:-translate-y-2">
        <div className="bg-slate-900 border border-white/10 text-white text-[10px] px-3 py-2 rounded-xl shadow-2xl text-center font-bold tracking-tight whitespace-nowrap mx-4">
          {description}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-900"></div>
        </div>
      </div>
      <div className={cn('text-[9px] font-black uppercase tracking-widest mb-1 opacity-70')}>
        {title}
      </div>
      <h3 className="text-xl font-black text-white italic mb-4 truncate">{member.name}</h3>
      <div className="flex justify-between items-end border-t border-white/5 pt-4">
        <div className="text-left">
          <p className="text-[9px] text-slate-500 uppercase font-bold tracking-tighter">
            Avg Score
          </p>
          <p className={cn('text-2xl font-black italic')}>{member.avgScore}</p>
        </div>
        <div className="text-right text-[10px] text-slate-400 font-bold italic">
          {subText ? subText : isVision ? `시야 ${member.avgVision}` : `데스 ${member.avgDeaths}`}
        </div>
      </div>
    </div>
  );
}

export default function SquadPage() {
  return (
    <Suspense>
      <SquadAnalysisContent />
    </Suspense>
  );
}
