"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, useMemo, useCallback } from "react";
import { Loader2, Users, Trophy, TrendingUp, ShieldAlert, CheckCircle2, Search, ArrowLeft, Layers, User, Eye, Skull, Info, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { analyzeSummoner, AnalysisResult } from "../actions/analyze";
import { Suspense } from "react";
import Link from "next/link";

const QUEUE_TYPES = [
    { id: "all", label: "전체 매치", icon: <Layers size={14} /> },
    { id: "420", label: "솔랭/듀오", icon: <User size={14} /> },
    { id: "440", label: "자유 랭크", icon: <Users size={14} /> },
];

const TITLES = {
    DEATHS: (isBad: boolean) => isBad
        ? { title: "300원 맛집", desc: "상대에게 가장 많은 골드를 기부함", color: "red" }
        : { title: "불사조", desc: "위험한 순간에도 끝까지 살아남음", color: "orange" },
    EFFICIENCY: (isBad: boolean) => isBad
        ? { title: "세금 도둑", desc: "골드 수급량 대비 영양가 없는 딜량", color: "stone" }
        : { title: "성장형 엔진", desc: "자원을 바탕으로 팀의 승리를 견인함", color: "emerald" },
    VISION: (isBad: boolean) => isBad
        ? { title: "망원경", desc: "시야 점수가 권장치보다 현저히 낮음", color: "slate" }
        : { title: "은밀한 조력자", desc: "보이지 않는 곳에서 팀을 지원함", color: "cyan" },
    DAMAGE: (isBad: boolean) => isBad
        ? { title: "평화주의자", desc: "팀 내 대인 피해량 기여도가 가장 낮음", color: "green" }
        : { title: "철벽 방어", desc: "딜보다 중요한 생존과 위치 선정", color: "blue" },
    SUSPECT: (isBad: boolean) => isBad
        ? { title: "범인(Suspect)", desc: "포지션 대비 기여도가 가장 처참함", color: "orange" }
        : { title: "숨은 공로자", desc: "기록 이상의 가치를 보여준 멤버", color: "purple" },
};

/** * 포지션별 점수 보정 로직 */
const calculatePositionScore = (baseScore: number, role: string, stats: { dmg: number; vision: number; deaths: number }) => {
    let penalty = 0;
    let bonus = 0;

    switch (role) {
        case "SUP":
            if (stats.vision < 15) penalty += 25;
            else if (stats.vision < 30) penalty += 10;
            if (stats.dmg > 18000) bonus += 10;
            break;
        case "JNG":
            if (stats.vision < 12) penalty += 15;
            break;
        case "ADC":
            if (stats.dmg < 15000) penalty += 20;
            if (stats.deaths > 8) penalty += 15;
            break;
        case "TOP":
        case "MID":
            if (stats.dmg < 12000) penalty += 15;
            break;
    }

    return Math.max(0, baseScore + bonus - penalty);
};

function SquadAnalysisContent() {
    const searchParams = useSearchParams();
    const summonerParam = searchParams.get("summoner") || "";
    const squadParam = searchParams.get("squad") || "";

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [data, setData] = useState<AnalysisResult | null>(null);
    const [selectedQueue, setSelectedQueue] = useState("all");

    const squadTargetList = useMemo(() => {
        const squad = squadParam ? squadParam.split(',') : [];
        return [summonerParam, ...squad]
            .filter(Boolean)
            .map(m => m.toUpperCase().replace(/\s/g, ''));
    }, [summonerParam, squadParam]);

    const fetchSquadData = useCallback(async (isRefresh = false) => {
        if (!summonerParam) return;

        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        try {
            const [name, tag] = summonerParam.split("#");
            const result = await analyzeSummoner(name, tag);
            setData(result);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [summonerParam]);

    useEffect(() => {
        fetchSquadData();
    }, [fetchSquadData]);

    const commonMatches = useMemo(() => {
        if (!data) return [];
        return data.matches.filter(match => {
            const matchQueueId = (match as any).queueId?.toString();
            const isCorrectQueue = selectedQueue === "all" || matchQueueId === selectedQueue;
            if (!isCorrectQueue) return false;

            const matchParticipantIds = match.allParticipants.map(p =>
                `${p.gameName}#${p.tagLine}`.toUpperCase().replace(/\s/g, '')
            );
            return squadTargetList.every(targetId => matchParticipantIds.includes(targetId));
        });
    }, [data, squadTargetList, selectedQueue]);

    const filteredHierarchy = useMemo(() => {
        if (commonMatches.length === 0) return [];
        const statsMap: Record<string, any> = {};

        commonMatches.forEach(match => {
            match.allParticipants.forEach(p => {
                const pFullId = `${p.gameName}#${p.tagLine}`.toUpperCase().replace(/\s/g, '');
                if (squadTargetList.includes(pFullId)) {
                    if (!statsMap[pFullId]) {
                        statsMap[pFullId] = {
                            name: p.gameName, tag: p.tagLine, totalScore: 0, matchCount: 0,
                            deaths: 0, kills: 0, assists: 0, dmg: 0, gold: 0, vision: 0,
                            role: (p as any).role
                        };
                    }

                    const adjustedScore = calculatePositionScore(p.score, (p as any).role || "UNKNOWN", {
                        dmg: p.damage,
                        vision: (p as any).visionScore || 0,
                        deaths: p.deaths
                    });

                    statsMap[pFullId].totalScore += adjustedScore;
                    statsMap[pFullId].matchCount += 1;
                    statsMap[pFullId].deaths += p.deaths;
                    const [k, , a] = p.kda.split('/').map(Number);
                    statsMap[pFullId].kills += k;
                    statsMap[pFullId].assists += a;
                    statsMap[pFullId].dmg += p.damage;
                    statsMap[pFullId].gold += p.gold;
                    statsMap[pFullId].vision += (p as any).visionScore || 0;
                }
            });
        });

        // 1. 먼저 평균 데이터를 계산하여 배열로 만듭니다.
        const result = Object.values(statsMap).map(s => ({
            ...s,
            avgScore: Math.floor(s.totalScore / s.matchCount),
            avgKDA: `${(s.kills / s.matchCount).toFixed(1)}/${(s.deaths / s.matchCount).toFixed(1)}/${(s.assists / s.matchCount).toFixed(1)}`,
            avgKills: (s.kills / s.matchCount).toFixed(1),
            avgAssists: (s.assists / s.matchCount).toFixed(1),
            avgDmg: Math.floor(s.dmg / s.matchCount),
            avgVision: (s.vision / s.matchCount).toFixed(1),
            efficiency: Math.floor((s.dmg / (s.gold || 1)) * 100),
            avgDeaths: (s.deaths / s.matchCount).toFixed(1)
        }));

        // 2. 계산된 avgScore를 기준으로 내림차순 정렬을 수행합니다.
        return result.sort((a, b) => b.avgScore - a.avgScore);
    }, [commonMatches, squadTargetList]);

    const getIdentity = (m: any, idx: number, total: number) => {
        if (idx === 0) return { label: "신(GOD)", color: "bg-purple-600" };
        if (m.avgScore >= 100) {
            if (idx === total - 1) return { label: "든든한 국밥", color: "bg-blue-800" };
            return { label: "승리의 주역", color: "bg-sky-700" };
        }
        if (Number(m.avgDeaths) >= 10) return { label: "300원 맛집", color: "bg-red-900" };
        if (m.efficiency < 40) return { label: "국가부도", color: "bg-stone-800" };
        if (Number(m.avgVision) < 8) return { label: "장님", color: "bg-slate-900" };
        if (idx === total - 1) return { label: "지명수배자", color: "bg-red-600" };

        const [k, , a] = m.avgKDA.split('/').map(Number);
        if (k > 8 && a < 5) return { label: "숟가락 살인마", color: "bg-rose-700" };
        if (a > 15) return { label: "마더 테레사", color: "bg-yellow-600" };
        if (m.efficiency > 120) return { label: "가성비 괴물", color: "bg-emerald-500" };

        return { label: "평범한 시민", color: "bg-slate-700" };
    };

    if (loading) return <main className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center text-white"><Loader2 className="animate-spin text-blue-500 mb-6" size={60} /><h2 className="text-2xl font-black italic animate-pulse">SQUAD SUSPECT SCANNING...</h2></main>;

    return (
        <main className="min-h-screen bg-[#060606] text-slate-200 pb-20 font-sans">
            <div className="bg-gradient-to-b from-blue-900/10 to-transparent border-b border-white/5 py-16">
                <div className="container mx-auto px-6 text-center">
                    <div className="flex items-center justify-center gap-4 mb-8 mx-auto relative z-30 flex-wrap">
                        <div className="flex bg-[#111] p-1 rounded-xl border border-white/5 w-fit">
                            {QUEUE_TYPES.map((q) => (
                                <button key={q.id} onClick={() => setSelectedQueue(q.id)} className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all", selectedQueue === q.id ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-300")}>
                                    {q.icon} {q.label}
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={() => fetchSquadData(true)}
                            disabled={refreshing}
                            className="bg-white/5 hover:bg-white/10 border border-white/5 p-3 rounded-xl transition-all disabled:opacity-50 group"
                        >
                            <RefreshCw size={18} className={cn("text-blue-500 transition-all", refreshing && "animate-spin")} />
                        </button>
                    </div>

                    {commonMatches.length > 0 ? (
                        <>
                            <div className="flex items-center justify-center gap-2 text-blue-500 font-bold mb-4 bg-blue-500/10 px-4 py-1 rounded-full border border-blue-500/20 text-xs tracking-tighter uppercase w-fit mx-auto">
                                <CheckCircle2 size={14} /> Full Squad Match: {commonMatches.length} Games
                            </div>
                            <h1 className="text-5xl md:text-7xl font-black italic tracking-tighter text-white mb-12 uppercase">SQUAD <span className="text-blue-500">HIERARCHY</span></h1>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 max-w-7xl mx-auto">
                                {/* 1. 팀의 심장 (정렬된 배열의 0번) */}
                                <SquadCard title="팀의 심장" member={filteredHierarchy[0]} color="blue" description="보정 점수 1위, 포지션 역할을 가장 잘 수행함" />

                                {/* 2. 가성비 괴물 (효율 기준 재정렬) */}
                                <SquadCard title="가성비 괴물" member={[...filteredHierarchy].sort((a, b) => b.efficiency - a.efficiency)[0]} color="emerald" subText={`효율 ${[...filteredHierarchy].sort((a, b) => b.efficiency - a.efficiency)[0]?.efficiency}%`} description="적은 골드로 엄청난 딜을 뽑아내는 효율 깡패" />

                                {/* 3. 학살자 (킬 기준 재정렬) */}
                                <SquadCard title="학살자" member={[...filteredHierarchy].sort((a, b) => Number(b.avgKills) - Number(a.avgKills))[0]} color="rose" subText={`평균 ${[...filteredHierarchy].sort((a, b) => Number(b.avgKills) - Number(a.avgKills))[0]?.avgKills}킬`} description="킬 결정력이 가장 높은 핵심 공격수" />

                                {/* 4. 마더 테레사 (어시 기준 재정렬) */}
                                <SquadCard title="마더 테레사" member={[...filteredHierarchy].sort((a, b) => Number(b.avgAssists) - Number(a.avgAssists))[0]} color="yellow" subText={`평균 ${[...filteredHierarchy].sort((a, b) => Number(b.avgAssists) - Number(a.avgAssists))[0]?.avgAssists}어시`} description="아군을 돕는 데 가장 헌신적인 멤버" />

                                {/* 5. 협곡 등대 (시야 기준 재정렬) */}
                                <SquadCard title="협곡 등대" member={[...filteredHierarchy].sort((a, b) => Number(b.avgVision) - Number(a.avgVision))[0]} color="cyan" isVision description="시야 장악으로 팀의 생존을 책임짐" />

                                {(() => {
                                    const isBad = (m: any) => m.avgScore < 95;

                                    // 원본 배열 순서가 변하지 않도록 모두 스프레드 연산자([...])를 사용합니다.
                                    const worstDeath = [...filteredHierarchy].sort((a, b) => Number(b.avgDeaths) - Number(a.avgDeaths))[0];
                                    const tDeath = TITLES.DEATHS(isBad(worstDeath));

                                    const worstEff = [...filteredHierarchy].sort((a, b) => a.efficiency - b.efficiency)[0];
                                    const tEff = TITLES.EFFICIENCY(isBad(worstEff));

                                    const worstVision = [...filteredHierarchy].sort((a, b) => Number(a.avgVision) - Number(b.avgVision))[0];
                                    const tVision = TITLES.VISION(isBad(worstVision));

                                    const worstDmg = [...filteredHierarchy].sort((a, b) => a.avgDmg - b.avgDmg)[0];
                                    const tDmg = TITLES.DAMAGE(isBad(worstDmg));

                                    // 마지막 등수는 이미 정렬된 filteredHierarchy의 마지막 요소를 가져옵니다.
                                    const worstScore = filteredHierarchy[filteredHierarchy.length - 1];
                                    const tScore = TITLES.SUSPECT(isBad(worstScore));

                                    return (
                                        <>
                                            <SquadCard title={tDeath.title} member={worstDeath} color={tDeath.color} description={tDeath.desc} subText={`평균 ${worstDeath?.avgDeaths}데스`} />
                                            <SquadCard title={tEff.title} member={worstEff} color={tEff.color} description={tEff.desc} subText={`딜 효율 ${worstEff?.efficiency}%`} />
                                            <SquadCard title={tVision.title} member={worstVision} color={tVision.color} description={tVision.desc} subText={`시야 ${worstVision?.avgVision}점`} />
                                            <SquadCard title={tDmg.title} member={worstDmg} color={tDmg.color} description={tDmg.desc} subText={`평균 딜 ${worstDmg?.avgDmg.toLocaleString()}`} />
                                            <SquadCard title={tScore.title} member={worstScore} color={tScore.color} description={tScore.desc} subText="최종 평가" />
                                        </>
                                    );
                                })()}
                            </div>
                        </>
                    ) : (
                        <div className="py-20 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
                            <Search size={64} className="text-slate-800 mb-6" />
                            <h2 className="text-3xl font-black italic text-slate-500 mb-2 uppercase">NO DATA FOUND</h2>
                            <p className="text-slate-600 font-bold">해당 큐 타입으로 함께 플레이한 매치가 없습니다.</p>
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
                                        <th className="px-8 py-5 text-center">보정 인분 점수</th>
                                        <th className="px-8 py-5 text-right">정체성</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {filteredHierarchy.map((m, idx) => {
                                        const iden = getIdentity(m, idx, filteredHierarchy.length);
                                        return (
                                            <tr key={idx} className="hover:bg-white/[0.02] transition-colors group">
                                                <td className="px-8 py-6 font-black italic text-xl text-slate-700 group-hover:text-blue-500">#{idx + 1}</td>
                                                <td className="px-8 py-6 font-bold text-white">{m.name} <span className="text-[10px] text-slate-600 font-mono ml-1">#{m.tag}</span></td>
                                                <td className="px-8 py-6">
                                                    <div className="flex gap-6 items-center">
                                                        <div className="flex flex-col"><span className="text-[10px] text-slate-500 uppercase font-bold">KDA</span><span className="text-xs text-slate-300 font-mono">{m.avgKDA}</span></div>
                                                        <div className="flex flex-col"><span className="text-[10px] text-slate-500 uppercase font-bold">평균딜량</span><span className="text-xs text-slate-300 font-mono">{m.avgDmg.toLocaleString()}</span></div>
                                                        <div className="flex flex-col"><span className="text-[10px] text-slate-500 uppercase font-bold text-blue-400">시야점수</span><span className="text-xs text-blue-200 font-mono">{m.avgVision}</span></div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6 text-center"><span className={cn("text-2xl font-black italic", idx === 0 ? "text-blue-500" : "text-slate-400")}>{m.avgScore}</span></td>
                                                <td className="px-8 py-6 text-right">
                                                    <span className={cn("text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-tighter text-white", iden.color)}>
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

                    <div className="container mx-auto px-6 pb-20">
                        <div className="flex flex-col gap-6 max-w-6xl mx-auto">
                            {commonMatches.map((match) => {
                                // 1. 이 매치에 참여한 스쿼드 멤버들의 점수 계산 및 정렬
                                const squadPerformances = match.allParticipants
                                    .filter(p => squadTargetList.includes(`${p.gameName}#${p.tagLine}`.toUpperCase().replace(/\s/g, '')))
                                    .map(p => ({
                                        ...p,
                                        currentScore: calculatePositionScore(p.score, (p as any).role || "UNKNOWN", {
                                            dmg: p.damage,
                                            vision: (p as any).visionScore || 0,
                                            deaths: p.deaths
                                        })
                                    }))
                                    .sort((a, b) => a.currentScore - b.currentScore); // 낮은 점수 순 (0번이 꼴찌)

                                // 2. 범인 확정 조건
                                // - 최하위 점수가 90점 미만이고,
                                // - 1등과 꼴찌의 점수 차이가 25점 이상 벌어질 때만 '범인'으로 지목
                                const lowestScore = squadPerformances[0]?.currentScore;
                                const highestScore = squadPerformances[squadPerformances.length - 1]?.currentScore;
                                const hasSuspect = lowestScore < 90 && (highestScore - lowestScore) >= 25;
                                const suspectId = hasSuspect ? `${squadPerformances[0].gameName}#${squadPerformances[0].tagLine}` : null;

                                return (
                                    <div key={match.id} className={cn("relative border rounded-2xl overflow-hidden transition-all", match.result === "WIN" ? "bg-[#111] border-blue-500/10 hover:border-blue-500/30" : "bg-red-500/5 border-red-500/10 hover:border-red-500/30")}>
                                        <div className={cn("px-6 py-2 flex justify-between items-center border-b border-white/5", match.result === "WIN" ? "bg-blue-500/10" : "bg-red-500/10")}>
                                            <div className="flex items-center gap-4">
                                                <span className={cn("font-black italic text-sm", match.result === "WIN" ? "text-blue-400" : "text-red-400")}>{match.result === "WIN" ? "VICTORY" : "DEFEAT"}</span>
                                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{match.date}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {hasSuspect && (
                                                    <div className="flex items-center gap-1 text-orange-500 animate-pulse">
                                                        <Skull size={12} />
                                                        <span className="text-[10px] font-black uppercase italic">Suspect Detected</span>
                                                    </div>
                                                )}
                                                <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest italic ml-4">Squad Performance Report</div>
                                            </div>
                                        </div>

                                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                                            {squadPerformances.map((p, i) => {
                                                const isSuspect = suspectId === `${p.gameName}#${p.tagLine}`;

                                                return (
                                                    <div key={i} className={cn(
                                                        "bg-white/5 rounded-xl p-4 border transition-all relative overflow-hidden",
                                                        isSuspect ? "border-orange-500/50 bg-orange-500/5 shadow-[inset_0_0_20px_rgba(249,115,22,0.1)]" : "border-white/5"
                                                    )}>
                                                        {/* 범인일 경우 배경에 큰 해골 아이콘 살짝 표시 */}
                                                        {isSuspect && <Skull className="absolute -right-2 -bottom-2 text-orange-500/10" size={60} />}

                                                        <div className="flex items-center gap-3 mb-3 relative z-10">
                                                            <div className="relative shrink-0">
                                                                <img src={`https://ddragon.leagueoflegends.com/cdn/15.1.1/img/champion/${p.championName}.png`} className={cn("w-10 h-10 rounded-lg border", isSuspect ? "border-orange-500" : "border-white/10")} alt={p.championName} />
                                                                <div className={cn(
                                                                    "absolute -top-1 -right-1 text-[8px] font-black px-1 rounded italic text-white shadow-lg",
                                                                    isSuspect ? "bg-orange-600" : "bg-blue-600"
                                                                )}>
                                                                    {p.currentScore}
                                                                </div>
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className={cn("text-xs font-black truncate", isSuspect ? "text-orange-400" : "text-white")}>
                                                                    {p.gameName}
                                                                </div>
                                                                <div className="text-[9px] text-slate-500 font-bold uppercase truncate">{(p as any).role} | {p.championName}</div>
                                                            </div>
                                                        </div>

                                                        <div className="space-y-2 pt-2 border-t border-white/5 relative z-10">
                                                            <div className="flex justify-between items-center"><span className="text-[9px] text-slate-500 font-bold uppercase">KDA</span><span className="text-[10px] text-slate-300 font-mono font-bold">{p.kda}</span></div>
                                                            <div className="flex justify-between items-center"><span className="text-[9px] text-slate-500 font-bold uppercase flex items-center gap-1"><Eye size={10} /> Vision</span><span className="text-[10px] text-blue-400 font-mono font-bold">{(p as any).visionScore || 0}</span></div>
                                                        </div>

                                                        <div className="mt-3 relative z-10">
                                                            <span className={cn(
                                                                "text-[8px] px-2 py-0.5 rounded-full font-black uppercase block text-center truncate shadow-sm",
                                                                isSuspect ? "bg-orange-600 text-white animate-bounce" :
                                                                    p.currentScore >= 135 ? "bg-purple-600 text-white" :
                                                                        p.currentScore >= 115 ? "bg-blue-600 text-white" :
                                                                            p.currentScore >= 95 ? "bg-emerald-600 text-white" :
                                                                                "bg-slate-800 text-slate-400"
                                                            )}>
                                                                {isSuspect ? "🚨 이 판의 범인" : p.currentScore >= 135 ? "하드캐리" : p.currentScore >= 115 ? "ACE" : p.currentScore >= 95 ? "1인분" : "버스 승객"}
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
        blue: "text-blue-500 border-blue-500/30 shadow-[0_0_20px_-12px_rgba(59,130,246,0.3)]",
        red: "text-red-500 border-red-500/50 shadow-[0_0_30px_-10px_rgba(239,68,68,0.4)]",
        cyan: "text-cyan-500 border-cyan-500/20",
        emerald: "text-emerald-500 border-emerald-500/30",
        rose: "text-rose-500 border-rose-500/30",
        yellow: "text-yellow-500 border-yellow-500/30",
        orange: "text-orange-500 border-orange-500/30",
        stone: "text-stone-500 border-stone-500/50",
        slate: "text-slate-500 border-slate-500/20",
        green: "text-green-500 border-green-500/20",
        purple: "text-purple-500 border-purple-500/30 shadow-[0_0_20px_-12px_rgba(168,85,247,0.3)]",
    };

    if (!member) return null;

    return (
        <div className={cn("bg-[#111] border rounded-[2rem] p-6 transition-all duration-500 hover:scale-[1.02] relative group cursor-help", colorConfigs[color])}>
            <div className="absolute inset-x-0 -top-12 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none z-[100] transform group-hover:-translate-y-2">
                <div className="bg-slate-900 border border-white/10 text-white text-[10px] px-3 py-2 rounded-xl shadow-2xl text-center font-bold tracking-tight whitespace-nowrap mx-4">
                    {description}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-900"></div>
                </div>
            </div>
            <div className={cn("text-[9px] font-black uppercase tracking-widest mb-1 opacity-70")}>{title}</div>
            <h3 className="text-xl font-black text-white italic mb-4 truncate">{member.name}</h3>
            <div className="flex justify-between items-end border-t border-white/5 pt-4">
                <div className="text-left">
                    <p className="text-[9px] text-slate-500 uppercase font-bold tracking-tighter">Avg Score</p>
                    <p className={cn("text-2xl font-black italic")}>{member.avgScore}</p>
                </div>
                <div className="text-right text-[10px] text-slate-400 font-bold italic">
                    {subText ? subText : (isVision ? `시야 ${member.avgVision}` : `데스 ${member.avgDeaths}`)}
                </div>
            </div>
        </div>
    );
}

export default function SquadPage() { return <Suspense><SquadAnalysisContent /></Suspense>; }