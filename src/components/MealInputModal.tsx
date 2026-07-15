'use client';

import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { IconMeal, IconLock } from '@/components/GeometricIcons';
import { Loader2, X, Users } from 'lucide-react';

const MEAL_OPTIONS = [0, 0.5, 1, 1.5, 2];

const MEAL_LABELS: Record<number, string> = {
  0:   'None',
  0.5: 'Half',
  1:   '1×',
  1.5: '1.5×',
  2:   '2×',
};

interface Props {
  date: string;
  currentCount: number;
  currentGuestCount: number;
  userId: string;
  monthId: string;
  onClose: () => void;
  onSaved: (count: number, guestCount: number) => void;
}

export default function MealInputModal({
  date, currentCount, currentGuestCount, userId, monthId, onClose, onSaved,
}: Props) {
  const [selected, setSelected] = useState<number>(currentCount);
  const [guestOpen, setGuestOpen] = useState<boolean>(currentGuestCount > 0);
  const [guestCount, setGuestCount] = useState<number>(currentGuestCount);
  const [saving, setSaving] = useState(false);
  const guestInputRef = useRef<HTMLInputElement>(null);

  const [year, month, day] = date.split('-');
  const displayDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    .toLocaleDateString('en-BD', { weekday: 'long', month: 'long', day: 'numeric' });

  // Auto-focus the guest input when it appears
  useEffect(() => {
    if (guestOpen && guestInputRef.current) {
      guestInputRef.current.focus();
    }
  }, [guestOpen]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from('meals')
        .upsert(
          {
            user_id: userId,
            month_id: monthId,
            date,
            count: selected,
            guest_count: guestCount,
          },
          { onConflict: 'user_id,month_id,date' }
        );
      if (error) throw error;
      const guestMsg = guestCount > 0 ? ` + ${guestCount} guest` : '';
      toast.success(`Logged ${selected} meal(s)${guestMsg} for ${displayDate}`);
      onSaved(selected, guestCount);
    } catch {
      toast.error('Failed to save meals');
    } finally {
      setSaving(false);
    }
  };

  // Color for regular meal dots
  const regularDotColor = (i: number): string => {
    const isHalf = i === Math.floor(selected) && selected % 1 !== 0;
    return isHalf ? 'rgba(16,185,129,0.35)' : '#10b981';
  };

  // Guest portion ratio for the split-color progress bar
  const totalMeals = selected + guestCount;
  const guestRatio = totalMeals > 0 ? guestCount / totalMeals : 0;
  const regularRatio = totalMeals > 0 ? selected / totalMeals : 0;

  const handleGuestToggle = () => {
    if (guestOpen) {
      // Closing guest panel — reset to 0
      setGuestCount(0);
      setGuestOpen(false);
    } else {
      setGuestOpen(true);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center modal-overlay"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full sm:w-96 rounded-t-3xl sm:rounded-3xl p-6 modal-content"
        style={{
          background: '#0d1220',
          border: '1px solid rgba(255,255,255,0.09)',
          boxShadow: '0 0 0 1px rgba(124,58,237,0.12), 0 -8px 40px rgba(0,0,0,0.8), 0 0 60px rgba(124,58,237,0.08)',
        }}>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center icon-container-emerald">
              <IconMeal size={16} />
            </div>
            <div>
              <h2 className="font-bold text-base" style={{ color: '#f1f5f9' }}>Log Meals</h2>
              <p className="text-xs" style={{ color: '#475569' }}>{displayDate}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            id="meal-modal-close"
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

        {/* My meal label */}
        <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: '#475569' }}>
          My Meals
        </p>

        {/* Meal option buttons */}
        <div className="grid grid-cols-5 gap-2 mb-5">
          {MEAL_OPTIONS.map(opt => {
            const isSelected = selected === opt;
            return (
              <button
                key={opt}
                id={`meal-option-${opt}`}
                onClick={() => setSelected(opt)}
                className="aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all duration-150 active:scale-95"
                style={isSelected ? {
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  boxShadow: '0 0 16px rgba(16,185,129,0.5)',
                  transform: 'scale(1.06)',
                  color: '#022c22',
                } : {
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#64748b',
                }}
                onMouseEnter={e => {
                  if (!isSelected) {
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(16,185,129,0.1)';
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(16,185,129,0.3)';
                    (e.currentTarget as HTMLButtonElement).style.color = '#10b981';
                  }
                }}
                onMouseLeave={e => {
                  if (!isSelected) {
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)';
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.08)';
                    (e.currentTarget as HTMLButtonElement).style.color = '#64748b';
                  }
                }}
              >
                <span className={`text-base font-extrabold leading-none ${isSelected ? 'text-white' : ''}`}>{opt}</span>
                <span className={`text-[9px] font-medium ${isSelected ? 'text-emerald-200' : ''}`}>{MEAL_LABELS[opt]}</span>
              </button>
            );
          })}
        </div>

        {/* Guest Meal Toggle Button */}
        <button
          id="meal-guest-toggle"
          onClick={handleGuestToggle}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl mb-3 transition-all duration-200 active:scale-95"
          style={guestOpen ? {
            background: 'rgba(245,158,11,0.12)',
            border: '1px solid rgba(245,158,11,0.35)',
            color: '#fbbf24',
          } : {
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#64748b',
          }}
        >
          <div className="flex items-center gap-2">
            <Users size={14} />
            <span className="text-xs font-semibold">Guest Meal</span>
          </div>
          <div className="flex items-center gap-2">
            {guestOpen && guestCount > 0 && (
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(245,158,11,0.2)', color: '#fbbf24' }}
              >
                {guestCount}
              </span>
            )}
            <span className="text-[10px] font-medium" style={{ color: guestOpen ? '#fbbf24' : '#334155' }}>
              {guestOpen ? 'tap to remove' : 'add guest'}
            </span>
          </div>
        </button>

        {/* Guest count input — only shown when guestOpen */}
        {guestOpen && (
          <div
            className="mb-4 rounded-xl overflow-hidden transition-all duration-300"
            style={{
              background: 'rgba(245,158,11,0.06)',
              border: '1px solid rgba(245,158,11,0.2)',
            }}
          >
            <div className="p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(245,158,11,0.7)' }}>
                Guest Portions
              </p>
              <div className="flex items-center gap-3">
                {/* Decrement */}
                <button
                  id="guest-count-dec"
                  onClick={() => setGuestCount(prev => Math.max(0, parseFloat((prev - 0.5).toFixed(1))))}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold transition-all duration-150 active:scale-90"
                  style={{
                    background: 'rgba(245,158,11,0.12)',
                    border: '1px solid rgba(245,158,11,0.25)',
                    color: '#fbbf24',
                  }}
                >
                  −
                </button>

                {/* Input */}
                <input
                  ref={guestInputRef}
                  id="guest-count-input"
                  type="number"
                  min="0"
                  max="20"
                  step="0.5"
                  value={guestCount}
                  onChange={e => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val) && val >= 0 && val <= 20) setGuestCount(val);
                    else if (e.target.value === '') setGuestCount(0);
                  }}
                  className="flex-1 text-center text-xl font-extrabold rounded-xl py-2 outline-none transition-all duration-200"
                  style={{
                    background: 'rgba(245,158,11,0.08)',
                    border: '1px solid rgba(245,158,11,0.3)',
                    color: '#fbbf24',
                  }}
                />

                {/* Increment */}
                <button
                  id="guest-count-inc"
                  onClick={() => setGuestCount(prev => Math.min(20, parseFloat((prev + 0.5).toFixed(1))))}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold transition-all duration-150 active:scale-90"
                  style={{
                    background: 'rgba(245,158,11,0.12)',
                    border: '1px solid rgba(245,158,11,0.25)',
                    color: '#fbbf24',
                  }}
                >
                  +
                </button>
              </div>

              {/* Quick presets */}
              <div className="flex gap-2 mt-3">
                {[1, 2, 3, 4].map(n => (
                  <button
                    key={n}
                    onClick={() => setGuestCount(n)}
                    className="flex-1 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 active:scale-95"
                    style={guestCount === n ? {
                      background: 'rgba(245,158,11,0.25)',
                      border: '1px solid rgba(245,158,11,0.5)',
                      color: '#fbbf24',
                    } : {
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: '#64748b',
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Visual dots indicator */}
        <div className="flex items-center justify-center gap-2 mb-5 min-h-[32px]">
          {selected === 0 && guestCount === 0 ? (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <IconLock size={13} style={{ color: '#334155' }} />
              <p className="text-sm font-medium" style={{ color: '#334155' }}>No meals</p>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap justify-center">
              {/* Regular meal dots (emerald) */}
              {Array.from({ length: Math.ceil(selected) }).map((_, i) => {
                const isHalf = i === Math.floor(selected) && selected % 1 !== 0;
                const dotColor = isHalf ? 'rgba(16,185,129,0.35)' : '#10b981';
                return (
                  <div
                    key={`reg-${i}`}
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200"
                    title="Regular meal"
                    style={{
                      background: dotColor,
                      boxShadow: `0 0 12px ${dotColor}80`,
                      border: `1px solid ${dotColor}`,
                    }}
                  >
                    <IconMeal size={14} style={{ color: isHalf ? '#10b981' : '#022c22' }} />
                  </div>
                );
              })}
              {/* Guest meal dots (amber) */}
              {Array.from({ length: Math.ceil(guestCount) }).map((_, i) => {
                const isHalf = i === Math.floor(guestCount) && guestCount % 1 !== 0;
                const dotColor = isHalf ? 'rgba(245,158,11,0.35)' : '#f59e0b';
                return (
                  <div
                    key={`guest-${i}`}
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200"
                    title="Guest meal"
                    style={{
                      background: dotColor,
                      boxShadow: `0 0 12px ${dotColor}80`,
                      border: `1px solid ${dotColor}`,
                    }}
                  >
                    <Users size={12} style={{ color: isHalf ? '#f59e0b' : '#451a03' }} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Split ratio bar (only when guest > 0) */}
        {guestCount > 0 && selected > 0 && (
          <div className="mb-4">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-semibold" style={{ color: '#10b981' }}>
                My {selected}
              </span>
              <span className="text-[10px] font-medium" style={{ color: '#475569' }}>portion split</span>
              <span className="text-[10px] font-semibold" style={{ color: '#f59e0b' }}>
                Guest {guestCount}
              </span>
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${regularRatio * 100}%`,
                  background: 'linear-gradient(90deg, #10b981, #059669)',
                  boxShadow: '0 0 6px rgba(16,185,129,0.5)',
                }}
              />
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden mt-1" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${guestRatio * 100}%`,
                  background: 'linear-gradient(90deg, #f59e0b, #d97706)',
                  boxShadow: '0 0 6px rgba(245,158,11,0.5)',
                }}
              />
            </div>
          </div>
        )}

        {/* Save button */}
        <button
          id="meal-save-btn"
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200 active:scale-95 disabled:opacity-50"
          style={{
            background: guestCount > 0
              ? 'linear-gradient(135deg, #10b981, #d97706)'
              : 'linear-gradient(135deg, #10b981, #059669)',
            boxShadow: guestCount > 0
              ? '0 4px 16px rgba(16,185,129,0.3), 0 4px 16px rgba(245,158,11,0.2)'
              : '0 4px 16px rgba(16,185,129,0.4)',
            color: '#022c22',
          }}
        >
          {saving ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <IconMeal size={15} />
              Save {selected} meal{selected !== 1 ? 's' : ''}
              {guestCount > 0 && ` + ${guestCount} guest`}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
