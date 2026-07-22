'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { format, getDaysInMonth, isAfter, isWeekend, parseISO } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { calculateBalances, formatBDT, getOrCreateCurrentMonth, getMonthLabel } from '@/lib/finance';
import { Expense, FixedOverheadConfig, Meal, Month, Profile, SharedExpenseConfig, UserBalance, CATEGORY_SHORT_LABELS } from '@/lib/types';
import { toast } from 'sonner';
import MealInputModal from '@/components/MealInputModal';
import { CategoryIcon } from '@/components/GeometricIcons';
import { useSelectedMonth } from '@/contexts/MonthContext';
import {
  IconPin, IconBolt, IconWallet, IconTrendDown, IconTrendUp, IconMeal,
  IconLock,
} from '@/components/GeometricIcons';
import { Plus as LucidePlus, Calculator as CalculatorIcon } from 'lucide-react';
import ExpenseForm from '@/components/ExpenseForm';
import Calculator from '@/components/Calculator';

export default function DashboardPage() {
  const { profile } = useAuth();
  const { selectedMonthId, setSelectedMonthId, months, currentMonthLabel } = useSelectedMonth();
  const [month, setMonth] = useState<Month | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [myMeals, setMyMeals] = useState<Record<string, number>>({});
  const [myGuestMeals, setMyGuestMeals] = useState<Record<string, number>>({});
  const [myBalance, setMyBalance] = useState<UserBalance | null>(null);
  const [fixedOverheads, setFixedOverheads] = useState<FixedOverheadConfig[]>([]);
  const [sharedExpenses, setSharedExpenses] = useState<SharedExpenseConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);

  const today = new Date();

  const fetchData = useCallback(async () => {
    if (!profile || !selectedMonthId) return;
    try {
      const currentMonth = months.find(m => m.id === selectedMonthId) || await getOrCreateCurrentMonth();
      setMonth(currentMonth);

      const [profilesRes, expensesRes, mealsRes, overheadRes, sharedRes] = await Promise.all([
        (supabase as any).from('profiles').select('*').eq('status', 'active'),
        (supabase as any).from('expenses').select('*').eq('month_id', currentMonth.id),
        (supabase as any).from('meals').select('*').eq('month_id', currentMonth.id),
        (supabase as any).from('fixed_overhead_configs').select('*').eq('month_id', currentMonth.id),
        (supabase as any).from('shared_expense_configs').select('*').eq('month_id', currentMonth.id),
      ]);
      const allProfiles = (profilesRes.data ?? []) as Profile[];
      const allExpenses = (expensesRes.data ?? []) as Expense[];
      const allMeals = (mealsRes.data ?? []) as Meal[];
      const allOverheads = (overheadRes.data ?? []) as FixedOverheadConfig[];
      const allShared = (sharedRes.data ?? []) as SharedExpenseConfig[];
      setProfiles(allProfiles);
      setExpenses(allExpenses);
      setMeals(allMeals);
      setFixedOverheads(allOverheads);
      setSharedExpenses(allShared);

      const myMealMap: Record<string, number> = {};
      const myGuestMealMap: Record<string, number> = {};
      allMeals.filter(m => m.user_id === profile.id).forEach(m => {
        myMealMap[m.date] = m.count;
        if ((m as any).guest_count) myGuestMealMap[m.date] = (m as any).guest_count ?? 0;
      });
      setMyMeals(myMealMap);
      setMyGuestMeals(myGuestMealMap);

      const openingBalances = (currentMonth.opening_balances as Record<string, number>) ?? {};
      const computed = calculateBalances(allExpenses, allMeals, allProfiles, openingBalances, allOverheads, allShared);
      setMyBalance(computed.find(b => b.userId === profile.id) ?? null);
    } catch {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [profile, selectedMonthId, months]);

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meals' }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  // ── Calendar helpers ──────────────────────────────────────────────────────
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

  const getMealCellClass = (count: number, isFuture: boolean, isLocked: boolean) => {
    if (isFuture || isLocked) return 'meal-cell meal-cell-future';
    if (count === 0) return 'meal-cell meal-cell-0';
    if (count === 0.5) return 'meal-cell meal-cell-half';
    if (count === 1) return 'meal-cell meal-cell-1';
    if (count === 1.5) return 'meal-cell meal-cell-15';
    return 'meal-cell meal-cell-2';
  };

  const getMealCellGuestStyle = (count: number, guestCount: number, isFuture: boolean, isLocked: boolean): React.CSSProperties | undefined => {
    if (isFuture || isLocked || guestCount === 0) return undefined;
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

  // ── Derived stats ─────────────────────────────────────────────────────────
  const totalMyMeals = Object.values(myMeals).reduce((s, v) => s + v, 0);
  const totalMyGuestMeals = Object.values(myGuestMeals).reduce((s, v) => s + v, 0);
  const totalGrocery = expenses.filter(e => e.category === 'grocery').reduce((s, e) => s + e.amount, 0);
  const totalAllMeals = meals.reduce((s, m) => s + m.count + ((m as any).guest_count || 0), 0);
  const perMealRate = totalAllMeals > 0 ? totalGrocery / totalAllMeals : 0;
  const totalMyGrocerySpent = expenses
    .filter(e => e.category === 'grocery')
    .reduce((sum, e) => {
      const paidDetails = e.paid_by_details as Record<string, number> | null;
      if (paidDetails && Object.keys(paidDetails).length > 0) {
        return sum + (paidDetails[profile?.id || ''] ?? 0);
      }
      return sum + (e.paid_by === profile?.id ? e.amount : 0);
    }, 0);

  const isLocked = month?.is_closed ?? false;

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="h-full flex flex-col overflow-hidden animate-pulse">
        <div className="flex-shrink-0 px-5 sm:px-8 md:px-12 pt-7 md:pt-8 pb-4 space-y-1.5">
          <div className="skeleton h-3 w-44 rounded" />
          <div className="skeleton h-7 w-36 rounded-xl" />
          <div className="skeleton h-6 w-24 rounded-lg" />
        </div>
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <div className="w-full md:w-1/2 px-5 sm:px-8 md:pl-12 md:pr-4 pb-6 space-y-3 overflow-y-auto no-scrollbar">
            <div className="skeleton h-20 rounded-2xl" />
            <div className="skeleton h-20 rounded-2xl" />
            <div className="grid grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}
            </div>
            <div className="skeleton h-28 rounded-2xl" />
          </div>
          <div className="hidden md:block md:w-1/2 pl-3 md:pl-4 pr-8 md:pr-12 pb-6">
            <div className="skeleton h-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  // ── Fixed overheads ───────────────────────────────────────────────────────
  const ORDER_FIXED = ['rent'];
  const myOverheads = fixedOverheads
    .filter(c => c.user_id === profile?.id)
    .sort((a, b) => {
      const ai = ORDER_FIXED.indexOf(a.category);
      const bi = ORDER_FIXED.indexOf(b.category);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
  const totalFixed = myOverheads.reduce((s, c) => s + c.amount, 0);

  // ── Shared expenses ───────────────────────────────────────────────────────
  const activeCount = profiles.length || 1;
  const ORDER_SHARED = ['electricity', 'gas', 'internet', 'maid', 'misc'];
  const sharedWithAmount = sharedExpenses
    .filter(s => s.total_amount > 0)
    .sort((a, b) => ORDER_SHARED.indexOf(a.category) - ORDER_SHARED.indexOf(b.category));
  const totalShared = sharedWithAmount.reduce((s, c) => s + c.total_amount / activeCount, 0);

  // ── Balance stats ─────────────────────────────────────────────────────────
  const monthlyExpenseVal = myBalance
    ? myBalance.fixedOverheadShare + myBalance.sharedExpenseShare + totalMyGrocerySpent
    : 0;
  const totalPaidVal = myBalance?.totalPaid ?? 0;
  const dueVal = monthlyExpenseVal - totalPaidVal;
  const isOverpaid = dueVal < 0;
  const calendarProps = { month, currentMonthLabel, calendarDays, getMealCellClass, getMealCellGuestStyle, isLocked, setSelectedDay };

  return (
    <div className="h-full flex flex-col overflow-y-auto overflow-x-hidden animate-fade-in">

      {/* ── Shared heading strip — spans both columns ─────────────── */}
      <div className="flex-shrink-0 flex items-end justify-between px-5 sm:px-8 md:px-12 pt-7 md:pt-8 pb-6">
        <div className="flex flex-col gap-2.5">
          <p className="text-xs font-medium" style={{ color: '#475569' }}>
            {month?.label === currentMonthLabel
              ? format(today, 'EEEE, MMMM d, yyyy')
              : month ? getMonthLabel(month.label) : ''}
          </p>
          <h1 className="text-2xl font-bold leading-tight" style={{ color: '#f1f5f9' }}>
            Hey, <span style={{ color: '#a78bfa' }}>{profile?.username}</span>
          </h1>
          <div className="flex flex-wrap items-center gap-2.5 mt-1.5">
            {months.length > 0 && (
              <div className="relative">
                <select
                  value={selectedMonthId}
                  onChange={e => setSelectedMonthId(e.target.value)}
                  className="bg-[#0d1220] text-slate-300 text-xs font-semibold pl-3 pr-7 py-2 rounded-xl border border-white/10 appearance-none cursor-pointer hover:border-violet-500/40 transition-colors focus:outline-none focus:border-violet-500/60"
                  style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}
                >
                  {months.map(m => (
                    <option key={m.id} value={m.id}>{getMonthLabel(m.label)}</option>
                  ))}
                </select>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                  <svg width="9" height="5" viewBox="0 0 10 6" fill="none">
                    <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
            )}

            {/* On Mobile: Round Circular Icon Buttons aligned right beside the Month Box */}
            <div className="md:hidden flex items-center gap-2">
              {!isLocked && (
                <button
                  id="add-expense-mobile-heading"
                  onClick={() => setShowAddExpense(true)}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white transition-all active:scale-90"
                  style={{
                    background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
                    boxShadow: '0 0 12px rgba(124,58,237,0.5)',
                  }}
                  aria-label="Add Expense"
                >
                  <LucidePlus size={16} strokeWidth={2.5} />
                </button>
              )}
              <button
                id="calc-mobile-heading"
                onClick={() => setShowCalculator(true)}
                className="w-9 h-9 rounded-full flex items-center justify-center text-white transition-all active:scale-90"
                style={{
                  background: 'linear-gradient(135deg, #0ea5e9 0%, #0891b2 100%)',
                  boxShadow: '0 0 12px rgba(14,165,233,0.5)',
                }}
                aria-label="Calculator"
              >
                <CalculatorIcon size={15} strokeWidth={1.8} />
              </button>
            </div>

            {isLocked && (
              <div className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
                style={{ background: 'rgba(244,63,94,0.12)', color: '#f43f5e', border: '1px solid rgba(244,63,94,0.25)' }}>
                <IconLock size={11} />
                Closed
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Two equal columns, both starting at the same Y ───────── */}
      <div className="flex w-full">

        {/* ── LEFT COLUMN — 50% ───────────────────────────────────── */}
        <div className="w-full md:w-1/2 flex-shrink-0 flex flex-col gap-3 px-5 sm:px-8 md:pl-12 md:pr-4 pb-6">

          {/* Fixed Charges */}
          {myOverheads.length > 0 && (
            <div className="relative rounded-2xl overflow-hidden bento-accent-violet">
              <div className="absolute top-0 right-0 w-24 h-24 pointer-events-none opacity-30"
                style={{ background: 'radial-gradient(circle at top right, rgba(167,139,250,0.4) 0%, transparent 70%)' }} />
              <div className="absolute inset-0 pointer-events-none opacity-10"
                style={{ backgroundImage: 'linear-gradient(rgba(167,139,250,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(167,139,250,0.5) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
              <div className="relative p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: 'rgba(167,139,250,0.2)', border: '1px solid rgba(167,139,250,0.3)', color: '#c4b5fd' }}>
                      <IconPin size={15} />
                    </div>
                    <div>
                      <h2 className="font-bold text-sm" style={{ color: '#f1f5f9' }}>Fixed Expenses</h2>
                      <p className="text-[10px] font-medium uppercase tracking-widest" style={{ color: 'rgba(167,139,250,0.7)' }}>Monthly</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-widest mb-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Total</p>
                    <p className="font-extrabold text-xl tracking-tight" style={{ color: '#f1f5f9' }}>{formatBDT(totalFixed)}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {myOverheads.map(c => (
                    <div key={c.id} className="flex items-center gap-2 rounded-xl px-3 py-1.5"
                      style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <div style={{ color: '#c4b5fd', width: 14, height: 14, display: 'flex', alignItems: 'center' }}>
                        <CategoryIcon category={c.category} size={13} />
                      </div>
                      <span className="text-xs font-medium capitalize" style={{ color: 'rgba(255,255,255,0.7)' }}>
                        {CATEGORY_SHORT_LABELS[c.category as keyof typeof CATEGORY_SHORT_LABELS] ?? c.category}
                      </span>
                      <span className="text-xs font-bold" style={{ color: '#f1f5f9' }}>{formatBDT(c.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Shared Expenses */}
          {sharedWithAmount.length > 0 && (
            <div className="relative rounded-2xl overflow-hidden bento-accent-cyan">
              <div className="absolute top-0 right-0 w-24 h-24 pointer-events-none opacity-30"
                style={{ background: 'radial-gradient(circle at top right, rgba(103,232,249,0.4) 0%, transparent 70%)' }} />
              <div className="absolute inset-0 pointer-events-none opacity-10"
                style={{ backgroundImage: 'linear-gradient(rgba(6,182,212,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.5) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
              <div className="relative p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: 'rgba(6,182,212,0.2)', border: '1px solid rgba(6,182,212,0.3)', color: '#67e8f9' }}>
                      <IconBolt size={15} />
                    </div>
                    <div>
                      <h2 className="font-bold text-sm" style={{ color: '#f1f5f9' }}>Shared Expenses</h2>
                      <p className="text-[10px] font-medium uppercase tracking-widest" style={{ color: 'rgba(103,232,249,0.7)' }}>Split equally</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-widest mb-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Your Share</p>
                    <p className="font-extrabold text-xl tracking-tight" style={{ color: '#f1f5f9' }}>{formatBDT(totalShared)}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {sharedWithAmount.map(s => (
                    <div key={s.id} className="flex items-center gap-2 rounded-xl px-3 py-1.5"
                      style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <div style={{ color: '#67e8f9', width: 14, height: 14, display: 'flex', alignItems: 'center' }}>
                        <CategoryIcon category={s.category} size={13} />
                      </div>
                      <span className="text-xs font-medium capitalize" style={{ color: 'rgba(255,255,255,0.7)' }}>
                        {CATEGORY_SHORT_LABELS[s.category as keyof typeof CATEGORY_SHORT_LABELS] ?? s.category}
                      </span>
                      <span className="text-xs font-bold" style={{ color: '#f1f5f9' }}>{formatBDT(s.total_amount / activeCount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 2×2 stat grid */}
          <div className="grid grid-cols-2 gap-3">
            <BentoStatCard
              label="Monthly Expense"
              value={monthlyExpenseVal}
              icon={<IconWallet size={15} />}
              isPrimary
              suffix="Fixed + Shared + Grocery"
            />
            <BentoStatCard
              label={isOverpaid ? 'Overdue' : 'Due'}
              value={Math.abs(dueVal)}
              icon={<IconTrendDown size={15} />}
              accentColor={isOverpaid ? 'emerald' : 'rose'}
              suffix={isOverpaid ? 'Flat owes you' : 'You owe flat'}
            />
            <BentoStatCard
              label="Total Paid"
              value={totalPaidVal}
              icon={<IconTrendUp size={15} />}
              accentColor="violet"
            />
            <BentoStatCard
              label="Grocery Spent"
              value={totalMyGrocerySpent}
              icon={<IconMeal size={15} />}
              accentColor="cyan"
            />
          </div>

          {/* Meal Stats — flex-1 so its bottom edge aligns with Meal Calendar */}
          <div className="bento-card p-4 flex-1 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center icon-container-emerald">
                  <IconMeal size={13} />
                </div>
                <h2 className="font-semibold text-sm" style={{ color: '#f1f5f9' }}>Meal Stats</h2>
              </div>
              <span className="text-xs font-medium" style={{ color: '#475569' }}>{format(today, 'MMM yyyy')}</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 flex-1 items-stretch">
              {(() => {
                const combined = totalMyMeals + totalMyGuestMeals;
                const myPct = combined > 0 ? (totalMyMeals / combined) * 100 : 100;
                const bgGradient = combined > 0
                  ? `linear-gradient(135deg, rgba(167,139,250,0.08) ${myPct}%, rgba(245,158,11,0.08) ${myPct}%)`
                  : 'rgba(255,255,255,0.03)';
                return (
                  <div className="col-span-1 text-center p-3 rounded-xl flex flex-col items-center justify-center h-full"
                    style={{ background: bgGradient, border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="flex justify-center items-baseline gap-0.5">
                      <span className="text-xl font-extrabold text-[#a78bfa]">{totalMyMeals}</span>
                      <span className="text-xs text-slate-500 font-semibold">+</span>
                      <span className="text-sm font-bold text-[#f59e0b]">{totalMyGuestMeals}g</span>
                    </div>
                    <p className="text-[10px] font-medium text-slate-400 mt-1">My Meals</p>
                  </div>
                );
              })()}
              <div className="text-center p-3 rounded-xl flex flex-col items-center justify-center h-full"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <p className="text-xl font-extrabold leading-tight text-[#f1f5f9]">{totalAllMeals}</p>
                <p className="text-[10px] font-medium text-slate-400 mt-1">Total</p>
              </div>
              <div className="text-center p-3 rounded-xl flex flex-col items-center justify-center h-full"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <p className="text-lg font-extrabold leading-tight text-[#22d3ee]">
                  {formatBDT((totalMyMeals + totalMyGuestMeals) * perMealRate)}
                </p>
                <p className="text-[10px] font-medium text-slate-400 mt-1">Meal Cost</p>
              </div>
              <div className="text-center p-3 rounded-xl flex flex-col items-center justify-center h-full"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <p className="text-lg font-extrabold leading-tight text-[#10b981]">{formatBDT(perMealRate)}</p>
                <p className="text-[10px] font-medium text-slate-400 mt-1">Per Meal</p>
              </div>
            </div>
          </div>

          {/* Mobile: calendar below tiles */}
          <div className="block md:hidden">
            <MealCalendar {...calendarProps} />
          </div>

        </div>{/* end left column */}

        {/* ── RIGHT COLUMN — 50% ───────────────────────────────────── */}
        <div className="hidden md:flex flex-col md:w-1/2 flex-shrink-0 h-full pl-3 md:pl-4 pr-8 md:pr-12 pb-6">
          <MealCalendar {...calendarProps} />
        </div>

      </div>{/* end two-column wrapper */}

      {/* ── Meal Modal ─────────────────────────────────────────────── */}
      {selectedDay && month && (
        <MealInputModal
          date={selectedDay}
          currentCount={myMeals[selectedDay] ?? 0}
          currentGuestCount={myGuestMeals[selectedDay] ?? 0}
          userId={profile!.id}
          monthId={month.id}
          onClose={() => setSelectedDay(null)}
          onSaved={(count, guestCount) => {
            setMyMeals(prev => ({ ...prev, [selectedDay]: count }));
            setMyGuestMeals(prev => ({ ...prev, [selectedDay]: guestCount }));
            fetchData();
            setSelectedDay(null);
          }}
        />
      )}
      {/* ── Expense & Calculator Modals ────────────────────────────── */}
      {showAddExpense && month && (
        <ExpenseForm
          monthId={month.id}
          onClose={() => setShowAddExpense(false)}
          onSaved={() => { setShowAddExpense(false); fetchData(); }}
        />
      )}

      {showCalculator && (
        <Calculator onClose={() => setShowCalculator(false)} />
      )}
    </div>
  );
}

// ── Meal Calendar ─────────────────────────────────────────────────────────────
function MealCalendar({
  month, currentMonthLabel, calendarDays, getMealCellClass, getMealCellGuestStyle, isLocked, setSelectedDay,
}: {
  month: any;
  currentMonthLabel: string;
  calendarDays: any[];
  getMealCellClass: (count: number, isFuture: boolean, isLocked: boolean) => string;
  getMealCellGuestStyle: (count: number, guestCount: number, isFuture: boolean, isLocked: boolean) => React.CSSProperties | undefined;
  isLocked: boolean;
  setSelectedDay: (day: string) => void;
}) {
  const firstDayOffset = month ? new Date(`${month.label}-01`).getDay() : 0;
  const totalCells = firstDayOffset + calendarDays.length;
  const rowCount = Math.ceil(totalCells / 7) || 5;

  return (
    <div className="bento-card p-4 h-full flex flex-col justify-between">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-semibold text-sm" style={{ color: '#f1f5f9' }}>Meal Calendar</h2>
          <p className="text-[10px] mt-0.5" style={{ color: '#475569' }}>Tap a day to log meals</p>
        </div>
        <div className="flex items-center gap-2 text-[10px]" style={{ color: '#475569' }}>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} />0
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ background: 'rgba(16,185,129,0.25)' }} />1
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#10b981' }} />2
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.3) 50%, rgba(245,158,11,0.5) 50%)', border: '1px solid rgba(245,158,11,0.4)' }} />+G
          </span>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center my-auto">
        {/* Day labels */}
        <div className="grid grid-cols-7 gap-1.5 mb-1.5">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <div key={i} className="text-center text-[9px] font-semibold uppercase" style={{ color: '#334155' }}>{d}</div>
          ))}
        </div>

        {/* Calendar cells */}
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: month ? new Date(`${month.label}-01`).getDay() : 0 }).map((_, i) => (
            <div key={`offset-${i}`} />
          ))}
          {calendarDays.map(day => {
            const guestStyle = getMealCellGuestStyle(day.count, day.guestCount, day.isFuture, isLocked);
            return (
              <button
                key={day.date}
                id={`meal-cell-${day.date}`}
                onClick={() => !day.isFuture && !isLocked && setSelectedDay(day.date)}
                className={getMealCellClass(day.count, day.isFuture, isLocked)}
                style={guestStyle}
                title={day.guestCount > 0
                  ? `${day.date}: ${day.count} meal(s) + ${day.guestCount} guest`
                  : `${day.date}: ${day.count} meal(s)`}
                disabled={day.isFuture || isLocked}
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
    </div>
  );
}

// ── Bento Stat Card ───────────────────────────────────────────────────────────
function BentoStatCard({ label, value, icon, isPrimary, accentColor, suffix }: {
  label: string;
  value: number;
  icon: React.ReactNode;
  isPrimary?: boolean;
  accentColor?: 'violet' | 'cyan' | 'rose' | 'emerald';
  suffix?: string;
}) {
  const isPositive = value >= 0;
  const accentMap: Record<string, { icon: string; bg: string; border: string; value: string }> = {
    violet:  { icon: '#a78bfa', bg: 'rgba(124,58,237,0.1)',  border: 'rgba(124,58,237,0.2)',  value: '#a78bfa' },
    cyan:    { icon: '#67e8f9', bg: 'rgba(6,182,212,0.1)',   border: 'rgba(6,182,212,0.2)',   value: '#67e8f9' },
    rose:    { icon: '#fda4af', bg: 'rgba(244,63,94,0.1)',   border: 'rgba(244,63,94,0.2)',   value: '#fda4af' },
    emerald: { icon: '#6ee7b7', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.2)',  value: '#6ee7b7' },
  };
  const accent = accentColor ? accentMap[accentColor] : null;
  const primaryColor  = isPositive ? '#10b981' : '#f43f5e';
  const primaryBg     = isPositive ? 'rgba(16,185,129,0.08)' : 'rgba(244,63,94,0.08)';
  const primaryBorder = isPositive ? 'rgba(16,185,129,0.2)'  : 'rgba(244,63,94,0.2)';

  return (
    <div className="rounded-2xl p-3.5 h-[104px] flex flex-col justify-between transition-all duration-200"
      style={{
        background: isPrimary ? primaryBg  : (accent?.bg ?? 'rgba(255,255,255,0.03)'),
        border: `1px solid ${isPrimary ? primaryBorder : (accent?.border ?? 'rgba(255,255,255,0.07)')}`,
      }}>
      <div className="flex items-center gap-1.5 mb-2" style={{ color: isPrimary ? primaryColor : (accent?.icon ?? '#64748b') }}>
        {icon}
        <span className="text-[10px] font-medium" style={{ color: '#475569' }}>{label}</span>
      </div>
      <p className="text-lg font-extrabold leading-tight" style={{ color: isPrimary ? primaryColor : (accent?.value ?? '#f1f5f9') }}>
        {formatBDT(Math.abs(value))}
      </p>
      {suffix ? (
        <p className="text-[9px] font-semibold" style={{ color: isPrimary ? primaryColor : '#475569' }}>{suffix}</p>
      ) : <div />}
    </div>
  );
}
