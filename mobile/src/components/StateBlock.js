import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { COLORS, FONTS, SIZES } from '../constants/theme';

const StateBlock = ({
  loading = false,
  title,
  message,
  centered = true,
  compact = false,
  style,
}) => (
  <View style={[styles.base, centered && styles.centered, compact && styles.compact, style]}>
    {loading ? <ActivityIndicator color={COLORS.goldLight} /> : null}
    {title ? <Text style={styles.title}>{title}</Text> : null}
    {message ? <Text style={styles.message}>{message}</Text> : null}
  </View>
);

const styles = StyleSheet.create({
  base: {
    paddingVertical: 34,
    paddingHorizontal: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.borderPremium,
    backgroundColor: 'rgba(18, 14, 16, 0.88)',
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  compact: {
    paddingVertical: 20,
    paddingHorizontal: 22,
  },
  title: {
    color: COLORS.ivory,
    fontSize: SIZES.md,
    marginTop: 10,
    marginBottom: 6,
    textAlign: 'center',
    letterSpacing: 0.4,
    ...FONTS.semiBold,
  },
  message: {
    color: COLORS.textMuted,
    fontSize: SIZES.sm,
    lineHeight: 20,
    textAlign: 'center',
    ...FONTS.regular,
  },
});

export default StateBlock;
