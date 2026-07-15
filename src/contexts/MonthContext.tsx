'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Month } from '@/lib/types';
import { getAllMonths, getOrCreateCurrentMonth } from '@/lib/finance';
import { format } from 'date-fns';

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
  const [selectedMonthId, setSelectedMonthId] = useState<string>('');
  const [months, setMonths] = useState<Month[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<Month | null>(null);
  const [loadingMonths, setLoadingMonths] = useState(true);

  const today = new Date();
  const currentMonthLabel = format(today, 'yyyy-MM');

  const fetchMonths = useCallback(async () => {
    try {
      const all = await getAllMonths();
      setMonths(all);
      
      if (all.length > 0) {
        // Look for the current month in DB
        const found = all.find(m => m.label === currentMonthLabel);
        if (found) {
          setSelectedMonthId(prev => prev || found.id);
        } else {
          // If not found, let's bootstrap/create it
          const current = await getOrCreateCurrentMonth();
          setSelectedMonthId(prev => prev || current.id);
          // Re-fetch all to include the newly created one
          const updated = await getAllMonths();
          setMonths(updated);
        }
      } else {
        const current = await getOrCreateCurrentMonth();
        setSelectedMonthId(prev => prev || current.id);
        setMonths([current]);
      }
    } catch (err) {
      console.error('Failed to load months context:', err);
    } finally {
      setLoadingMonths(false);
    }
  }, [currentMonthLabel]);

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
