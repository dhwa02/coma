import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './LandingPage.css';

//  -- 데이터 -- 
interface StatItem {
  cls: string;
  icon: string;
  label: string;
  value: string;
}

interface HistoryItem {
  icon: string;
  bg: string;
  name: string;
  meta: string;
  date: string;
  amt: string;
  cls: 'neg' | 'pos';
}

interface BattleBar {
  cls: 'y' | 't';
  name: string;
  val: string;
}

const STATS: StatItem[] = [
  { cls: 'pink',   icon: '💸', label: '이번달 지출',  value: '62,000원' },
  { cls: 'blue',   icon: '📅', label: '일평균',       value: '2,000원'  },
  { cls: 'green',  icon: '✅', label: '예산 달성',    value: '1건'       },
  { cls: 'purple', icon: '🎯', label: '목표 달성률',  value: '50%'       },
];

const HISTORY: HistoryItem[] = [
  { icon: '🍱', bg: 'var(--pink)',   name: '점심 → 제육볶음 정식',   meta: '소비 · 카드 결제',    date: '10/28', amt: '-5,000원', cls: 'neg' },
  { icon: '🚌', bg: 'var(--blue)',   name: '버스 → 교통비',           meta: '교통비 · 카드 결제',  date: '10/28', amt: '-1,500원', cls: 'neg' },
  { icon: '☕', bg: 'var(--yellow)', name: '카페 아메리카노',          meta: '소비 · 카드 결제',    date: '10/27', amt: '-4,500원', cls: 'neg' },
];

const BATTLE_BARS: BattleBar[] = [
  { cls: 'y', name: '가계', val: '31,200원' },
  { cls: 't', name: '메이', val: '23,500원' },
];

function useScrollReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.lp-section, .lp-cta-section');
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('visible'); }),
      { threshold: 0.15 }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);
}

function Nav() {
  const navigate = useNavigate();

  return (
    <nav className="lp-nav">
      <div className="lp-nav-logo">
        <span className="lp-logo-text">가계부 메이트</span>
      </div>
      <div className="lp-nav-right">
        <a className="lp-nav-link" href="#s1">기능 소개</a>
        <a className="lp-nav-link" href="#cta">시작하기</a>
        <button className="lp-login-btn" onClick={() => navigate('/login')}>로그인</button>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section className="lp-hero">
      <div className="lp-blob lp-blob1" />
      <div className="lp-blob lp-blob2" />
      <div className="lp-blob lp-blob3" />

      <div className="lp-hero-badge">✨ 새로운 가계부 경험</div>

      <h1 className="lp-hero-title">
        돈 관리,<br />
        <span className="accent">가계부 메이트</span>와<br />
        함께라면 쉽다
      </h1>

      <p className="lp-hero-desc">
        지출 추적부터 친구와의 더치페이까지.<br />
        더 스마트하고 재미있는 가계부를 경험하세요.
      </p>

      <div className="lp-hero-btns">
        <button className="lp-btn-primary">시작하기 →</button>
        <button
          className="lp-btn-secondary"
          onClick={() => document.getElementById('s1')?.scrollIntoView({ behavior: 'smooth' })}
        >
          기능 둘러보기
        </button>
      </div>

      <div className="lp-scroll-hint">
        <span>스크롤해서 더 알아보기</span>
        <div className="lp-scroll-arrow" />
      </div>
    </section>
  );
}

