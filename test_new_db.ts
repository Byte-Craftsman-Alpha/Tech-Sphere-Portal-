import supabase from './src/lib/supabase.ts';

async function checkTables() {
  const tables = ['ts_v2025_profiles', 'ts_v2025_events', 'ts_v2025_registrations'];
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`Table ${table}: MISSING or ERROR (${error.message})`);
    } else {
      console.log(`Table ${table}: EXISTS`);
    }
  }
}

checkTables();
