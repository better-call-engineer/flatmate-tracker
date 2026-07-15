'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Profile, FixedOverheadConfig, SharedExpenseConfig, Expense } from '@/lib/types';
import {
  CATEGORY_LABELS,
  CATEGORY_GROUPS,
  ExpenseCategory,
} from '@/lib/types';
import { getOrCreateCurrentMonth } from '@/lib/finance';
import { computeEvenSplit, computeCustomSplit } from '@/lib/finance';
import { toast } from 'sonner';
import { X, ChevronDown, ChevronUp, AlertCircle, Scale, Edit3, Loader2, Coins } from 'lucide-react';
import { CategoryIcon } from '@/components/GeometricIcons';

interface Props {
  onClose: () => void;
  onSaved: () => void;
  monthId?: string;
  editExpense?: Expense;
}

export default function ExpenseForm({ onClose, onSaved, monthId, editExpense }: Props) {
  const { profile } = useAuth();
  const isEditing = !!editExpense;
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [category, setCategory] = useState<ExpenseCategory>(editExpense?.category as ExpenseCategory ?? 'misc');
  const [description, setDescription] = useState(editExpense?.description ?? '');
  const [amount, setAmount] = useState(editExpense ? String(editExpense.amount) : '');
  const [paidFull, setPaidFull] = useState(editExpense?.paid_full ?? false);
  const [splitType, setSplitType] = useState<'even' | 'custom' | 'fixed' | 'deposit'>(editExpense?.split_type ?? 'even');
  const [includedUsers, setIncludedUsers] = useState<Set<string>>(new Set());
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});

  // Auto-calculate total amount when in Fixed mode
  useEffect(() => {
    if (splitType === 'fixed') {
      const sum = Object.values(customAmounts).reduce((s, v) => s + (parseFloat(v) || 0), 0);
      setAmount(sum > 0 ? String(sum) : '');
    }
  }, [customAmounts, splitType]);

  const [showSplitDetails, setShowSplitDetails] = useState(false);
  // Track whether the mousedown started on the backdrop itself (for drag-to-close prevention)
  const backdropMouseDownRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [fixedConfigs, setFixedConfigs] = useState<FixedOverheadConfig[]>([]);
  const [sharedConfigs, setSharedConfigs] = useState<SharedExpenseConfig[]>([]);

  // Paid by states
  const [paidType, setPaidType] = useState<'single' | 'split'>('single');
  const [singlePayerId, setSinglePayerId] = useState<string>('');
  const [customPaidAmounts, setCustomPaidAmounts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!profile) return;
    
    const loadConfigs = async () => {
      let targetMonthId = monthId || (editExpense ? editExpense.month_id : null);
      if (!targetMonthId) {
        try {
          const currentMonth = await getOrCreateCurrentMonth();
          targetMonthId = currentMonth.id;
        } catch {
          // Fallback
        }
      }

      const [profilesRes, fixedRes, sharedRes] = await Promise.all([
        (supabase as any).from('profiles').select('*').eq('status', 'active'),
        targetMonthId
          ? (supabase as any).from('fixed_overhead_configs').select('*').eq('user_id', profile.id).eq('month_id', targetMonthId)
          : (supabase as any).from('fixed_overhead_configs').select('*').eq('user_id', profile.id),
        targetMonthId
          ? (supabase as any).from('shared_expense_configs').select('*').eq('month_id', targetMonthId)
          : (supabase as any).from('shared_expense_configs').select('*'),
      ]);

      const p = (profilesRes.data ?? []) as Profile[];
      setProfiles(p);
      setFixedConfigs((fixedRes.data ?? []) as FixedOverheadConfig[]);
      setSharedConfigs((sharedRes.data ?? []) as SharedExpenseConfig[]);

      if (editExpense) {
        // Pre-populate from existing expense
        const splitDetails = editExpense.split_details as Record<string, number> | null;
        const paidByDetails = editExpense.paid_by_details as Record<string, number> | null;
        const hasSplitPay = paidByDetails && Object.keys(paidByDetails).filter(k => (paidByDetails[k] ?? 0) > 0).length > 1;

        // Included users = those with a non-zero share
        const includedSet = splitDetails
          ? new Set(Object.keys(splitDetails).filter(k => (splitDetails[k] ?? 0) > 0))
          : new Set(p.map(u => u.id));
        setIncludedUsers(includedSet);

        // Custom split amounts
        if (editExpense.split_type === 'custom' && splitDetails) {
          const ca: Record<string, string> = {};
          Object.keys(splitDetails).forEach(k => { ca[k] = String(splitDetails[k]); });
          setCustomAmounts(ca);
          setShowSplitDetails(true);
        }

        // Paid-by
        if (hasSplitPay && paidByDetails) {
          setPaidType('split');
          const cpa: Record<string, string> = {};
          Object.keys(paidByDetails).forEach(k => { cpa[k] = String(paidByDetails[k]); });
          setCustomPaidAmounts(cpa);
        } else {
          setPaidType('single');
          setSinglePayerId(editExpense.paid_by);
        }
      } else {
        setIncludedUsers(new Set(p.map(u => u.id)));
        setSinglePayerId(profile.id);
      }
    };

    loadConfigs();
  }, [profile, monthId, editExpense]);

  useEffect(() => {
    if (isEditing) return;
    if (!category) return;

    // Grocery has variable amount, clear input box
    if (category === 'grocery') {
      setAmount('');
      return;
    }

    // Check if category is a fixed overhead category (rent, internet, maid)
    const fixed = fixedConfigs.find(c => c.category === category);
    if (fixed) {
      setAmount(String(fixed.amount));
      return;
    }

    // Check if category is a shared config category (electricity, gas, misc)
    const shared = sharedConfigs.find(c => c.category === category);
    if (shared) {
      if (paidFull) {
        setAmount(String(shared.total_amount));
      } else {
        const activeCount = profiles.length || 4;
        const perPerson = shared.total_amount / activeCount;
        setAmount(String(Math.round(perPerson)));
      }
      return;
    }
  }, [category, paidFull, fixedConfigs, sharedConfigs, profiles.length]);

  const totalCustomAmount = Object.values(customAmounts)
    .reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const amountNum = parseFloat(amount) || 0;
  const customMismatch = splitType === 'custom' && customAmounts && 
    Math.abs(totalCustomAmount - amountNum) > 0.5;

  const totalPaidAmount = Object.values(customPaidAmounts)
    .reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const paidMismatch = paidType === 'split' && 
    Math.abs(totalPaidAmount - amountNum) > 0.5;

  const handleToggleUser = (userId: string) => {
    setIncludedUsers(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        if (next.size <= 1) return prev; // must include at least 1
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const handleSetSplitType = (type: 'even' | 'custom' | 'fixed' | 'deposit') => {
    setSplitType(type);
    if (type === 'fixed' || type === 'custom') {
      setShowSplitDetails(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !amountNum) return;

    setSaving(true);
    try {
      const includedArr = Array.from(includedUsers);
      const activeIds = profiles.map(p => p.id);

      let splitDetails: Record<string, number>;
      const finalSplitType = (splitType === 'fixed' || splitType === 'deposit') ? 'custom' : splitType;

      if (splitType === 'even') {
        splitDetails = computeEvenSplit(amountNum, includedArr);
      } else if (splitType === 'deposit') {
        splitDetails = {};
      } else {
        const ca: Record<string, number> = {};
        includedArr.forEach(id => {
          ca[id] = parseFloat(customAmounts[id] ?? '0') || 0;
        });
        splitDetails = computeCustomSplit(amountNum, includedArr, ca);
      }

      // Zero out excluded users
      activeIds.forEach(id => {
        if (!splitDetails[id]) splitDetails[id] = 0;
      });

      let finalPaidBy = singlePayerId;
      let finalPaidByDetails: Record<string, number> = {};

      if (paidType === 'split') {
        profiles.forEach(p => {
          finalPaidByDetails[p.id] = parseFloat(customPaidAmounts[p.id] ?? '0') || 0;
        });
        let maxAmt = 0;
        Object.keys(finalPaidByDetails).forEach(uid => {
          if (finalPaidByDetails[uid] > maxAmt) {
            maxAmt = finalPaidByDetails[uid];
            finalPaidBy = uid;
          }
        });
      }

      if (isEditing && editExpense) {
        const { error } = await (supabase as any).from('expenses').update({
          paid_by: finalPaidBy,
          category,
          description: description.trim() || null,
          amount: amountNum,
          paid_full: paidFull,
          split_type: finalSplitType,
          split_details: splitDetails,
          paid_by_details: finalPaidByDetails,
        }).eq('id', editExpense.id);
        if (error) throw error;
        toast.success('Expense updated!');
      } else {
        const currentMonthId = monthId || (await getOrCreateCurrentMonth()).id;
        const { error } = await (supabase as any).from('expenses').insert({
          month_id: currentMonthId,
          paid_by: finalPaidBy,
          category,
          description: description.trim() || null,
          amount: amountNum,
          paid_full: paidFull,
          split_type: finalSplitType,
          split_details: splitDetails,
          paid_by_details: finalPaidByDetails,
        });
        if (error) throw error;
        toast.success('Expense added!');
      }
      onSaved();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : isEditing ? 'Failed to update expense' : 'Failed to add expense');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center modal-overlay"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
      onMouseDown={e => { backdropMouseDownRef.current = e.target === e.currentTarget; }}
      onClick={e => { if (e.target === e.currentTarget && backdropMouseDownRef.current) onClose(); }}
    >
      <div 
        className="w-full sm:w-[460px] max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl modal-content"
        style={{
          background: '#0d1220',
          border: '1px solid rgba(255,255,255,0.09)',
          boxShadow: '0 0 0 1px rgba(124,58,237,0.12), 0 -8px 40px rgba(0,0,0,0.8), 0 0 60px rgba(124,58,237,0.08)',
        }}
      >
        {/* Header */}
        <div 
          className="sticky top-0 z-10 flex items-center justify-between px-6 pt-6 pb-4 border-b border-border"
          style={{ background: '#0d1220' }}
        >
          <div>
            <h2 className="font-bold text-text-primary text-base">{isEditing ? 'Edit Expense' : 'Add Expense'}</h2>
            <p className="text-xs" style={{ color: '#475569' }}>{isEditing ? 'Update expense details' : 'Track flatshare expenditures'}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            id="expense-form-close"
            className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-150"
            style={{ background: 'rgba(255,255,255,0.05)', color: '#64748b' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(244,63,94,0.1)';
              (e.currentTarget as HTMLButtonElement).style.color = '#f43f5e';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)';
              (e.currentTarget as HTMLButtonElement).style.color = '#64748b';
            }}
          >
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Category */}
          <div className="space-y-3">
            <label className="text-text-secondary text-xs font-semibold uppercase tracking-wider block mb-1">Category</label>
            <div className="space-y-4">
              {Object.entries(CATEGORY_GROUPS).map(([group, cats]) => (
                <div key={group} className="space-y-1.5">
                  <p className="text-text-muted text-[10px] font-bold uppercase tracking-wider">{group}</p>
                  <div className="flex flex-wrap gap-2">
                    {(cats as ExpenseCategory[]).map(cat => {
                      const isSelected = category === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          id={`expense-cat-${cat}`}
                          onClick={() => setCategory(cat)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all duration-150 active:scale-95"
                          style={isSelected ? {
                            background: 'rgba(124,58,237,0.18)',
                            color: '#a78bfa',
                            border: '1px solid rgba(124,58,237,0.28)',
                            boxShadow: '0 0 10px rgba(124,58,237,0.15)',
                          } : {
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.07)',
                            color: '#64748b',
                          }}
                          onMouseEnter={e => {
                            if (!isSelected) {
                              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)';
                              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.12)';
                              (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8';
                            }
                          }}
                          onMouseLeave={e => {
                            if (!isSelected) {
                              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.03)';
                              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.07)';
                              (e.currentTarget as HTMLButtonElement).style.color = '#64748b';
                            }
                          }}
                        >
                          <CategoryIcon category={cat} size={12} />
                          <span>{CATEGORY_LABELS[cat]}</span>
                        </button>
                      );
                    })}
                    {/* Pay Fixed Amount — only shown in Fixed Expenses group */}
                    {group === 'Fixed Expenses' && (() => {
                      const isPayFixedSelected = category === 'misc' && splitType === 'deposit';
                      return (
                        <button
                          key="pay-fixed-amount"
                          type="button"
                          id="expense-cat-pay-fixed"
                          onClick={() => {
                            setCategory('misc');
                            handleSetSplitType('deposit');
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all duration-150 active:scale-95"
                          style={isPayFixedSelected ? {
                            background: 'rgba(6,182,212,0.18)',
                            color: '#67e8f9',
                            border: '1px solid rgba(6,182,212,0.35)',
                            boxShadow: '0 0 10px rgba(6,182,212,0.15)',
                          } : {
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.07)',
                            color: '#64748b',
                          }}
                          onMouseEnter={e => {
                            if (!isPayFixedSelected) {
                              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(6,182,212,0.08)';
                              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(6,182,212,0.2)';
                              (e.currentTarget as HTMLButtonElement).style.color = '#67e8f9';
                            }
                          }}
                          onMouseLeave={e => {
                            if (!isPayFixedSelected) {
                              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.03)';
                              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.07)';
                              (e.currentTarget as HTMLButtonElement).style.color = '#64748b';
                            }
                          }}
                        >
                          <Coins size={12} />
                          <span>Pay Fixed Amount</span>
                        </button>
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-text-secondary text-xs font-semibold uppercase tracking-wider block" htmlFor="expense-amount">
                Amount (৳)
              </label>
              {splitType === 'fixed' && (
                <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">
                  Auto-calculated from split sums
                </span>
              )}
            </div>
            <input
              id="expense-amount"
              type="number"
              min="1"
              step="1"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              disabled={splitType === 'fixed'}
              className="input text-xl font-bold"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#f1f5f9',
              }}
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-text-secondary text-xs font-semibold uppercase tracking-wider block" htmlFor="expense-desc">
              Description <span className="text-text-muted font-normal lowercase">(optional)</span>
            </label>
            <input
              id="expense-desc"
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. Monthly rent payment"
              className="input"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#f1f5f9',
              }}
            />
          </div>

          {/* Paid By */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-text-secondary text-xs font-semibold uppercase tracking-wider block">Paid By</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPaidType('single');
                    setCustomPaidAmounts({});
                  }}
                  className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border transition-all ${
                    paidType === 'single'
                      ? 'bg-primary/10 border-primary/30 text-[#a78bfa]'
                      : 'border-slate-800 text-slate-500 hover:text-slate-400'
                  }`}
                >
                  Single Payer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPaidType('split');
                    const initial: Record<string, string> = {};
                    profiles.forEach(p => {
                      initial[p.id] = p.id === profile?.id ? amount : '';
                    });
                    setCustomPaidAmounts(initial);
                  }}
                  className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border transition-all ${
                    paidType === 'split'
                      ? 'bg-primary/10 border-primary/30 text-[#a78bfa]'
                      : 'border-slate-800 text-slate-500 hover:text-slate-400'
                  }`}
                >
                  Split Pay
                </button>
              </div>
            </div>

            {paidType === 'single' ? (
              <div className="relative">
                <select
                  value={singlePayerId}
                  onChange={e => setSinglePayerId(e.target.value)}
                  className="input pr-10 text-sm appearance-none cursor-pointer"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#f1f5f9',
                  }}
                >
                  {profiles.map(p => (
                    <option key={p.id} value={p.id} className="bg-[#0d1220] text-slate-200">
                      {p.username} {p.id === profile?.id ? '(You)' : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              </div>
            ) : (
              <div 
                className="border rounded-2xl p-4 space-y-3 animate-fade-in"
                style={{
                  background: 'rgba(255,255,255,0.01)',
                  borderColor: 'rgba(255,255,255,0.06)'
                }}
              >
                <p className="text-text-muted text-[10px] font-bold uppercase tracking-wider">Enter contributed amounts:</p>
                {profiles.map(p => (
                  <div key={p.id} className="flex items-center gap-3">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                      style={{ backgroundColor: p.avatar_color }}
                    >
                      {p.username.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-slate-300 text-sm flex-1">{p.username}</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="৳"
                      value={customPaidAmounts[p.id] ?? ''}
                      onChange={e => setCustomPaidAmounts(prev => ({ ...prev, [p.id]: e.target.value }))}
                      className="input w-24 text-right py-1 px-3 text-sm font-semibold"
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        color: '#f1f5f9',
                      }}
                    />
                  </div>
                ))}

                {paidMismatch && (
                  <div 
                    className="flex items-center gap-2 rounded-xl px-3 py-2"
                    style={{
                      background: 'rgba(245,158,11,0.08)',
                      border: '1px solid rgba(245,158,11,0.2)'
                    }}
                  >
                    <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    <p className="text-amber-500 text-xs font-medium">
                      Sum (৳{totalPaidAmount.toFixed(0)}) does not match total (৳{amountNum.toFixed(0)})
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Paid Full toggle */}
          {splitType !== 'deposit' && (
            <div 
              className="flex items-center gap-3 rounded-xl p-3.5"
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)'
              }}
            >
              <input
                id="expense-paid-full"
                type="checkbox"
                checked={paidFull}
                onChange={e => setPaidFull(e.target.checked)}
                className="w-4 h-4 accent-primary"
              />
              <label htmlFor="expense-paid-full" className="text-text-primary text-sm font-medium cursor-pointer flex-1 select-none">
                Paid Full
              </label>
            </div>
          )}

          {/* Split Engine */}
          {splitType !== 'deposit' && (
            <div className="space-y-3">
            <button
              type="button"
              onClick={() => setShowSplitDetails(!showSplitDetails)}
              className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider"
              style={{ color: '#7c3aed' }}
              id="expense-split-toggle"
            >
              {showSplitDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              Split Options
            </button>

            {showSplitDetails && (
              <div 
                className="border rounded-2xl p-4 space-y-4 animate-fade-in"
                style={{
                  background: 'rgba(255,255,255,0.01)',
                  borderColor: 'rgba(255,255,255,0.06)'
                }}
              >
                {/* Split type */}
                <div className="flex gap-2">
                  {(['even', 'custom', 'fixed'] as const).map(type => {
                    const isSelected = splitType === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => handleSetSplitType(type)}
                        className="flex-1 py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all duration-150 active:scale-95"
                        style={isSelected ? {
                          background: 'rgba(124,58,237,0.18)',
                          color: '#a78bfa',
                          border: '1px solid rgba(124,58,237,0.28)',
                          boxShadow: '0 0 10px rgba(124,58,237,0.15)',
                        } : {
                          background: 'rgba(255,255,255,0.02)',
                          border: '1px solid rgba(255,255,255,0.06)',
                          color: '#64748b',
                        }}
                        id={`expense-split-${type}`}
                      >
                        {type === 'even' && <Scale size={13} />}
                        {type === 'custom' && <Edit3 size={13} />}
                        {type === 'fixed' && <Coins size={13} />}
                        {type === 'even' && 'Even Split'}
                        {type === 'custom' && 'Custom Split'}
                        {type === 'fixed' && 'Fixed Amount'}
                      </button>
                    );
                  })}
                </div>

                {/* User inclusion checkboxes */}
                <div className="space-y-3">
                  <p className="text-text-muted text-[10px] font-bold uppercase tracking-wider">Include in split:</p>
                  {profiles.map(p => (
                    <div key={p.id} className="flex items-center gap-3">
                      <input
                        id={`split-include-${p.id}`}
                        type="checkbox"
                        checked={includedUsers.has(p.id)}
                        onChange={() => handleToggleUser(p.id)}
                        className="w-4 h-4 accent-primary"
                      />
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ backgroundColor: p.avatar_color, boxShadow: `0 0 8px ${p.avatar_color}50` }}
                      >
                        {p.username.charAt(0).toUpperCase()}
                      </div>
                      <label htmlFor={`split-include-${p.id}`} className="text-text-primary text-sm flex-1 cursor-pointer select-none">
                        {p.username}
                        {p.id === profile?.id && <span className="text-text-muted"> (You)</span>}
                      </label>
                      {(splitType === 'custom' || splitType === 'fixed') && includedUsers.has(p.id) && (
                        <input
                          type="number"
                          min="0"
                          step="1"
                          placeholder="৳"
                          value={customAmounts[p.id] ?? ''}
                          onChange={e => setCustomAmounts(prev => ({ ...prev, [p.id]: e.target.value }))}
                          onFocus={e => e.target.select()}
                          className="input w-24 text-right py-1.5 px-3 text-sm font-semibold"
                          style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            color: '#f1f5f9',
                          }}
                        />
                      )}
                      {splitType === 'even' && includedUsers.has(p.id) && (
                        <span className="text-text-muted text-xs w-20 text-right font-medium">
                          {amountNum && includedUsers.size > 0
                            ? `৳${(amountNum / includedUsers.size).toFixed(0)}`
                            : '—'}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {customMismatch && (
                  <div 
                    className="flex items-center gap-2 rounded-xl px-3 py-2"
                    style={{
                      background: 'rgba(245,158,11,0.08)',
                      border: '1px solid rgba(245,158,11,0.2)'
                    }}
                  >
                    <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    <p className="text-amber-500 text-xs font-medium">
                      Custom amounts (৳{totalCustomAmount.toFixed(0)}) don't match total (৳{amountNum.toFixed(0)})
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
          )}

          <button
            id="expense-submit-btn"
            type="submit"
            disabled={saving || !amountNum || (customMismatch) || (paidMismatch)}
            className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200 active:scale-95 disabled:opacity-50"
            style={{
              background: isEditing
                ? 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)'
                : 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
              boxShadow: isEditing
                ? '0 4px 16px rgba(14,165,233,0.4)'
                : '0 4px 16px rgba(124,58,237,0.4)',
              color: 'white',
            }}
          >
            {saving ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                {isEditing ? 'Saving...' : 'Adding...'}
              </>
            ) : (
              isEditing ? 'Save Changes' : 'Add Expense'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
