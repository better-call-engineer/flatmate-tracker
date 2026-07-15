import { supabase } from './supabase';
import { Expense, Meal, Profile, UserBalance, WhoOwesWhom, Month } from './types';
import { format } from 'date-fns';

// ---- Month helpers ----
export async function getOrCreateCurrentMonth(): Promise<Month> {
  const label = format(new Date(), 'yyyy-MM');
  
  let { data: month, error } = await (supabase as any)
    .from('months')
    .select('*')
    .eq('label', label)
    .single();
  
  if (error || !month) {
    // Create it (admin only enforced by RLS)
    const { data: newMonth, error: createError } = await (supabase as any)
      .from('months')
      .insert({ label })
      .select()
      .single();
    if (createError) throw createError;
    return newMonth as Month;
  }
  return month as Month;
}

export async function getAllMonths(): Promise<Month[]> {
  const { data, error } = await (supabase as any)
    .from('months')
    .select('*')
    .order('label', { ascending: false });
  if (error) throw error;
  return data as Month[];
}

// ---- Balance calculation ----
export function calculateBalances(
  expenses: Expense[],
  meals: Meal[],
  profiles: Profile[],
  openingBalances: Record<string, number> = {},
  fixedOverheadConfigs: import('./types').FixedOverheadConfig[] = [],
  sharedExpenseConfigs: import('./types').SharedExpenseConfig[] = []
): UserBalance[] {
  const activeProfiles = profiles.filter(p => p.status === 'active');
  const activeUserCount = activeProfiles.length || 1; // avoid divide-by-zero

  // Total grocery expenses
  const totalGrocery = expenses
    .filter(e => e.category === 'grocery')
    .reduce((sum, e) => sum + e.amount, 0);

  // Total meals across all users (including guest meals)
  const totalMeals = meals.reduce((sum, m) => sum + m.count + (m.guest_count || 0), 0);
  const perMealRate = totalMeals > 0 ? totalGrocery / totalMeals : 0;

  return activeProfiles.map(profile => {
    const openingBalance = openingBalances[profile.id] ?? 0;

    // Meals for this user (including guest meals)
    const userMeals = meals
      .filter(m => m.user_id === profile.id)
      .reduce((sum, m) => sum + m.count + (m.guest_count || 0), 0);
    const mealCost = perMealRate * userMeals;

    // Fixed overhead share from admin-configured amounts (rent/maid/internet)
    const fixedOverheadShare = fixedOverheadConfigs
      .filter(c => c.user_id === profile.id)
      .reduce((sum, c) => sum + c.amount, 0);

    // Variable shared expense share (electricity, gas, misc — from split_details)
    let variableShare = 0;
    expenses.forEach(expense => {
      if (expense.category === 'grocery') return; // handled via meal cost
      if (['rent', 'internet', 'maid'].includes(expense.category)) return; // handled via fixed configs
      const splitDetails = expense.split_details as Record<string, number> | null;
      variableShare += splitDetails ? (splitDetails[profile.id] ?? 0) : 0;
    });

    const overheadShare = fixedOverheadShare + variableShare;

    // Shared expense share (gas/electricity total ÷ active users)
    const sharedExpenseShare = sharedExpenseConfigs.reduce(
      (sum, c) => sum + c.total_amount / activeUserCount,
      0
    );

    const totalShare = overheadShare + mealCost + sharedExpenseShare;

    // What this user has PAID (manually logged expenses)
    const totalPaid = expenses.reduce((sum, e) => {
      const paidDetails = e.paid_by_details as Record<string, number> | null;
      if (paidDetails && Object.keys(paidDetails).length > 0) {
        return sum + (paidDetails[profile.id] ?? 0);
      }
      return sum + (e.paid_by === profile.id ? e.amount : 0);
    }, 0);

    // balance = paid - share + opening
    const balance = totalPaid - totalShare + openingBalance;

    return {
      userId: profile.id,
      username: profile.username,
      avatarColor: profile.avatar_color,
      totalShare,
      totalPaid,
      balance,
      openingBalance,
      mealCount: userMeals,
      mealCost,
      overheadShare,
      fixedOverheadShare,
      variableShare,
      sharedExpenseShare,
    };
  });
}

// ---- Who Owes Whom (minimal cash flow) ----
export function computeWhoOwesWhom(
  balances: UserBalance[],
  profiles: Profile[]
): WhoOwesWhom[] {
  const profileMap = new Map(profiles.map(p => [p.id, p]));

  // Separate into debtors (balance < 0) and creditors (balance > 0)
  const debtors = balances
    .filter(b => b.balance < -0.01)
    .map(b => ({ ...b, remaining: -b.balance }))
    .sort((a, b) => b.remaining - a.remaining);

  const creditors = balances
    .filter(b => b.balance > 0.01)
    .map(b => ({ ...b, remaining: b.balance }))
    .sort((a, b) => b.remaining - a.remaining);

  const transactions: WhoOwesWhom[] = [];

  let di = 0;
  let ci = 0;

  while (di < debtors.length && ci < creditors.length) {
    const debtor = debtors[di];
    const creditor = creditors[ci];
    const amount = Math.min(debtor.remaining, creditor.remaining);

    if (amount > 0.01) {
      transactions.push({
        from: profileMap.get(debtor.userId)!,
        to: profileMap.get(creditor.userId)!,
        amount: Math.round(amount * 100) / 100,
      });
    }

    debtor.remaining -= amount;
    creditor.remaining -= amount;

    if (debtor.remaining < 0.01) di++;
    if (creditor.remaining < 0.01) ci++;
  }

  return transactions;
}

// ---- Expense split calculation ----
export function computeEvenSplit(
  amount: number,
  activeUserIds: string[]
): Record<string, number> {
  const share = amount / activeUserIds.length;
  const result: Record<string, number> = {};
  activeUserIds.forEach(id => {
    result[id] = Math.round(share * 100) / 100;
  });
  return result;
}

export function computeCustomSplit(
  amount: number,
  included: string[],
  customAmounts: Record<string, number> = {}
): Record<string, number> {
  const hasCustom = Object.keys(customAmounts).length > 0;
  if (hasCustom) return customAmounts;
  
  const share = amount / included.length;
  const result: Record<string, number> = {};
  included.forEach(id => {
    result[id] = Math.round(share * 100) / 100;
  });
  return result;
}

// ---- Formatting ----
export function formatBDT(amount: number): string {
  return `৳${Math.abs(amount).toLocaleString('en-BD', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export function getMonthLabel(label: string): string {
  const [year, month] = label.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return format(date, 'MMMM yyyy');
}
