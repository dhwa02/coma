import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { shareInviteToFriend } from '../lib/kakao';
import './FriendsPage.css';

interface FriendUser {
  id: number;
  nickname: string;
  profileImage: string | null;
}

interface Friend extends FriendUser {
  friendshipId: number;
}

interface FriendRequest extends FriendUser {
  requestId: number;
  requestedAt: string;
}

interface SearchUser extends FriendUser {}

function Avatar({ user, size = 40 }: { user: FriendUser; size?: number }) {
  if (user.profileImage) {
    return (
      <img
        src={user.profileImage}
        alt={user.nickname}
        className="fr-avatar-img"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div className="fr-avatar-placeholder" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {user.nickname.charAt(0).toUpperCase()}
    </div>
  );
}

export default function FriendsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [tab, setTab] = useState<'friends' | 'requests'>('friends');

  const { data: me } = useQuery<{ nickname: string }>({
    queryKey: ['me'],
    queryFn: () => api.get('/api/auth/me').then(r => r.data),
    retry: false,
  });

  const { data: friends = [], isLoading: loadingFriends } = useQuery<Friend[]>({
    queryKey: ['friends'],
    queryFn: () => api.get('/api/friends').then(r => r.data),
  });

  const { data: requests = [], isLoading: loadingRequests } = useQuery<FriendRequest[]>({
    queryKey: ['friend-requests'],
    queryFn: () => api.get('/api/friends/requests').then(r => r.data),
  });

  const sendRequestMutation = useMutation({
    mutationFn: (receiverId: number) => api.post('/api/friends/request', { receiverId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] });
      setSearchResults([]);
      setSearchQuery('');
      setSearchDone(false);
    },
  });

  const acceptMutation = useMutation({
    mutationFn: (requestId: number) => api.patch(`/api/friends/${requestId}/accept`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (requestId: number) => api.patch(`/api/friends/${requestId}/reject`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (friendshipId: number) => api.delete(`/api/friends/${friendshipId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      setDeletingId(null);
    },
  });

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim().length < 2) return;
    setIsSearching(true);
    setSearchDone(false);
    try {
      const res = await api.get('/api/users/search', { params: { q: searchQuery.trim() } });
      setSearchResults(res.data);
      setSearchDone(true);
    } catch {
      setSearchResults([]);
      setSearchDone(true);
    } finally {
      setIsSearching(false);
    }
  };

  const friendIds = new Set(friends.map(f => f.id));
  const requestedIds = new Set(requests.map(r => r.id));

  const getSearchUserStatus = (userId: number) => {
    if (friendIds.has(userId)) return 'friend';
    if (requestedIds.has(userId)) return 'requested';
    return 'none';
  };

  return (
    <div className="fr-wrap">
      <nav className="fr-nav">
        <button className="fr-back-btn" onClick={() => navigate('/dashboard')}>
          ‹ 돌아가기
        </button>
        <span className="fr-nav-title">친구</span>
        <div style={{ width: 80 }} />
      </nav>

      <main className="fr-main">
        {/* ── 검색 ── */}
        <div className="fr-search-card">
          <div className="fr-search-title">친구 검색</div>
          <form onSubmit={handleSearch} className="fr-search-form">
            <input
              className="fr-search-input"
              placeholder="닉네임으로 검색 (2자 이상)"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setSearchDone(false); }}
              maxLength={20}
            />
            <button
              type="submit"
              className="fr-search-btn"
              disabled={isSearching || searchQuery.trim().length < 2}
            >
              {isSearching ? '검색 중' : '검색'}
            </button>
          </form>

          {searchDone && (
            <div className="fr-search-results">
              {searchResults.length === 0 ? (
                <div className="fr-empty-small">검색 결과가 없습니다.</div>
              ) : (
                searchResults.map(user => {
                  const status = getSearchUserStatus(user.id);
                  return (
                    <div key={user.id} className="fr-user-row">
                      <Avatar user={user} size={40} />
                      <span className="fr-user-name">{user.nickname}</span>
                      {status === 'friend' && (
                        <span className="fr-badge friend">친구</span>
                      )}
                      {status === 'requested' && (
                        <span className="fr-badge pending">요청받음</span>
                      )}
                      {status === 'none' && (
                        <button
                          className="fr-btn-primary"
                          onClick={() => sendRequestMutation.mutate(user.id)}
                          disabled={sendRequestMutation.isPending}
                        >
                          요청 보내기
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* 카카오로 초대 */}
          <div className="fr-kakao-divider">
            <span>또는</span>
          </div>
          <button
            type="button"
            className="fr-kakao-btn"
            onClick={() => shareInviteToFriend({ inviterNickname: me?.nickname ?? '친구' })}
          >
            <span className="fr-kakao-icon">💬</span>
            카카오톡으로 초대 링크 보내기
          </button>
        </div>

        {/* ── 탭 ── */}
        <div className="fr-tabs">
          <button
            className={`fr-tab${tab === 'friends' ? ' active' : ''}`}
            onClick={() => setTab('friends')}
          >
            친구 목록
            {friends.length > 0 && <span className="fr-tab-count">{friends.length}</span>}
          </button>
          <button
            className={`fr-tab${tab === 'requests' ? ' active' : ''}`}
            onClick={() => setTab('requests')}
          >
            받은 요청
            {requests.length > 0 && <span className="fr-tab-count fr-tab-count-badge">{requests.length}</span>}
          </button>
        </div>

        {/* ── 친구 목록 ── */}
        {tab === 'friends' && (
          <div className="fr-list">
            {loadingFriends ? (
              <div className="fr-empty">불러오는 중...</div>
            ) : friends.length === 0 ? (
              <div className="fr-empty">
                <div className="fr-empty-icon">👥</div>
                <p>아직 친구가 없어요</p>
                <p className="fr-empty-sub">위에서 닉네임으로 친구를 검색해보세요</p>
              </div>
            ) : (
              friends.map(friend => (
                <div key={friend.friendshipId} className="fr-friend-card">
                  <Avatar user={friend} size={44} />
                  <div className="fr-friend-info">
                    <span className="fr-friend-name">{friend.nickname}</span>
                  </div>
                  {deletingId === friend.friendshipId ? (
                    <div className="fr-delete-confirm">
                      <span className="fr-delete-msg">삭제할까요?</span>
                      <button
                        className="fr-btn-danger-sm"
                        onClick={() => deleteMutation.mutate(friend.friendshipId)}
                        disabled={deleteMutation.isPending}
                      >
                        삭제
                      </button>
                      <button
                        className="fr-btn-cancel-sm"
                        onClick={() => setDeletingId(null)}
                      >
                        취소
                      </button>
                    </div>
                  ) : (
                    <button
                      className="fr-btn-ghost"
                      onClick={() => setDeletingId(friend.friendshipId)}
                    >
                      삭제
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ── 받은 요청 ── */}
        {tab === 'requests' && (
          <div className="fr-list">
            {loadingRequests ? (
              <div className="fr-empty">불러오는 중...</div>
            ) : requests.length === 0 ? (
              <div className="fr-empty">
                <div className="fr-empty-icon">📭</div>
                <p>받은 친구 요청이 없어요</p>
              </div>
            ) : (
              requests.map(req => (
                <div key={req.requestId} className="fr-friend-card">
                  <Avatar user={req} size={44} />
                  <div className="fr-friend-info">
                    <span className="fr-friend-name">{req.nickname}</span>
                    <span className="fr-friend-sub">
                      {new Date(req.requestedAt).toLocaleDateString('ko-KR')} 요청
                    </span>
                  </div>
                  <div className="fr-request-btns">
                    <button
                      className="fr-btn-primary-sm"
                      onClick={() => acceptMutation.mutate(req.requestId)}
                      disabled={acceptMutation.isPending}
                    >
                      수락
                    </button>
                    <button
                      className="fr-btn-ghost-sm"
                      onClick={() => rejectMutation.mutate(req.requestId)}
                      disabled={rejectMutation.isPending}
                    >
                      거절
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
