'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Month, Profile, Expense, Meal, Settlement } from '@/lib/types';
import {
  calculateBalances,
  computeWhoOwesWhom,
  formatBDT,
  getAllMonths,
  getMonthLabel,
  getOrCreateCurrentMonth,
} from '@/lib/finance';
import { format, addMonths, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { Lock, Unlock, Plus, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';

export default function MonthManagerPage() {
  const { profile } = useAuth();
  const [months, setMonths] = useState<Month[]>([]);
  const [currentMonth, setCurrentMonth] = useState<Month | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [closing, setClosing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSettleModal, setShowSettleModal] = useState(false);

  const fetchAll = useCallback(async () => {
    const [monthsData, cm] = await Promise.all([
      getAllMonths(),
      getOrCreateCurrentMonth(),
    ]);
    setMonths(monthsData);
    setCurrentMonth(cm);

    const [profRes, expRes, mealRes, settleRes] = await Promise.all([
      (supabase as any).from('profiles').select('*').eq('status', 'active'),
      (supabase as any).from('expenses').select('*').eq('month_id', cm.id),
      (supabase as any).from('meals').select('*').eq('month_id', cm.id),
      (supabase as any).from('settlements').select('*').eq('month_id', cm.id),
    ]);

    setProfiles(profRes.data ?? []);
    setExpenses(expRes.data ?? []);
    setMeals(mealRes.data ?? []);
    
    const latestMonth = monthsData.sort((a, b) => b.label.localeCompare(a.label))[0];
    if (latestMonth) {
        setCurrentMonth(latestMonth);
        const [profRes, expRes, mealRes, settleRes] = await Promise.all([
          (supabase as any).from('profiles').select('*').eq('status', 'active'),
          (supabase as any).from('expenses').select('*').eq('month_id', latestMonth.id),
          (supabase as any).from('meals').select('*').eq('month_id', latestMonth.id),
          (supabase as any).from('settlements').select('*').eq('month_id', latestMonth.id),
        ]);

        setProfiles(profRes.data ?? []);
        setExpenses(expRes.data ?? []);
        setMeals(mealRes.data ?? []);
        setSettlements(settleRes.data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Re-fetch expenses/meals/settlements when selected month changes
  const handleMonthChange = useCallback(async (monthId: string) => {
    const selected = months.find(m => m.id === monthId);
    if (!selected) return;
    setCurrentMonth(selected);

    const [expRes, mealRes, settleRes] = await Promise.all([
      (supabase as any).from('expenses').select('*').eq('month_id', monthId),
      (supabase as any).from('meals').select('*').eq('month_id', monthId),
      (supabase as any).from('settlements').select('*').eq('month_id', monthId),
    ]);

    setExpenses(expRes.data ?? []);
    setMeals(mealRes.data ?? []);
    setSettlements(settleRes.data ?? []);
  }, [months]);

  const openingBalances = (currentMonth?.opening_balances as Record<string, number>) ?? {};
  const balances = calculateBalances(expenses, meals, profiles, openingBalances);
  const whoOwes = computeWhoOwesWhom(balances, profiles);

  const handleCloseMonth = async () => {
    if (!currentMonth) return;
    if (!confirm('Close this month? This will LOCK all expenses and meal inputs. Carry-forward balances will be set for the new month.')) return;

    setClosing(true);
    try {
      // Compute carry-forward balances
      const carryForward: Record<string, number> = {};
      balances.forEach(b => { carryForward[b.userId] = b.balance; });

      // Fetch configs for the current month to carry-over
      const [fixedRes, sharedRes] = await Promise.all([
        (supabase as any).from('fixed_overhead_configs').select('*').eq('month_id', currentMonth.id),
        (supabase as any).from('shared_expense_configs').select('*').eq('month_id', currentMonth.id),
      ]);

      // Close current month
      await (supabase as any).from('months').update({
        is_closed: true,
        closed_at: new Date().toISOString(),
      }).eq('id', currentMonth.id);

      // Create or update next month with carry-forward balances
      const nextMonthDate = addMonths(parseISO(`${currentMonth.label}-01`), 1);
      const nextLabel = format(nextMonthDate, 'yyyy-MM');

      // Check if the next month already exists
      const { data: existingNext } = await (supabase as any)
        .from('months')
        .select('id')
        .eq('label', nextLabel)
        .maybeSingle();

      let nextMonthData: any;
      if (existingNext) {
        // Next month already exists — just update its opening balances
        const { data, error } = await (supabase as any)
          .from('months')
          .update({ opening_balances: carryForward })
          .eq('id', existingNext.id)
          .select()
          .single();
        if (error) throw error;
        nextMonthData = data;
      } else {
        // Next month doesn't exist — create it
        const { data, error } = await (supabase as any)
          .from('months')
          .insert({ label: nextLabel, is_closed: false, opening_balances: carryForward })
          .select()
          .single();
        if (error) throw error;
        nextMonthData = data;
      }


      // Copy fixed overheads
      if (fixedRes.data && fixedRes.data.length > 0) {
        const nextFixed = fixedRes.data.map((c: any) => ({
          user_id: c.user_id,
          category: c.category,
          amount: c.amount,
          month_id: nextMonthData.id,
        }));
        await (supabase as any).from('fixed_overhead_configs').insert(nextFixed);
      }

      // Copy shared expenses
      if (sharedRes.data && sharedRes.data.length > 0) {
        const nextShared = sharedRes.data.map((c: any) => ({
          category: c.category,
          total_amount: c.total_amount,
          month_id: nextMonthData.id,
        }));
        await (supabase as any).from('shared_expense_configs').insert(nextShared);
      }

      toast.success('Month closed! New month created with carry-forward balances.');
      fetchAll();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to close month');
    } finally {
      setClosing(false);
    }
  };

  const handleMarkSettled = async (fromId: string, toId: string, amount: number) => {
    if (!currentMonth) return;
    const fromProfile = profiles.find(p => p.id === fromId);
    const toProfile = profiles.find(p => p.id === toId);

    try {
      await (supabase as any).from('settlements').insert({
        month_id: currentMonth.id,
        from_user: fromId,
        to_user: toId,
        amount,
        settled_by_admin: true,
      });
      toast.success(`Marked ${fromProfile?.username} → ${toProfile?.username} as settled`);
      fetchAll();
    } catch {
      toast.error('Failed to record settlement');
    }
  };

  if (loading) {
    return (
      <div className="p-4 md:p-8 space-y-4 animate-pulse">
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}
      </div>
    );
  }

  const isCurrentClosed = currentMonth?.is_closed;

  return (
    <div className="p-4 md:p-6 pb-28 md:pb-8 animate-fade-in max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Month Manager</h1>
        <p className="text-text-muted text-sm">Manage billing cycles and settlements</p>
      </div>

      {/* Month selector */}
      <div className="card mb-4">
        <label className="text-text-muted text-xs font-semibold uppercase tracking-wider mb-2 block">
          Select Month to Manage
        </label>
        <select
          id="admin-month-select"
          value={currentMonth?.id ?? ''}
          onChange={e => handleMonthChange(e.target.value)}
          className="w-full rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2"
          style={{
            background: '#0d1220',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#f1f5f9',
          }}
        >
          {months.map(m => (
            <option key={m.id} value={m.id}>
              {getMonthLabel(m.label)} {m.is_closed ? '(Closed)' : '(Open)'}
            </option>
          ))}
        </select>
      </div>

      {/* Current month status */}
      <div className={`card mb-4 border-2 ${isCurrentClosed ? 'border-muted/30 bg-muted-light' : 'border-primary/20 bg-primary-light'}`}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-text-muted text-xs font-medium">Selected Month</p>
            <h2 className="text-xl font-bold text-text-primary">
              {currentMonth ? getMonthLabel(currentMonth.label) : '—'}
            </h2>
          </div>
          {isCurrentClosed ? (
            <div className="flex items-center gap-1.5 bg-muted-light text-muted text-xs font-semibold px-3 py-1.5 rounded-full border border-muted/30">
              <Lock className="w-3 h-3" />
              Closed
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-active-light text-active text-xs font-semibold px-3 py-1.5 rounded-full">
              <Unlock className="w-3 h-3" />
              Open
            </div>
          )}
        </div>

        {!isCurrentClosed && (
          <>
            <div className="grid grid-cols-3 gap-3 text-center mb-4">
              <div>
                <p className="text-xl font-bold text-text-primary">{expenses.length}</p>
                <p className="text-text-muted text-xs">Expenses</p>
              </div>
              <div>
                <p className="text-xl font-bold text-text-primary">{meals.reduce((s, m) => s + m.count, 0)}</p>
                <p className="text-text-muted text-xs">Total Meals</p>
              </div>
              <div>
                <p className="text-xl font-bold text-text-primary">
                  {formatBDT(expenses.reduce((s, e) => s + e.amount, 0))}
                </p>
                <p className="text-text-muted text-xs">Total</p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <p className="text-amber-800 font-semibold text-sm">Before closing the month:</p>
              </div>
              <ul className="text-amber-700 text-xs space-y-1 ml-6 list-disc">
                <li>Ensure all expenses are logged</li>
                <li>Ensure all meals are logged for the full month</li>
                <li>Remaining balances will carry forward automatically</li>
              </ul>
            </div>

            <button
              id="close-month-btn"
              onClick={handleCloseMonth}
              disabled={closing}
              className="btn-danger w-full flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              {closing ? 'Closing...' : 'Close Month & Generate New Month'}
            </button>
          </>
        )}
      </div>

      {/* Cash settlement tool */}
      <div className="card mb-4">
        <h2 className="font-semibold text-text-primary mb-3">Cash Settlement Tool</h2>
        <p className="text-text-muted text-xs mb-4">
          Mark debts as settled when physical cash is exchanged.
        </p>

        {whoOwes.length === 0 ? (
          <div className="text-center py-4">
            <CheckCircle2 className="w-10 h-10 text-active opacity-40 mx-auto mb-2" />
            <p className="text-text-muted text-sm">All balances settled!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {whoOwes.map((t, i) => {
              const alreadySettled = settlements.some(
                s => s.from_user === t.from.id && s.to_user === t.to.id
              );
              return (
                <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border ${
                  alreadySettled ? 'bg-active-light border-active/20' : 'bg-background border-border'
                }`}>
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: t.from.avatar_color }}
                  >
                    {t.from.username.charAt(0).toUpperCase()}
                  </div>
                  <ArrowRight className="w-3 h-3 text-text-muted" />
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: t.to.avatar_color }}
                  >
                    {t.to.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-text-primary text-xs font-medium">
                      {t.from.username} → {t.to.username}
                    </p>
                    <p className="text-negative font-bold text-sm">{formatBDT(t.amount)}</p>
                  </div>
                  {alreadySettled ? (
                    <div className="badge-active">
                      <CheckCircle2 className="w-3 h-3" />
                      Settled
                    </div>
                  ) : (
                    <button
                      id={`settle-${t.from.id}-${t.to.id}`}
                      onClick={() => handleMarkSettled(t.from.id, t.to.id, t.amount)}
                      className="bg-active text-white text-xs font-semibold px-3 py-1.5 rounded-xl hover:bg-emerald-700 transition-all active:scale-95"
                    >
                      Mark Paid
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Month history */}
      <div className="card">
        <h2 className="font-semibold text-text-primary mb-3">Month History</h2>
        <div className="space-y-2">
          {months.map(m => (
            <div key={m.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <span className="text-text-primary text-sm font-medium">{getMonthLabel(m.label)}</span>
              {m.is_closed ? (
                <div className="flex items-center gap-1.5 text-muted text-xs font-medium">
                  <Lock className="w-3 h-3" />
                  Closed {m.closed_at ? format(parseISO(m.closed_at), 'MMM d') : ''}
                </div>
              ) : (
                <span className="text-active text-xs font-medium">Open</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
