'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Profile, Expense, Meal, Month, FixedOverheadConfig, SharedExpenseConfig } from '@/lib/types';
import { calculateBalances, computeWhoOwesWhom, formatBDT, getOrCreateCurrentMonth, getMonthLabel } from '@/lib/finance';
import { format } from 'date-fns';
import Link from 'next/link';
import {
  IconUsers, IconTrendDown, IconMeal, IconClock,
  IconDashboard, IconCalendar, IconChevronRight, IconWallet,
} from '@/components/GeometricIcons';
import { useSelectedMonth } from '@/contexts/MonthContext';

export default function AdminOverviewPage() {
  const { selectedMonthId, setSelectedMonthId, months, loadingMonths } = useSelectedMonth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [month, setMonth] = useState<Month | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [fixedOverheads, setFixedOverheads] = useState<FixedOverheadConfig[]>([]);
  const [sharedExpenses, setSharedExpenses] = useState<SharedExpenseConfig[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  const fetchAll = useCallback(async () => {
    if (loadingMonths) return;
    if (!selectedMonthId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const currentMonth = months.find(m => m.id === selectedMonthId) || await getOrCreateCurrentMonth();
      setMonth(currentMonth);
      const [profRes, expRes, mealRes, overheadRes, sharedRes] = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase.from('expenses').select('*').eq('month_id', currentMonth.id),
        supabase.from('meals').select('*').eq('month_id', currentMonth.id),
        supabase.from('fixed_overhead_configs').select('*').eq('month_id', currentMonth.id),
        supabase.from('shared_expense_configs').select('*').eq('month_id', currentMonth.id),
      ]);
      
      if (profRes.error) throw profRes.error;
      if (expRes.error) throw expRes.error;
      if (mealRes.error) throw mealRes.error;
      if (overheadRes.error) throw overheadRes.error;
      if (sharedRes.error) throw sharedRes.error;

      const allProfiles = profRes.data ?? [];
      setProfiles(allProfiles.filter((p: Profile) => p.status === 'active'));
      setPendingCount(allProfiles.filter((p: Profile) => p.status === 'pending').length);
      setExpenses(expRes.data ?? []);
      setMeals(mealRes.data ?? []);
      setFixedOverheads((overheadRes.data ?? []) as FixedOverheadConfig[]);
      setSharedExpenses((sharedRes.data ?? []) as SharedExpenseConfig[]);
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedMonthId, months, loadingMonths]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const openingBalances = (month?.opening_balances as Record<string, number>) ?? {};
  const balances = calculateBalances(expenses, meals, profiles, openingBalances, fixedOverheads, sharedExpenses);
  const whoOwes = computeWhoOwesWhom(balances, profiles);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const totalMeals = meals.reduce((s, m) => s + m.count + ((m as any).guest_count || 0), 0);
  const totalGrocery = expenses.filter(e => e.category === 'grocery').reduce((s, e) => s + e.amount, 0);
  const perMealRate = totalMeals > 0 ? totalGrocery / totalMeals : 0;

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-3 animate-pulse">
        <div className="skeleton h-8 w-56 mb-6 rounded-xl" />
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 pb-28 md:pb-8 animate-fade-in max-w-2xl mx-auto">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <p className="text-xs font-medium mb-1" style={{ color: '#475569' }}>
            {month ? getMonthLabel(month.label) : ''}
          </p>
          <h1 className="text-2xl font-bold" style={{ color: '#f1f5f9' }}>
            Admin <span style={{ color: '#67e8f9' }}>Overview</span>
          </h1>
        </div>
        {months.length > 1 && (
          <div className="relative">
            <select
              value={selectedMonthId}
              onChange={e => setSelectedMonthId(e.target.value)}
              className="bg-[#0a0f1a] text-slate-200 text-xs font-semibold px-3 py-1.5 rounded-xl border border-white/10 appearance-none pr-8 cursor-pointer hover:border-cyan-500/50 transition-colors focus:outline-none"
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
      </div>

      {/* ── Pending alert ────────────────────────────────────────── */}
      {pendingCount > 0 && (
        <Link href="/admin/approvals" className="block mb-4">
          <div className="flex items-center gap-3 rounded-2xl px-4 py-3 transition-all duration-200"
            style={{
              background: 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.25)',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(245,158,11,0.5)'}
            onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(245,158,11,0.25)'}
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b' }}>
              <IconClock size={16} />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm" style={{ color: '#f59e0b' }}>
                {pendingCount} user{pendingCount > 1 ? 's' : ''} awaiting approval
              </p>
              <p className="text-xs" style={{ color: '#92400e' }}>Tap to review</p>
            </div>
            <IconChevronRight size={14} style={{ color: '#f59e0b' }} />
          </div>
        </Link>
      )}

      {/* ── Stats bento grid ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        {/* Active users */}
        <div className="bento-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center icon-container-cyan">
              <IconUsers size={13} />
            </div>
            <span className="text-xs font-medium" style={{ color: '#475569' }}>Active Users</span>
          </div>
          <p className="text-3xl font-extrabold" style={{ color: '#67e8f9' }}>{profiles.length}</p>
          <p className="text-xs mt-1" style={{ color: '#334155' }}>of 4 slots</p>
        </div>

        {/* Total expenses */}
        <div className="bento-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center icon-container-rose">
              <IconTrendDown size={13} />
            </div>
            <span className="text-xs font-medium" style={{ color: '#475569' }}>Total Spend</span>
          </div>
          <p className="text-xl font-extrabold leading-tight" style={{ color: '#fda4af' }}>{formatBDT(totalExpenses)}</p>
          <p className="text-xs mt-1" style={{ color: '#334155' }}>{expenses.length} entries</p>
        </div>

        {/* Meal overview — full width */}
        <div className="bento-card p-4 col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center icon-container-emerald">
              <IconMeal size={13} />
            </div>
            <span className="text-sm font-semibold" style={{ color: '#f1f5f9' }}>Meal Overview</span>
            <span className="ml-auto text-xs font-bold" style={{ color: '#6ee7b7' }}>
              {totalMeals} total
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {profiles.map(p => {
              const userMeals = meals.filter(m => m.user_id === p.id).reduce((s, m) => s + m.count + ((m as any).guest_count || 0), 0);
              const pct = totalMeals > 0 ? (userMeals / totalMeals) * 100 : 0;
              return (
                <div key={p.id} className="text-center">
                  <div className="w-10 h-10 rounded-full mx-auto flex items-center justify-center text-white text-xs font-bold mb-2"
                    style={{ backgroundColor: p.avatar_color, boxShadow: `0 0 12px ${p.avatar_color}60` }}>
                    {p.username.charAt(0).toUpperCase()}
                  </div>
                  <p className="font-bold text-sm" style={{ color: '#f1f5f9' }}>{userMeals}</p>
                  <p className="text-[10px] mb-1.5" style={{ color: '#475569' }}>{p.username}</p>
                  {/* Mini bar */}
                  <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        background: `linear-gradient(90deg, ${p.avatar_color}, ${p.avatar_color}99)`,
                        boxShadow: `0 0 4px ${p.avatar_color}80`,
                      }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Meal Expenditure Summary ── */}
        <div className="bento-card p-4 col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center icon-container-cyan">
              <IconWallet size={13} />
            </div>
            <span className="text-sm font-semibold" style={{ color: '#f1f5f9' }}>Meal Expenditure Summary</span>
            <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(16,185,129,0.12)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.2)' }}>
              ৳{perMealRate.toFixed(1)}/meal
            </span>
          </div>

          {/* Header row */}
          <div className="grid grid-cols-4 text-[9px] font-bold uppercase tracking-wider px-1 mb-2"
            style={{ color: '#475569' }}>
            <span>User</span>
            <span className="text-center">Meals</span>
            <span className="text-center">Grocery Paid</span>
            <span className="text-right">Due / Overpaid</span>
          </div>

          <div className="space-y-1.5">
            {profiles.map(p => {
              const userMeals = meals.filter(m => m.user_id === p.id)
                .reduce((s, m) => s + m.count + ((m as any).guest_count || 0), 0);
              const mealCost = userMeals * perMealRate;
              const groceryPaid = expenses
                .filter(e => e.category === 'grocery')
                .reduce((sum, e) => {
                  const det = e.paid_by_details as Record<string, number> | null;
                  if (det && Object.keys(det).length > 0) return sum + (det[p.id] ?? 0);
                  return sum + (e.paid_by === p.id ? e.amount : 0);
                }, 0);
              const diff = groceryPaid - mealCost;
              const isOver = diff >= 0;
              return (
                <div key={p.id} className="grid grid-cols-4 items-center px-2 py-1.5 rounded-xl transition-colors"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  {/* User */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-extrabold flex-shrink-0"
                      style={{ backgroundColor: p.avatar_color }}>
                      {p.username.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs font-semibold truncate" style={{ color: '#94a3b8' }}>{p.username}</span>
                  </div>
                  {/* Meals */}
                  <div className="text-center">
                    <span className="text-xs font-bold" style={{ color: '#f1f5f9' }}>{userMeals}</span>
                    <span className="text-[9px] ml-1" style={{ color: '#475569' }}>({formatBDT(mealCost)})</span>
                  </div>
                  {/* Grocery Paid */}
                  <div className="text-center">
                    <span className="text-xs font-bold" style={{ color: '#67e8f9' }}>{formatBDT(groceryPaid)}</span>
                  </div>
                  {/* Due / Overpaid */}
                  <div className="text-right">
                    <span className="text-xs font-bold" style={{ color: isOver ? '#6ee7b7' : '#fda4af' }}>
                      {isOver ? '+' : '-'}{formatBDT(Math.abs(diff))}
                    </span>
                    <p className="text-[8px] font-semibold" style={{ color: isOver ? '#059669' : '#e11d48' }}>
                      {isOver ? 'overpaid' : 'due'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Totals footer */}
          <div className="mt-3 pt-3 flex items-center justify-between"
            style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#475569' }}>Total Grocery</span>
            <span className="text-sm font-extrabold" style={{ color: '#fbbf24' }}>{formatBDT(totalGrocery)}</span>
          </div>
        </div>
      </div>

      {/* ── Balance Flow (Collections Overview) ──────────────────── */}
      <div className="bento-card p-4 mb-3 animate-slide-up">
        <div className="flex items-center justify-between mb-4 border-b border-slate-800/40 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center icon-container-cyan">
              <IconWallet size={13} />
            </div>
            <h2 className="font-semibold text-sm" style={{ color: '#f1f5f9' }}>Balance Flow (Collections Status)</h2>
          </div>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs font-semibold text-[#67e8f9] hover:underline flex items-center gap-0.5"
          >
            {showDetails ? 'Hide Details' : 'View Details'}
          </button>
        </div>

        {/* Progress Bar / Summary Stats */}
        {(() => {
          const totalCollected = balances.reduce((sum, b) => sum + b.totalPaid, 0);
          const totalOutstanding = balances.filter(b => b.balance < 0).reduce((sum, b) => sum + Math.abs(b.balance), 0);
          const totalTarget = totalCollected + totalOutstanding;
          const collectedPct = totalTarget > 0 ? (totalCollected / totalTarget) * 100 : 0;

          return (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-0.5">Collected Funds</p>
                  <p className="text-lg font-bold text-emerald-400">{formatBDT(totalCollected)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-0.5">Outstanding Dues</p>
                  <p className="text-lg font-bold text-rose-400">{formatBDT(totalOutstanding)}</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="space-y-1">
                <div className="w-full h-2 rounded-full overflow-hidden flex" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-l-full transition-all duration-500" 
                    style={{ width: `${collectedPct}%` }}
                  />
                  <div 
                    className="h-full bg-gradient-to-r from-rose-500 to-pink-500 rounded-r-full transition-all duration-500" 
                    style={{ width: `${100 - collectedPct}%` }}
                  />
                </div>
                <div className="flex justify-between text-[9px] font-semibold text-slate-500">
                  <span>{collectedPct.toFixed(0)}% Collected</span>
                  <span>{(100 - collectedPct).toFixed(0)}% Outstanding</span>
                </div>
              </div>

              {/* Details grid */}
              {showDetails && (
                <div className="pt-3 border-t border-slate-800/40 space-y-2.5 animate-fade-in">
                  <div className="grid grid-cols-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1">
                    <span>User</span>
                    <span className="text-center">Contributed</span>
                    <span className="text-right">Net Status</span>
                  </div>
                  <div className="space-y-2">
                    {balances.map(b => (
                      <div key={b.userId} className="grid grid-cols-3 text-xs items-center px-1 py-1 rounded-lg hover:bg-slate-800/20 transition-colors">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div 
                            className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-extrabold flex-shrink-0"
                            style={{ backgroundColor: b.avatarColor }}
                          >
                            {b.username.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-semibold text-slate-300 truncate">{b.username}</span>
                        </div>
                        <span className="text-center text-slate-400 font-medium">{formatBDT(b.totalPaid)}</span>
                        <span className={`text-right font-bold ${b.balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {b.balance >= 0 ? 'Owed ' : 'Owes '}{formatBDT(Math.abs(b.balance))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* ── Balance overview ─────────────────────────────────────── */}
      <div className="bento-card p-4 mb-3">
        <h2 className="font-semibold text-sm mb-4" style={{ color: '#f1f5f9' }}>Balance Overview</h2>
        <div className="space-y-3">
          {balances.map(b => (
            <div key={b.userId} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ backgroundColor: b.avatarColor, boxShadow: `0 0 10px ${b.avatarColor}50` }}>
                {b.username.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium" style={{ color: '#94a3b8' }}>{b.username}</span>
                  <span className="text-sm font-bold" style={{ color: b.balance >= 0 ? '#10b981' : '#f43f5e' }}>
                    {b.balance >= 0 ? '+' : ''}{formatBDT(b.balance)}
                  </span>
                </div>
                <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (Math.abs(b.balance) / Math.max(...balances.map(bb => Math.abs(bb.balance)), 1)) * 100)}%`,
                      background: b.balance >= 0
                        ? 'linear-gradient(90deg, #10b981, #059669)'
                        : 'linear-gradient(90deg, #f43f5e, #be123c)',
                      boxShadow: b.balance >= 0 ? '0 0 6px rgba(16,185,129,0.5)' : '0 0 6px rgba(244,63,94,0.5)',
                    }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Quick actions ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/admin/approvals"
          className="bento-card p-5 text-center flex flex-col items-center gap-2 transition-all duration-200 group">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center icon-container-violet transition-all duration-200 group-hover:scale-110">
            <IconUsers size={18} />
          </div>
          <p className="font-semibold text-sm" style={{ color: '#f1f5f9' }}>Approvals</p>
          {pendingCount > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
              {pendingCount} pending
            </span>
          )}
        </Link>
        <Link href="/admin/month"
          className="bento-card p-5 text-center flex flex-col items-center gap-2 transition-all duration-200 group">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center icon-container-cyan transition-all duration-200 group-hover:scale-110">
            <IconCalendar size={18} />
          </div>
          <p className="font-semibold text-sm" style={{ color: '#f1f5f9' }}>Month Manager</p>
        </Link>
        <Link href="/admin/overheads"
          className="bento-card p-5 text-center flex flex-col items-center gap-2 transition-all duration-200 group">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center icon-container-emerald transition-all duration-200 group-hover:scale-110">
            <IconDashboard size={18} />
          </div>
          <p className="font-semibold text-sm" style={{ color: '#f1f5f9' }}>Overheads</p>
        </Link>
        <Link href="/admin/edit-requests"
          className="bento-card p-5 text-center flex flex-col items-center gap-2 transition-all duration-200 group">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 group-hover:scale-110"
            style={{ background: 'rgba(251,146,60,0.12)', border: '1px solid rgba(251,146,60,0.25)', color: '#fb923c' }}>
            <IconMeal size={18} />
          </div>
          <p className="font-semibold text-sm" style={{ color: '#f1f5f9' }}>Edit Requests</p>
        </Link>
      </div>
    </div>
  );
}
