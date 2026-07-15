'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Expense, Meal, Profile } from '@/lib/types';
import { CATEGORY_LABELS } from '@/lib/types';
import { formatBDT } from '@/lib/finance';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { CategoryIcon, IconActivity } from '@/components/GeometricIcons';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface FeedItem {
  id: string;
  type: 'expense' | 'meal';
  timestamp: string;
  user: Profile | undefined;
  content: string;
  subContent?: string;
  category?: string;
}

interface Props {
  monthId: string;
  profiles: Profile[];
}

export default function ActivityFeed({ monthId, profiles }: Props) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  const profileMap = new Map(profiles.map(p => [p.id, p]));

  useEffect(() => {
    if (!monthId) return;
    fetchFeed();
    const channel = supabase
      .channel('activity-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'expenses' }, fetchFeed)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'meals' }, fetchFeed)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [monthId]);

  const fetchFeed = async () => {
    const [expRes, mealRes] = await Promise.all([
      supabase.from('expenses').select('*').eq('month_id', monthId).order('created_at', { ascending: false }).limit(20),
      supabase.from('meals').select('*').eq('month_id', monthId).order('date', { ascending: false }).limit(20),
    ]);

    const expenseItems: FeedItem[] = (expRes.data ?? []).map((e: Expense) => {
      const paidDetails = e.paid_by_details as Record<string, number> | null;
      let user = profileMap.get(e.paid_by);
      let content = `${CATEGORY_LABELS[e.category as keyof typeof CATEGORY_LABELS]}`;
      
      if (paidDetails && Object.keys(paidDetails).length > 1) {
        const names = Object.keys(paidDetails)
          .map(uid => profileMap.get(uid)?.username)
          .filter(Boolean);
        user = profileMap.get(Object.keys(paidDetails)[0]);
        content = `split payment for ${CATEGORY_LABELS[e.category as keyof typeof CATEGORY_LABELS]} (Paid by: ${names.join(', ')})`;
      }
      
      return {
        id: e.id,
        type: 'expense',
        timestamp: e.created_at,
        user,
        content,
        subContent: formatBDT(e.amount),
        category: e.category,
      };
    });

    const mealItems: FeedItem[] = (mealRes.data ?? []).map((m: Meal) => {
      const guestText = m.guest_count && m.guest_count > 0 ? ` (+${m.guest_count} guest)` : '';
      return {
        id: m.id,
        type: 'meal',
        timestamp: m.date + 'T00:00:00',
        user: profileMap.get(m.user_id),
        content: `Logged ${m.count} meal${m.count !== 1 ? 's' : ''}${guestText}`,
        subContent: m.date,
      };
    });

    const combined = [...expenseItems, ...mealItems]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 25);

    setItems(combined);
    setLoading(false);
  };

  return (
    <div className="bento-card p-4 transition-all duration-300">
      {/* Header Button Toggle */}
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between focus:outline-none"
        id="activity-feed-toggle"
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center icon-container-violet">
            <IconActivity size={13} />
          </div>
          <h2 className="font-semibold text-sm animate-fade-in" style={{ color: '#f1f5f9' }}>Activity Feed</h2>
          {!loading && items.length > 0 && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(124,58,237,0.12)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.2)' }}>
              {items.length}
            </span>
          )}
        </div>
        <div className="text-slate-500 hover:text-slate-300 transition-colors">
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {/* Collapsible Content */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-slate-800/40 animate-fade-in">
          {loading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="skeleton h-12 rounded-xl" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-10 h-10 rounded-xl mx-auto mb-3 flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: '#334155' }}>
                <IconActivity size={18} />
              </div>
              <p className="text-sm font-medium" style={{ color: '#334155' }}>No activity yet this month</p>
            </div>
          ) : (
            <div className="relative">
              {/* Vertical timeline line */}
              <div className="absolute left-3.5 top-0 bottom-0 w-px pointer-events-none"
                style={{ background: 'linear-gradient(to bottom, rgba(124,58,237,0.3), rgba(124,58,237,0.05) 80%, transparent)' }} />

              <div className="space-y-1">
                {items.map((item) => (
                  <div key={`${item.type}-${item.id}`}
                    className="flex items-start gap-3 py-2.5 pl-1 rounded-xl transition-all duration-150 group relative"
                    style={{ paddingRight: '4px' }}
                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.02)'}
                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                  >
                    {/* Avatar with timeline dot */}
                    <div className="relative flex-shrink-0">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold z-10 relative"
                        style={{
                          backgroundColor: item.user?.avatar_color ?? '#334155',
                          boxShadow: `0 0 8px ${item.user?.avatar_color ?? '#334155'}60`,
                        }}>
                        {item.user?.username.charAt(0).toUpperCase() ?? '?'}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold" style={{ color: '#94a3b8' }}>
                          {item.user?.username ?? 'Unknown'}
                        </span>
                        {item.type === 'expense' && item.category && (
                          <span className="flex items-center justify-center" style={{ color: '#475569', width: 12, height: 12 }}>
                            <CategoryIcon category={item.category} size={11} />
                          </span>
                        )}
                        <span className="text-xs" style={{ color: '#475569' }}>{item.content}</span>
                      </div>
                      <p className="text-[10px] mt-0.5" style={{ color: '#334155' }}>
                        {formatDistanceToNow(parseISO(item.timestamp), { addSuffix: true })}
                      </p>
                    </div>

                    {/* Amount or date tag */}
                    {item.subContent && (
                      <span className="text-xs font-bold flex-shrink-0 self-center"
                        style={{ color: item.type === 'expense' ? '#f43f5e' : '#10b981' }}>
                        {item.subContent}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
