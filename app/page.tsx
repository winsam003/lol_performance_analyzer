"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, History, X, MessageSquare, Users, CheckCircle2, Zap, Info, ShieldCheck, Target } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Home() {
  const [summoner, setSummoner] = useState("");
  const [multiText, setMultiText] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const router = useRouter();

  const parsedMembers = useMemo(() => {
    if (!multiText.trim()) return [];
    return multiText.split('\n')
      .map(line => {
        const cleanLine = line.replace(/[\u200B-\u200D\uFEFF\u2066-\u2069]/g, '');
        const parts = cleanLine.split('#');
        if (parts.length >= 2) {
          const name = parts[0].trim();
          const tagPart = parts[1].trim().split(/\s|님이/)[0];
          if (name && tagPart) return { name, tag: tagPart };
        }
        return null;
      })
      .filter((item): item is { name: string; tag: string } => item !== null);
  }, [multiText]);

  useEffect(() => {
    const saved = localStorage.getItem("recent_searches");
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  const handleSearch = (e: React.FormEvent, targetSummoner?: string) => {
    e.preventDefault();
    const query = targetSummoner || summoner;
    if (!query) return;

    const finalQuery = query.includes("#") ? query : `${query}#KR1`;
    const newHistory = [finalQuery, ...history.filter((h) => h !== finalQuery)].slice(0, 5);
    setHistory(newHistory);
    localStorage.setItem("recent_searches", JSON.stringify(newHistory));
    router.push(`/analysis?summoner=${encodeURIComponent(finalQuery)}`);
  };

  const handleMultiSearchSubmit = () => {
    if (parsedMembers.length === 0) return;
    const main = `${parsedMembers[0].name}#${parsedMembers[0].tag}`;
    const squad = parsedMembers.slice(1).map(m => `${m.name}#${m.tag}`).join(',');
    router.push(`/squad?summoner=${encodeURIComponent(main)}&squad=${encodeURIComponent(squad)}`);
  };

  const removeHistory = (e: React.MouseEvent, target: string) => {
    e.stopPropagation();
    const filtered = history.filter((h) => h !== target);
    setHistory(filtered);
    localStorage.setItem("recent_searches", JSON.stringify(filtered));
  };

  return (
    <main className="container mx-auto px-6 py-24 max-w-6xl">
      <div className="flex flex-col items-center mb-24 text-center">
        <div className="inline-flex items-center rounded-full border border-blue-500/20 bg-blue-500/5 px-4 py-1 text-xs font-bold text-blue-400 mb-8 uppercase tracking-[0.2em] animate-pulse">
          Intelligence Analysis System v1.5
        </div>

        <h1 className="text-6xl md:text-8xl font-black mb-8 tracking-tighter italic leading-none text-white drop-shadow-2xl">
          WHO <span className="text-blue-500">CARRIED?</span>
        </h1>

        <div className="w-full space-y-12">
          {/* 1. 개인 검색 섹션 */}
          <section className="w-full">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-500/10 rounded-lg"><Target className="text-blue-500" size={20} /></div>
              <h2 className="text-xl font-black italic text-white uppercase tracking-tight">Individual Analysis</h2>
              <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent"></div>
            </div>

            <div className="relative group max-w-3xl mx-auto">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl blur opacity-20 group-hover:opacity-30 transition duration-1000"></div>
              <form onSubmit={handleSearch} className="relative flex items-center bg-[#111] rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
                <div className="pl-6 text-slate-500"><Search size={24} /></div>
                <Input
                  type="text"
                  placeholder="소환사명 #태그 입력"
                  className="h-20 border-0 bg-transparent text-xl md:text-2xl focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-slate-700 font-medium text-white"
                  value={summoner}
                  onChange={(e) => setSummoner(e.target.value)}
                />
                <Button type="submit" className="h-20 px-10 bg-blue-600 hover:bg-blue-500 font-black text-xl italic shrink-0 transition-colors">
                  START
                </Button>
              </form>
            </div>

            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {history.map((h) => (
                <div key={h} className="group relative">
                  <button onClick={(e) => handleSearch(e as any, h)} className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-full text-[11px] font-bold text-slate-500 hover:text-blue-400 transition-all italic tracking-tighter">
                    <History size={12} className="opacity-50" />
                    {h}
                  </button>
                  <button onClick={(e) => removeHistory(e, h)} className="absolute -top-1 -right-1 bg-slate-900 text-slate-400 rounded-full p-0.5 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all border border-white/10">
                    <X size={8} />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* 2. 스쿼드 검색 섹션 */}
          <section className="w-full">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-purple-500/10 rounded-lg"><Users className="text-purple-500" size={20} /></div>
              <h2 className="text-xl font-black italic text-white uppercase tracking-tight">Squad Hierarchy</h2>
              <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent"></div>
            </div>

            <div className="bg-[#111] border border-white/10 rounded-3xl p-8 shadow-2xl text-left relative overflow-hidden group max-w-4xl mx-auto">
              <div className="absolute top-0 right-0 p-32 bg-purple-600/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none group-hover:bg-purple-600/10 transition-colors duration-700"></div>

              <div className="flex items-start justify-between mb-6">
                <div>
                  <h4 className="text-sm font-black text-purple-400 flex items-center gap-2 mb-1 italic uppercase tracking-wider">
                    <MessageSquare size={16} /> Paste Lobby Logs
                  </h4>
                  <p className="text-[11px] text-slate-500 font-medium tracking-tight">채팅창의 '로비 참가' 메시지를 모두 복사해 넣으세요.</p>
                </div>
                <div className="hidden sm:block text-right">
                  <span className="text-[10px] font-bold text-slate-600 uppercase border border-white/5 px-2 py-1 rounded">Auto Detection System</span>
                </div>
              </div>

              <textarea
                className="w-full h-36 bg-black/40 border border-white/5 rounded-2xl p-5 text-slate-300 text-sm focus:outline-none focus:border-purple-500/30 transition-all placeholder:text-slate-800 resize-none font-mono mb-6 leading-relaxed"
                value={multiText}
                onChange={(e) => setMultiText(e.target.value)}
                placeholder={`금광동 쏘스윗 #KR1 님이 로비에 참가하셨습니다.\n...`}
              />

              {parsedMembers.length > 0 ? (
                <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-6 bg-purple-500/5 border border-purple-500/10 rounded-2xl animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="flex flex-wrap justify-center md:justify-start gap-2">
                    {parsedMembers.map((m, i) => (
                      <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/10 rounded-lg text-xs font-black text-purple-200 border border-purple-500/20 italic tracking-tighter">
                        <CheckCircle2 size={12} className="text-purple-500" />
                        {m.name} <span className="opacity-40">#{m.tag}</span>
                      </div>
                    ))}
                  </div>
                  <Button
                    onClick={handleMultiSearchSubmit}
                    className="w-full md:w-auto h-14 px-10 bg-purple-600 hover:bg-purple-500 font-black italic text-lg shrink-0 shadow-[0_0_20px_rgba(147,51,234,0.3)] transition-all hover:scale-105"
                  >
                    SCAN SQUAD
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-[10px] text-slate-600 font-bold uppercase tracking-widest bg-white/5 w-fit px-4 py-2 rounded-full mx-auto">
                  <ShieldCheck size={12} /> Waiting for squad data input...
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* 하단 정보 그리드 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-10">
        <div className="lg:col-span-2 bg-[#111] rounded-[2rem] p-10 border border-white/5 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
          <div className="flex justify-between items-center mb-10 relative z-10">
            <h3 className="font-black text-3xl flex items-center gap-4 italic text-white tracking-tighter">
              <div className="w-2.5 h-10 bg-blue-500 skew-x-[-15deg] shadow-[4px_0_15px_rgba(59,130,246,0.5)]" />
              PATCH 15.1 ANALYSIS
            </h3>
            <span className="text-[10px] font-black text-blue-500 bg-blue-500/10 px-4 py-1.5 rounded-full border border-blue-500/20 uppercase tracking-widest">
              Live Meta
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
            <div className="bg-white/[0.03] border border-white/5 rounded-3xl p-8 hover:bg-white/[0.05] transition-colors">
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                <Zap size={18} className="text-yellow-500" /> Champions Update
              </h4>
              <ul className="space-y-4">
                <li className="flex items-center justify-between text-sm border-b border-white/5 pb-3">
                  <span className="text-slate-200 font-bold italic">Ezreal</span>
                  <span className="text-green-500 text-[11px] font-black uppercase">+ Buffed</span>
                </li>
                <li className="flex items-center justify-between text-sm border-b border-white/5 pb-3">
                  <span className="text-slate-200 font-bold italic">Karma</span>
                  <span className="text-red-500 text-[11px] font-black uppercase">- Nerfed</span>
                </li>
                <li className="flex items-center justify-between text-sm">
                  <span className="text-slate-200 font-bold italic">Heartsteel</span>
                  <span className="text-blue-400 text-[11px] font-black uppercase">Adjusted</span>
                </li>
              </ul>
            </div>

            <div className="bg-white/[0.03] border border-white/5 rounded-3xl p-8 hover:bg-white/[0.05] transition-colors">
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                <Info size={18} className="text-blue-500" /> Current Meta
              </h4>
              <p className="text-sm text-slate-400 leading-relaxed font-medium italic mb-6">
                공허 유충의 가치가 상승하며 상체 위주의 게임이 이어지고 있습니다.
                오브젝트 교전 능력이 티어를 가르는 핵심입니다.
              </p>
              <div className="flex gap-3">
                <span className="px-3 py-1 bg-blue-500/10 rounded-lg text-[10px] font-black text-blue-400 uppercase border border-blue-500/10">#Top_Meta</span>
                <span className="px-3 py-1 bg-blue-500/10 rounded-lg text-[10px] font-black text-blue-400 uppercase border border-blue-500/10">#Object_Fight</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#111] rounded-[2rem] p-10 border border-white/5">
          <h3 className="font-black text-2xl mb-10 italic uppercase tracking-tighter flex items-center gap-3 text-white">
            <Target size={24} className="text-red-500" /> Hot-Picks
          </h3>
          <div className="space-y-4">
            {[
              { lane: "TOP", champ: "Aatrox", status: "S-Tier", color: "text-red-500" },
              { lane: "JNG", champ: "Lee Sin", status: "Steady", color: "text-blue-500" },
              { lane: "MID", champ: "Orianna", status: "OP", color: "text-yellow-500" },
              { lane: "ADC", champ: "Lucian", status: "Hot", color: "text-orange-500" },
              { lane: "SUP", champ: "Thresh", status: "S-Tier", color: "text-green-500" },
            ].map((pick) => (
              <div key={pick.lane} className="flex items-center justify-between p-4 bg-white/[0.02] rounded-2xl border border-white/5 hover:border-white/10 transition-all group cursor-default">
                <div className="flex items-center gap-4">
                  <span className="text-[10px] font-black text-slate-600 group-hover:text-blue-500 transition-colors w-8 italic">{pick.lane}</span>
                  <div className="w-10 h-10 bg-slate-900 rounded-xl border border-white/5"></div>
                  <span className="text-sm font-black text-slate-200 italic">{pick.champ}</span>
                </div>
                <span className={cn("text-[10px] font-black italic tracking-widest uppercase", pick.color)}>{pick.status}</span>
              </div>
            ))}
          </div>
          <p className="mt-10 text-[9px] text-slate-700 uppercase tracking-[0.3em] text-center border-t border-white/5 pt-8 font-black">
            Powered by Winsam Engine
          </p>
        </div>
      </div>
    </main>
  );
}