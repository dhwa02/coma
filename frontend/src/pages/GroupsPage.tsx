import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { shareGroupInvite } from '../lib/kakao';
import './GroupsPage.css';

interface UserInfo {
  id: number;
  nickname: string;
  profileImage: string | null;
}

interface GroupMemberDetail {
  memberId: number;
  userId: number;
  role: 'owner' | 'member';
  user: UserInfo;
  totalExpense: number;
}

interface Group {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  goal: number | null;
  owner: UserInfo;
  members: GroupMemberDetail[];
  myRole: 'owner' | 'member';
}

interface GroupInvite {
  inviteId: number;
  group: {
    id: number;
    name: string;
    startDate: string;
    endDate: string;
    goal: number | null;
    owner: UserInfo;
  };
}

interface Friend {
  id: number;
  nickname: string;
  profileImage: string | null;
  friendshipId: number;
}

function Avatar({ user, size = 36 }: { user: UserInfo; size?: number }) {
  if (user.profileImage) {
    return <img src={user.profileImage} alt={user.nickname} className="gr-avatar-img" style={{ width: size, height: size }} />;
  }
  return (
    <div className="gr-avatar-placeholder" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {user.nickname.charAt(0).toUpperCase()}
    </div>
  );
}

function fmt(n: number) { return n.toLocaleString('ko-KR'); }

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
}

function isActive(startDate: string, endDate: string) {
  const now = new Date().toISOString().slice(0, 10);
  return startDate <= now && now <= endDate;
}

// ── 그룹 생성 모달 ──────────────────────────────────────────────────
interface CreateModalProps {
  friends: Friend[];
  onClose: () => void;
  onSave: (data: { name: string; startDate: string; endDate: string; goal: string; inviteeIds: number[] }) => void;
  loading: boolean;
}

