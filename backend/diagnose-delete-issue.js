require('dotenv').config({ path: './.env' });
const db = require('./db');

async function diagnoseDeletIssue() {
  console.log('='.repeat(60));
  console.log('DELETE ISSUE DIAGNOSTIC');
  console.log('='.repeat(60));
  console.log('');

  const userEmail = 'zunnoonwaheed@gmail.com';
  const entryId = 27;

  try {
    // 1. Check if user exists and get their local user ID
    console.log('1. Checking user in local database...');
    const userResult = await db.query('SELECT id, email, created_at FROM users WHERE email = $1', [userEmail]);

    if (userResult.rows.length === 0) {
      console.log('❌ User NOT FOUND in local database');
      console.log('   This is the problem! Google OAuth users need to be created in local DB');
      console.log('');
    } else {
      const user = userResult.rows[0];
      console.log('✅ User found:');
      console.log(`   - Local ID: ${user.id}`);
      console.log(`   - Email: ${user.email}`);
      console.log(`   - Created: ${user.created_at}`);
      console.log('');

      // 2. Check if entry 27 exists
      console.log('2. Checking entry 27...');
      const entryResult = await db.query(
        'SELECT id, user_id, transcript, journal_date, created_at FROM entries WHERE id = $1',
        [entryId]
      );

      if (entryResult.rows.length === 0) {
        console.log(`❌ Entry ${entryId} NOT FOUND in database`);
        console.log('');
      } else {
        const entry = entryResult.rows[0];
        console.log('✅ Entry found:');
        console.log(`   - Entry ID: ${entry.id}`);
        console.log(`   - User ID: ${entry.user_id}`);
        console.log(`   - Transcript: ${entry.transcript?.substring(0, 50)}...`);
        console.log(`   - Date: ${entry.journal_date}`);
        console.log(`   - Created: ${entry.created_at}`);
        console.log('');

        // 3. Check if user_id matches
        if (entry.user_id === user.id) {
          console.log('✅ User ID MATCHES! DELETE should work.');
          console.log('');
        } else {
          console.log(`❌ USER ID MISMATCH!`);
          console.log(`   - Entry belongs to user_id: ${entry.user_id}`);
          console.log(`   - But logged in user has user_id: ${user.id}`);
          console.log(`   - This is why DELETE fails!`);
          console.log('');
        }
      }

      // 4. Show all entries for this user
      console.log('3. All entries for this user...');
      const allEntriesResult = await db.query(
        'SELECT id, user_id, journal_date, created_at FROM entries WHERE user_id = $1 ORDER BY created_at DESC',
        [user.id]
      );

      if (allEntriesResult.rows.length === 0) {
        console.log(`   No entries found for user_id ${user.id}`);
        console.log('');
      } else {
        console.log(`   Found ${allEntriesResult.rows.length} entries:`);
        allEntriesResult.rows.forEach(e => {
          console.log(`   - Entry ${e.id}: ${e.journal_date} (created: ${e.created_at})`);
        });
        console.log('');
      }

      // 5. Check all users to find who owns entry 27
      console.log('4. Finding owner of entry 27...');
      const entryOwnerResult = await db.query(
        `SELECT e.id as entry_id, e.user_id, u.email, u.created_at
         FROM entries e
         LEFT JOIN users u ON e.user_id = u.id
         WHERE e.id = $1`,
        [entryId]
      );

      if (entryOwnerResult.rows.length > 0) {
        const owner = entryOwnerResult.rows[0];
        console.log('   Entry owner:');
        console.log(`   - User ID: ${owner.user_id}`);
        console.log(`   - Email: ${owner.email || 'NOT IN USERS TABLE'}`);
        console.log('');
      }
    }

    // 6. Show all users
    console.log('5. All users in database...');
    const allUsersResult = await db.query('SELECT id, email, created_at FROM users ORDER BY id');
    console.log(`   Found ${allUsersResult.rows.length} users:`);
    allUsersResult.rows.forEach(u => {
      console.log(`   - User ${u.id}: ${u.email} (created: ${u.created_at})`);
    });
    console.log('');

  } catch (err) {
    console.error('❌ Error during diagnostic:', err.message);
    console.error(err.stack);
  }

  console.log('='.repeat(60));
  console.log('DIAGNOSTIC COMPLETE');
  console.log('='.repeat(60));
}

diagnoseDeletIssue().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
