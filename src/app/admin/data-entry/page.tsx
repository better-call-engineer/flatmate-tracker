'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { format, getDaysInMonth, startOfMonth, isAfter, isWeekend, parseISO } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { calculateBalances, formatBDT, getOrCreateCurrentMonth, getMonthLabel, getAllMonths } from '@/lib/finance';
import { Expense, FixedOverheadConfig, Meal, Month, Profile, SharedExpenseConfig, UserBalance, CATEGORY_SHORT_LABELS, CATEGORY_LABELS } from '@/lib/types';
import { toast } from 'sonner';
import MealInputModal from '@/components/MealInputModal';
import ExpenseForm from '@/components/ExpenseForm';
import {
  IconMeal, IconPlus, IconLock, IconCalendar, IconChevronRight, IconWallet, IconTrendUp,
} from '@/components/GeometricIcons';
import { Trash2, Plus, Edit3, Loader2, ChevronDown } from 'lucide-react';

export default function AdminDataEntryPage() {
  const { profile: adminProfile } = useAuth();
  const [months, setMonths] = useState<Month[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedMonthId, setSelectedMonthId] = useState<string>('');
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  
  const [month, setMonth] = useState<Month | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [myMeals, setMyMeals] = useState<Record<string, number>>({});
  const [myGuestMeals, setMyGuestMeals] = useState<Record<string, number>>({});
  const [balances, setBalances] = useState<UserBalance[]>([]);
  const [myBalance, setMyBalance] = useState<UserBalance | null>(null);
  const [fixedOverheads, setFixedOverheads] = useState<FixedOverheadConfig[]>([]);
  const [sharedExpenses, setSharedExpenses] = useState<SharedExpenseConfig[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [fetchingData, setFetchingData] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  
  const today = new Date();
  const currentMonthLabel = format(today, 'yyyy-MM');

  // Load initial dropdown data (months and active profiles)
  useEffect(() => {
    const initDropdowns = async () => {
      try {
        const [monthsData, profilesRes] = await Promise.all([
          getAllMonths(),
          (supabase as any).from('profiles').select('*').eq('status', 'active').order('slot'),
        ]);
        
        setMonths(monthsData);
        const activeProfs = (profilesRes.data ?? []) as Profile[];
        setProfiles(activeProfs);
        
        if (monthsData.length > 0) {
          const currentMonth = await getOrCreateCurrentMonth();
          setSelectedMonthId(currentMonth.id);
        }
        if (activeProfs.length > 0) {
          setSelectedProfileId(activeProfs[0].id);
        }
      } catch (err) {
        toast.error('Failed to initialize data entry selections');
      } finally {
        setLoading(false);
      }
    };
    initDropdowns();
  }, []);

  const fetchData = useCallback(async () => {
    if (!selectedMonthId || !selectedProfileId) return;
    setFetchingData(true);
    try {
      const targetMonth = months.find(m => m.id === selectedMonthId) || await getOrCreateCurrentMonth();
      const targetProfile = profiles.find(p => p.id === selectedProfileId) || null;
      setMonth(targetMonth);
      setSelectedProfile(targetProfile);

      const [expensesRes, mealsRes, overheadRes, sharedRes] = await Promise.all([
        (supabase as any).from('expenses').select('*').eq('month_id', targetMonth.id),
        (supabase as any).from('meals').select('*').eq('month_id', targetMonth.id),
        (supabase as any).from('fixed_overhead_configs').select('*'),
        (supabase as any).from('shared_expense_configs').select('*'),
      ]);

      const allExpenses = (expensesRes.data ?? []) as Expense[];
      const allMeals = (mealsRes.data ?? []) as Meal[];
      const allOverheads = (overheadRes.data ?? []) as FixedOverheadConfig[];
      const allShared = (sharedRes.data ?? []) as SharedExpenseConfig[];

      setExpenses(allExpenses);
      setMeals(allMeals);
      setFixedOverheads(allOverheads);
      setSharedExpenses(allShared);

      // Filter meals specific to the selected user
      const userMealMap: Record<string, number> = {};
      const userGuestMealMap: Record<string, number> = {};
      allMeals.filter(m => m.user_id === selectedProfileId).forEach(m => {
        userMealMap[m.date] = m.count;
        userGuestMealMap[m.date] = m.guest_count ?? 0;
      });
      setMyMeals(userMealMap);
      setMyGuestMeals(userGuestMealMap);

      const openingBalances = (targetMonth.opening_balances as Record<string, number>) ?? {};
      const computed = calculateBalances(allExpenses, allMeals, profiles, openingBalances, allOverheads, allShared);
      setBalances(computed);
      setMyBalance(computed.find(b => b.userId === selectedProfileId) ?? null);
    } catch (err) {
      toast.error('Failed to load data for selected month/profile');
    } finally {
      setFetchingData(false);
    }
  }, [selectedMonthId, selectedProfileId, months, profiles]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDeleteExpense = async (expenseId: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    try {
      const { error } = await (supabase as any).from('expenses').delete().eq('id', expenseId);
      if (error) throw error;
      toast.success('Expense deleted successfully');
      fetchData();
    } catch (err) {
      toast.error('Failed to delete expense');
    }
  };

  const daysInMonth = month ? getDaysInMonth(parseISO(`${month.label}-01`)) : 30;
  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => {
    const dayNum = i + 1;
    const dateStr = `${month ? month.label : currentMonthLabel}-${String(dayNum).padStart(2, '0')}`;
    const dateObj = parseISO(dateStr);
    return {
      date: dateStr,
      dayNumber: dayNum,
      count: myMeals[dateStr] ?? 0,
      guestCount: myGuestMeals[dateStr] ?? 0,
      isFuture: isAfter(dateObj, today),
      isWeekend: isWeekend(dateObj),
    };
  });

  const getMealCellClass = (count: number, isFuture: boolean) => {
    if (isFuture) return 'meal-cell meal-cell-future';
    if (count === 0) return 'meal-cell meal-cell-0';
    if (count === 0.5) return 'meal-cell meal-cell-half';
    if (count === 1) return 'meal-cell meal-cell-1';
    if (count === 1.5) return 'meal-cell meal-cell-15';
    return 'meal-cell meal-cell-2';
  };

  const getMealCellGuestStyle = (count: number, guestCount: number, isFuture: boolean): React.CSSProperties | undefined => {
    if (isFuture || guestCount === 0) return undefined;
    const total = count + guestCount;
    const regularPct = Math.round((count / total) * 100);
    const emeraldAlpha = count === 0 ? 0 : count <= 0.5 ? 0.2 : count <= 1 ? 0.35 : count <= 1.5 ? 0.55 : 1;
    const emeraldColor = count === 0 ? 'transparent' : `rgba(16,185,129,${emeraldAlpha})`;
    return {
      background: `linear-gradient(135deg, ${emeraldColor} ${regularPct}%, rgba(245,158,11,0.5) ${regularPct}%)`,
      border: '1px solid rgba(245,158,11,0.4)',
      boxShadow: '0 0 10px rgba(245,158,11,0.2)',
      color: '#fef3c7',
    };
  };

  const totalMyMeals = Object.values(myMeals).reduce((s, v) => s + v, 0);
  const totalMyGuestMeals = Object.values(myGuestMeals).reduce((s, v) => s + v, 0);
  const totalGrocery = expenses.filter(e => e.category === 'grocery').reduce((s, e) => s + e.amount, 0);
  const totalAllMeals = meals.reduce((s, m) => s + m.count + (m.guest_count || 0), 0);
  const perMealRate = totalAllMeals > 0 ? totalGrocery / totalAllMeals : 0;

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-4 animate-pulse">
        <div className="skeleton h-10 w-64 rounded-xl" />
        <div className="skeleton h-20 rounded-2xl" />
        <div className="skeleton h-64 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 pb-28 md:pb-8 animate-fade-in max-w-2xl mx-auto space-y-6">
      
      {/* ── Header ──────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#f1f5f9' }}>
          Historical <span style={{ color: '#06b6d4' }}>Data Entry</span>
        </h1>
        <p className="text-xs text-text-muted mt-1">Select a month and a roommate to input their daily meals, or manage expenses.</p>
      </div>

      {/* ── Selection Dropdowns ────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-text-secondary text-xs font-semibold uppercase tracking-wider block">Month</label>
          <div className="relative">
            <select
              value={selectedMonthId}
              onChange={e => setSelectedMonthId(e.target.value)}
              className="input pr-10 text-sm appearance-none cursor-pointer"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#f1f5f9',
              }}
            >
              {months.map(m => (
                <option key={m.id} value={m.id} className="bg-[#0d1220] text-slate-200">
                  {getMonthLabel(m.label)} {m.is_closed ? '(Closed)' : '(Open)'}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-text-secondary text-xs font-semibold uppercase tracking-wider block">Flatmate</label>
          <div className="relative">
            <select
              value={selectedProfileId}
              onChange={e => setSelectedProfileId(e.target.value)}
              className="input pr-10 text-sm appearance-none cursor-pointer"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#f1f5f9',
              }}
            >
              {profiles.map(p => (
                <option key={p.id} value={p.id} className="bg-[#0d1220] text-slate-200">
                  {p.username} (Slot {p.slot})
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* ── Flatmate Selection Pills ──────────────────────────────── */}
      <div className="flex flex-wrap gap-2 py-1">
        {profiles.map(p => {
          const isSelected = p.id === selectedProfileId;
          return (
            <button
              key={p.id}
              onClick={() => setSelectedProfileId(p.id)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all duration-150 active:scale-95"
              style={isSelected ? {
                background: 'rgba(6,182,212,0.15)',
                color: '#67e8f9',
                border: '1px solid rgba(6,182,212,0.3)',
                boxShadow: '0 0 12px rgba(6,182,212,0.15)',
              } : {
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                color: '#64748b',
              }}
            >
              <div
                className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-extrabold flex-shrink-0"
                style={{ backgroundColor: p.avatar_color }}
              >
                {p.username.charAt(0).toUpperCase()}
              </div>
              <span>{p.username}</span>
            </button>
          );
        })}
      </div>

      {fetchingData ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      ) : (
        <>
          {/* ── Meal Stats ───────────────────────────────────────────── */}
          <div className="bento-card p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center icon-container-emerald">
                  <IconMeal size={13} />
                </div>
                <h2 className="font-semibold text-sm" style={{ color: '#f1f5f9' }}>Meal Stats ({selectedProfile?.username})</h2>
              </div>
              <span className="text-xs font-medium text-text-muted">{month ? getMonthLabel(month.label) : ''}</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div className="text-center py-2.5 px-1 rounded-xl flex flex-col justify-between"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <p className="text-xl font-extrabold text-[#6ee7b7]">{totalMyMeals}</p>
                <p className="text-[9px] font-medium text-[#475569] mt-2">Meals</p>
              </div>

              <div className="text-center py-2.5 px-1 rounded-xl flex flex-col justify-between"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <p className="text-xl font-extrabold text-[#f59e0b]">{totalMyGuestMeals}</p>
                <p className="text-[9px] font-medium text-[#475569] mt-2">Guest</p>
              </div>

              <div className="text-center py-2.5 px-1 rounded-xl flex flex-col justify-between"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <p className="text-xl font-extrabold text-[#22d3ee]">{formatBDT((totalMyMeals + totalMyGuestMeals) * perMealRate)}</p>
                <p className="text-[9px] font-medium text-[#475569] mt-2">Meal Cost</p>
              </div>

              <div className="text-center py-2.5 px-1 rounded-xl flex flex-col justify-between"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <p className="text-xl font-extrabold text-[#10b981]">{formatBDT(perMealRate)}</p>
                <p className="text-[9px] font-medium text-[#475569] mt-2">Per Meal</p>
              </div>
            </div>
          </div>

          {/* ── Meal Calendar ────────────────────────────────────────── */}
          <div className="bento-card p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-sm" style={{ color: '#f1f5f9' }}>Meal Calendar</h2>
                <p className="text-[10px] text-text-muted mt-0.5">Click any day to input meals for {selectedProfile?.username}</p>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-1">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <div key={i} className="text-center text-[9px] font-semibold uppercase" style={{ color: '#334155' }}>{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {month && Array.from({ length: startOfMonth(parseISO(`${month.label}-01`)).getDay() }).map((_, i) => (
                <div key={`offset-${i}`} />
              ))}
              {calendarDays.map(day => {
                const guestStyle = getMealCellGuestStyle(day.count, day.guestCount, day.isFuture);
                return (
                  <button
                    key={day.date}
                    id={`meal-cell-${day.date}`}
                    onClick={() => !day.isFuture && setSelectedDay(day.date)}
                    className={getMealCellClass(day.count, day.isFuture)}
                    style={guestStyle}
                    disabled={day.isFuture}
                    title={`${day.date}: ${day.count} meal(s) + ${day.guestCount} guest`}
                  >
                    <span className="leading-none">{day.count > 0 || day.guestCount > 0 ? day.count : day.dayNumber}</span>
                    {day.guestCount > 0 && (
                      <span className="absolute bottom-0.5 right-0.5 text-[7px] font-bold leading-none" style={{ color: '#fbbf24' }}>
                        +{day.guestCount}g
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Expenses Management ───────────────────────────────────── */}
          <div className="bento-card p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center icon-container-violet">
                  <IconWallet size={13} />
                </div>
                <h2 className="font-semibold text-sm" style={{ color: '#f1f5f9' }}>Expenses List ({month ? getMonthLabel(month.label) : ''})</h2>
              </div>
              <button
                onClick={() => setShowExpenseForm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors bg-violet-600 text-white hover:bg-violet-700 active:scale-95"
              >
                <Plus size={13} /> Add Expense
              </button>
            </div>

            {expenses.length === 0 ? (
              <div className="text-center py-6 text-text-muted text-xs">
                No expenses logged in this month.
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {expenses.map(e => (
                  <div key={e.id} className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/2 hover:bg-white/4 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-200">
                        {CATEGORY_LABELS[e.category as keyof typeof CATEGORY_LABELS] || e.category}
                      </p>
                      {e.description && (
                        <p className="text-[10px] text-slate-500 truncate mt-0.5">{e.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-200">{formatBDT(e.amount)}</span>
                      <button
                        onClick={() => handleDeleteExpense(e.id)}
                        className="text-slate-500 hover:text-rose-500 transition-colors p-1"
                        title="Delete expense"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Meal Modal ───────────────────────────────────────────── */}
      {selectedDay && month && selectedProfileId && (
        <MealInputModal
          date={selectedDay}
          currentCount={myMeals[selectedDay] ?? 0}
          currentGuestCount={myGuestMeals[selectedDay] ?? 0}
          userId={selectedProfileId}
          monthId={month.id}
          onClose={() => setSelectedDay(null)}
          onSaved={() => {
            fetchData();
            setSelectedDay(null);
          }}
        />
      )}

      {/* ── Expense Form Modal ────────────────────────────────────── */}
      {showExpenseForm && selectedMonthId && (
        <ExpenseForm
          monthId={selectedMonthId}
          onClose={() => setShowExpenseForm(false)}
          onSaved={() => {
            fetchData();
            setShowExpenseForm(false);
          }}
        />
      )}
    </div>
  );
}
