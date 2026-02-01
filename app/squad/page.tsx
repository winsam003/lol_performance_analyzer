"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { Loader2, Users, Trophy, TrendingUp, ShieldAlert, CheckCircle2, Search, ArrowLeft, Layers, User, Eye, Skull, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { analyzeSummoner, AnalysisResult } from "../actions/analyze";
import { Suspense } from "react";
import Link from "next/link";

const QUEUE_TYPES = [
    { id: "all", label: "전체 매치", icon: <Layers size={14} /> },
    { id: "420", label: "솔랭/듀오", icon: <User size={14} /> },
    { id: "440", label: "자유 랭크", icon: <Users size={14} /> },
];

function SquadAnalysisContent() {
    const searchParams = useSearchParams();
    const summonerParam = searchParams.get("summoner") || "";
    const squadParam = searchParams.get("squad") || "";

    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<AnalysisResult | null>(null);
    const [selectedQueue, setSelectedQueue] = useState("all");

    const squadTargetList = useMemo(() => {
        const squad = squadParam ? squadParam.split(',') : [];
        return [summonerParam, ...squad]
            .filter(Boolean)
            .map(m => m.toUpperCase().replace(/\s/g, ''));
    }, [summonerParam, squadParam]);

    useEffect(() => {
        const fetchSquadData = async () => {
            if (!summonerParam) return;
            setLoading(true);
            try {
                const [name, tag] = summonerParam.split("#");
                const result = await analyzeSummoner(name, tag);
                setData(result);
            } catch (err) { console.error(err); }
            finally { setLoading(false); }
        };
        fetchSquadData();
    }, [summonerParam]);

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
                            deaths: 0, kills: 0, assists: 0, dmg: 0, gold: 0, vision: 0
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
                }
            });
        });

        return Object.values(statsMap)
            .map(s => ({
                ...s,
                avgScore: Math.floor(s.totalScore / s.matchCount),
                avgKDA: `${(s.kills / s.matchCount).toFixed(1)}/${(s.deaths / s.matchCount).toFixed(1)}/${(s.assists / s.matchCount).toFixed(1)}`,
                avgKills: (s.kills / s.matchCount).toFixed(1),
                avgAssists: (s.assists / s.matchCount).toFixed(1),
                avgDmg: Math.floor(s.dmg / s.matchCount),
                avgVision: (s.vision / s.matchCount).toFixed(1),
                efficiency: Math.floor((s.dmg / (s.gold || 1)) * 100),
                avgDeaths: (s.deaths / s.matchCount).toFixed(1)
            }))
            .sort((a, b) => b.avgScore - a.avgScore);
    }, [commonMatches, squadTargetList]);

    if (loading) return <main className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center text-white"><Loader2 className="animate-spin text-blue-500 mb-6" size={60} /><h2 className="text-2xl font-black italic animate-pulse">SQUAD SUSPECT SCANNING...</h2></main>;

    return (
        <main className="min-h-screen bg-[#060606] text-slate-200 pb-20 font-sans">
            <div className="bg-gradient-to-b from-blue-900/10 to-transparent border-b border-white/5 py-16">
                <div className="container mx-auto px-6 text-center">
                    <div className="flex bg-[#111] p-1 rounded-xl border border-white/5 w-fit mb-8 mx-auto relative z-30">
                        {QUEUE_TYPES.map((q) => (
                            <button key={q.id} onClick={() => setSelectedQueue(q.id)} className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all", selectedQueue === q.id ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-300")}>
                                {q.icon} {q.label}
                            </button>
                        ))}
                    </div>

                    {commonMatches.length > 0 ? (
                        <>
                            <div className="flex items-center justify-center gap-2 text-blue-500 font-bold mb-4 bg-blue-500/10 px-4 py-1 rounded-full border border-blue-500/20 text-xs tracking-tighter uppercase w-fit mx-auto">
                                <CheckCircle2 size={14} /> Full Squad Match: {commonMatches.length} Games
                            </div>
                            <h1 className="text-5xl md:text-7xl font-black italic tracking-tighter text-white mb-12 uppercase">SQUAD <span className="text-blue-500">HIERARCHY</span></h1>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 max-w-7xl mx-auto">
                                <SquadCard title="팀의 심장" member={filteredHierarchy[0]} color="blue" description="독보적인 기여도 1위, 이 팀의 실질적 주인" />
                                <SquadCard title="가성비 괴물" member={[...filteredHierarchy].sort((a, b) => b.efficiency - a.efficiency)[0]} color="emerald" subText={`효율 ${[...filteredHierarchy].sort((a, b) => b.efficiency - a.efficiency)[0].efficiency}%`} description="적은 골드로 엄청난 딜을 뽑아내는 효율 깡패" />
                                <SquadCard title="학살자" member={[...filteredHierarchy].sort((a, b) => Number(b.avgKills) - Number(a.avgKills))[0]} color="rose" subText={`평균 ${[...filteredHierarchy].sort((a, b) => Number(b.avgKills) - Number(a.avgKills))[0].avgKills}킬`} description="킬 냄새는 기가 막히게 맡는 협곡의 사냥꾼" />
                                <SquadCard title="마더 테레사" member={[...filteredHierarchy].sort((a, b) => Number(b.avgAssists) - Number(a.avgAssists))[0]} color="yellow" subText={`평균 ${[...filteredHierarchy].sort((a, b) => Number(b.avgAssists) - Number(a.avgAssists))[0].avgAssists}어시`} description="모든 킬에 관여하는 헌신적인 서포팅의 화신" />
                                <SquadCard title="협곡 등대" member={[...filteredHierarchy].sort((a, b) => Number(b.avgVision) - Number(a.avgVision))[0]} color="cyan" isVision description="협곡의 어둠을 밝혀 아군을 살리는 자" />

                                <SquadCard title="300원 맛집" member={[...filteredHierarchy].sort((a, b) => Number(b.avgDeaths) - Number(a.avgDeaths))[0]} color="red" subText={`평균 ${[...filteredHierarchy].sort((a, b) => Number(b.avgDeaths) - Number(a.avgDeaths))[0].avgDeaths}데스`} description="상대방에게 골드를 아낌없이 기부하는 기부천사" />
                                <SquadCard title="세금 도둑" member={[...filteredHierarchy].sort((a, b) => a.efficiency - b.efficiency)[0]} color="stone" subText={`딜 효율 ${[...filteredHierarchy].sort((a, b) => a.efficiency - b.efficiency)[0].efficiency}%`} description="골드는 다 처먹고 딜량은 처참한 팀원" />
                                <SquadCard title="망원경" member={[...filteredHierarchy].sort((a, b) => Number(a.avgVision) - Number(b.avgVision))[0]} color="slate" subText={`시야 ${[...filteredHierarchy].sort((a, b) => Number(a.avgVision) - Number(b.avgVision))[0].avgVision}점`} description="눈 감고 게임하는 수준, 시야 점수가 망원경 급" />
                                <SquadCard title="평화주의자" member={[...filteredHierarchy].sort((a, b) => a.avgDmg - b.avgDmg)[0]} color="green" subText={`평균 딜 ${[...filteredHierarchy].sort((a, b) => a.avgDmg - b.avgDmg)[0].avgDmg.toLocaleString()}`} description="상대방을 때리는 걸 싫어하는 친절한 소환사" />
                                <SquadCard title="범인(Suspect)" member={filteredHierarchy[filteredHierarchy.length - 1]} color="orange" subText="최저 기여도" description="패배의 지분 90%, 오늘 밤 잠 못 이룰 장본인" />
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
                                        <th className="px-8 py-5 text-center">인분 점수</th>
                                        <th className="px-8 py-5 text-right">정체성</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {filteredHierarchy.map((m, idx) => (
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
                                            <td className="px-8 py-6 text-right"><span className={cn("text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-tighter text-white", idx === 0 ? "bg-purple-600" : idx === filteredHierarchy.length - 1 ? "bg-red-600" : "bg-slate-700")}>{idx === 0 ? "신(GOD)" : idx === filteredHierarchy.length - 1 ? "지명수배자" : "평범한 시민"}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="container mx-auto px-6 pb-20">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="h-px flex-1 bg-white/5"></div>
                            <h3 className="text-sm font-black italic text-slate-500 uppercase tracking-[0.2em]">Detailed Match History</h3>
                            <div className="h-px flex-1 bg-white/5"></div>
                        </div>

                        <div className="flex flex-col gap-6 max-w-6xl mx-auto">
                            {commonMatches.map((match) => (
                                <div key={match.id} className={cn("relative border rounded-2xl overflow-hidden transition-all", match.result === "WIN" ? "bg-[#111] border-blue-500/10 hover:border-blue-500/30" : "bg-red-500/5 border-red-500/10 hover:border-red-500/30")}>
                                    <div className={cn("px-6 py-2 flex justify-between items-center border-b border-white/5", match.result === "WIN" ? "bg-blue-500/10" : "bg-red-500/10")}>
                                        <div className="flex items-center gap-4">
                                            <span className={cn("font-black italic text-sm", match.result === "WIN" ? "text-blue-400" : "text-red-400")}>{match.result === "WIN" ? "VICTORY" : "DEFEAT"}</span>
                                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{match.date}</span>
                                        </div>
                                        <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest italic">Squad Performance Report</div>
                                    </div>
                                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                                        {match.allParticipants.filter(p => squadTargetList.includes(`${p.gameName}#${p.tagLine}`.toUpperCase().replace(/\s/g, ''))).map((p, i) => {
                                            const score = p.score;
                                            return (
                                                <div key={i} className="bg-white/5 rounded-xl p-4 border border-white/5 group/member">
                                                    <div className="flex items-center gap-3 mb-3">
                                                        <div className="relative shrink-0">
                                                            <img src={`https://ddragon.leagueoflegends.com/cdn/15.1.1/img/champion/${p.championName}.png`} className="w-10 h-10 rounded-lg border border-white/10" alt={p.championName} />
                                                            <div className="absolute -top-1 -right-1 bg-blue-600 text-[8px] font-black px-1 rounded italic text-white">{score}</div>
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="text-xs font-black text-white truncate">{p.gameName}</div>
                                                            <div className="text-[9px] text-slate-500 font-bold uppercase truncate">{p.championName}</div>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-2 pt-2 border-t border-white/5">
                                                        <div className="flex justify-between items-center"><span className="text-[9px] text-slate-500 font-bold uppercase">KDA</span><span className="text-[10px] text-slate-300 font-mono font-bold">{p.kda}</span></div>
                                                        <div className="flex justify-between items-center"><span className="text-[9px] text-slate-500 font-bold uppercase flex items-center gap-1"><Eye size={10} /> Vision</span><span className="text-[10px] text-blue-400 font-mono font-bold">{(p as any).visionScore || 0}</span></div>
                                                    </div>

                                                    {/* --- 칭호 노출 영역 --- */}
                                                    <div className="mt-3">
                                                        <span className={cn(
                                                            "text-[8px] px-2 py-0.5 rounded-full font-black uppercase block text-center truncate",
                                                            score >= 135 ? "bg-purple-600 text-white shadow-[0_0_10px_rgba(147,51,234,0.5)]" :
                                                                score >= 115 ? "bg-blue-600 text-white" :
                                                                    score >= 95 ? "bg-emerald-600 text-white" :
                                                                        "bg-slate-800 text-slate-400"
                                                        )}>
                                                            {score >= 135 ? "하드캐리" : score >= 115 ? "ACE" : score >= 95 ? "1인분" : "버스 승객"}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
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
    };

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