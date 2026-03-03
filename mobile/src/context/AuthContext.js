import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginUser, registerUser } from '../services/api';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const username = await AsyncStorage.getItem('username');
      if (token && username) {
        setUser({ username, token });
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
    await AsyncStorage.setItem('username', username);
    setUser({ username, token: access });
  };

  const register = async (username, email, password) => {
    await registerUser(username, email, password);
  };

  const logout = async () => {
    await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'username']);
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
