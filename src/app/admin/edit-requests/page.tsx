'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { EditRequest, Profile, Month } from '@/lib/types';
import { getMonthLabel } from '@/lib/finance';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { MessageSquare, CheckCircle2, XCircle, Clock } from 'lucide-react';

export default function EditRequestsPage() {
  const [requests, setRequests] = useState<EditRequest[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [months, setMonths] = useState<Month[]>([]);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    const [reqRes, profRes, monthRes] = await Promise.all([
      supabase.from('edit_requests').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*'),
      supabase.from('months').select('*'),
    ]);
    setRequests(reqRes.data ?? []);
    setProfiles(profRes.data ?? []);
    setMonths(monthRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const profileMap = new Map(profiles.map(p => [p.id, p]));
  const monthMap = new Map(months.map(m => [m.id, m]));

  const handleUpdate = async (id: string, status: 'approved' | 'denied') => {
    const { error } = await (supabase as any)
      .from('edit_requests')
      .update({ status, admin_note: adminNotes[id] ?? '' })
      .eq('id', id);
    if (error) toast.error('Failed to update');
    else {
      toast.success(`Request ${status}`);
      fetchAll();
    }
  };

  const pending = requests.filter(r => r.status === 'pending');
  const resolved = requests.filter(r => r.status !== 'pending');

  return (
    <div className="p-4 md:p-6 pb-28 md:pb-8 animate-fade-in max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Edit Requests</h1>
        <p className="text-text-muted text-sm">
          Review user requests to modify locked month data
        </p>
      </div>

      {/* Pending */}
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-pending" />
          <h2 className="font-semibold text-text-primary">
            Pending
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
            <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="font-medium">No pending requests</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pending.map(req => {
              const requester = profileMap.get(req.requested_by);
              const month = monthMap.get(req.month_id);
              return (
                <div key={req.id} className="card border border-pending/30 bg-pending-light">
                  <div className="flex items-start gap-3 mb-3">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ backgroundColor: requester?.avatar_color }}
                    >
                      {requester?.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-text-primary text-sm">{requester?.username}</p>
                      <p className="text-text-muted text-xs">
                        {month ? getMonthLabel(month.label) : ''}
                        {' · '}
                        {format(parseISO(req.created_at), 'MMM d, h:mm a')}
                      </p>
                    </div>
                    <div className="badge-pending ml-auto">
                      <Clock className="w-3 h-3" />
                      Pending
                    </div>
                  </div>

                  <div className="rounded-xl p-3 mb-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p className="text-text-primary text-sm">{req.description}</p>
                  </div>

                  <textarea
                    placeholder="Admin note (optional)"
                    value={adminNotes[req.id] ?? ''}
                    onChange={e => setAdminNotes(prev => ({ ...prev, [req.id]: e.target.value }))}
                    className="w-full border rounded-xl px-3 py-2 text-sm bg-white/5 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none mb-3"
                    style={{ borderColor: 'rgba(255,255,255,0.08)' }}
                    rows={2}
                    id={`admin-note-${req.id}`}
                  />

                  <div className="flex gap-2">
                    <button
                      id={`approve-req-${req.id}`}
                      onClick={() => handleUpdate(req.id, 'approved')}
                      className="flex-1 flex items-center justify-center gap-2 bg-active text-white font-semibold rounded-xl py-2.5 text-sm hover:bg-emerald-700 transition-all active:scale-95"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Approve
                    </button>
                    <button
                      id={`deny-req-${req.id}`}
                      onClick={() => handleUpdate(req.id, 'denied')}
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

      {/* Resolved */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 className="w-4 h-4 text-active" />
          <h2 className="font-semibold text-text-primary">Resolved</h2>
        </div>
        {resolved.length === 0 ? (
          <p className="text-text-muted text-sm text-center py-4">No resolved requests</p>
        ) : (
          <div className="space-y-2">
            {resolved.map(req => {
              const requester = profileMap.get(req.requested_by);
              return (
                <div key={req.id} className="card opacity-70">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: requester?.avatar_color }}
                    >
                      {requester?.username.charAt(0).toUpperCase()}
                    </div>
                    <p className="text-text-secondary text-sm flex-1 truncate">{req.description}</p>
                    {req.status === 'approved' ? (
                      <div className="badge-active"><CheckCircle2 className="w-3 h-3" /> Approved</div>
                    ) : (
                      <div className="badge-denied"><XCircle className="w-3 h-3" /> Denied</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

