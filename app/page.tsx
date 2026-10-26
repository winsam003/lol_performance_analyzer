'use client';

import { useRouter } from 'next/navigation';
import { useState, useMemo, useSyncExternalStore } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Search,
  History,
  X,
  Users,
  CheckCircle2,
  ArrowUpRight,
  ArrowRight,
  Sparkles,
  Crosshair,
  ChartNoAxesCombined,
  Swords,
} from 'lucide-react';
import AdFitBanner from '@/components/AdBanner';

const subscribeHistory = (notify: () => void) => {
  window.addEventListener('storage', notify);
  window.addEventListener('search-history', notify);
  return () => {
    window.removeEventListener('storage', notify);
    window.removeEventListener('search-history', notify);
  };
};
const readHistory = () => {
  try {
    return localStorage.getItem('recent_searches') || '[]';
  } catch {
    return '[]';
  }
};
const emptyHistory = () => '[]';
const saveHistory = (items: string[]) => {
  try {
    localStorage.setItem('recent_searches', JSON.stringify(items));
    window.dispatchEvent(new Event('search-history'));
  } catch {
    /* Search still works when storage is unavailable. */
  }
};

export default function Home() {
  const [summoner, setSummoner] = useState('');
  const [multiText, setMultiText] = useState('');
  const savedHistory = useSyncExternalStore(subscribeHistory, readHistory, emptyHistory);
  const history = useMemo<string[]>(() => {
    try {
      const parsed: unknown = JSON.parse(savedHistory);
      return Array.isArray(parsed)
        ? parsed.filter((value): value is string => typeof value === 'string').slice(0, 5)
        : [];
    } catch {
      return [];
    }
  }, [savedHistory]);
  const router = useRouter();

  const parsedMembers = useMemo(() => {
    if (!multiText.trim()) return [];
    return multiText
      .split('\n')
      .map((line) => {
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

  const handleSearch = (e: React.SyntheticEvent, targetSummoner?: string) => {
    e.preventDefault();
    const query = targetSummoner || summoner;
    if (!query) return;

    const finalQuery = query.includes('#') ? query : `${query}#KR1`;
    const newHistory = [finalQuery, ...history.filter((h) => h !== finalQuery)].slice(0, 5);
    saveHistory(newHistory);
    router.push(`/analysis?summoner=${encodeURIComponent(finalQuery)}`);
  };

  const handleMultiSearchSubmit = () => {
    if (parsedMembers.length === 0) return;
    const main = `${parsedMembers[0].name}#${parsedMembers[0].tag}`;
    const squad = parsedMembers
      .slice(1)
      .map((m) => `${m.name}#${m.tag}`)
      .join(',');
    router.push(`/squad?summoner=${encodeURIComponent(main)}&squad=${encodeURIComponent(squad)}`);
  };

  const removeHistory = (e: React.MouseEvent, target: string) => {
    e.stopPropagation();
    const filtered = history.filter((h) => h !== target);
    saveHistory(filtered);
  };

  return (
    <main className="home-page page-width">
      <section className="hero-section" aria-labelledby="hero-title">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="status-dot" /> LEAGUE OF LEGENDS · PERFORMANCE LAB
          </div>
          <h1 id="hero-title">
            승패 너머,
            <br />
            당신의 <span>플레이.</span>
          </h1>
          <p className="hero-description">
            누가 캐리했는지, 어디서 아쉬웠는지.
            <br />
            경기 속 숫자를 다음 승리를 위한 힌트로 바꿔보세요.
          </p>
          <form onSubmit={handleSearch} className="summoner-search" id="individual">
            <label className="sr-only" htmlFor="summoner">
              소환사명과 태그
            </label>
            <span className="search-region">
              KR <span />{' '}
            </span>
            <Input
              id="summoner"
              autoComplete="off"
              placeholder="소환사명 #태그"
              value={summoner}
              onChange={(e) => setSummoner(e.target.value)}
              className="hero-input"
            />
            <Button
              type="submit"
              className="search-submit"
              disabled={!summoner.trim()}
              aria-label="소환사 분석 시작"
            >
              <Search size={20} />
              <span>분석하기</span>
            </Button>
          </form>
          <div className="search-caption">
            <span>태그를 생략하면 #KR1로 검색해요.</span>
            <span>
              최근 20경기 분석 <ArrowUpRight size={13} />
            </span>
          </div>
          {history.length > 0 && (
            <div className="recent-searches">
              <span className="recent-label">
                <History size={13} />
                최근 검색
              </span>
              {history.map((h) => (
                <div className="history-chip" key={h}>
                  <button onClick={(e) => handleSearch(e, h)}>{h}</button>
                  <button aria-label={`${h} 검색 기록 삭제`} onClick={(e) => removeHistory(e, h)}>
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <a className="hero-secondary-link" href="#squad">
            친구들과 함께한 경기가 궁금하다면 <ArrowRight size={15} />
          </a>
        </div>

        <div className="report-preview" aria-label="분석 리포트 예시">
          <div className="preview-topline">
            <span>
              <span className="status-dot" /> MATCH INSIGHT
            </span>
            <span className="preview-example">리포트 예시</span>
          </div>
          <div className="preview-heading">
            <div>
              <span className="eyebrow muted">YOUR PERFORMANCE</span>
              <h2>숫자로 보는 존재감</h2>
            </div>
            <Crosshair size={26} strokeWidth={1.3} />
          </div>
          <div className="preview-score-row">
            <div className="score-orbit">
              <div>
                <strong>
                  128<span>점</span>
                </strong>
                <span>기여도 점수</span>
              </div>
            </div>
            <div className="preview-verdict">
              <span className="verdict-badge">
                <Sparkles size={12} /> CARRY
              </span>
              <h3>
                승리에 남긴
                <br />
                확실한 차이.
              </h3>
              <p>
                상대 포지션 대비
                <br />
                <strong>+28</strong> 기여도
              </p>
            </div>
          </div>
          <div className="preview-metrics">
            {[
              { label: '전투 기여', value: '+16', width: '84%' },
              { label: '시야 장악', value: '+5', width: '56%' },
              { label: '생존 능력', value: '+7', width: '66%' },
            ].map((metric) => (
              <div key={metric.label}>
                <span>{metric.label}</span>
                <div className="metric-track">
                  <i style={{ width: metric.width }} />
                </div>
                <strong>{metric.value}</strong>
              </div>
            ))}
          </div>
          <div className="preview-note">
            <Sparkles size={16} />
            <p>
              잘한 플레이는 확실하게.
              <br />
              <span>다음 판에 바꿀 지표는 구체적으로.</span>
            </p>
            <ArrowUpRight size={17} />
          </div>
          <div className="preview-footnote">
            이해를 돕기 위한 예시이며 실제 경기 기록이 아닙니다.
          </div>
        </div>
      </section>

      <section className="feature-strip" aria-label="분석 방식">
        {[
          {
            n: '01',
            icon: Crosshair,
            title: '내 포지션에 맞는 평가',
            text: '같은 경기, 상대 포지션과 비교합니다.',
          },
          {
            n: '02',
            icon: ChartNoAxesCombined,
            title: 'KDA 밖의 기여도까지',
            text: '딜량부터 시야와 생존까지 살펴봅니다.',
          },
          {
            n: '03',
            icon: Sparkles,
            title: '다음 판을 위한 AI 코칭',
            text: '기록에 근거한 구체적인 개선점을 받으세요.',
          },
        ].map(({ n, icon: Icon, title, text }) => (
          <div className="feature-item" key={n}>
            <span className="feature-number">{n}</span>
            <Icon size={20} strokeWidth={1.5} />
            <div>
              <h2>{title}</h2>
              <p>{text}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="squad-entry-section" id="squad" aria-labelledby="squad-title">
        <div className="squad-entry-copy">
          <span className="eyebrow">
            <Users size={15} /> BETTER TOGETHER
          </span>
          <h2 id="squad-title">
            우리 팀의 진짜
            <br />
            캐리를 찾아서.
          </h2>
          <p>
            함께한 경기만 모아 한눈에 비교하세요.
            <br />
            오늘의 에이스부터 숨은 공헌자까지,
            <br />
            AI 코치가 팀의 플레이를 짚어드립니다.
          </p>
          <div className="squad-entry-tags">
            <span>
              <Swords size={13} /> 함께한 경기
            </span>
            <span>
              <Sparkles size={13} /> 정중한 팩폭 코치
            </span>
          </div>
        </div>
        <div className="squad-input-panel">
          <div className="panel-title">
            <div>
              <span className="eyebrow muted">SQUAD ANALYSIS</span>
              <h3>같이 플레이한 친구들을 입력하세요</h3>
            </div>
            <Users size={21} />
          </div>
          <label htmlFor="squad-members" className="field-caption">
            소환사명#태그 또는 로비 참가 메시지를 한 줄씩 붙여넣으세요.
          </label>
          <textarea
            id="squad-members"
            value={multiText}
            onChange={(e) => setMultiText(e.target.value)}
            placeholder={'소환사1#KR1\n소환사2#KR1\n소환사3#KR1'}
            className="squad-textarea"
          />
          <div className="detected-members" aria-live="polite">
            {parsedMembers.length ? (
              parsedMembers.map((m, i) => (
                <span key={i}>
                  <CheckCircle2 size={12} />
                  {m.name}
                  <small>#{m.tag}</small>
                </span>
              ))
            ) : (
              <span className="empty-members">입력하면 소환사를 자동으로 인식해요.</span>
            )}
          </div>
          <div className="squad-input-footer">
            <span>
              <span className="status-dot" /> {parsedMembers.length}명 인식됨
            </span>
            <Button
              onClick={handleMultiSearchSubmit}
              disabled={!parsedMembers.length}
              className="accent-button"
            >
              스쿼드 분석 <ArrowRight size={16} />
            </Button>
          </div>
        </div>
      </section>
      <div className="ad-section">
        <span>ADVERTISEMENT</span>
        <AdFitBanner unitId="DAN-Ci825mcnbMvNPXFq" width="300" height="250" />
      </div>
    </main>
  );
}
