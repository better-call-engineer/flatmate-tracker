'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { UserPlus, Eye, EyeOff, ArrowLeft } from 'lucide-react';

const AVATAR_COLORS = [
  '#4F46E5', '#059669', '#D97706', '#E11D48',
  '#7C3AED', '#0891B2', '#EA580C', '#16A34A',
];

function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const slot = parseInt(searchParams.get('slot') ?? '1');

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[slot - 1]);
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!username.trim() || username.length < 2) e.username = 'Name must be at least 2 characters';
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) e.email = 'Valid email required';
    if (password.length < 6) e.password = 'Password must be at least 6 characters';
    if (password !== confirmPassword) e.confirmPassword = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);

    try {
      // Check if slot is already taken
      const { data: existingSlot } = await supabase
        .from('profiles')
        .select('id')
        .eq('slot', slot)
        .single();

      if (existingSlot) {
        toast.error('This slot is already taken. Please choose another.');
        setLoading(false);
        return;
      }

      // Check if this will be the first user (auto-admin)
      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });
      const isFirstUser = count === 0;

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // Skip email redirect — works best when "Confirm email" is OFF in Supabase Auth settings
          emailRedirectTo: undefined,
        },
      });

      if (authError) {
        // Give a helpful, actionable message for the rate limit error
        if (authError.message.toLowerCase().includes('rate limit') || authError.status === 429) {
          throw new Error(
            'Supabase email rate limit hit. To fix: go to Supabase Dashboard → Authentication → Providers → Email → turn OFF "Confirm email", then try again.'
          );
        }
        throw authError;
      }
      if (!authData.user) throw new Error('Sign-up failed — please try again.');

      // Create profile
      const { error: profileError } = await (supabase as any).from('profiles').insert({
        id: authData.user.id,
        username: username.trim(),
        slot,
        role: isFirstUser ? 'admin' : 'user',
        status: isFirstUser ? 'active' : 'pending',
        avatar_color: avatarColor,
      });

      if (profileError) throw profileError;

      if (isFirstUser) {
        toast.success(`Welcome, ${username}! You're the Admin — logging in...`);
        setTimeout(() => router.push('/admin'), 1500);
      } else {
        toast.success('Sign-up successful! Awaiting admin approval.');
        setTimeout(() => router.push('/'), 2000);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign-up failed';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md animate-slide-up">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors"
          id="signup-back-btn"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </button>

        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8">
          {/* Header */}
          <div className="flex items-center gap-3 mb-7">
            <div className="w-11 h-11 rounded-xl bg-primary/80 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-xl">Create Account</h1>
              <p className="text-slate-400 text-sm">Joining as User {slot}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Avatar color picker */}
            <div>
              <label className="text-slate-300 text-sm font-medium block mb-2">
                Pick your color
              </label>
              <div className="flex gap-2 flex-wrap">
                {AVATAR_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setAvatarColor(color)}
                    className={`w-8 h-8 rounded-full transition-all duration-150 ${
                      avatarColor === color
                        ? 'ring-2 ring-white ring-offset-2 ring-offset-transparent scale-110'
                        : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: color }}
                    aria-label={`Color ${color}`}
                  />
                ))}
              </div>
            </div>

            {/* Username */}
            <div>
              <label className="text-slate-300 text-sm font-medium block mb-1.5" htmlFor="signup-username">
                Display Name
              </label>
              <input
                id="signup-username"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="e.g. Rahim"
                className={`w-full bg-white/10 border rounded-xl px-4 py-3 text-white placeholder-slate-500 
                           focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all
                           ${errors.username ? 'border-red-500' : 'border-white/10 focus:border-primary/50'}`}
              />
              {errors.username && <p className="text-red-400 text-xs mt-1">{errors.username}</p>}
            </div>

            {/* Email */}
            <div>
              <label className="text-slate-300 text-sm font-medium block mb-1.5" htmlFor="signup-email">
                Email
              </label>
              <input
                id="signup-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={`w-full bg-white/10 border rounded-xl px-4 py-3 text-white placeholder-slate-500
                           focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all
                           ${errors.email ? 'border-red-500' : 'border-white/10 focus:border-primary/50'}`}
              />
              {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="text-slate-300 text-sm font-medium block mb-1.5" htmlFor="signup-password">
                Password
              </label>
              <div className="relative">
                <input
                  id="signup-password"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className={`w-full bg-white/10 border rounded-xl px-4 py-3 text-white placeholder-slate-500 pr-11
                             focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all
                             ${errors.password ? 'border-red-500' : 'border-white/10 focus:border-primary/50'}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password}</p>}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="text-slate-300 text-sm font-medium block mb-1.5" htmlFor="signup-confirm">
                Confirm Password
              </label>
              <input
                id="signup-confirm"
                type={showPw ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className={`w-full bg-white/10 border rounded-xl px-4 py-3 text-white placeholder-slate-500
                           focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all
                           ${errors.confirmPassword ? 'border-red-500' : 'border-white/10 focus:border-primary/50'}`}
              />
              {errors.confirmPassword && <p className="text-red-400 text-xs mt-1">{errors.confirmPassword}</p>}
            </div>

            <button
              id="signup-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary-dark text-white font-semibold rounded-xl py-3.5 
                         transition-all duration-200 disabled:opacity-60 active:scale-95 mt-2"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-900" />}>
      <SignUpForm />
    </Suspense>
  );
}
