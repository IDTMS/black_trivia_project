import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../constants/theme';

const ClubSurface = ({ children, style, contentStyle }) => (
  <View style={[styles.shell, style]}>
    <LinearGradient
      colors={[COLORS.panelPremium, COLORS.inkLift, COLORS.backgroundDeep]}
      start={{ x: 0.08, y: 0 }}
      end={{ x: 0.92, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
    <LinearGradient
      colors={[COLORS.crimsonWash, 'transparent', COLORS.goldWash]}
      start={{ x: 0.08, y: 0.08 }}
      end={{ x: 0.92, y: 0.92 }}
      style={StyleSheet.absoluteFill}
    />
    <View style={styles.edge} pointerEvents="none" />
    <View style={styles.inner} pointerEvents="none" />
    <View style={[styles.content, contentStyle]}>{children}</View>
  </View>
);

const styles = StyleSheet.create({
  shell: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.borderPremium,
    backgroundColor: COLORS.panelPremium,
  },
  edge: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 200, 87, 0.07)',
  },
  inner: {
    position: 'absolute',
    top: 8,
    bottom: 8,
    left: 8,
    right: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.025)',
  },
  content: {
    padding: 20,
  },
});

export default ClubSurface;
