'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { format, getDaysInMonth, startOfMonth, isAfter, isWeekend, parseISO } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { calculateBalances, formatBDT, getOrCreateCurrentMonth, getMonthLabel, getAllMonths } from '@/lib/finance';
import { Expense, FixedOverheadConfig, Meal, Month, Profile, SharedExpenseConfig, UserBalance, CATEGORY_SHORT_LABELS } from '@/lib/types';
import { toast } from 'sonner';
import Link from 'next/link';
import MealInputModal from '@/components/MealInputModal';
import ExpenseForm from '@/components/ExpenseForm';
import ActivityFeed from '@/components/ActivityFeed';
import { CategoryIcon } from '@/components/GeometricIcons';
import { Trash2, Edit3, Loader2, ChevronDown, Plus as LucidePlus, Calculator as CalculatorIcon } from 'lucide-react';
import { CATEGORY_LABELS } from '@/lib/types';
import Calculator from '@/components/Calculator';
import { useSelectedMonth } from '@/contexts/MonthContext';
import {
  IconPin, IconBolt, IconWallet, IconTrendDown, IconTrendUp, IconMeal,
  IconChevronRight, IconPlus, IconLock, IconActivity,
} from '@/components/GeometricIcons';

export default function DashboardPage() {
  const { profile } = useAuth();
  const { selectedMonthId, setSelectedMonthId, months, currentMonthLabel } = useSelectedMonth();
  const [month, setMonth] = useState<Month | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [myMeals, setMyMeals] = useState<Record<string, number>>({});
  const [myGuestMeals, setMyGuestMeals] = useState<Record<string, number>>({});
  const [balances, setBalances] = useState<UserBalance[]>([]);
  const [myBalance, setMyBalance] = useState<UserBalance | null>(null);
  const [fixedOverheads, setFixedOverheads] = useState<FixedOverheadConfig[]>([]);
  const [sharedExpenses, setSharedExpenses] = useState<SharedExpenseConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
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
        if ((m as { guest_count?: number }).guest_count) {
          myGuestMealMap[m.date] = (m as { guest_count?: number }).guest_count ?? 0;
        }
      });
      setMyMeals(myMealMap);
      setMyGuestMeals(myGuestMealMap);
      const openingBalances = (currentMonth.opening_balances as Record<string, number>) ?? {};
      const computed = calculateBalances(allExpenses, allMeals, allProfiles, openingBalances, allOverheads, allShared);
      setBalances(computed);
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

  // Returns an inline style override for cells with guest meals (split gradient)
  const getMealCellGuestStyle = (count: number, guestCount: number, isFuture: boolean, isLocked: boolean): React.CSSProperties | undefined => {
    if (isFuture || isLocked || guestCount === 0) return undefined;
    const total = count + guestCount;
    const regularPct = Math.round((count / total) * 100);
    // Split diagonal gradient: emerald (regular) + amber (guest)
    const emeraldAlpha = count === 0 ? 0 : count <= 0.5 ? 0.2 : count <= 1 ? 0.35 : count <= 1.5 ? 0.55 : 1;
    const emeraldColor = count === 0
      ? 'transparent'
      : `rgba(16,185,129,${emeraldAlpha})`;
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

  const totalMyGrocerySpent = expenses
    .filter(e => e.category === 'grocery')
    .reduce((sum, e) => {
      const paidDetails = e.paid_by_details as Record<string, number> | null;
      if (paidDetails && Object.keys(paidDetails).length > 0) {
        return sum + (paidDetails[profile?.id || ''] ?? 0);
      }
      return sum + (e.paid_by === profile?.id ? e.amount : 0);
    }, 0);



  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-3 animate-pulse">
        <div className="skeleton h-8 w-56 mb-6 rounded-xl" />
        <div className="skeleton h-24 rounded-2xl" />
        <div className="skeleton h-24 rounded-2xl" />
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}
        </div>
        <div className="skeleton h-64 rounded-2xl mt-4" />
      </div>
    );
  }

  const isLocked = month?.is_closed ?? false;

  return (
    <div className="p-4 md:p-6 pb-28 md:pb-8 animate-fade-in max-w-2xl mx-auto">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <p className="text-xs font-medium mb-1" style={{ color: '#475569' }}>
            {month?.label === currentMonthLabel
              ? format(today, 'EEEE, MMMM d, yyyy')
              : month ? getMonthLabel(month.label) : ''}
          </p>
          <h1 className="text-2xl font-bold" style={{ color: '#f1f5f9' }}>
            Hey, <span style={{ color: '#a78bfa' }}>{profile?.username}</span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {months.length > 1 && (
            <div className="relative">
              <select
                value={selectedMonthId}
                onChange={e => setSelectedMonthId(e.target.value)}
                className="bg-[#0a0f1a] text-slate-200 text-xs font-semibold px-3 py-1.5 rounded-xl border border-white/10 appearance-none pr-8 cursor-pointer hover:border-violet-500/50 transition-colors"
              >
                {months.map(m => (
                  <option key={m.id} value={m.id}>
                    {getMonthLabel(m.label)}
                  </option>
                ))}
              </select>
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
          )}
          {isLocked && (
            <div className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
              style={{ background: 'rgba(244,63,94,0.12)', color: '#f43f5e', border: '1px solid rgba(244,63,94,0.25)' }}>
              <IconLock size={11} />
              Month Closed
            </div>
          )}
        </div>
      </div>

      {/* ── Fixed Charges — Violet Bento ──────────────────────── */}
      {(() => {
        const ORDER = ['rent'];
        const myOverheads = fixedOverheads
          .filter(c => c.user_id === profile?.id)
          .sort((a, b) => {
            const ai = ORDER.indexOf(a.category); const bi = ORDER.indexOf(b.category);
            return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
          });
        if (myOverheads.length === 0) return null;
        const totalFixed = myOverheads.reduce((s, c) => s + c.amount, 0);
        return (
          <div className="relative mb-3 rounded-2xl overflow-hidden bento-accent-violet">
            {/* Decorative corner accent */}
            <div className="absolute top-0 right-0 w-24 h-24 pointer-events-none opacity-30"
              style={{ background: 'radial-gradient(circle at top right, rgba(167,139,250,0.4) 0%, transparent 70%)' }} />
            <div className="absolute bottom-0 left-0 w-16 h-16 pointer-events-none opacity-20"
              style={{ background: 'radial-gradient(circle at bottom left, rgba(124,58,237,0.5) 0%, transparent 70%)' }} />

            {/* Grid lines overlay */}
            <div className="absolute inset-0 pointer-events-none opacity-10"
              style={{
                backgroundImage: 'linear-gradient(rgba(167,139,250,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(167,139,250,0.5) 1px, transparent 1px)',
                backgroundSize: '20px 20px',
              }} />

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
                    <div className="flex items-center justify-center" style={{ color: '#c4b5fd', width: 14, height: 14 }}>
                      <CategoryIcon category={c.category} size={13} />
                    </div>
                    <span className="text-xs font-medium capitalize" style={{ color: 'rgba(255,255,255,0.7)' }}>{CATEGORY_SHORT_LABELS[c.category as keyof typeof CATEGORY_SHORT_LABELS] ?? c.category}</span>
                    <span className="text-xs font-bold" style={{ color: '#f1f5f9' }}>{formatBDT(c.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Shared Expenses — Cyan Bento ──────────────────────── */}
      {(() => {
        const activeCount = profiles.length || 1;
        const sharedWithAmount = sharedExpenses.filter(s => s.total_amount > 0);
        if (sharedWithAmount.length === 0) return null;
        const totalShared = sharedWithAmount.reduce((s, c) => s + c.total_amount / activeCount, 0);
        const ORDER_S = ['electricity', 'gas', 'internet', 'maid', 'misc'];
        const sorted = [...sharedWithAmount].sort((a, b) => ORDER_S.indexOf(a.category) - ORDER_S.indexOf(b.category));
        return (
          <div className="relative mb-3 rounded-2xl overflow-hidden bento-accent-cyan">
            <div className="absolute top-0 right-0 w-24 h-24 pointer-events-none opacity-30"
              style={{ background: 'radial-gradient(circle at top right, rgba(103,232,249,0.4) 0%, transparent 70%)' }} />
            <div className="absolute inset-0 pointer-events-none opacity-10"
              style={{
                backgroundImage: 'linear-gradient(rgba(6,182,212,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.5) 1px, transparent 1px)',
                backgroundSize: '20px 20px',
              }} />
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
                {sorted.map(s => (
                  <div key={s.id} className="flex items-center gap-2 rounded-xl px-3 py-1.5"
                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div className="flex items-center justify-center" style={{ color: '#67e8f9', width: 14, height: 14 }}>
                      <CategoryIcon category={s.category} size={13} />
                    </div>
                    <span className="text-xs font-medium capitalize" style={{ color: 'rgba(255,255,255,0.7)' }}>{CATEGORY_SHORT_LABELS[s.category as keyof typeof CATEGORY_SHORT_LABELS] ?? s.category}</span>
                    <span className="text-xs font-bold" style={{ color: '#f1f5f9' }}>{formatBDT(s.total_amount / activeCount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Balance Bento Grid 2×2 ────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <BentoStatCard
          label={`Monthly Expense, ${month ? getMonthLabel(month.label) : ''}`}
          value={myBalance ? (myBalance.fixedOverheadShare + myBalance.sharedExpenseShare + totalMyGrocerySpent) : 0}
          icon={<IconWallet size={15} />}
          isPrimary
          suffix="Fixed + Shared + Grocery (Spent)"
        />
        {(() => {
          const monthlyExpenseVal = myBalance ? (myBalance.fixedOverheadShare + myBalance.sharedExpenseShare + totalMyGrocerySpent) : 0;
          const totalPaidVal = myBalance?.totalPaid ?? 0;
          const dueVal = monthlyExpenseVal - totalPaidVal;
          const isOverpaid = dueVal < 0;
          return (
            <BentoStatCard
              label={isOverpaid ? "Overdue" : "Due"}
              value={Math.abs(dueVal)}
              icon={<IconTrendDown size={15} />}
              accentColor={isOverpaid ? "emerald" : "rose"}
              suffix={myBalance ? (isOverpaid ? "Flat owes you" : "You owe flat") : undefined}
            />
          );
        })()}
        <BentoStatCard
          label="Total Paid"
          value={myBalance?.totalPaid ?? 0}
          icon={<IconTrendUp size={15} />}
          accentColor="violet"
        />
        <BentoStatCard
          label="Grocery/Bazar (Spent)"
          value={totalMyGrocerySpent}
          icon={<IconMeal size={15} />}
          accentColor="cyan"
        />
      </div>

      {/* ── Meal Stats ───────────────────────────────────────────── */}
      <div className="bento-card p-4 mb-3">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center icon-container-emerald">
              <IconMeal size={13} />
            </div>
            <h2 className="font-semibold text-sm" style={{ color: '#f1f5f9' }}>Meal Stats</h2>
          </div>
          <span className="text-xs font-medium" style={{ color: '#475569' }}>{format(today, 'MMM yyyy')}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {/* Combined My Meals */}
          {(() => {
            const combined = totalMyMeals + totalMyGuestMeals;
            const myPct = combined > 0 ? (totalMyMeals / combined) * 100 : 100;
            const bgGradient = combined > 0 
              ? `linear-gradient(135deg, rgba(167, 139, 250, 0.08) ${myPct}%, rgba(245, 158, 11, 0.08) ${myPct}%)`
              : 'rgba(255,255,255,0.03)';
            return (
              <div className="text-center py-2.5 px-3 rounded-xl flex flex-col justify-between"
                style={{ background: bgGradient, border: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="flex justify-center items-baseline gap-1">
                  <span className="text-xl font-extrabold text-[#a78bfa]">{totalMyMeals}</span>
                  <span className="text-xs text-slate-500 font-semibold">+</span>
                  <span className="text-lg font-bold text-[#f59e0b]">{totalMyGuestMeals}g</span>
                </div>
                <div className="my-2 h-1.5" />
                <p className="text-[10px] font-medium text-[#475569]">My Meals</p>
              </div>
            );
          })()}

          {/* Total Meals */}
          <div className="text-center py-2.5 px-1 rounded-xl flex flex-col justify-between"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <p className="text-xl font-extrabold leading-tight text-[#f1f5f9]">{totalAllMeals}</p>
            <div className="my-2 h-1.5" />
            <p className="text-[10px] font-medium text-[#475569]">Total Meals</p>
          </div>

          {/* Meal Cost */}
          <div className="text-center py-2.5 px-1 rounded-xl flex flex-col justify-between"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <p className="text-xl font-extrabold leading-tight text-[#22d3ee]">
              {formatBDT((totalMyMeals + totalMyGuestMeals) * perMealRate)}
            </p>
            <div className="my-2 h-1.5" />
            <p className="text-[10px] font-medium text-[#475569]">Meal Cost</p>
          </div>

          {/* Per Meal */}
          <div className="text-center py-2.5 px-1 rounded-xl flex flex-col justify-between"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <p className="text-xl font-extrabold leading-tight text-[#10b981]">{formatBDT(perMealRate)}</p>
            <div className="my-2 h-1.5" />
            <p className="text-[10px] font-medium text-[#475569]">Per Meal</p>
          </div>
        </div>
      </div>

      {/* ── Meal Calendar ────────────────────────────────────────── */}
      <div className="bento-card p-4 mb-3">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-sm" style={{ color: '#f1f5f9' }}>Meal Calendar</h2>
            <p className="text-[10px] mt-0.5" style={{ color: '#475569' }}>Tap a day to log meals</p>
          </div>
          {/* Legend */}
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

        {/* Day labels */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <div key={i} className="text-center text-[9px] font-semibold uppercase" style={{ color: '#334155' }}>{d}</div>
          ))}
        </div>

        {/* Calendar cells */}
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: startOfMonth(parseISO(`${month ? month.label : currentMonthLabel}-01`)).getDay() }).map((_, i) => (
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
                  <span
                    className="absolute bottom-0.5 right-0.5 text-[7px] font-bold leading-none"
                    style={{ color: '#fbbf24' }}
                  >
                    +{day.guestCount}g
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── All Balances ─────────────────────────────────────────── */}
      <div className="bento-card p-4 mb-3">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center icon-container-violet">
              <IconActivity size={13} />
            </div>
            <h2 className="font-semibold text-sm" style={{ color: '#f1f5f9' }}>All Balances</h2>
          </div>
          <Link href="/dashboard/reports"
            className="flex items-center gap-1 text-xs font-semibold transition-colors"
            style={{ color: '#7c3aed' }}>
            Details <IconChevronRight size={12} />
          </Link>
        </div>
        <div className="space-y-2.5">
          {balances.map(b => (
            <div key={b.userId} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ backgroundColor: b.avatarColor, boxShadow: `0 0 10px ${b.avatarColor}50` }}>
                {b.username.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium" style={{ color: '#94a3b8' }}>{b.username}</span>
                  <span className="text-sm font-bold" style={{ color: b.balance >= 0 ? '#10b981' : '#f43f5e' }}>
                    {b.balance >= 0 ? '+' : ''}{formatBDT(b.balance)}
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (Math.abs(b.balance) / Math.max(...balances.map(bb => Math.abs(bb.balance)), 1)) * 100)}%`,
                      background: b.balance >= 0
                        ? 'linear-gradient(90deg, #10b981, #059669)'
                        : 'linear-gradient(90deg, #f43f5e, #be123c)',
                      boxShadow: b.balance >= 0 ? '0 0 6px rgba(16,185,129,0.5)' : '0 0 6px rgba(244,63,94,0.5)',
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Activity Feed ────────────────────────────────────────── */}
      <ActivityFeed monthId={month?.id ?? ''} profiles={profiles} />

      {/* ── FABs ──────────────────────────────────────────────────── */}
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3">
        {!isLocked && (
          <Link
            href="/dashboard/expenses"
            className="w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95 text-white hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
              boxShadow: '0 4px 20px rgba(124,58,237,0.6), 0 0 40px rgba(124,58,237,0.2)',
            }}
            id="add-expense-fab"
            aria-label="Add Expense"
          >
            <IconPlus size={22} />
          </Link>
        )}
        <button
          id="calculator-fab"
          onClick={() => setShowCalculator(true)}
          className="w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95 text-white hover:scale-105"
          style={{
            background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
            boxShadow: '0 4px 20px rgba(14,165,233,0.6), 0 0 40px rgba(14,165,233,0.2)',
          }}
          aria-label="Calculator"
        >
          <CalculatorIcon className="w-6 h-6" />
        </button>
      </div>

      {showCalculator && (
        <Calculator onClose={() => setShowCalculator(false)} />
      )}

      {/* ── Meal Modal ───────────────────────────────────────────── */}
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


    </div>
  );
}

// ── Bento Stat Card ─────────────────────────────────────────────────────────
function BentoStatCard({
  label, value, icon, isPrimary, accentColor, suffix,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  isPrimary?: boolean;
  accentColor?: 'violet' | 'cyan' | 'rose' | 'emerald';
  suffix?: string;
}) {
  const isPositive = value >= 0;

  const accentMap: Record<string, { icon: string; bg: string; border: string; value: string }> = {
    violet: { icon: '#a78bfa', bg: 'rgba(124,58,237,0.1)', border: 'rgba(124,58,237,0.2)', value: '#a78bfa' },
    cyan: { icon: '#67e8f9', bg: 'rgba(6,182,212,0.1)', border: 'rgba(6,182,212,0.2)', value: '#67e8f9' },
    rose: { icon: '#fda4af', bg: 'rgba(244,63,94,0.1)', border: 'rgba(244,63,94,0.2)', value: '#fda4af' },
    emerald: { icon: '#6ee7b7', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)', value: '#6ee7b7' },
  };

  const accent = accentColor ? accentMap[accentColor] : null;
  const primaryColor = isPositive ? '#10b981' : '#f43f5e';
  const primaryBg = isPositive ? 'rgba(16,185,129,0.08)' : 'rgba(244,63,94,0.08)';
  const primaryBorder = isPositive ? 'rgba(16,185,129,0.2)' : 'rgba(244,63,94,0.2)';

  return (
    <div className="rounded-2xl p-4 transition-all duration-200"
      style={{
        background: isPrimary ? primaryBg : (accent?.bg ?? 'rgba(255,255,255,0.03)'),
        border: `1px solid ${isPrimary ? primaryBorder : (accent?.border ?? 'rgba(255,255,255,0.07)')}`,
      }}>
      <div className="flex items-center gap-1.5 mb-2.5"
        style={{ color: isPrimary ? primaryColor : (accent?.icon ?? '#64748b') }}>
        {icon}
        <span className="text-[11px] font-medium" style={{ color: '#475569' }}>{label}</span>
      </div>
      <p className="text-xl font-extrabold leading-tight"
        style={{ color: isPrimary ? primaryColor : (accent?.value ?? '#f1f5f9') }}>
        {formatBDT(Math.abs(value))}
      </p>
      {suffix && (
        <p className="text-[10px] font-semibold mt-1" style={{ color: isPrimary ? primaryColor : '#475569' }}>
          {suffix}
        </p>
      )}
    </div>
  );
}
