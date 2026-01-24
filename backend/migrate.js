const db = require('./db');

console.log('Running migration to add journal_date column...');

try {
  // Check if column exists
  const stmt = db.prepare('PRAGMA table_info(entries)');
  const columns = stmt.all();
  const hasJournalDate = columns.some(col => col.name === 'journal_date');
  
  if (!hasJournalDate) {
    console.log('Adding journal_date column...');
    // SQLite doesn't allow functions in DEFAULT when adding columns
    // So we add it without default, then update existing rows
    db.exec('ALTER TABLE entries ADD COLUMN journal_date DATE');
    
    // Update existing rows to use created_at date
    db.exec(`UPDATE entries SET journal_date = date(created_at) WHERE journal_date IS NULL`);
    
    console.log('✓ Column added successfully!');
  } else {
    console.log('✓ Column already exists, no migration needed.');
  }
  
  // Verify
  const stmt2 = db.prepare('PRAGMA table_info(entries)');
  const columns2 = stmt2.all();
  console.log('Current columns:', columns2.map(c => c.name).join(', '));
  
  process.exit(0);
} catch (error) {
  console.error('Migration error:', error);
  process.exit(1);
}

