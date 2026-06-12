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
import { Suspense } from 'react';
import Link from 'next/link';
import AdBanner from '@/components/AdBanner';

const QUEUE_TYPES = [
  { id: 'all', label: '전체 매치', icon: <Layers size={14} /> },
  { id: '420', label: '솔랭/듀오', icon: <User size={14} /> },
  { id: '440', label: '자유 랭크', icon: <Users size={14} /> },
];

const TITLES = {
  DEATHS: (isBad: boolean) =>
    isBad
      ? { title: '300원 맛집', desc: '상대에게 가장 많은 골드를 기부함', color: 'red' }
      : { title: '불사조', desc: '위험한 순간에도 끝까지 살아남음', color: 'orange' },
  EFFICIENCY: (isBad: boolean) =>
    isBad
      ? { title: '세금 도둑', desc: '골드 수급량 대비 영양가 없는 딜량', color: 'stone' }
      : { title: '성장형 엔진', desc: '자원을 바탕으로 팀의 승리를 견인함', color: 'emerald' },
  VISION: (isBad: boolean) =>
    isBad
      ? { title: '망원경', desc: '시야 점수가 권장치보다 현저히 낮음', color: 'slate' }
      : { title: '은밀한 조력자', desc: '보이지 않는 곳에서 팀을 지원함', color: 'cyan' },
  DAMAGE: (isBad: boolean) =>
    isBad
      ? { title: '평화주의자', desc: '팀 내 대인 피해량 기여도가 가장 낮음', color: 'green' }
      : { title: '철벽 방어', desc: '딜보다 중요한 생존과 위치 선정', color: 'blue' },
  SUSPECT: (isBad: boolean) =>
    isBad
      ? { title: '범인(Suspect)', desc: '포지션 대비 기여도가 가장 처참함', color: 'orange' }
      : { title: '숨은 공로자', desc: '기록 이상의 가치를 보여준 멤버', color: 'purple' },
};

