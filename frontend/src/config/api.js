// Auto-detect API URL based on current hostname
const getApiBase = () => {
  // If explicitly set in environment, use that
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // Auto-detect Vercel deployment
  const hostname = window.location.hostname;
  if (hostname.includes('vercel.app')) {
    return `https://${hostname}/api/journal-ease`;
  }
  
  // Fallback to localhost for development
  return import.meta.env.VITE_API_BASE || "http://127.0.0.1:4000/api/journal-ease";
};

const API_BASE = getApiBase();

export { API_BASE };
