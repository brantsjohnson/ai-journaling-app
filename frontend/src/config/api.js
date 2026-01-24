// Use environment variable if set, otherwise:
// - In production (Vercel): use relative path (same domain)
// - In development: use localhost
const getApiBase = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (import.meta.env.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE;
  }
  // In production (Vercel), use relative path since frontend and API are on same domain
  if (import.meta.env.PROD || window.location.hostname.includes('vercel.app')) {
    return '/api/journal-ease';
  }
  // In development, use localhost
  return 'http://127.0.0.1:4000/api/journal-ease';
};

const API_BASE = getApiBase();

// Debug logging
console.log('🔍 API Configuration Debug:');
console.log('  - VITE_API_URL:', import.meta.env.VITE_API_URL);
console.log('  - VITE_API_BASE:', import.meta.env.VITE_API_BASE);
console.log('  - PROD:', import.meta.env.PROD);
console.log('  - Hostname:', typeof window !== 'undefined' ? window.location.hostname : 'N/A');
console.log('  - Final API_BASE:', API_BASE);
console.log('  - Full URL example:', API_BASE + '/auth/login');

export { API_BASE };
