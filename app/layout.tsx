import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Activity, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { Analytics } from '@vercel/analytics/next';
import AdFitBanner from '@/components/AdBanner';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'WINSAM.LOL | 진짜 캐리를 찾아라',
  description: '팀 내 기여도 분석 시스템 (TCS)',
  keywords: [
    '롤 전적 검색',
    'LoL 전적',
    '롤 기여도 분석',
    'TCS',
    '롤 캐리 측정',
    '리그오브레전드 분석',
    'WINSAM',
    '윈삼',
    '롤 승률 계산',
    '진짜 캐리 찾기',
  ],
  authors: [{ name: 'WINSAM Team' }],
  // 검색 엔진 로봇 설정
  robots: 'index, follow',
  // 소유권 확인 태그
  verification: {
    google: 'RNkeSZzWbR8T4Pp_OTNspdHciimBargpK1SBOpatEyY',
    other: {
      'naver-site-verification': ['f1636c12cb4f939e132f87e747f74801cc0235b4'],
    },
  },
  openGraph: {
    type: 'website',
    url: 'https://lol.winsam.xyz', // 실제 도메인으로 수정하세요
    title: 'WINSAM.LOL | 진짜 캐리를 찾아라',
    description: '단순한 KDA를 넘어선 팀 기여도 분석 시스템! 당신의 진짜 실력을 확인하세요.',
    siteName: 'WINSAM.LOL',
  },
  // 트위터(X)용 설정
  twitter: {
    card: 'summary_large_image',
    title: 'WINSAM.LOL | 롤 기여도 분석',
    description: '팀 내 기여도 분석 시스템 (TCS)으로 진짜 캐리를 가려내세요.',
  },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="dark">
      {/* Extensions may inject body attributes (e.g. cz-shortcut-listen) before hydration.
          Limit suppression to this element; descendants retain hydration checks. */}
      <body className={`${inter.className} min-h-screen antialiased`} suppressHydrationWarning>
        <Analytics />
        <a href="#page-content" className="skip-link">
          본문 바로가기
        </a>
        <header className="site-header">
          <div className="site-header-inner">
            <Link href="/" className="brand" aria-label="WINSAM 홈">
              <span className="brand-symbol">
                <Activity size={20} strokeWidth={2.5} />
              </span>
              <span>
                WINSAM<span className="brand-suffix">.LOL</span>
              </span>
            </Link>
            <nav className="site-nav" aria-label="메인 메뉴">
              <Link href="/#individual">개인 분석</Link>
              <Link href="/#squad">스쿼드 분석</Link>
            </nav>
            <div className="region-label">
              <span className="status-dot" /> KR REGION
            </div>
          </div>
        </header>
        <aside className="rail-ad rail-ad-left" aria-label="광고">
          <AdFitBanner unitId="DAN-9yY5PCwh3z3a3VJp" width="160" height="600" />
        </aside>
        <div id="page-content" className="site-content">
          {children}
        </div>
        <aside className="rail-ad rail-ad-right" aria-label="광고">
          <AdFitBanner unitId="DAN-ZLGWx5TkrW2vavX5" width="160" height="600" />
        </aside>
        <footer className="site-footer page-width">
          <div>
            <Link href="/" className="footer-brand">
              WINSAM.LOL <ArrowUpRight size={14} />
            </Link>
            <p>좋은 플레이를 알아보는 또 하나의 시선.</p>
          </div>
          <div className="footer-meta">
            <span>LEAGUE OF LEGENDS PERFORMANCE ANALYSIS</span>
            <span>WINSAM.LOL은 Riot Games의 공식 서비스가 아닙니다.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
