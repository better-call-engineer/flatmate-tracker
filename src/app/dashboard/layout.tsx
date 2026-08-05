'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, X, Menu, Plus as LucidePlus, Calculator as CalculatorIcon } from 'lucide-react';
import { useSelectedMonth } from '@/contexts/MonthContext';
import {
  IconHome,
  IconDashboard,
  IconCard,
  IconChart,
  IconLogOut,
  IconUsers,
  IconActivity,
} from '@/components/GeometricIcons';
import { Tv } from 'lucide-react';
import Calculator from '@/components/Calculator';
import ExpenseForm from '@/components/ExpenseForm';

const navItems = [
  { href: '/dashboard',          icon: IconDashboard, label: 'Dashboard' },
  { href: '/dashboard/expenses', icon: IconCard,      label: 'Expenses' },
  { href: '/dashboard/reports',  icon: IconChart,     label: 'Reports' },
  { href: '/dashboard/activity', icon: IconActivity,  label: 'Activity' },
  { href: '/dashboard/contacts', icon: IconUsers,     label: 'Contacts' },
  { href: '/dashboard/servers',  icon: Tv,            label: 'Server & TV' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, signOut } = useAuth();
  const { selectedMonthId, months, loadingMonths } = useSelectedMonth();
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);

  const currentMonth = months.find(m => m.id === selectedMonthId);
  const isLocked = currentMonth?.is_closed ?? false;

  useEffect(() => {
    if (!loading && !user) router.replace('/');
    else if (!loading && profile && profile.status !== 'active') router.replace('/');
  }, [user, profile, loading, router]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  if (loading || loadingMonths) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: '#080c14' }}>
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

  const NavLink = ({ href, icon: Icon, label }: { href: string; icon: any; label: string }) => {
    const isActive = pathname === href;
    return (
      <Link
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
  };

  const isDashboardPage = pathname === '/dashboard';

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#080c14' }}>

      {/* ── Desktop Sidebar ─────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-60 flex-shrink-0 h-full z-40 px-3 py-5"
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
          {navItems.map(({ href, icon, label }) => (
            <NavLink key={href} href={href} icon={icon} label={label} />
          ))}
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
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.color = '#475569';
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          }}
        >
          <IconLogOut size={16} />
          Sign Out
        </button>
      </aside>

      {/* ── Main content ───────────────────────────────────────── */}
      <main className="flex-1 min-w-0 h-full flex flex-col overflow-hidden">
        
        {/* Mobile Header Bar — sticky top with backdrop blur */}
        <div className="md:hidden flex-shrink-0 flex items-center justify-between px-4 py-2.5 z-40"
          style={{ background: 'rgba(8,12,20,0.85)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {/* Left: Hamburger menu button */}
          <button
            id="hamburger-btn-mobile"
            onClick={() => setDrawerOpen(true)}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150 active:scale-90"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#cbd5e1',
            }}
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>

          {/* Center: Logo */}
          <span className="font-bold text-sm tracking-tight" style={{ color: '#f1f5f9' }}>FlatMate</span>

          <div className="w-9" />
        </div>

        {/* Inner page content */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {children}
        </div>
      </main>

      {/* ── Desktop Floating circular action buttons (only shown on Dashboard page) ─── */}
      {isDashboardPage && (
        <div className="hidden md:flex fixed top-[86px] md:top-[90px] right-8 md:right-12 z-50 items-center gap-2.5">
          {/* + Add Expense — purple circle */}
          {!isLocked && (
            <button
              id="add-expense-fab"
              onClick={() => setShowAddExpense(true)}
              className="w-10 h-10 rounded-full flex items-center justify-center text-white transition-all duration-200 active:scale-90"
              style={{
                background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
                boxShadow: '0 0 20px rgba(124,58,237,0.65), 0 4px 14px rgba(124,58,237,0.45)',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.1)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 32px rgba(124,58,237,0.85), 0 4px 20px rgba(124,58,237,0.65)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 20px rgba(124,58,237,0.65), 0 4px 14px rgba(124,58,237,0.45)';
              }}
              aria-label="Add Expense"
            >
              <LucidePlus size={18} strokeWidth={2.5} />
            </button>
          )}

          {/* Calculator — teal circle */}
          <button
            id="calculator-fab"
            onClick={() => setShowCalculator(true)}
            className="w-10 h-10 rounded-full flex items-center justify-center text-white transition-all duration-200 active:scale-90"
            style={{
              background: 'linear-gradient(135deg, #0ea5e9 0%, #0891b2 100%)',
              boxShadow: '0 0 20px rgba(14,165,233,0.6), 0 4px 14px rgba(14,165,233,0.4)',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.1)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 32px rgba(14,165,233,0.8), 0 4px 20px rgba(14,165,233,0.6)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 20px rgba(14,165,233,0.6), 0 4px 14px rgba(14,165,233,0.4)';
            }}
            aria-label="Calculator"
          >
            <CalculatorIcon size={17} strokeWidth={1.8} />
          </button>
        </div>
      )}

      {/* ── Mobile Hamburger Drawer ───────────────────────────── */}
      {drawerOpen && (
        <>
          <div
            className="drawer-overlay fixed inset-0 z-50 md:hidden"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
            onClick={() => setDrawerOpen(false)}
          />
          <div
            className="drawer-panel fixed left-0 top-0 h-full w-72 z-50 flex flex-col px-4 py-5 md:hidden"
            style={{
              background: '#0a0f1a',
              borderRight: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '4px 0 40px rgba(0,0,0,0.8)',
            }}
          >
            <div className="flex items-center justify-between mb-6">
              <Link href="/dashboard" className="flex items-center gap-2.5" onClick={() => setDrawerOpen(false)}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', boxShadow: '0 0 14px rgba(124,58,237,0.5)' }}>
                  <IconHome size={15} className="text-white" />
                </div>
                <span className="font-bold text-base" style={{ color: '#f1f5f9' }}>FlatMate</span>
              </Link>
              <button
                onClick={() => setDrawerOpen(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b' }}
                aria-label="Close menu"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex items-center gap-3 px-3 py-3 rounded-xl mb-5"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                style={{ backgroundColor: profile.avatar_color, boxShadow: `0 0 12px ${profile.avatar_color}60` }}>
                {profile.username.charAt(0).toUpperCase()}
              </div>
              <div className="overflow-hidden flex-1 min-w-0">
                <p className="font-semibold text-sm truncate" style={{ color: '#f1f5f9' }}>{profile.username}</p>
                <p className="text-xs" style={{ color: '#475569' }}>Slot {profile.slot}</p>
              </div>
            </div>

            <nav className="space-y-1 flex-1">
              {navItems.map(({ href, icon: Icon, label }) => {
                const isActive = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200"
                    style={isActive ? {
                      background: 'rgba(124,58,237,0.18)',
                      color: '#a78bfa',
                      border: '1px solid rgba(124,58,237,0.28)',
                    } : {
                      color: '#64748b',
                      border: '1px solid transparent',
                    }}
                  >
                    <Icon size={17} />
                    {label}
                  </Link>
                );
              })}
            </nav>

            <div className="h-px my-3" style={{ background: 'rgba(255,255,255,0.06)' }} />

            <button
              onClick={() => { signOut(); setDrawerOpen(false); }}
              className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium w-full transition-all duration-200"
              style={{ color: '#f43f5e', border: '1px solid rgba(244,63,94,0.15)', background: 'rgba(244,63,94,0.06)' }}
            >
              <IconLogOut size={17} />
              Sign Out
            </button>
          </div>
        </>
      )}

      {/* ── Global modals ─────────────────────────────────────── */}
      {showCalculator && (
        <Calculator onClose={() => setShowCalculator(false)} />
      )}
      {showAddExpense && currentMonth && (
        <ExpenseForm
          monthId={currentMonth.id}
          onClose={() => setShowAddExpense(false)}
          onSaved={() => setShowAddExpense(false)}
        />
      )}
    </div>
  );
}
