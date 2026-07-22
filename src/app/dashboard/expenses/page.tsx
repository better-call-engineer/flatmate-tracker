'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Expense, Month, Profile } from '@/lib/types';
import { CATEGORY_LABELS, CATEGORY_ICONS } from '@/lib/types';
import { getOrCreateCurrentMonth, formatBDT, getMonthLabel } from '@/lib/finance';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { Plus, Trash2, Lock, Filter, Pencil, Calculator as CalculatorIcon } from 'lucide-react';
import ExpenseForm from '@/components/ExpenseForm';
import Calculator from '@/components/Calculator';
import { useSelectedMonth } from '@/contexts/MonthContext';
import { CategoryIcon } from '@/components/GeometricIcons';

export default function ExpensesPage() {
  const { profile } = useAuth();
  const { selectedMonthId, setSelectedMonthId, months } = useSelectedMonth();
  const [month, setMonth] = useState<Month | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [editExpense, setEditExpense] = useState<import('@/lib/types').Expense | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('my_expenses');
  const [loading, setLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!selectedMonthId) return;
    const currentMonth = months.find(m => m.id === selectedMonthId) || await getOrCreateCurrentMonth();
    setMonth(currentMonth);

    const [expRes, profRes] = await Promise.all([
      (supabase as any).from('expenses').select('*').eq('month_id', currentMonth.id).order('created_at', { ascending: false }),
      (supabase as any).from('profiles').select('*').eq('status', 'active'),
    ]);

    setExpenses(expRes.data ?? []);
    setProfiles(profRes.data ?? []);
    setLoading(false);
  }, [selectedMonthId, months]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const profileMap = new Map(profiles.map(p => [p.id, p]));

  const executeDelete = async () => {
    if (!deleteConfirmId) return;
    const deletedExpense = expenses.find(e => e.id === deleteConfirmId);
    if (!deletedExpense) return;

    const { error } = await (supabase as any).from('expenses').delete().eq('id', deleteConfirmId);
    if (error) {
      toast.error('Failed to delete');
    } else {
      toast.success('Expense deleted', {
        action: {
          label: 'Undo',
          onClick: () => handleUndoDelete(deletedExpense)
        }
      });
      fetchData();
    }
    setDeleteConfirmId(null);
  };

  const handleDeleteDirect = async (expenseId: string) => {
    const deletedExpense = expenses.find(e => e.id === expenseId);
    if (!deletedExpense) return;

    const { error } = await (supabase as any).from('expenses').delete().eq('id', expenseId);
    if (error) {
      toast.error('Failed to delete');
    } else {
      toast.success('Expense deleted', {
        action: {
          label: 'Undo',
          onClick: () => handleUndoDelete(deletedExpense)
        }
      });
      fetchData();
    }
  };

  const handleUndoDelete = async (oldExpense: Expense) => {
    const { error } = await (supabase as any).from('expenses').insert({
      id: oldExpense.id,
      month_id: oldExpense.month_id,
      paid_by: oldExpense.paid_by,
      category: oldExpense.category,
      description: oldExpense.description,
      amount: oldExpense.amount,
      paid_full: oldExpense.paid_full,
      split_type: oldExpense.split_type,
      split_details: oldExpense.split_details,
      paid_by_details: oldExpense.paid_by_details,
      created_at: oldExpense.created_at,
    });

    if (error) {
      toast.error('Failed to restore expense');
    } else {
      toast.success('Expense restored!', {
        action: {
          label: 'Delete again',
          onClick: () => handleDeleteDirect(oldExpense.id)
        }
      });
      fetchData();
    }
  };

  const filteredExpenses = filterCategory === 'all'
    ? expenses
    : filterCategory === 'my_expenses'
    ? expenses.filter(e => {
        const paidDetails = e.paid_by_details as Record<string, number> | null;
        return e.paid_by === profile?.id || (paidDetails && profile && paidDetails[profile.id] > 0);
      })
    : expenses.filter(e => e.category === filterCategory);

  const totalAmount = filteredExpenses.reduce((s, e) => s + e.amount, 0);
  const categories = ['my_expenses', 'grocery', 'all'];
  const isLocked = month?.is_closed;

  return (
    <div className="h-full overflow-y-auto no-scrollbar px-5 sm:px-8 md:px-12 pt-7 md:pt-8 pb-6 animate-fade-in">
      <div className="flex flex-col gap-3 mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#f1f5f9' }}>Expenses</h1>
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

          {/* Add Expense button */}
          {!isLocked && (
            <button
              id="expenses-add-btn"
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
          )}

          {/* Calculator button */}
          <button
            id="expenses-calc-btn"
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

          {isLocked && (
            <div className="flex items-center gap-1.5 bg-rose-500/10 text-rose-400 text-xs font-semibold px-3 py-1.5 rounded-full border border-rose-500/20">
              <Lock className="w-3.5 h-3.5" />
              Closed
            </div>
          )}
        </div>
      </div>

      {/* Summary card */}
      <div className="card mb-4 bg-gradient-to-br from-primary to-primary-dark text-white">
        <p className="text-white/70 text-sm font-medium mb-1">
          {filterCategory === 'all' 
            ? 'Total Expenses' 
            : filterCategory === 'my_expenses' 
              ? 'My Expenses' 
              : CATEGORY_LABELS[filterCategory as keyof typeof CATEGORY_LABELS]}
        </p>
        <p className="text-4xl font-extrabold">{formatBDT(totalAmount)}</p>
        <p className="text-white/60 text-xs mt-1">{filteredExpenses.length} transaction{filteredExpenses.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 no-scrollbar">
        <div className="flex items-center gap-1 text-text-muted mr-1">
          <Filter className="w-3.5 h-3.5" />
        </div>
        {categories.map(cat => (
          <button
            key={cat}
            id={`filter-${cat}`}
            onClick={() => setFilterCategory(cat)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              filterCategory === cat
                ? 'bg-primary text-white border-primary'
                : 'bg-white/5 text-text-secondary border-white/10 hover:border-primary'
            }`}
          >
            {cat !== 'all' && cat !== 'my_expenses' && <CategoryIcon category={cat} size={12} className="text-violet-400" />}
            {cat === 'my_expenses' && <span>👤</span>}
            {cat === 'all' ? 'All' : cat === 'my_expenses' ? 'My Expenses' : CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS]}
          </button>
        ))}
      </div>

      {/* Expense list — Bento Tile Grid concept matching Activity page */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 animate-pulse">
          {[...Array(8)].map((_, i) => <div key={i} className="skeleton h-36 rounded-2xl" />)}
        </div>
      ) : filteredExpenses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: '#475569' }}>
            <Filter size={24} />
          </div>
          <p className="font-semibold text-sm text-slate-300">No expenses found</p>
          <p className="text-xs text-slate-500">Tap &quot;Add&quot; to log an expense for this month</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredExpenses.map(expense => (
            <ExpenseTile
              key={expense.id}
              expense={expense}
              profileMap={profileMap}
              profile={profile}
              isLocked={isLocked}
              onEdit={e => { setEditExpense(e); setShowForm(true); }}
              onDelete={id => setDeleteConfirmId(id)}
            />
          ))}
        </div>
      )}


      {(showForm || editExpense) && month && (
        <ExpenseForm
          monthId={month.id}
          onClose={() => { setShowForm(false); setEditExpense(null); }}
          onSaved={() => { setShowForm(false); setEditExpense(null); fetchData(); }}
          editExpense={editExpense ?? undefined}
        />
      )}

      {/* Custom Confirmation Modal */}
      {deleteConfirmId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
          onClick={() => setDeleteConfirmId(null)}
        >
          <div 
            className="w-full max-w-sm rounded-2xl p-5 modal-content space-y-4 text-center"
            style={{
              background: '#0d1220',
              border: '1px solid rgba(244,63,94,0.15)',
              boxShadow: '0 0 0 1px rgba(244,63,94,0.08), 0 20px 50px rgba(0,0,0,0.8), 0 0 40px rgba(244,63,94,0.05)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-500">
              <Trash2 size={22} />
            </div>
            
            <div className="space-y-1.5">
              <h3 className="font-extrabold text-base text-slate-100">Delete Expense?</h3>
              <p className="text-xs text-slate-400">
                Are you sure you want to delete this expense? This action cannot be undone.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="btn-secondary py-2.5 px-4 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={executeDelete}
                className="py-2.5 px-4 rounded-xl text-xs font-bold text-white transition-all hover:bg-rose-600 flex items-center justify-center gap-1.5"
                style={{
                  background: 'linear-gradient(135deg, #e11d48 0%, #f43f5e 100%)',
                  boxShadow: '0 4px 16px rgba(244,63,94,0.3)',
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showCalculator && (
        <Calculator onClose={() => setShowCalculator(false)} />
      )}
    </div>
  );
}

// ── Expense Tile Component (Bento Grid Concept) ──────────────────────────────
function ExpenseTile({
  expense,
  profileMap,
  profile,
  isLocked,
  onEdit,
  onDelete,
}: {
  expense: Expense;
  profileMap: Map<string, Profile>;
  profile: Profile | null;
  isLocked?: boolean;
  onEdit: (e: Expense) => void;
  onDelete: (id: string) => void;
}) {
  const paidDetails = expense.paid_by_details as Record<string, number> | null;
  const hasSplitPay = paidDetails && Object.keys(paidDetails).length > 1;
  const paidByProfile = profileMap.get(expense.paid_by);
  const isMyExpense = expense.paid_by === profile?.id || (paidDetails && profile && paidDetails[profile.id] > 0);
  const splitDetails = (expense.split_details as Record<string, number>) || {};

  const accentColor = '#a78bfa';
  const accentBg = 'rgba(167,139,250,0.06)';
  const accentBorder = 'rgba(167,139,250,0.15)';

  return (
    <div
      className="rounded-2xl p-4 flex flex-col justify-between gap-3 transition-all duration-200 hover:translate-y-[-2px] relative overflow-hidden group"
      style={{
        background: accentBg,
        border: `1px solid ${accentBorder}`,
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      }}
    >
      {/* Decorative radial glow */}
      <div className="absolute top-0 right-0 w-20 h-20 pointer-events-none opacity-20 transition-opacity group-hover:opacity-30"
        style={{ background: 'radial-gradient(circle at top right, rgba(167,139,250,0.4) 0%, transparent 70%)' }} />

      {/* Top Row: Category badge + Edit/Delete actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.25)', color: '#c4b5fd' }}>
            <CategoryIcon category={expense.category} size={15} />
          </div>
          <div>
            <h3 className="font-bold text-xs capitalize text-slate-100">
              {CATEGORY_LABELS[expense.category as keyof typeof CATEGORY_LABELS] ?? expense.category}
            </h3>
            <span className="text-[10px] text-slate-500 font-medium">
              {expense.category === 'grocery'
                ? 'Grocery'
                : expense.split_type === 'custom'
                  ? 'Custom split'
                  : `÷ ${Object.keys(splitDetails).filter(k => splitDetails[k] > 0).length}`}
            </span>
          </div>
        </div>

        {/* Edit / Delete actions */}
        {(isMyExpense || profile?.role === 'admin') && !isLocked && (
          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onEdit(expense)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-purple-300 hover:bg-purple-500/20 transition-colors"
              title="Edit expense"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={() => onDelete(expense.id)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-500/20 transition-colors"
              title="Delete expense"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Description if present */}
      {expense.description && (
        <p className="text-xs text-slate-400 line-clamp-2">{expense.description}</p>
      )}

      {/* Bottom Row: Payer Avatar & Names + Amount */}
      <div className="pt-2.5 border-t border-white/5 flex items-end justify-between gap-2">
        {/* Payer info */}
        <div className="flex items-center gap-2 min-w-0">
          {hasSplitPay ? (
            <div className="flex -space-x-1.5 overflow-hidden flex-shrink-0">
              {Object.keys(paidDetails!).map(uid => {
                const p = profileMap.get(uid);
                return (
                  <div
                    key={uid}
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold ring-1 ring-[#0d1220] flex-shrink-0"
                    style={{ backgroundColor: p?.avatar_color ?? '#334155' }}
                    title={`${p?.username}: ${formatBDT(paidDetails![uid])}`}
                  >
                    {p?.username.charAt(0).toUpperCase()}
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
              style={{ backgroundColor: paidByProfile?.avatar_color ?? '#334155' }}
            >
              {paidByProfile?.username.charAt(0).toUpperCase() ?? '?'}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-slate-300 truncate">
              {hasSplitPay
                ? Object.keys(paidDetails!).map(uid => profileMap.get(uid)?.username).join(' + ')
                : paidByProfile?.username ?? 'Unknown'}
            </p>
            <p className="text-[9px] text-slate-500">
              {format(parseISO(expense.created_at), 'MMM d, h:mm a')}
            </p>
          </div>
        </div>

        {/* Amount */}
        <div className="text-right flex-shrink-0">
          <p className="text-base font-extrabold text-white tracking-tight">{formatBDT(expense.amount)}</p>
          {(expense.paid_full || (paidDetails && Object.keys(paidDetails).length === 1)) && (
            <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">Paid full</span>
          )}
        </div>
      </div>
    </div>
  );
}
