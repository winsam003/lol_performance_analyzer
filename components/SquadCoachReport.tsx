'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Copy, Info, MessageSquareQuote, Sparkles } from 'lucide-react';
import { formatSquadReport, type SquadReport, type SquadVerdict } from '@/lib/squad-report';

export function SquadTitle({ verdict }: { verdict: SquadVerdict }) {
  const tooltipId = useId();
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const touchOpen = useRef(false);

  useLayoutEffect(() => {
    const tooltip = tooltipRef.current;
    if (!anchor || !tooltip) return;
    const { width, height } = tooltip.getBoundingClientRect();
    const left =
      anchor.x + width + 16 <= window.innerWidth - 8 ? anchor.x + 16 : anchor.x - width - 16;
    const top =
      anchor.y + height + 16 <= window.innerHeight - 8 ? anchor.y + 16 : anchor.y - height - 16;
    tooltip.style.left = `${Math.max(8, Math.min(left, window.innerWidth - width - 8))}px`;
    tooltip.style.top = `${Math.max(8, top)}px`;
  }, [anchor]);

  const open = anchor !== null;
  useEffect(() => {
    if (!open) return;
    const close = () => {
      setAnchor(null);
      touchOpen.current = false;
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span className="title-disclosure">
      <button
        type="button"
        aria-label={`${verdict.title} 칭호 설명`}
        aria-describedby={anchor ? tooltipId : undefined}
        onPointerEnter={(event) => {
          if (event.pointerType !== 'touch') setAnchor({ x: event.clientX, y: event.clientY });
        }}
        onPointerMove={(event) => {
          if (event.pointerType !== 'touch') setAnchor({ x: event.clientX, y: event.clientY });
        }}
        onPointerLeave={(event) => {
          if (event.pointerType !== 'touch' && !touchOpen.current) setAnchor(null);
        }}
        onFocus={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setAnchor({ x: rect.left, y: rect.bottom });
        }}
        onBlur={() => {
          setAnchor(null);
          touchOpen.current = false;
        }}
        onClick={(event) => {
          touchOpen.current = !touchOpen.current;
          const rect = event.currentTarget.getBoundingClientRect();
          setAnchor(touchOpen.current ? { x: rect.left, y: rect.bottom } : null);
        }}
      >
        {verdict.title}
        <Info size={13} aria-hidden="true" />
      </button>
      {anchor &&
        createPortal(
          <div
            ref={tooltipRef}
            id={tooltipId}
            role="tooltip"
            className="title-description"
            style={{ position: 'fixed', zIndex: 1000, pointerEvents: 'none' }}
          >
            <strong>{verdict.title}</strong>
            <p>{verdict.description}</p>
            <strong>이 칭호를 받은 이유</strong>
            <ul>
              {verdict.evidence.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>,
          document.body,
        )}
    </span>
  );
}

export default function SquadCoachReport({ report }: { report: SquadReport }) {
  const [copyStatus, setCopyStatus] = useState('');
  const copy = async (full: boolean) => {
    try {
      await navigator.clipboard.writeText(full ? formatSquadReport(report) : report.shareLine);
      setCopyStatus(full ? '전체 리포트를 복사했습니다.' : '단톡 한 줄을 복사했습니다.');
    } catch {
      setCopyStatus('복사하지 못했습니다. 아래 문장을 직접 선택해 복사해주세요.');
    }
  };
  return (
    <section className="coach-report" aria-label="AI 코치의 경기 뒤풀이">
      <div className="coach-report-heading">
        <div>
          <span className="eyebrow">
            <Sparkles size={14} /> POST-GAME REVIEW
          </span>
          <h2>선수님들, 잠깐 앉아보세요.</h2>
          <p>
            {report.modeLabel} · 선택한 {report.matchCount}경기
          </p>
        </div>
        <button onClick={() => void copy(true)} className="report-copy">
          <Copy size={14} /> 전체 복사
        </button>
      </div>
      <div className="coach-team-summary">
        <span>코치의 팀 총평</span>
        <p>{report.teamSummary}</p>
      </div>
      <div className="coach-player-list">
        {report.players.map((player) => (
          <article className="coach-player-card" key={player.playerId}>
            <header>
              <div>
                <h3>
                  {player.name} <span>#{player.tag}</span>
                </h3>
                <p>{player.role}</p>
              </div>
              <SquadTitle verdict={player} />
            </header>
            <div className="coach-evidence">
              {player.evidence.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <blockquote>
              <MessageSquareQuote size={20} aria-hidden="true" />
              <p>{player.roast}</p>
            </blockquote>
          </article>
        ))}
      </div>
      <div className="coach-share">
        <div>
          <span>단톡방에 이 한 줄</span>
          <p>{report.shareLine}</p>
        </div>
        <button onClick={() => void copy(false)} className="report-copy">
          <Copy size={14} /> 한 줄 복사
        </button>
      </div>
      <p className="coach-copy-status" role="status">
        {copyStatus}
      </p>
    </section>
  );
}
