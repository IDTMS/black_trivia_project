import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import { COLORS } from './src/constants/theme';
import { Analytics } from '@vercel/analytics/react';

const navTheme = {
  dark: true,
  colors: {
    primary: COLORS.gold,
    background: COLORS.background,
    card: COLORS.darkGray,
    text: COLORS.white,
    border: COLORS.border,
    notification: COLORS.gold,
  },
};

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer theme={navTheme}>
        <StatusBar style="light" />
        <AppNavigator />
        <Analytics />
      </NavigationContainer>
    </AuthProvider>
  );
}
