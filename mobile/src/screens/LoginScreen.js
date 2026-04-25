import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { COLORS, FONTS, SIZES } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import StatusBanner from '../components/StatusBanner';

const LoginScreen = ({ navigation }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [inlineError, setInlineError] = useState('');
  const { login, authError } = useAuth();

  useEffect(() => {
    if (authError) {
      setInlineError(authError);
    }
  }, [authError]);

  const handleLogin = async () => {
    const trimmedUsername = username.trim();
    if (!trimmedUsername || !password.trim()) {
      setInlineError('Enter your username and password.');
      return;
    }

    setInlineError('');
    setLoading(true);
    try {
      await login(trimmedUsername, password);
    } catch (error) {
      const responseData = error.response?.data;
      let msg = responseData?.detail || 'Login failed. Check your credentials.';
      if (!responseData?.detail && responseData && typeof responseData === 'object') {
        const firstError = Object.values(responseData)[0];
        msg = Array.isArray(firstError) ? firstError[0] : String(firstError);
      }
      setInlineError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        {/* Logo / Title */}
        <View style={styles.header}>
          <Text style={styles.logo}>BLACK</Text>
          <Text style={styles.logoCard}>CARD</Text>
          <Text style={styles.subtitle}>The Culture Trivia Game</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <StatusBanner message={inlineError} type="error" />
          <TextInput
            style={styles.input}
            placeholder="Username"
            placeholderTextColor={COLORS.gray}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={COLORS.gray}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.black} />
            ) : (
              <Text style={styles.buttonText}>SIGN IN</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Register link */}
        <TouchableOpacity
          style={styles.registerLink}
          onPress={() => navigation.navigate('Register')}
        >
          <Text style={styles.registerText}>
            New here? <Text style={styles.registerHighlight}>Create account</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    fontSize: 52,
    color: COLORS.white,
    ...FONTS.bold,
    letterSpacing: 8,
  },
  logoCard: {
    fontSize: 52,
    color: COLORS.gold,
    ...FONTS.bold,
    letterSpacing: 8,
    marginTop: -8,
  },
  subtitle: {
    fontSize: SIZES.md,
    color: COLORS.textSecondary,
    ...FONTS.medium,
    marginTop: 8,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  form: {
    gap: 16,
  },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: SIZES.radius,
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: SIZES.base,
    color: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  button: {
    backgroundColor: COLORS.gold,
    borderRadius: SIZES.radius,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: COLORS.black,
    fontSize: SIZES.lg,
    ...FONTS.bold,
    letterSpacing: 2,
  },
  registerLink: {
    alignItems: 'center',
    marginTop: 32,
  },
  registerText: {
    color: COLORS.textSecondary,
    fontSize: SIZES.md,
  },
  registerHighlight: {
    color: COLORS.gold,
    ...FONTS.semiBold,
  },
});

export default LoginScreen;
