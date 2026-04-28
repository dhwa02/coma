import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from 'recharts';
import api from '../services/api';
import './DashboardPage.css';

dayjs.locale('ko');

// ── Types ──────────────────────────────────────────────────────────
interface Transaction {
  id: number;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  memo: string | null;
  date: string;
  paymentMethod: string | null;
  excludedGroupIds: number[] | null;
}

interface TransactionForm {
  type: 'income' | 'expense';
  amount: string;
  category: string;
  memo: string;
  date: string;
  paymentMethod: string;
  excludedGroupIds: number[];
}

interface ActiveGroupSummary {
  id: number;
  name: string;
  categories: string[] | null;
  startDate: string;
  endDate: string;
}

type ViewMode = 'list' | 'calendar' | 'stats' | 'dutch';

// ── Dutch Pay Types ─────────────────────────────────────────────────
interface DutchPayParticipant {
  id: number;
  dutchPayId: number;
  name: string;
  userId: number | null;
  amountOwed: number;
  isPaid: boolean;
  paidAt: string | null;
  isPayer: boolean;
  linkedTransactionId: number | null;
  user?: { id: number; nickname: string; profileImage: string | null } | null;
}

interface DutchPay {
  id: number;
  userId: number;
  title: string;
  totalAmount: number;
  participantCount: number;
  memo: string | null;
  date: string;
  isUserPayer: boolean;
  linkedTransactionId: number | null;
  category: string | null;
  participants: DutchPayParticipant[];
}

// ── 카테고리 정보 ──────────────────────────────────────────────────
const CATEGORIES = {
  expense: [
    { name: '식비',  icon: '🍱', bg: 'var(--pink)',   color: '#C85B7A' },
    { name: '교통',  icon: '🚌', bg: 'var(--blue)',   color: '#3B7CC9' },
    { name: '카페',  icon: '☕', bg: 'var(--yellow)', color: '#B8860B' },
    { name: '쇼핑',  icon: '🛍️', bg: 'var(--purple)', color: '#7B52B9' },
    { name: '의료',  icon: '💊', bg: 'var(--green)',  color: '#2E8B57' },
    { name: '문화',  icon: '🎬', bg: 'var(--peach)',  color: '#C96020' },
    { name: '주거',  icon: '🏠', bg: 'var(--blue)',   color: '#3B7CC9' },
    { name: '기타',  icon: '📦', bg: 'var(--purple)', color: '#7B52B9' },
  ],
  income: [
    { name: '급여',  icon: '💰', bg: 'var(--green)',  color: '#2E8B57' },
    { name: '용돈',  icon: '💵', bg: 'var(--yellow)', color: '#B8860B' },
    { name: '기타',  icon: '📦', bg: 'var(--purple)', color: '#7B52B9' },
  ],
};

const ALL_EXPENSE_CATEGORIES = CATEGORIES.expense.map(c => c.name);
const PAYMENT_METHODS = ['카드 결제', '현금', '계좌이체', '간편결제'];

function getCategoryMeta(name: string, type: 'income' | 'expense') {
  const list = CATEGORIES[type];
  return list.find(c => c.name === name) ?? { icon: '📦', bg: 'var(--purple)', color: '#7B52B9' };
}

const DEFAULT_FORM: TransactionForm = {
  type: 'expense',
  amount: '',
  category: '식비',
  memo: '',
  date: dayjs().format('YYYY-MM-DD'),
  paymentMethod: '카드 결제',
  excludedGroupIds: [],
};

// ── Modal ─────────────────────────────────────────────────────────
interface ModalProps {
  target: Transaction | null;
  onClose: () => void;
  onSave: (form: TransactionForm) => void;
  loading: boolean;
  defaultType?: 'income' | 'expense';
  activeGroups?: ActiveGroupSummary[];
}

