import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import kakaoLoginImg from '../assets/kakao_login.png';
import './LoginPage.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const [devLoading, setDevLoading] = useState(false);

  const handleDevLogin = async () => {
    setDevLoading(true);
    try {
      const res = await fetch('http://localhost:4000/api/auth/dev-login', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('로그인 실패');
      navigate('/dashboard');
    } catch (err) {
      alert('임시 계정 로그인에 실패했습니다.');
    } finally {
      setDevLoading(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-blob login-blob1" />
      <div className="login-blob login-blob2" />
      <div className="login-blob login-blob3" />

      <div className="login-card">
        <div className="login-badge">✨ 간편 소셜 로그인</div>

        <div className="login-brand">
          <span className="login-brand-name">가계부 메이트</span>
        </div>

        <p className="login-desc">
          지출 추적부터 친구와의 더치페이까지.<br />
          더 스마트하고 재미있는 가계부를 경험하세요.
        </p>

        <div className="login-divider" />

        <div className="login-social-btns">
          <button
            className="login-social-img-btn"
            aria-label="카카오 로그인"
            onClick={() => { window.location.href = 'http://localhost:4000/api/auth/kakao'; }}
          >
            <img src={kakaoLoginImg} alt="카카오 로그인" />
          </button>
          <button
            className="login-social-btn naver"
            aria-label="네이버 로그인"
            onClick={() => { window.location.href = 'http://localhost:4000/api/auth/naver'; }}
          >
            <span className="naver-n">N</span>
            네이버 로그인
          </button>
        </div>

        <button
          className="login-dev-btn"
          onClick={handleDevLogin}
          disabled={devLoading}
        >
          {devLoading ? '로그인 중...' : '임시 계정 로그인 (개발용)'}
        </button>
      </div>
    </div>
  );
}
