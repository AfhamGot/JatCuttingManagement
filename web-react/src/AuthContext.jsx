import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { api, setToken, setStoredUser, getStoredUser } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser());
  const [error, setError] = useState('');
  const updateUser = useCallback(value => { setStoredUser(value); setUser(value); }, []);
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    api.profile().then(data => { if (!cancelled) updateUser(data.user); }).catch(() => {});
    return () => { cancelled = true; };
  }, [user?.id, updateUser]);

  const login = useCallback(async (email, password) => {
    setError('');
    try {
      const data = await api.login(email, password);
      if (data.user.role === 'customer') {
        throw new Error('This is the staff dashboard. Customers should use the mobile app.');
      }
      setToken(data.token);
      setStoredUser(data.user);
      setUser(data.user);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // Ignore network/API errors on logout - clear local session regardless.
    }
    setToken(null);
    setStoredUser(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, error, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
