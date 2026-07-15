'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { ShieldCheck, Eye, EyeOff, ArrowLeft } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      const { data: profile } = await (supabase as any)
        .from('profiles')
        .select('*')
        .eq('id', data.user!.id)
        .single();

      if (!profile || profile.role !== 'admin') {
        await supabase.auth.signOut();
        throw new Error('Access denied: Admin credentials required.');
      }

      toast.success('Admin access granted!');
      router.push('/admin');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm animate-slide-up">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors"
          id="admin-login-back-btn"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </button>

        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8">
          <div className="flex items-center gap-3 mb-7">
            <div className="w-11 h-11 rounded-xl bg-indigo-600/50 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <h1 className="text-white font-bold text-xl">Admin Panel</h1>
              <p className="text-slate-400 text-sm">Restricted access</p>
            </div>
          </div>

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="text-slate-300 text-sm font-medium block mb-1.5" htmlFor="admin-email">
                Admin Email
              </label>
              <input
                id="admin-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@example.com"
                className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500
                           focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                required
              />
            </div>

            <div>
              <label className="text-slate-300 text-sm font-medium block mb-1.5" htmlFor="admin-password">
                Password
              </label>
              <div className="relative">
                <input
                  id="admin-password"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Admin password"
                  className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 pr-11 text-white placeholder-slate-500
                             focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
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

            <button
              id="admin-login-submit"
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl py-3.5 
                         transition-all duration-200 disabled:opacity-60 active:scale-95"
            >
              {loading ? 'Verifying...' : 'Access Admin Panel'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
