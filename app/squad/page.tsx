'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Loader2,
  Users,
  TrendingUp,
  CheckCircle2,
  Search,
  Layers,
  User,
  Eye,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { analyzeSummoner, AnalysisResult } from '../actions/analyze';
import { getSquadAiFeedback } from '../actions/squadAiAnalyze';
import { aggregateSquad } from '@/lib/squad';
import SquadCoachReport, { SquadTitle } from '@/components/SquadCoachReport';
import { getSquadVerdict, SQUAD_COACH_VERSION, type SquadReport } from '@/lib/squad-report';
import type { SquadAiContext } from '../actions/squadAiAnalyze';
import { Suspense } from 'react';
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

function SquadAnalysisContent() {
  const searchParams = useSearchParams();
  const summonerParam = searchParams.get('summoner') || '';
  const squadParam = searchParams.get('squad') || '';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<AnalysisResult | null>(null);
  const [selectedQueue, setSelectedQueue] = useState('all');

  const [aiReport, setAiReport] = useState<{ key: string; report: SquadReport } | null>(null);
  const [error, setError] = useState('');
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);

  const [selectedMatchIds, setSelectedMatchIds] = useState<Set<string>>(new Set());

  const squadTargetList = useMemo(() => {
    const squad = squadParam ? squadParam.split(',') : [];
    return [summonerParam, ...squad].filter(Boolean).map((m) => m.toUpperCase().replace(/\s/g, ''));
  }, [summonerParam, squadParam]);

  const requestVersion = useRef(0);
  const fetchSquadData = useCallback(
    async (isRefresh = false) => {
      if (!summonerParam) {
        setLoading(false);
        setError('소환사를 먼저 검색해주세요.');
        return;
      }
      const version = ++requestVersion.current;
      setError('');
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const [name, tag] = summonerParam.split('#');
        const result = await analyzeSummoner(name, tag);
        if (version !== requestVersion.current) return;
        if (result && 'error' in result) {
          setData(null);
          setError(result.error);
          return;
        }
        setData(result);
        if (!result) setError('소환사를 찾을 수 없습니다.');
        setAiReport(null);
      } catch (err) {
        if (version !== requestVersion.current) return;
        setData(null);
        setError(err instanceof Error ? err.message : '조회에 실패했습니다.');
      } finally {
        if (version === requestVersion.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [summonerParam],
  );

  useEffect(() => {
    void fetchSquadData();
    return () => {
      requestVersion.current += 1;
    };
  }, [fetchSquadData]);

  const commonMatches = useMemo(() => {
    if (!data) return [];
    return data.matches.filter((match) => {
      const matchQueueId = match.queueId?.toString();
      const isCorrectQueue = selectedQueue === 'all' || matchQueueId === selectedQueue;
      if (!isCorrectQueue) return false;

      const matchParticipantIds = match.allParticipants.map((p) =>
        `${p.gameName}#${p.tagLine}`.toUpperCase().replace(/\s/g, ''),
      );
      const members = match.allParticipants.filter((p) =>
        squadTargetList.includes(`${p.gameName}#${p.tagLine}`.toUpperCase().replace(/\s/g, '')),
      );
      return (
        squadTargetList.every((targetId) => matchParticipantIds.includes(targetId)) &&
        new Set(members.map((p) => p.teamId)).size === 1
      );
    });
  }, [data, squadTargetList, selectedQueue]);

  useEffect(() => {
    setSelectedMatchIds(new Set(commonMatches.map((m) => m.id)));
  }, [commonMatches]);

  const selectedMatches = useMemo(
    () => commonMatches.filter((match) => selectedMatchIds.has(match.id)),
    [commonMatches, selectedMatchIds],
  );
  const selectedMembers = useMemo(
    () => aggregateSquad(selectedMatches, squadTargetList),
    [selectedMatches, squadTargetList],
  );
  const filteredHierarchy = useMemo(
    () =>
      selectedMembers.map((member) => ({
        ...member,
        avgDmg: member.avgDamage,
        breakdown: {
          base: member.scoreBreakdown.baseline * member.matchCount,
          vision: member.scoreBreakdown.vision * member.matchCount,
          dmg: member.scoreBreakdown.role * member.matchCount,
          deaths: member.scoreBreakdown.survival * member.matchCount,
        },
      })),
    [selectedMembers],
  );
  const analysisContext = useMemo<SquadAiContext>(() => {
    const counts = new Map<number, number>();
    selectedMatches.forEach((match) =>
      counts.set(match.queueId, (counts.get(match.queueId) || 0) + 1),
    );
    const modes = new Set(
      selectedMatches.map((match) =>
        match.queueId === 450
          ? 'ARAM'
          : SUMMONERS_RIFT_QUEUE_IDS.has(match.queueId)
            ? 'SUMMONERS_RIFT'
            : 'OTHER',
      ),
    );
    return {
      matchCount: selectedMatches.length,
      mode: modes.size === 1 ? [...modes][0] : modes.size > 1 ? 'MIXED' : 'OTHER',
      queueDistribution: [...counts].map(([queueId, count]) => ({
        queueId,
        count,
        label: QUEUE_LABELS[queueId] || `기타 큐(${queueId})`,
      })),
    };
  }, [selectedMatches]);

  const reportKey = JSON.stringify([
    SQUAD_COACH_VERSION,
    summonerParam,
    squadParam,
    [...selectedMatchIds].sort(),
    selectedMembers,
    analysisContext,
  ]);
  const aiRequestVersion = useRef(0);
  const handleAiAnalysis = async () => {
    if (isAiAnalyzing || selectedMatches.length === 0) return;
    const version = requestVersion.current;
    const aiVersion = ++aiRequestVersion.current;
    setError('');
    setIsAiAnalyzing(true);
    try {
      const result = await getSquadAiFeedback(selectedMembers, analysisContext);
      if (version !== requestVersion.current || aiVersion !== aiRequestVersion.current) return;
      if ('error' in result) setError(result.error);
      else setAiReport({ key: reportKey, report: result.report });
    } catch {
      if (version === requestVersion.current)
        setError('리포트를 불러오지 못했습니다. 다시 시도해주세요.');
    } finally {
      if (aiVersion === aiRequestVersion.current) setIsAiAnalyzing(false);
    }
  };

  if (loading)
    return (
      <main className="empty-state">
        <div className="loading-orbit">
          <Loader2 className="animate-spin" size={30} />
        </div>
        <span className="eyebrow">TEAM INSIGHT</span>
        <h1>우리 팀의 기록을 모으고 있어요</h1>
        <p>함께한 경기에서 각자의 기여도를 살펴봅니다.</p>
      </main>
    );

  return (
    <main className="dashboard-page pb-14">
      {error && (
        <p role="alert" className="p-6 text-center text-amber-400">
          {error}
        </p>
      )}
      {data?.warnings.map((warning) => (
        <p role="status" key={warning} className="p-4 text-center text-amber-400">
          {warning}
        </p>
      ))}
      <div className="squad-dashboard-hero">
        <div className="container mx-auto px-6 text-center">
          <div className="flex items-center justify-between gap-4 mb-8 mx-auto relative z-30 flex-wrap">
            <div className="mr-auto text-left">
              <span className="eyebrow">TEAM INSIGHT</span>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight">스쿼드 분석</h1>
            </div>
            <div className="segmented-control">
              {QUEUE_TYPES.map((q) => (
                <button
                  key={q.id}
                  aria-pressed={selectedQueue === q.id}
                  onClick={() => setSelectedQueue(q.id)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all',
                    selectedQueue === q.id
                      ? 'bg-[#c0ef87] text-[#172216]'
                      : 'text-slate-500 hover:text-slate-300',
                  )}
                >
                  {q.icon} {q.label}
                </button>
              ))}
            </div>

            <button
              aria-label="스쿼드 기록 새로고침"
              onClick={() => fetchSquadData(true)}
              disabled={refreshing}
              className="bg-white/5 hover:bg-white/10 border border-white/5 p-3 rounded-xl transition-all disabled:opacity-50 group"
            >
              <RefreshCw
                size={18}
                className={cn('text-lime-300 transition-all', refreshing && 'animate-spin')}
              />
            </button>
          </div>

          {commonMatches.length > 0 ? (
            <>
              <div className="flex items-center justify-center gap-2 text-lime-300 font-bold mb-4 bg-lime-500/10 px-4 py-1 rounded-full border border-lime-500/20 text-xs tracking-tight uppercase w-fit mx-auto">
                <CheckCircle2 size={14} /> 함께한 {commonMatches.length}경기
              </div>
              <h2 className="dashboard-title">
                우리 팀의 <span className="text-lime-300">플레이 리포트</span>
                <span className="block text-xs font-normal text-slate-400 tracking-normal mt-3">
                  선택한 {selectedMatchIds.size}경기 기준
                </span>
              </h2>
              <p className="coach-intro">
                말씀은 정중하게. 평가는 가감 없이.
                <br />
                <span>내 포지션에 맞는 칭호와 팩폭으로 돌아보는 경기 뒤풀이.</span>
              </p>
              <div className="flex flex-col items-center mb-8">
                <button
                  onClick={handleAiAnalysis}
                  disabled={
                    isAiAnalyzing || commonMatches.length === 0 || selectedMatchIds.size === 0
                  }
                  className="accent-button inline-flex items-center justify-center disabled:opacity-40"
                >
                  <div className="relative z-10 flex items-center gap-3">
                    {isAiAnalyzing ? (
                      <>
                        <RefreshCw className="animate-spin text-lime-300" size={20} />
                        <span>분석 중...</span>
                      </>
                    ) : (
                      <>
                        <TrendingUp className="text-lime-300 group-hover:text-white" size={20} />
                        <span>AI 코치에게 평가받기</span>
                      </>
                    )}
                  </div>
                </button>
                {aiReport?.key === reportKey && (
                  <SquadCoachReport key={reportKey} report={aiReport.report} />
                )}
                {aiReport && aiReport.key !== reportKey && (
                  <p className="mt-4 text-xs text-slate-400">
                    선택한 경기가 바뀌었습니다. 현재 기록으로 다시 평가받아보세요.
                  </p>
                )}
                {selectedMatches.length === 0 && (
                  <p className="mt-4 text-sm text-slate-400">
                    아래에서 분석할 경기를 한 개 이상 선택해주세요.
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <Search size={64} className="text-slate-800 mb-6" />
              <h2 className="text-3xl font-semibold text-slate-500 mb-2 uppercase">
                함께한 경기를 찾지 못했어요
              </h2>
              <p className="text-slate-400 font-bold">
                해당 큐 타입으로 함께 플레이한 매치가 없습니다.
              </p>
            </div>
          )}
        </div>
      </div>

      {commonMatches.length > 0 && (
        <>
          <div className="container mx-auto px-6 pt-8 relative mb-8">
            <div className="table-scroll">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/5 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                    <th className="px-8 py-5">순위</th>
                    <th className="px-8 py-5">멤버</th>
                    <th className="px-8 py-5">게임당 평균 스탯</th>
                    <th className="px-8 py-5 text-center">평균 인분 점수</th>
                    <th className="px-8 py-5 text-right">오늘의 칭호</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredHierarchy.map((m, idx) => {
                    const verdict = getSquadVerdict(m, analysisContext.mode);
                    return (
                      <tr key={idx} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="px-8 py-6 font-semibold text-xl text-slate-400 group-hover:text-lime-300">
                          #{idx + 1}
                        </td>
                        <td className="px-8 py-6 font-bold text-white">
                          {m.name}{' '}
                          <span className="text-[11px] text-slate-400 font-mono ml-1">
                            #{m.tag}
                          </span>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex gap-6 items-center">
                            <div className="flex flex-col">
                              <span className="text-[11px] text-slate-500 uppercase font-bold">
                                KDA
                              </span>
                              <span className="text-xs text-slate-300 font-mono">{m.avgKDA}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[11px] text-slate-500 uppercase font-bold">
                                평균딜량
                              </span>
                              <span className="text-xs text-slate-300 font-mono">
                                {m.avgDmg.toLocaleString()}
                              </span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[11px] text-slate-500 uppercase font-bold text-lime-300">
                                시야점수
                              </span>
                              <span className="text-xs text-lime-200 font-mono">{m.avgVision}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6 text-center">
                          <div className="flex flex-col items-center">
                            <span
                              className={cn(
                                'text-2xl font-semibold',
                                idx === 0 ? 'text-lime-300' : 'text-slate-400',
                              )}
                            >
                              {m.avgScore}
                            </span>
                            {m.breakdown && (
                              <div className="text-[11px] text-slate-500 font-mono mt-1 flex gap-1 bg-white/5 px-2 py-0.5 rounded-full">
                                <span className="text-slate-400">
                                  기준 {Math.round(m.breakdown.base / m.matchCount)}
                                </span>
                                <span
                                  className={
                                    m.breakdown.vision >= 0 ? 'text-lime-300' : 'text-red-400'
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
                          <SquadTitle verdict={verdict} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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

                return (
                  <div
                    key={match.id}
                    className={cn(
                      'relative border rounded-2xl overflow-hidden transition-all',
                      match.result === 'WIN'
                        ? 'bg-[#131c24] border-lime-500/10 hover:border-lime-500/30'
                        : 'bg-red-500/5 border-red-500/10 hover:border-red-500/30',
                    )}
                  >
                    <div
                      className={cn(
                        'px-6 py-2 flex justify-between items-center border-b border-white/5',
                        match.result === 'WIN' ? 'bg-lime-500/10' : 'bg-red-500/10',
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <input
                          type="checkbox"
                          aria-label={`${match.date} ${match.champion} 경기 분석에 포함`}
                          className="w-4 h-4 cursor-pointer accent-lime-300"
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
                            'font-semibold text-sm',
                            match.result === 'WIN' ? 'text-lime-300' : 'text-red-400',
                          )}
                        >
                          {match.result === 'WIN' ? 'VICTORY' : 'DEFEAT'}
                        </span>
                        <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">
                          {match.date}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-widest ml-4">
                        경기별 기여도
                      </div>
                    </div>

                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                      {squadPerformances.map((p, i) => {
                        return (
                          <div
                            key={i}
                            className={cn(
                              'bg-white/5 rounded-xl p-4 border transition-all relative overflow-hidden',
                              'border-white/5',
                            )}
                          >
                            <div className="flex items-center gap-3 mb-3 relative z-10">
                              <div className="relative shrink-0">
                                <img
                                  src={`https://ddragon.leagueoflegends.com/cdn/16.3.1/img/champion/${p.championName}.png`}
                                  className={cn('w-10 h-10 rounded-lg border', 'border-white/10')}
                                  alt={p.championName}
                                />
                                <div
                                  className={cn(
                                    'absolute -top-1 -right-1 text-[8px] font-semibold px-1 rounded text-white shadow-lg',
                                    'bg-lime-700',
                                  )}
                                >
                                  {p.score}
                                </div>
                              </div>
                              <div className="min-w-0">
                                <div className={cn('text-xs font-semibold truncate', 'text-white')}>
                                  {p.gameName}
                                </div>
                                <div className="text-[11px] text-slate-500 font-bold uppercase truncate">
                                  {p.role || ''} {p.championName}
                                </div>
                              </div>
                            </div>
                            <div className="space-y-2 pt-2 border-t border-white/5 relative z-10">
                              <div className="flex justify-between items-center">
                                <span className="text-[11px] text-slate-500 font-bold uppercase">
                                  KDA
                                </span>
                                <span className="text-[11px] text-slate-300 font-mono font-bold">
                                  {p.kda}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-[11px] text-slate-500 font-bold uppercase flex items-center gap-1">
                                  <Eye size={10} /> Vision
                                </span>
                                <span className="text-[11px] text-lime-300 font-mono font-bold">
                                  {p.visionScore || 0}
                                </span>
                              </div>
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
      <div className="ad-section">
        <span>ADVERTISEMENT</span>
        <div className="flex flex-wrap justify-center gap-8">
          <AdBanner unitId="DAN-kPapG5XifUmSgwJo" width="300" height="250" />
          <AdBanner unitId="DAN-me3iQo7eaz8bwxv2" width="300" height="250" />
        </div>
      </div>
    </main>
  );
}

export default function SquadPage() {
  return (
    <Suspense>
      <SquadAnalysisContent />
    </Suspense>
  );
}
