require('dotenv').config({ path: './.env' });

const apiKey = process.env.OPEN_AI_KEY;

console.log('API Key Analysis:');
console.log('================');
console.log('Length:', apiKey?.length || 0);
console.log('First 20 chars:', apiKey?.substring(0, 20));
console.log('Last 20 chars:', apiKey?.substring(apiKey.length - 20));
console.log('');
console.log('Character Analysis:');
console.log('Has newline:', apiKey?.includes('\n'));
console.log('Has carriage return:', apiKey?.includes('\r'));
console.log('Has tab:', apiKey?.includes('\t'));
console.log('Has space:', apiKey?.includes(' '));
console.log('');
console.log('Testing Authorization header format:');
const authHeader = `Bearer ${apiKey}`;
console.log('Header length:', authHeader.length);
console.log('Header first 30 chars:', authHeader.substring(0, 30));
console.log('Header last 30 chars:', authHeader.substring(authHeader.length - 30));
console.log('');
console.log('Checking for non-ASCII characters...');
for (let i = 0; i < apiKey.length; i++) {
  const code = apiKey.charCodeAt(i);
  if (code < 32 || code > 126) {
    console.log(`  Found non-ASCII at position ${i}: charCode=${code} (${JSON.stringify(apiKey[i])})`);
  }
}
console.log('Done!');