function TransactionModal({ target, onClose, onSave, loading, defaultType, activeGroups = [] }: ModalProps) {
  const initType = defaultType ?? 'expense';
  const [form, setForm] = useState<TransactionForm>(
    target
      ? {
          type: target.type,
          amount: String(target.amount),
          category: target.category,
          memo: target.memo ?? '',
          date: target.date,
          paymentMethod: target.paymentMethod ?? '카드 결제',
          excludedGroupIds: target.excludedGroupIds ?? [],
        }
      : { ...DEFAULT_FORM, type: initType, category: CATEGORIES[initType][0].name }
  );

  const set = (key: keyof TransactionForm, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleTypeChange = (t: 'income' | 'expense') => {
    const firstCat = CATEGORIES[t][0].name;
    setForm(prev => ({ ...prev, type: t, category: firstCat }));
  };

  const matchingGroups = form.type === 'expense'
    ? activeGroups.filter(g => g.categories === null || g.categories.includes(form.category))
    : [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) return;
    onSave(form);
  };

  return (
    <div className="db-overlay" onClick={onClose}>
      <div className="db-modal" onClick={e => e.stopPropagation()}>
        <div className="db-modal-header">
          <h3>{target ? '내역 수정' : '거래 내역 추가'}</h3>
          <button className="db-modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="db-field">
            <label>유형</label>
            <div className="db-type-toggle">
              <button type="button" className={`db-type-btn expense${form.type === 'expense' ? ' active' : ''}`} onClick={() => handleTypeChange('expense')}>지출</button>
              <button type="button" className={`db-type-btn income${form.type === 'income' ? ' active' : ''}`} onClick={() => handleTypeChange('income')}>수입</button>
            </div>
          </div>

          <div className="db-field">
            <label>금액</label>
            <div className="db-amount-wrap">
              <input type="number" className="db-input" placeholder="0" value={form.amount} onChange={e => set('amount', e.target.value)} min="1" required />
              <span className="db-amount-unit">원</span>
            </div>
          </div>

          <div className="db-field">
            <label>카테고리</label>
            <div className="db-cat-grid">
              {CATEGORIES[form.type].map(c => (
                <button key={c.name} type="button" className={`db-cat-chip${form.category === c.name ? ' active' : ''}`} style={{ '--cat-bg': c.bg } as React.CSSProperties} onClick={() => set('category', c.name)}>
                  {c.icon} {c.name}
                </button>
              ))}
            </div>
          </div>

          <div className="db-field">
            <label>날짜</label>
            <input type="date" className="db-input" value={form.date} onChange={e => set('date', e.target.value)} required />
          </div>

          <div className="db-field">
            <label>결제수단</label>
            <select className="db-input db-select" value={form.paymentMethod} onChange={e => set('paymentMethod', e.target.value)}>
              {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div className="db-field">
            <label>메모 <span className="db-optional">(선택)</span></label>
            <input type="text" className="db-input" placeholder="메모를 입력하세요" value={form.memo} onChange={e => set('memo', e.target.value)} maxLength={100} />
          </div>

          {matchingGroups.length > 0 && (
            <div className="db-field">
              <label className="db-field-label">🏆 포함할 챌린지</label>
              <div className="db-challenge-list">
                {matchingGroups.map(g => {
                  const included = !form.excludedGroupIds.includes(g.id);
                  return (
                    <label key={g.id} className={`db-challenge-item${included ? ' included' : ''}`}>
                      <input
                        type="checkbox"
                        checked={included}
                        onChange={e => setForm(prev => ({
                          ...prev,
                          excludedGroupIds: e.target.checked
                            ? prev.excludedGroupIds.filter(id => id !== g.id)
                            : [...prev.excludedGroupIds, g.id],
                        }))}
                      />
                      <span>{g.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className="db-modal-footer">
            <button type="button" className="db-btn-cancel" onClick={onClose}>취소</button>
            <button type="submit" className="db-btn-save" disabled={loading}>{loading ? '저장 중...' : '저장'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Delete Confirm ─────────────────────────────────────────────────
interface DeleteConfirmProps {
  onCancel: () => void;
  onConfirm: () => void;
  loading: boolean;
}

function DeleteConfirm({ onCancel, onConfirm, loading }: DeleteConfirmProps) {
  return (
    <div className="db-overlay" onClick={onCancel}>
      <div className="db-confirm" onClick={e => e.stopPropagation()}>
        <div className="db-confirm-icon">🗑️</div>
        <p className="db-confirm-msg">이 거래 내역을 삭제할까요?</p>
        <div className="db-confirm-btns">
          <button className="db-btn-cancel" onClick={onCancel}>취소</button>
          <button className="db-btn-delete" onClick={onConfirm} disabled={loading}>{loading ? '삭제 중...' : '삭제'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Dutch Pay Create Modal ─────────────────────────────────────────
interface ParticipantEntry {
  name: string;
  userId?: number;
}

interface FriendOption {
  id: number;
  nickname: string;
  profileImage: string | null;
}

interface DutchPayCreateModalProps {
  onClose: () => void;
  onSave: (data: {
    title: string; totalAmount: string; participants: ParticipantEntry[];
    memo: string; date: string; payerIndex: number; category: string;
  }) => void;
  loading: boolean;
  currentUser: { id: number; nickname: string } | null;
}

function DutchPayCreateModal({ onClose, onSave, loading, currentUser }: DutchPayCreateModalProps) {
  const [title, setTitle] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [participants, setParticipants] = useState<ParticipantEntry[]>([
    { name: currentUser?.nickname ?? '나', userId: currentUser?.id },
    { name: '' },
  ]);
  const [payerIndex, setPayerIndex] = useState(0);
  const [category, setCategory] = useState('식비');
  const [showFriendPicker, setShowFriendPicker] = useState<number | null>(null);

  const { data: friends = [] } = useQuery<FriendOption[]>({
    queryKey: ['friends'],
    queryFn: () => api.get('/api/friends').then(r => r.data),
    retry: false,
  });

  const validParticipants = participants.filter(p => p.name.trim());
  const perPerson = totalAmount && validParticipants.length >= 2
    ? Math.ceil(Number(totalAmount) / validParticipants.length)
    : 0;

  const addParticipant = () => setParticipants(prev => [...prev, { name: '' }]);
  const removeParticipant = (i: number) => {
    setParticipants(prev => prev.filter((_, idx) => idx !== i));
    setPayerIndex(prev => {
      if (prev === i) return 0;
      if (prev > i) return prev - 1;
      return prev;
    });
  };
  const updateParticipantName = (i: number, name: string) =>
    setParticipants(prev => prev.map((p, idx) => idx === i ? { ...p, name, userId: undefined } : p));
  const selectFriend = (i: number, friend: FriendOption) => {
    setParticipants(prev => prev.map((p, idx) => idx === i ? { name: friend.nickname, userId: friend.id } : p));
    setShowFriendPicker(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const valid = participants.filter(p => p.name.trim()).map(p => ({ ...p, name: p.name.trim() }));
    if (!title.trim() || !totalAmount || Number(totalAmount) <= 0 || valid.length < 2) return;
    onSave({ title: title.trim(), totalAmount, participants: valid, memo: memo.trim(), date, payerIndex, category });
  };

  const filledIndices = participants.map((p, i) => ({ raw: i, val: p.name.trim() })).filter(x => x.val);
  const usedFriendIds = new Set(participants.filter(p => p.userId).map(p => p.userId!));

  return (
    <div className="db-overlay" onClick={onClose}>
      <div className="db-modal dutch-modal" onClick={e => e.stopPropagation()}>
        <div className="db-modal-header">
          <h3>더치페이 만들기</h3>
          <button className="db-modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="db-field">
            <label>제목</label>
            <input className="db-input" placeholder="예) 점심 식사" value={title} onChange={e => setTitle(e.target.value)} maxLength={50} required />
          </div>
          <div className="db-field">
            <label>총 금액</label>
            <div className="db-amount-wrap">
              <input className="db-input" type="number" placeholder="0" min="1" value={totalAmount} onChange={e => setTotalAmount(e.target.value)} required />
              <span className="db-amount-unit">원</span>
            </div>
          </div>
          <div className="db-field">
            <label>날짜</label>
            <input className="db-input" type="date" value={date} onChange={e => setDate(e.target.value)} required />
          </div>

          {/* 참여자 입력 */}
          <div className="db-field">
            <div className="dutch-participant-header">
              <label>참여자</label>
              <button type="button" className="dutch-add-participant-btn" onClick={addParticipant}>+ 추가</button>
            </div>
            <div className="dutch-participant-list">
              {participants.map((p, i) => (
                <div key={i} className="dutch-participant-row">
                  {i === 0 ? (
                    // 첫 번째 슬롯: 현재 사용자 고정 chip
                    <div className="dutch-friend-chip dutch-me-chip">
                      <span className="dutch-me-badge">나</span>
                      <span className="dutch-friend-chip-name">{p.name}</span>
                    </div>
                  ) : p.userId ? (
                    <div className="dutch-friend-chip">
                      <span className="dutch-friend-chip-name">{p.name}</span>
                      <button
                        type="button"
                        className="dutch-friend-chip-remove"
                        onClick={() => updateParticipantName(i, '')}
                      >✕</button>
                    </div>
                  ) : (
                    <input
                      className="db-input dutch-participant-input"
                      placeholder={`참여자 ${i + 1}`}
                      value={p.name}
                      onChange={e => updateParticipantName(i, e.target.value)}
                      maxLength={20}
                    />
                  )}
                  {i > 0 && !p.userId && (
                    <div className="dutch-friend-picker-wrap">
                      <button
                        type="button"
                        className="dutch-friend-pick-btn"
                        onClick={() => setShowFriendPicker(showFriendPicker === i ? null : i)}
                        title="친구에서 선택"
                      >
                        👥
                      </button>
                      {showFriendPicker === i && (
                        <div className="dutch-friend-dropdown">
                          {friends
                            .filter(f => !usedFriendIds.has(f.id))
                            .map(f => (
                              <button
                                key={f.id}
                                type="button"
                                className="dutch-friend-option"
                                onClick={() => selectFriend(i, f)}
                              >
                                {f.nickname}
                              </button>
                            ))
                          }
                          {friends.filter(f => !usedFriendIds.has(f.id)).length === 0 && (
                            <div className="dutch-friend-option-empty">선택 가능한 친구가 없어요</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  <button
                    type="button"
                    className={`dutch-payer-crown-btn${payerIndex === i ? ' active' : ''}`}
                    onClick={() => setPayerIndex(prev => prev === i ? -1 : i)}
                    title={payerIndex === i ? '대표 지출자 해제' : '대표 지출자로 지정'}
                  >
                    👑
                  </button>
                  {i > 0 && participants.length > 2 && (
                    <button type="button" className="dutch-remove-btn" onClick={() => removeParticipant(i)}>✕</button>
                  )}
                </div>
              ))}
            </div>
            {perPerson > 0 && (
              <div className="dutch-per-person-preview">
                1인당 <strong>{perPerson.toLocaleString('ko-KR')}원</strong> ({validParticipants.length}명)
              </div>
            )}
          </div>

          {/* 지출 카테고리 (항상 표시) */}
          <div className="db-field">
            <label>지출 카테고리</label>
            <div className="db-cat-grid">
              {CATEGORIES.expense.map(c => (
                <button key={c.name} type="button"
                  className={`db-cat-chip${category === c.name ? ' active' : ''}`}
                  style={{ '--cat-bg': c.bg } as React.CSSProperties}
                  onClick={() => setCategory(c.name)}
                >
                  {c.icon} {c.name}
                </button>
              ))}
            </div>
          </div>

          {payerIndex >= 0 && (
            <div className="dutch-payer-info-box">
              💡 대표 지출자({participants[payerIndex]?.name || '?'})의 지출 내역이 자동 등록되며, 정산될수록 금액이 차감됩니다.
            </div>
          )}

          <div className="db-field">
            <label>메모 <span className="db-optional">(선택)</span></label>
            <input className="db-input" placeholder="메모를 입력하세요" value={memo} onChange={e => setMemo(e.target.value)} maxLength={100} />
          </div>
          <div className="db-modal-footer">
            <button type="button" className="db-btn-cancel" onClick={onClose}>취소</button>
            <button type="submit" className="db-btn-save" disabled={loading}>{loading ? '저장 중...' : '만들기'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Dutch Pay View ─────────────────────────────────────────────────
interface DutchPayViewProps {
  dutchPays: DutchPay[];
  transactions: Transaction[];
  isLoading: boolean;
  onAdd: () => void;
  onDelete: (id: number) => void;
  onTogglePaid: (dutchPayId: number, participantId: number) => void;
  deletingId: number | null;
  togglingId: number | null;
  focusId?: number | null;
  currentUserId?: number | null;
  activeGroups?: ActiveGroupSummary[];
}

function DutchPayView({ dutchPays, transactions, isLoading, onAdd, onDelete, onTogglePaid, deletingId, togglingId, focusId, currentUserId, activeGroups = [] }: DutchPayViewProps) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  // txnId → excludedGroupIds 로컬 캐시 (트랜잭션 원본 데이터로 초기화)
  const [excludedMap, setExcludedMap] = useState<Record<number, number[]>>({});

  const updateExcludedMutation = useMutation({
    mutationFn: ({ txnId, excludedGroupIds }: { txnId: number; excludedGroupIds: number[] }) =>
      api.put(`/api/transactions/${txnId}`, { excludedGroupIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });

  // 카드가 열릴 때 해당 트랜잭션의 실제 excludedGroupIds로 초기화
  const initExcludedForTxn = (txnId: number) => {
    if (txnId in excludedMap) return;
    const txn = transactions.find(t => t.id === txnId);
    setExcludedMap(prev => ({ ...prev, [txnId]: txn?.excludedGroupIds ?? [] }));
  };

  useEffect(() => {
    if (focusId == null) return;
    setExpanded(prev => {
      const next = new Set(prev);
      next.add(focusId);
      return next;
    });
    setTimeout(() => {
      document.getElementById(`dutch-item-${focusId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  }, [focusId]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const fmt = (n: number) => n.toLocaleString('ko-KR');

  const toggleExpand = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        // 펼칠 때 현재 유저의 연결 트랜잭션 excludedGroupIds 초기화
        const dp = dutchPays.find(d => d.id === id);
        if (dp) {
          const myParticipant = dp.participants.find(p => p.userId === currentUserId && !p.isPayer);
          const myTxnId = dp.participants.find(p => p.userId === currentUserId && p.isPayer)
            ? dp.linkedTransactionId
            : (myParticipant?.linkedTransactionId ?? null);
          if (myTxnId) initExcludedForTxn(myTxnId);
        }
      }
      return next;
    });
  };

  const copyShareText = (dp: DutchPay) => {
    const perPerson = Math.ceil(dp.totalAmount / dp.participantCount);
    const lines = [
      `📊 ${dp.title} 더치페이 정산`,
      `📅 ${dayjs(dp.date).format('YYYY년 M월 D일')}`,
      `💰 총액: ${fmt(dp.totalAmount)}원 / 1인당: ${fmt(perPerson)}원`,
      '',
      ...dp.participants.map(p =>
        `${p.isPayer ? '👑' : p.isPaid ? '✅' : '❌'} ${p.name}${p.isPayer ? ' (대표 지출자)' : ''}: ${fmt(p.amountOwed)}원 ${p.isPayer ? '' : p.isPaid ? '(입금 완료)' : '(미정산)'}`
      ),
    ];
    if (dp.memo) lines.splice(3, 0, `📝 ${dp.memo}`);
    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedId(dp.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (isLoading) return <div className="db-empty">불러오는 중...</div>;

  return (
    <div className="dutch-section">
      {dutchPays.length === 0 ? (
        <div className="db-empty">
          <div className="db-empty-icon">🤝</div>
          <p>더치페이 내역이 없어요</p>
          <p className="db-empty-sub">+ 버튼을 눌러 더치페이를 만들어보세요</p>
        </div>
      ) : (
        dutchPays.map(dp => {
          const isOpen = expanded.has(dp.id);
          // 대표 지출자 본인은 "정산" 카운트에서 제외 (본인이 받아야 할 금액 기준)
          const otherParticipants = dp.participants.filter(p => !p.isPayer);
          const paidCount = otherParticipants.filter(p => p.isPaid).length;
          const total = otherParticipants.length;
          const allPaid = total === 0 || paidCount === total;
          const unpaidParticipants = otherParticipants.filter(p => !p.isPaid);
          const perPerson = Math.ceil(dp.totalAmount / dp.participantCount);
          const payerParticipant = dp.participants.find(p => p.isPayer);
          const isCreator = dp.userId === currentUserId;
          const currentUserIsPayer = payerParticipant?.userId === currentUserId;

          return (
            <div key={dp.id} id={`dutch-item-${dp.id}`} className={`dutch-card ${allPaid ? 'dutch-card--done' : ''}`} onClick={() => toggleExpand(dp.id)} style={{ cursor: 'pointer' }}>
              {/* 카드 헤더 (요약 정보) */}
              <div className="dutch-card-header">
                <div className="dutch-card-left">
                  <div className="dutch-card-title">
                    {allPaid ? '✅' : '💸'} {dp.title}
                    {currentUserIsPayer && (
                      <span className="dutch-payer-badge">👑 내가 결제</span>
                    )}
                  </div>
                  <div className="dutch-card-meta">
                    {dayjs(dp.date).format('M월 D일')}
                    {dp.memo && <span> · {dp.memo}</span>}
                  </div>
                </div>
                <div className="dutch-card-right">
                  <div className="dutch-amount-info">
                    <span className="dutch-total">{fmt(dp.totalAmount)}원</span>
                    <span className="dutch-per-person">1인당 {fmt(perPerson)}원</span>
                  </div>
                  <div className={`dutch-progress-badge ${allPaid ? 'done' : ''}`}>
                    {total === 0 ? '전원 정산' : `${paidCount}/${total} 정산`}
                  </div>
                </div>
              </div>

              {/* 미정산 알림 */}
              {!allPaid && unpaidParticipants.length > 0 && (
                <div className="dutch-unpaid-alert">
                  ⚠️ 미정산: {unpaidParticipants.map(p => p.name).join(', ')}
                </div>
              )}

              {/* 펼치기/접기 버튼 */}
              <button
                className={`dutch-expand-btn ${isOpen ? 'open' : ''}`}
                onClick={e => { e.stopPropagation(); toggleExpand(dp.id); }}
                type="button"
              >
                {isOpen ? '접기 ▲' : '상세 보기 ▼'}
              </button>

              {/* 상세 내용 */}
              {isOpen && (
                <div className="dutch-card-body">
                  <div className="dutch-participants">
                    {dp.participants.map(p => {
                      const isMe = p.userId === currentUserId;
                      const canToggle = !p.isPayer && (isCreator || isMe);
                      return (
                        <div key={p.id} className={`dutch-participant-item ${p.isPayer ? 'payer-slot' : p.isPaid ? 'paid' : 'unpaid'}`}>
                          {p.isPayer ? (
                            <span className="dutch-payer-crown" title="대표 지출자">👑</span>
                          ) : canToggle ? (
                            <button
                              className={`dutch-paid-check ${p.isPaid ? 'checked' : ''}`}
                              onClick={e => { e.stopPropagation(); onTogglePaid(dp.id, p.id); }}
                              disabled={togglingId === p.id}
                              title={p.isPaid ? '입금 취소' : '입금 확인'}
                            >
                              {togglingId === p.id ? '…' : p.isPaid ? '✓' : '○'}
                            </button>
                          ) : (
                            <span className={`dutch-paid-check static ${p.isPaid ? 'checked' : ''}`}>
                              {p.isPaid ? '✓' : '○'}
                            </span>
                          )}
                          <div className="dutch-participant-info">
                            <span className="dutch-participant-name">
                              {p.name}
                              {isMe && <span className="dutch-me-label"> (나)</span>}
                            </span>
                            {!p.isPayer && p.isPaid && p.paidAt && (
                              <span className="dutch-paid-time">{dayjs(p.paidAt).format('M/D HH:mm')} 입금</span>
                            )}
                          </div>
                          <span className={`dutch-participant-amount ${p.isPayer ? 'payer' : p.isPaid ? 'paid' : ''}`}>
                            {fmt(p.amountOwed)}원
                            {p.isPayer && isMe && <span className="dutch-my-share"> (내 몫)</span>}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* 대표 지출자 정산 현황 */}
                  {currentUserIsPayer && payerParticipant && (
                    <div className="dutch-settlement-summary">
                      <div className="dutch-settlement-row">
                        <span>최초 지출</span>
                        <span>-{fmt(dp.totalAmount)}원</span>
                      </div>
                      <div className="dutch-settlement-row received">
                        <span>정산 받은 금액</span>
                        <span>+{fmt(otherParticipants.filter(p => p.isPaid).reduce((s, p) => s + p.amountOwed, 0))}원</span>
                      </div>
                      <div className="dutch-settlement-row net">
                        <span>현재 내 실질 지출</span>
                        <span>-{fmt(dp.totalAmount - otherParticipants.filter(p => p.isPaid).reduce((s, p) => s + p.amountOwed, 0))}원</span>
                      </div>
                    </div>
                  )}

                  {/* 챌린지 포함 설정 */}
                  {(() => {
                    const myParticipant = dp.participants.find(p => p.userId === currentUserId && !p.isPayer);
                    const myTxnId = currentUserIsPayer
                      ? dp.linkedTransactionId
                      : (myParticipant?.linkedTransactionId ?? null);
                    if (!myTxnId) return null;

                    const matchingGroups = activeGroups.filter(g =>
                      !dp.category || g.categories === null || g.categories.includes(dp.category)
                    );
                    if (matchingGroups.length === 0) return null;

                    return (
                      <div className="dutch-challenge-section" onClick={e => e.stopPropagation()}>
                        <div className="dutch-challenge-label">📊 챌린지 포함 설정</div>
                        <div className="dutch-challenge-list">
                          {matchingGroups.map(g => {
                            const excluded = excludedMap[myTxnId] ?? [];
                            const isIncluded = !excluded.includes(g.id);
                            return (
                              <label key={g.id} className={`dutch-challenge-item${isIncluded ? ' included' : ''}`}>
                                <input
                                  type="checkbox"
                                  checked={isIncluded}
                                  onChange={() => {
                                    const cur = excludedMap[myTxnId] ?? [];
                                    const next = isIncluded
                                      ? [...cur, g.id]
                                      : cur.filter(id => id !== g.id);
                                    setExcludedMap(prev => ({ ...prev, [myTxnId]: next }));
                                    updateExcludedMutation.mutate({ txnId: myTxnId, excludedGroupIds: next });
                                  }}
                                />
                                <span>{g.name}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="dutch-card-actions" onClick={e => e.stopPropagation()}>
                    <button className="dutch-share-btn" onClick={() => copyShareText(dp)}>
                      {copiedId === dp.id ? '✓ 복사됨' : '📋 정산 내역 복사'}
                    </button>
                    {isCreator && (confirmDeleteId === dp.id ? (
                      <div className="dutch-delete-confirm">
                        <span>거래 내역도 함께 삭제됩니다. 삭제할까요?</span>
                        <button className="dutch-delete-yes" onClick={() => { onDelete(dp.id); setConfirmDeleteId(null); }} disabled={deletingId === dp.id}>
                          {deletingId === dp.id ? '삭제 중...' : '삭제'}
                        </button>
                        <button className="dutch-delete-no" onClick={() => setConfirmDeleteId(null)}>취소</button>
                      </div>
                    ) : (
                      <button className="dutch-delete-btn" onClick={() => setConfirmDeleteId(dp.id)}>🗑️ 삭제</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

// ── Calendar View ─────────────────────────────────────────────────
interface CalendarViewProps {
  currentDate: dayjs.Dayjs;
  transactions: Transaction[];
  onDayClick: (date: string) => void;
  selectedDay: string | null;
}

function CalendarView({ currentDate, transactions, onDayClick, selectedDay }: CalendarViewProps) {
  const fmt = (n: number) => n.toLocaleString('ko-KR');

  const startOfMonth = currentDate.startOf('month');
  const daysInMonth = currentDate.daysInMonth();
  const startWeekday = startOfMonth.day(); // 0=일, 6=토

  // 날짜별 지출/수입 합계
  const dayMap = useMemo(() => {
    const map = new Map<string, { expense: number; income: number }>();
    transactions.forEach(t => {
      const key = t.date;
      const cur = map.get(key) ?? { expense: 0, income: 0 };
      if (t.type === 'expense') cur.expense += t.amount;
      else cur.income += t.amount;
      map.set(key, cur);
    });
    return map;
  }, [transactions]);

  const maxExpense = useMemo(() => {
    let max = 0;
    dayMap.forEach(v => { if (v.expense > max) max = v.expense; });
    return max;
  }, [dayMap]);

  const days: (number | null)[] = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  // 6행 맞추기
  while (days.length % 7 !== 0) days.push(null);

  const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <div className="cal-wrap">
      <div className="cal-grid-header">
        {WEEKDAYS.map((d, i) => (
          <div key={d} className={`cal-weekday${i === 0 ? ' sun' : i === 6 ? ' sat' : ''}`}>{d}</div>
        ))}
      </div>
      <div className="cal-grid">
        {days.map((day, idx) => {
          if (day === null) return <div key={`empty-${idx}`} className="cal-cell empty" />;
          const dateStr = currentDate.format(`YYYY-MM-${String(day).padStart(2, '0')}`);
          const info = dayMap.get(dateStr);
          const isSelected = selectedDay === dateStr;
          const isToday = dayjs().format('YYYY-MM-DD') === dateStr;
          const weekday = (startWeekday + day - 1) % 7;
          const intensity = info && maxExpense > 0 ? info.expense / maxExpense : 0;

          return (
            <div
              key={dateStr}
              className={`cal-cell${isSelected ? ' selected' : ''}${isToday ? ' today' : ''}`}
              onClick={() => onDayClick(dateStr)}
              style={info?.expense ? { '--heat': intensity } as React.CSSProperties : undefined}
            >
              <div className={`cal-day-num${weekday === 0 ? ' sun' : weekday === 6 ? ' sat' : ''}`}>{day}</div>
              {info?.expense ? (
                <div className="cal-expense">-{fmt(info.expense)}</div>
              ) : null}
              {info?.income ? (
                <div className="cal-income">+{fmt(info.income)}</div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* 선택된 날짜 상세 */}
      {selectedDay && (
        <DayDetail
          date={selectedDay}
          transactions={transactions.filter(t => t.date === selectedDay)}
        />
      )}
    </div>
  );
}

interface DayDetailProps {
  date: string;
  transactions: Transaction[];
}

function DayDetail({ date, transactions }: DayDetailProps) {
  const fmt = (n: number) => n.toLocaleString('ko-KR');
  return (
    <div className="cal-day-detail">
      <div className="cal-day-detail-title">{dayjs(date).format('M월 D일 dddd')}</div>
      {transactions.length === 0 ? (
        <div className="cal-day-empty">거래 내역이 없어요</div>
      ) : (
        transactions.map(t => {
          const catMeta = getCategoryMeta(t.category, t.type);
          return (
            <div key={t.id} className="cal-day-item">
              <div className="db-tx-icon" style={{ background: catMeta.bg }}>{catMeta.icon}</div>
              <div className="db-tx-info">
                <div className="db-tx-name">{t.memo || t.category}</div>
                <div className="db-tx-meta">{t.category} · {t.paymentMethod ?? '카드 결제'}</div>
              </div>
              <div className={`db-tx-amount ${t.type}`}>
                {t.type === 'expense' ? '-' : '+'}{fmt(t.amount)}원
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

// ── Stats View ─────────────────────────────────────────────────────
interface StatsViewProps {
  transactions: Transaction[];
  currentDate: dayjs.Dayjs;
}

function StatsView({ transactions, currentDate }: StatsViewProps) {
  const fmt = (n: number) => n.toLocaleString('ko-KR');

  // 주별 수입/지출
  const weeklyData = useMemo(() => {
    const weeks: Record<string, { week: string; income: number; expense: number }> = {};
    transactions.forEach(t => {
      const d = dayjs(t.date);
      const week = `${Math.ceil(d.date() / 7)}주`;
      if (!weeks[week]) weeks[week] = { week, income: 0, expense: 0 };
      if (t.type === 'income') weeks[week].income += t.amount;
      else weeks[week].expense += t.amount;
    });
    return Object.values(weeks).sort((a, b) => a.week.localeCompare(b.week));
  }, [transactions]);

  // 카테고리별 지출 (파이차트용)
  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    transactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        map[t.category] = (map[t.category] ?? 0) + t.amount;
      });
    return Object.entries(map)
      .map(([name, value]) => {
        const meta = getCategoryMeta(name, 'expense');
        return { name, value, color: meta.color };
      })
      .sort((a, b) => b.value - a.value);
  }, [transactions]);

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="chart-tooltip">
        <div className="chart-tooltip-label">{label}</div>
        {payload.map((p: any) => (
          <div key={p.dataKey} className="chart-tooltip-row" style={{ color: p.color }}>
            {p.name}: {fmt(p.value)}원
          </div>
        ))}
      </div>
    );
  };

  const PieTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const p = payload[0];
    const pct = totalExpense > 0 ? ((p.value / totalExpense) * 100).toFixed(1) : '0';
    return (
      <div className="chart-tooltip">
        <div className="chart-tooltip-label">{p.name}</div>
        <div className="chart-tooltip-row">{fmt(p.value)}원 ({pct}%)</div>
      </div>
    );
  };

  return (
    <div className="stats-view">
      {/* 월 요약 */}
      <div className="stats-summary">
        <div className="stats-summary-row">
          <span className="stats-summary-label">총 수입</span>
          <span className="stats-summary-value income">+{fmt(totalIncome)}원</span>
        </div>
        <div className="stats-summary-row">
          <span className="stats-summary-label">총 지출</span>
          <span className="stats-summary-value expense">-{fmt(totalExpense)}원</span>
        </div>
        <div className="stats-summary-divider" />
        <div className="stats-summary-row">
          <span className="stats-summary-label">잔액</span>
          <span className={`stats-summary-value ${totalIncome - totalExpense >= 0 ? 'pos' : 'neg'}`}>
            {totalIncome - totalExpense >= 0 ? '+' : ''}{fmt(totalIncome - totalExpense)}원
          </span>
        </div>
      </div>

      {/* 주별 바 차트 */}
      {weeklyData.length > 0 && (
        <div className="stats-chart-card">
          <div className="stats-chart-title">주별 수입 · 지출</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weeklyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="week" tick={{ fontSize: 12, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text3)' }} axisLine={false} tickLine={false} tickFormatter={v => v >= 10000 ? `${Math.round(v / 1000)}k` : String(v)} width={36} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="income" name="수입" fill="#2E8B57" radius={[4, 4, 0, 0]} maxBarSize={36} />
              <Bar dataKey="expense" name="지출" fill="#C85B7A" radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 카테고리별 지출 파이 차트 */}
      {categoryData.length > 0 && (
        <div className="stats-chart-card">
          <div className="stats-chart-title">카테고리별 지출</div>
          <div className="stats-pie-wrap">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
                <Legend
                  formatter={(value) => <span style={{ fontSize: 12, color: 'var(--text2)' }}>{value}</span>}
                  iconType="circle"
                  iconSize={10}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* 카테고리 상세 목록 */}
          <div className="stats-cat-list">
            {categoryData.map(cat => {
              const pct = totalExpense > 0 ? (cat.value / totalExpense) * 100 : 0;
              return (
                <div key={cat.name} className="stats-cat-row">
                  <div className="stats-cat-name">
                    <span className="stats-cat-dot" style={{ background: cat.color }} />
                    {cat.name}
                  </div>
                  <div className="stats-cat-bar-wrap">
                    <div className="stats-cat-bar" style={{ width: `${pct}%`, background: cat.color }} />
                  </div>
                  <div className="stats-cat-amount">{fmt(cat.value)}원</div>
                  <div className="stats-cat-pct">{pct.toFixed(1)}%</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {categoryData.length === 0 && weeklyData.length === 0 && (
        <div className="db-empty">
          <div className="db-empty-icon">📊</div>
          <p>이 달의 거래 내역이 없어요</p>
          <p className="db-empty-sub">내역을 추가하면 통계가 표시됩니다</p>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────
export default function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [currentDate, setCurrentDate] = useState(dayjs());
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Transaction | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // 카테고리 필터 (지출 카테고리 체크박스)
  const [checkedCategories, setCheckedCategories] = useState<Set<string>>(
    new Set(ALL_EXPENSE_CATEGORIES)
  );
  const [showFilter, setShowFilter] = useState(false);
  const [showDutchModal, setShowDutchModal] = useState(false);
  const [dutchDeletingId, setDutchDeletingId] = useState<number | null>(null);
  const [dutchTogglingId, setDutchTogglingId] = useState<number | null>(null);
  const [fabOpen, setFabOpen] = useState(false);
  const [fabDefaultType, setFabDefaultType] = useState<'income' | 'expense'>('expense');
  const [dutchFocusId, setDutchFocusId] = useState<number | null>(null);

  const year = currentDate.year();
  const month = currentDate.month() + 1;

  // ── Queries ──
  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get('/api/auth/me').then(r => r.data),
    retry: false,
    throwOnError: false,
  });

  const { data: transactions = [], isLoading } = useQuery<Transaction[]>({
    queryKey: ['transactions', year, month],
    queryFn: () =>
      api.get('/api/transactions', { params: { year, month } }).then(r => r.data),
    retry: false,
  });

  const { data: dutchPays = [], isLoading: isDutchLoading } = useQuery<DutchPay[]>({
    queryKey: ['dutch-pays'],
    queryFn: () => api.get('/api/dutch-pays').then(r => r.data),
    retry: false,
  });

  const { data: friendRequests = [] } = useQuery<unknown[]>({
    queryKey: ['friendRequests'],
    queryFn: () => api.get('/api/friends/requests').then(r => r.data),
    retry: false,
    refetchInterval: 30000,
  });

  const { data: myGroupsRaw = [] } = useQuery<ActiveGroupSummary[]>({
    queryKey: ['myGroups'],
    queryFn: () => api.get('/api/groups').then(r => r.data),
    retry: false,
  });
  const todayStr = dayjs().format('YYYY-MM-DD');
  const activeGroups = myGroupsRaw.filter(g => g.startDate <= todayStr && todayStr <= g.endDate);

  const { data: groupInvites = [] } = useQuery<unknown[]>({
    queryKey: ['groupInvites'],
    queryFn: () => api.get('/api/groups/invites').then(r => r.data),
    retry: false,
    refetchInterval: 30000,
  });

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: (form: TransactionForm) =>
      api.post('/api/transactions', { ...form, amount: Number(form.amount) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setShowModal(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, form }: { id: number; form: TransactionForm }) =>
      api.put(`/api/transactions/${id}`, { ...form, amount: Number(form.amount) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setShowModal(false);
      setEditTarget(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/transactions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setDeleteTarget(null);
    },
  });

  const createDutchMutation = useMutation({
    mutationFn: (data: { title: string; totalAmount: string; participants: ParticipantEntry[]; memo: string; date: string; payerIndex: number; category: string }) =>
      api.post('/api/dutch-pays', { ...data, totalAmount: Number(data.totalAmount) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dutch-pays'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setShowDutchModal(false);
    },
  });

  const deleteDutchMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/dutch-pays/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dutch-pays'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setDutchDeletingId(null);
    },
  });

  const togglePaidMutation = useMutation({
    mutationFn: ({ dutchPayId, participantId }: { dutchPayId: number; participantId: number }) =>
      api.patch(`/api/dutch-pays/${dutchPayId}/participants/${participantId}/paid`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dutch-pays'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setDutchTogglingId(null);
    },
  });

  const handleDeleteDutch = (id: number) => {
    setDutchDeletingId(id);
    deleteDutchMutation.mutate(id);
  };

  const handleTogglePaid = (dutchPayId: number, participantId: number) => {
    setDutchTogglingId(participantId);
    togglePaidMutation.mutate({ dutchPayId, participantId });
  };

  // ── 통계 계산 ──
  const stats = useMemo(() => {
    const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return { income, expense, balance: income - expense };
  }, [transactions]);

  // ── 필터링된 거래 내역 (리스트용) ──
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (t.type === 'income') return true;
      return checkedCategories.has(t.category);
    });
  }, [transactions, checkedCategories]);

  // ── 날짜별 그룹핑 (필터 적용) ──
  const grouped = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    filteredTransactions.forEach(t => {
      const list = map.get(t.date) ?? [];
      list.push(t);
      map.set(t.date, list);
    });
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [filteredTransactions]);

  // ── 핸들러 ──
  const openAdd = () => { setEditTarget(null); setShowModal(true); };
  const openEdit = (t: Transaction) => { setEditTarget(t); setShowModal(true); };

  const handleSave = (form: TransactionForm) => {
    if (editTarget) updateMutation.mutate({ id: editTarget.id, form });
    else createMutation.mutate(form);
  };

  const handleLogout = async () => {
    await api.post('/api/auth/logout');
    navigate('/');
  };

  const toggleCategory = (name: string) => {
    setCheckedCategories(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const toggleAllCategories = () => {
    if (checkedCategories.size === ALL_EXPENSE_CATEGORIES.length) {
      setCheckedCategories(new Set());
    } else {
      setCheckedCategories(new Set(ALL_EXPENSE_CATEGORIES));
    }
  };

  const fmt = (n: number) => n.toLocaleString('ko-KR');
  const isMutating = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const isAllChecked = checkedCategories.size === ALL_EXPENSE_CATEGORIES.length;
  const activeFilterCount = ALL_EXPENSE_CATEGORIES.length - checkedCategories.size;

  return (
    <div className="db-wrap">
      {/* ── Nav ── */}
      <nav className="db-nav">
        <span className="db-nav-logo">가계부 메이트</span>
        <div className="db-nav-center">
          <button className="db-month-btn" onClick={() => { setCurrentDate(d => d.subtract(1, 'month')); setSelectedDay(null); }}>‹</button>
          <span className="db-month-label">{currentDate.format('YYYY년 M월')}</span>
          <button
            className="db-month-btn"
            onClick={() => { setCurrentDate(d => d.add(1, 'month')); setSelectedDay(null); }}
            disabled={currentDate.isSame(dayjs(), 'month')}
          >›</button>
        </div>
        <div className="db-nav-right">
          <div className="db-nav-icon-wrap">
            <button className="db-nav-icon-btn" onClick={() => navigate('/groups')} title="절약 대결">
              🏆
            </button>
            {groupInvites.length > 0 && <span className="db-nav-badge" />}
          </div>
          <div className="db-nav-icon-wrap">
            <button className="db-nav-icon-btn" onClick={() => navigate('/friends')} title="친구">
              👥
            </button>
            {friendRequests.length > 0 && <span className="db-nav-badge" />}
          </div>
          {user && (
            <button className="db-user-name db-profile-btn" onClick={() => navigate('/profile')}>
              {user.nickname}
            </button>
          )}
          <button className="db-logout-btn" onClick={handleLogout}>로그아웃</button>
        </div>
      </nav>

      <main className="db-main">
        {/* ── 통계 카드 ── */}
        <div className="db-stats">
          <div className="db-stat-card income">
            <div className="db-stat-label">총 수입</div>
            <div className="db-stat-value">+{fmt(stats.income)}원</div>
          </div>
          <div className="db-stat-card expense">
            <div className="db-stat-label">총 지출</div>
            <div className="db-stat-value">-{fmt(stats.expense)}원</div>
          </div>
          <div className={`db-stat-card balance ${stats.balance >= 0 ? 'pos' : 'neg'}`}>
            <div className="db-stat-label">잔액</div>
            <div className="db-stat-value">{stats.balance >= 0 ? '+' : ''}{fmt(stats.balance)}원</div>
          </div>
        </div>

        {/* ── 뷰 모드 토글 ── */}
        <div className="view-toggle-wrap">
          <div className="view-toggle">
            <button
              className={`view-toggle-btn${viewMode === 'list' ? ' active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              📋 내역
            </button>
            <button
              className={`view-toggle-btn${viewMode === 'calendar' ? ' active' : ''}`}
              onClick={() => setViewMode('calendar')}
            >
              📅 달력
            </button>
            <button
              className={`view-toggle-btn${viewMode === 'stats' ? ' active' : ''}`}
              onClick={() => setViewMode('stats')}
            >
              📊 통계
            </button>
            <button
              className={`view-toggle-btn${viewMode === 'dutch' ? ' active' : ''}`}
              onClick={() => setViewMode('dutch')}
            >
              🤝 더치페이
            </button>
          </div>

          {/* 카테고리 필터 (리스트 뷰에서만) */}
          {viewMode === 'list' && (
            <button
              className={`filter-btn${showFilter ? ' active' : ''}${activeFilterCount > 0 ? ' has-filter' : ''}`}
              onClick={() => setShowFilter(v => !v)}
            >
              🔍 필터
              {activeFilterCount > 0 && <span className="filter-badge">{activeFilterCount}</span>}
            </button>
          )}
        </div>

        {/* ── 카테고리 필터 패널 ── */}
        {viewMode === 'list' && showFilter && (
          <div className="filter-panel">
            <div className="filter-panel-header">
              <span className="filter-panel-title">지출 카테고리 필터</span>
              <button className="filter-all-btn" onClick={toggleAllCategories}>
                {isAllChecked ? '전체 해제' : '전체 선택'}
              </button>
            </div>
            <div className="filter-chips">
              {CATEGORIES.expense.map(cat => {
                const checked = checkedCategories.has(cat.name);
                return (
                  <label key={cat.name} className={`filter-chip${checked ? ' checked' : ''}`} style={{ '--cat-bg': cat.bg } as React.CSSProperties}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCategory(cat.name)}
                      className="filter-checkbox"
                    />
                    {cat.icon} {cat.name}
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* ── 콘텐츠 영역 ── */}
        {viewMode === 'dutch' ? (
          <DutchPayView
            dutchPays={dutchPays}
            isLoading={isDutchLoading}
            onAdd={() => setShowDutchModal(true)}
            onDelete={handleDeleteDutch}
            onTogglePaid={handleTogglePaid}
            deletingId={dutchDeletingId}
            togglingId={dutchTogglingId}
            focusId={dutchFocusId}
            currentUserId={user?.id ?? null}
            transactions={transactions}
            activeGroups={activeGroups}
          />
        ) : isLoading ? (
          <div className="db-empty">불러오는 중...</div>
        ) : viewMode === 'calendar' ? (
          <CalendarView
            currentDate={currentDate}
            transactions={transactions}
            onDayClick={date => setSelectedDay(prev => prev === date ? null : date)}
            selectedDay={selectedDay}
          />
        ) : viewMode === 'stats' ? (
          <StatsView transactions={transactions} currentDate={currentDate} />
        ) : (
          /* ── 리스트 뷰 ── */
          <div className="db-list-section">
            {grouped.length === 0 ? (
              <div className="db-empty">
                <div className="db-empty-icon">📋</div>
                <p>{activeFilterCount > 0 ? '선택한 카테고리에 해당하는 내역이 없어요' : '이 달의 거래 내역이 없어요'}</p>
                <p className="db-empty-sub">
                  {activeFilterCount > 0 ? '필터를 조정해보세요' : '+ 버튼을 눌러 첫 거래를 기록해보세요'}
                </p>
              </div>
            ) : (
              grouped.map(([date, items]) => (
                <div key={date} className="db-date-group">
                  <div className="db-date-label">
                    {dayjs(date).format('M월 D일 dddd')}
                    <span className="db-date-sum">
                      {(() => {
                        const dayExp = items.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
                        const dayInc = items.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
                        const parts = [];
                        if (dayInc > 0) parts.push(`+${fmt(dayInc)}`);
                        if (dayExp > 0) parts.push(`-${fmt(dayExp)}`);
                        return parts.join(' / ');
                      })()}
                    </span>
                  </div>
                  {items.map(t => {
                    const catMeta = getCategoryMeta(t.category, t.type);
                    const isDutch = t.paymentMethod === '더치페이';
                    // 대표 지출자 거래 or 비지출자 참여자 거래 모두 dutch pay 연결
                    let linkedDutch = isDutch ? dutchPays.find(dp => dp.linkedTransactionId === t.id) : null;
                    let linkedParticipant = null;
                    if (!linkedDutch && isDutch) {
                      for (const dp of dutchPays) {
                        const p = dp.participants.find(pt => pt.linkedTransactionId === t.id && !pt.isPayer);
                        if (p) { linkedDutch = dp; linkedParticipant = p; break; }
                      }
                    }
                    // 정산 상태 계산
                    const isSettled = linkedParticipant
                      ? linkedParticipant.isPaid                                         // 비지출자: 내가 payer에게 송금했는지
                      : linkedDutch
                        ? linkedDutch.participants.filter(p => !p.isPayer).every(p => p.isPaid) // 대표지출자: 전원 입금 완료
                        : false;
                    const needsSettlement = !linkedParticipant?.isPayer && linkedParticipant != null && !isSettled;
                    return (
                      <div key={t.id} className={`db-tx-card${isDutch ? ' dutch-linked' : ''}`}>
                        <div className="db-tx-icon" style={{ background: catMeta.bg }}>
                          {isDutch ? '🤝' : catMeta.icon}
                        </div>
                        <div className="db-tx-info">
                          <div className="db-tx-name">
                            {t.memo || t.category}
                            {isDutch && <span className="dutch-tx-badge">더치페이</span>}
                          </div>
                          <div className="db-tx-meta">{t.category} · {isDutch ? (isSettled ? '정산 완료' : needsSettlement ? '정산 필요' : '정산 중') : (t.paymentMethod ?? '카드 결제')}</div>
                        </div>
                        <div className={`db-tx-amount ${t.type}${needsSettlement ? ' needs-settlement' : ''}`}>
                          {t.type === 'expense' ? '-' : '+'}{fmt(t.amount)}원
                        </div>
                        <div className="db-tx-actions">
                          {!isDutch && <button className="db-tx-btn edit" onClick={() => openEdit(t)} title="수정">✏️</button>}
                          {!isDutch && <button className="db-tx-btn del" onClick={() => setDeleteTarget(t)} title="삭제">🗑️</button>}
                          {isDutch && (
                            <button
                              className="db-tx-btn dutch-tx-manage"
                              title="더치페이 탭에서 관리"
                              onClick={() => {
                                setDutchFocusId(linkedDutch?.id ?? null);
                                setViewMode('dutch');
                              }}
                            >🤝</button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* ── FAB 스피드 다이얼 ── */}
      {fabOpen && (
        <div className="fab-backdrop" onClick={() => setFabOpen(false)} />
      )}
      <div className="fab-wrap">
        {fabOpen && (
          <div className="fab-menu">
            <button
              className="fab-item fab-item--dutch"
              onClick={() => { setFabOpen(false); setShowDutchModal(true); }}
            >
              <span className="fab-item-label">더치페이 추가</span>
              <span className="fab-item-icon">🤝</span>
            </button>
            <button
              className="fab-item fab-item--income"
              onClick={() => { setFabOpen(false); setFabDefaultType('income'); setEditTarget(null); setShowModal(true); }}
            >
              <span className="fab-item-label">수입 추가</span>
              <span className="fab-item-icon">💰</span>
            </button>
            <button
              className="fab-item fab-item--expense"
              onClick={() => { setFabOpen(false); setFabDefaultType('expense'); setEditTarget(null); setShowModal(true); }}
            >
              <span className="fab-item-label">지출 추가</span>
              <span className="fab-item-icon">💸</span>
            </button>
          </div>
        )}
        <button
          className={`db-fab${fabOpen ? ' fab-open' : ''}`}
          onClick={() => setFabOpen(v => !v)}
          title="추가"
        >
          <span className="fab-icon">{fabOpen ? '✕' : '+'}</span>
        </button>
      </div>

      {/* ── Modals ── */}
      {showDutchModal && (
        <DutchPayCreateModal
          onClose={() => setShowDutchModal(false)}
          onSave={data => createDutchMutation.mutate(data)}
          loading={createDutchMutation.isPending}
          currentUser={user ?? null}
        />
      )}

      {showModal && (
        <TransactionModal
          target={editTarget}
          onClose={() => { setShowModal(false); setEditTarget(null); }}
          onSave={handleSave}
          loading={isMutating}
          defaultType={editTarget ? undefined : fabDefaultType}
          activeGroups={activeGroups}
        />
      )}

      {deleteTarget && (
        <DeleteConfirm
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          loading={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
