"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { Search, Trophy, Disc, Target, Eye, Shield, Sword, Star, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Mock Data Types
interface Match {
    id: number;
    champion: string;
    role: "TOP" | "JNG" | "MID" | "ADC" | "SUP";
    result: "WIN" | "LOSE";
    kda: string;
    score: number;
    date: string;
    tags: Array<{ type: "Vision" | "Dmg" | "Survival" | "KDA"; label: string; color: string; bg: string }>;
}

// Mock Data Generator
const generateMockMatches = (): Match[] => {
    const roles = ["TOP", "JNG", "MID", "ADC", "SUP"] as const;
    const champs = ["Ahri", "Lee Sin", "Thresh", "Ezreal", "Aatrox", "Yasuo", "Yone"];

    return Array.from({ length: 20 }).map((_, i) => {
        const score = Math.floor(Math.random() * 100) + 50;
        const generatedTags: Match['tags'] = [];

        // Mock Logic: Add tags based on random chance (simulating high performance)
        if (Math.random() > 0.6) generatedTags.push({ type: "Dmg", label: "딜량 1등", color: "text-red-400", bg: "bg-red-500/20" });
        if (Math.random() > 0.6) generatedTags.push({ type: "Vision", label: "시야 장악", color: "text-blue-400", bg: "bg-blue-500/20" });
        if (Math.random() > 0.7) generatedTags.push({ type: "Survival", label: "불사신", color: "text-green-400", bg: "bg-green-500/20" });

        return {
            id: i,
            champion: champs[Math.floor(Math.random() * champs.length)],
            role: roles[Math.floor(Math.random() * roles.length)],
            result: Math.random() > 0.4 ? "WIN" : "LOSE",
            kda: `${Math.floor(Math.random() * 10)}/${Math.floor(Math.random() * 8)}/${Math.floor(Math.random() * 15)}`,
            score: score,
            date: `${Math.floor(Math.random() * 24)}시간 전`,
            tags: generatedTags
        };
    });
};