function CreateGroupModal({ friends, onClose, onSave, loading }: CreateModalProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState('');
  const [goal, setGoal] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const toggleFriend = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !startDate || !endDate) return;
    onSave({ name: name.trim(), startDate, endDate, goal, inviteeIds: [...selected] });
  };

  return (
    <div className="gr-overlay" onClick={onClose}>
      <div className="gr-modal" onClick={e => e.stopPropagation()}>
        <div className="gr-modal-header">
          <h3>절약 대결 그룹 만들기</h3>
          <button className="gr-modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="gr-modal-body">
          <div className="gr-field">
            <label>그룹 이름</label>
            <input className="gr-input" placeholder="예) 6월 절약 대결" value={name} onChange={e => setName(e.target.value)} maxLength={30} required />
          </div>
          <div className="gr-field gr-field-row">
            <div className="gr-field-half">
              <label>시작일</label>
              <input className="gr-input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
            </div>
            <div className="gr-field-half">
              <label>종료일</label>
              <input className="gr-input" type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} required />
            </div>
          </div>
          <div className="gr-field">
            <label>목표 지출 한도 <span className="gr-optional">(선택)</span></label>
            <div className="gr-amount-wrap">
              <input className="gr-input" type="number" min="1" placeholder="0" value={goal} onChange={e => setGoal(e.target.value)} />
              <span className="gr-amount-unit">원</span>
            </div>
            <p className="gr-hint">이 금액 이하로 지출하는 것이 목표예요</p>
          </div>
          <div className="gr-field">
            <label>친구 초대 <span className="gr-optional">(선택)</span></label>
            {friends.length === 0 ? (
              <p className="gr-hint">친구를 추가하면 여기서 초대할 수 있어요</p>
            ) : (
              <div className="gr-friend-list">
                {friends.map(f => (
                  <label key={f.id} className={`gr-friend-chip${selected.has(f.id) ? ' selected' : ''}`}>
                    <input type="checkbox" checked={selected.has(f.id)} onChange={() => toggleFriend(f.id)} className="gr-checkbox" />
                    <Avatar user={f} size={28} />
                    <span>{f.nickname}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="gr-modal-footer">
            <button type="button" className="gr-btn-cancel" onClick={onClose}>취소</button>
            <button type="submit" className="gr-btn-save" disabled={loading || !name.trim() || !endDate}>
              {loading ? '생성 중...' : '그룹 만들기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── 그룹 상세 모달 ──────────────────────────────────────────────────
interface DetailModalProps {
  groupId: number;
  onClose: () => void;
  onDelete: (id: number) => void;
  onLeave: (id: number) => void;
  friends: Friend[];
}

function GroupDetailModal({ groupId, onClose, onDelete, onLeave, friends }: DetailModalProps) {
  const queryClient = useQueryClient();
  const [inviting, setInviting] = useState(false);
  const [selectedInvitee, setSelectedInvitee] = useState<number | ''>('');

  const { data: group, isLoading } = useQuery<Group>({
    queryKey: ['group', groupId],
    queryFn: () => api.get(`/api/groups/${groupId}`).then(r => r.data),
  });

  const inviteMutation = useMutation({
    mutationFn: (userId: number) => api.post(`/api/groups/${groupId}/invite`, { userId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group', groupId] });
      setInviting(false);
      setSelectedInvitee('');
    },
  });

  if (isLoading || !group) {
    return (
      <div className="gr-overlay" onClick={onClose}>
        <div className="gr-modal" onClick={e => e.stopPropagation()}>
          <div className="gr-loading">불러오는 중...</div>
        </div>
      </div>
    );
  }

  const maxExpense = Math.max(...group.members.map(m => m.totalExpense), 1);
  const active = isActive(group.startDate, group.endDate);
  const memberIds = new Set(group.members.map(m => m.userId));
  const invitableFriends = friends.filter(f => !memberIds.has(f.id));

  return (
    <div className="gr-overlay" onClick={onClose}>
      <div className="gr-modal gr-modal-lg" onClick={e => e.stopPropagation()}>
        <div className="gr-modal-header">
          <div>
            <h3>{group.name}</h3>
            <span className={`gr-status-badge ${active ? 'active' : 'ended'}`}>
              {active ? '진행 중' : '종료'}
            </span>
          </div>
          <button className="gr-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="gr-modal-body">
          {/* 기간 & 목표 */}
          <div className="gr-detail-meta">
            <span>📅 {formatDate(group.startDate)} ~ {formatDate(group.endDate)}</span>
            {group.goal && <span>🎯 목표 {fmt(group.goal)}원 이하</span>}
          </div>

          {/* 랭킹 */}
          <div className="gr-ranking-title">절약 랭킹 <span className="gr-ranking-sub">(지출 적을수록 유리)</span></div>
          <div className="gr-ranking-list">
            {group.members.map((m, idx) => {
              const pct = maxExpense > 0 ? (m.totalExpense / maxExpense) * 100 : 0;
              const isGoalMet = group.goal !== null && m.totalExpense <= group.goal;
              return (
                <div key={m.memberId} className="gr-ranking-row">
                  <span className={`gr-rank-num ${idx === 0 ? 'first' : ''}`}>{idx + 1}</span>
                  <Avatar user={m.user} size={36} />
                  <div className="gr-ranking-info">
                    <div className="gr-ranking-name-row">
                      <span className="gr-ranking-name">{m.user.nickname}</span>
                      {m.role === 'owner' && <span className="gr-owner-badge">방장</span>}
                      {isGoalMet && <span className="gr-goal-badge">목표달성</span>}
                    </div>
                    <div className="gr-bar-wrap">
                      <div className="gr-bar" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <span className="gr-ranking-amount">{fmt(m.totalExpense)}원</span>
                </div>
              );
            })}
          </div>

          {/* 친구 초대 (방장만) */}
          {group.myRole === 'owner' && (
            <div className="gr-invite-section">
              {invitableFriends.length === 0 ? (
                <p className="gr-hint">초대 가능한 친구가 없어요</p>
              ) : inviting ? (
                <div className="gr-invite-form">
                  <select
                    className="gr-input"
                    value={selectedInvitee}
                    onChange={e => setSelectedInvitee(Number(e.target.value))}
                  >
                    <option value="">친구를 선택하세요</option>
                    {invitableFriends.map(f => (
                      <option key={f.id} value={f.id}>{f.nickname}</option>
                    ))}
                  </select>
                  <div className="gr-invite-btns">
                    <button
                      className="gr-btn-primary-sm"
                      onClick={() => selectedInvitee && inviteMutation.mutate(Number(selectedInvitee))}
                      disabled={!selectedInvitee || inviteMutation.isPending}
                    >
                      초대 보내기
                    </button>
                    <button className="gr-btn-ghost-sm" onClick={() => setInviting(false)}>취소</button>
                  </div>
                </div>
              ) : (
                <button className="gr-btn-outline" onClick={() => setInviting(true)}>+ 친구 초대</button>
              )}
            </div>
          )}

          {/* 카카오 공유 */}
          <button
            className="gr-kakao-btn"
            onClick={() => shareGroupInvite({
              inviterNickname: group.owner.nickname,
              groupName: group.name,
              startDate: group.startDate,
              endDate: group.endDate,
            })}
          >
            <span>💬</span> 카카오톡으로 초대 링크 보내기
          </button>

          {/* 액션 버튼 */}
          <div className="gr-detail-actions">
            {group.myRole === 'owner' ? (
              <button className="gr-btn-danger" onClick={() => { onDelete(group.id); onClose(); }}>
                그룹 삭제
              </button>
            ) : (
              <button className="gr-btn-danger" onClick={() => { onLeave(group.id); onClose(); }}>
                그룹 탈퇴
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 메인 페이지 ─────────────────────────────────────────────────────
export default function GroupsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [tab, setTab] = useState<'groups' | 'invites'>('groups');

  const { data: groups = [], isLoading: loadingGroups } = useQuery<Group[]>({
    queryKey: ['groups'],
    queryFn: () => api.get('/api/groups').then(r => r.data),
  });

  const { data: invites = [], isLoading: loadingInvites } = useQuery<GroupInvite[]>({
    queryKey: ['group-invites'],
    queryFn: () => api.get('/api/groups/invites').then(r => r.data),
  });

  const { data: friends = [] } = useQuery<Friend[]>({
    queryKey: ['friends'],
    queryFn: () => api.get('/api/friends').then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; startDate: string; endDate: string; goal: string; inviteeIds: number[] }) =>
      api.post('/api/groups', { ...data, goal: data.goal ? Number(data.goal) : null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      setShowCreate(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/groups/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['groups'] }),
  });

  const leaveMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/groups/${id}/leave`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['groups'] }),
  });

  const acceptInviteMutation = useMutation({
    mutationFn: (inviteId: number) => api.patch(`/api/groups/invites/${inviteId}/accept`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['group-invites'] });
    },
  });

  const rejectInviteMutation = useMutation({
    mutationFn: (inviteId: number) => api.patch(`/api/groups/invites/${inviteId}/reject`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['group-invites'] }),
  });

  return (
    <div className="gr-wrap">
      <nav className="gr-nav">
        <button className="gr-back-btn" onClick={() => navigate('/dashboard')}>‹ 돌아가기</button>
        <span className="gr-nav-title">절약 대결</span>
        <div style={{ width: 80 }} />
      </nav>

      <main className="gr-main">
        {/* 탭 */}
        <div className="gr-tabs">
          <button className={`gr-tab${tab === 'groups' ? ' active' : ''}`} onClick={() => setTab('groups')}>
            내 그룹
            {groups.length > 0 && <span className="gr-tab-count">{groups.length}</span>}
          </button>
          <button className={`gr-tab${tab === 'invites' ? ' active' : ''}`} onClick={() => setTab('invites')}>
            받은 초대
            {invites.length > 0 && <span className="gr-tab-count gr-tab-count-badge">{invites.length}</span>}
          </button>
        </div>

        {/* 내 그룹 목록 */}
        {tab === 'groups' && (
          <>
            <button className="gr-create-btn" onClick={() => setShowCreate(true)}>
              + 새 그룹 만들기
            </button>
            {loadingGroups ? (
              <div className="gr-empty">불러오는 중...</div>
            ) : groups.length === 0 ? (
              <div className="gr-empty">
                <div className="gr-empty-icon">🏆</div>
                <p>참여 중인 그룹이 없어요</p>
                <p className="gr-empty-sub">친구와 절약 대결을 시작해보세요</p>
              </div>
            ) : (
              <div className="gr-list">
                {groups.map(g => {
                  const active = isActive(g.startDate, g.endDate);
                  return (
                    <div key={g.id} className="gr-card" onClick={() => setDetailId(g.id)}>
                      <div className="gr-card-top">
                        <span className="gr-card-name">{g.name}</span>
                        <span className={`gr-status-badge ${active ? 'active' : 'ended'}`}>
                          {active ? '진행 중' : '종료'}
                        </span>
                      </div>
                      <div className="gr-card-meta">
                        {formatDate(g.startDate)} ~ {formatDate(g.endDate)}
                      </div>
                      {g.goal && (
                        <div className="gr-card-goal">목표 {fmt(g.goal)}원 이하</div>
                      )}
                      <div className="gr-card-members">
                        {g.members.slice(0, 5).map(m => (
                          <Avatar key={m.userId} user={m.user} size={28} />
                        ))}
                        {g.members.length > 5 && (
                          <div className="gr-member-more">+{g.members.length - 5}</div>
                        )}
                        <span className="gr-member-count">{g.members.length}명</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* 받은 초대 */}
        {tab === 'invites' && (
          <div className="gr-list">
            {loadingInvites ? (
              <div className="gr-empty">불러오는 중...</div>
            ) : invites.length === 0 ? (
              <div className="gr-empty">
                <div className="gr-empty-icon">📭</div>
                <p>받은 그룹 초대가 없어요</p>
              </div>
            ) : (
              invites.map(inv => (
                <div key={inv.inviteId} className="gr-invite-card">
                  <div className="gr-invite-info">
                    <span className="gr-invite-name">{inv.group.name}</span>
                    <span className="gr-invite-owner">
                      {inv.group.owner.nickname}님의 초대
                    </span>
                    <span className="gr-invite-period">
                      {formatDate(inv.group.startDate)} ~ {formatDate(inv.group.endDate)}
                    </span>
                  </div>
                  <div className="gr-invite-btns">
                    <button
                      className="gr-btn-primary-sm"
                      onClick={() => acceptInviteMutation.mutate(inv.inviteId)}
                      disabled={acceptInviteMutation.isPending}
                    >
                      수락
                    </button>
                    <button
                      className="gr-btn-ghost-sm"
                      onClick={() => rejectInviteMutation.mutate(inv.inviteId)}
                      disabled={rejectInviteMutation.isPending}
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

      {showCreate && (
        <CreateGroupModal
          friends={friends}
          onClose={() => setShowCreate(false)}
          onSave={data => createMutation.mutate(data)}
          loading={createMutation.isPending}
        />
      )}

      {detailId !== null && (
        <GroupDetailModal
          groupId={detailId}
          onClose={() => setDetailId(null)}
          onDelete={id => deleteMutation.mutate(id)}
          onLeave={id => leaveMutation.mutate(id)}
          friends={friends}
        />
      )}
    </div>
  );
}
