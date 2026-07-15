'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Profile } from '@/lib/types';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, Clock, Users, KeyRound } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { PasswordReset } from '@/lib/types';

interface PasswordResetWithProfile extends PasswordReset {
  profile: Profile;
}

export default function ApprovalsPage() {
  const [pending, setPending] = useState<Profile[]>([]);
  const [active, setActive] = useState<Profile[]>([]);
  const [resets, setResets] = useState<PasswordResetWithProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProfiles = async () => {
    const { data } = await (supabase as any).from('profiles').select('*').order('created_at') as { data: Profile[] | null };
    setPending((data ?? []).filter(p => p.status === 'pending'));
    setActive((data ?? []).filter(p => p.status === 'active'));

    const { data: resetsData } = await (supabase as any)
      .from('password_resets')
      .select('*, profile:profiles(*)')
      .eq('status', 'pending')
      .order('created_at') as { data: PasswordResetWithProfile[] | null };
    setResets(resetsData ?? []);

    setLoading(false);
  };

  const handleApproveReset = async (requestId: string, username: string) => {
    const { error } = await (supabase as any)
      .from('password_resets')
      .update({ status: 'approved' })
      .eq('id', requestId);
    if (error) {
      toast.error('Failed to approve password reset');
    } else {
      toast.success(`Password reset for ${username} approved!`);
      fetchProfiles();
    }
  };

  const handleDenyReset = async (requestId: string, username: string) => {
    if (!confirm(`Deny password reset for ${username}?`)) return;
    const { error } = await (supabase as any)
      .from('password_resets')
      .update({ status: 'denied' })
      .eq('id', requestId);
    if (error) {
      toast.error('Failed to deny password reset');
    } else {
      toast.success(`Password reset for ${username} denied.`);
      fetchProfiles();
    }
  };

  useEffect(() => { fetchProfiles(); }, []);

  const handleApprove = async (userId: string, username: string) => {
    const { error } = await (supabase as any)
      .from('profiles')
      .update({ status: 'active' })
      .eq('id', userId);
    if (error) toast.error('Failed to approve');
    else {
      toast.success(`${username} approved!`);
      fetchProfiles();
    }
  };

  const handleDeny = async (userId: string, username: string) => {
    if (!confirm(`Deny ${username}? They will be unable to log in.`)) return;
    const { error } = await (supabase as any)
      .from('profiles')
      .update({ status: 'denied' })
      .eq('id', userId);
    if (error) toast.error('Failed to deny');
    else {
      toast.success(`${username} denied.`);
      fetchProfiles();
    }
  };

  const handleRevoke = async (userId: string, username: string) => {
    if (!confirm(`Revoke ${username}'s access? They will be set to pending.`)) return;
    const { error } = await (supabase as any)
      .from('profiles')
      .update({ status: 'pending' })
      .eq('id', userId);
    if (error) toast.error('Failed to revoke');
    else {
      toast.success(`${username}'s access revoked.`);
      fetchProfiles();
    }
  };

  return (
    <div className="p-4 md:p-6 pb-28 md:pb-8 animate-fade-in max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">User Approvals</h1>
        <p className="text-text-muted text-sm">Manage who has access to the flat tracker</p>
      </div>

      {/* Pending */}
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-pending" />
          <h2 className="font-semibold text-text-primary">
            Pending Approval
            {pending.length > 0 && (
              <span className="ml-2 bg-pending text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {pending.length}
              </span>
            )}
          </h2>
        </div>

        {loading ? (
          <div className="skeleton h-24 rounded-2xl" />
        ) : pending.length === 0 ? (
          <div className="card text-center py-8 text-text-muted">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-active opacity-40" />
            <p className="font-medium">No pending approvals</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map(p => (
              <div key={p.id} className="card border border-pending/30 bg-pending-light">
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: p.avatar_color }}
                  >
                    {p.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-text-primary">{p.username}</p>
                    <p className="text-text-muted text-xs">
                      Slot {p.slot} · Signed up {format(parseISO(p.created_at), 'MMM d, h:mm a')}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    id={`approve-${p.id}`}
                    onClick={() => handleApprove(p.id, p.username)}
                    className="flex-1 flex items-center justify-center gap-2 bg-active text-white font-semibold rounded-xl py-2.5 text-sm transition-all hover:bg-emerald-700 active:scale-95"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Approve
                  </button>
                   <button
                    id={`deny-${p.id}`}
                    onClick={() => handleDeny(p.id, p.username)}
                    className="flex-1 flex items-center justify-center gap-2 font-semibold rounded-xl py-2.5 text-sm transition-all active:scale-95"
                    style={{
                      background: 'rgba(244,63,94,0.1)',
                      border: '1px solid rgba(244,63,94,0.3)',
                      color: '#f43f5e',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLButtonElement).style.background = 'rgba(244,63,94,0.2)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLButtonElement).style.background = 'rgba(244,63,94,0.1)';
                    }}
                  >
                    <XCircle className="w-4 h-4" />
                    Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Password Reset Requests */}
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <KeyRound className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-text-primary">
            Password Reset Requests
            {resets.length > 0 && (
              <span className="ml-2 bg-primary text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {resets.length}
              </span>
            )}
          </h2>
        </div>

        {loading ? (
          <div className="skeleton h-24 rounded-2xl animate-pulse" />
        ) : resets.length === 0 ? (
          <div className="card text-center py-8 text-text-muted">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-active opacity-40" />
            <p className="font-medium">No pending reset requests</p>
          </div>
        ) : (
          <div className="space-y-3">
            {resets.map(r => {
              const profile = r.profile;
              if (!profile) return null;
              return (
                <div key={r.id} className="card border border-primary/30 bg-primary/5">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: profile.avatar_color }}
                    >
                      {profile.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-text-primary">{profile.username}</p>
                      <p className="text-text-muted text-xs">
                        Slot {profile.slot} · Requested {format(parseISO(r.created_at), 'MMM d, h:mm a')}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      id={`approve-reset-${r.id}`}
                      onClick={() => handleApproveReset(r.id, profile.username)}
                      className="flex-1 flex items-center justify-center gap-2 bg-active text-white font-semibold rounded-xl py-2.5 text-sm transition-all hover:bg-emerald-700 active:scale-95"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Approve
                    </button>
                    <button
                      id={`deny-reset-${r.id}`}
                      onClick={() => handleDenyReset(r.id, profile.username)}
                      className="flex-1 flex items-center justify-center gap-2 font-semibold rounded-xl py-2.5 text-sm transition-all active:scale-95"
                      style={{
                        background: 'rgba(244,63,94,0.1)',
                        border: '1px solid rgba(244,63,94,0.3)',
                        color: '#f43f5e',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(244,63,94,0.2)';
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(244,63,94,0.1)';
                      }}
                    >
                      <XCircle className="w-4 h-4" />
                      Deny
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Active users */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-active" />
          <h2 className="font-semibold text-text-primary">Active Users</h2>
        </div>
        <div className="space-y-2">
          {active.map(p => (
            <div key={p.id} className="card flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: p.avatar_color }}
              >
                {p.username.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="font-medium text-text-primary text-sm">{p.username}</p>
                <p className="text-text-muted text-xs">
                  Slot {p.slot} · {p.role === 'admin' ? '👑 Admin' : 'User'}
                </p>
              </div>
              <div className="badge-active">
                <CheckCircle2 className="w-3 h-3" />
                Active
              </div>
              {p.role !== 'admin' && (
                <button
                  id={`revoke-${p.id}`}
                  onClick={() => handleRevoke(p.id, p.username)}
                  className="text-text-muted hover:text-negative transition-colors text-xs font-medium"
                >
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

