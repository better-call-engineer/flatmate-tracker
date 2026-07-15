'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Profile, FixedOverheadConfig, SharedExpenseConfig, Month } from '@/lib/types';
import { formatBDT, getMonthLabel } from '@/lib/finance';
import { toast } from 'sonner';
import { Loader2, Lock } from 'lucide-react';
import {
  IconSettings, IconBolt, IconRent, IconWifi, IconBroom,
  IconFlame, IconGrid,
} from '@/components/GeometricIcons';
import { useSelectedMonth } from '@/contexts/MonthContext';

// ── Fixed Expense categories (per-user) ───────────────────────────────────
const OVERHEAD_CATS = [
  { key: 'rent' as const, label: 'Rent', icon: IconRent },
];

// ── Shared Expense categories (total ÷ active users) ─────────────────────
const SHARED_CATS = [
  { key: 'electricity' as const, label: 'Electricity Bill', icon: IconBolt,  color: '#67e8f9' },
  { key: 'gas'         as const, label: 'Gas Bill',          icon: IconFlame, color: '#fb923c' },
  { key: 'internet'    as const, label: 'Internet Bill',     icon: IconWifi,  color: '#a78bfa' },
  { key: 'maid'        as const, label: 'Maid',              icon: IconBroom, color: '#f472b6' },
  { key: 'misc'        as const, label: 'Miscellaneous',     icon: IconGrid,  color: '#94a3b8' },
];

