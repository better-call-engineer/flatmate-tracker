'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Expense, Meal, Profile } from '@/lib/types';
import { CATEGORY_LABELS } from '@/lib/types';
import { formatBDT } from '@/lib/finance';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { CategoryIcon, IconActivity } from '@/components/GeometricIcons';
import { useSelectedMonth } from '@/contexts/MonthContext';
import { getMonthLabel } from '@/lib/finance';

import { Plus, Calculator as CalculatorIcon } from 'lucide-react';
import ExpenseForm from '@/components/ExpenseForm';
import Calculator from '@/components/Calculator';

interface FeedItem {
  id: string;
  type: 'expense' | 'meal';
  timestamp: string;
  user: Profile | undefined;
  content: string;
  subContent?: string;
  category?: string;
  amount?: number;
}

export default function ActivityPage() {
  const { profile } = useAuth();
  const { selectedMonthId, setSelectedMonthId, months } = useSelectedMonth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);

  const profileMap = new Map(profiles.map(p => [p.id, p]));

  const fetchData = useCallback(async () => {
    if (!selectedMonthId) return;
    setLoading(true);

    const [profRes, expRes, mealRes] = await Promise.all([
      (supabase as any).from('profiles').select('*').eq('status', 'active'),
      (supabase as any).from('expenses').select('*').eq('month_id', selectedMonthId).order('created_at', { ascending: false }).limit(50),
      (supabase as any).from('meals').select('*').eq('month_id', selectedMonthId).order('date', { ascending: false }).limit(50),
    ]);

    const allProfiles = (profRes.data ?? []) as Profile[];
    setProfiles(allProfiles);
    const pMap = new Map(allProfiles.map((p: Profile) => [p.id, p]));

    const expenseItems: FeedItem[] = (expRes.data ?? []).map((e: Expense) => {
      const paidDetails = e.paid_by_details as Record<string, number> | null;
      let user = pMap.get(e.paid_by);
      let content = `${CATEGORY_LABELS[e.category as keyof typeof CATEGORY_LABELS]}`;
      if (paidDetails && Object.keys(paidDetails).length > 1) {
        const names = Object.keys(paidDetails).map(uid => pMap.get(uid)?.username).filter(Boolean);
        user = pMap.get(Object.keys(paidDetails)[0]);
        content = `split payment — ${CATEGORY_LABELS[e.category as keyof typeof CATEGORY_LABELS]} (${names.join(', ')})`;
      }
      return {
        id: e.id,
        type: 'expense',
        timestamp: e.created_at,
        user,
        content,
        subContent: formatBDT(e.amount),
        category: e.category,
        amount: e.amount,
      };
    });

    const mealItems: FeedItem[] = (mealRes.data ?? []).map((m: Meal) => {
      const guestText = m.guest_count && m.guest_count > 0 ? ` (+${m.guest_count} guest)` : '';
      return {
        id: m.id,
        type: 'meal',
        timestamp: m.date + 'T00:00:00',
        user: pMap.get(m.user_id),
        content: `Logged ${m.count} meal${m.count !== 1 ? 's' : ''}${guestText}`,
        subContent: m.date,
      };
    });

    const combined = [...expenseItems, ...mealItems]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    setItems(combined);
    setLoading(false);
  }, [selectedMonthId]);

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel('activity-page')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'expenses' }, fetchData)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'meals' }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const expenseItems = items.filter(i => i.type === 'expense');
  const mealItems = items.filter(i => i.type === 'meal');

  return (
    <div className="h-full overflow-y-auto no-scrollbar px-5 sm:px-8 md:px-12 pt-7 md:pt-8 pb-6 animate-fade-in">

      {/* Header */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center icon-container-violet">
            <IconActivity size={16} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: '#f1f5f9' }}>Activity Feed</h1>
            <p className="text-xs" style={{ color: '#475569' }}>Recent expenses and meal logs</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Month selector box */}
          {months.length > 0 && (
            <div className="relative">
              <select
                value={selectedMonthId}
                onChange={e => setSelectedMonthId(e.target.value)}
                className="bg-[#0d1220] text-slate-300 text-xs font-semibold pl-3 pr-8 py-2 rounded-xl border border-white/10 appearance-none cursor-pointer hover:border-violet-500/40 transition-colors focus:outline-none focus:border-violet-500/60"
                style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}
              >
                {months.map(m => (
                  <option key={m.id} value={m.id}>{getMonthLabel(m.label)}</option>
                ))}
              </select>
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
                  <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
          )}

          {/* Add Expense button */}
          <button
            id="activity-add-btn"
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white transition-all active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
              boxShadow: '0 0 12px rgba(124,58,237,0.4)',
            }}
          >
            <Plus className="w-4 h-4" />
            Add Expense
          </button>

          {/* Calculator button */}
          <button
            id="activity-calc-btn"
            onClick={() => setShowCalculator(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white transition-all active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #0ea5e9 0%, #0891b2 100%)',
              boxShadow: '0 0 12px rgba(14,165,233,0.4)',
            }}
          >
            <CalculatorIcon className="w-4 h-4" />
            Calculator
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 animate-pulse">
          {[...Array(8)].map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: '#334155' }}>
            <IconActivity size={24} />
          </div>
          <p className="text-sm font-medium" style={{ color: '#334155' }}>No activity yet this month</p>
        </div>
      ) : (
        <div className="space-y-6">

          {/* Expense items */}
          {expenseItems.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.06)' }} />
                <span className="text-[10px] font-bold uppercase tracking-widest px-3"
                  style={{ color: '#f43f5e' }}>Expenses ({expenseItems.length})</span>
                <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.06)' }} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {expenseItems.map(item => (
                  <ActivityTile key={`expense-${item.id}`} item={item} />
                ))}
              </div>
            </section>
          )}

          {/* Meal items */}
          {mealItems.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.06)' }} />
                <span className="text-[10px] font-bold uppercase tracking-widest px-3"
                  style={{ color: '#10b981' }}>Meals ({mealItems.length})</span>
                <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.06)' }} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {mealItems.map(item => (
                  <ActivityTile key={`meal-${item.id}`} item={item} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {showForm && selectedMonthId && (
        <ExpenseForm
          monthId={selectedMonthId}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetchData(); }}
        />
      )}

      {showCalculator && (
        <Calculator onClose={() => setShowCalculator(false)} />
      )}
    </div>
  );
}

