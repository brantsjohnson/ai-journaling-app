// Auto-detect API URL based on current hostname
const getApiBase = () => {
  // If explicitly set in environment, use that
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // Auto-detect API URL from current hostname
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  
  // If we're on localhost (development), use localhost API
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return import.meta.env.VITE_API_BASE || "http://127.0.0.1:4000/api/journal-ease";
  }
  
  // For any other domain (including Vercel), use the same domain for API
  // This prevents localhost fallback on production deployments
  return `${protocol}//${hostname}/api/journal-ease`;
};

const API_BASE = getApiBase();

export { API_BASE };