export default function AnalysisPage() {
    const searchParams = useSearchParams();
    const summoner = searchParams.get("summoner") || "Hide on bush";
    const [matches, setMatches] = useState<Match[]>([]);

    useEffect(() => {
        setMatches(generateMockMatches());
    }, []);

    const totalScore = matches.reduce((acc, curr) => acc + curr.score, 0);
    const averageScore = Math.floor(totalScore / matches.length);

    // Example "In-bun" Calculation (Mock)
    const getTier = (score: number) => {
        if (score >= 120) return { name: "CARRY", color: "text-blue-400", bg: "bg-blue-500/10" };
        if (score >= 100) return { name: "1인분", color: "text-green-400", bg: "bg-green-500/10" };
        if (score >= 80) return { name: "버스승객", color: "text-yellow-400", bg: "bg-yellow-500/10" };
        return { name: "트롤", color: "text-red-400", bg: "bg-red-500/10" };
    };

    const tier = getTier(averageScore);

    // --- Detailed Stats Calculation ---
    // 1. Role-based Stats
    // 1. Role-based Stats
    const roleStats = matches.reduce((acc, match) => {
        if (!acc[match.role]) acc[match.role] = { count: 0, totalScore: 0, k: 0, d: 0, a: 0 };

        const [k, d, a] = match.kda.split('/').map(Number);

        acc[match.role].count += 1;
        acc[match.role].totalScore += match.score;
        acc[match.role].k += k;
        acc[match.role].d += d;
        acc[match.role].a += a;
        return acc;
    }, {} as Record<string, { count: number, totalScore: number, k: number, d: number, a: number }>);

    // 2. Tag Counts
    const tagCounts = matches.reduce((acc, match) => {
        match.tags.forEach(tag => {
            if (!acc[tag.label]) acc[tag.label] = 0;
            acc[tag.label] += 1;
        });
        return acc;
    }, {} as Record<string, number>);


    return (
        <main className="min-h-screen bg-[#0a0a0a] text-slate-200">

            {/* Header / Search Bar Compact */}
            <div className="border-b border-white/5 bg-[#111] sticky top-0 z-50 backdrop-blur-md bg-opacity-80">
                <div className="container mx-auto px-6 py-4 flex justify-between items-center">
                    <h1 className="font-black text-xl italic tracking-tighter text-slate-100 hidden md:block">
                        WHO <span className="text-blue-500">CARRIED?</span>
                    </h1>
                    <div className="flex w-full md:w-auto gap-2">
                        <div className="relative flex-1 md:w-96">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                            <Input
                                defaultValue={summoner}
                                className="pl-10 bg-black/40 border-white/10"
                            />
                        </div>
                        <Button size="sm" className="bg-blue-600 hover:bg-blue-500 font-bold italic">
                            검색
                        </Button>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-6 py-12">
                {/* Profile & Summary Section */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">

                    {/* Left: Summoner Profile Card */}
                    <div className="lg:col-span-1 flex flex-col gap-6">
                        <div className="bg-[#161616] border border-white/5 rounded-3xl p-8 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-32 bg-blue-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

                            <div className="relative z-10 flex flex-col items-center text-center">
                                <div className="w-24 h-24 rounded-3xl bg-slate-800 mb-6 border-4 border-[#1a1a1a] shadow-2xl overflow-hidden relative group">
                                    <div className="absolute inset-0 bg-blue-500/20 group-hover:bg-transparent transition-all"></div>
                                    {/* Avatar Placeholder */}
                                    <div className="flex items-center justify-center h-full text-xs text-slate-600 font-mono">IMG</div>
                                </div>
                                <h2 className="text-2xl font-bold text-white mb-2">{summoner} <span className="text-slate-500 text-lg font-normal">#KR1</span></h2>
                                <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-800/50 rounded-full border border-white/5 text-xs font-bold text-slate-400 mb-6">
                                    <span>LV. 452</span>
                                    <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
                                    <span className="text-yellow-500">GOLD II</span>
                                </div>

                                <div className="grid grid-cols-3 gap-2 w-full pt-6 border-t border-white/5">
                                    <div className="text-center">
                                        <div className="text-xs text-slate-500 mb-1 uppercase font-bold tracking-widest">승률</div>
                                        <div className="text-xl font-bold text-slate-200">52%</div>
                                    </div>
                                    <div className="text-center border-l border-white/5">
                                        <div className="text-xs text-slate-500 mb-1 uppercase font-bold tracking-widest">평점</div>
                                        <div className="text-xl font-bold text-slate-200">3.42</div>
                                    </div>
                                    <div className="text-center border-l border-white/5">
                                        <div className="text-xs text-slate-500 mb-1 uppercase font-bold tracking-widest">게임 수</div>
                                        <div className="text-xl font-bold text-slate-200">142</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Contribution Score Card */}
                        <div className="bg-[#161616] border border-white/5 rounded-3xl p-8 flex flex-col items-center justify-center relative min-h-[300px] z-20">
                            {/* Background Container for clipping effects */}
                            <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
                                <div className={cn("absolute inset-0 opacity-10 blur-3xl", tier.bg.replace('/10', '/30'))}></div>
                            </div>

                            <div className="relative group cursor-help flex flex-col items-center z-10">
                                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    평균 1인분 기여도
                                </h3>

                                <div className={cn("text-8xl font-black mb-4 italic leading-none transition-transform group-hover:scale-105 duration-300", tier.color)}>
                                    {averageScore}
                                    <span className="text-2xl align-top opacity-50 not-italic ml-1">점</span>
                                </div>
                                <div className={cn("px-6 py-2 rounded-full font-black text-sm uppercase tracking-widest transition-transform group-hover:scale-105 duration-300", tier.bg, tier.color)}>
                                    {tier.name}
                                </div>

                                <p className="mt-8 text-center text-sm text-slate-400 max-w-[200px] leading-relaxed">
                                    최근 20게임 기준<br />
                                    당신은 평균 <strong className="text-white">1.2인분</strong>을 하고 있습니다.
                                </p>

                                {/* Tooltip - Now inside the group wrapper and visible outside due to removed overflow-hidden on parent */}
                                {/* Tooltip - Solid background, no transparency, high z-index */}
                                <div className="absolute top-full mt-4 w-72 bg-black border border-white/20 rounded-xl p-5 shadow-[0_20px_50px_rgba(0,0,0,0.9)] opacity-0 group-hover:opacity-100 transition-all pointer-events-none group-hover:pointer-events-auto z-[9999] translate-y-2 group-hover:translate-y-0">
                                    <h4 className="font-bold text-slate-200 mb-4 text-xs uppercase tracking-wider border-b border-white/10 pb-2 text-center">점수 시스템 가이드</h4>
                                    <ul className="space-y-3">
                                        <li className="flex justify-between items-center text-xs">
                                            <span className="text-blue-400 font-bold bg-blue-500/10 px-2 py-1 rounded">CARRY</span>
                                            <span className="text-slate-400 font-mono">120+ pts</span>
                                        </li>
                                        <li className="text-[10px] text-slate-500 leading-tight text-right">팀을 승리로 이끄는 압도적 활약</li>

                                        <li className="flex justify-between items-center text-xs">
                                            <span className="text-green-400 font-bold bg-green-500/10 px-2 py-1 rounded">1인분</span>
                                            <span className="text-slate-400 font-mono">100~119</span>
                                        </li>
                                        <li className="text-[10px] text-slate-500 leading-tight text-right">맡은 역할 충실히 수행</li>

                                        <li className="flex justify-between items-center text-xs">
                                            <span className="text-yellow-400 font-bold bg-yellow-500/10 px-2 py-1 rounded">버스승객</span>
                                            <span className="text-slate-400 font-mono">80~99</span>
                                        </li>
                                        <li className="text-[10px] text-slate-500 leading-tight text-right">팀원 덕분에 이기거나 묻어감</li>

                                        <li className="flex justify-between items-center text-xs">
                                            <span className="text-red-400 font-bold bg-red-500/10 px-2 py-1 rounded">트롤</span>
                                            <span className="text-slate-400 font-mono">0~79</span>
                                        </li>
                                        <li className="text-[10px] text-slate-500 leading-tight text-right">팀 패배의 주원인</li>
                                    </ul>
                                    <div className="mt-4 pt-3 border-t border-white/5 text-[9px] text-slate-600 text-center">
                                        * 점수는 라인별 가중치가 적용됩니다.
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* Detailed Stats Cards */}
                        <div className="grid grid-cols-2 gap-3">
                            {/* Role Stats */}
                            <div className="bg-[#161616] p-5 rounded-3xl border border-white/5 relative overflow-hidden group hover:border-white/10 transition-colors">
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Trophy size={12} /> 라인별 성적
                                </h4>
                                <div className="space-y-3 relative z-10">
                                    {Object.entries(roleStats).map(([role, stats]) => {
                                        const avg = Math.floor(stats.totalScore / stats.count);
                                        const roleTier = getTier(avg);
                                        const avgKda = stats.d === 0 ? "Perfect" : ((stats.k + stats.a) / stats.d).toFixed(2);

                                        return (
                                            <div key={role} className="flex items-center justify-between text-xs">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-slate-300 w-8">{role}</span>
                                                    <span className="text-[9px] text-slate-500 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">{stats.count}판</span>
                                                    <span className="text-[10px] text-slate-400 font-mono tracking-tighter">
                                                        ({avgKda}:1)
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-black mr-1", roleTier.bg, roleTier.color)}>{roleTier.name}</span>
                                                    <span className={cn("font-bold font-mono", roleTier.color)}>{avg}</span>
                                                    <div className={cn("w-2 h-2 rounded-full", roleTier.bg.replace("/10", ""), roleTier.color)}></div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Tag Collection */}
                            <div className="bg-[#161616] p-5 rounded-3xl border border-white/5 relative overflow-hidden group hover:border-white/10 transition-colors">
                                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Star size={12} /> 훈장 컬렉션
                                </h4>
                                <div className="flex flex-col gap-2 relative z-10">
                                    {Object.entries(tagCounts).map(([tag, count]) => (
                                        <div key={tag} className="flex items-center justify-between text-xs p-2 rounded-lg bg-white/5 border border-white/5">
                                            <span className="font-medium text-slate-300">{tag}</span>
                                            <span className="font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded text-[10px]">x{count}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Grid continues... */}


                    {/* Right: Analysis Details & Match History */}
                    <div className="lg:col-span-2 space-y-8">

                        {/* Role Performance Cards (Mock logic) */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-[#161616] p-6 rounded-2xl border border-white/5 flex flex-col gap-4">
                                <div className="flex justify-between items-start">
                                    <div className="p-3 bg-red-500/10 rounded-xl text-red-500"><Sword size={20} /></div>
                                    <div className="text-right">
                                        <div className="text-2xl font-bold">A+</div>
                                        <div className="text-[10px] text-slate-500 font-bold uppercase">교전 능력</div>
                                    </div>
                                </div>
                                <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-red-500 w-[85%]"></div>
                                </div>
                                <p className="text-xs text-slate-400 leading-relaxed">
                                    평균 딜량 <span className="text-red-400">22,400</span> (상위 12%)<br />
                                    골드 대비 효율이 매우 좋습니다.
                                </p>
                            </div>

                            <div className="bg-[#161616] p-6 rounded-2xl border border-white/5 flex flex-col gap-4">
                                <div className="flex justify-between items-start">
                                    <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500"><Eye size={20} /></div>
                                    <div className="text-right">
                                        <div className="text-2xl font-bold">B-</div>
                                        <div className="text-[10px] text-slate-500 font-bold uppercase">시야 장악</div>
                                    </div>
                                </div>
                                <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500 w-[45%]"></div>
                                </div>
                                <p className="text-xs text-slate-400 leading-relaxed">
                                    시야 점수 <span className="text-blue-400">1.2/min</span><br />
                                    제어 와드 구매가 부족합니다.
                                </p>
                            </div>

                            <div className="bg-[#161616] p-6 rounded-2xl border border-white/5 flex flex-col gap-4">
                                <div className="flex justify-between items-start">
                                    <div className="p-3 bg-green-500/10 rounded-xl text-green-500"><Shield size={20} /></div>
                                    <div className="text-right">
                                        <div className="text-2xl font-bold">S</div>
                                        <div className="text-[10px] text-slate-500 font-bold uppercase">생존력</div>
                                    </div>
                                </div>
                                <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-green-500 w-[92%]"></div>
                                </div>
                                <p className="text-xs text-slate-400 leading-relaxed">
                                    데스 <span className="text-green-400">2.1</span> (극소)<br />
                                    매우 안정적인 플레이를 합니다.
                                </p>
                            </div>
                        </div>


                        {/* Match List */}
                        <div>
                            <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                                <Disc className="text-blue-500 animate-spin-slow" size={16} /> 최근 20게임 분석
                            </h3>

                            <div className="space-y-3">
                                {matches.map((match) => (
                                    <div key={match.id} className="group relative bg-[#131313] hover:bg-[#181818] border border-white/5 rounded-xl p-4 transition-all duration-300 flex flex-wrap md:flex-nowrap items-center gap-4">

                                        {/* Result Bar */}
                                        <div className={cn("absolute left-0 top-0 bottom-0 w-1 rounded-l-xl", match.result === "WIN" ? "bg-blue-500" : "bg-slate-700")}></div>

                                        {/* Info */}
                                        <div className="flex flex-col w-20 pl-4">
                                            <span className={cn("font-bold text-xs uppercase mb-1", match.result === "WIN" ? "text-blue-400" : "text-slate-500")}>
                                                {match.result === "WIN" ? "승리" : "패배"}
                                            </span>
                                            <span className="text-[10px] text-slate-600">{match.date}</span>
                                        </div>

                                        {/* Champ & Role */}
                                        <div className="flex items-center gap-3 w-32">
                                            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-[10px] text-slate-500 overflow-hidden border border-white/10">
                                                ICON
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-sm text-slate-200">{match.champion}</span>
                                                <span className="text-[10px] text-slate-500 font-bold">{match.role}</span>
                                            </div>
                                        </div>

                                        {/* KDA */}
                                        <div className="flex flex-col w-24">
                                            <span className="text-sm font-medium text-slate-300 tracking-wider">{match.kda}</span>
                                            <span className="text-[10px] text-slate-600">3.44:1</span>
                                        </div>


                                        {/* Contribution Score (Highlight) */}
                                        <div className="flex-1 flex justify-end items-center gap-6 pr-4">

                                            {/* Role Weight Badge Example -> Dynamic Tags */}
                                            <div className="hidden md:flex flex-col items-end gap-1">
                                                <div className="flex gap-1">
                                                    {match.tags.map((tag, idx) => (
                                                        <span key={idx} className={cn("text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider", tag.bg, tag.color)}>
                                                            {tag.label}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="text-right">
                                                <div className={cn("text-2xl font-black italic",
                                                    match.score >= 120 ? "text-blue-400" :
                                                        match.score >= 100 ? "text-green-400" :
                                                            match.score >= 80 ? "text-slate-400" : "text-red-400"
                                                )}>
                                                    {match.score}
                                                </div>
                                                <div className="text-[9px] text-slate-600 font-bold uppercase tracking-wider">Score</div>
                                            </div>

                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </main>
    );
}
