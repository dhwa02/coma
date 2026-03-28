import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function AuthCallback() {
  const navigate = useNavigate();
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    const code = new URLSearchParams(window.location.search).get('code');

    if (!code) {
      navigate('/login?error=no_code');
      return;
    }

    axios
      .post('http://localhost:4000/api/auth/kakao/token', { code }, { withCredentials: true })
      .then(() => navigate('/'))
      .catch((err) => {
        const reason = err.response?.data?.error?.error_code ?? err.response?.data?.message ?? err.message;
        console.error('[AuthCallback Error]', err.response?.data ?? err.message);
        navigate(`/login?error=kakao_failed&reason=${encodeURIComponent(reason)}`);
      });
  }, [navigate]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <p style={{ fontSize: 15, color: '#6B6880' }}>카카오 로그인 처리 중...</p>
    </div>
  );
}
