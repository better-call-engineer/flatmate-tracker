'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Contact } from '@/lib/types';
import { Plus, Trash2, Edit2, Phone, Save, X, Users, ArrowLeft, ShieldAlert } from 'lucide-react';
import { IconShield } from '@/components/GeometricIcons';
import { toast } from 'sonner';
import Link from 'next/link';

export default function AdminContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [isFlatmate, setIsFlatmate] = useState(false);
  const [phoneNumbers, setPhoneNumbers] = useState<string[]>(['']);
  const [displayOrder, setDisplayOrder] = useState('0');
  const [showForm, setShowForm] = useState(false);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('contacts' as any)
      .select('*')
      .order('display_order', { ascending: true })
      .order('name', { ascending: true });

    if (!error && data) {
      setContacts(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const resetForm = () => {
    setName('');
    setTag('');
    setIsFlatmate(false);
    setPhoneNumbers(['']);
    setDisplayOrder('0');
    setEditingId(null);
    setShowForm(false);
  };

  const handleAddPhoneField = () => {
    setPhoneNumbers([...phoneNumbers, '']);
  };

  const handleRemovePhoneField = (index: number) => {
    if (phoneNumbers.length === 1) return;
    setPhoneNumbers(phoneNumbers.filter((_, idx) => idx !== index));
  };

  const handlePhoneChange = (index: number, value: string) => {
    const next = [...phoneNumbers];
    next[index] = value.trim();
    setPhoneNumbers(next);
  };

  const handleEditClick = (contact: Contact) => {
    setEditingId(contact.id);
    setName(contact.name);
    setTag(contact.tag);
    setIsFlatmate(contact.is_flatmate);
    setPhoneNumbers(contact.phone_numbers.length > 0 ? contact.phone_numbers : ['']);
    setDisplayOrder(String(contact.display_order));
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !tag) {
      toast.error('Please enter name and tag');
      return;
    }

    // Filter out empty phone numbers
    const validPhones = phoneNumbers.filter(p => p.trim().length > 0);
    if (validPhones.length === 0) {
      toast.error('Please enter at least one phone number');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        tag: tag.trim(),
        is_flatmate: isFlatmate,
        phone_numbers: validPhones,
        display_order: parseInt(displayOrder) || 0,
      };

      let error;
      if (editingId) {
        // Update
        const res = await (supabase.from('contacts' as any) as any)
          .update(payload as any)
          .eq('id', editingId);
        error = res.error;
      } else {
        // Insert
        const res = await (supabase.from('contacts' as any) as any)
          .insert(payload as any);
        error = res.error;
      }

      if (error) throw error;

      toast.success(editingId ? 'Contact updated!' : 'Contact added!');
      resetForm();
      fetchContacts();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save contact');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this contact?')) return;
    try {
      const { error } = await supabase
        .from('contacts' as any)
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Contact deleted!');
      fetchContacts();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete contact');
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
            <h1 className="text-2xl font-bold" style={{ color: '#f1f5f9' }}>Manage Contacts</h1>
            <p className="text-xs" style={{ color: '#475569' }}>Add or edit important flat contacts</p>
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
            <Plus size={14} /> Add Contact
          </button>
        )}
      </div>

      {/* Collapsible Contact Form */}
      {showForm && (
        <form onSubmit={handleSave} className="bento-card p-5 space-y-4 animate-slide-up">
          <div className="flex items-center justify-between border-b border-slate-800/40 pb-3">
            <h2 className="font-bold text-sm text-slate-200">
              {editingId ? 'Edit Contact Details' : 'Create New Contact'}
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
            {/* Name */}
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <label className="text-xs font-semibold text-slate-400">Name</label>
              <input
                type="text"
                placeholder="e.g. Joynal Abedin (ISP)"
                value={name}
                onChange={e => setName(e.target.value)}
                className="input text-sm py-2.5"
                required
              />
            </div>

            {/* Tag */}
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <label className="text-xs font-semibold text-slate-400">Tag / Category</label>
              <input
                type="text"
                placeholder="e.g. Caretaker, ISP, Maid"
                value={tag}
                onChange={e => setTag(e.target.value)}
                className="input text-sm py-2.5"
                required
              />
            </div>
          </div>

          {/* Toggle Type & Order */}
          <div className="grid grid-cols-2 gap-4 items-center">
            {/* Flatmate checkbox */}
            <div className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-800 bg-slate-900/30">
              <input
                id="form-is-flatmate"
                type="checkbox"
                checked={isFlatmate}
                onChange={e => {
                  setIsFlatmate(e.target.checked);
                  if (e.target.checked) setTag('Flatmate');
                }}
                className="w-4 h-4 accent-cyan-500"
              />
              <label htmlFor="form-is-flatmate" className="text-xs font-semibold text-slate-300 cursor-pointer select-none">
                This is a Flatmate contact
              </label>
            </div>

            {/* Display Order */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400">Display Order</label>
              <input
                type="number"
                value={displayOrder}
                onChange={e => setDisplayOrder(e.target.value)}
                className="input text-sm py-2.5"
              />
            </div>
          </div>

          {/* Multiple Phone Numbers */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-400">Phone Numbers</label>
              <button
                type="button"
                onClick={handleAddPhoneField}
                className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
              >
                <Plus size={10} /> Add Number
              </button>
            </div>

            <div className="space-y-2">
              {phoneNumbers.map((phone, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input
                    type="tel"
                    placeholder="e.g. 017XXXXXXXX"
                    value={phone}
                    onChange={e => handlePhoneChange(idx, e.target.value)}
                    className="input text-sm py-2.5 flex-1"
                    required
                  />
                  {phoneNumbers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemovePhoneField(idx)}
                      className="p-2.5 rounded-xl border border-rose-950 bg-rose-950/20 text-rose-400 hover:bg-rose-950/40"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Save buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 btn-primary"
              style={{
                background: 'linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)',
                boxShadow: '0 4px 16px rgba(6,182,212,0.3)',
              }}
            >
              <Save size={13} /> {saving ? 'Saving...' : 'Save Contact'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="py-2.5 px-5 rounded-xl text-xs font-bold bg-slate-800 text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* List Contacts */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">Contact List ({contacts.length})</h2>

        {contacts.length === 0 ? (
          <div className="bento-card p-6 text-center text-sm text-slate-500">
            No contacts listed yet. Click "Add Contact" above to create one.
          </div>
        ) : (
          <div className="grid gap-3">
            {contacts.map(contact => (
              <div 
                key={contact.id} 
                className="bento-card p-4 flex items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-slate-100">{contact.name}</h3>
                    <span 
                      className="text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border"
                      style={contact.is_flatmate ? {
                        background: 'rgba(124,58,237,0.1)',
                        borderColor: 'rgba(124,58,237,0.2)',
                        color: '#c4b5fd',
                      } : {
                        background: 'rgba(6,182,212,0.1)',
                        borderColor: 'rgba(6,182,212,0.2)',
                        color: '#67e8f9',
                      }}
                    >
                      {contact.tag}
                    </span>
                  </div>
                  
                  {/* Phone list snippet */}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {contact.phone_numbers.map((phone, idx) => (
                      <span key={idx} className="flex items-center gap-1 text-[10px] text-slate-400">
                        <Phone size={10} className="text-emerald-500" />
                        {phone}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => handleEditClick(contact)}
                    className="p-2 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-400"
                    title="Edit Contact"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(contact.id)}
                    className="p-2 rounded-lg border border-rose-950 bg-rose-950/10 hover:bg-rose-950/30 text-rose-400"
                    title="Delete Contact"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
