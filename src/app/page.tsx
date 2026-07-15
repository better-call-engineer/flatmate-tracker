'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Profile } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import {
  IconShield,
  IconUserPlus,
  IconLock,
  IconCheck,
  IconClock,
  IconHome,
} from '@/components/GeometricIcons';

type SlotData = Profile | null;
type Slots = [SlotData, SlotData, SlotData, SlotData];

export default function LandingPage() {
  const [slots, setSlots] = useState<Slots>([null, null, null, null]);
  const [loading, setLoading] = useState(true);
  const { user, profile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && profile) {
      if (profile.status === 'active') {
        router.replace(profile.role === 'admin' ? '/admin' : '/dashboard');
      }
    }
  }, [user, profile, router]);

  useEffect(() => {
    fetchSlots();
    const channel = supabase
      .channel('profiles-landing')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchSlots())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchSlots = async () => {
    const { data } = await (supabase as any)
      .from('profiles')
      .select('*')
      .order('slot', { ascending: true }) as { data: Profile[] | null };

    const newSlots: Slots = [null, null, null, null];
    data?.forEach(profile => {
      if (profile.slot >= 1 && profile.slot <= 4) {
        newSlots[profile.slot - 1] = profile;
      }
    });
    setSlots(newSlots);
    setLoading(false);
  };

  const handleSlotClick = (slotNumber: number, slotData: SlotData) => {
    if (!slotData) {
      router.push(`/auth/signup?slot=${slotNumber}`);
    } else if (slotData.status === 'active') {
      router.push(`/auth/login?slot=${slotNumber}`);
    }
  };

  return (
    <main className="min-h-screen grid-bg flex flex-col items-center justify-center px-4 py-10 relative overflow-hidden">
      {/* Ambient glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)', filter: 'blur(40px)' }} />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)', filter: 'blur(40px)' }} />
      <div className="absolute top-1/2 left-0 w-48 h-48 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)', filter: 'blur(40px)' }} />

      {/* Header */}
      <div className="text-center mb-10 animate-fade-in relative z-10">
        {/* Logo mark */}
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
                boxShadow: '0 0 32px rgba(124,58,237,0.5), 0 4px 16px rgba(0,0,0,0.4)',
              }}>
              <IconHome size={26} className="text-white" />
            </div>
            {/* Decorative corner squares */}
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-cyan-400 rounded-sm opacity-80" />
            <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-violet-400 rounded-sm opacity-60" />
          </div>
          <div className="text-left">
            <h1 className="text-3xl font-bold text-white tracking-tight leading-none">
              FlatMate
            </h1>
            <p className="text-xs font-medium tracking-widest uppercase mt-0.5"
              style={{ color: 'rgba(124,58,237,0.9)', letterSpacing: '0.2em' }}>
              Tracker
            </p>
          </div>
        </div>
        <p className="text-sm font-medium" style={{ color: '#64748b' }}>
          Shared expenses &amp; meal tracker — select your profile to begin
        </p>
      </div>

      {/* Bento grid — 2×2 user tiles */}
      <div className="grid grid-cols-2 gap-3 w-full max-w-sm relative z-10 animate-slide-up">
        {[1, 2, 3, 4].map((slotNum) => (
          <UserTile
            key={slotNum}
            slotNumber={slotNum}
            slotData={slots[slotNum - 1]}
            loading={loading}
            onClick={() => handleSlotClick(slotNum, slots[slotNum - 1])}
          />
        ))}
      </div>

      {/* Admin tile — full-width below */}
      <div className="w-full max-w-sm mt-3 relative z-10" style={{ animationDelay: '0.1s' }}>
        <button
          id="admin-panel-tile"
          onClick={() => router.push('/auth/admin')}
          className="w-full flex items-center gap-4 rounded-2xl px-5 py-4 transition-all duration-200 group"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(6,182,212,0.35)';
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(6,182,212,0.05)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.07)';
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.03)';
          }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 icon-container-cyan">
            <IconShield size={18} />
          </div>
          <div className="text-left flex-1">
            <p className="text-white font-semibold text-sm">Admin Panel</p>
            <p className="text-xs" style={{ color: '#475569' }}>Manage users &amp; month</p>
          </div>
          <IconLock size={14} style={{ color: '#334155' }} />
        </button>
      </div>

      {/* Footer */}
      <div className="relative z-10 mt-10 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse-soft" />
        <p className="text-xs font-medium" style={{ color: '#334155' }}>
          FlatMate Tracker · 4 persons · BDT
        </p>
      </div>
    </main>
  );
}

