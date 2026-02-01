"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { Search, Trophy, Disc, Target, Eye, Shield, Sword, Star, Info, Loader2, Layers, User, Users, Zap, Coffee } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { analyzeSummoner, AnalysisResult, AnalyzedMatch } from "../actions/analyze";
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
    "리심": "서포터임에도 시야 기여가 전무함"
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
    const initialSummoner = searchParams.get("summoner") || "Hide on bush#KR1";

    const [searchTerm, setSearchTerm] = useState(initialSummoner);
    const [data, setData] = useState<AnalysisResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedQueue, setSelectedQueue] = useState("all");

    const fetchData = async (query: string) => {
        const finalQuery = query.includes("#") ? query : `${query}#KR1`;
        const [gameName, tagLine] = finalQuery.split("#");
        setLoading(true);
        setError(null);
        try {
            const result = await analyzeSummoner(gameName, tagLine);
            if (!result) { setError("결과가 없습니다."); }
            else { setData(result); }
        } catch (err) { console.error(err); setError("에러 발생"); }
        finally { setLoading(false); }
    };

    useEffect(() => { if (initialSummoner) fetchData(initialSummoner); }, []);
    const handleSearch = () => fetchData(searchTerm);

    const filteredMatches = useMemo(() => {
        if (!data) return [];
        if (selectedQueue === "all") return data.matches;
        return data.matches.filter(m => (m as any).queueId?.toString() === selectedQueue);
    }, [data, selectedQueue]);

    // --- 챔피언별 승률 계산 로직 추가 ---
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

    const getDynamicTags = (match: AnalyzedMatch) => {
        const tags = [...match.tags];
        const [k, d, a] = match.kda.split('/').map(Number);
        const kdaRatio = d === 0 ? k + a : (k + a) / d;

        if (kdaRatio >= 8) tags.push({ type: "KDA", label: "불사신", color: "text-yellow-500", bg: "bg-yellow-500/20" });
        if (k >= 10) tags.push({ type: "Dmg", label: "학살자", color: "text-red-500", bg: "bg-red-500/20" });
        if (a >= 15) tags.push({ type: "KDA", label: "어시왕", color: "text-blue-500", bg: "bg-blue-500/20" });
        if (match.detail.totalDamageDealtToChampions > 40000) tags.push({ type: "Dmg", label: "파괴전차", color: "text-orange-500", bg: "bg-orange-500/20" });
        if (match.detail.visionScore > 60) tags.push({ type: "Vision", label: "맵핵", color: "text-cyan-500", bg: "bg-cyan-500/20" });
        if (d >= 10) tags.push({ type: "Survival", label: "기부천사", color: "text-slate-400", bg: "bg-slate-500/20" });
        if (match.score >= 135) tags.push({ type: "KDA", label: "하드캐리", color: "text-purple-500", bg: "bg-purple-500/20" });
        if (k >= 1 && d === 0) tags.push({ type: "Survival", label: "완벽주의자", color: "text-emerald-400", bg: "bg-emerald-400/20" });
        if (k + a >= 25) tags.push({ type: "KDA", label: "동에번쩍", color: "text-pink-400", bg: "bg-pink-400/20" });
        if (match.detail.totalDamageDealtToChampions < 5000 && match.role !== "SUP") tags.push({ type: "Dmg", label: "관광객", color: "text-slate-500", bg: "bg-slate-500/20" });
        if (match.detail.visionScore < 5 && match.role === "SUP") tags.push({ type: "Vision", label: "리심", color: "text-orange-300", bg: "bg-orange-300/20" });

        return Array.from(new Map(tags.map(item => [item.label, item])).values());
    };

    if (loading && !data) {
        return (
            <main className="min-h-screen bg-[#0a0a0a] text-slate-200 flex flex-col items-center justify-center">
                <Loader2 className="animate-spin text-blue-500 mb-4" size={48} />
                <h2 className="text-xl font-bold animate-pulse">전적 분석 중...</h2>
            </main>
        );
    }

    if (!data) {
        return (
            <main className="min-h-screen bg-[#0a0a0a] text-slate-200 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="소환사명 #태그" className="w-80 bg-black/40 border-white/10" onKeyDown={(e) => e.key === "Enter" && handleSearch()} />
                    <Button onClick={handleSearch} className="bg-blue-600 hover:bg-blue-500">검색</Button>
                </div>
            </main>
        )
    }

    const { profile } = data;
    const totalScore = filteredMatches.reduce((acc, curr) => acc + curr.score, 0);
    const averageScore = filteredMatches.length > 0 ? Math.floor(totalScore / filteredMatches.length) : 0;
    const tier = getTier(averageScore);

    const roleStats = filteredMatches.reduce((acc, match) => {
        if (!acc[match.role]) acc[match.role] = { count: 0, totalScore: 0, k: 0, d: 0, a: 0 };
        const [k, d, a] = match.kda.split('/').map(Number);
        acc[match.role].count += 1;
        acc[match.role].totalScore += match.score;
        acc[match.role].k += k;
        acc[match.role].d += d;
        acc[match.role].a += a;
        return acc;
    }, {} as Record<string, { count: number, totalScore: number, k: number, d: number, a: number }>);

    const tagCounts = filteredMatches.reduce((acc, match) => {
        const dynamicTags = getDynamicTags(match);
        dynamicTags.forEach(tag => {
            if (!acc[tag.label]) acc[tag.label] = 0;
            acc[tag.label] += 1;
        });
        return acc;
    }, {} as Record<string, number>);

    const avgs = {
        dmg: Math.floor(filteredMatches.reduce((acc, m) => acc + m.detail.totalDamageDealtToChampions, 0) / filteredMatches.length) || 0,
        vision: (filteredMatches.reduce((acc, m) => acc + m.detail.visionScore, 0) / filteredMatches.length).toFixed(1) || "0",
        deaths: (filteredMatches.reduce((acc, m) => acc + m.detail.deaths, 0) / filteredMatches.length).toFixed(1) || "0"
    };

    return (
        <main className="min-h-screen bg-[#0a0a0a] text-slate-200">
            <div className="border-b border-white/5 bg-[#111] sticky top-0 z-[100] backdrop-blur-md bg-opacity-80 px-6 py-4">
                <div className="container mx-auto flex justify-between items-center text-slate-100 italic tracking-tighter font-black text-xl">
                    <h1>WHO <span className="text-blue-500">CARRIED?</span></h1>
                    <div className="flex gap-2 shrink-0">
                        <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="소환사명 #태그" className="w-48 md:w-80 bg-black/40 border-white/10" onKeyDown={(e) => e.key === "Enter" && handleSearch()} />
                        <Button size="sm" onClick={handleSearch} disabled={loading} className="bg-blue-600 hover:bg-blue-500 font-bold italic">
                            {loading ? <Loader2 className="animate-spin w-4 h-4" /> : "검색"}
                        </Button>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-6 py-12">
                <div className="flex bg-[#161616] p-1 rounded-xl border border-white/5 w-fit mb-8">
                    {QUEUES.map((q) => (
                        <button key={q.id} onClick={() => setSelectedQueue(q.id)} className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all", selectedQueue === q.id ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-300")}>
                            {q.icon} {q.label}
                        </button>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
                    <div className="lg:col-span-1 flex flex-col gap-6">
                        {/* 프로필 카드 */}
                        <div className="bg-[#161616] border border-white/5 rounded-3xl p-8 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-32 bg-blue-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                            <div className="relative z-10 flex flex-col items-center text-center">
                                <div className="w-24 h-24 rounded-3xl bg-slate-800 mb-6 border-4 border-[#1a1a1a] shadow-2xl overflow-hidden relative">
                                    <img src={`https://ddragon.leagueoflegends.com/cdn/15.1.1/img/profileicon/${profile.iconId}.png`} alt="Icon" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.src = "https://ddragon.leagueoflegends.com/cdn/15.1.1/img/profileicon/29.png")} />
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
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[200px] bg-slate-900 border border-white/20 text-white text-[10px] px-2 py-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[200] shadow-2xl">
                                            {TAG_DESCRIPTIONS[tag] || "특별한 훈장"}
                                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-slate-900"></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 평균 기여도 카드 */}
                        <div className="group/guide bg-[#161616] border border-white/5 rounded-3xl p-8 flex flex-col items-center justify-center relative min-h-[300px]">
                            <div className={cn("absolute inset-0 opacity-10 blur-3xl", tier.bg.replace('/10', '/30'))}></div>
                            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-2 z-10 flex items-center gap-1.5 cursor-help">
                                평균 기여도 <Info size={14} className="text-slate-600" />
                            </h3>
                            <div className={cn("text-8xl font-black mb-4 italic z-10", tier.color)}>{averageScore}<span className="text-2xl align-top opacity-50 not-italic ml-1">점</span></div>
                            <div className={cn("px-6 py-2 rounded-full font-black text-sm uppercase tracking-widest z-10", tier.bg, tier.color)}>{tier.name}</div>
                            <div className="absolute top-10 left-1/2 -translate-x-1/2 w-64 bg-slate-900 border border-white/10 p-5 rounded-2xl shadow-2xl opacity-0 group-hover/guide:opacity-100 transition-all pointer-events-none z-[110] translate-y-2 group-hover/guide:translate-y-0">
                                <h4 className="text-xs font-bold text-white mb-4 border-b border-white/5 pb-2">점수대별 등급 가이드</h4>
                                <div className="space-y-2.5">
                                    {SCORE_GUIDE.map((g, idx) => (
                                        <div key={idx} className="flex justify-between items-center text-[11px]">
                                            <span className="text-slate-400 font-mono">{g.range}</span>
                                            <span className={cn("font-bold", g.color)}>{g.label}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="absolute top-[-8px] left-1/2 -translate-x-1/2 border-8 border-transparent border-b-slate-900"></div>
                            </div>
                        </div>


                        {/* 챔피언별 승률 (신규 추가) */}
                        <div className="bg-[#161616] p-5 rounded-3xl border border-white/5">
                            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2"><Trophy size={12} /> 최근 모스트 챔피언</h4>
                            <div className="space-y-3">
                                {championStats.slice(0, 5).map((champ) => (
                                    <div key={champ.name} className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/5">
                                                <img
                                                    src={`https://ddragon.leagueoflegends.com/cdn/15.1.1/img/champion/${champ.name === "Mel" ? "Mel" : champ.name}.png`}
                                                    className="w-full h-full object-cover scale-110"
                                                    alt={champ.name}
                                                    onError={(e) => (e.currentTarget.src = "https://ddragon.leagueoflegends.com/cdn/img/champion/tiles/Mel_0.jpg")}
                                                />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-slate-200">{champ.name}</span>
                                                <span className="text-[10px] text-slate-500 font-medium">{champ.total}게임</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className={cn("text-xs font-black italic", champ.winRate >= 60 ? "text-blue-400" : champ.winRate >= 40 ? "text-slate-200" : "text-red-400")}>{champ.winRate}%</div>
                                            <div className="text-[9px] text-slate-600 font-bold uppercase">{champ.win}승 {champ.total - champ.win}패</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-2 space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <StatBox icon={<Sword size={20} />} label="교전 능력" value={avgs.dmg > 25000 ? "S+" : "A"} sub={`평균 딜량 ${avgs.dmg.toLocaleString()}`} color="text-red-500" bg="bg-red-500/10" />
                            <StatBox icon={<Eye size={20} />} label="시야 장악" value={Number(avgs.vision) > 30 ? "S" : "A"} sub={`평균 시야점수 ${avgs.vision}`} color="text-blue-500" bg="bg-blue-500/10" />
                            <StatBox icon={<Shield size={20} />} label="생존력" value={Number(avgs.deaths) < 4 ? "S" : "A"} sub={`평균 데스 ${avgs.deaths}`} color="text-green-500" bg="bg-green-500/10" />
                        </div>

                        <div className="flex flex-col gap-3">
                            {filteredMatches.map((match) => {
                                const dynamicTags = getDynamicTags(match);
                                const champImg = match.champion === "Mel" ? "Mel" : match.champion;
                                return (
                                    <div key={match.id} className={cn("relative border rounded-xl p-4 flex flex-wrap md:flex-nowrap items-center gap-4 transition-all z-10 hover:z-50", match.result === "WIN" ? "bg-[#131313] border-white/5 hover:border-blue-500/30" : "bg-red-500/5 border-red-500/10 hover:border-red-500/30")}>
                                        <div className={cn("absolute left-0 top-0 bottom-0 w-1", match.result === "WIN" ? "bg-blue-500" : "bg-red-500")}></div>
                                        <div className="flex flex-col w-20 pl-2">
                                            <span className={cn("font-bold text-xs", match.result === "WIN" ? "text-blue-400" : "text-red-400")}>{match.result === "WIN" ? "승리" : "패배"}</span>
                                            <span className="text-[10px] text-slate-600">{match.date}</span>
                                        </div>
                                        <div className="flex items-center gap-3 w-36 shrink-0">
                                            <div className="w-10 h-10 rounded-full bg-slate-800 overflow-hidden border border-white/10 shrink-0">
                                                <img
                                                    src={`https://ddragon.leagueoflegends.com/cdn/15.1.1/img/champion/${champImg}.png`}
                                                    alt={match.champion}
                                                    className="w-full h-full object-cover scale-110"
                                                    onError={(e) => {
                                                        e.currentTarget.src = "https://ddragon.leagueoflegends.com/cdn/img/champion/tiles/Mel_0.jpg";
                                                        e.currentTarget.onerror = () => e.currentTarget.src = "https://ddragon.leagueoflegends.com/cdn/15.1.1/img/profileicon/29.png";
                                                    }}
                                                />
                                            </div>
                                            <div className="flex flex-col truncate">
                                                <span className="font-bold text-sm text-slate-200">{match.champion}</span>
                                                <span className="text-[10px] text-slate-500 font-bold uppercase">{match.role}</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col w-24 shrink-0">
                                            <span className="text-sm font-medium text-slate-300">{match.kda}</span>
                                            <span className="text-[10px] text-slate-600 tracking-tighter italic">KDA Score</span>
                                        </div>

                                        <div className="flex-1 flex justify-end items-center gap-4 min-w-0">
                                            <div className="flex flex-wrap justify-end gap-1.5 max-w-[300px]">
                                                {dynamicTags.map((tag, idx) => (
                                                    <div key={idx} className="group/tag relative">
                                                        <span className={cn("cursor-help text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider transition-colors", tag.bg, tag.color, "hover:brightness-125")}>
                                                            {tag.label}
                                                        </span>
                                                        <div className="absolute bottom-full right-0 mb-2 w-max max-w-[180px] bg-slate-900 border border-white/20 text-white text-[9px] px-2 py-1.5 rounded opacity-0 group-hover/tag:opacity-100 transition-opacity pointer-events-none z-[300] shadow-2xl">
                                                            {TAG_DESCRIPTIONS[tag.label] || "특별한 훈장"}
                                                            <div className="absolute top-full right-4 border-[5px] border-transparent border-t-slate-900"></div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="text-right shrink-0 ml-2">
                                                <div className={cn("text-2xl font-black italic leading-none", match.result === "WIN" ? getTier(match.score).color : "text-red-400")}>{match.score}</div>
                                                <div className="text-[9px] text-slate-600 font-bold uppercase mt-1">Score</div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}

function StatBox({ icon, label, value, sub, color, bg }: any) {
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
        <Suspense fallback={<div className="bg-[#0a0a0a] min-h-screen text-white flex items-center justify-center">Loading...</div>}>
            <AnalysisContent />
        </Suspense>
    );
}