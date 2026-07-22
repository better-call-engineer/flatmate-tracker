'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Expense, Meal, Month, Profile, Settlement } from '@/lib/types';
import {
  calculateBalances,
  computeWhoOwesWhom,
  formatBDT,
  getOrCreateCurrentMonth,
  getMonthLabel,
} from '@/lib/finance';
import { CATEGORY_LABELS } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { Download, FileText, ArrowRight, Calendar, Plus, Calculator as CalculatorIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useSelectedMonth } from '@/contexts/MonthContext';
import ExpenseForm from '@/components/ExpenseForm';
import Calculator from '@/components/Calculator';
import { CategoryIcon } from '@/components/GeometricIcons';

export default function ReportsPage() {
  const { profile } = useAuth();
  const { selectedMonthId, setSelectedMonthId, months } = useSelectedMonth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  const fetchMonthData = useCallback(async () => {
    if (!selectedMonthId) return;
    setLoading(true);
    const [expRes, mealRes, profRes, settleRes] = await Promise.all([
      (supabase as any).from('expenses').select('*').eq('month_id', selectedMonthId),
      (supabase as any).from('meals').select('*').eq('month_id', selectedMonthId),
      (supabase as any).from('profiles').select('*').eq('status', 'active'),
      (supabase as any).from('settlements').select('*').eq('month_id', selectedMonthId),
    ]);
    setExpenses((expRes.data ?? []) as Expense[]);
    setMeals((mealRes.data ?? []) as Meal[]);
    setProfiles((profRes.data ?? []) as Profile[]);
    setSettlements((settleRes.data ?? []) as Settlement[]);
    setLoading(false);
  }, [selectedMonthId]);

  useEffect(() => { fetchMonthData(); }, [fetchMonthData]);

  const selectedMonth = months.find(m => m.id === selectedMonthId);
  const openingBalances = (selectedMonth?.opening_balances as Record<string, number>) ?? {};
  const balances = calculateBalances(expenses, meals, profiles, openingBalances);
  const whoOwes = computeWhoOwesWhom(balances, profiles);

  // Financial summaries
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const groceryTotal = expenses.filter(e => e.category === 'grocery').reduce((s, e) => s + e.amount, 0);
  const totalMeals = meals.reduce((s, m) => s + m.count, 0);
  const perMealRate = totalMeals > 0 ? groceryTotal / totalMeals : 0;

  const categoryTotals = Object.entries(CATEGORY_LABELS).map(([cat, label]) => ({
    cat,
    label,
    total: expenses.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0),
  })).filter(c => c.total > 0);

  const handleExportPDF = async () => {
    if (!printRef.current) return;
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`FlatMate-${selectedMonth?.label ?? 'report'}.pdf`);
      toast.success('PDF exported!');
    } catch {
      toast.error('PDF export failed. Try again.');
    }
  };

  return (
    <div className="h-full overflow-y-auto no-scrollbar px-5 sm:px-8 md:px-12 pt-7 md:pt-8 pb-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-3 mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Reports</h1>
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
          {!selectedMonth?.is_closed && (
            <button
              id="reports-add-btn"
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
            id="reports-calc-btn"
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

          {/* Export PDF button */}
          <button
            id="export-pdf-btn"
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-200 bg-white/5 border border-white/10 hover:bg-white/10 transition-all active:scale-95"
          >
            <Download className="w-4 h-4 text-violet-400" />
            Export PDF
          </button>
        </div>
      </div>



      {loading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}
        </div>
      ) : (
        <>
          {/* Printable Invoice Area */}
          <div ref={printRef} className="space-y-4">
            {/* Invoice Header — Outer Tile holding 3 Subtiles */}
            <div className="card">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 bg-white/5 border border-white/10">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-bold text-base text-slate-100">Monthly Invoice</h2>
                  <p className="text-slate-400 text-xs">
                    {selectedMonth ? getMonthLabel(selectedMonth.label) : ''}
                    {selectedMonth?.is_closed ? ' · Closed' : ' · Open'}
                  </p>
                </div>
              </div>

              {/* 3 Subtile boxes inside */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Subtile 1: Total Expenses */}
                <div
                  className="rounded-2xl p-4 flex flex-col items-center justify-center text-center transition-all duration-200 hover:translate-y-[-1px] relative overflow-hidden"
                  style={{
                    background: 'rgba(167,139,250,0.06)',
                    border: '1px solid rgba(167,139,250,0.15)',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                  }}
                >
                  <p className="text-2xl sm:text-3xl font-extrabold text-[#c4b5fd] tracking-tight">{formatBDT(totalExpenses)}</p>
                  <p className="text-slate-400 text-xs font-semibold mt-1">Total Expenses</p>
                </div>

                {/* Subtile 2: Total Meals */}
                <div
                  className="rounded-2xl p-4 flex flex-col items-center justify-center text-center transition-all duration-200 hover:translate-y-[-1px] relative overflow-hidden"
                  style={{
                    background: 'rgba(6,182,212,0.06)',
                    border: '1px solid rgba(6,182,212,0.15)',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                  }}
                >
                  <p className="text-2xl sm:text-3xl font-extrabold text-[#67e8f9] tracking-tight">{totalMeals}</p>
                  <p className="text-slate-400 text-xs font-semibold mt-1">Total Meals</p>
                </div>

                {/* Subtile 3: Per-Meal Rate */}
                <div
                  className="rounded-2xl p-4 flex flex-col items-center justify-center text-center transition-all duration-200 hover:translate-y-[-1px] relative overflow-hidden"
                  style={{
                    background: 'rgba(245,158,11,0.06)',
                    border: '1px solid rgba(245,158,11,0.15)',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                  }}
                >
                  <p className="text-2xl sm:text-3xl font-extrabold text-[#fcd34d] tracking-tight">{formatBDT(perMealRate)}</p>
                  <p className="text-slate-400 text-xs font-semibold mt-1">Per-Meal Rate</p>
                </div>
              </div>
            </div>

            {/* Category Breakdown — Outer Tile holding Category Subtiles */}
            <div className="card">
              <h3 className="font-semibold text-text-primary mb-3">Expense Breakdown</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {categoryTotals.map(({ cat, label, total }) => {
                  const pct = totalExpenses > 0 ? ((total / totalExpenses) * 100).toFixed(1) : '0';
                  return (
                    <div
                      key={cat}
                      className="rounded-2xl p-3.5 flex flex-col justify-between gap-2.5 transition-all duration-200 hover:translate-y-[-1px] relative overflow-hidden"
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
                      }}
                    >
                      {/* Subtile Header: Icon + Name + Percentage Pill */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.2)', color: '#c4b5fd' }}>
                            <CategoryIcon category={cat} size={13} />
                          </div>
                          <span className="font-bold text-xs text-slate-200 truncate">{label}</span>
                        </div>
                        <span className="text-[10px] font-extrabold text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full flex-shrink-0">
                          {pct}%
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="w-full h-1.5 bg-[#0a0f1a] rounded-full overflow-hidden border border-white/5">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            background: 'linear-gradient(90deg, #7c3aed 0%, #a78bfa 100%)',
                          }}
                        />
                      </div>

                      {/* Subtile Footer: Amount */}
                      <div className="flex items-center justify-between text-xs pt-1">
                        <span className="text-slate-500 text-[10px] font-medium">Total Spent</span>
                        <span className="font-extrabold text-white">{formatBDT(total)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Individual Breakdown */}
            <div className="card">
              <h3 className="font-semibold text-text-primary mb-3">Individual Breakdown</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {balances.map(b => (
                  <div key={b.userId}
                    className="rounded-2xl p-4 flex flex-col justify-between gap-3 transition-all duration-200 hover:translate-y-[-2px] relative overflow-hidden group"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                          style={{ backgroundColor: b.avatarColor, boxShadow: `0 0 12px ${b.avatarColor}60` }}>
                          {b.username.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-bold text-sm text-slate-100">{b.username}</span>
                      </div>
                      <span className={`text-xs font-extrabold px-2.5 py-1 rounded-xl border ${b.balance >= 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
                        {b.balance >= 0 ? '+' : ''}{formatBDT(b.balance)}
                      </span>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-white/5 text-xs text-slate-400">
                      <div className="flex justify-between">
                        <span>Overhead Share</span>
                        <span className="text-slate-200 font-semibold">{formatBDT(b.overheadShare)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Meals ({b.mealCount}×{formatBDT(perMealRate)})</span>
                        <span className="text-slate-200 font-semibold">{formatBDT(b.mealCost)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Share</span>
                        <span className="text-white font-bold">{formatBDT(b.totalShare)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Paid</span>
                        <span className="text-emerald-400 font-bold">{formatBDT(b.totalPaid)}</span>
                      </div>
                      {b.openingBalance !== 0 && (
                        <div className="flex justify-between">
                          <span>Opening Balance</span>
                          <span className={`font-semibold ${b.openingBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {formatBDT(b.openingBalance)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Who Owes Whom — Bento Tile Grid */}
          <div className="card mt-4">
            <h3 className="font-semibold text-text-primary mb-3">Who Owes Whom</h3>
            {whoOwes.length === 0 ? (
              <p className="text-text-muted text-sm text-center py-4">🎉 All settled up!</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {whoOwes.map((t, i) => (
                  <div key={i}
                    className="rounded-2xl p-4 flex items-center justify-between gap-3 transition-all duration-200 hover:translate-y-[-2px] relative overflow-hidden"
                    style={{
                      background: 'rgba(244,63,94,0.05)',
                      border: '1px solid rgba(244,63,94,0.15)',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ backgroundColor: t.from.avatar_color }}>
                        {t.from.username.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs font-semibold text-slate-300 truncate">{t.from.username}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ backgroundColor: t.to.avatar_color }}>
                        {t.to.username.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs font-semibold text-slate-300 truncate">{t.to.username}</span>
                    </div>
                    <span className="text-sm font-extrabold text-rose-400 flex-shrink-0">{formatBDT(t.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Edit Request (for locked months) */}
          {selectedMonth?.is_closed && (
            <EditRequestSection monthId={selectedMonth.id} userId={profile?.id ?? ''} />
          )}
        </>
      )}

      {showForm && selectedMonth && (
        <ExpenseForm
          monthId={selectedMonth.id}
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

function EditRequestSection({ monthId, userId }: { monthId: string; userId: string }) {
  const [description, setDescription] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async () => {
    if (!description.trim()) return;
    setSending(true);
    const { error } = await (supabase as any).from('edit_requests').insert({
      requested_by: userId,
      month_id: monthId,
      description: description.trim(),
    });
    if (error) toast.error('Failed to submit request');
    else {
      toast.success('Edit request submitted to admin');
      setDescription('');
    }
    setSending(false);
  };

  return (
    <div className="card mt-4 border border-amber-500/20 bg-amber-500/5">
      <h3 className="font-semibold text-amber-500 mb-2">Request an Edit</h3>
      <p className="text-amber-600 text-xs mb-3">
        This month is closed. Request admin to make changes.
      </p>
      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Describe what needs to be corrected..."
        className="w-full border border-amber-500/20 rounded-xl px-3 py-2.5 text-sm bg-white/5 text-white placeholder-amber-500/40 focus:outline-none focus:ring-2 focus:ring-amber-500/30 resize-none"
        rows={3}
        id="edit-request-textarea"
      />
      <button
        id="edit-request-submit"
        onClick={handleSubmit}
        disabled={sending || !description.trim()}
        className="mt-2 hover:bg-amber-600/90 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all disabled:opacity-60"
        style={{
          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          boxShadow: '0 4px 16px rgba(245,158,11,0.2)'
        }}
      >
        {sending ? 'Submitting...' : 'Submit Request'}
      </button>
    </div>
  );
}
