import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function NaverCallback() {
  const navigate = useNavigate();
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');

    if (!code) {
      navigate('/login?error=no_code');
      return;
    }

    axios
      .post('http://localhost:4000/api/auth/naver/token', { code, state }, { withCredentials: true })
      .then(() => navigate('/'))
      .catch((err) => {
        const reason = err.response?.data?.error ?? err.response?.data?.message ?? err.message;
        console.error('[NaverCallback Error]', err.response?.data ?? err.message);
        navigate(`/login?error=naver_failed&reason=${encodeURIComponent(reason)}`);
      });
  }, [navigate]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <p style={{ fontSize: 15, color: '#6B6880' }}>네이버 로그인 처리 중...</p>
    </div>
  );
}
