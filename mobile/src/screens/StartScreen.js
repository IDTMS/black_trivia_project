import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SIZES } from '../constants/theme';

const actions = [
  {
    key: 'quick-play',
    title: 'QUICK PLAY',
    description: 'Run the table solo and stack your score.',
    icon: 'flash',
    accent: 'gold',
    onPress: (navigation) => navigation.navigate('Game', { mode: 'solo' }),
  },
  {
    key: 'create-match',
    title: 'CREATE MATCH',
    description: 'Open the room and send the code.',
    icon: 'add-circle',
    accent: 'dark',
    onPress: (navigation) => navigation.navigate('Match', { initialMode: 'create' }),
  },
  {
    key: 'join-match',
    title: 'JOIN MATCH',
    description: 'Got the invite code? Pull up and play.',
    icon: 'log-in',
    accent: 'dark',
    onPress: (navigation) => navigation.navigate('Match', { initialMode: 'join' }),
  },
];

const StartScreen = ({ navigation }) => (
  <View style={styles.container}>
    <StatusBar barStyle="light-content" />

    <View style={styles.hero}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>BLACK CARD</Text>
      </View>

      <View style={styles.logoLockup}>
        <Text style={styles.logoPrimary}>B</Text>
        <Text style={styles.logoAccent}>C</Text>
      </View>

      <Text style={styles.title}>The Table Is Set.</Text>
      <Text style={styles.tagline}>
        Two Players. One Card. One Name on the Line.
      </Text>
      <Text style={styles.subtitle}>
        Pick how you want to move. Solo warm-up or head-to-head, same pressure.
      </Text>
    </View>

    <View style={styles.actionList}>
      {actions.map((action) => {
        const isGold = action.accent === 'gold';
        return (
          <TouchableOpacity
            key={action.key}
            style={[styles.actionButton, isGold ? styles.actionButtonGold : styles.actionButtonDark]}
            onPress={() => action.onPress(navigation)}
            activeOpacity={0.85}
          >
            <View style={[styles.iconWrap, isGold ? styles.iconWrapGold : styles.iconWrapDark]}>
              <Ionicons
                name={action.icon}
                size={24}
                color={isGold ? COLORS.black : COLORS.gold}
              />
            </View>

            <View style={styles.actionText}>
              <Text style={[styles.actionTitle, isGold ? styles.actionTitleGold : styles.actionTitleDark]}>
                {action.title}
              </Text>
              <Text
                style={[
                  styles.actionDescription,
                  isGold ? styles.actionDescriptionGold : styles.actionDescriptionDark,
                ]}
              >
                {action.description}
              </Text>
            </View>

            <Ionicons
              name="arrow-forward"
              size={20}
              color={isGold ? COLORS.black : COLORS.gold}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 24,
    paddingTop: 72,
    paddingBottom: 32,
    justifyContent: 'space-between',
  },
  hero: {
    paddingTop: 12,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    marginBottom: 24,
  },
  badgeText: {
    fontSize: SIZES.sm,
    color: COLORS.goldLight,
    letterSpacing: 1.8,
    ...FONTS.medium,
  },
  logoLockup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 20,
  },
  logoPrimary: {
    fontSize: 72,
    color: COLORS.white,
    letterSpacing: 2,
    ...FONTS.bold,
  },
  logoAccent: {
    fontSize: 72,
    color: COLORS.gold,
    letterSpacing: 2,
    ...FONTS.bold,
  },
  title: {
    fontSize: SIZES.xxxl,
    color: COLORS.white,
    marginBottom: 12,
    ...FONTS.bold,
  },
  tagline: {
    fontSize: SIZES.xl,
    color: COLORS.goldLight,
    lineHeight: 32,
    marginBottom: 12,
    ...FONTS.semiBold,
  },
  subtitle: {
    fontSize: SIZES.base,
    color: COLORS.textSecondary,
    lineHeight: 24,
    maxWidth: 320,
    ...FONTS.regular,
  },
  actionList: {
    gap: 14,
  },
  actionButton: {
    borderRadius: SIZES.radiusLg,
    paddingVertical: 20,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  actionButtonGold: {
    backgroundColor: COLORS.gold,
  },
  actionButtonDark: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapGold: {
    backgroundColor: 'rgba(13, 13, 13, 0.12)',
  },
  iconWrapDark: {
    backgroundColor: COLORS.charcoal,
  },
  actionText: {
    flex: 1,
  },
  actionTitle: {
    fontSize: SIZES.lg,
    letterSpacing: 1.5,
    marginBottom: 4,
    ...FONTS.bold,
  },
  actionTitleGold: {
    color: COLORS.black,
  },
  actionTitleDark: {
    color: COLORS.white,
  },
  actionDescription: {
    fontSize: SIZES.sm,
    lineHeight: 20,
    ...FONTS.regular,
  },
  actionDescriptionGold: {
    color: COLORS.black,
    opacity: 0.72,
  },
  actionDescriptionDark: {
    color: COLORS.textSecondary,
  },
});

export default StartScreen;
