'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { format, getDaysInMonth, isAfter, isWeekend, parseISO } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { calculateBalances, formatBDT, getOrCreateCurrentMonth, getMonthLabel, getOpeningBalancesForMonth, parseCarryForward } from '@/lib/finance';
import { Expense, FixedOverheadConfig, Meal, Month, Profile, SharedExpenseConfig, UserBalance, CarryForwardBalance, CATEGORY_SHORT_LABELS, CATEGORY_LABELS } from '@/lib/types';
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
  const [showMonthlyBreakdown, setShowMonthlyBreakdown] = useState(false);
  const [showTotalPaidBreakdown, setShowTotalPaidBreakdown] = useState(false);

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

      const openingBalances = await getOpeningBalancesForMonth(currentMonth, months);
      currentMonth.opening_balances = openingBalances as any;

      // Fetch advance payments made in OTHER months but targeting this month
      const advanceRes = await (supabase as any)
        .from('expenses')
        .select('*')
        .eq('is_advance', true)
        .eq('advance_for_month', currentMonth.label);
      const advanceExpenses = (advanceRes.data ?? []) as Expense[];
      const advanceCredits: Record<string, number> = {};
      advanceExpenses.forEach(e => {
        const paidDetails = e.paid_by_details as Record<string, number> | null;
        if (paidDetails && Object.keys(paidDetails).length > 0) {
          Object.entries(paidDetails).forEach(([uid, amt]) => {
            advanceCredits[uid] = (advanceCredits[uid] ?? 0) + amt;
          });
        } else {
          advanceCredits[e.paid_by] = (advanceCredits[e.paid_by] ?? 0) + e.amount;
        }
      });

      const computed = calculateBalances(allExpenses, allMeals, allProfiles, openingBalances, allOverheads, allShared, advanceCredits);
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
    const dayOfWeek = dateObj.getDay(); // 0 = Sun, 1 = Mon, ..., 5 = Fri, 6 = Sat
    return {
      date: dateStr,
      dayNumber: dayNum,
      count: myMeals[dateStr] ?? 0,
      guestCount: myGuestMeals[dateStr] ?? 0,
      isFuture: isAfter(dateObj, today),
      isWeekend: isWeekend(dateObj),
      isFriday: dayOfWeek === 5,
      isSaturday: dayOfWeek === 6,
    };
  });

  const getMealCellClass = (count: number, isFuture: boolean, isLocked: boolean, isFriday?: boolean, isSaturday?: boolean) => {
    if (isFuture || isLocked) return 'meal-cell meal-cell-future';
    if (count === 0) {
      if (isFriday) return 'meal-cell meal-cell-friday';
      if (isSaturday) return 'meal-cell meal-cell-saturday';
      return 'meal-cell meal-cell-0';
    }
    let baseClass = 'meal-cell ';
    if (count === 0.5) baseClass += 'meal-cell-half';
    else if (count === 1) baseClass += 'meal-cell-1';
    else if (count === 1.5) baseClass += 'meal-cell-15';
    else baseClass += 'meal-cell-2';

    if (isFriday) baseClass += ' meal-cell-friday-active';
    else if (isSaturday) baseClass += ' meal-cell-saturday-active';

    return baseClass;
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
  const noMealDaysCount = calendarDays.filter(d => !d.isFuture && d.count === 0 && d.guestCount === 0).length;
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
  // Carry-forward balances from preceding closed month (meal balance + expense balance).
  const carry = myBalance?.carryForward ?? { mealBalance: 0, expenseBalance: 0, total: 0 };

  // 1. Previous Month Meal Adjustment
  const prevMealDue = carry.mealBalance < 0 ? Math.abs(carry.mealBalance) : 0;
  const prevMealOverpaid = carry.mealBalance > 0 ? carry.mealBalance : 0;

  // 2. Previous Month Monthly Due Adjustment
  const prevExpenseDue = carry.expenseBalance < 0 ? Math.abs(carry.expenseBalance) : 0;
  const prevExpenseOverpaid = carry.expenseBalance > 0 ? carry.expenseBalance : 0;

  // Monthly Expense = Fixed + Shared + Prev Meal Due + Prev Monthly Due
  const baseExpenses = myBalance ? myBalance.fixedOverheadShare + myBalance.sharedExpenseShare : 0;
  const monthlyExpenseVal = baseExpenses + prevMealDue + prevExpenseDue;

  // Total Paid = non-grocery paid + advance + prev meal overpaid + prev monthly overpaid
  const advanceCredit = myBalance?.advanceCredit ?? 0;
  const currentMonthPaid = myBalance ? (myBalance.totalPaid - totalMyGrocerySpent) : 0;
  const totalPaidVal = currentMonthPaid + advanceCredit + prevMealOverpaid + prevExpenseOverpaid;

  // Due = Monthly Expense - Total Paid
  const dueVal = monthlyExpenseVal - totalPaidVal;
  const isSettled = Math.abs(dueVal) < 0.5;
  const isOverpaid = !isSettled && dueVal < -0.5;
  const calendarProps = {
    month,
    currentMonthLabel,
    calendarDays,
    getMealCellClass,
    getMealCellGuestStyle,
    isLocked,
    setSelectedDay,
    noMealDaysCount,
    totalMyMeals,
    totalMyGuestMeals,
  };

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
            {/* Row 1 */}
            <button id="monthly-expense-tile" onClick={() => setShowMonthlyBreakdown(true)}
              className="text-left w-full block focus:outline-none group">
              <BentoStatCard
                label="Monthly Expense"
                value={monthlyExpenseVal}
                icon={<IconWallet size={15} />}
                isPrimary
                suffix={(prevMealDue > 0 || prevExpenseDue > 0) ? 'Fixed + Shared + Prev. Due' : 'Fixed + Shared'}
                clickable
              />
            </button>
            <BentoStatCard
              label={isSettled ? 'Due' : isOverpaid ? 'Overpaid' : 'Due'}
              value={isSettled ? 0 : Math.abs(dueVal)}
              icon={<IconTrendDown size={15} />}
              accentColor={isSettled ? 'emerald' : isOverpaid ? 'emerald' : 'rose'}
              suffix={isSettled ? 'All settled' : isOverpaid ? 'Flat owes you' : 'You owe flat'}
            />

            {/* Row 2 — Total Paid (clickable for breakdown modal) */}
            <button id="total-paid-tile" onClick={() => setShowTotalPaidBreakdown(true)}
              className="text-left w-full block focus:outline-none group">
              <BentoStatCard
                label="Total Paid"
                value={totalPaidVal}
                icon={<IconTrendUp size={15} />}
                accentColor="violet"
                clickable
              />
            </button>

            {/* Row 2 — Meal Expense Breakdown tile (h-[104px] matching other cards) */}
            {(() => {
              const myMealCost = (totalMyMeals + totalMyGuestMeals) * perMealRate;
              const diff = totalMyGrocerySpent - myMealCost;  // positive = overpaid, negative = still owes
              const isOver = diff >= 0;
              const dueBg    = isOver ? 'rgba(16,185,129,0.12)' : 'rgba(244,63,94,0.1)';
              const dueColor = isOver ? '#6ee7b7' : '#fda4af';
              const subColor = isOver ? '#059669'  : '#e11d48';
              const rightLabel = isOver ? 'Overpaid' : 'Due Amount';
              const rightValue = Math.abs(diff);  // leftover = |paid - owed|
              return (
                <div className="rounded-2xl h-[104px] flex flex-col overflow-hidden transition-all duration-200"
                  style={{ border: '1px solid rgba(6,182,212,0.2)', background: 'rgba(6,182,212,0.04)' }}>
                  {/* Title bar */}
                  <div className="flex items-center gap-1.5 px-3 pt-2 pb-1.5"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
                    <IconMeal size={11} style={{ color: '#67e8f9' }} />
                    <span className="text-[9.5px] font-semibold tracking-wide uppercase" style={{ color: '#64748b' }}>
                      Meal Expenses Breakdown
                    </span>
                  </div>
                  {/* Two halves — fill remaining height */}
                  <div className="flex flex-1 min-h-0">
                    {/* Left — Grocery (Paid) */}
                    <div className="flex-1 flex flex-col justify-between px-3 py-2"
                      style={{ borderRight: '1px solid rgba(255,255,255,0.07)' }}>
                      <span className="text-[10px] font-medium" style={{ color: '#94a3b8' }}>Grocery (Paid)</span>
                      <p className="text-base font-extrabold leading-tight" style={{ color: '#67e8f9' }}>
                        {formatBDT(totalMyGrocerySpent)}
                      </p>
                      <p className="text-[9.5px] font-semibold" style={{ color: '#475569' }}>Total spent</p>
                    </div>
                    {/* Right — Due Amount / Overpaid */}
                    <div className="flex-1 flex flex-col justify-between px-3 py-2"
                      style={{ background: dueBg }}>
                      <span className="text-[10px] font-medium" style={{ color: '#94a3b8' }}>{rightLabel}</span>
                      <p className="text-base font-extrabold leading-tight" style={{ color: dueColor }}>
                        {formatBDT(rightValue)}
                      </p>
                      <p className="text-[9.5px] font-semibold" style={{ color: subColor }}>
                        {isOver ? 'vs meal cost' : 'remaining to pay'}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Meal Stats */}
          <div className="bento-card p-4 flex flex-col justify-between min-h-[120px]">
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
                    <p className="text-xl font-extrabold leading-tight text-[#a78bfa]">{combined}</p>
                    <p className="text-[10px] font-medium text-slate-400 mt-1">My Meals</p>
                  </div>
                );
              })()}
              <div className="text-center p-3 rounded-xl flex flex-col items-center justify-center h-full"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <p className="text-xl font-extrabold leading-tight text-[#f1f5f9]">{totalAllMeals}</p>
                <p className="text-[10px] font-medium text-slate-400 mt-1">Grand Total</p>
              </div>
              <div className="text-center p-3 rounded-xl flex flex-col items-center justify-center h-full"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <p className="text-lg font-extrabold leading-tight text-[#10b981]">{formatBDT(perMealRate)}</p>
                <p className="text-[10px] font-medium text-slate-400 mt-1">Per Meal</p>
              </div>
              <div className="text-center p-3 rounded-xl flex flex-col items-center justify-center h-full"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <p className="text-lg font-extrabold leading-tight text-[#22d3ee]">
                  {formatBDT((totalMyMeals + totalMyGuestMeals) * perMealRate)}
                </p>
                <p className="text-[10px] font-medium text-slate-400 mt-1">My Meal Cost</p>
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

      {/* Monthly Expense Breakdown Modal */}
      <MonthlyBreakdownModal
        open={showMonthlyBreakdown}
        onClose={() => setShowMonthlyBreakdown(false)}
        myOverheads={myOverheads}
        sharedWithAmount={sharedWithAmount}
        activeCount={activeCount}
        carryForward={carry}
        monthlyExpenseVal={monthlyExpenseVal}
      />

      {/* Total Paid Breakdown Modal */}
      <TotalPaidBreakdownModal
        open={showTotalPaidBreakdown}
        onClose={() => setShowTotalPaidBreakdown(false)}
        expenses={expenses}
        profileId={profile?.id ?? ''}
        advanceCreditsForUser={advanceCredit}
        carryForward={carry}
        totalPaidVal={totalPaidVal}
      />
    </div>
  );
}