function ActivityTile({ item }: { item: FeedItem }) {
  const isExpense = item.type === 'expense';
  const accentColor = isExpense ? '#f43f5e' : '#10b981';
  const accentBg = isExpense ? 'rgba(244,63,94,0.06)' : 'rgba(16,185,129,0.06)';
  const accentBorder = isExpense ? 'rgba(244,63,94,0.15)' : 'rgba(16,185,129,0.15)';

  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-2 transition-all duration-200 hover:translate-y-[-1px] relative overflow-hidden"
      style={{
        background: accentBg,
        border: `1px solid ${accentBorder}`,
        boxShadow: `0 0 0 1px ${isExpense ? 'rgba(244,63,94,0.05)' : 'rgba(16,185,129,0.05)'}, 0 4px 20px rgba(0,0,0,0.4)`,
      }}
    >
      {/* Decorative glow */}
      <div className="absolute top-0 right-0 w-16 h-16 pointer-events-none opacity-20"
        style={{ background: `radial-gradient(circle at top right, ${accentColor} 0%, transparent 70%)` }} />

      {/* Top row: avatar + category icon */}
      <div className="flex items-center justify-between">
        {/* User avatar */}
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
          style={{
            backgroundColor: item.user?.avatar_color ?? '#334155',
            boxShadow: `0 0 10px ${item.user?.avatar_color ?? '#334155'}60`,
          }}>
          {item.user?.username.charAt(0).toUpperCase() ?? '?'}
        </div>

        {/* Category icon for expenses */}
        {isExpense && item.category && (
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)', color: '#fda4af' }}>
            <CategoryIcon category={item.category} size={13} />
          </div>
        )}
        {!isExpense && (
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#6ee7b7' }}>
            <span className="text-sm">🍽</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1">
        <p className="text-xs font-semibold" style={{ color: '#94a3b8' }}>
          {item.user?.username ?? 'Unknown'}
        </p>
        <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>{item.content}</p>
      </div>

      {/* Bottom row: amount + time */}
      <div className="flex items-center justify-between">
        {item.subContent && (
          <span className="text-sm font-extrabold" style={{ color: accentColor }}>
            {item.subContent}
          </span>
        )}
        <span className="text-[10px]" style={{ color: '#334155' }}>
          {formatDistanceToNow(parseISO(item.timestamp), { addSuffix: true })}
        </span>
      </div>
    </div>
  );
}