// ─── User Tile ──────────────────────────────────────────────────────────────
function UserTile({
  slotNumber,
  slotData,
  loading,
  onClick,
}: {
  slotNumber: number;
  slotData: SlotData;
  loading: boolean;
  onClick: () => void;
}) {
  if (loading) {
    return <div className="aspect-square rounded-2xl skeleton" />;
  }

  if (!slotData) {
    return (
      <button
        id={`slot-${slotNumber}-empty`}
        onClick={onClick}
        className="aspect-square rounded-2xl flex flex-col items-center justify-center gap-2.5 transition-all duration-200 group"
        style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1.5px dashed rgba(255,255,255,0.1)',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(124,58,237,0.4)';
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(124,58,237,0.05)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.1)';
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.02)';
        }}
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200"
          style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)', color: '#7c3aed' }}>
          <IconUserPlus size={18} />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold" style={{ color: '#94a3b8' }}>Slot {slotNumber}</p>
          <p className="text-xs mt-0.5" style={{ color: '#475569' }}>+ Register</p>
        </div>
      </button>
    );
  }

  if (slotData.status === 'pending') {
    return (
      <div
        id={`slot-${slotNumber}-pending`}
        className="aspect-square rounded-2xl flex flex-col items-center justify-center gap-2.5 cursor-default relative overflow-hidden"
        style={{
          background: 'rgba(245,158,11,0.06)',
          border: '1px solid rgba(245,158,11,0.2)',
        }}
      >
        <div className="absolute inset-0 animate-pulse-soft"
          style={{ background: 'radial-gradient(circle at center, rgba(245,158,11,0.08) 0%, transparent 70%)' }} />
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg text-white relative z-10"
          style={{
            backgroundColor: slotData.avatar_color,
            boxShadow: `0 0 16px ${slotData.avatar_color}60`,
          }}
        >
          {slotData.username.charAt(0).toUpperCase()}
        </div>
        <p className="text-white font-semibold text-sm truncate max-w-[85%] text-center relative z-10">
          {slotData.username}
        </p>
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full relative z-10"
          style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.25)' }}>
          <IconClock size={11} className="text-amber-400" />
          <span className="text-amber-400 text-[10px] font-semibold">Pending</span>
        </div>
      </div>
    );
  }

  if (slotData.status === 'active') {
    return (
      <button
        id={`slot-${slotNumber}-active`}
        onClick={onClick}
        className="aspect-square rounded-2xl flex flex-col items-center justify-center gap-2.5 transition-all duration-200 group hover:scale-[1.02] active:scale-[0.97] relative overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(16,185,129,0.35)';
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(16,185,129,0.04)';
          (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 24px rgba(16,185,129,0.12)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.08)';
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.03)';
          (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
        }}
      >
        {/* Glow orb in top-right */}
        <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full opacity-20 pointer-events-none"
          style={{ background: `radial-gradient(circle, ${slotData.avatar_color} 0%, transparent 70%)` }} />

        <div
          className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-xl text-white transition-transform duration-200 group-hover:scale-110 relative z-10"
          style={{
            backgroundColor: slotData.avatar_color,
            boxShadow: `0 0 20px ${slotData.avatar_color}50, 0 4px 12px rgba(0,0,0,0.4)`,
          }}
        >
          {slotData.username.charAt(0).toUpperCase()}
        </div>
        <p className="text-white font-semibold text-sm truncate max-w-[85%] relative z-10">
          {slotData.username}
        </p>
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full relative z-10"
          style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.25)' }}>
          <IconCheck size={11} className="text-emerald-400" />
          <span className="text-emerald-400 text-[10px] font-semibold">Active</span>
        </div>
      </button>
    );
  }

  // Denied
  return (
    <div className="aspect-square rounded-2xl flex flex-col items-center justify-center gap-2.5 opacity-40"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(244,63,94,0.15)' }}>
      <div className="w-10 h-10 rounded-full flex items-center justify-center"
        style={{ background: 'rgba(244,63,94,0.1)', color: '#f43f5e' }}>
        <IconLock size={16} />
      </div>
      <p className="text-xs font-medium" style={{ color: '#64748b' }}>Slot {slotNumber}</p>
      <span className="text-[10px] font-semibold" style={{ color: '#f43f5e' }}>Denied</span>
    </div>
  );
}
