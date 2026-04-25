import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS, FONTS, SIZES } from '../constants/theme';

const bannerToneStyles = {
  info: {
    backgroundColor: 'rgba(245, 166, 35, 0.12)',
    borderColor: 'rgba(245, 166, 35, 0.24)',
  },
  success: {
    backgroundColor: 'rgba(122, 180, 123, 0.12)',
    borderColor: 'rgba(122, 180, 123, 0.28)',
  },
  error: {
    backgroundColor: 'rgba(122, 21, 38, 0.18)',
    borderColor: 'rgba(215, 122, 115, 0.34)',
  },
};

const StatusBanner = ({ message, type = 'info', style, textStyle }) => {
  if (!message) return null;

  return (
    <View style={[styles.banner, bannerToneStyles[type] || bannerToneStyles.info, style]}>
      <Text style={[styles.text, textStyle]}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
    borderWidth: 1,
  },
  text: {
    color: COLORS.offWhite,
    fontSize: SIZES.sm,
    lineHeight: 20,
    ...FONTS.medium,
  },
});

export default StatusBanner;