function Section1() {
  return (
    <div className="lp-section" id="s1">
      <div className="lp-summary-layout">
        <div>
          <div className="lp-eyebrow">01 · 내 가계부 요약</div>
          <h2 className="lp-stitle">한눈에 보는<br />이번 달 '소비'</h2>
          <p className="lp-sdesc">
            지출 카테고리, 예산 달성률, 잔액 현황을 대시보드로 한 번에 확인하세요.
          </p>
        </div>
        <div>
          <div className="lp-stat-grid">
            {STATS.map((s) => (
              <div key={s.label} className={`lp-stat-card ${s.cls}`}>
                <div className="sc-icon">{s.icon}</div>
                <div className="sc-label">{s.label}</div>
                <div className="sc-value">{s.value}</div>
              </div>
            ))}
          </div>
          <div className="lp-bar-wrap">
            <div className="lp-bar-label">이번 달 예산 달성률</div>
            <div className="lp-bar-track">
              <div className="lp-bar-fill" style={{ width: '50%' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section2() {
  return (
    <div className="lp-section" id="s2">
      <div className="lp-battle-layout">

        <div className="lp-battle-ui">
          <div className="lp-battle-top">
            <div className="lp-battle-tag">⚔️ 절약 대결</div>
            <div className="lp-battle-live">
              <div className="lp-live-dot" />진행 중
            </div>
          </div>
          <div className="lp-battle-name">일주일 5만원 이하 챌린지</div>
          <div className="lp-vs-row">
            <div className="lp-ba">
              <div className="lp-ba-circle you">김</div>
              <div className="lp-ba-name">김가계</div>
            </div>
            <div className="lp-vs-center">VS</div>
            <div className="lp-ba">
              <div className="lp-ba-circle them">박</div>
              <div className="lp-ba-name">박메이</div>
            </div>
          </div>
          <div className="lp-battle-bars">
            {BATTLE_BARS.map((b) => (
              <div key={b.name} className="lp-bb-row">
                <span className="lp-bb-name">{b.name}</span>
                <div className="lp-bb-track">
                  <div className={`lp-bb-fill ${b.cls}`} />
                </div>
                <span className="lp-bb-val">{b.val}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="lp-eyebrow">02 · 나눔 모드</div>
          <h2 className="lp-stitle">친구와 함께,<br />절약을 '게임'으로</h2>
          <p className="lp-sdesc">
            같은 예산으로 친구와 대결하세요. 실시간 소비 현황을
            비교하며 절약을 더 재미있게 만들어 드립니다.
          </p>
        </div>
      </div>
    </div>
  );
}

function Section3() {
  return (
    <div className="lp-section" id="s3">
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div className="lp-eyebrow" style={{ textAlign: 'center' }}>03 · 소비 내역 확인</div>
        <h2 className="lp-stitle" style={{ textAlign: 'center' }}>모든 지출을 '한 곳'에서<br /></h2>
        <p className="lp-sdesc" style={{ margin: '0 auto', textAlign: 'center' }}>
          날짜, 카테고리, 금액을 한눈에 파악하고 지출 패턴을 분석해 보세요.
        </p>
      </div>
      <div className="lp-hist-list">
        {HISTORY.map((h) => (
          <div key={h.name} className="lp-hist-card">
            <div className="lp-hist-icon" style={{ background: h.bg }}>{h.icon}</div>
            <div style={{ flex: 1 }}>
              <div className="lp-hist-name">{h.name}</div>
              <div className="lp-hist-meta">{h.meta}</div>
            </div>
            <span className="lp-hist-date">{h.date}</span>
            <div className={`lp-hist-amt ${h.cls}`}>{h.amt}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Cta() {
  const navigate = useNavigate();

  return (
    <div className="lp-cta-section" id="cta">
      <div className="lp-cta-box">
        <div className="lp-cta-title">지금 바로 시작하세요</div>
        <p className="lp-cta-desc">
          회원가입 후 30초면 첫 지출을 기록할 수 있어요<br />
        </p>
        <div className="lp-hero-btns" style={{ justifyContent: 'center' }}>
          <button className="lp-btn-primary" onClick={() => navigate('/login')}>계정 만들기 →</button>
        </div>
      </div>
    </div>
  );
}

// Main Component
export default function LandingPage() {
  useScrollReveal();

  return (
    <>
      <Nav />
      <Hero />
      <Section1 />
      <Section2 />
      <Section3 />
      <Cta />
      <footer className="lp-footer">
        © 2026 가계부 메이트. All rights reserved.
      </footer>
    </>
  );
}
