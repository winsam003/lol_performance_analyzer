"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Info, Crosshair, Zap, Shield, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Home() {
  const [summoner, setSummoner] = useState("");
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!summoner) return;
    router.push(`/analysis?summoner=${encodeURIComponent(summoner)}`);
  };

  return (
    <main className="container mx-auto px-6 py-24">
      {/* 히어로 섹션: 기여도 분석 강조 */}
      <div className="flex flex-col items-center mb-32 text-center">
        <div className="inline-flex items-center rounded-full border border-blue-500/20 bg-blue-500/5 px-4 py-1 text-xs font-bold text-blue-400 mb-8 uppercase tracking-[0.2em]">
          Team Contribution System v1.0
        </div>

        <h1 className="text-6xl md:text-8xl font-black mb-8 tracking-tighter italic leading-none">
          WHO <span className="text-blue-500">CARRIED?</span>
        </h1>

        <p className="text-slate-400 text-lg md:text-xl mb-12 max-w-2xl font-light leading-relaxed">
          KDA 뒤에 숨겨진 진짜 실력을 찾으세요. <br />
          <span className="text-white font-semibold">
            골드 대비 대미지 효율, 시야, 군중 제어
          </span>
          를 분석해 <br className="hidden md:block" />
          당신의 '인분(人分)'을 객관적인 수치로 증명합니다.
        </p>

        {/* 메인 검색창 */}
        <form
          onSubmit={handleSearch}
          className="w-full max-w-2xl relative group"
        >
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
          <div className="relative flex items-center bg-[#161616] rounded-xl overflow-hidden border border-white/10 shadow-2xl">
            <div className="pl-6 text-slate-500">
              <Search size={24} />
            </div>
            <Input
              type="text"
              placeholder="소환사명 + #KR1 형식으로 입력"
              className="h-20 border-0 bg-transparent text-xl md:text-2xl focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-slate-700 font-medium"
              value={summoner}
              onChange={(e) => setSummoner(e.target.value)}
            />
            <Button className="h-20 px-12 rounded-none bg-blue-600 hover:bg-blue-500 font-black text-xl italic transition-all active:scale-95">
              ANALYZE
            </Button>
          </div>
        </form>

        <div className="mt-6 flex gap-4 text-sm text-slate-600">
          <span>최근 분석:</span>
          <button className="text-slate-400 hover:text-blue-400 transition underline decoration-slate-800">
            Hide on bush#KR1
          </button>
        </div>
      </div>
      {/* 하단 대시보드 섹션 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 왼쪽: 패치 노트 핵심 요약 (2칸 차지) */}
        <div className="lg:col-span-2 bg-[#121212] rounded-3xl p-8 border border-white/5 overflow-hidden">
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-black text-2xl flex items-center gap-3 italic">
              <div className="w-2 h-8 bg-blue-500 skew-x-[-15deg]" />
              PATCH 14.2 ANALYSIS
            </h3>
            <span className="text-xs font-bold text-blue-500 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
              CURRENT VERSION
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 패치 핵심 요약 카드 */}
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
              <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Zap size={16} className="text-yellow-500" /> Buff & Nerf
              </h4>
              <ul className="space-y-3">
                <li className="flex items-center justify-between text-sm">
                  <span className="text-slate-200 font-medium">
                    이즈리얼 (버프)
                  </span>
                  <span className="text-green-500 text-xs font-bold">
                    + Q 계수 상향
                  </span>
                </li>
                <li className="flex items-center justify-between text-sm">
                  <span className="text-slate-200 font-medium">
                    카르마 (너프)
                  </span>
                  <span className="text-red-500 text-xs font-bold">
                    - 주문력 계수 조정
                  </span>
                </li>
                <li className="flex items-center justify-between text-sm">
                  <span className="text-slate-200 font-medium">
                    강철심장 (조정)
                  </span>
                  <span className="text-blue-400 text-xs font-bold">
                    가격 대비 효율 감소
                  </span>
                </li>
              </ul>
            </div>

            {/* 메타 변화 요약 */}
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
              <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Info size={16} className="text-blue-500" /> Meta Trend
              </h4>
              <p className="text-sm text-slate-300 leading-relaxed">
                공허 유충의 가치가 상승하며 상체 위주의 게임이 이어지고
                있습니다.
                <span className="text-white font-bold ml-1 text-xs">
                  #상체메타 #오브젝트교전
                </span>
              </p>
              <div className="mt-4 flex gap-2">
                <div className="h-2 flex-1 bg-blue-500/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 w-[70%]"
                    title="상체 영향력"
                  ></div>
                </div>
                <span className="text-[10px] text-slate-500 font-bold uppercase">
                  Impact
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 오른쪽: 라인별 HOT 챔피언 (1칸 차지) */}
        <div className="bg-[#121212] rounded-3xl p-8 border border-white/5">
          <h3 className="font-black text-xl mb-8 italic uppercase tracking-tighter flex items-center gap-2">
            Line Hot-Picks
          </h3>
          <div className="space-y-4">
            {[
              {
                lane: "TOP",
                champ: "Aatrox",
                status: "S-Tier",
                color: "text-red-500",
              },
              {
                lane: "JNG",
                champ: "Lee Sin",
                status: "Steady",
                color: "text-blue-500",
              },
              {
                lane: "MID",
                champ: "Orianna",
                status: "OP",
                color: "text-yellow-500",
              },
              {
                lane: "ADC",
                champ: "Lucian",
                status: "Hot",
                color: "text-orange-500",
              },
              {
                lane: "SUP",
                champ: "Thresh",
                status: "S-Tier",
                color: "text-green-500",
              },
            ].map((pick) => (
              <div
                key={pick.lane}
                className="flex items-center justify-between p-4 bg-white/[0.02] rounded-xl border border-white/5 hover:bg-white/[0.05] transition-all group"
              >
                <div className="flex items-center gap-4">
                  <span className="text-[10px] font-black text-slate-600 group-hover:text-blue-500 transition-colors w-6">
                    {pick.lane}
                  </span>
                  <div className="w-8 h-8 bg-slate-800 rounded-md"></div>
                  <span className="text-xs font-bold text-slate-200">
                    {pick.champ}
                  </span>
                </div>
                <span
                  className={cn("text-[10px] font-black italic", pick.color)}
                >
                  {pick.status}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-8 text-[9px] text-slate-600 uppercase tracking-widest text-center border-t border-white/5 pt-6">
            Data provided by Winsam Engine
          </p>
        </div>
      </div>
    </main>
  );
}
