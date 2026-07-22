'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Server } from '@/lib/types';
import { Tv, ExternalLink, Film, HelpCircle } from 'lucide-react';

export default function ServersPage() {
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchServers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('servers' as any)
      .select('*')
      .order('name', { ascending: true });

    if (!error && data) {
      setServers(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  const movieServers = servers.filter(s => (s.category || 'movie') === 'movie');
  const tvServers = servers.filter(s => s.category === 'tv');

  const renderServerCard = (server: Server) => {
    const isMovie = server.category === 'movie';
    return (
      <a
        key={server.id}
        href={server.url}
        target="_blank"
        rel="noopener noreferrer"
        className="bento-card p-5 flex flex-col justify-between h-44 transition-all duration-300 hover:translate-y-[-2px] group text-left relative overflow-hidden"
      >
        {/* Decorative glow */}
        <div 
          className="absolute top-0 right-0 w-24 h-24 pointer-events-none opacity-20 transition-opacity duration-300 group-hover:opacity-30"
          style={{
            background: isMovie 
              ? 'radial-gradient(circle at top right, rgba(167,139,250,0.4) 0%, transparent 70%)'
              : 'radial-gradient(circle at top right, rgba(103,232,249,0.4) 0%, transparent 70%)',
          }} 
        />

        <div>
          <div className="flex items-center justify-between mb-3.5">
            <div 
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-105"
              style={{
                background: isMovie ? 'rgba(167,139,250,0.12)' : 'rgba(6,182,212,0.12)',
                border: isMovie ? '1px solid rgba(167,139,250,0.22)' : '1px solid rgba(6,182,212,0.22)',
                color: isMovie ? '#c4b5fd' : '#67e8f9',
              }}
            >
              {isMovie ? <Film size={16} /> : <Tv size={16} />}
            </div>
            <ExternalLink size={14} className="text-slate-600 transition-colors duration-200 group-hover:text-slate-400" />
          </div>

          <h2 className="font-extrabold text-base text-slate-100 group-hover:text-white transition-colors">
            {server.name}
          </h2>
          <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">
            {server.description || 'No description provided.'}
          </p>
        </div>

        <div className="text-[10px] font-bold text-slate-600 truncate mt-2 group-hover:text-slate-400 transition-colors">
          {server.url}
        </div>
      </a>
    );
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-4 animate-pulse max-w-2xl mx-auto">
        <div className="skeleton h-8 w-48 mb-6 rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="skeleton h-44 rounded-2xl" />
          <div className="skeleton h-44 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto no-scrollbar px-5 sm:px-8 md:px-12 pt-7 md:pt-8 pb-6 animate-fade-in space-y-6">
      
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center icon-container-cyan">
          <Tv size={16} />
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#f1f5f9' }}>Server & TV</h1>
          <p className="text-xs" style={{ color: '#475569' }}>Access local FTP, media, and IPTV services</p>
        </div>
      </div>

      {servers.length === 0 ? (
        <div className="bento-card p-8 text-center text-sm text-slate-500">
          No server links configured by admin yet.
        </div>
      ) : (
        <div className="space-y-8">
          {/* Movie Servers Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-1.5 border-b border-slate-800/40">
              <Film size={15} className="text-[#c4b5fd] flex-shrink-0" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">Movie Servers</h2>
              <span className="text-[10px] bg-slate-800/60 text-slate-400 px-2 py-0.5 rounded-full font-bold border border-slate-800">
                {movieServers.length}
              </span>
            </div>
            
            {movieServers.length === 0 ? (
              <div className="bento-card p-6 text-center text-xs text-slate-500">
                No movie servers configured.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {movieServers.map(server => renderServerCard(server))}
              </div>
            )}
          </div>

          {/* TV Servers Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-1.5 border-b border-slate-800/40">
              <Tv size={15} className="text-[#06b6d4] flex-shrink-0" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">TV Servers</h2>
              <span className="text-[10px] bg-slate-800/60 text-slate-400 px-2 py-0.5 rounded-full font-bold border border-slate-800">
                {tvServers.length}
              </span>
            </div>
            
            {tvServers.length === 0 ? (
              <div className="bento-card p-6 text-center text-xs text-slate-500">
                No TV servers configured.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {tvServers.map(server => renderServerCard(server))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
