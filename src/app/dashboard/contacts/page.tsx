'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Contact } from '@/lib/types';
import { Phone, Users, User, ShieldAlert, Search } from 'lucide-react';
import { IconUsers } from '@/components/GeometricIcons';

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

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

  const filteredContacts = contacts.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.tag.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone_numbers.some(p => p.includes(searchQuery))
  );

  const flatmates = filteredContacts.filter(c => c.is_flatmate);
  const otherContacts = filteredContacts.filter(c => !c.is_flatmate);

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-4 animate-pulse max-w-2xl mx-auto">
        <div className="skeleton h-8 w-48 mb-6 rounded-xl" />
        <div className="skeleton h-12 w-full rounded-xl mb-4" />
        <div className="skeleton h-60 rounded-2xl" />
        <div className="skeleton h-60 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 pb-28 md:pb-8 animate-fade-in max-w-2xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center icon-container-violet">
          <IconUsers size={16} />
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#f1f5f9' }}>Important Contacts</h1>
          <p className="text-xs" style={{ color: '#475569' }}>Quick access to flatmates and service details</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-3.5 h-4.5 w-4.5 text-slate-500" />
        <input
          type="text"
          placeholder="Search by name, tag, or phone number..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="input pl-11"
        />
      </div>

      {/* Segment 1: Flatmates */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <User size={14} className="text-[#a78bfa]" />
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">Flatmates</h2>
        </div>

        {flatmates.length === 0 ? (
          <div className="bento-card p-6 text-center text-sm text-slate-500">
            No flatmate contacts found.
          </div>
        ) : (
          <div className="grid gap-3">
            {flatmates.map(contact => (
              <ContactCard key={contact.id} contact={contact} />
            ))}
          </div>
        )}
      </div>

      {/* Segment 2: Other Contacts (ISP, Maid, Caretaker, etc) */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Users size={14} className="text-[#67e8f9]" />
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">Other Contacts (ISP, Maid, Caretaker)</h2>
        </div>

        {otherContacts.length === 0 ? (
          <div className="bento-card p-6 text-center text-sm text-slate-500">
            No other contacts found.
          </div>
        ) : (
          <div className="grid gap-3">
            {otherContacts.map(contact => (
              <ContactCard key={contact.id} contact={contact} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ContactCard({ contact }: { contact: Contact }) {
  return (
    <div className="bento-card p-4 flex items-center justify-between gap-4 transition-all duration-200 hover:translate-y-[-1px]">
      <div className="flex items-center gap-3.5 min-w-0">
        {/* Avatar */}
        <div 
          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
          style={{
            background: contact.is_flatmate ? 'linear-gradient(135deg, #7c3aed, #5b21b6)' : 'linear-gradient(135deg, #0891b2, #06b6d4)',
            boxShadow: contact.is_flatmate ? '0 0 12px rgba(124,58,237,0.3)' : '0 0 12px rgba(6,182,212,0.3)',
          }}
        >
          {contact.name.charAt(0).toUpperCase()}
        </div>

        <div className="min-w-0">
          <h3 className="font-bold text-sm text-slate-100 truncate">{contact.name}</h3>
          <span 
            className="inline-block text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full mt-1 border"
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
      </div>

      {/* Phone numbers list */}
      <div className="flex flex-col gap-1.5 flex-shrink-0 items-end">
        {contact.phone_numbers.map((phone, idx) => (
          <a
            key={idx}
            href={`tel:${phone}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-150 active:scale-95 hover:bg-slate-800"
            style={{
              background: 'rgba(255,255,255,0.03)',
              borderColor: 'rgba(255,255,255,0.06)',
              color: '#94a3b8',
            }}
          >
            <Phone size={11} className="text-emerald-400" />
            <span>{phone}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
