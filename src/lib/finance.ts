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

import { CarryForwardBalance } from './types';

export function parseCarryForward(val: any): CarryForwardBalance {
  if (!val) return { mealBalance: 0, expenseBalance: 0, total: 0 };
  if (typeof val === 'number') {
    return {
      mealBalance: val < 0 ? val : 0,
      expenseBalance: val > 0 ? val : 0,
      total: val,
    };
  }
  if (typeof val === 'object') {
    const meal = Number(val.mealBalance ?? 0);
    const exp = Number(val.expenseBalance ?? 0);
    const tot = Number(val.total ?? (meal + exp));
    return { mealBalance: meal, expenseBalance: exp, total: tot };
  }
  return { mealBalance: 0, expenseBalance: 0, total: 0 };
}

// Automatically computes / syncs opening balances for any month from its preceding month.
// June (2026-06) is the start month with 0 opening balance.
// For July, August, September... it carries forward the preceding month's itemized meal & monthly expense balances.
export async function getOpeningBalancesForMonth(
  month: Month,
  allMonths: Month[]
): Promise<Record<string, CarryForwardBalance>> {
  if (month.label === '2026-06') {
    return {};
  }

  const [year, mNum] = month.label.split('-').map(Number);
  const prevDate = new Date(year, mNum - 2, 1);
  const prevLabel = format(prevDate, 'yyyy-MM');

  const prevMonth = allMonths.find(m => m.label === prevLabel);
  if (!prevMonth) {
    const stored = (month.opening_balances as Record<string, any>) ?? {};
    const parsed: Record<string, CarryForwardBalance> = {};
    Object.entries(stored).forEach(([uid, v]) => { parsed[uid] = parseCarryForward(v); });
    return parsed;
  }

  try {
    // Recursively resolve previous month's opening balances so the entire chain is fresh and accurate
    const prevOpening = await getOpeningBalancesForMonth(prevMonth, allMonths);

    const [profilesRes, expRes, mealRes, fixedRes, sharedRes, advanceRes] = await Promise.all([
      (supabase as any).from('profiles').select('*').eq('status', 'active'),
      (supabase as any).from('expenses').select('*').eq('month_id', prevMonth.id),
      (supabase as any).from('meals').select('*').eq('month_id', prevMonth.id),
      (supabase as any).from('fixed_overhead_configs').select('*').eq('month_id', prevMonth.id),
      (supabase as any).from('shared_expense_configs').select('*').eq('month_id', prevMonth.id),
      (supabase as any).from('expenses').select('*').eq('is_advance', true).eq('advance_for_month', prevMonth.label),
    ]);

    const profs = (profilesRes.data ?? []) as Profile[];
    const exps = (expRes.data ?? []) as Expense[];
    const mls = (mealRes.data ?? []) as Meal[];
    const fxd = (fixedRes.data ?? []) as import('./types').FixedOverheadConfig[];
    const shd = (sharedRes.data ?? []) as import('./types').SharedExpenseConfig[];

    const advCredits: Record<string, number> = {};
    (advanceRes.data ?? []).forEach((e: Expense) => {
      const pd = e.paid_by_details as Record<string, number> | null;
      if (pd && Object.keys(pd).length > 0) {
        Object.entries(pd).forEach(([uid, amt]) => { advCredits[uid] = (advCredits[uid] ?? 0) + amt; });
      } else {
        advCredits[e.paid_by] = (advCredits[e.paid_by] ?? 0) + e.amount;
      }
    });

    const prevBalances = calculateBalances(exps, mls, profs, prevOpening, fxd, shd, advCredits);

    const computedCarryForward: Record<string, CarryForwardBalance> = {};
    prevBalances.forEach(b => {
      // 1. Meal balance: what the user paid toward grocery vs what their meals actually cost.
      //    Positive = overpaid grocery (credit to next month's Total Paid), Negative = meal debt (due next month).
      const userGrocerySpent = exps
        .filter(e => e.category === 'grocery')
        .reduce((sum, e) => {
          const paidDetails = e.paid_by_details as Record<string, number> | null;
          if (paidDetails && Object.keys(paidDetails).length > 0) {
            return sum + (paidDetails[b.userId] ?? 0);
          }
          return sum + (e.paid_by === b.userId ? e.amount : 0);
        }, 0);
      const mealBalance = Math.round((userGrocerySpent - b.mealCost) * 100) / 100;

      // 2. Monthly expense balance: Total Paid vs Monthly Expense in the previous month.
      //    Mirrors the dashboard numbers:
      //    Monthly Expense = Fixed + Shared + prev meal due + prev expense due
      //    Total Paid = non-grocery paid + advance + prev meal overpaid + prev expense overpaid
      //    expenseBalance = Total Paid - Monthly Expense
      //    Positive = overpaid (credit to next month's Total Paid), Negative = due (added to next month's Monthly Expense)
      const pCarry = parseCarryForward(prevOpening[b.userId]);
      const pMealDue = pCarry.mealBalance < 0 ? Math.abs(pCarry.mealBalance) : 0;
      const pMealOverpaid = pCarry.mealBalance > 0 ? pCarry.mealBalance : 0;
      const pExpDue = pCarry.expenseBalance < 0 ? Math.abs(pCarry.expenseBalance) : 0;
      const pExpOverpaid = pCarry.expenseBalance > 0 ? pCarry.expenseBalance : 0;

      const prevMonthlyExp = b.fixedOverheadShare + b.sharedExpenseShare + pMealDue + pExpDue;
      const prevTotalPaidTile = (b.totalPaid - userGrocerySpent) + b.advanceCredit + pMealOverpaid + pExpOverpaid;
      const expenseBalance = Math.round((prevTotalPaidTile - prevMonthlyExp) * 100) / 100;

      const total = Math.round((mealBalance + expenseBalance) * 100) / 100;

      computedCarryForward[b.userId] = {
        mealBalance,
        expenseBalance,
        total,
      };
    });

    // Update in DB if different to keep it cached
    const currentOpening = (month.opening_balances as Record<string, any>) ?? {};
    const isDiff = JSON.stringify(currentOpening) !== JSON.stringify(computedCarryForward);
    if (isDiff) {
      await (supabase as any)
        .from('months')
        .update({ opening_balances: computedCarryForward })
        .eq('id', month.id);
    }

    return computedCarryForward;
  } catch (err) {
    console.error('Error computing opening balances:', err);
    const stored = (month.opening_balances as Record<string, any>) ?? {};
    const parsed: Record<string, CarryForwardBalance> = {};
    Object.entries(stored).forEach(([uid, v]) => { parsed[uid] = parseCarryForward(v); });
    return parsed;
  }
}

