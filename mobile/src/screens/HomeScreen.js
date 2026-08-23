import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, EFFECTS, FONTS, SIZES } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { getCurrentUser, getMatchHistory, getMatchRecap } from '../services/api';
import ClubSurface from '../components/ClubSurface';
import MatchRecapCard from '../components/MatchRecapCard';

const getCountdownText = (expiresAt) => {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt) - new Date();
  if (diff <= 0) return 'Returning soon';
  const hrs = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hrs > 0) return `Returns in ${hrs}h ${mins}m`;
  return `Returns in ${mins}m`;
};

const HomeScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [cardStatus, setCardStatus] = useState(null);
  const [lastRecap, setLastRecap] = useState(null);
  const [recapLoading, setRecapLoading] = useState(false);

  const fetchHomeData = useCallback(async () => {
    try {
      const res = await getCurrentUser();
      setCardStatus(res.data);
    } catch {}

    try {
      const historyResponse = await getMatchHistory();
      const history = Array.isArray(historyResponse.data)
        ? historyResponse.data
        : historyResponse.data?.results || [];
      const latestMatch = history[0];

      if (!latestMatch?.id) {
        setLastRecap(null);
        setRecapLoading(false);
        return;
      }

      setRecapLoading(true);
      try {
        const recapResponse = await getMatchRecap(latestMatch.id);
        setLastRecap(recapResponse.data);
      } catch {
        setLastRecap(null);
      } finally {
        setRecapLoading(false);
      }
    } catch {
      setLastRecap(null);
      setRecapLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchHomeData();
    }, [fetchHomeData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchHomeData();
    setRefreshing(false);
  };

  const cardActive = cardStatus?.black_card_active !== false;
  const cardHolder = cardStatus?.card_holder;
  const cardExpiresAt = cardStatus?.card_expires_at;
  const walletCards = cardStatus?.wallet_cards || [];
  const vaultCount = walletCards.length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />
      }
    >
      <LinearGradient
        colors={[COLORS.backgroundDeep, COLORS.inkLift, COLORS.backgroundDeep]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>MEMBER ACCESS</Text>
          <Text style={styles.username}>{user?.username || 'Player'}</Text>
        </View>
        <View style={styles.monogram}>
          <Text style={styles.monogramWhite}>B</Text>
          <Text style={styles.monogramGold}>C</Text>
        </View>
      </View>

      <ClubSurface style={styles.heroCard} contentStyle={styles.heroContent}>
        <View style={styles.heroBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.heroEyebrow}>THE TABLE IS OPEN</Text>
        </View>
        <Text style={styles.heroTitle}>Know it. Call it. Take the card.</Text>
        <Text style={styles.heroCopy}>
          Warm up solo, then put your name and your Black Card on the table in a head-to-head match.
        </Text>
      </ClubSurface>

      {cardStatus && (
        <ClubSurface style={styles.vaultCard} contentStyle={styles.vaultContent}>
          <View style={styles.vaultHeader}>
            <View>
              <Text style={styles.sectionKicker}>BLACK CARD STATUS</Text>
              <Text style={styles.vaultTitle}>{cardActive ? 'Protected' : 'Captured'}</Text>
            </View>
            <View style={[styles.statusSeal, cardActive ? styles.statusSealSafe : styles.statusSealCaptured]}>
              <Ionicons
                name={cardActive ? 'shield-checkmark-outline' : 'lock-closed-outline'}
                size={16}
                color={cardActive ? COLORS.success : COLORS.red}
              />
            </View>
          </View>

          <View style={styles.cardStatePanel}>
            <View style={[styles.vaultDot, cardActive ? styles.vaultDotActive : styles.vaultDotCaptured]} />
            <View style={styles.cardStateCopy}>
              <Text style={styles.cardStateLabel}>YOUR CARD</Text>
              <Text style={cardActive ? styles.vaultStatus : styles.vaultStatusCaptured}>
                {cardActive
                  ? 'In your possession'
                  : `Held by ${cardHolder || 'another player'}${
                      cardExpiresAt ? ` · ${getCountdownText(cardExpiresAt)}` : ''
                    }`}
              </Text>
            </View>
            <View style={styles.vaultBadge}>
              <Ionicons name="albums-outline" size={14} color={COLORS.champagne} />
              <Text style={styles.vaultBadgeText}>{vaultCount}</Text>
            </View>
          </View>

          <View style={styles.vaultCollected}>
            <Text style={styles.vaultCollectedLabel}>CAPTURE VAULT</Text>
            <Text style={styles.vaultCollectedNames}>
              {vaultCount > 0 ? walletCards.map((c) => c.owner).join(' · ') : 'No captured cards yet. Win one.'}
            </Text>
          </View>
        </ClubSurface>
      )}

      <MatchRecapCard recap={lastRecap} loading={recapLoading} />

      <View style={styles.playSection}>
        <TouchableOpacity
          style={styles.primaryAction}
          onPress={() => navigation.navigate('Match', { initialMode: 'create' })}
          activeOpacity={0.88}
        >
          <LinearGradient
            colors={[COLORS.goldLight, COLORS.gold, COLORS.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.actionIconDark}>
            <Ionicons name="people" size={24} color={COLORS.black} />
          </View>
          <View style={styles.playButtonText}>
            <Text style={styles.playTitle}>PUT THE CARD UP</Text>
            <Text style={styles.playDesc}>Create a private 1v1 and play for ownership</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={COLORS.black} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryAction}
          onPress={() => navigation.navigate('Game', { mode: 'solo' })}
          activeOpacity={0.88}
        >
          <View style={styles.actionIconGold}>
            <Ionicons name="flash-outline" size={22} color={COLORS.goldLight} />
          </View>
          <View style={styles.playButtonText}>
            <Text style={styles.matchTitle}>QUICK PLAY</Text>
            <Text style={styles.matchDesc}>Sharpen up before somebody calls your name</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={COLORS.goldSoft} />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.backgroundDeep },
  content: { paddingTop: 60, paddingBottom: 44, minHeight: '100%' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  greeting: {
    fontSize: 9,
    color: COLORS.goldSoft,
    letterSpacing: 2.8,
    marginBottom: 5,
    ...FONTS.bold,
  },
  username: { fontSize: SIZES.xxl, color: COLORS.ivory, ...FONTS.bold },
  monogram: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.borderPremium,
    backgroundColor: COLORS.panelPremium,
  },
  monogramWhite: { fontSize: 23, color: COLORS.ivory, ...FONTS.bold },
  monogramGold: { fontSize: 23, color: COLORS.goldLight, ...FONTS.bold },
  heroCard: { marginHorizontal: 24, marginBottom: 18, ...EFFECTS.premiumShadow },
  heroContent: { padding: 22 },
  heroBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.goldLight },
  heroEyebrow: { color: COLORS.goldLight, fontSize: 9, letterSpacing: 2.4, ...FONTS.bold },
  heroTitle: {
    color: COLORS.ivory,
    fontSize: 27,
    lineHeight: 32,
    marginBottom: 10,
    maxWidth: 320,
    ...FONTS.bold,
  },
  heroCopy: { color: COLORS.textMuted, fontSize: SIZES.sm, lineHeight: 20, ...FONTS.regular },
  vaultCard: { marginHorizontal: 24, marginBottom: 18, ...EFFECTS.softShadow },
  vaultContent: { padding: 18 },
  vaultHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionKicker: { color: COLORS.goldSoft, fontSize: 9, letterSpacing: 2.2, ...FONTS.bold },
  vaultTitle: { color: COLORS.ivory, fontSize: SIZES.xl, marginTop: 4, ...FONTS.bold },
  statusSeal: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  statusSealSafe: { borderColor: 'rgba(46,204,113,0.35)', backgroundColor: 'rgba(46,204,113,0.08)' },
  statusSealCaptured: { borderColor: 'rgba(231,76,60,0.38)', backgroundColor: 'rgba(90,16,27,0.28)' },
  cardStatePanel: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  vaultDot: { width: 9, height: 9, borderRadius: 5, marginRight: 12 },
  vaultDotActive: { backgroundColor: COLORS.success },
  vaultDotCaptured: { backgroundColor: COLORS.red },
  cardStateCopy: { flex: 1 },
  cardStateLabel: { color: COLORS.textMuted, fontSize: 9, letterSpacing: 1.8, ...FONTS.bold },
  vaultStatus: { fontSize: SIZES.sm, color: COLORS.success, marginTop: 3, ...FONTS.semiBold },
  vaultStatusCaptured: { fontSize: SIZES.sm, color: COLORS.red, marginTop: 3, ...FONTS.semiBold },
  vaultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.borderPremium,
    backgroundColor: COLORS.goldWash,
  },
  vaultBadgeText: { fontSize: SIZES.sm, color: COLORS.champagne, ...FONTS.bold },
  vaultCollected: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  vaultCollectedLabel: { fontSize: 9, color: COLORS.goldSoft, letterSpacing: 2, marginBottom: 5, ...FONTS.bold },
  vaultCollectedNames: { fontSize: SIZES.sm, color: COLORS.textMuted, lineHeight: 18, ...FONTS.regular },
  playSection: { paddingHorizontal: 24, gap: 12, marginBottom: 28 },
  primaryAction: {
    overflow: 'hidden',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    ...EFFECTS.premiumShadow,
  },
  secondaryAction: {
    borderRadius: 20,
    paddingVertical: 17,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: COLORS.borderPremium,
    backgroundColor: COLORS.panelPremium,
  },
  actionIconDark: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  actionIconGold: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderPremium,
    backgroundColor: COLORS.goldWash,
  },
  playButtonText: { flex: 1 },
  playTitle: { fontSize: SIZES.lg, color: COLORS.black, letterSpacing: 1.5, ...FONTS.bold },
  playDesc: { fontSize: SIZES.xs, color: COLORS.black, opacity: 0.68, marginTop: 3, ...FONTS.medium },
  matchTitle: { fontSize: SIZES.lg, color: COLORS.ivory, letterSpacing: 1.4, ...FONTS.bold },
  matchDesc: { fontSize: SIZES.xs, color: COLORS.textMuted, marginTop: 3, ...FONTS.medium },
});

export default HomeScreen;
