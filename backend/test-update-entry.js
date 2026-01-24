require('dotenv').config({ path: './.env' });
const db = require('./db');

async function testUpdate() {
  console.log('='.repeat(60));
  console.log('TEST UPDATE ENTRY');
  console.log('='.repeat(60));
  console.log('');

  const email = 'zunnoonwaheed@gmail.com';
  const entryId = 34;
  const newDate = '2026-01-07';

  try {
    // 1. Get user ID
    console.log('1. Getting user ID...');
    const userResult = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (!userResult.rows[0]) {
      console.log('❌ User not found!');
      return;
    }
    const userId = userResult.rows[0].id;
    console.log(`✅ User ID: ${userId}`);
    console.log('');

    // 2. Check entry exists
    console.log('2. Checking if entry exists...');
    const entryCheck = await db.query('SELECT id, user_id, journal_date FROM entries WHERE id = $1', [entryId]);
    if (!entryCheck.rows[0]) {
      console.log(`❌ Entry ${entryId} NOT FOUND!`);
      return;
    }
    console.log(`✅ Entry ${entryId} exists`);
    console.log(`   - Current user_id: ${entryCheck.rows[0].user_id}`);
    console.log(`   - Current journal_date: ${entryCheck.rows[0].journal_date}`);
    console.log('');

    // 3. Check if entry belongs to user
    if (entryCheck.rows[0].user_id !== userId) {
      console.log(`❌ MISMATCH! Entry belongs to user ${entryCheck.rows[0].user_id}, not ${userId}`);
      return;
    }
    console.log(`✅ Entry belongs to user ${userId}`);
    console.log('');

    // 4. Try to update
    console.log(`3. Updating entry ${entryId} to date ${newDate}...`);
    const updateResult = await db.query(
      'UPDATE entries SET journal_date = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3',
      [newDate, entryId, userId]
    );
    console.log(`   Rows updated: ${updateResult.rowCount}`);

    if (updateResult.rowCount === 0) {
      console.log(`❌ UPDATE FAILED - No rows updated`);
    } else {
      console.log(`✅ UPDATE SUCCESSFUL`);

      // Verify the update
      const verifyResult = await db.query(
        'SELECT id, user_id, journal_date FROM entries WHERE id = $1',
        [entryId]
      );
      console.log(`   New journal_date: ${verifyResult.rows[0].journal_date}`);
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
  }

  console.log('');
  console.log('='.repeat(60));
}

testUpdate().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
