import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import './ProfilePage.css';

interface User {
  id: number;
  nickname: string;
  profileImage: string | null;
  email: string | null;
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [nickname, setNickname] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const { data: user, isLoading } = useQuery<User>({
    queryKey: ['me'],
    queryFn: () => api.get('/api/auth/me').then(r => r.data),
    retry: false,
  });

  const updateMutation = useMutation({
    mutationFn: (data: { nickname: string }) =>
      api.patch('/api/users/profile', data).then(r => r.data),
    onSuccess: (updated: User) => {
      queryClient.setQueryData(['me'], updated);
      setIsEditing(false);
      setErrorMsg('');
      setSuccessMsg('닉네임이 변경되었습니다.');
      setTimeout(() => setSuccessMsg(''), 3000);
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.message ?? '변경에 실패했습니다.');
    },
  });

  const handleEditStart = () => {
    setNickname(user?.nickname ?? '');
    setIsEditing(true);
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleCancel = () => {
    setIsEditing(false);
    setErrorMsg('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) return;
    updateMutation.mutate({ nickname: nickname.trim() });
  };

  const getInitial = (name: string) => name.charAt(0).toUpperCase();

  if (isLoading) {
    return (
      <div className="profile-wrap">
        <div className="profile-loading">불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="profile-wrap">
      <nav className="profile-nav">
        <button className="profile-back-btn" onClick={() => navigate('/dashboard')}>
          ‹ 돌아가기
        </button>
        <span className="profile-nav-title">내 프로필</span>
        <div style={{ width: 80 }} />
      </nav>

      <main className="profile-main">
        <div className="profile-card">
          {/* 아바타 */}
          <div className="profile-avatar-wrap">
            {user?.profileImage ? (
              <img
                src={user.profileImage}
                alt="프로필"
                className="profile-avatar-img"
              />
            ) : (
              <div className="profile-avatar-placeholder">
                {user ? getInitial(user.nickname) : '?'}
              </div>
            )}
          </div>

          {/* 닉네임 영역 */}
          <div className="profile-section">
            <div className="profile-section-label">닉네임</div>
            {isEditing ? (
              <form onSubmit={handleSubmit} className="profile-edit-form">
                <input
                  className="profile-input"
                  value={nickname}
                  onChange={e => setNickname(e.target.value)}
                  maxLength={20}
                  placeholder="닉네임 입력"
                  autoFocus
                />
                <div className="profile-input-hint">{nickname.length}/20</div>
                {errorMsg && <div className="profile-error">{errorMsg}</div>}
                <div className="profile-edit-btns">
                  <button
                    type="button"
                    className="profile-btn-cancel"
                    onClick={handleCancel}
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="profile-btn-save"
                    disabled={updateMutation.isPending || !nickname.trim()}
                  >
                    {updateMutation.isPending ? '저장 중...' : '저장'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="profile-value-row">
                <span className="profile-value">{user?.nickname}</span>
                <button className="profile-edit-btn" onClick={handleEditStart}>
                  수정
                </button>
              </div>
            )}
            {successMsg && <div className="profile-success">{successMsg}</div>}
          </div>

          {/* 이메일 */}
          {user?.email && (
            <div className="profile-section">
              <div className="profile-section-label">이메일</div>
              <div className="profile-value muted">{user.email}</div>
            </div>
          )}

          {/* 소셜 계정 */}
          <div className="profile-section">
            <div className="profile-section-label">연결된 계정</div>
            <div className="profile-social-list">
              <div className="profile-social-badge kakao">카카오 로그인</div>
            </div>
          </div>
        </div>

        {/* 안내 문구 */}
        <p className="profile-guide">
          닉네임은 친구 검색 시 사용됩니다. 다른 사용자와 중복되지 않는 닉네임을 사용해주세요.
        </p>
      </main>
    </div>
  );
}
