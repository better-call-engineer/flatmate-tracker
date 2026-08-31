import { Database } from './database.types';

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Month = Database['public']['Tables']['months']['Row'];
export type Expense = Database['public']['Tables']['expenses']['Row'];
export type Meal = Database['public']['Tables']['meals']['Row'];
export type Settlement = Database['public']['Tables']['settlements']['Row'];
export type EditRequest = Database['public']['Tables']['edit_requests']['Row'];
export type Contact = Database['public']['Tables']['contacts']['Row'];
export type Server = Database['public']['Tables']['servers']['Row'];
export type PasswordReset = Database['public']['Tables']['password_resets']['Row'];

export interface FixedOverheadConfig {
  id: string;
  user_id: string;
  category: 'rent';
  amount: number;
  updated_by: string | null;
  updated_at: string;
}

export interface SharedExpenseConfig {
  id: string;
  category: 'gas' | 'electricity' | 'misc' | 'internet' | 'maid';
  total_amount: number;
  updated_by: string | null;
  updated_at: string;
}

export const FIXED_OVERHEAD_CATEGORIES = ['rent'] as const;
export type FixedOverheadCategory = typeof FIXED_OVERHEAD_CATEGORIES[number];

export type ExpenseCategory =
  | 'rent'
  | 'internet'
  | 'maid'
  | 'electricity'
  | 'gas'
  | 'misc'
  | 'grocery';

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  rent: 'Rent',
  internet: 'Internet Bill',
  maid: 'Maid',
  electricity: 'Electricity Bill',
  gas: 'Gas Bill',
  misc: 'Miscellaneous',
  grocery: 'Grocery / Bazaar',
};

// Short labels for UI pills/chips
export const CATEGORY_SHORT_LABELS: Record<ExpenseCategory, string> = {
  rent: 'Rent',
  internet: 'Internet',
  maid: 'Maid',
  electricity: 'Electricity',
  gas: 'Gas',
  misc: 'Misc.',
  grocery: 'Grocery',
};

export const CATEGORY_GROUPS = {
  'Fixed Expenses': ['rent'] as ExpenseCategory[],
  'Shared Expenses': ['electricity', 'gas', 'misc', 'internet', 'maid'] as ExpenseCategory[],
  'Meal & Food': ['grocery'] as ExpenseCategory[],
};

// NOTE: Emoji icons have been replaced by geometric SVG components.
// Use <CategoryIcon category={key} /> from '@/components/GeometricIcons' instead.
export const CATEGORY_ICONS: Record<ExpenseCategory, string> = {
  rent:        '',
  internet:    '',
  maid:        '',
  electricity: '',
  gas:         '',
  misc:        '',
  grocery:     '',
};

export interface CarryForwardBalance {
  mealBalance: number;    // e.g. -1265 (owed/due) or +300 (overpaid)
  expenseBalance: number; // e.g. +150 (overpaid) or -500 (due)
  total: number;          // net total = mealBalance + expenseBalance
}

export interface UserBalance {
  userId: string;
  username: string;
  avatarColor: string;
  totalShare: number;
  totalPaid: number;
  balance: number; // positive = flat owes user; negative = user owes flat
  openingBalance: number;
  carryForward?: CarryForwardBalance;
  mealCount: number;
  mealCost: number;
  overheadShare: number;
  fixedOverheadShare: number; // from admin-configured rent/maid/internet
  variableShare: number;      // from manually logged electricity/gas/misc expenses
  sharedExpenseShare: number; // from admin-configured shared gas/electricity (total ÷ active users)
  advanceCredit: number;      // credit from advance payments made in the previous month for this month
}

export interface WhoOwesWhom {
  from: Profile;
  to: Profile;
  amount: number;
}

export interface MealCalendarDay {
  date: string; // YYYY-MM-DD
  dayNumber: number;
  count: number;
  guestCount: number;
  isFuture: boolean;
  isWeekend: boolean;
}
