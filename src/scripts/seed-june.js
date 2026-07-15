const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://wuwhvbourcqdflwtkotz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1d2h2Ym91cmNxZGZsd3Rrb3R6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mzc1NjkwNCwiZXhwIjoyMDk5MzMyOTA0fQ.DtGtK_PC50Zf4Et7EVPE7j70F8wyzWRLkF4gNFV6QuQ'
);

const userIds = {
  Moon:   "69d50b0e-0feb-4283-99ba-695b5abdfaa0",
  Badhon: "3d212ed5-ba51-40a1-873e-674a5eda1676",
  Shaon:  "1c1836bb-ab06-4bf3-80a7-765be51f645e",
  Asif:   "0ab22931-612c-4966-9019-4d5071285154"
};

const mealsData = [
  { day: 1,  Badhon: 0, Shaon: 0, Asif: 0, Moon: 0 },
  { day: 2,  Badhon: 0, Shaon: 1, Asif: 1, Moon: 0 },
  { day: 3,  Badhon: 0, Shaon: 1, Asif: 1, Moon: 0 },
  { day: 4,  Badhon: 0, Shaon: 0, Asif: 2, Moon: 1 },
  { day: 5,  Badhon: 1, Shaon: 0, Asif: 2, Moon: 2 }, // Friday
  { day: 6,  Badhon: 1, Shaon: 1, Asif: 1, Moon: 1 },
  { day: 7,  Badhon: 1, Shaon: 1, Asif: 1, Moon: 1 },
  { day: 8,  Badhon: 1, Shaon: 1, Asif: 1, Moon: 1 },
  { day: 9,  Badhon: 1, Shaon: 1, Asif: 2, Moon: 1 },
  { day: 10, Badhon: 1, Shaon: 1, Asif: 2, Moon: 1 },
  { day: 11, Badhon: 1, Shaon: 1, Asif: 3, Moon: 0 },
  { day: 12, Badhon: 2, Shaon: 1, Asif: 4, Moon: 0 }, // Friday
  { day: 13, Badhon: 1, Shaon: 0, Asif: 0, Moon: 1 },
  { day: 14, Badhon: 1, Shaon: 0, Asif: 2, Moon: 1 },
  { day: 15, Badhon: 1, Shaon: 0, Asif: 1, Moon: 1 },
  { day: 16, Badhon: 0, Shaon: 1, Asif: 2, Moon: 1 },
  { day: 17, Badhon: 1, Shaon: 1, Asif: 2, Moon: 1 },
  { day: 18, Badhon: 1, Shaon: 1, Asif: 1, Moon: 0 },
  { day: 19, Badhon: 2, Shaon: 1, Asif: 2, Moon: 0 }, // Friday
  { day: 20, Badhon: 1, Shaon: 1, Asif: 2, Moon: 0 },
  { day: 21, Badhon: 0, Shaon: 1, Asif: 1, Moon: 0 },
  { day: 22, Badhon: 1, Shaon: 1, Asif: 2, Moon: 0 },
  { day: 23, Badhon: 1, Shaon: 0, Asif: 0, Moon: 1 },
  { day: 24, Badhon: 1, Shaon: 0, Asif: 0, Moon: 1 },
  { day: 25, Badhon: 1, Shaon: 0, Asif: 0, Moon: 1 },
  { day: 26, Badhon: 1, Shaon: 0, Asif: 0, Moon: 2 }, // Friday
  { day: 27, Badhon: 1, Shaon: 1, Asif: 0, Moon: 1 },
  { day: 28, Badhon: 1, Shaon: 0, Asif: 1, Moon: 1 },
  { day: 29, Badhon: 1, Shaon: 0, Asif: 0, Moon: 1 },
  { day: 30, Badhon: 1, Shaon: 1, Asif: 0, Moon: 1 }
];

