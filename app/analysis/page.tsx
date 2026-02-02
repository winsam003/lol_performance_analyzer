"use client";

import React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { Search, Trophy, Disc, Target, Eye, Shield, Sword, Star, Info, Loader2, Layers, User, Users, Zap, Coffee, BarChart3, BrainCircuit, Sparkles, MessageSquareWarning, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { analyzeSummoner, AnalysisResult, AnalyzedMatch } from "../actions/analyze";
import { getAiMatchFeedback } from "../actions/aiAnalyze";
import { Suspense } from "react";

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

const SCORE_GUIDE = [
    { range: "140+", label: "신(GOD)", color: "text-purple-400" },
    { range: "120~139", label: "CARRY", color: "text-blue-400" },
    { range: "110~119", label: "에이스", color: "text-cyan-400" },
    { range: "100~109", label: "1인분", color: "text-green-400" },
    { range: "90~99", label: "준수함", color: "text-emerald-400" },
    { range: "80~89", label: "버스승객", color: "text-yellow-400" },
    { range: "70~79", label: "무존재감", color: "text-orange-400" },
    { range: "0~69", label: "트롤", color: "text-red-400" },
];

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
    const [matchAiLoading, setMatchAiLoading] = useState<Record<string, boolean>>({});

    const fetchData = async (query: string) => {
        if (!query) return;
        const finalQuery = query.includes("#") ? query : `${query}#KR1`;
        const [gameName, tagLine] = finalQuery.split("#");
        router.push(`/analysis?summoner=${encodeURIComponent(finalQuery)}`);
        setLoading(true);
        setMatchAiFeedbacks({});
        try {
            const result = await analyzeSummoner(gameName, tagLine);
            if (result) { setData(result); }
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const handleSingleMatchAiAnalysis = async (e: React.MouseEvent, match: AnalyzedMatch) => {
        e.stopPropagation();
        if (matchAiFeedbacks[match.id]) {
            setExpandedMatchId(expandedMatchId === match.id ? null : match.id);
            return;
        }
        setExpandedMatchId(match.id);
        setMatchAiLoading(prev => ({ ...prev, [match.id]: true }));
        try {
            const feedback = await getAiMatchFeedback([match], data?.profile.name || "");
            setMatchAiFeedbacks(prev => ({ ...prev, [match.id]: feedback }));
        } catch (err) {
            console.error(err);
            setMatchAiFeedbacks(prev => ({ ...prev, [match.id]: "분석 에러가 발생했습니다." }));
        } finally {
            setMatchAiLoading(prev => ({ ...prev, [match.id]: false }));
        }
    };

    const handleTeamScan = (e: React.MouseEvent, match: any) => {
        e.stopPropagation();
        const teamParticipants = match.allParticipants.filter((p: any) => p.win === (match.result === "WIN"));
        if (teamParticipants.length === 0) return;
        const main = `${teamParticipants[0].gameName}#${teamParticipants[0].tagLine}`;
        const squad = teamParticipants.slice(1).map((m: any) => `${m.gameName}#${m.tagLine}`).join(',');
        router.push(`/squad?summoner=${encodeURIComponent(main)}&squad=${encodeURIComponent(squad)}`);
    };

    useEffect(() => { if (initialSummoner) fetchData(initialSummoner); }, [initialSummoner]);
    const handleSearch = () => fetchData(searchTerm);

    const filteredMatches = useMemo(() => {
        if (!data) return [];
        if (selectedQueue === "all") return data.matches;
        return data.matches.filter(m => (m as any).queueId?.toString() === selectedQueue);
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
        if (score >= 120) return { name: "CARRY", color: "text-blue-400", bg: "bg-blue-500/10" };
        if (score >= 110) return { name: "에이스", color: "text-cyan-400", bg: "bg-cyan-500/10" };
        if (score >= 100) return { name: "1인분", color: "text-green-400", bg: "bg-green-500/10" };
        if (score >= 90) return { name: "준수함", color: "text-emerald-400", bg: "bg-emerald-500/10" };
        if (score >= 80) return { name: "버스승객", color: "text-yellow-400", bg: "bg-yellow-500/10" };
        if (score >= 70) return { name: "무존재감", color: "text-orange-400", bg: "bg-orange-500/10" };
        return { name: "트롤", color: "text-red-400", bg: "bg-red-500/10" };
    };

    const getDynamicTags = (match: any) => {
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
        if (a >= 15) tags.push({ type: "KDA", label: "어시왕", color: "text-blue-500", bg: "bg-blue-500/20" });
        if (damage > 40000) tags.push({ type: "Dmg", label: "파괴전차", color: "text-orange-500", bg: "bg-orange-500/20" });
        if (vision > 60) tags.push({ type: "Vision", label: "맵핵", color: "text-cyan-500", bg: "bg-cyan-500/20" });
        if (d >= 10) tags.push({ type: "Survival", label: "기부천사", color: "text-slate-400", bg: "bg-slate-500/20" });
        if (score >= 135) tags.push({ type: "KDA", label: "하드캐리", color: "text-purple-500", bg: "bg-purple-500/20" });
        if (k >= 1 && d === 0) tags.push({ type: "Survival", label: "완벽주의자", color: "text-emerald-400", bg: "bg-emerald-400/20" });
        if (k + a >= 25) tags.push({ type: "KDA", label: "동에번쩍", color: "text-pink-400", bg: "bg-pink-400/20" });

        return Array.from(new Map(tags.map((item: any) => [item.label, item])).values());
    };

    if (loading && !data) {
        return (
            <main className="min-h-screen bg-[#0a0a0a] text-slate-200 flex flex-col items-center justify-center">
                <Loader2 className="animate-spin text-blue-500 mb-4" size={48} />
                <h2 className="text-xl font-bold animate-pulse uppercase italic tracking-tighter">Analyzing Combat Data...</h2>
            </main>
        );
    }

    if (!data) return null;

    const { profile } = data;
    const totalScore = filteredMatches.reduce((acc, curr) => acc + curr.score, 0);
    const averageScore = filteredMatches.length > 0 ? Math.floor(totalScore / filteredMatches.length) : 0;
    const tier = getTier(averageScore);

    const tagCounts = filteredMatches.reduce((acc, match) => {
        const dynamicTags = getDynamicTags(match);
        dynamicTags.forEach((tag: any) => {
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
        <main className="min-h-screen bg-[#0a0a0a] text-slate-200">
            <div className="border-b border-white/5 bg-[#111] sticky top-0 z-[100] backdrop-blur-md bg-opacity-80 px-6 py-4">
                <div className="container mx-auto flex justify-between items-center text-slate-100 italic tracking-tighter font-black text-xl">
                    <h1 className="cursor-pointer" onClick={() => router.push('/')}>WHO <span className="text-blue-500">CARRIED?</span></h1>
                    <div className="flex gap-2 shrink-0">
                        <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="소환사명 #태그" className="w-48 md:w-80 bg-black/40 border-white/10 text-sm" onKeyDown={(e) => e.key === "Enter" && handleSearch()} />
                        <Button size="sm" onClick={handleSearch} disabled={loading} className="bg-blue-600 hover:bg-blue-500 font-bold italic">
                            {loading ? <Loader2 className="animate-spin w-4 h-4" /> : "검색"}
                        </Button>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-6 py-12">
                <div className="flex items-center gap-4 mb-8">
                    <div className="flex bg-[#161616] p-1 rounded-xl border border-white/5 w-fit">
                        {QUEUES.map((q) => (
                            <button key={q.id} onClick={() => setSelectedQueue(q.id)} className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all", selectedQueue === q.id ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-300")}>
                                {q.icon} {q.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
                    <div className="lg:col-span-1 flex flex-col gap-6">
                        <div className="bg-[#161616] border border-white/5 rounded-3xl p-8 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-32 bg-blue-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                            <div className="relative z-10 flex flex-col items-center text-center">
                                <div className="w-24 h-24 rounded-3xl bg-slate-800 mb-6 border-4 border-[#1a1a1a] shadow-2xl overflow-hidden relative">
                                    <img src={`https://ddragon.leagueoflegends.com/cdn/15.1.1/img/profileicon/${profile.iconId}.png`} alt="Icon" className="w-full h-full object-cover" />
                                </div>
                                <h2 className="text-2xl font-bold text-white mb-2">{profile.name} <span className="text-slate-500 text-lg font-normal">#{profile.tag}</span></h2>
                                <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-800/50 rounded-full border border-white/5 text-xs font-bold text-slate-400 mb-6 uppercase tracking-wider">
                                    LV. {profile.level} • {profile.tier}
                                </div>
                                <div className="grid grid-cols-3 gap-2 w-full pt-6 border-t border-white/5">
                                    <div className="text-center"><div className="text-[10px] text-slate-500 mb-1 uppercase font-bold tracking-widest">승률</div><div className="text-xl font-bold text-slate-200">{profile.winRate}</div></div>
                                    <div className="text-center border-l border-white/5"><div className="text-[10px] text-slate-500 mb-1 uppercase font-bold tracking-widest">평점</div><div className="text-xl font-bold text-slate-200">{(filteredMatches.reduce((a, b) => { const [k, d, av] = b.kda.split('/').map(Number); return a + (d === 0 ? k + av : (k + av) / d); }, 0) / (filteredMatches.length || 1)).toFixed(2)}</div></div>
                                    <div className="text-center border-l border-white/5"><div className="text-[10px] text-slate-500 mb-1 uppercase font-bold tracking-widest">게임 수</div><div className="text-xl font-bold text-slate-200">{filteredMatches.length}</div></div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-[#161616] p-5 rounded-3xl border border-white/5">
                            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2"><Star size={12} /> 훈장 컬렉션</h4>
                            <div className="flex flex-wrap gap-2">
                                {Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).map(([tag, count]) => (
                                    <div key={tag} className="group relative">
                                        <div className="cursor-help flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-lg bg-white/5 border border-white/5 transition-colors hover:bg-white/10">
                                            <span className="font-medium text-slate-300">{tag}</span>
                                            <span className="font-bold text-blue-400">x{count}</span>
                                        </div>
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[200px] bg-slate-900 border border-white/20 text-white text-[10px] px-2 py-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[200]">
                                            {TAG_DESCRIPTIONS[tag] || "특별한 훈장"}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="group/guide bg-[#161616] border border-white/5 rounded-3xl p-8 flex flex-col items-center justify-center relative min-h-[300px]">
                            <div className={cn("absolute inset-0 opacity-10 blur-3xl", tier.bg.replace('/10', '/30'))}></div>
                            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-2 z-10 flex items-center gap-1.5">평균 기여도 <Info size={14} className="text-slate-600" /></h3>
                            <div className={cn("text-8xl font-black mb-4 italic z-10", tier.color)}>{averageScore}<span className="text-2xl align-top opacity-50 not-italic ml-1">점</span></div>
                            <div className={cn("px-6 py-2 rounded-full font-black text-sm uppercase tracking-widest z-10", tier.bg, tier.color)}>{tier.name}</div>
                        </div>

                        <div className="bg-[#161616] p-5 rounded-3xl border border-white/5">
                            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2"><Trophy size={12} /> 최근 모스트</h4>
                            <div className="space-y-3">
                                {championStats.slice(0, 5).map((champ) => (
                                    <div key={champ.name} className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/5">
                                                <img src={`https://ddragon.leagueoflegends.com/cdn/15.1.1/img/champion/${champ.name}.png`} className="w-full h-full object-cover scale-110" alt={champ.name} />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-slate-200">{champ.name}</span>
                                                <span className="text-[10px] text-slate-500">{champ.total}게임</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className={cn("text-xs font-black italic", champ.winRate >= 60 ? "text-blue-400" : "text-slate-200")}>{champ.winRate}%</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-2 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <StatBox icon={<Sword size={20} />} label="교전 능력" value={avgs.dmg > 25000 ? "S+" : "A"} sub={`평균 딜량 ${avgs.dmg.toLocaleString()}`} color="text-red-500" bg="bg-red-500/10" />
                            <StatBox icon={<Eye size={20} />} label="시야 장악" value={Number(avgs.vision) > 30 ? "S" : "A"} sub={`평균 시야점수 ${avgs.vision}`} color="text-blue-500" bg="bg-blue-500/10" />
                            <StatBox icon={<Shield size={20} />} label="생존력" value={Number(avgs.deaths) < 4 ? "S" : "A"} sub={`평균 데스 ${avgs.deaths}`} color="text-green-500" bg="bg-green-500/10" />
                        </div>

                        {filteredMatches.map((match) => {
                            const isExpanded = expandedMatchId === match.id;
                            const dynamicTags = getDynamicTags(match);
                            const champImg = match.champion === "Mel" ? "Mel" : match.champion;
                            const isAiLoading = matchAiLoading[match.id];
                            const currentAiFeedback = matchAiFeedbacks[match.id];

                            return (
                                <div key={match.id} className="flex flex-col gap-1">
                                    <div
                                        onClick={() => setExpandedMatchId(isExpanded ? null : match.id)}
                                        className={cn(
                                            "relative border rounded-xl p-4 flex flex-wrap md:flex-nowrap items-center gap-4 transition-all z-10 cursor-pointer",
                                            match.result === "WIN" ? "bg-[#131313] border-white/5 hover:border-blue-500/30" : "bg-red-500/5 border-red-500/10 hover:border-red-500/30",
                                            isExpanded && "rounded-b-none border-b-transparent ring-1 ring-white/10"
                                        )}
                                    >
                                        <div className={cn("absolute left-0 top-0 bottom-0 w-1", match.result === "WIN" ? "bg-blue-500" : "bg-red-500")}></div>

                                        <div className="flex flex-col w-20 pl-2 shrink-0">
                                            <span className={cn("font-bold text-xs", match.result === "WIN" ? "text-blue-400" : "text-red-400")}>{match.result === "WIN" ? "승리" : "패배"}</span>
                                            <span className="text-[10px] text-slate-600">{match.date}</span>
                                        </div>

                                        <div className="flex items-center gap-3 w-36 shrink-0">
                                            <div className="w-10 h-10 rounded-full bg-slate-800 overflow-hidden border border-white/10 shrink-0">
                                                <img src={`https://ddragon.leagueoflegends.com/cdn/15.1.1/img/champion/${champImg}.png`} alt={match.champion} className="w-full h-full object-cover scale-110" />
                                            </div>
                                            <div className="flex flex-col truncate">
                                                <span className="font-bold text-sm text-slate-200">{match.champion}</span>
                                                <span className="text-[10px] text-slate-500 font-bold uppercase">{match.role}</span>
                                            </div>
                                        </div>

                                        <div className="flex flex-col w-24 shrink-0">
                                            <span className="text-sm font-medium text-slate-300">{match.kda}</span>
                                            <span className="text-[10px] text-slate-600 italic tracking-tighter">KDA Score</span>
                                        </div>

                                        <div className="flex-1 flex justify-end items-center gap-4 min-w-0">
                                            <div className="flex flex-wrap justify-end gap-1.5 max-w-[160px]">
                                                {dynamicTags.map((tag: any, idx: number) => (
                                                    <span key={idx} className={cn("text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider", tag.bg, tag.color)}>
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
                                                    "h-8 flex items-center gap-1.5 px-3 border-indigo-500/30 text-indigo-400 text-[10px] font-black italic hover:bg-indigo-500/10 transition-all",
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
                                                className="hidden md:flex items-center gap-1.5 h-8 bg-transparent border-blue-500/30 hover:bg-blue-500/10 hover:border-blue-500/60 text-blue-400 text-[10px] font-black italic px-3"
                                            >
                                                <BarChart3 size={12} />
                                                SQUAD SCAN
                                            </Button>

                                            <div className="text-right shrink-0 ml-2 w-12">
                                                <div className={cn("text-2xl font-black italic leading-none", match.result === "WIN" ? getTier(match.score).color : "text-red-400")}>{match.score}</div>
                                                <div className="text-[9px] text-slate-600 font-bold uppercase mt-1">Score</div>
                                            </div>
                                            <div className="text-slate-600 ml-2">
                                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                            </div>
                                        </div>
                                    </div>
                                    {isExpanded && (
                                        <div className={cn(
                                            "border border-t-0 rounded-b-xl overflow-hidden animate-in slide-in-from-top-2 duration-200",
                                            match.result === "WIN" ? "bg-[#0f0f0f] border-white/5" : "bg-[#1a1212] border-red-500/10"
                                        )}>
                                            {currentAiFeedback && (
                                                <div className="mx-4 mt-4 p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10 relative overflow-hidden group">
                                                    <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 opacity-50"></div>
                                                    <h5 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-2 italic">
                                                        <Sparkles size={12} /> AI Match Review
                                                    </h5>
                                                    <p className="text-xs text-slate-300 leading-relaxed italic whitespace-pre-wrap">
                                                        {currentAiFeedback}
                                                    </p>
                                                </div>
                                            )}
                                            {isAiLoading && !currentAiFeedback && (
                                                <div className="py-8 flex flex-col items-center justify-center gap-3">
                                                    <Loader2 className="animate-spin text-indigo-500" size={24} />
                                                    <p className="text-[10px] font-bold text-slate-500 uppercase italic animate-pulse">AI is decoding battle logs...</p>
                                                </div>
                                            )}
                                            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                                                {[true, false].map((isWinGroup) => (
                                                    <div key={isWinGroup ? "win" : "loss"} className="space-y-2">
                                                        <div className={cn("text-[10px] font-black uppercase tracking-widest mb-3 flex items-center gap-2", isWinGroup ? "text-blue-400" : "text-red-400")}>
                                                            <div className={cn("w-1 h-3 rounded-full", isWinGroup ? "bg-blue-500" : "bg-red-500")}></div>
                                                            {isWinGroup ? "승리 팀" : "패배 팀"}
                                                        </div>
                                                        {match.allParticipants
                                                            ?.filter((p: any) => p.win === isWinGroup || p.win === (isWinGroup ? "true" : "false"))
                                                            .map((p: any, idx: number) => {
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
                                                                                onError={(e) => (e.currentTarget.src = "https://ddragon.leagueoflegends.com/cdn/15.1.1/img/profileicon/29.png")}
                                                                            />
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="flex items-center gap-2 mb-0.5">
                                                                                <span className={cn("text-[11px] font-bold truncate max-w-[80px]", (p.gameName === profile.name) ? "text-blue-400" : "text-slate-300")}>
                                                                                    {p.gameName}
                                                                                </span>
                                                                                <div className="flex gap-1 overflow-hidden">
                                                                                    {pTags.slice(0, 1).map((t: any, i: number) => (
                                                                                        <span key={i} className={cn("text-[7px] px-1 py-0.5 rounded-sm font-black uppercase leading-none", t.bg, t.color)}>{t.label}</span>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                            <div className="flex items-center gap-2 text-[9px] font-bold text-slate-500 font-mono">
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
                                                                                                src={`https://ddragon.leagueoflegends.com/cdn/15.1.1/img/item/${id}.png`}
                                                                                                className="w-full h-full object-cover"
                                                                                                alt=""
                                                                                                onError={(e) => {
                                                                                                    e.currentTarget.src = `https://ddragon.leagueoflegends.com/cdn/14.24.1/img/item/${id}.png`;
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
        </main>
    );
}

function StatBox({ icon, label, value, sub, color, bg }: { icon: React.ReactNode; label: string; value: string; sub: string; color: string; bg: string }) {
    return (
        <div className="bg-[#161616] p-6 rounded-2xl border border-white/5 flex flex-col gap-4">
            <div className="flex justify-between items-start">
                <div className={cn("p-3 rounded-xl", bg, color)}>{icon}</div>
                <div className="text-right">
                    <div className="text-2xl font-bold">{value}</div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase">{label}</div>
                </div>
            </div>
            <div className="text-xs text-slate-400">{sub}</div>
        </div>
    );
}

export default function AnalysisPage() {
    return (
        <Suspense fallback={<div className="bg-[#0a0a0a] min-h-screen text-white flex items-center justify-center font-black italic animate-pulse">BOOTING SYSTEM...</div>}>
            <AnalysisContent />
        </Suspense>
    );
}