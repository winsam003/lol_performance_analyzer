"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, History, X, MessageSquare, Users, CheckCircle2, Zap, Info, ShieldCheck, Target, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import AdFitBanner from "@/components/AdBanner";

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

          <div className="w-full flex flex-col items-center py-12 my-4 border-y border-white/[0.03] bg-white/[0.01]">
            {/* 광고 유닛을 감싸는 박스에 최소 높이를 주어 겹침 방지 */}
            <div className="relative min-h-[250px] w-full flex justify-center items-center overflow-hidden">
              <AdFitBanner
                unitId="DAN-Ci825mcnbMvNPXFq"
                width="300"
                height="250"
              />
            </div>
          </div>

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
                placeholder={`소환사1 #KR1 님이 로비에 참가하셨습니다.
소환사2 #KR1 님이 로비에 참가하셨습니다.
소환사3 #KR1 님이 로비에 참가하셨습니다.
소환사4 #KR1 님이 로비에 참가하셨습니다.
소환사5 #웰시코기 님이 로비에 참가하셨습니다.`}
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

      {/* 하단 정보 그리드 - 대대적인 디자인 개선 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-12 relative z-10">

      </div>
    </main>
  );
}

// 아이콘 라이브러리에 없는 Skull 추가 정의 (lucide에 있지만 안전을 위해)
function Skull({ size, className }: { size: number; className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9 10L9.01 10" /><path d="M15 10L15.01 10" /><path d="M10 20v-3a1 1 0 0 0-1-1H7a1 1 0 0 1-1-1v-2c0-4.42 3.58-8 8-8s8 3.58 8 8v2a1 1 0 0 1-1 1h-2a1 1 0 0 0-1 1v3" /><circle cx="12" cy="12" r="10" />
    </svg>
  );
}