const groceryExpenses = [
  { day: 4,  paidBy: "Asif",   amount: 885 },
  { day: 7,  paidBy: "Asif",   amount: 840 },
  { day: 10, paidBy: "Asif",   amount: 270 },
  { day: 13, paidBy: "Badhon", amount: 785 },
  { day: 14, paidBy: "Shaon",  amount: 1020 },
  { day: 17, paidBy: "Badhon", amount: 307 },
  { day: 17, paidBy: "Moon",   amount: 370 },
  { day: 20, paidBy: "Shaon",  amount: 1590 },
  { day: 22, paidBy: "Badhon", amount: 118 },
  { day: 24, paidBy: "Shaon",  amount: 518 }
];

async function seed() {
  console.log('Starting seed process for June 2026...');
  
  // 1. Get or create June month
  let { data: month, error: monthError } = await supabase
    .from('months')
    .select('*')
    .eq('label', '2026-06')
    .maybeSingle();

  if (monthError) {
    console.error('Error fetching month:', monthError);
    return;
  }

  if (!month) {
    console.log('Month June 2026 not found, inserting...');
    const { data: newMonth, error: insertError } = await supabase
      .from('months')
      .insert({
        label: '2026-06',
        is_closed: true, // June is closed as it is in the past
        closed_at: new Date().toISOString(),
        opening_balances: {}
      })
      .select()
      .single();
    
    if (insertError) {
      console.error('Error inserting month:', insertError);
      return;
    }
    month = newMonth;
  }
  
  console.log(`Month June 2026 ID: ${month.id}`);

  // 2. Clean existing meals & expenses for June to prevent duplicates
  console.log('Cleaning existing meals/expenses for June 2026...');
  await supabase.from('meals').delete().eq('month_id', month.id);
  await supabase.from('expenses').delete().eq('month_id', month.id);

  // 3. Insert meals
  console.log('Inserting meals...');
  const mealsToInsert = [];
  
  for (const row of mealsData) {
    const dayStr = String(row.day).padStart(2, '0');
    const dateStr = `2026-06-${dayStr}`;
    const isFriday = [5, 12, 19, 26].includes(row.day);

    for (const [name, uid] of Object.entries(userIds)) {
      const totalMeals = row[name] ?? 0;
      let regularCount = 0;
      let guestCount = 0;

      if (name === 'Asif') {
        const standard = isFriday ? 2 : 1;
        regularCount = Math.min(totalMeals, standard);
        guestCount = Math.max(0, totalMeals - standard);
      } else {
        const standard = 1;
        regularCount = Math.min(totalMeals, standard);
        guestCount = Math.max(0, totalMeals - standard);
      }

      mealsToInsert.push({
        user_id: uid,
        month_id: month.id,
        date: dateStr,
        count: regularCount,
        guest_count: guestCount
      });
    }
  }

  const { error: mealsErr } = await supabase.from('meals').insert(mealsToInsert);
  if (mealsErr) {
    console.error('Error inserting meals:', mealsErr);
    return;
  }
  console.log(`Successfully inserted ${mealsToInsert.length} meal entries.`);

  // 4. Insert grocery expenses
  console.log('Inserting grocery expenses...');
  const expensesToInsert = [];

  // Compute even split details for all active flatmates
  const activeUids = Object.values(userIds);
  
  for (const exp of groceryExpenses) {
    const dayStr = String(exp.day).padStart(2, '0');
    const dateStr = `2026-06-${dayStr}`;
    const paidByUid = userIds[exp.paidBy];
    
    // Split evenly among all 4 active users
    const share = exp.amount / activeUids.length;
    const splitDetails = {};
    activeUids.forEach(uid => {
      splitDetails[uid] = Math.round(share * 100) / 100;
    });

    expensesToInsert.push({
      month_id: month.id,
      paid_by: paidByUid,
      category: 'grocery',
      description: 'Grocery / Bazar',
      amount: exp.amount,
      paid_full: false,
      split_type: 'even',
      split_details: splitDetails,
      paid_by_details: {},
      created_at: `${dateStr}T10:00:00Z`
    });
  }

  const { error: expErr } = await supabase.from('expenses').insert(expensesToInsert);
  if (expErr) {
    console.error('Error inserting grocery expenses:', expErr);
    return;
  }
  console.log(`Successfully inserted ${expensesToInsert.length} grocery expenses.`);
  console.log('June 2026 seed process complete successfully!');
}

seed();
