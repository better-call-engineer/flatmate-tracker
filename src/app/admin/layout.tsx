'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, ChevronDown, Calendar } from 'lucide-react';
import { useSelectedMonth } from '@/contexts/MonthContext';
import { getMonthLabel } from '@/lib/finance';
import {
  IconShield,
  IconDashboard,
  IconUsers,
  IconCalendar,
  IconMessage,
  IconLogOut,
  IconSettings,
  IconHome,
} from '@/components/GeometricIcons';

import { Tv, Edit3 } from 'lucide-react';

const adminNav = [
  { href: '/admin',              icon: IconDashboard, label: 'Overview' },
  { href: '/admin/approvals',    icon: IconUsers,     label: 'Approvals' },
  { href: '/admin/overheads',    icon: IconSettings,  label: 'Overheads' },
  { href: '/admin/data-entry',   icon: Edit3,         label: 'Data Entry' },
  { href: '/admin/contacts',     icon: IconUsers,     label: 'Contacts Mgr' },
  { href: '/admin/servers',      icon: Tv,            label: 'Servers Mgr' },
  { href: '/admin/month',        icon: IconCalendar,  label: 'Month Mgr' },
  { href: '/admin/edit-requests',icon: IconMessage,   label: 'Edit Reqs' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, signOut } = useAuth();
  const { selectedMonthId, setSelectedMonthId, months } = useSelectedMonth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && (!user || profile?.role !== 'admin')) router.replace('/');
  }, [user, profile, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080c14' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #0891b2, #06b6d4)', boxShadow: '0 0 24px rgba(6,182,212,0.5)' }}>
            <IconShield size={20} className="text-white" />
          </div>
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#06b6d4' }} />
        </div>
      </div>
    );
  }

  if (!user || profile?.role !== 'admin') return null;

  return (
    <div className="min-h-screen pb-20 md:pb-0 md:pl-60" style={{ background: '#080c14' }}>

      {/* ── Desktop Sidebar ─────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 h-full w-60 z-40 px-3 py-5"
        style={{
          background: '#0a0f1a',
          borderRight: '1px solid rgba(255,255,255,0.06)',
        }}>

        {/* Logo — cyan for admin */}
        <div className="flex items-center gap-3 px-2 mb-8">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #0891b2, #06b6d4)',
              boxShadow: '0 0 16px rgba(6,182,212,0.4)',
            }}>
            <IconShield size={17} className="text-white" />
          </div>
          <div>
            <span className="font-bold text-base tracking-tight" style={{ color: '#f1f5f9' }}>FlatMate</span>
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#06b6d4' }}>Admin</p>
          </div>
        </div>

        {/* Admin user info */}
        <div className="flex items-center gap-3 px-3 py-3 rounded-xl mb-6"
          style={{ background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.15)' }}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
            style={{
              backgroundColor: profile?.avatar_color,
              boxShadow: `0 0 12px ${profile?.avatar_color}60`,
            }}>
            {profile?.username.charAt(0).toUpperCase()}
          </div>
          <div className="overflow-hidden flex-1 min-w-0">
            <p className="font-semibold text-sm truncate" style={{ color: '#f1f5f9' }}>{profile?.username}</p>
            <p className="text-xs font-semibold" style={{ color: '#06b6d4' }}>Administrator</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="space-y-1 flex-1">
          {adminNav.map(({ href, icon: Icon, label }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
                style={isActive ? {
                  background: 'rgba(6,182,212,0.15)',
                  color: '#67e8f9',
                  border: '1px solid rgba(6,182,212,0.25)',
                  boxShadow: '0 0 12px rgba(6,182,212,0.12)',
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
                <Icon size={15} />
                {label}
              </Link>
            );
          })}
        </nav>


        {/* Back to dashboard link */}
        <Link href="/dashboard"
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium mb-2 transition-all duration-200"
          style={{ color: '#334155' }}
          onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.color = '#64748b'}
          onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.color = '#334155'}>
          <IconHome size={13} />
          User Dashboard
        </Link>

        {/* Sign out */}
        <button
          onClick={signOut}
          id="admin-signout-btn"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around px-1 py-2"
        style={{
          background: 'rgba(10,15,26,0.92)',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}>
        {adminNav.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all"
              style={{ color: isActive ? '#67e8f9' : '#475569' }}
            >
              <Icon size={18} />
              <span className="text-[9px] font-medium leading-tight text-center">{label}</span>
            </Link>
          );
        })}
        <button
          onClick={signOut}
          className="flex flex-col items-center gap-1 px-3 py-1.5"
          style={{ color: '#475569' }}
          onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = '#f43f5e'}
          onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = '#475569'}
        >
          <IconLogOut size={18} />
          <span className="text-[9px] font-medium">Logout</span>
        </button>
      </nav>
    </div>
  );
}
