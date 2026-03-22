import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginUser, registerUser, getCurrentUser } from '../services/api';

const AuthContext = createContext({});
const CURRENT_USER_KEY = 'currentUser';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const persistUser = async (nextUser) => {
    await AsyncStorage.setItem('username', nextUser.username);
    await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(nextUser));
  };

  const hydrateCurrentUser = async (token, fallbackUsername = null) => {
    try {
      const res = await getCurrentUser();
      await persistUser(res.data);
      setUser({ ...res.data, token });
    } catch {
      const storedUser = await AsyncStorage.getItem(CURRENT_USER_KEY);
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        setUser({ ...parsedUser, token });
        return;
      }

      if (fallbackUsername) {
        setUser({ username: fallbackUsername, token });
      }
    }
  };

  const loadStoredAuth = async () => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const username = await AsyncStorage.getItem('username');
      if (token) {
        await hydrateCurrentUser(token, username);
      }
    } catch (e) {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    const res = await loginUser(username, password);
    const { access, refresh } = res.data;
    await AsyncStorage.setItem('accessToken', access);
    await AsyncStorage.setItem('refreshToken', refresh);
    await hydrateCurrentUser(access, username);
  };

  const register = async (username, email, password) => {
    await registerUser(username, email, password);
  };

  const logout = async () => {
    await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'username', CURRENT_USER_KEY]);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

export default AuthContext;
