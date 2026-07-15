'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { LogIn, Eye, EyeOff, ArrowLeft, KeyRound, CheckCircle, AlertTriangle } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const slot = parseInt(searchParams.get('slot') ?? '1');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  // Password reset states
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetStatus, setResetStatus] = useState<'none' | 'pending' | 'approved' | 'completed' | 'denied'>('none');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [checkingStatus, setCheckingStatus] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      if (!data.user) throw new Error('Login failed');

      // Fetch profile to check status
      const { data: profile, error: profileError } = await (supabase as any)
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileError || !profile) {
        await supabase.auth.signOut();
        throw new Error('Profile not found');
      }

      // Verify they are logging into the correct slot
      if (profile.slot !== slot) {
        await supabase.auth.signOut();
        toast.error('This account does not belong to this slot.');
        return;
      }

      if (profile.status === 'pending') {
        await supabase.auth.signOut();
        toast.warning('Your account is still awaiting admin approval.');
        router.push('/');
        return;
      }

      if (profile.status === 'denied') {
        await supabase.auth.signOut();
        toast.error('Your account has been denied. Contact your admin.');
        router.push('/');
        return;
      }

      toast.success(`Welcome back, ${profile.username}! 👋`);
      setTimeout(() => {
        router.push('/dashboard'); // User tile always goes to dashboard
      }, 500);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) {
      toast.error('Please enter your email.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request', email: resetEmail, slot }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to request reset');
      
      toast.success(data.message || 'Request submitted.');
      if (data.status === 'approved') {
        setResetStatus('approved');
      } else {
        setResetStatus('pending');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckStatus = async () => {
    if (!resetEmail) {
      toast.error('Please enter your email.');
      return;
    }
    setCheckingStatus(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status', email: resetEmail, slot }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to check status');
      
      setResetStatus(data.status);
      if (data.status === 'pending') {
        toast.info('Your request is still pending admin approval.');
      } else if (data.status === 'approved') {
        toast.success('Your request has been approved! You can now set your new password.');
      } else if (data.status === 'completed') {
        toast.success('This request has already been completed.');
      } else if (data.status === 'denied') {
        toast.error('Your request was denied. You can submit a new request.');
      } else {
        toast.error('No reset request found for this email.');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm',
          email: resetEmail,
          slot,
          password: newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset password');
      
      toast.success(data.message || 'Password changed successfully!');
      setIsResetMode(false);
      setResetStatus('none');
      setResetEmail('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (isResetMode) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center px-4">
        <div className="w-full max-w-sm animate-slide-up">
          <button
            onClick={() => {
              setIsResetMode(false);
              setResetStatus('none');
            }}
            className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors"
            id="reset-back-btn"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to login
          </button>

          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8">
            <div className="flex items-center gap-3 mb-7">
              <div className="w-11 h-11 rounded-xl bg-primary/80 flex items-center justify-center">
                <KeyRound className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-white font-bold text-xl">Reset Password</h1>
                <p className="text-slate-400 text-sm">User {slot} · Request or set password</p>
              </div>
            </div>

            {resetStatus === 'approved' ? (
              <form onSubmit={handleConfirmReset} className="space-y-4">
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs px-3 py-2.5 rounded-xl flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  Request approved! Set your new password.
                </div>

                <div>
                  <label className="text-slate-300 text-sm font-medium block mb-1.5" htmlFor="new-password">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      id="new-password"
                      type={showPw ? 'text' : 'password'}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Min. 6 characters"
                      className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 pr-11 text-white placeholder-slate-500
                                 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                    >
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-slate-300 text-sm font-medium block mb-1.5" htmlFor="confirm-new-password">
                    Confirm Password
                  </label>
                  <input
                    id="confirm-new-password"
                    type={showPw ? 'text' : 'password'}
                    value={confirmNewPassword}
                    onChange={e => setConfirmNewPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500
                               focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
                    required
                  />
                </div>

                <button
                  id="reset-confirm-btn"
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary hover:bg-primary-dark text-white font-semibold rounded-xl py-3.5 
                             transition-all duration-200 disabled:opacity-60 active:scale-95 mt-2"
                >
                  {loading ? 'Updating...' : 'Set New Password'}
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                {resetStatus === 'pending' && (
                  <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs px-3 py-2.5 rounded-xl flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    Request is pending admin approval.
                  </div>
                )}
                {resetStatus === 'denied' && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3 py-2.5 rounded-xl flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    Request was denied. You can request again.
                  </div>
                )}
                {resetStatus === 'completed' && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs px-3 py-2.5 rounded-xl flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    Password has been reset! You can now log in.
                  </div>
                )}

                <div>
                  <label className="text-slate-300 text-sm font-medium block mb-1.5" htmlFor="reset-email">
                    Email Address
                  </label>
                  <input
                    id="reset-email"
                    type="email"
                    value={resetEmail}
                    onChange={e => setResetEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500
                               focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
                    required
                  />
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <button
                    id="reset-request-btn"
                    onClick={handleRequestReset}
                    disabled={loading}
                    className="w-full bg-primary hover:bg-primary-dark text-white font-semibold rounded-xl py-3 
                               transition-all duration-200 disabled:opacity-60 active:scale-95 text-sm"
                  >
                    {loading ? 'Submitting...' : 'Request Password Reset'}
                  </button>

                  <button
                    id="reset-check-btn"
                    onClick={handleCheckStatus}
                    disabled={checkingStatus}
                    className="w-full bg-white/10 border border-white/10 hover:bg-white/15 text-white font-semibold rounded-xl py-3
                               transition-all duration-200 disabled:opacity-60 active:scale-95 text-sm"
                  >
                    {checkingStatus ? 'Checking Status...' : 'Check Approval Status'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm animate-slide-up">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors"
          id="login-back-btn"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </button>

        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8">
          <div className="flex items-center gap-3 mb-7">
            <div className="w-11 h-11 rounded-xl bg-primary/80 flex items-center justify-center">
              <LogIn className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-xl">Welcome back</h1>
              <p className="text-slate-400 text-sm">User {slot} · Enter your password</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-slate-300 text-sm font-medium block mb-1.5" htmlFor="login-email">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500
                           focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
                required
              />
            </div>

            <div>
              <label className="text-slate-300 text-sm font-medium block mb-1.5" htmlFor="login-password">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Your password"
                  className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 pr-11 text-white placeholder-slate-500
                             focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setIsResetMode(true)}
                className="text-primary hover:text-purple-400 text-xs font-semibold transition-colors"
                id="login-forgot-btn"
              >
                Forgot or change password?
              </button>
            </div>

            <button
              id="login-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary-dark text-white font-semibold rounded-xl py-3.5 
                         transition-all duration-200 disabled:opacity-60 active:scale-95 mt-2"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-900" />}>
      <LoginForm />
    </Suspense>
  );
}
