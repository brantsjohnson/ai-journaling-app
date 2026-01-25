import { createContext, useContext, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { supabase } from '../config/supabase';
import axios from 'axios';
import { API_BASE } from '../config/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Sync Supabase user with backend database
  const syncSupabaseUser = async (session) => {
    try {
      await axios.post(API_BASE + '/auth/sync-supabase-user', {
        supabaseUserId: session.user.id,
        email: session.user.email,
        name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email,
      });
      console.log('User synced with backend database');
    } catch (err) {
      console.error('Error syncing user with backend:', err);
    }
  };

  // Load user from Supabase session on mount
  useEffect(() => {
    const restoreSession = async () => {
      try {
        // First, try to restore from localStorage (faster, more persistent)
        const storedToken = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');
        
        if (storedToken && storedUser) {
          try {
            const userData = JSON.parse(storedUser);
            // Try to verify token, but don't fail if it's expired - keep user logged in
            try {
              const { data: { user } } = await supabase.auth.getUser(storedToken);
              if (user) {
                setUser(userData);
                setToken(storedToken);
                setLoading(false);
                // Refresh session in background
                supabase.auth.getSession().then(({ data: { session } }) => {
                  if (session) {
                    setToken(session.access_token);
                    localStorage.setItem('token', session.access_token);
                  }
                });
                return;
              }
            } catch (err) {
              // Token might be expired, but keep user logged in anyway
              console.log('Token verification failed, but keeping user logged in');
            }
            
            // Even if token verification fails, keep user logged in from localStorage
            setUser(userData);
            setToken(storedToken);
            setLoading(false);
            
            // Try to refresh session in background
            supabase.auth.getSession().then(({ data: { session } }) => {
              if (session) {
                setToken(session.access_token);
                localStorage.setItem('token', session.access_token);
                localStorage.setItem('user', JSON.stringify({
                  id: session.user.id,
                  email: session.user.email,
                  name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email,
                }));
              }
            });
            return;
          } catch (err) {
            console.log('Error parsing stored user, trying Supabase session...');
          }
        }
        
        // Fallback: try to get Supabase session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (session && !error) {
          // Supabase session exists
          const userData = {
            id: session.user.id,
            email: session.user.email,
            name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email,
          };
          setUser(userData);
          setToken(session.access_token);
          // Sync with localStorage as backup
          localStorage.setItem('token', session.access_token);
          localStorage.setItem('user', JSON.stringify(userData));
          
          // Sync user with backend database
          syncSupabaseUser(session);
          
          setLoading(false);
          return;
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error restoring session:', err);
        setLoading(false);
      }
    };

    restoreSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        const userData = {
          id: session.user.id,
          email: session.user.email,
          name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email,
        };
        setUser(userData);
        setToken(session.access_token);
        // Keep localStorage in sync
        localStorage.setItem('token', session.access_token);
        localStorage.setItem('user', JSON.stringify(userData));
        
        // Sync user with backend database on auth state change
        syncSupabaseUser(session);
      } else {
        setUser(null);
        setToken(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    localStorage.setItem('token', authToken);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useAuth = () => {
  return useContext(AuthContext);
};

