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
import { Download, FileText, ArrowRight, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { useSelectedMonth } from '@/contexts/MonthContext';

export default function ReportsPage() {
  const { profile } = useAuth();
  const { selectedMonthId, setSelectedMonthId, months } = useSelectedMonth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
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
    <div className="p-4 md:p-6 pb-28 md:pb-8 animate-fade-in max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Reports</h1>
          <p className="text-text-muted text-sm">Settlement & historical data</p>
        </div>
        <div className="flex items-center gap-3">
          {months.length > 1 && (
            <div className="relative animate-fade-in">
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
          <button
            id="export-pdf-btn"
            onClick={handleExportPDF}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <Download className="w-4 h-4" />
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
            {/* Invoice Header */}
            <div className="card bg-gradient-to-br from-slate-800 to-slate-900 text-white">
              <div className="flex items-center gap-3 mb-4">
                <FileText className="w-5 h-5 text-slate-400" />
                <div>
                  <h2 className="font-bold text-lg">Monthly Invoice</h2>
                  <p className="text-slate-400 text-sm">
                    {selectedMonth ? getMonthLabel(selectedMonth.label) : ''}
                    {selectedMonth?.is_closed ? ' · Closed' : ' · Open'}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-3xl font-extrabold">{formatBDT(totalExpenses)}</p>
                  <p className="text-slate-400 text-xs mt-0.5">Total Expenses</p>
                </div>
                <div>
                  <p className="text-3xl font-extrabold">{totalMeals}</p>
                  <p className="text-slate-400 text-xs mt-0.5">Total Meals</p>
                </div>
                <div>
                  <p className="text-3xl font-extrabold">{formatBDT(perMealRate)}</p>
                  <p className="text-slate-400 text-xs mt-0.5">Per-Meal Rate</p>
                </div>
              </div>
            </div>

            {/* Category Breakdown */}
            <div className="card">
              <h3 className="font-semibold text-text-primary mb-3">Expense Breakdown</h3>
              <div className="space-y-2">
                {categoryTotals.map(({ cat, label, total }) => (
                  <div key={cat} className="flex items-center justify-between">
                    <span className="text-text-secondary text-sm">{label}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-24 h-1.5 bg-background rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${(total / totalExpenses) * 100}%` }}
                        />
                      </div>
                      <span className="text-text-primary font-semibold text-sm w-24 text-right">
                        {formatBDT(total)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Individual Breakdown */}
            <div className="card">
              <h3 className="font-semibold text-text-primary mb-3">Individual Breakdown</h3>
              <div className="space-y-3">
                {balances.map(b => (
                  <div key={b.userId} className="border border-border rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: b.avatarColor }}
                      >
                        {b.username.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-semibold text-text-primary text-sm">{b.username}</span>
                      <span className={`ml-auto text-sm font-bold ${b.balance >= 0 ? 'text-positive' : 'text-negative'}`}>
                        {b.balance >= 0 ? '+' : ''}{formatBDT(b.balance)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-text-muted ml-9">
                      <span>Overhead Share</span>
                      <span className="text-right text-text-secondary">{formatBDT(b.overheadShare)}</span>
                      <span>Meals ({b.mealCount}×{formatBDT(perMealRate)})</span>
                      <span className="text-right text-text-secondary">{formatBDT(b.mealCost)}</span>
                      <span>Total Share</span>
                      <span className="text-right font-semibold text-text-primary">{formatBDT(b.totalShare)}</span>
                      <span>Total Paid</span>
                      <span className="text-right font-semibold text-positive">{formatBDT(b.totalPaid)}</span>
                      {b.openingBalance !== 0 && (
                        <>
                          <span>Opening Balance</span>
                          <span className={`text-right font-semibold ${b.openingBalance >= 0 ? 'text-positive' : 'text-negative'}`}>
                            {formatBDT(b.openingBalance)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Who Owes Whom — separate from printable area */}
          <div className="card mt-4">
            <h3 className="font-semibold text-text-primary mb-3">Who Owes Whom</h3>
            {whoOwes.length === 0 ? (
              <p className="text-text-muted text-sm text-center py-4">🎉 All settled up!</p>
            ) : (
              <div className="space-y-2">
                {whoOwes.map((t, i) => (
                  <div key={i} className="flex items-center gap-3 bg-background rounded-xl p-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: t.from.avatar_color }}
                    >
                      {t.from.username.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-text-primary text-sm font-medium">{t.from.username}</span>
                    <ArrowRight className="w-4 h-4 text-text-muted" />
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: t.to.avatar_color }}
                    >
                      {t.to.username.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-text-primary text-sm font-medium flex-1">{t.to.username}</span>
                    <span className="text-negative font-bold text-sm">{formatBDT(t.amount)}</span>
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