function SquadAnalysisContent() {
  const searchParams = useSearchParams();
  const summonerParam = searchParams.get('summoner') || '';
  const squadParam = searchParams.get('squad') || '';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<AnalysisResult | null>(null);
  const [selectedQueue, setSelectedQueue] = useState('all');

  const [aiReport, setAiReport] = useState<string>('');
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);

  // 💡 AI 분석용으로 선택된 매치 ID 상태 관리
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

    const aiStatsMap: Record<string, any> = {};
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
              role: (p as any).role || (p as any).teamPosition || '',
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
          aiStatsMap[pFullId].vision += (p as any).visionScore || 0;
          if (p.breakdown) {
            aiStatsMap[pFullId].breakdown.base += p.breakdown.base;
            aiStatsMap[pFullId].breakdown.vision += p.breakdown.vision;
            aiStatsMap[pFullId].breakdown.dmg += p.breakdown.dmg;
            aiStatsMap[pFullId].breakdown.deaths += p.breakdown.deaths;
          }
        }
      });
    });

    const aiHierarchy = Object.values(aiStatsMap)
      .map((s: any) => ({
        ...s,
        avgScore: Math.floor(s.totalScore / s.matchCount),
        avgKDA: `${(s.kills / s.matchCount).toFixed(1)}/${(s.deaths / s.matchCount).toFixed(1)}/${(s.assists / s.matchCount).toFixed(1)}`,
        avgKills: (s.kills / s.matchCount).toFixed(1),
        avgAssists: (s.assists / s.matchCount).toFixed(1),
        avgDmg: Math.floor(s.dmg / s.matchCount),
        avgVision: (s.vision / s.matchCount).toFixed(1),
        efficiency: Math.floor((s.dmg / (s.gold || 1)) * 100),
        avgDeaths: (s.deaths / s.matchCount).toFixed(1),
      }))
      .sort((a, b) => b.avgScore - a.avgScore);

    try {
      const report = await getSquadAiFeedback(aiHierarchy);
      setAiReport(report);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  // 💡 [핵심 수정 구역] 다이나믹 칭호 시스템 대규모 확장
  const getIdentity = (m: any, idx: number, total: number) => {
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

    // 1. 최상위 절대 조건 (압도적 캐리 or 갱생 불가능한 트롤)
    if (d >= 12) return { label: '인간 넥서스', color: 'bg-red-950' };
    if (d >= 9 && score < 80) return { label: '협곡의 재앙', color: 'bg-red-900' };
    if (idx === 0 && score >= 150) return { label: '강림한 신(GOD)', color: 'bg-purple-600' };
    if (eff < 30) return { label: '협곡의 리먼 브라더스', color: 'bg-stone-800' };
    if (idx === total - 1 && score < 60) return { label: '폐급 폐기물', color: 'bg-red-800' };

    // 2. 포지션별(Role) 맞춤형 팩폭 및 칭찬 칭호
    if (isTop) {
      if (score >= 120 && eff > 100) return { label: '국가대표 고기방패', color: 'bg-blue-700' };
      if (eff > 110 && d < 5) return { label: '강화 대리석 척추', color: 'bg-emerald-600' };
      if (a <= 3 && score >= 100) return { label: '고독한 탑신병자', color: 'bg-slate-700' };
      if (k + a <= 4 && score < 90) return { label: '탑 지박령', color: 'bg-stone-700' };
      if (d >= 8) return { label: '친환경 종이박스', color: 'bg-orange-700' };
    } else if (isJng) {
      if (a >= 12 && score >= 110) return { label: '협곡의 홍길동', color: 'bg-sky-600' };
      if (k >= 8 && score >= 120) return { label: '스쿼드 실질적 가장', color: 'bg-emerald-500' };
      if (eff < 60 && a < 5) return { label: '야생 버섯 채집가', color: 'bg-green-800' };
      if (v >= 30) return { label: '바론/용 세콤(SECOM)', color: 'bg-cyan-700' };
      if (d >= 7) return { label: '보호구역 멸종위기 백정', color: 'bg-stone-600' };
    } else if (isMid) {
      if (eff >= 140 && score >= 110)
        return { label: '가성비 권익위원회장', color: 'bg-emerald-500' };
      if (k >= 10 && score >= 120) return { label: '황족 미드', color: 'bg-purple-500' };
      if (k > 5 && eff < 70) return { label: 'KDA 분식회계사', color: 'bg-rose-700' };
      if (eff < 60 && score < 90) return { label: '세금 포탈 상습범', color: 'bg-orange-600' };
      if (d >= 8) return { label: '고속도로 프리패스', color: 'bg-red-700' };
    } else if (isAdc) {
      if (eff >= 130 && score >= 120) return { label: '풀악셀 7성구 기사', color: 'bg-sky-500' };
      if (k >= 12) return { label: '대기업 전문 경영인', color: 'bg-emerald-600' };
      if (d >= 8 && k >= 8) return { label: '외줄타기 서커스단장', color: 'bg-rose-600' };
      if (d >= 8) return { label: '유리대포 시한폭탄', color: 'bg-red-600' };
      if (eff < 60 && score < 90) return { label: '국가부도 주범', color: 'bg-stone-700' };
    } else if (isSup) {
      if (v >= 40 && score >= 110) return { label: '어둠 속의 눈동자', color: 'bg-cyan-600' };
      if (a >= 20) return { label: '마더 테레사', color: 'bg-yellow-600' };
      if (k >= 6 && a < 10) return { label: '합법적 강도', color: 'bg-rose-700' };
      if (v < 15 && score < 90) return { label: '장님 안내견 가출', color: 'bg-slate-800' };
      if (v < 25) return { label: '와드 아끼다 집 장만', color: 'bg-stone-600' };
      if (score >= 120) return { label: '협곡의 창조주', color: 'bg-purple-500' };
    }

    // 3. 일반 범용 조건 (위 조건에 안 걸렸거나 포지션 특정 안된 경우)
    if (idx === 0 && score >= 115) return { label: '에이스(ACE)', color: 'bg-blue-600' };
    if (idx === 0) return { label: '소년가장', color: 'bg-sky-700' }; // 1등인데 점수가 낮을때
    if (score >= 120) return { label: '승리의 주역', color: 'bg-blue-500' };
    if (idx === total - 1 && score < 85) return { label: '지명수배자', color: 'bg-red-600' };
    if (idx === total - 1) return { label: '행복롤 깍두기', color: 'bg-orange-500' }; // 꼴등인데 점수가 나쁘지 않을때
    if (eff >= 120) return { label: '가성비 괴물', color: 'bg-emerald-500' };
    if (v >= 35) return { label: '인간 와드', color: 'bg-cyan-600' };
    if (d >= 8) return { label: '300원 맛집', color: 'bg-red-600' };
    if (k >= 10) return { label: '학살자', color: 'bg-rose-600' };
    if (a >= 15) return { label: '친절한 이웃', color: 'bg-yellow-600' };

    return { label: '평범한 시민', color: 'bg-slate-700' };
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
                        <span>AI 스쿼드 리포트</span>
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
                                  기본 {Math.floor(m.breakdown.base / m.matchCount)}
                                </span>
                                <span
                                  className={
                                    m.breakdown.vision >= 0 ? 'text-blue-400' : 'text-red-400'
                                  }
                                >
                                  {m.breakdown.vision >= 0 ? '+' : ''}
                                  {Math.floor(m.breakdown.vision / m.matchCount)}시야
                                </span>
                                <span
                                  className={
                                    m.breakdown.dmg >= 0 ? 'text-emerald-400' : 'text-red-400'
                                  }
                                >
                                  {m.breakdown.dmg >= 0 ? '+' : ''}
                                  {Math.floor(m.breakdown.dmg / m.matchCount)}딜
                                </span>
                                <span className="text-red-400">
                                  {Math.floor(m.breakdown.deaths / m.matchCount)}데스
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
                                    : p.score >= 135
                                      ? 'bg-purple-600 text-white'
                                      : p.score >= 115
                                        ? 'bg-blue-600 text-white'
                                        : p.score >= 95
                                          ? 'bg-emerald-600 text-white'
                                          : 'bg-slate-800 text-slate-400',
                                )}
                              >
                                {isSuspect
                                  ? '🚨 이 판의 범인'
                                  : p.score >= 135
                                    ? '하드캐리'
                                    : p.score >= 115
                                      ? 'ACE'
                                      : p.score >= 95
                                        ? '1인분'
                                        : '버스 승객'}
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
