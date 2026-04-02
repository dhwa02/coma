import { useState } from 'react';
import kakaoLoginImg from '../assets/kakao_login.png';
import './LoginPage.css';

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  return (
    <div className="login-wrap">
      {/* 로고 */}
      <div className="login-logo">
        <span className="login-logo-text">가계부 메이트</span>
      </div>

      {/* 카드 */}
      <div className="login-card">
        <h1 className="login-title">로그인</h1>

        {/* 이메일 */}
        <div className="login-field">
          <label className="login-label" htmlFor="email">이메일</label>
          <div className="login-input-wrap">
            <input
              id="email"
              type="email"
              className="login-input"
              placeholder="이메일 주소를 입력해 주세요."
              autoComplete="email"
            />
          </div>
        </div>

        {/* 비밀번호 */}
        <div className="login-field">
          <label className="login-label" htmlFor="password">비밀번호</label>
          <div className="login-input-wrap">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              className="login-input has-icon"
              placeholder="비밀번호를 입력해 주세요."
              autoComplete="current-password"
            />
            <span
              className="login-input-icon"
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? '🔓' : '🔒'}
            </span>
          </div>
        </div>

        {/* 아이디 저장 */}
        <div className="login-remember">
          <input
            id="remember"
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
          />
          <label htmlFor="remember">아이디 저장</label>
        </div>

        {/* 로그인 버튼 */}
        <button className="login-btn">로그인</button>

        {/* 링크 */}
        <div className="login-links">
          <a href="#">비밀번호 찾기</a>
          <div className="login-links-divider" />
          <a href="#">회원가입</a>
        </div>

        {/* 소셜 구분선 */}
        <div className="login-social-divider">
          <span>또는 소셜 계정으로 로그인</span>
        </div>

        {/* 소셜 버튼 */}
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
      </div>
    </div>
  );
}