export default function OverheadConfigPage() {
  const { profile: adminProfile } = useAuth();
  const { selectedMonthId, setSelectedMonthId, months, loadingMonths } = useSelectedMonth();
  const [selectedMonth, setSelectedMonth] = useState<Month | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [configs, setConfigs] = useState<FixedOverheadConfig[]>([]);
  const [sharedConfigs, setSharedConfigs] = useState<SharedExpenseConfig[]>([]);
  const [localAmounts, setLocalAmounts] = useState<Record<string, string>>({});
  const [sharedAmounts, setSharedAmounts] = useState<Record<string, string>>({
    electricity: '0', gas: '0', internet: '0', maid: '0', misc: '0',
  });
  const [saving, setSaving] = useState<string | null>(null);
  const [savingShared, setSavingShared] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (silent = false) => {
    if (loadingMonths) return;
    if (!selectedMonthId) {
      if (!silent) setLoading(false);
      return;
    }
    if (!silent) setLoading(true);

    try {
      const activeMonth = months.find(m => m.id === selectedMonthId) || null;
      setSelectedMonth(activeMonth);

      const [profRes, configRes, sharedRes] = await Promise.all([
        (supabase as any).from('profiles').select('*').eq('status', 'active').order('slot'),
        (supabase as any).from('fixed_overhead_configs').select('*').eq('month_id', selectedMonthId),
        (supabase as any).from('shared_expense_configs').select('*').eq('month_id', selectedMonthId),
      ]);
      
      if (profRes.error) throw profRes.error;
      if (configRes.error) throw configRes.error;
      if (sharedRes.error) throw sharedRes.error;

      const profs = (profRes.data ?? []) as Profile[];
      const confs = (configRes.data ?? []) as FixedOverheadConfig[];
      const shared = (sharedRes.data ?? []) as SharedExpenseConfig[];
      setProfiles(profs);
      setConfigs(confs);
      setSharedConfigs(shared);

      // Initialise per-user amounts
      const amounts: Record<string, string> = {};
      profs.forEach(p => {
        OVERHEAD_CATS.forEach(cat => {
          const existing = confs.find(c => c.user_id === p.id && c.category === cat.key);
          amounts[`${p.id}_${cat.key}`] = existing ? String(existing.amount) : '0';
        });
      });
      setLocalAmounts(amounts);

      // Initialise shared amounts
      const sAmounts: Record<string, string> = { electricity: '0', gas: '0', internet: '0', maid: '0', misc: '0' };
      SHARED_CATS.forEach(cat => {
        const existing = shared.find(s => s.category === cat.key);
        sAmounts[cat.key] = existing ? String(existing.total_amount) : '0';
      });
      setSharedAmounts(sAmounts);
    } catch (err) {
      console.error('Error config config page stats:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [selectedMonthId, months, loadingMonths]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Save per-user fixed expense ─────────────────────────────────────────
  const handleSave = async (userId: string, category: 'rent') => {
    if (!selectedMonthId) return;
    const key = `${userId}_${category}`;
    const amount = parseFloat(localAmounts[key] ?? '0') || 0;
    setSaving(key);
    try {
      const { data: existing } = await supabase
        .from('fixed_overhead_configs').select('id')
        .eq('user_id', userId).eq('category', category).eq('month_id', selectedMonthId).maybeSingle();
      let error;
      if (existing) {
        ({ error } = await (supabase as any).from('fixed_overhead_configs')
          .update({ amount, updated_at: new Date().toISOString() })
          .eq('user_id', userId).eq('category', category).eq('month_id', selectedMonthId));
      } else {
        ({ error } = await (supabase as any).from('fixed_overhead_configs')
          .insert({ user_id: userId, category, amount, month_id: selectedMonthId }));
      }
      if (error) throw error;
      toast.success('Saved!');
      fetchData(true);
    } catch (err: unknown) {
      toast.error(`Save failed: ${err instanceof Error ? err.message : JSON.stringify(err)}`);
    } finally { setSaving(null); }
  };

  // ── Save shared expense ─────────────────────────────────────────────────
  const handleSaveShared = async (category: 'electricity' | 'gas' | 'internet' | 'maid' | 'misc') => {
    if (!selectedMonthId) return;
    const total = parseFloat(sharedAmounts[category] ?? '0') || 0;
    setSavingShared(category);
    try {
      const { data: existing } = await supabase
        .from('shared_expense_configs').select('id')
        .eq('category', category).eq('month_id', selectedMonthId).maybeSingle();
      let error;
      if (existing) {
        ({ error } = await (supabase as any).from('shared_expense_configs')
          .update({ total_amount: total, updated_at: new Date().toISOString() })
          .eq('category', category).eq('month_id', selectedMonthId));
      } else {
        ({ error } = await (supabase as any).from('shared_expense_configs')
          .insert({ category, total_amount: total, month_id: selectedMonthId }));
      }
      if (error) throw error;
      toast.success('Shared expense saved!');
      fetchData(true);
    } catch (err: unknown) {
      toast.error(`Save failed: ${err instanceof Error ? err.message : JSON.stringify(err)}`);
    } finally { setSavingShared(null); }
  };

  // Column totals
  const catTotals = OVERHEAD_CATS.map(cat => ({
    ...cat,
    total: profiles.reduce((sum, p) => {
      const conf = configs.find(c => c.user_id === p.id && c.category === cat.key);
      return sum + (conf?.amount ?? 0);
    }, 0),
  }));

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-3 animate-pulse max-w-2xl mx-auto">
        {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 pb-28 md:pb-8 animate-fade-in max-w-2xl mx-auto">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center icon-container-cyan">
            <IconSettings size={15} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#f1f5f9' }}>Expense Config</h1>
            <p className="text-xs mt-0.5" style={{ color: '#475569' }}>
              Set per-user Fixed Expenses and flat-wide Shared Expenses.
            </p>
          </div>
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

      {/* ── Closed Month Warning Notice ─────────────────────────── */}
      {selectedMonth?.is_closed && (
        <div className="mb-6 flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-amber-500 animate-fade-in">
          <Lock className="w-5 h-5 flex-shrink-0" />
          <div className="text-xs font-semibold">
            This billing cycle ({getMonthLabel(selectedMonth.label)}) is **Closed/Locked**. Any updates saved below will apply specifically to this past month.
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          SECTION 1 — FIXED EXPENSES (per user)
      ══════════════════════════════════════════════════════════ */}
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1.5 h-4 rounded-full" style={{ background: '#a78bfa' }} />
          <h2 className="font-bold text-base" style={{ color: '#f1f5f9' }}>Fixed Expenses</h2>
          <span className="text-xs font-medium ml-auto" style={{ color: '#475569' }}>Per user · monthly</span>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-1 gap-2 mb-3">
        {catTotals.map(cat => {
          const Icon = cat.icon;
          return (
            <div key={cat.key} className="bento-card p-3 text-center">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center mx-auto mb-2 icon-container-violet">
                <Icon size={14} />
              </div>
              <p className="text-base font-extrabold" style={{ color: '#f1f5f9' }}>{formatBDT(cat.total)}</p>
              <p className="text-[10px] mt-0.5" style={{ color: '#475569' }}>{cat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Per-user table */}
      <div className="bento-card overflow-x-auto mb-2">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <th className="text-left py-3 pr-4 pl-4 text-xs font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>User</th>
              {OVERHEAD_CATS.map(cat => {
                const Icon = cat.icon;
                return (
                  <th key={cat.key} className="text-center py-3 px-2 text-xs font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>
                    <div className="flex flex-col items-center gap-1">
                      <Icon size={13} style={{ color: '#a78bfa' }} />
                      <span>{cat.label}</span>
                    </div>
                  </th>
                );
              })}
              <th className="text-right py-3 pl-4 pr-4 text-xs font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map(p => {
              const userTotal = OVERHEAD_CATS.reduce((sum, cat) => {
                const conf = configs.find(c => c.user_id === p.id && c.category === cat.key);
                return sum + (conf?.amount ?? 0);
              }, 0);
              return (
                <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td className="py-3 pr-4 pl-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ backgroundColor: p.avatar_color, boxShadow: `0 0 8px ${p.avatar_color}50` }}>
                        {p.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-sm" style={{ color: '#f1f5f9' }}>{p.username}</p>
                        <p className="text-[10px]" style={{ color: '#475569' }}>Slot {p.slot}</p>
                      </div>
                    </div>
                  </td>
                  {OVERHEAD_CATS.map(cat => {
                    const key = `${p.id}_${cat.key}`;
                    const isSaving = saving === key;
                    return (
                      <td key={cat.key} className="py-3 px-2">
                        <div className="flex items-center gap-1 justify-center">
                          <span className="text-xs" style={{ color: '#475569' }}>৳</span>
                          <input
                            id={`overhead-${p.id}-${cat.key}`}
                            type="number" min="0" step="100"
                            value={localAmounts[key] ?? '0'}
                            onChange={e => setLocalAmounts(prev => ({ ...prev, [key]: e.target.value }))}
                            onFocus={e => e.target.select()}
                            className="input w-24 text-right text-sm py-1.5 px-2"
                          />
                          <button
                            id={`save-${p.id}-${cat.key}`}
                            onClick={() => handleSave(p.id, cat.key)}
                            disabled={isSaving}
                            className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all active:scale-95 disabled:opacity-50"
                            style={{ background: 'rgba(124,58,237,0.2)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.3)' }}
                            title="Save"
                          >
                            {isSaving ? <Loader2 size={12} className="animate-spin" /> : <span className="text-xs font-bold">✓</span>}
                          </button>
                        </div>
                      </td>
                    );
                  })}
                  <td className="py-3 pl-4 pr-4 text-right">
                    <span className="font-bold text-sm" style={{ color: '#f1f5f9' }}>{formatBDT(userTotal)}</span>
                    <p className="text-[10px]" style={{ color: '#475569' }}>/ month</p>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid rgba(124,58,237,0.2)', background: 'rgba(124,58,237,0.05)' }}>
              <td className="py-3 pr-4 pl-4 font-semibold text-sm" style={{ color: '#a78bfa' }}>Total</td>
              {catTotals.map(cat => (
                <td key={cat.key} className="py-3 px-2 text-center font-bold text-sm" style={{ color: '#a78bfa' }}>
                  {formatBDT(cat.total)}
                </td>
              ))}
              <td className="py-3 pl-4 pr-4 text-right font-bold text-sm" style={{ color: '#f1f5f9' }}>
                {formatBDT(catTotals.reduce((s, c) => s + c.total, 0))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-xs text-center mb-8" style={{ color: '#334155' }}>
        Click ✓ to save each cell individually. Changes apply immediately to all balance calculations.
      </p>

      {/* ══════════════════════════════════════════════════════════
          SECTION 2 — SHARED EXPENSES (flat-wide, split equally)
      ══════════════════════════════════════════════════════════ */}
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1.5 h-4 rounded-full" style={{ background: '#06b6d4' }} />
          <h2 className="font-bold text-base" style={{ color: '#f1f5f9' }}>Shared Expenses</h2>
          <span className="text-xs font-medium ml-auto" style={{ color: '#475569' }}>Total ÷ {profiles.length || 4} users</span>
        </div>
        <p className="text-xs ml-4" style={{ color: '#334155' }}>
          Enter the total bill amount. Each flatmate's share is calculated automatically.
        </p>
      </div>

      <div className="bento-card divide-y" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        {SHARED_CATS.map(cat => {
          const Icon = cat.icon;
          const total = parseFloat(sharedAmounts[cat.key] ?? '0') || 0;
          const perUser = profiles.length > 0 ? total / profiles.length : 0;
          const isSav = savingShared === cat.key;
          return (
            <div key={cat.key} className="flex items-center gap-3 p-4">
              {/* Icon + label */}
              <div className="flex items-center gap-2.5 w-40 flex-shrink-0">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${cat.color}18`, border: `1px solid ${cat.color}30`, color: cat.color }}>
                  <Icon size={17} />
                </div>
                <div>
                  <p className="font-semibold text-sm" style={{ color: '#f1f5f9' }}>{cat.label}</p>
                  <p className="text-[10px]" style={{ color: '#475569' }}>Total bill</p>
                </div>
              </div>

              {/* Input */}
              <div className="flex items-center gap-1.5 flex-1">
                <span className="text-xs flex-shrink-0" style={{ color: '#475569' }}>৳</span>
                <input
                  id={`shared-${cat.key}`}
                  type="number" min="0" step="100"
                  value={sharedAmounts[cat.key] ?? '0'}
                  onChange={e => setSharedAmounts(prev => ({ ...prev, [cat.key]: e.target.value }))}
                  onFocus={e => e.target.select()}
                  className="input flex-1 text-right text-sm py-1.5 px-3"
                />
                <button
                  id={`save-shared-${cat.key}`}
                  onClick={() => handleSaveShared(cat.key)}
                  disabled={isSav}
                  className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all active:scale-95 disabled:opacity-50"
                  style={{ background: `${cat.color}20`, color: cat.color, border: `1px solid ${cat.color}35` }}
                  title="Save"
                >
                  {isSav ? <Loader2 size={13} className="animate-spin" /> : <span className="text-xs font-bold">✓</span>}
                </button>
              </div>

              {/* Per-user breakdown */}
              <div className="text-right min-w-[96px] flex-shrink-0">
                <p className="font-bold text-sm" style={{ color: cat.color }}>{formatBDT(perUser)}</p>
                <p className="text-[10px]" style={{ color: '#475569' }}>per person</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Shared total summary */}
      {(() => {
        const grandShared = SHARED_CATS.reduce((s, c) => s + (parseFloat(sharedAmounts[c.key] ?? '0') || 0), 0);
        const perUserGrand = profiles.length > 0 ? grandShared / profiles.length : 0;
        return grandShared > 0 ? (
          <div className="flex items-center justify-between px-4 py-3 mt-2 rounded-xl"
            style={{ background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.15)' }}>
            <span className="text-sm font-semibold" style={{ color: '#67e8f9' }}>Combined shared total</span>
            <div className="text-right">
              <span className="font-extrabold text-base" style={{ color: '#67e8f9' }}>{formatBDT(grandShared)}</span>
              <p className="text-[10px]" style={{ color: '#475569' }}>{formatBDT(perUserGrand)} per person</p>
            </div>
          </div>
        ) : null;
      })()}
    </div>
  );
}
