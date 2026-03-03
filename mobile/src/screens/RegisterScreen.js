import React, { useState } from 'react';
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

const RegisterScreen = ({ navigation }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();

  const handleRegister = async () => {
    if (!username.trim() || !email.trim() || !password) {
      Alert.alert('Hold up', 'Fill out all fields.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Nah', "Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      Alert.alert('Too short', 'Password needs at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      await register(username.trim(), email.trim(), password);
      Alert.alert('Welcome', 'Account created! Sign in to play.', [
        { text: "Let's go", onPress: () => navigation.navigate('Login') },
      ]);
    } catch (error) {
      const data = error.response?.data;
      let msg = 'Registration failed.';
      if (data) {
        const firstError = Object.values(data)[0];
        msg = Array.isArray(firstError) ? firstError[0] : String(firstError);
      }
      Alert.alert('Nah', msg);
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
        <View style={styles.header}>
          <Text style={styles.title}>JOIN THE</Text>
          <Text style={styles.titleGold}>CULTURE</Text>
        </View>

        <View style={styles.form}>
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
            placeholder="Email"
            placeholderTextColor={COLORS.gray}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={COLORS.gray}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            placeholderTextColor={COLORS.gray}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.black} />
            ) : (
              <Text style={styles.buttonText}>CREATE ACCOUNT</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.loginLink}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.loginText}>
            Already got an account? <Text style={styles.loginHighlight}>Sign in</Text>
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
    marginBottom: 40,
  },
  title: {
    fontSize: SIZES.xxxl,
    color: COLORS.white,
    ...FONTS.bold,
    letterSpacing: 4,
  },
  titleGold: {
    fontSize: SIZES.title,
    color: COLORS.gold,
    ...FONTS.bold,
    letterSpacing: 6,
    marginTop: -4,
  },
  form: {
    gap: 14,
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
  loginLink: {
    alignItems: 'center',
    marginTop: 32,
  },
  loginText: {
    color: COLORS.textSecondary,
    fontSize: SIZES.md,
  },
  loginHighlight: {
    color: COLORS.gold,
    ...FONTS.semiBold,
  },
});

export default RegisterScreen;
