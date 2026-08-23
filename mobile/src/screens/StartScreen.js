import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, EFFECTS, FONTS, SIZES } from '../constants/theme';
import {
  fadeOutAmbient,
  initializeSoundEngine,
  isMuted,
  playAmbient,
  playConfirm,
  playCursor,
  subscribeMute,
  toggleMute,
} from '../utils/soundEngine';

const CARD_ART = require('../../assets/blackcard.png');

const MENU_ITEMS = [
  {
    key: 'create-match',
    label: 'Put The Card Up',
    description: 'Open a private 1v1. First to the target takes ownership.',
    icon: 'people-outline',
    onSelect: (navigation) => navigation.navigate('Match', { initialMode: 'create' }),
  },
  {
    key: 'join-match',
    label: 'Take The Seat',
    description: 'Enter a live room code and answer the challenge.',
    icon: 'keypad-outline',
    onSelect: (navigation) => navigation.navigate('Match', { initialMode: 'join' }),
  },
  {
    key: 'quick-play',
    label: 'Quick Play',
    description: 'Run a solo rep before somebody puts your name on the line.',
    icon: 'flash-outline',
    onSelect: (navigation) => navigation.navigate('Game', { mode: 'solo' }),
  },
  {
    key: 'leaderboard',
    label: 'Leaderboard',
    description: 'See who is carrying wins, points, and bragging rights.',
    icon: 'trophy-outline',
    onSelect: (navigation) => navigation.navigate('MainTabs', { screen: 'Leaderboard' }),
  },
  {
    key: 'settings',
    label: 'Profile & Vault',
    description: 'Check your record, your card, and the names in your vault.',
    icon: 'person-circle-outline',
    onSelect: (navigation) => navigation.navigate('MainTabs', { screen: 'Profile' }),
  },
];

