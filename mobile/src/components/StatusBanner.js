import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SIZES } from '../constants/theme';

const bannerTones = {
  info: {
    backgroundColor: 'rgba(245, 166, 35, 0.10)',
    borderColor: 'rgba(245, 166, 35, 0.24)',
    icon: 'information-circle-outline',
    iconColor: COLORS.goldLight,
  },
  success: {
    backgroundColor: 'rgba(46, 204, 113, 0.09)',
    borderColor: 'rgba(46, 204, 113, 0.24)',
    icon: 'checkmark-circle-outline',
    iconColor: COLORS.success,
  },
  error: {
    backgroundColor: 'rgba(122, 21, 38, 0.18)',
    borderColor: 'rgba(215, 122, 115, 0.34)',
    icon: 'alert-circle-outline',
    iconColor: COLORS.red,
  },
};

const StatusBanner = ({ message, type = 'info', style, textStyle }) => {
  if (!message) return null;
  const tone = bannerTones[type] || bannerTones.info;

  return (
    <View
      style={[
        styles.banner,
        { backgroundColor: tone.backgroundColor, borderColor: tone.borderColor },
        style,
      ]}
    >
      <View style={styles.iconWrap}>
        <Ionicons name={tone.icon} size={16} color={tone.iconColor} />
      </View>
      <Text style={[styles.text, textStyle]}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    borderRadius: 15,
    paddingVertical: 11,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  iconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.16)',
  },
  text: {
    flex: 1,
    color: COLORS.offWhite,
    fontSize: SIZES.sm,
    lineHeight: 20,
    ...FONTS.medium,
  },
});

export default StatusBanner;
