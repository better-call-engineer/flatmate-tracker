'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Server } from '@/lib/types';
import { Plus, Trash2, Edit2, Save, X, Tv, ExternalLink, Film } from 'lucide-react';
import { IconShield } from '@/components/GeometricIcons';
import { toast } from 'sonner';

export default function AdminServersPage() {
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'movie' | 'tv'>('movie');
  const [showForm, setShowForm] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

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

  const resetForm = () => {
    setName('');
    setUrl('');
    setDescription('');
    setCategory('movie');
    setEditingId(null);
    setShowForm(false);
  };

  const handleEditClick = (server: Server) => {
    setEditingId(server.id);
    setName(server.name);
    setUrl(server.url);
    setDescription(server.description || '');
    setCategory((server.category as 'movie' | 'tv') || 'movie');
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !url) {
      toast.error('Please enter server name and link URL');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        url: url.trim(),
        description: description.trim() || null,
        category,
      };

      let error;
      if (editingId) {
        // Update
        const res = await (supabase.from('servers' as any) as any)
          .update(payload as any)
          .eq('id', editingId);
        error = res.error;
      } else {
        // Insert
        const res = await (supabase.from('servers' as any) as any)
          .insert(payload as any);
        error = res.error;
      }

      if (error) throw error;

      toast.success(editingId ? 'Server details updated!' : 'Server link added!');
      resetForm();
      fetchServers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save server details');
    } finally {
      setSaving(false);
    }
  };

  const executeDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      const { error } = await supabase
        .from('servers' as any)
        .delete()
        .eq('id', deleteConfirmId);

      if (error) throw error;
      toast.success('Server link deleted!');
      fetchServers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete server link');
    } finally {
      setDeleteConfirmId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-4 animate-pulse max-w-2xl mx-auto">
        <div className="skeleton h-8 w-48 mb-6 rounded-xl" />
        <div className="skeleton h-64 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 pb-28 md:pb-8 animate-fade-in max-w-2xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center icon-container-cyan">
            <IconShield size={16} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#f1f5f9' }}>Manage Servers</h1>
            <p className="text-xs" style={{ color: '#475569' }}>Configure local FTP, media, and TV servers</p>
          </div>
        </div>

        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary py-2 px-4 rounded-xl flex items-center gap-1.5 text-xs"
            style={{
              background: 'linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)',
              boxShadow: '0 4px 16px rgba(6,182,212,0.3)',
            }}
          >
            <Plus size={14} /> Add Server
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSave} className="bento-card p-5 space-y-4 animate-slide-up">
          <div className="flex items-center justify-between border-b border-slate-800/40 pb-3">
            <h2 className="font-bold text-sm text-slate-200">
              {editingId ? 'Edit Server Configuration' : 'Configure New Server'}
            </h2>
            <button
              type="button"
              onClick={resetForm}
              className="text-slate-500 hover:text-slate-300"
            >
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Server Name */}
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <label className="text-xs font-semibold text-slate-400 block">Server Name</label>
              <input
                type="text"
                placeholder="e.g. Movie Server"
                value={name}
                onChange={e => setName(e.target.value)}
                className="input text-sm"
                required
              />
            </div>

            {/* Server URL */}
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <label className="text-xs font-semibold text-slate-400 block">Server URL / Address</label>
              <input
                type="url"
                placeholder="http://192.168.1.100:8000"
                value={url}
                onChange={e => setUrl(e.target.value)}
                className="input text-sm"
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5 col-span-2">
              <label className="text-xs font-semibold text-slate-400 block">Description (Optional)</label>
              <input
                type="text"
                placeholder="Brief details about server content"
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="input text-sm"
              />
            </div>

            {/* Server Category */}
            <div className="space-y-1.5 col-span-2">
              <label className="text-xs font-semibold text-slate-400 block">Server Category</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCategory('movie')}
                  className={`py-2 px-4 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                    category === 'movie'
                      ? 'border-[#c4b5fd]/30 text-[#c4b5fd]'
                      : 'border-slate-800/80 text-slate-500 hover:text-slate-400 hover:border-slate-800'
                  }`}
                  style={{
                    background: category === 'movie' ? 'rgba(167,139,250,0.08)' : 'rgba(255,255,255,0.01)',
                  }}
                >
                  <Film size={14} /> Movie Server
                </button>
                <button
                  type="button"
                  onClick={() => setCategory('tv')}
                  className={`py-2 px-4 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                    category === 'tv'
                      ? 'border-[#06b6d4]/30 text-[#06b6d4]'
                      : 'border-slate-800/80 text-slate-500 hover:text-slate-400 hover:border-slate-800'
                  }`}
                  style={{
                    background: category === 'tv' ? 'rgba(6,182,212,0.08)' : 'rgba(255,255,255,0.01)',
                  }}
                >
                  <Tv size={14} /> TV Server
                </button>
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-2 border-t border-slate-800/40 pt-4 mt-1">
            <button
              type="button"
              onClick={resetForm}
              className="btn-secondary py-2 px-4 rounded-xl text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary py-2 px-5 rounded-xl text-xs flex items-center gap-1.5"
              style={{
                background: 'linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)',
                boxShadow: '0 4px 16px rgba(6,182,212,0.3)',
              }}
            >
              <Save size={13} /> {saving ? 'Saving...' : 'Save Config'}
            </button>
          </div>
        </form>
      )}

      {/* List */}
      <div className="space-y-3">
        {servers.length === 0 ? (
          <div className="bento-card p-8 text-center text-sm text-slate-500">
            No server configurations found. Add one above!
          </div>
        ) : (
          <div className="grid gap-3">
            {servers.map(server => {
              const isMovie = server.category === 'movie';
              return (
                <div 
                  key={server.id} 
                  className="bento-card p-4 flex items-center justify-between gap-4 transition-all duration-200"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {isMovie ? (
                        <Film size={14} className="text-[#c4b5fd] flex-shrink-0" />
                      ) : (
                        <Tv size={14} className="text-[#06b6d4] flex-shrink-0" />
                      )}
                      <h3 className="font-bold text-sm text-slate-100 truncate">{server.name}</h3>
                      <span 
                        className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                          isMovie 
                            ? 'bg-[#c4b5fd]/10 text-[#c4b5fd] border border-[#c4b5fd]/20' 
                            : 'bg-[#06b6d4]/10 text-[#06b6d4] border border-[#06b6d4]/20'
                        }`}
                      >
                        {isMovie ? 'Movie' : 'TV'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 truncate">{server.description}</p>
                  <a 
                    href={server.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1 mt-1 truncate max-w-fit"
                  >
                    {server.url} <ExternalLink size={10} />
                  </a>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEditClick(server)}
                    className="w-8 h-8 rounded-xl flex items-center justify-center border hover:bg-slate-800 transition-colors"
                    style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.06)', color: '#64748b' }}
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(server.id)}
                    className="w-8 h-8 rounded-xl flex items-center justify-center border hover:bg-rose-500/10 hover:border-rose-500/30 transition-colors"
                    style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.06)', color: '#f43f5e' }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
          </div>
        )}
      </div>
      {/* Custom Confirmation Modal */}
      {deleteConfirmId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
          onClick={() => setDeleteConfirmId(null)}
        >
          <div 
            className="w-full max-w-sm rounded-2xl p-5 modal-content space-y-4 text-center"
            style={{
              background: '#0d1220',
              border: '1px solid rgba(244,63,94,0.15)',
              boxShadow: '0 0 0 1px rgba(244,63,94,0.08), 0 20px 50px rgba(0,0,0,0.8), 0 0 40px rgba(244,63,94,0.05)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-500">
              <Trash2 size={22} />
            </div>
            
            <div className="space-y-1.5">
              <h3 className="font-extrabold text-base text-slate-100">Delete Server Configuration?</h3>
              <p className="text-xs text-slate-400">
                Are you sure you want to delete this server link? This action cannot be undone.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="btn-secondary py-2.5 px-4 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={executeDelete}
                className="py-2.5 px-4 rounded-xl text-xs font-bold text-white transition-all hover:bg-rose-600 flex items-center justify-center gap-1.5"
                style={{
                  background: 'linear-gradient(135deg, #e11d48 0%, #f43f5e 100%)',
                  boxShadow: '0 4px 16px rgba(244,63,94,0.3)',
                }}
              >
                Delete Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
