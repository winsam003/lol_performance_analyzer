import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "WINSAM.LOL | 진짜 캐리를 찾아라",
  description: "팀 내 기여도 분석 시스템 (TCS)",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className="dark">
      <body
        suppressHydrationWarning
        className={cn(
          inter.className,
          "min-h-screen bg-[#0b0b0b] antialiased text-slate-200",
        )}
      >
        {/* 네비게이션 바 */}
        <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-[#0b0b0b]/80 backdrop-blur-md">
          <div className="container mx-auto flex h-16 items-center justify-between px-6">
            <div className="flex items-center gap-8">
              <div className="font-black text-2xl tracking-tighter text-white">
                LOL.WINSAM<span className="text-blue-500">.XYZ</span>
              </div>
              <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
                <a href="#" className="hover:text-white transition">
                  {/* 기여도 랭킹 */}
                </a>
                <a href="#" className="hover:text-white transition">
                  {/* 분석 알고리즘 */}
                </a>
              </nav>
            </div>
            {/* <div className="text-xs font-mono text-slate-500 bg-white/5 px-3 py-1 rounded-full border border-white/10">
              LOL.WINSAM.XYZ
            </div> */}
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
