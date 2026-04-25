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
    {loading ? <ActivityIndicator color={COLORS.gold} /> : null}
    {title ? <Text style={styles.title}>{title}</Text> : null}
    {message ? <Text style={styles.message}>{message}</Text> : null}
  </View>
);

const styles = StyleSheet.create({
  base: {
    paddingVertical: 40,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  compact: {
    paddingVertical: 20,
  },
  title: {
    color: COLORS.white,
    fontSize: SIZES.md,
    marginTop: 10,
    marginBottom: 6,
    textAlign: 'center',
    ...FONTS.semiBold,
  },
  message: {
    color: COLORS.textSecondary,
    fontSize: SIZES.sm,
    lineHeight: 20,
    textAlign: 'center',
    ...FONTS.regular,
  },
});

export default StateBlock;
