'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, ChevronDown, Calendar } from 'lucide-react';
import { useSelectedMonth } from '@/contexts/MonthContext';
import { getMonthLabel } from '@/lib/finance';
import {
  IconHome,
  IconDashboard,
  IconCard,
  IconChart,
  IconLogOut,
  IconUsers,
} from '@/components/GeometricIcons';

import { Tv } from 'lucide-react';

const navItems = [
  { href: '/dashboard',          icon: IconDashboard, label: 'Dashboard' },
  { href: '/dashboard/expenses', icon: IconCard,      label: 'Expenses' },
  { href: '/dashboard/reports',  icon: IconChart,     label: 'Reports' },
  { href: '/dashboard/contacts', icon: IconUsers,     label: 'Contacts' },
  { href: '/dashboard/servers',  icon: Tv,            label: 'Server & TV' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, signOut } = useAuth();
  const { selectedMonthId, setSelectedMonthId, months } = useSelectedMonth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace('/');
    else if (!loading && profile && profile.status !== 'active') router.replace('/');
  }, [user, profile, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080c14' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', boxShadow: '0 0 24px rgba(124,58,237,0.5)' }}>
            <IconHome size={20} className="text-white" />
          </div>
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#7c3aed' }} />
        </div>
      </div>
    );
  }

  if (!user || !profile || profile.status !== 'active') return null;

  return (
    <div className="min-h-screen pb-20 md:pb-0 md:pl-60" style={{ background: '#080c14' }}>

      {/* ── Desktop Sidebar ─────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 h-full w-60 z-40 px-3 py-5"
        style={{
          background: '#0a0f1a',
          borderRight: '1px solid rgba(255,255,255,0.06)',
        }}>

        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-3 px-2 mb-8 group">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 group-hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
              boxShadow: '0 0 16px rgba(124,58,237,0.4)',
            }}>
            <IconHome size={17} className="text-white" />
          </div>
          <div>
            <span className="font-bold text-base tracking-tight" style={{ color: '#f1f5f9' }}>FlatMate</span>
            <div className="flex items-center gap-1 mt-0.5">
              <div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse-soft" />
              <span className="text-[10px] font-medium" style={{ color: '#10b981' }}>Live</span>
            </div>
          </div>
        </Link>

        {/* User info */}
        <div className="flex items-center gap-3 px-3 py-3 rounded-xl mb-6"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
            style={{
              backgroundColor: profile.avatar_color,
              boxShadow: `0 0 12px ${profile.avatar_color}60`,
            }}>
            {profile.username.charAt(0).toUpperCase()}
          </div>
          <div className="overflow-hidden flex-1 min-w-0">
            <p className="font-semibold text-sm truncate" style={{ color: '#f1f5f9' }}>{profile.username}</p>
            <p className="text-xs" style={{ color: '#475569' }}>Slot {profile.slot}</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="space-y-1 flex-1">
          {navItems.map(({ href, icon: Icon, label }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
                style={isActive ? {
                  background: 'rgba(124,58,237,0.18)',
                  color: '#a78bfa',
                  border: '1px solid rgba(124,58,237,0.28)',
                  boxShadow: '0 0 12px rgba(124,58,237,0.15)',
                } : {
                  color: '#64748b',
                  border: '1px solid transparent',
                }}
                onMouseEnter={e => {
                  if (!isActive) {
                    (e.currentTarget as HTMLAnchorElement).style.color = '#94a3b8';
                    (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.04)';
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    (e.currentTarget as HTMLAnchorElement).style.color = '#64748b';
                    (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
                  }
                }}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </nav>


        {/* Sign out */}
        <button
          onClick={signOut}
          id="dashboard-signout-btn"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 mt-2"
          style={{ color: '#475569', border: '1px solid transparent' }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.color = '#f43f5e';
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(244,63,94,0.08)';
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(244,63,94,0.2)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.color = '#475569';
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent';
          }}
        >
          <IconLogOut size={16} />
          Sign Out
        </button>
      </aside>

      {/* ── Main content ─────────────────────────────────────────── */}
      <main className="min-h-screen">

        {children}
      </main>

      {/* ── Mobile Bottom Nav ────────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around px-2 py-2"
        style={{
          background: 'rgba(10,15,26,0.92)',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}>
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl transition-all duration-150"
              style={{ color: isActive ? '#a78bfa' : '#475569' }}
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
        <button
          onClick={signOut}
          className="flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl transition-all duration-150"
          style={{ color: '#475569' }}
          onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = '#f43f5e'}
          onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = '#475569'}
        >
          <IconLogOut size={20} />
          <span className="text-[10px] font-medium">Logout</span>
        </button>
      </nav>
    </div>
  );
}
