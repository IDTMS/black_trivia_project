import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
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
import { COLORS, FONTS, SIZES } from '../constants/theme';
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

const MENU_ITEMS = [
  {
    key: 'quick-play',
    label: 'Quick Play',
    icon: 'flash-outline',
    onSelect: (navigation) => navigation.navigate('Game', { mode: 'solo' }),
  },
  {
    key: 'create-match',
    label: 'Create Match',
    icon: 'people-outline',
    onSelect: (navigation) => navigation.navigate('Match', { initialMode: 'create' }),
  },
  {
    key: 'join-match',
    label: 'Join Match',
    icon: 'keypad-outline',
    onSelect: (navigation) => navigation.navigate('Match', { initialMode: 'join' }),
  },
  {
    key: 'leaderboard',
    label: 'Leaderboard',
    icon: 'trophy-outline',
    onSelect: (navigation) => navigation.navigate('MainTabs', { screen: 'Leaderboard' }),
  },
  {
    key: 'settings',
    label: 'Settings',
    icon: 'settings-outline',
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

  const textureLines = useMemo(
    () =>
      Array.from({ length: 16 }, (_, index) => ({
        key: `texture-${index}`,
        top: `${-12 + index * 8}%`,
        left: `${(index % 4) * 24 - 8}%`,
        rotate: `${-18 + (index % 5) * 6}deg`,
        opacity: index % 2 === 0 ? 0.08 : 0.04,
      })),
    []
  );

  useEffect(() => {
    const loop = Animated.loop(
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

    loop.start();
    return () => loop.stop();
  }, [promptOpacity, promptScale]);

  useEffect(() => {
    const unsubscribe = subscribeMute(setMutedState);
    initializeSoundEngine().catch(() => {});
    return unsubscribe;
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      initializeSoundEngine()
        .then(() => {
          if (active) {
            return playAmbient({ fadeInMs: 850 });
          }
          return null;
        })
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
        toValue: -120,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(titleScale, {
        toValue: 0.93,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(menuOpacity, {
        toValue: 1,
        duration: 420,
        delay: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(menuShift, {
        toValue: 0,
        duration: 420,
        delay: 120,
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
          if (next !== current) {
            playCursor().catch(() => {});
          }
          return next;
        });
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((current) => {
          const next = (current - 1 + MENU_ITEMS.length) % MENU_ITEMS.length;
          if (next !== current) {
            playCursor().catch(() => {});
          }
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
    if (!nextMuted) {
      playAmbient({ fadeInMs: 320 }).catch(() => {});
    }
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

      <TouchableOpacity
        style={styles.muteButton}
        onPress={handleMuteToggle}
        activeOpacity={0.82}
      >
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
            {
              transform: [{ translateY: titleShift }, { scale: titleScale }],
            },
          ]}
        >
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>PRIVATE TABLE</Text>
          </View>

          <Text style={styles.heroTitle}>
            <Text style={styles.heroTitleWhite}>BLACK</Text>{' '}
            <Text style={styles.heroTitleGold}>CARD</Text>
          </Text>

          <Text style={styles.heroTagline}>
            Two Players. One Card. One Name on the Line.
          </Text>

          <Text style={styles.heroCopy}>
            High-stakes culture trivia in a room built like a trophy case.
          </Text>
        </Animated.View>

        {phase === 'title' ? (
          <Animated.View
            style={[
              styles.promptWrap,
              { opacity: promptOpacity, transform: [{ scale: promptScale }] },
            ]}
          >
            <Text style={styles.promptText}>Tap to Start</Text>
          </Animated.View>
        ) : null}

        <Animated.View
          pointerEvents={phase === 'menu' ? 'auto' : 'none'}
          style={[
            styles.menuWrap,
            {
              opacity: menuOpacity,
              transform: [{ translateY: menuShift }],
            },
          ]}
        >
          {MENU_ITEMS.map((item, index) => {
            const isActive = selectedIndex === index;
            return (
              <TouchableOpacity
                key={item.key}
                style={[styles.menuItem, isActive && styles.menuItemActive]}
                onPressIn={() => onMenuFocus(index)}
                onPress={() => handleSelect(item, index)}
                activeOpacity={0.88}
              >
                <View style={styles.menuArrowWrap}>
                  {isActive ? (
                    <Ionicons name="play" size={14} color={COLORS.goldLight} />
                  ) : (
                    <View style={styles.menuArrowPlaceholder} />
                  )}
                </View>
                <Ionicons
                  name={item.icon}
                  size={18}
                  color={isActive ? COLORS.goldLight : COLORS.textSecondary}
                  style={styles.menuIcon}
                />
                <View style={styles.menuLabelWrap}>
                  <Text style={[styles.menuLabel, isActive && styles.menuLabelActive]}>
                    {item.label}
                  </Text>
                  <View style={[styles.menuUnderline, isActive && styles.menuUnderlineActive]} />
                </View>
              </TouchableOpacity>
            );
          })}
        </Animated.View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.obsidian,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 56,
    paddingBottom: 32,
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
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
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
  shadowVeil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.16)',
  },
  textureLine: {
    position: 'absolute',
    width: '60%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.4)',
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
    borderColor: 'rgba(245, 166, 35, 0.2)',
    backgroundColor: 'rgba(8, 8, 8, 0.7)',
  },
  hero: {
    alignItems: 'center',
    maxWidth: 340,
  },
  heroBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.22)',
    paddingHorizontal: 16,
    paddingVertical: 7,
    backgroundColor: 'rgba(24, 14, 14, 0.7)',
    marginBottom: 22,
  },
  heroBadgeText: {
    color: COLORS.goldLight,
    fontSize: SIZES.xs,
    letterSpacing: 3,
    ...FONTS.medium,
  },
  heroTitle: {
    fontSize: 48,
    lineHeight: 52,
    letterSpacing: 4,
    textAlign: 'center',
    marginBottom: 14,
    ...FONTS.bold,
  },
  heroTitleWhite: {
    color: COLORS.offWhite,
  },
  heroTitleGold: {
    color: COLORS.goldLight,
  },
  heroTagline: {
    color: COLORS.goldSoft,
    fontSize: SIZES.lg,
    lineHeight: 28,
    textAlign: 'center',
    marginBottom: 10,
    ...FONTS.semiBold,
  },
  heroCopy: {
    color: COLORS.textSecondary,
    fontSize: SIZES.base,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 300,
  },
  promptWrap: {
    position: 'absolute',
    bottom: 110,
    alignItems: 'center',
  },
  promptText: {
    color: COLORS.goldLight,
    fontSize: SIZES.base,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    ...FONTS.medium,
  },
  menuWrap: {
    width: '100%',
    maxWidth: 320,
    marginTop: 56,
    gap: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(17, 15, 17, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255, 200, 87, 0.08)',
  },
  menuItemActive: {
    borderColor: 'rgba(245, 166, 35, 0.3)',
    backgroundColor: 'rgba(40, 18, 20, 0.78)',
  },
  menuArrowWrap: {
    width: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  menuArrowPlaceholder: {
    width: 10,
    height: 10,
  },
  menuIcon: {
    marginRight: 12,
  },
  menuLabelWrap: {
    flex: 1,
  },
  menuLabel: {
    color: COLORS.offWhite,
    fontSize: SIZES.lg,
    ...FONTS.medium,
  },
  menuLabelActive: {
    color: COLORS.goldLight,
  },
  menuUnderline: {
    width: 0,
    height: 2,
    marginTop: 8,
    backgroundColor: 'transparent',
  },
  menuUnderlineActive: {
    width: 44,
    backgroundColor: COLORS.crimsonGlow,
  },
});

export default StartScreen;