// ── 5-Row Calendar Grid Builder ───────────────────────────────────────────────
function build5RowCalendarGrid(
  monthLabel: string,
  calendarDays: any[]
) {
  const firstDayOffset = monthLabel ? new Date(`${monthLabel}-01`).getDay() : 0;
  const grid: Array<{ key: string; isEmpty: boolean; day?: any }> = Array.from({ length: 35 }, (_, i) => ({
    key: `empty-${i}`,
    isEmpty: true,
  }));

  calendarDays.forEach((day) => {
    const linearPos = firstDayOffset + (day.dayNumber - 1);
    let targetIndex = linearPos;
    if (linearPos >= 35) {
      targetIndex = linearPos - 35;
    }
    grid[targetIndex] = {
      key: day.date,
      isEmpty: false,
      day,
    };
  });

  return grid;
}

// ── Meal Calendar ─────────────────────────────────────────────────────────────
function MealCalendar({
  month, currentMonthLabel, calendarDays, getMealCellClass, getMealCellGuestStyle, isLocked, setSelectedDay,
  noMealDaysCount, totalMyMeals, totalMyGuestMeals,
}: {
  month: any;
  currentMonthLabel: string;
  calendarDays: any[];
  getMealCellClass: (count: number, isFuture: boolean, isLocked: boolean, isFriday?: boolean, isSaturday?: boolean) => string;
  getMealCellGuestStyle: (count: number, guestCount: number, isFuture: boolean, isLocked: boolean) => React.CSSProperties | undefined;
  isLocked: boolean;
  setSelectedDay: (day: string) => void;
  noMealDaysCount: number;
  totalMyMeals: number;
  totalMyGuestMeals: number;
}) {
  const monthLabel = month ? month.label : currentMonthLabel;
  const gridCells = build5RowCalendarGrid(monthLabel, calendarDays);

  const DAY_HEADER_LABELS = [
    { name: 'S', isFri: false, isSat: false },
    { name: 'M', isFri: false, isSat: false },
    { name: 'T', isFri: false, isSat: false },
    { name: 'W', isFri: false, isSat: false },
    { name: 'T', isFri: false, isSat: false },
    { name: 'F', isFri: true,  isSat: false },
    { name: 'S', isFri: false, isSat: true  },
  ];

  return (
    <div className="bento-card p-4 sm:p-5 h-full flex flex-col justify-between">
      {/* Header & Tagged Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3">
        <div>
          <h2 className="font-bold text-base" style={{ color: '#f1f5f9' }}>Meal Calendar</h2>
          <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>Tap a day to log meals</p>
        </div>

        {/* Tagged Legend */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          {/* No Meals */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }} />
            <span style={{ color: '#94a3b8' }}>No Meals:</span>
            <span className="font-extrabold text-slate-200">{noMealDaysCount}</span>
          </div>

          {/* Regular */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.28)' }}>
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: '#10b981' }} />
            <span style={{ color: '#6ee7b7' }}>Regular:</span>
            <span className="font-extrabold text-emerald-300">{totalMyMeals}</span>
          </div>

          {/* Guest Meals */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.28)' }}>
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: '#f59e0b' }} />
            <span style={{ color: '#fcd34d' }}>Guest Meals:</span>
            <span className="font-extrabold text-amber-300">{totalMyGuestMeals}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-between my-auto">
        {/* Day labels header */}
        <div className="grid grid-cols-7 gap-1.5 mb-2">
          {DAY_HEADER_LABELS.map((d, i) => (
            <div
              key={i}
              className="text-center text-xs font-extrabold uppercase py-1 rounded-md transition-colors"
              style={{
                color: d.isFri ? '#c4b5fd' : d.isSat ? '#94a3b8' : '#64748b',
                background: d.isFri ? 'rgba(124, 58, 237, 0.18)' : d.isSat ? 'rgba(124, 58, 237, 0.07)' : 'transparent',
              }}
            >
              {d.name}
            </div>
          ))}
        </div>

        {/* Calendar cells (35 square tiles in 5 rows) */}
        <div className="grid grid-cols-7 gap-1.5">
          {gridCells.map((cell, idx) => {
            if (cell.isEmpty) {
              return <div key={`empty-${idx}`} className="w-full aspect-square" />;
            }
            const day = cell.day;
            const guestStyle = getMealCellGuestStyle(day.count, day.guestCount, day.isFuture, isLocked);
            const cellClass = getMealCellClass(day.count, day.isFuture, isLocked, day.isFriday, day.isSaturday);
            return (
              <button
                key={day.date}
                id={`meal-cell-${day.date}`}
                onClick={() => !day.isFuture && !isLocked && setSelectedDay(day.date)}
                className={cellClass}
                style={guestStyle}
                title={day.guestCount > 0
                  ? `${day.date}: ${day.count} meal(s) + ${day.guestCount} guest`
                  : `${day.date}: ${day.count} meal(s)`}
                disabled={day.isFuture || isLocked}
              >
                <span className="leading-none text-sm sm:text-base font-extrabold">
                  {day.count > 0 || day.guestCount > 0 ? day.count : day.dayNumber}
                </span>
                {day.guestCount > 0 && (
                  <span
                    className="absolute bottom-0.5 right-0.5 text-[8px] sm:text-[9px] font-extrabold leading-none px-1 py-0.2 rounded"
                    style={{ color: '#fbbf24', background: 'rgba(0,0,0,0.65)' }}
                  >
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
// ── Bento Stat Card ───────────────────────────────────────────────────────────
// ─── Monthly Breakdown Modal ──────────────────────────────────────────────────
function MonthlyBreakdownModal({
  open, onClose,
  myOverheads, sharedWithAmount, activeCount, carryForward, monthlyExpenseVal,
}: {
  open: boolean;
  onClose: () => void;
  myOverheads: any[];
  sharedWithAmount: any[];
  activeCount: number;
  carryForward: CarryForwardBalance;
  monthlyExpenseVal: number;
}) {
  if (!open) return null;
  const totalFixed  = myOverheads.reduce((s: number, c: any) => s + c.amount, 0);
  const totalShared = sharedWithAmount.reduce((s: number, c: any) => s + c.total_amount / activeCount, 0);

  const Row = ({ label, amount, accent, prefix }: { label: string; amount: number; accent?: string; prefix?: string }) => (
    <div className="flex items-center justify-between py-2"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <span className="text-xs font-medium capitalize" style={{ color: '#94a3b8' }}>{label}</span>
      <span className="text-sm font-bold" style={{ color: accent ?? '#f1f5f9' }}>
        {prefix ?? ''}{formatBDT(amount)}
      </span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}>
      <div className="w-full max-w-xs rounded-2xl overflow-hidden"
        style={{ background: '#0d1220', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(16,185,129,0.15)' }}>
              <IconWallet size={14} />
            </div>
            <div>
              <p className="text-xs font-semibold" style={{ color: '#94a3b8' }}>Monthly Expense</p>
              <p className="text-lg font-extrabold" style={{ color: '#10b981' }}>{formatBDT(monthlyExpenseVal)}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white transition-colors"
            style={{ background: 'rgba(255,255,255,0.06)' }}
            aria-label="Close">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-3">

          {/* Fixed Overheads */}
          {myOverheads.length > 0 && (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-1 mt-2" style={{ color: '#475569' }}>Fixed Overheads</p>
              {myOverheads.map((o: any) => (
                <Row key={o.id ?? o.category} label={o.category} amount={o.amount} accent="#a78bfa" />
              ))}
              <div className="flex justify-between py-1.5">
                <span className="text-[10px] font-semibold" style={{ color: '#475569' }}>Subtotal</span>
                <span className="text-xs font-bold" style={{ color: '#a78bfa' }}>{formatBDT(totalFixed)}</span>
              </div>
            </>
          )}

          {/* Shared Expenses */}
          {sharedWithAmount.length > 0 && (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-1 mt-3" style={{ color: '#475569' }}>Shared Expenses <span style={{ color: '#334155' }}>(÷{activeCount})</span></p>
              {sharedWithAmount.map((s: any) => (
                <Row key={s.id ?? s.category} label={s.category} amount={s.total_amount / activeCount} accent="#67e8f9" />
              ))}
              <div className="flex justify-between py-1.5">
                <span className="text-[10px] font-semibold" style={{ color: '#475569' }}>Subtotal</span>
                <span className="text-xs font-bold" style={{ color: '#67e8f9' }}>{formatBDT(totalShared)}</span>
              </div>
            </>
          )}

          {/* Previous Month Carry-Forward */}
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-1 mt-3" style={{ color: '#475569' }}>
            Prev. Month Carry-Forward
          </p>
          <Row 
            label={carryForward.mealBalance > 0 ? "Prev. Month Meal Overdue" : "Prev. Month Meal Due"} 
            amount={Math.abs(carryForward.mealBalance)} 
            accent={carryForward.mealBalance < 0 ? "#fda4af" : carryForward.mealBalance > 0 ? "#6ee7b7" : "#94a3b8"} 
            prefix={carryForward.mealBalance < 0 ? "+" : carryForward.mealBalance > 0 ? "-" : ""} 
          />
          <Row 
            label={carryForward.expenseBalance > 0 ? "Prev. Monthly Overdue" : "Prev. Monthly Due"} 
            amount={Math.abs(carryForward.expenseBalance)} 
            accent={carryForward.expenseBalance < 0 ? "#fda4af" : carryForward.expenseBalance > 0 ? "#6ee7b7" : "#94a3b8"} 
            prefix={carryForward.expenseBalance < 0 ? "+" : carryForward.expenseBalance > 0 ? "-" : ""} 
          />



          {/* Grocery deferred note */}
          <div className="flex items-start gap-2 mt-3 px-3 py-2.5 rounded-xl"
            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
            <span style={{ color: '#fbbf24', fontSize: 13, lineHeight: 1 }}>⏭</span>
            <p className="text-[10px] leading-relaxed" style={{ color: '#fcd34d' }}>
              Current month&apos;s meal &amp; grocery costs are deferred and will be adjusted in next month&apos;s billing.
            </p>
          </div>

          {/* Grand Total */}
          <div className="flex items-center justify-between mt-4 mb-2 pt-3"
            style={{ borderTop: '2px solid rgba(16,185,129,0.3)' }}>
            <span className="text-sm font-bold" style={{ color: '#f1f5f9' }}>Total</span>
            <span className="text-base font-extrabold" style={{ color: '#10b981' }}>{formatBDT(monthlyExpenseVal)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Total Paid Breakdown Modal ───────────────────────────────────────────────
function TotalPaidBreakdownModal({
  open,
  onClose,
  expenses,
  profileId,
  advanceCreditsForUser,
  carryForward,
  totalPaidVal,
}: {
  open: boolean;
  onClose: () => void;
  expenses: Expense[];
  profileId: string;
  advanceCreditsForUser: number;
  carryForward: CarryForwardBalance;
  totalPaidVal: number;
}) {
  if (!open) return null;

  // Direct non-grocery payments made by the user this month
  const myDirectExpenses = expenses.filter(e => {
    if (e.category === 'grocery' || e.is_advance) return false;
    const paidDetails = e.paid_by_details as Record<string, number> | null;
    if (paidDetails && (paidDetails[profileId] ?? 0) > 0) return true;
    return e.paid_by === profileId;
  });

  const Row = ({ label, amount, accent, sub }: { label: string; amount: number; accent?: string; sub?: string }) => (
    <div className="flex items-center justify-between py-2"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="flex flex-col">
        <span className="text-xs font-medium capitalize" style={{ color: '#f1f5f9' }}>{label}</span>
        {sub && <span className="text-[10px]" style={{ color: '#64748b' }}>{sub}</span>}
      </div>
      <span className="text-sm font-bold" style={{ color: accent ?? '#c084fc' }}>{formatBDT(amount)}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}>
      <div className="w-full max-w-xs rounded-2xl overflow-hidden"
        style={{ background: '#0d1220', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(168,85,247,0.15)' }}>
              <IconTrendUp size={14} />
            </div>
            <div>
              <p className="text-xs font-semibold" style={{ color: '#94a3b8' }}>Total Paid Breakdown</p>
              <p className="text-lg font-extrabold" style={{ color: '#a855f7' }}>{formatBDT(totalPaidVal)}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white transition-colors"
            style={{ background: 'rgba(255,255,255,0.06)' }}
            aria-label="Close">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-3 space-y-3">
          {/* Direct payments this month */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: '#475569' }}>
              Direct Payments (This Month)
            </p>
            {myDirectExpenses.length === 0 ? (
              <p className="text-xs py-1" style={{ color: '#64748b' }}>No direct payments logged</p>
            ) : (
              myDirectExpenses.map(e => {
                const paidDetails = e.paid_by_details as Record<string, number> | null;
                const amt = paidDetails && paidDetails[profileId] ? paidDetails[profileId] : e.amount;
                return (
                  <Row key={e.id} label={CATEGORY_LABELS[e.category as keyof typeof CATEGORY_LABELS] ?? e.category} amount={amt} sub={e.description || undefined} />
                );
              })
            )}
          </div>

          {/* Advance payments credit */}
          {advanceCreditsForUser > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: '#475569' }}>
                Advance Payment Credit
              </p>
              <Row label="Paid in advance for this month" amount={advanceCreditsForUser} accent="#fbbf24" />
            </div>
          )}

          {/* Previous month overpaid credits */}
          {(carryForward.mealBalance > 0 || carryForward.expenseBalance > 0) && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: '#475569' }}>
                Previous Month Overpayments
              </p>
              {carryForward.mealBalance > 0 && (
                <Row label="Prev. Month Meal Overpaid" amount={carryForward.mealBalance} accent="#34d399" sub="Credited from previous month" />
              )}
              {carryForward.expenseBalance > 0 && (
                <Row label="Prev. Month Monthly Overpaid" amount={carryForward.expenseBalance} accent="#34d399" sub="Credited from previous month" />
              )}
            </div>
          )}

          {/* Grand Total */}
          <div className="flex items-center justify-between mt-4 mb-2 pt-3"
            style={{ borderTop: '2px solid rgba(168,85,247,0.3)' }}>
            <span className="text-sm font-bold" style={{ color: '#f1f5f9' }}>Total Paid</span>
            <span className="text-base font-extrabold" style={{ color: '#a855f7' }}>{formatBDT(totalPaidVal)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function BentoStatCard({ label, value, icon, isPrimary, accentColor, suffix, clickable }: {
  label: string;
  clickable?: boolean;
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
        cursor: clickable ? 'pointer' : 'default',
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
