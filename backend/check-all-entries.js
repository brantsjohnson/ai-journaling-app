require('dotenv').config({ path: './.env' });
const db = require('./db');

async function checkAllEntries() {
  console.log('='.repeat(60));
  console.log('ALL ENTRIES IN DATABASE');
  console.log('='.repeat(60));
  console.log('');

  try {
    const entriesResult = await db.query(
      `SELECT e.id, e.user_id, u.email, e.journal_date, e.created_at,
              LEFT(e.transcript, 50) as transcript_preview
       FROM entries e
       LEFT JOIN users u ON e.user_id = u.id
       ORDER BY e.created_at DESC
       LIMIT 50`
    );

    if (entriesResult.rows.length === 0) {
      console.log('❌ NO ENTRIES FOUND in the database');
      console.log('');
    } else {
      console.log(`✅ Found ${entriesResult.rows.length} entries:`);
      console.log('');
      entriesResult.rows.forEach(e => {
        console.log(`Entry ${e.id}:`);
        console.log(`  - User: ${e.email || 'UNKNOWN'} (ID: ${e.user_id})`);
        console.log(`  - Date: ${e.journal_date}`);
        console.log(`  - Transcript: ${e.transcript_preview || 'null'}...`);
        console.log(`  - Created: ${e.created_at}`);
        console.log('');
      });
    }

    // Count entries per user
    const countResult = await db.query(
      `SELECT u.id, u.email, COUNT(e.id) as entry_count
       FROM users u
       LEFT JOIN entries e ON u.id = e.user_id
       GROUP BY u.id, u.email
       HAVING COUNT(e.id) > 0
       ORDER BY COUNT(e.id) DESC`
    );

    console.log('ENTRIES PER USER:');
    if (countResult.rows.length === 0) {
      console.log('  No users have entries');
    } else {
      countResult.rows.forEach(u => {
        console.log(`  - ${u.email}: ${u.entry_count} entries`);
      });
    }
    console.log('');

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
  }

  console.log('='.repeat(60));
}

checkAllEntries().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
