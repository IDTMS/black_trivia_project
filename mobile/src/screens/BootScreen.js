import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS, SIZES } from '../constants/theme';
import StateBlock from '../components/StateBlock';

const BootScreen = () => {
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#040404', '#120d10', '#050505']}
        start={{ x: 0.08, y: 0 }}
        end={{ x: 0.92, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <LinearGradient
        colors={['rgba(122, 21, 38, 0.16)', 'transparent', 'rgba(245, 166, 35, 0.12)']}
        start={{ x: 0.1, y: 0.08 }}
        end={{ x: 0.9, y: 0.92 }}
        style={styles.surfaceGlow}
      />

      <View style={styles.edgeFrame} pointerEvents="none" />
      <View style={styles.innerFrame} pointerEvents="none" />

      <View style={styles.content}>
        <Text style={styles.logo}>BLACK</Text>
        <Text style={styles.logoGold}>CARD</Text>
        <Text style={styles.tagline}>Getting the room ready...</Text>

        <StateBlock
          loading
          title="Restoring your session"
          message="Checking your account, loading the board, and getting you back in the game."
          compact
          style={styles.stateBlock}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.obsidian,
  },
  surfaceGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  edgeFrame: {
    position: 'absolute',
    top: 18,
    bottom: 18,
    left: 16,
    right: 16,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.28)',
  },
  innerFrame: {
    position: 'absolute',
    top: 30,
    bottom: 30,
    left: 28,
    right: 28,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 200, 87, 0.06)',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logo: {
    fontSize: 48,
    color: COLORS.white,
    letterSpacing: 6,
    ...FONTS.bold,
  },
  logoGold: {
    fontSize: 48,
    color: COLORS.gold,
    letterSpacing: 6,
    marginTop: -6,
    ...FONTS.bold,
  },
  tagline: {
    marginTop: 12,
    color: COLORS.goldSoft,
    fontSize: SIZES.base,
    letterSpacing: 1.2,
    textAlign: 'center',
    ...FONTS.medium,
  },
  stateBlock: {
    marginTop: 28,
    maxWidth: 300,
  },
});

export default BootScreen;
