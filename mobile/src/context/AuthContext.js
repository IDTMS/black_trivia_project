import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginUser, registerUser, getCurrentUser } from '../services/api';

const AuthContext = createContext({});
const CURRENT_USER_KEY = 'currentUser';
const AUTH_KEYS = ['accessToken', 'refreshToken', 'username', CURRENT_USER_KEY];

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const clearStoredAuth = async () => {
    await AsyncStorage.multiRemove(AUTH_KEYS);
  };

  const persistUser = async (nextUser) => {
    await AsyncStorage.setItem('username', nextUser.username);
    await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(nextUser));
  };

  const hydrateCurrentUser = async (token, fallbackUsername = null) => {
    try {
      const res = await getCurrentUser();
      await persistUser(res.data);
      setUser({ ...res.data, token });
      setAuthError('');
      return true;
    } catch {
      const storedUser = await AsyncStorage.getItem(CURRENT_USER_KEY);
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        setUser({ ...parsedUser, token });
        setAuthError('');
        return true;
      }

      await clearStoredAuth();
      setUser(null);
      if (fallbackUsername) {
        setAuthError(`Couldn't load ${fallbackUsername}'s account data. Please sign in again.`);
      } else {
        setAuthError('Session expired. Sign in again.');
      }
      return false;
    }
  };

  const loadStoredAuth = async () => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const username = await AsyncStorage.getItem('username');
      if (token) {
        await hydrateCurrentUser(token, username);
      }
    } catch {
      await clearStoredAuth();
      setUser(null);
      setAuthError('Could not restore your session. Sign in again.');
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    setAuthError('');
    const res = await loginUser(username, password);
    const { access, refresh } = res.data;
    await AsyncStorage.setItem('accessToken', access);
    await AsyncStorage.setItem('refreshToken', refresh);
    const hydrated = await hydrateCurrentUser(access, username);
    if (!hydrated) {
      throw new Error('Could not load account after login.');
    }
  };

  const register = async (username, email, password) => {
    setAuthError('');
    await registerUser(username, email, password);
  };

  const logout = async () => {
    await clearStoredAuth();
    setUser(null);
    setAuthError('');
  };

  return (
    <AuthContext.Provider value={{ user, loading, authError, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

export default AuthContext;
