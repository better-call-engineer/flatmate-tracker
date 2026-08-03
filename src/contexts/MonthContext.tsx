'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Month } from '@/lib/types';
import { getAllMonths, getOrCreateCurrentMonth } from '@/lib/finance';
import { format } from 'date-fns';

const SESSION_KEY = 'flatmate_selectedMonthId';

interface MonthContextType {
  selectedMonthId: string;
  setSelectedMonthId: (id: string) => void;
  selectedMonth: Month | null;
  months: Month[];
  refreshMonths: () => Promise<void>;
  loadingMonths: boolean;
  currentMonthLabel: string;
}

const MonthContext = createContext<MonthContextType>({
  selectedMonthId: '',
  setSelectedMonthId: () => {},
  selectedMonth: null,
  months: [],
  refreshMonths: async () => {},
  loadingMonths: true,
  currentMonthLabel: '',
});

export function MonthProvider({ children }: { children: React.ReactNode }) {
  const [selectedMonthId, setSelectedMonthIdState] = useState<string>('');
  const [months, setMonths] = useState<Month[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<Month | null>(null);
  const [loadingMonths, setLoadingMonths] = useState(true);

  const today = new Date();
  const currentMonthLabel = format(today, 'yyyy-MM');

  // Wrapper: persist selection to sessionStorage on every change
  const setSelectedMonthId = useCallback((id: string) => {
    setSelectedMonthIdState(id);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(SESSION_KEY, id);
    }
  }, []);

  const fetchMonths = useCallback(async () => {
    try {
      const all = await getAllMonths();
      setMonths(all);

      // Restore from sessionStorage if available and valid
      const stored = typeof window !== 'undefined'
        ? sessionStorage.getItem(SESSION_KEY)
        : null;
      const storedIsValid = stored && all.some(m => m.id === stored);

      if (storedIsValid) {
        setSelectedMonthIdState(stored!);
      } else if (all.length > 0) {
        // Default to current month
        const found = all.find(m => m.label === currentMonthLabel);
        if (found) {
          setSelectedMonthId(found.id);
        } else {
          const current = await getOrCreateCurrentMonth();
          setSelectedMonthId(current.id);
          const updated = await getAllMonths();
          setMonths(updated);
        }
      } else {
        const current = await getOrCreateCurrentMonth();
        setSelectedMonthId(current.id);
        setMonths([current]);
      }
    } catch (err) {
      console.error('Failed to load months context:', err);
    } finally {
      setLoadingMonths(false);
    }
  }, [currentMonthLabel, setSelectedMonthId]);

  useEffect(() => {
    fetchMonths();
  }, [fetchMonths]);

  useEffect(() => {
    if (selectedMonthId && months.length > 0) {
      const found = months.find(m => m.id === selectedMonthId);
      if (found) setSelectedMonth(found);
    }
  }, [selectedMonthId, months]);

  const refreshMonths = async () => {
    await fetchMonths();
  };

  return (
    <MonthContext.Provider value={{
      selectedMonthId,
      setSelectedMonthId,
      selectedMonth,
      months,
      refreshMonths,
      loadingMonths,
      currentMonthLabel,
    }}>
      {children}
    </MonthContext.Provider>
  );
}

export const useSelectedMonth = () => useContext(MonthContext);