const StartScreen = ({ navigation }) => {
  const [phase, setPhase] = useState('title');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [muted, setMutedState] = useState(isMuted());

  const promptOpacity = useRef(new Animated.Value(1)).current;
  const promptScale = useRef(new Animated.Value(1)).current;
  const titleShift = useRef(new Animated.Value(0)).current;
  const titleScale = useRef(new Animated.Value(1)).current;
  const menuOpacity = useRef(new Animated.Value(0)).current;
  const menuShift = useRef(new Animated.Value(36)).current;
  const cardFloat = useRef(new Animated.Value(0)).current;

  const textureLines = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => ({
        key: `texture-${index}`,
        top: `${-8 + index * 9}%`,
        left: `${(index % 4) * 24 - 8}%`,
        rotate: `${-16 + (index % 5) * 5}deg`,
        opacity: index % 2 === 0 ? 0.055 : 0.025,
      })),
    []
  );

  useEffect(() => {
    const promptLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(promptOpacity, {
            toValue: 0.45,
            duration: 1400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(promptScale, {
            toValue: 0.98,
            duration: 1400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(promptOpacity, {
            toValue: 1,
            duration: 1400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(promptScale, {
            toValue: 1,
            duration: 1400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    const cardLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(cardFloat, {
          toValue: -5,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(cardFloat, {
          toValue: 4,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    promptLoop.start();
    cardLoop.start();
    return () => {
      promptLoop.stop();
      cardLoop.stop();
    };
  }, [cardFloat, promptOpacity, promptScale]);

  useEffect(() => {
    const unsubscribe = subscribeMute(setMutedState);
    initializeSoundEngine().catch(() => {});
    return unsubscribe;
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      initializeSoundEngine()
        .then(() => (active ? playAmbient({ fadeInMs: 850 }) : null))
        .catch(() => {});

      return () => {
        active = false;
      };
    }, [])
  );

  const openMenu = useCallback(async () => {
    if (phase === 'menu') return;

    setPhase('menu');
    playConfirm().catch(() => {});

    Animated.parallel([
      Animated.timing(titleShift, {
        toValue: -118,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(titleScale, {
        toValue: 0.9,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(menuOpacity, {
        toValue: 1,
        duration: 420,
        delay: 110,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(menuShift, {
        toValue: 0,
        duration: 420,
        delay: 110,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(promptOpacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [menuOpacity, menuShift, phase, promptOpacity, titleScale, titleShift]);

  const handleSelect = useCallback(
    async (item, index) => {
      setSelectedIndex(index);
      await playConfirm().catch(() => {});
      await fadeOutAmbient(700).catch(() => {});
      item.onSelect(navigation);
    },
    [navigation]
  );

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;

    const handler = async (event) => {
      if (phase === 'title') {
        if (['Enter', ' ', 'Spacebar'].includes(event.key)) {
          event.preventDefault();
          openMenu();
        }
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((current) => {
          const next = (current + 1) % MENU_ITEMS.length;
          if (next !== current) playCursor().catch(() => {});
          return next;
        });
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((current) => {
          const next = (current - 1 + MENU_ITEMS.length) % MENU_ITEMS.length;
          if (next !== current) playCursor().catch(() => {});
          return next;
        });
      } else if (['Enter', ' ', 'Spacebar'].includes(event.key)) {
        event.preventDefault();
        handleSelect(MENU_ITEMS[selectedIndex], selectedIndex);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSelect, openMenu, phase, selectedIndex]);

  const handleMuteToggle = async (event) => {
    event?.stopPropagation?.();
    const nextMuted = await toggleMute().catch(() => muted);
    setMutedState(nextMuted);
    if (!nextMuted) playAmbient({ fadeInMs: 320 }).catch(() => {});
  };

  const onMenuFocus = (index) => {
    if (index === selectedIndex) return;
    setSelectedIndex(index);
    playCursor().catch(() => {});
  };

  return (
    <Pressable style={styles.container} onPress={phase === 'title' ? openMenu : undefined}>
      <StatusBar barStyle="light-content" />

      <LinearGradient
        colors={[COLORS.backgroundDeep, COLORS.inkLift, COLORS.backgroundDeep]}
        start={{ x: 0.08, y: 0 }}
        end={{ x: 0.92, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={[COLORS.crimsonWash, 'transparent', COLORS.goldWash]}
        start={{ x: 0.1, y: 0.08 }}
        end={{ x: 0.9, y: 0.92 }}
        style={styles.surfaceGlow}
      />

      <View style={styles.edgeFrame} pointerEvents="none" />
      <View style={styles.innerFrame} pointerEvents="none" />
      <View style={styles.shadowVeil} pointerEvents="none" />

      {textureLines.map((line) => (
        <View
          key={line.key}
          pointerEvents="none"
          style={[
            styles.textureLine,
            {
              top: line.top,
              left: line.left,
              transform: [{ rotate: line.rotate }],
              opacity: line.opacity,
            },
          ]}
        />
      ))}

      <TouchableOpacity style={styles.muteButton} onPress={handleMuteToggle} activeOpacity={0.82}>
        <Ionicons
          name={muted ? 'volume-mute-outline' : 'volume-high-outline'}
          size={18}
          color={COLORS.goldLight}
        />
      </TouchableOpacity>

      <View style={styles.content}>
        <Animated.View
          style={[
            styles.hero,
            { transform: [{ translateY: titleShift }, { scale: titleScale }] },
          ]}
        >
          <View style={styles.heroBadge}>
            <View style={styles.badgeDot} />
            <Text style={styles.heroBadgeText}>MEMBERS ONLY · TABLE OPEN</Text>
          </View>

          <Text style={styles.heroTitle}>
            <Text style={styles.heroTitleWhite}>BLACK</Text>{' '}
            <Text style={styles.heroTitleGold}>CARD</Text>
          </Text>

          <Animated.View style={[styles.cardStage, { transform: [{ translateY: cardFloat }] }]}>
            <View style={styles.cardGlow} />
            <Image source={CARD_ART} style={styles.cardArt} resizeMode="contain" />
          </Animated.View>

          <Text style={styles.heroTagline}>Your name. Your card. Somebody has to leave with both.</Text>
          <Text style={styles.heroCopy}>
            Head-to-head Black culture trivia built around one simple stake: win the table and take the card.
          </Text>
        </Animated.View>

        {phase === 'title' ? (
          <Animated.View
            style={[
              styles.promptWrap,
              { opacity: promptOpacity, transform: [{ scale: promptScale }] },
            ]}
          >
            <Text style={styles.promptText}>Tap to Enter the Room</Text>
          </Animated.View>
        ) : null}

        <Animated.View
          pointerEvents={phase === 'menu' ? 'auto' : 'none'}
          style={[
            styles.menuWrap,
            { opacity: menuOpacity, transform: [{ translateY: menuShift }] },
          ]}
        >
          {MENU_ITEMS.map((item, index) => {
            const isActive = selectedIndex === index;
            const isPrimary = item.key === 'create-match';
            return (
              <TouchableOpacity
                key={item.key}
                style={[
                  styles.menuItem,
                  isPrimary && styles.menuItemPrimary,
                  isActive && styles.menuItemActive,
                ]}
                onPressIn={() => onMenuFocus(index)}
                onPress={() => handleSelect(item, index)}
                activeOpacity={0.88}
              >
                <View style={[styles.menuIconWrap, isActive && styles.menuIconWrapActive]}>
                  <Ionicons
                    name={item.icon}
                    size={18}
                    color={isActive ? COLORS.goldLight : COLORS.textMuted}
                  />
                </View>
                <View style={styles.menuLabelWrap}>
                  <Text style={[styles.menuLabel, isActive && styles.menuLabelActive]}>{item.label}</Text>
                  <Text style={[styles.menuDescription, isActive && styles.menuDescriptionActive]}>
                    {item.description}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={19}
                  color={isActive ? COLORS.goldLight : COLORS.smoke}
                />
              </TouchableOpacity>
            );
          })}
        </Animated.View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.backgroundDeep },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 52,
    paddingBottom: 30,
  },
  surfaceGlow: { ...StyleSheet.absoluteFillObject },
  edgeFrame: {
    position: 'absolute',
    top: 18,
    bottom: 18,
    left: 16,
    right: 16,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: COLORS.borderPremium,
    ...EFFECTS.premiumShadow,
  },
  innerFrame: {
    position: 'absolute',
    top: 30,
    bottom: 30,
    left: 28,
    right: 28,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 200, 87, 0.05)',
  },
  shadowVeil: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.12)' },
  textureLine: {
    position: 'absolute',
    width: '60%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.38)',
  },
  muteButton: {
    position: 'absolute',
    top: 58,
    right: 28,
    zIndex: 3,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderPremium,
    backgroundColor: 'rgba(8, 8, 8, 0.74)',
  },
  hero: { alignItems: 'center', maxWidth: 350 },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.borderPremium,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: 'rgba(24, 14, 14, 0.72)',
    marginBottom: 16,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.goldLight },
  heroBadgeText: { color: COLORS.goldLight, fontSize: 9, letterSpacing: 2.1, ...FONTS.bold },
  heroTitle: {
    fontSize: 47,
    lineHeight: 50,
    letterSpacing: 4,
    textAlign: 'center',
    marginBottom: 8,
    ...FONTS.bold,
  },
  heroTitleWhite: { color: COLORS.ivory },
  heroTitleGold: { color: COLORS.goldLight },
  cardStage: {
    width: 220,
    height: 112,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 7,
  },
  cardGlow: {
    position: 'absolute',
    width: 170,
    height: 70,
    borderRadius: 40,
    backgroundColor: 'rgba(245, 166, 35, 0.10)',
    transform: [{ scaleX: 1.3 }],
  },
  cardArt: { width: 190, height: 105 },
  heroTagline: {
    color: COLORS.champagne,
    fontSize: SIZES.base,
    lineHeight: 23,
    textAlign: 'center',
    marginBottom: 8,
    maxWidth: 320,
    ...FONTS.semiBold,
  },
  heroCopy: {
    color: COLORS.textMuted,
    fontSize: SIZES.sm,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 310,
  },
  promptWrap: { position: 'absolute', bottom: 92, alignItems: 'center' },
  promptText: {
    color: COLORS.goldLight,
    fontSize: SIZES.sm,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    ...FONTS.bold,
  },
  menuWrap: { width: '100%', maxWidth: 340, marginTop: 34, gap: 9 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(17, 15, 17, 0.84)',
    borderWidth: 1,
    borderColor: 'rgba(255, 200, 87, 0.07)',
  },
  menuItemPrimary: { borderColor: 'rgba(245, 166, 35, 0.18)' },
  menuItemActive: {
    borderColor: 'rgba(245, 166, 35, 0.38)',
    backgroundColor: 'rgba(40, 18, 20, 0.82)',
  },
  menuIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  menuIconWrapActive: { borderColor: COLORS.borderPremium, backgroundColor: COLORS.goldWash },
  menuLabelWrap: { flex: 1, paddingVertical: 10 },
  menuLabel: { color: COLORS.offWhite, fontSize: SIZES.base, ...FONTS.semiBold },
  menuLabelActive: { color: COLORS.goldLight },
  menuDescription: {
    color: COLORS.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
    paddingRight: 6,
    ...FONTS.regular,
  },
  menuDescriptionActive: { color: '#D9C8A6' },
});

export default StartScreen;
