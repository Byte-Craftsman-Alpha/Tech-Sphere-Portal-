import supabase from './src/lib/supabase.ts'; // Assuming path from root

async function checkColumns() {
  const { data, error } = await supabase
    .from('ts_v2025_profiles')
    .select('*')
    .limit(1)
    .single();
  
  if (error) {
    console.error('Error fetching one profile:', error.message);
  } else {
    console.log('Columns in ts_v2025_profiles:', Object.keys(data));
  }

  const { data: eventData, error: eventError } = await supabase
    .from('ts_v2025_events')
    .select('*')
    .limit(1)
    .single();

  if (eventError) {
    console.error('Error fetching one event:', eventError.message);
  } else {
    console.log('Columns in ts_v2025_events:', Object.keys(eventData));
  }
}

checkColumns();
