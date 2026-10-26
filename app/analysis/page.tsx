"use client";

import React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Trophy, Target, Eye, Shield, Sword, Star, Info, Loader2, Layers, User, Users, Zap, Coffee, BarChart3, BrainCircuit, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { analyzeSummoner, AnalysisResult, AnalyzedMatch } from "../actions/analyze";
import { getAiMatchFeedback } from "../actions/aiAnalyze";
import { Suspense } from "react";
import AdBanner from "@/components/AdBanner";

const QUEUES = [
    { id: "all", label: "전체", icon: <Layers size={14} /> },
    { id: "420", label: "솔랭", icon: <User size={14} /> },
    { id: "440", label: "자랭", icon: <Users size={14} /> },
    { id: "450", label: "칼바람", icon: <Zap size={14} /> },
    { id: "430", label: "일반", icon: <Coffee size={14} /> },
];

const TAG_DESCRIPTIONS: Record<string, string> = {
    "불사신": "KDA 비율이 8 이상 (압도적 생존력)",
    "학살자": "10킬 이상 기록 (공포의 살육자)",
    "어시왕": "15어시스트 이상 기록 (최고의 서포팅)",
    "파괴전차": "가한 피해량 40,000 초과 (팀 내 최강 딜러)",
    "맵핵": "시야 점수 60 초과 (맵의 지배자)",
    "기부천사": "10데스 이상 기록 (분발이 필요합니다)",
    "하드캐리": "기여도 점수 135점 이상 (승리의 일등공신)",
    "딜킹": "팀 내 압도적인 딜량을 기록",
    "시야": "준수한 시야 점수를 기록",
    "생존": "데스 수가 매우 적음",
    "PENTA": "펜타킬 달성 (전설의 시작)",
    "도살자": "분당 CS 8개 이상 (완벽한 성장)",
    "완벽주의자": "1킬 이상 기록 및 노데스로 종료",
    "동에번쩍": "킬 관여율이 매우 높음",
    "관광객": "딜러임에도 딜량이 매우 낮음",
    "리신": "서포터임에도 시야 기여가 전무함"
};

function AnalysisContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const initialSummoner = searchParams.get("summoner") || "";

    const [searchTerm, setSearchTerm] = useState(initialSummoner);
    const [data, setData] = useState<AnalysisResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [selectedQueue, setSelectedQueue] = useState("all");
    const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);

    const [matchAiFeedbacks, setMatchAiFeedbacks] = useState<Record<string, string>>({});
    const [matchAiErrors, setMatchAiErrors] = useState<Record<string, string>>({});
    const [matchAiLoading, setMatchAiLoading] = useState<Record<string, boolean>>({});

    const requestVersion = useRef(0);
    const [error, setError] = useState("");
    const fetchData = useCallback(async (query: string) => {
        if (!query) return;
        const finalQuery = query.includes("#") ? query : `${query}#KR1`;
        const [gameName, tagLine] = finalQuery.split("#");
        const version = ++requestVersion.current;
        setError("");
        setData(null);
        setSearchTerm(finalQuery);
        setLoading(true);
        setMatchAiFeedbacks({});
        setMatchAiErrors({});
        setMatchAiLoading({});
        try {
            const result = await analyzeSummoner(gameName, tagLine);
            if (version !== requestVersion.current) return;
            if (result && "error" in result) { setData(null); setError(result.error); return; }
            setData(result);
            if (!result) setError("소환사를 찾을 수 없습니다.");
        } catch (err) {
            if (version === requestVersion.current) setError(err instanceof Error ? err.message : "조회에 실패했습니다.");
        } finally { if (version === requestVersion.current) setLoading(false); }
    }, []);

    const handleSingleMatchAiAnalysis = async (e: React.MouseEvent, match: AnalyzedMatch) => {
        e.stopPropagation();
        if (matchAiLoading[match.id]) return;
        const version = requestVersion.current;
        setMatchAiErrors(prev => ({ ...prev, [match.id]: "" }));
        if (matchAiFeedbacks[match.id]) {
            setExpandedMatchId(expandedMatchId === match.id ? null : match.id);
            return;
        }
        setExpandedMatchId(match.id);
        setMatchAiLoading(prev => ({ ...prev, [match.id]: true }));
        try {
            const feedback = await getAiMatchFeedback([{ champion: match.champion, queueId: match.queueId, result: match.result, kda: match.kda, score: match.score, detail: match.detail, role: match.role, breakdown: match.breakdown, metrics: match.allParticipants.find(p => p.teamId === match.teamId && p.championName === match.champion)?.metrics }], data?.profile.name || "");
            if (version !== requestVersion.current) return;
            if ("error" in feedback) setMatchAiErrors(prev => ({ ...prev, [match.id]: feedback.error }));
            else setMatchAiFeedbacks(prev => ({ ...prev, [match.id]: feedback.text }));
        } catch (err) {
            console.error(err);
            if (version === requestVersion.current) setMatchAiErrors(prev => ({ ...prev, [match.id]: "분석 에러가 발생했습니다." }));
        } finally {
            if (version === requestVersion.current) setMatchAiLoading(prev => ({ ...prev, [match.id]: false }));
        }
    };

    const handleTeamScan = (e: React.MouseEvent, match: AnalyzedMatch) => {
        e.stopPropagation();
        const teamParticipants = match.allParticipants.filter((p) => p.teamId === match.teamId);
        if (teamParticipants.length === 0) return;
        const main = `${teamParticipants[0].gameName}#${teamParticipants[0].tagLine}`;
        const squad = teamParticipants.slice(1).map((m) => `${m.gameName}#${m.tagLine}`).join(',');
        router.push(`/squad?summoner=${encodeURIComponent(main)}&squad=${encodeURIComponent(squad)}`);
    };

    useEffect(() => {
        if (initialSummoner) void fetchData(initialSummoner);
        return () => { requestVersion.current += 1; };
    }, [initialSummoner, fetchData]);
    const handleSearch = () => {
        const query = searchTerm.trim();
        if (!query || loading) return;
        const finalQuery = query.includes("#") ? query : `${query}#KR1`;
        if (finalQuery === initialSummoner) void fetchData(finalQuery);
        else router.push(`/analysis?summoner=${encodeURIComponent(finalQuery)}`);
    };

    const filteredMatches = useMemo(() => {
        if (!data) return [];
        if (selectedQueue === "all") return data.matches;
        return data.matches.filter(m => m.queueId?.toString() === selectedQueue);
    }, [data, selectedQueue]);

    const championStats = useMemo(() => {
        const stats: Record<string, { win: number; total: number }> = {};
        filteredMatches.forEach(m => {
            if (!stats[m.champion]) stats[m.champion] = { win: 0, total: 0 };
            stats[m.champion].total += 1;
            if (m.result === "WIN") stats[m.champion].win += 1;
        });
        return Object.entries(stats)
            .map(([name, s]) => ({
                name,
                winRate: Math.round((s.win / s.total) * 100),
                total: s.total,
                win: s.win
            }))
            .sort((a, b) => b.total - a.total || b.winRate - a.winRate);
    }, [filteredMatches]);

    const getTier = (score: number) => {
        if (score >= 140) return { name: "신(GOD)", color: "text-purple-400", bg: "bg-purple-500/10" };
        if (score >= 120) return { name: "CARRY", color: "text-lime-300", bg: "bg-lime-500/10" };
        if (score >= 110) return { name: "에이스", color: "text-cyan-400", bg: "bg-cyan-500/10" };
        if (score >= 100) return { name: "1인분", color: "text-green-400", bg: "bg-green-500/10" };
        if (score >= 90) return { name: "준수함", color: "text-emerald-400", bg: "bg-emerald-500/10" };
        if (score >= 80) return { name: "버스승객", color: "text-yellow-400", bg: "bg-yellow-500/10" };
        if (score >= 70) return { name: "무존재감", color: "text-orange-400", bg: "bg-orange-500/10" };
        return { name: "트롤", color: "text-red-400", bg: "bg-red-500/10" };
    };

    const getDynamicTags = (match: Pick<AnalyzedMatch, "kda" | "score" | "detail"> & { tags?: AnalyzedMatch["tags"] }) => {
        const tags = match.tags ? [...match.tags] : [];
        const kdaArr = (match.kda || "0/0/0").split('/');
        const k = Number(kdaArr[0]);
        const d = Number(kdaArr[1]);
        const a = Number(kdaArr[2]);
        const kdaRatio = d === 0 ? k + a : (k + a) / d;
        const damage = match.detail?.totalDamageDealtToChampions ?? 0;
        const vision = match.detail?.visionScore ?? 0;
        const score = match.score ?? 0;

        if (kdaRatio >= 8) tags.push({ type: "KDA", label: "불사신", color: "text-yellow-500", bg: "bg-yellow-500/20" });
        if (k >= 10) tags.push({ type: "Dmg", label: "학살자", color: "text-red-500", bg: "bg-red-500/20" });
        if (a >= 15) tags.push({ type: "KDA", label: "어시왕", color: "text-lime-300", bg: "bg-lime-500/20" });
        if (damage > 40000) tags.push({ type: "Dmg", label: "파괴전차", color: "text-orange-500", bg: "bg-orange-500/20" });
        if (vision > 60) tags.push({ type: "Vision", label: "맵핵", color: "text-cyan-500", bg: "bg-cyan-500/20" });
        if (d >= 10) tags.push({ type: "Survival", label: "기부천사", color: "text-slate-400", bg: "bg-slate-500/20" });
        if (score >= 135) tags.push({ type: "KDA", label: "하드캐리", color: "text-purple-500", bg: "bg-purple-500/20" });
        if (k >= 1 && d === 0) tags.push({ type: "Survival", label: "완벽주의자", color: "text-emerald-400", bg: "bg-emerald-400/20" });
        if (k + a >= 25) tags.push({ type: "KDA", label: "동에번쩍", color: "text-pink-400", bg: "bg-pink-400/20" });

        return Array.from(new Map(tags.map((item) => [item.label, item])).values());
    };

    if (loading && !data) {
        return <main className="empty-state"><div className="loading-orbit"><Loader2 size={30} className="animate-spin" /></div><span className="eyebrow">READING YOUR GAME</span><h1>플레이를 들여다보고 있어요</h1><p>최근 경기와 포지션별 기여도를 분석하고 있습니다.<br />처음 조회하는 기록은 잠시 시간이 걸릴 수 있어요.</p></main>;
    }
    if (!data) return <main className="empty-state"><div className="loading-orbit"><Target size={30} /></div><span className="eyebrow">PLAYER INSIGHT</span><h1>{error ? "기록을 불러오지 못했어요" : "당신의 플레이가 궁금하다면"}</h1><p role={error ? "alert" : undefined}>{error || "소환사를 검색하고 나만의 분석 리포트를 만나보세요."}</p><Button className="accent-button" onClick={() => router.push("/")}>소환사 검색하기</Button></main>;

    const { profile } = data;
    const totalScore = filteredMatches.reduce((acc, curr) => acc + curr.score, 0);
    const averageScore = filteredMatches.length > 0 ? Math.floor(totalScore / filteredMatches.length) : 0;
    const tier = getTier(averageScore);

    const tagCounts = filteredMatches.reduce((acc, match) => {
        const dynamicTags = getDynamicTags(match);
        dynamicTags.forEach((tag) => {
            if (!acc[tag.label]) acc[tag.label] = 0;
            acc[tag.label] += 1;
        });
        return acc;
    }, {} as Record<string, number>);

    // 타입 에러 수정됨: m.detail 객체 내부 값 참조
    const avgs = {
        dmg: Math.floor(filteredMatches.reduce((acc, m) => acc + (m.detail.totalDamageDealtToChampions ?? 0), 0) / (filteredMatches.length || 1)) || 0,
        vision: (filteredMatches.reduce((acc, m) => acc + (m.detail.visionScore ?? 0), 0) / (filteredMatches.length || 1)).toFixed(1) || "0",
        deaths: (filteredMatches.reduce((acc, m) => acc + (m.detail.deaths ?? 0), 0) / (filteredMatches.length || 1)).toFixed(1) || "0"
    };

    return (
        <main className="dashboard-page">
            <div className="dashboard-toolbar"><div className="page-width dashboard-toolbar-inner">
                <div><span className="eyebrow">PLAYER INSIGHT</span><h1>플레이 분석</h1></div>
                <form className="dashboard-search" onSubmit={e => { e.preventDefault(); handleSearch(); }}><Input aria-label="다른 소환사 검색" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="소환사명 #태그" /><Button type="submit" disabled={loading} className="accent-button">{loading ? <Loader2 className="animate-spin" size={16} /> : "검색"}</Button></form>
            </div></div>
            <div className="page-width dashboard-body">
                {data.warnings.map(warning => <p role="status" key={warning} className="mb-4 text-amber-400">{warning}</p>)}
                <div className="flex items-center gap-4 mb-8">
                    <div className="segmented-control">
                        {QUEUES.map((q) => (
                            <button key={q.id} aria-pressed={selectedQueue === q.id} onClick={() => setSelectedQueue(q.id)} className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all", selectedQueue === q.id ? "bg-[#c0ef87] text-[#172216]" : "text-slate-500 hover:text-slate-300")}>
                                {q.icon} {q.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="analysis-columns">
                    <div className="analysis-sidebar">
                        <div className="surface-card profile-card relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-32 bg-lime-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                            <div className="relative z-10 flex flex-col items-center text-center">
                                <div className="w-20 h-20 rounded-2xl bg-slate-800 mb-6 border-4 border-[#1a1a1a] shadow-sm overflow-hidden relative">
                                    <img src={`https://ddragon.leagueoflegends.com/cdn/15.1.1/img/profileicon/${profile.iconId}.png`} alt="Icon" className="w-full h-full object-cover" />
                                </div>
                                <h2 className="text-2xl font-bold text-white mb-2">{profile.name} <span className="text-slate-500 text-lg font-normal">#{profile.tag}</span></h2>
                                <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-800/50 rounded-full border border-white/5 text-xs font-bold text-slate-400 mb-6 uppercase tracking-wider">
                                    LV. {profile.level} • {profile.tier}
                                </div>
                                <div className="grid grid-cols-3 gap-2 w-full pt-6 border-t border-white/5">
                                    <div className="text-center"><div className="text-[11px] text-slate-500 mb-1 uppercase font-bold tracking-widest">승률</div><div className="text-xl font-bold text-slate-200">{profile.winRate}</div></div>
                                    <div className="text-center border-l border-white/5"><div className="text-[11px] text-slate-500 mb-1 uppercase font-bold tracking-widest">평점</div><div className="text-xl font-bold text-slate-200">{(filteredMatches.reduce((a, b) => { const [k, d, av] = b.kda.split('/').map(Number); return a + (d === 0 ? k + av : (k + av) / d); }, 0) / (filteredMatches.length || 1)).toFixed(2)}</div></div>
                                    <div className="text-center border-l border-white/5"><div className="text-[11px] text-slate-500 mb-1 uppercase font-bold tracking-widest">게임 수</div><div className="text-xl font-bold text-slate-200">{filteredMatches.length}</div></div>
                                </div>
                            </div>
                        </div>

                        <div className="contribution-card relative">
                            <div className={cn("absolute inset-0 opacity-10 blur-3xl", tier.bg.replace('/10', '/30'))}></div>
                            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-2 z-10 flex items-center gap-1.5">평균 기여도 <Info size={14} className="text-slate-400" /></h3>
                            <div className={cn("text-6xl font-semibold mb-4 z-10", tier.color)}>{averageScore}<span className="text-2xl align-top opacity-50 not-italic ml-1">점</span></div>
                            <div className={cn("px-6 py-2 rounded-full font-semibold text-sm uppercase tracking-widest z-10", tier.bg, tier.color)}>{tier.name}</div>
                        </div>

                        <details className="surface-card sidebar-detail p-5">
                            <summary className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2"><Star size={12} /> 훈장 컬렉션<ChevronDown size={13} className="ml-auto" /></summary>
                            <div className="flex flex-wrap gap-2">
                                {Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).map(([tag, count]) => (
                                    <div key={tag} className="group relative">
                                        <div className="cursor-help flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-lg bg-white/5 border border-white/5 transition-colors hover:bg-white/10">
                                            <span className="font-medium text-slate-300">{tag}</span>
                                            <span className="font-bold text-lime-300">x{count}</span>
                                        </div>
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[200px] bg-slate-900 border border-white/20 text-white text-[11px] px-2 py-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[200]">
                                            {TAG_DESCRIPTIONS[tag] || "특별한 훈장"}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </details>

                        <details className="surface-card sidebar-detail p-5">
                            <summary className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2"><Trophy size={12} /> 최근 모스트<ChevronDown size={13} className="ml-auto" /></summary>
                            <div className="space-y-3">
                                {championStats.slice(0, 5).map((champ) => (
                                    <div key={champ.name} className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/5">
                                                <img src={`https://ddragon.leagueoflegends.com/cdn/15.1.1/img/champion/${champ.name}.png`} className="w-full h-full object-cover scale-110" alt={champ.name} />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-slate-200">{champ.name}</span>
                                                <span className="text-[11px] text-slate-500">{champ.total}게임</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className={cn("text-xs font-semibold", champ.winRate >= 60 ? "text-lime-300" : "text-slate-200")}>{champ.winRate}%</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </details>
                    </div>

                    <div className="analysis-main space-y-4">
                        <div className="grid grid-cols-3 gap-3 mb-6">
                            <StatBox icon={<Sword size={20} />} label="교전 능력" value={avgs.dmg > 25000 ? "S+" : "A"} sub={`평균 딜량 ${avgs.dmg.toLocaleString()}`} color="text-red-500" bg="bg-red-500/10" />
                            <StatBox icon={<Eye size={20} />} label="시야 장악" value={Number(avgs.vision) > 30 ? "S" : "A"} sub={`평균 시야점수 ${avgs.vision}`} color="text-lime-300" bg="bg-lime-500/10" />
                            <StatBox icon={<Shield size={20} />} label="생존력" value={Number(avgs.deaths) < 4 ? "S" : "A"} sub={`평균 데스 ${avgs.deaths}`} color="text-green-500" bg="bg-green-500/10" />
                        </div>
                        <div className="section-heading"><h2>최근 경기</h2><span>{filteredMatches.length}경기 · 클릭하면 상세 기록</span></div>
                        {filteredMatches.length === 0 && <div className="surface-card p-8 text-center text-sm text-slate-400">최근 20경기 중 선택한 모드의 기록이 없습니다.</div>}
                        {filteredMatches.map((match) => {
                            const isExpanded = expandedMatchId === match.id;
                            const dynamicTags = getDynamicTags(match);
                            const champImg = match.champion === "Mel" ? "Mel" : match.champion;
                            const isAiLoading = matchAiLoading[match.id];
                            const currentAiFeedback = matchAiFeedbacks[match.id] || matchAiErrors[match.id];

                            return (
                                <div key={match.id} className="flex flex-col gap-1">
                                    <div
                                        onClick={() => setExpandedMatchId(isExpanded ? null : match.id)}
                                        role="button" tabIndex={0} aria-expanded={isExpanded} aria-label={`${match.champion} ${match.date} 경기 상세`}
                                        onKeyDown={e => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setExpandedMatchId(isExpanded ? null : match.id); } }}
                                        className={cn(
                                            "match-card relative p-4 flex flex-wrap xl:flex-nowrap items-center gap-3 cursor-pointer",
                                            match.result === "WIN" ? "" : "loss",
                                            isExpanded && "rounded-b-none border-b-transparent ring-1 ring-white/10"
                                        )}
                                    >
                                        <div className={cn("absolute left-0 top-0 bottom-0 w-1", match.result === "WIN" ? "bg-lime-500" : "bg-red-500")}></div>

                                        <div className="flex flex-col w-14 pl-2 shrink-0">
                                            <span className={cn("font-bold text-xs", match.result === "WIN" ? "text-lime-300" : "text-red-400")}>{match.result === "WIN" ? "승리" : "패배"}</span>
                                            <span className="text-[11px] text-slate-400">{match.date}</span>
                                        </div>

                                        <div className="flex items-center gap-3 w-28 shrink-0">
                                            <div className="w-10 h-10 rounded-full bg-slate-800 overflow-hidden border border-white/10 shrink-0">
                                                <img src={`https://ddragon.leagueoflegends.com/cdn/15.1.1/img/champion/${champImg}.png`} alt={match.champion} className="w-full h-full object-cover scale-110" />
                                            </div>
                                            <div className="flex flex-col truncate">
                                                <span title={match.champion} className="font-medium text-sm text-slate-200 truncate">{match.champion}</span>
                                                <span className="text-[11px] text-slate-500 font-bold uppercase">{match.role}</span>
                                            </div>
                                        </div>

                                        <div className="flex flex-col w-20 shrink-0">
                                            <span className="text-sm font-medium text-slate-300">{match.kda}</span>
                                            <span className="text-[11px] text-slate-400 tracking-tight">K / D / A</span>
                                        </div>

                                        <div className="match-actions flex-1 flex justify-end items-center gap-3 min-w-0">
                                            <div className="flex flex-wrap justify-end gap-1.5 max-w-[110px]">
                                                {dynamicTags.map((tag, idx) => (
                                                    <span key={idx} className={cn("text-[11px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider", tag.bg, tag.color)}>
                                                        {tag.label}
                                                    </span>
                                                ))}
                                            </div>

                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={isAiLoading}
                                                onClick={(e) => handleSingleMatchAiAnalysis(e, match)}
                                                className={cn(
                                                    "h-8 flex items-center gap-1.5 px-3 border-indigo-500/30 text-indigo-400 text-[11px] font-semibold hover:bg-indigo-500/10 transition-all",
                                                    currentAiFeedback && "border-green-500/50 text-green-400"
                                                )}
                                            >
                                                {isAiLoading ? <Loader2 className="animate-spin" size={12} /> : <BrainCircuit size={12} />}
                                                {currentAiFeedback ? "분석완료" : "AI 분석"}
                                            </Button>

                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={(e) => handleTeamScan(e, match)}
                                                className="hidden md:flex items-center gap-1.5 h-8 bg-transparent border-lime-500/30 hover:bg-lime-500/10 hover:border-lime-500/60 text-lime-300 text-[11px] font-semibold px-3"
                                            >
                                                <BarChart3 size={12} />
                                                스쿼드
                                            </Button>

                                            <div className="text-right shrink-0 ml-2 w-12">
                                                <div className={cn("text-2xl font-semibold leading-none", match.result === "WIN" ? getTier(match.score).color : "text-red-400")}>{match.score}</div>
                                                <div className="text-[11px] text-slate-400 font-bold uppercase mt-1">Score</div>
                                            </div>
                                            <div className="text-slate-400 ml-2">
                                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                            </div>
                                        </div>
                                    </div>
                                    {isExpanded && (
                                        <div className={cn(
                                            "border border-t-0 rounded-b-xl overflow-hidden animate-in slide-in-from-top-2 duration-200",
                                            match.result === "WIN" ? "bg-[#111a22] border-white/5" : "bg-[#1a1212] border-red-500/10"
                                        )}>
                                            {currentAiFeedback && (
                                                <div className="report-panel mx-4 mt-4 p-5 relative overflow-hidden">
                                                    <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 opacity-50"></div>
                                                    <h5 className="text-[11px] font-semibold text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                        <Sparkles size={12} /> AI 코치 피드백
                                                    </h5>
                                                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                                                        {currentAiFeedback}
                                                    </p>
                                                </div>
                                            )}
                                            {isAiLoading && !currentAiFeedback && (
                                                <div className="py-8 flex flex-col items-center justify-center gap-3">
                                                    <Loader2 className="animate-spin text-indigo-500" size={24} />
                                                    <p className="text-[11px] font-bold text-slate-500 uppercase animate-pulse">AI is decoding battle logs...</p>
                                                </div>
                                            )}
                                            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                                                {[true, false].map((isWinGroup) => (
                                                    <div key={isWinGroup ? "win" : "loss"} className="space-y-2">
                                                        <div className={cn("text-[11px] font-semibold uppercase tracking-widest mb-3 flex items-center gap-2", isWinGroup ? "text-lime-300" : "text-red-400")}>
                                                            <div className={cn("w-1 h-3 rounded-full", isWinGroup ? "bg-lime-500" : "bg-red-500")}></div>
                                                            {isWinGroup ? "승리 팀" : "패배 팀"}
                                                        </div>
                                                        {match.allParticipants
                                                            ?.filter((p) => p.win === isWinGroup)
                                                            .map((p, idx) => {
                                                                const kdaArr = p.kda?.split('/') || [0, 0, 0];
                                                                const k = Number(kdaArr[0]);
                                                                const d = Number(kdaArr[1]);
                                                                const a = Number(kdaArr[2]);
                                                                const dmg = p.damage ?? 0;
                                                                const gold = p.gold ?? 0;
                                                                const finalItems = [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5];
                                                                const pTags = getDynamicTags({
                                                                    ...p,
                                                                    detail: { kills: k, deaths: d, assists: a, totalDamageDealtToChampions: dmg, visionScore: p.visionScore ?? 0 }
                                                                });

                                                                return (
                                                                    <div key={idx} className="flex items-center gap-3 p-2 rounded-lg bg-black/40 border border-white/5 hover:bg-white/5 transition-colors">
                                                                        <div className="w-8 h-8 shrink-0 rounded-md overflow-hidden bg-slate-800 border border-white/10">
                                                                            <img
                                                                                src={`https://ddragon.leagueoflegends.com/cdn/15.1.1/img/champion/${p.championName}.png`}
                                                                                className="w-full h-full object-cover"
                                                                                alt={p.championName}
                                                                                onError={(e) => (e.currentTarget.src = "https://ddragon.leagueoflegends.com/cdn/16.3.1/img/profileicon/29.png")}
                                                                            />
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="flex items-center gap-2 mb-0.5">
                                                                                <span className={cn("text-[11px] font-bold truncate max-w-[80px]", (p.gameName === profile.name) ? "text-lime-300" : "text-slate-300")}>
                                                                                    {p.gameName}
                                                                                </span>
                                                                                <div className="flex gap-1 overflow-hidden">
                                                                                    {pTags.slice(0, 1).map((t, i) => (
                                                                                        <span key={i} className={cn("text-[7px] px-1 py-0.5 rounded-sm font-semibold uppercase leading-none", t.bg, t.color)}>{t.label}</span>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500 font-mono">
                                                                                <span className="text-slate-200">{p.kda}</span>
                                                                                <span className="text-slate-800">|</span>
                                                                                <span className="text-red-400/80">{(dmg / 1000).toFixed(1)}k dmg</span>
                                                                                <span className="text-slate-800">|</span>
                                                                                <span className="text-yellow-500/80">{(gold / 1000).toFixed(1)}k gold</span>
                                                                            </div>
                                                                        </div>

                                                                        <div className="flex gap-0.5 shrink-0">
                                                                            {finalItems.map((itemId, i) => {
                                                                                const id = Number(itemId);
                                                                                const isValid = id > 0;
                                                                                return (
                                                                                    <div key={i} className="w-[18px] h-[18px] bg-black/60 rounded-sm overflow-hidden border border-white/5 flex items-center justify-center">
                                                                                        {isValid ? (
                                                                                            <img
                                                                                                src={`https://ddragon.leagueoflegends.com/cdn/16.3.1/img/item/${id}.png`}
                                                                                                className="w-full h-full object-cover"
                                                                                                alt=""
                                                                                                onError={(e) => {
                                                                                                    e.currentTarget.src = `https://ddragon.leagueoflegends.com/cdn/16.3.1/img/item/${id}.png`;
                                                                                                }}
                                                                                            />
                                                                                        ) : (
                                                                                            <div className="w-full h-full bg-white/5" />
                                                                                        )}
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
            <div className="ad-section"><span>ADVERTISEMENT</span><div className="flex flex-wrap justify-center gap-8"><AdBanner unitId="DAN-TzTRlqjK3YjSJObx" width="300" height="250" /><AdBanner unitId="DAN-OjVpNaoCTNFcIvEN" width="300" height="250" /></div></div>
        </main>
    );
}

function StatBox({ icon, label, value, sub, color, bg }: { icon: React.ReactNode; label: string; value: string; sub: string; color: string; bg: string }) {
    return (
        <div className="bg-[#131c24] p-6 rounded-2xl border border-white/5 flex flex-col gap-4">
            <div className="flex justify-between items-start">
                <div className={cn("p-3 rounded-xl", bg, color)}>{icon}</div>
                <div className="text-right">
                    <div className="text-2xl font-bold">{value}</div>
                    <div className="text-[11px] text-slate-500 font-bold uppercase">{label}</div>
                </div>
            </div>
            <div className="text-xs text-slate-400">{sub}</div>
        </div>
    );
}

export default function AnalysisPage() {
    return (
        <Suspense fallback={<div className="bg-[#0c1015] min-h-screen text-white flex items-center justify-center font-semibold animate-pulse">BOOTING SYSTEM...</div>}>
            <AnalysisContent />
        </Suspense>
    );
}