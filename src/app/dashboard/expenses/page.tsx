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
import { useSelectedMonth } from '@/contexts/MonthContext';
import { CategoryIcon } from '@/components/GeometricIcons';
import Calculator from '@/components/Calculator';

export default function ExpensesPage() {
  const { profile } = useAuth();
  const { selectedMonthId, setSelectedMonthId, months } = useSelectedMonth();
  const [month, setMonth] = useState<Month | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editExpense, setEditExpense] = useState<import('@/lib/types').Expense | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('my_expenses');
  const [loading, setLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showCalculator, setShowCalculator] = useState(false);

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
    <div className="p-4 md:p-6 pb-28 md:pb-8 animate-fade-in max-w-2xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Expenses</h1>
          <p className="text-text-muted text-sm">
            {month ? format(parseISO(`${month.label}-01`), 'MMMM yyyy') : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {months.length > 1 && (
            <div className="relative">
              <select
                value={selectedMonthId}
                onChange={e => setSelectedMonthId(e.target.value)}
                className="bg-[#0a0f1a] text-slate-200 text-xs font-semibold px-3 py-1.5 rounded-xl border border-white/10 appearance-none pr-8 cursor-pointer hover:border-violet-500/50 transition-colors focus:outline-none"
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
          {!isLocked && (
            <button
              id="expenses-add-btn"
              onClick={() => setShowForm(true)}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          )}
          {isLocked && (
            <div className="flex items-center gap-1.5 bg-muted-light text-muted text-xs font-semibold px-3 py-1.5 rounded-full">
              <Lock className="w-3 h-3" />
              Locked
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

      {/* Expense list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}
        </div>
      ) : filteredExpenses.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          <p className="text-4xl mb-2">📋</p>
          <p className="font-medium">No expenses yet</p>
          <p className="text-sm">Tap &quot;Add&quot; to log the first one</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredExpenses.map(expense => {
            const paidDetails = expense.paid_by_details as Record<string, number> | null;
            const hasSplitPay = paidDetails && Object.keys(paidDetails).length > 1;

            const paidByProfile = profileMap.get(expense.paid_by);
            const isMyExpense = expense.paid_by === profile?.id || (paidDetails && profile && paidDetails[profile.id] > 0);
            const splitDetails = expense.split_details as Record<string, number>;

            return (
              <div key={expense.id} className="card hover:shadow-card-hover transition-all duration-200">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-background flex items-center justify-center text-lg flex-shrink-0 text-violet-400">
                    <CategoryIcon category={expense.category} size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-text-primary text-sm">
                          {CATEGORY_LABELS[expense.category as keyof typeof CATEGORY_LABELS]}
                        </p>
                        {expense.description && (
                          <p className="text-text-muted text-xs truncate">{expense.description}</p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-text-primary">{formatBDT(expense.amount)}</p>
                        {(expense.paid_full || (paidDetails && Object.keys(paidDetails).length === 1)) && (
                          <span className="text-xs text-active font-medium">Paid full</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      {hasSplitPay ? (
                        <div className="flex -space-x-1.5 overflow-hidden">
                          {Object.keys(paidDetails).map(uid => {
                            const p = profileMap.get(uid);
                            return (
                              <div
                                key={uid}
                                className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold ring-1 ring-[#0d1220] flex-shrink-0"
                                style={{ backgroundColor: p?.avatar_color ?? '#334155' }}
                                title={`${p?.username}: ${formatBDT(paidDetails[uid])}`}
                              >
                                {p?.username.charAt(0).toUpperCase()}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                          style={{ backgroundColor: paidByProfile?.avatar_color }}
                        >
                          {paidByProfile?.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="text-text-muted text-xs">
                        {hasSplitPay
                          ? Object.keys(paidDetails).map(uid => `${profileMap.get(uid)?.username} (${formatBDT(paidDetails[uid])})`).join(' + ')
                          : paidByProfile?.username
                        }
                        {expense.category === 'grocery'
                          ? ' · Grocery'
                          : expense.split_type === 'custom'
                            ? ' · Custom split'
                            : ` · ÷ ${Object.keys(splitDetails).filter(k => splitDetails[k] > 0).length}`}
                      </span>
                      <span className="text-text-muted text-xs ml-auto">
                        {format(parseISO(expense.created_at), 'MMM d, h:mm a')}
                      </span>
                    </div>
                  </div>
                  {(isMyExpense || profile?.role === 'admin') && !isLocked && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => { setEditExpense(expense); setShowForm(true); }}
                        className="text-text-muted hover:text-sky-400 transition-colors p-1"
                        title="Edit expense"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(expense.id)}
                        className="text-text-muted hover:text-negative transition-colors p-1"
                        title="Delete expense"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FABs */}
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3">
        {!isLocked && (
          <button
            id="expenses-fab"
            onClick={() => setShowForm(true)}
            className="w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95 text-white hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
              boxShadow: '0 4px 20px rgba(124,58,237,0.6), 0 0 40px rgba(124,58,237,0.2)',
            }}
            aria-label="Add Expense"
          >
            <Plus className="w-6 h-6" />
          </button>
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
    </div>
  );
}
