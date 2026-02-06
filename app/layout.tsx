import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/next"
import AdFitBanner from "@/components/AdBanner";


const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "WINSAM.LOL | 진짜 캐리를 찾아라",
  description: "팀 내 기여도 분석 시스템 (TCS)",
  keywords: [
    "롤 전적 검색", "LoL 전적", "롤 기여도 분석", "TCS", "롤 캐리 측정",
    "리그오브레전드 분석", "WINSAM", "윈삼", "롤 승률 계산", "진짜 캐리 찾기"
  ],
  authors: [{ name: "WINSAM Team" }],
  // 검색 엔진 로봇 설정
  robots: "index, follow",
  // 소유권 확인 태그
  verification: {
    google: "RNkeSZzWbR8T4Pp_OTNspdHciimBargpK1SBOpatEyY",
    other: {
      "naver-site-verification": ["f1636c12cb4f939e132f87e747f74801cc0235b4"],
    },
  },
  openGraph: {
    type: "website",
    url: "https://lol.winsam.xyz", // 실제 도메인으로 수정하세요
    title: "WINSAM.LOL | 진짜 캐리를 찾아라",
    description: "단순한 KDA를 넘어선 팀 기여도 분석 시스템! 당신의 진짜 실력을 확인하세요.",
    siteName: "WINSAM.LOL",
  },
  // 트위터(X)용 설정
  twitter: {
    card: "summary_large_image",
    title: "WINSAM.LOL | 롤 기여도 분석",
    description: "팀 내 기여도 분석 시스템 (TCS)으로 진짜 캐리를 가려내세요.",
  },
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
          "min-h-screen bg-[#0b0b0b] antialiased text-slate-200 relative",
        )}
      >
        <Analytics />

        {/* 헤더의 z-index를 50으로 설정하여 광고보다 위에 오도록 함 */}
        <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-[#0b0b0b]/80 backdrop-blur-md">
          <div className="container mx-auto flex h-16 items-center justify-between px-6">
            {/* 기존 헤더 내용 */}
            <Link href="/" className="font-black text-2xl tracking-tighter text-white">
              LOL.WINSAM<span className="text-blue-500">.XYZ</span>
            </Link>
          </div>
        </header>

        {/* 왼쪽 광고: 화면 왼쪽 끝에서 20px 띄움 */}
        <aside className="hidden 2xl:block fixed left-5 top-[100px] z-40 w-[160px]">
          <AdFitBanner unitId="DAN-9yY5PCwh3z3a3VJp" width="160" height="600" />
        </aside>

        {/* 메인 콘텐츠: 기존 깨지던 w-full이나 max-w를 자유롭게 조절하세요 */}
        <main>
          {children}
        </main>

        {/* 오른쪽 광고: 화면 오른쪽 끝에서 20px 띄움 */}
        <aside className="hidden 2xl:block fixed right-5 top-[100px] z-40 w-[160px]">
          <AdFitBanner unitId="DAN-ZLGWx5TkrW2vavX5" width="160" height="600" />
        </aside>

        <script
          type="text/javascript"
          src="//t1.daumcdn.net/kas/static/ba.min.js"
          async
        ></script>
      </body>
    </html>
  );
}