// ---- Balance calculation ----
export function calculateBalances(
  expenses: Expense[],
  meals: Meal[],
  profiles: Profile[],
  openingBalances: Record<string, any> = {},
  fixedOverheadConfigs: import('./types').FixedOverheadConfig[] = [],
  sharedExpenseConfigs: import('./types').SharedExpenseConfig[] = [],
  // Credits from advance payments made in a previous month that cover THIS month.
  // Map of userId → total advance credit amount.
  advanceCredits: Record<string, number> = {}
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
    const rawOpening = openingBalances[profile.id];
    const carry = parseCarryForward(rawOpening);
    const openingBalance = carry.total;

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

    // mealCost is intentionally excluded from totalShare.
    // Grocery/meal costs are deferred: they are carried forward as debt into the next month
    // when the admin closes the month (via handleCloseMonth in admin/month/page.tsx).
    const totalShare = overheadShare + sharedExpenseShare;

    // What this user has PAID (manually logged expenses).
    // Advance payments (is_advance=true) are EXCLUDED: they belong to the target month's credit,
    // not the current month's settlement. Including them here would cause double-counting.
    const totalPaid = expenses.reduce((sum, e) => {
      if (e.is_advance) return sum; // skip — credited in advance_for_month instead
      const paidDetails = e.paid_by_details as Record<string, number> | null;
      if (paidDetails && Object.keys(paidDetails).length > 0) {
        return sum + (paidDetails[profile.id] ?? 0);
      }
      return sum + (e.paid_by === profile.id ? e.amount : 0);
    }, 0);

    // Advance credit: payments made in a previous month specifically for this month.
    const advanceCredit = advanceCredits[profile.id] ?? 0;

    // balance = paid + advanceCredit - share + opening
    const balance = totalPaid + advanceCredit - totalShare + openingBalance;

    return {
      userId: profile.id,
      username: profile.username,
      avatarColor: profile.avatar_color,
      totalShare,
      totalPaid,
      balance,
      openingBalance,
      carryForward: carry,
      mealCount: userMeals,
      mealCost,
      overheadShare,
      fixedOverheadShare,
      variableShare,
      sharedExpenseShare,
      advanceCredit,
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
