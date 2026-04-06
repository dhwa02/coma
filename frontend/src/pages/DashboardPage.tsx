import { useState, useMemo } from 'react';
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
}

interface TransactionForm {
  type: 'income' | 'expense';
  amount: string;
  category: string;
  memo: string;
  date: string;
  paymentMethod: string;
}

type ViewMode = 'list' | 'calendar' | 'stats';

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
};

// ── Modal ─────────────────────────────────────────────────────────
interface ModalProps {
  target: Transaction | null;
  onClose: () => void;
  onSave: (form: TransactionForm) => void;
  loading: boolean;
}

function TransactionModal({ target, onClose, onSave, loading }: ModalProps) {
  const [form, setForm] = useState<TransactionForm>(
    target
      ? {
          type: target.type,
          amount: String(target.amount),
          category: target.category,
          memo: target.memo ?? '',
          date: target.date,
          paymentMethod: target.paymentMethod ?? '카드 결제',
        }
      : DEFAULT_FORM
  );

  const set = (key: keyof TransactionForm, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleTypeChange = (t: 'income' | 'expense') => {
    const firstCat = CATEGORIES[t][0].name;
    setForm(prev => ({ ...prev, type: t, category: firstCat }));
  };

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
          {user && <span className="db-user-name">{user.nickname}</span>}
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
        {isLoading ? (
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
                    return (
                      <div key={t.id} className="db-tx-card">
                        <div className="db-tx-icon" style={{ background: catMeta.bg }}>{catMeta.icon}</div>
                        <div className="db-tx-info">
                          <div className="db-tx-name">{t.memo || t.category}</div>
                          <div className="db-tx-meta">{t.category} · {t.paymentMethod ?? '카드 결제'}</div>
                        </div>
                        <div className={`db-tx-amount ${t.type}`}>
                          {t.type === 'expense' ? '-' : '+'}{fmt(t.amount)}원
                        </div>
                        <div className="db-tx-actions">
                          <button className="db-tx-btn edit" onClick={() => openEdit(t)} title="수정">✏️</button>
                          <button className="db-tx-btn del" onClick={() => setDeleteTarget(t)} title="삭제">🗑️</button>
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

      {/* ── FAB ── */}
      <button className="db-fab" onClick={openAdd} title="거래 추가">+</button>

      {/* ── Modals ── */}
      {showModal && (
        <TransactionModal
          target={editTarget}
          onClose={() => { setShowModal(false); setEditTarget(null); }}
          onSave={handleSave}
          loading={isMutating}
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
