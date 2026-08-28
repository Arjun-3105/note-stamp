import 'dotenv/config';
import { supabaseServer, TABLES } from '../src/lib/supabase-server';

async function checkTables() {
  console.log('Checking Supabase Database Tables...\n');

  for (const tableName of Object.values(TABLES)) {
    try {
      const { error } = await supabaseServer
        .from(tableName)
        .select('*')
        .limit(1);

      if (error) {
        console.log(`❌ Table '${tableName}': MISSING or Error -> ${error.message}`);
      } else {
        console.log(`✅ Table '${tableName}': READY`);
      }
    } catch (err: any) {
      console.log(`❌ Table '${tableName}': ERROR -> ${err?.message || err}`);
    }
  }

  console.log('\n------------------------------------------------------------');
  console.log('To create missing tables, copy and execute the SQL file:');
  console.log('📄 scripts/setup-db.sql');
  console.log('in your Supabase SQL Editor: https://supabase.com/dashboard');
  console.log('------------------------------------------------------------\n');
}

checkTables().catch(console.error);
