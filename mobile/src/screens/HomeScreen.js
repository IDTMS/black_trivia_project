import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SIZES } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { getLeaderboard, getCurrentUser } from '../services/api';
import StatusBanner from '../components/StatusBanner';
import StateBlock from '../components/StateBlock';

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
  const [leaderboard, setLeaderboard] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [cardStatus, setCardStatus] = useState(null);

  const fetchData = useCallback(async () => {
    const results = await Promise.allSettled([
      getLeaderboard(),
      getCurrentUser(),
    ]);
    if (results[0].status === 'fulfilled') {
      setLeaderboard(results[0].value.data);
      setLoadError('');
    } else {
      setLoadError('Could not load the leaderboard right now. Pull to try again.');
    }
    if (results[1].status === 'fulfilled') {
      setCardStatus(results[1].value.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const cardActive = cardStatus?.black_card_active !== false;
  const cardHolder = cardStatus?.card_holder;
  const cardExpiresAt = cardStatus?.card_expires_at;
  const walletCards = cardStatus?.wallet_cards || [];
  const vaultCount = walletCards.length;

  const handleQuickPlay = () => {
    navigation.navigate('Game', { mode: 'solo' });
  };

  const handleStartMatch = () => {
    navigation.navigate('Match', { initialMode: 'create' });
  };

  const getRankEmoji = (index) => {
    if (index === 0) return '👑';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return `${index + 1}`;
  };

  const renderLeaderboardItem = ({ item, index }) => (
    <View style={[styles.leaderRow, index < 3 && styles.leaderRowTop]}>
      <View style={styles.rankContainer}>
        <Text style={[styles.rank, index < 3 && styles.rankTop]}>
          {getRankEmoji(index)}
        </Text>
      </View>
      <View style={styles.playerInfo}>
        <Text style={styles.playerName}>{item.user}</Text>
        <Text style={styles.playerStats}>
          {item.wins} wins
        </Text>
      </View>
      <Text style={[styles.points, index < 3 && styles.pointsTop]}>
        {item.points} pts
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>What's good,</Text>
          <Text style={styles.username}>{user?.username || 'Player'}</Text>
        </View>
        <View style={styles.logoSmall}>
          <Text style={styles.logoB}>B</Text>
          <Text style={styles.logoC}>C</Text>
        </View>
      </View>

      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>Tonight's table</Text>
        <Text style={styles.heroTitle}>Pick your lane and make it count.</Text>
        <Text style={styles.heroCopy}>
          Quick Play is the fast solo rep. 1v1 Match is where names get tested.
        </Text>
      </View>

      {/* Black Card Vault */}
      {cardStatus && (
        <View style={styles.vaultCard}>
          <View style={styles.vaultRow}>
            <View style={styles.vaultLeft}>
              <View style={[styles.vaultDot, cardActive ? styles.vaultDotActive : styles.vaultDotCaptured]} />
              <View>
                <Text style={styles.vaultLabel}>YOUR BLACK CARD</Text>
                {cardActive ? (
                  <Text style={styles.vaultStatus}>In your possession</Text>
                ) : (
                  <Text style={styles.vaultStatusCaptured}>
                    Held by {cardHolder}{cardExpiresAt ? ` · ${getCountdownText(cardExpiresAt)}` : ''}
                  </Text>
                )}
              </View>
            </View>
            {vaultCount > 0 && (
              <View style={styles.vaultBadge}>
                <Ionicons name="wallet-outline" size={14} color={COLORS.gold} />
                <Text style={styles.vaultBadgeText}>{vaultCount}</Text>
              </View>
            )}
          </View>
          {vaultCount > 0 && (
            <View style={styles.vaultCollected}>
              <Text style={styles.vaultCollectedLabel}>VAULT</Text>
              <Text style={styles.vaultCollectedNames}>
                {walletCards.map((c) => c.owner).join(' · ')}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Play buttons */}
      <View style={styles.playSection}>
        <TouchableOpacity
          style={styles.playButton}
          onPress={handleQuickPlay}
          activeOpacity={0.85}
        >
          <Ionicons name="flash" size={28} color={COLORS.black} />
          <View style={styles.playButtonText}>
            <Text style={styles.playTitle}>QUICK PLAY</Text>
            <Text style={styles.playDesc}>Solo trivia — test your knowledge</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.matchButton}
          onPress={handleStartMatch}
          activeOpacity={0.85}
        >
          <Ionicons name="people" size={28} color={COLORS.gold} />
          <View style={styles.playButtonText}>
            <Text style={styles.matchTitle}>1v1 MATCH</Text>
            <Text style={styles.matchDesc}>Challenge a player head-to-head</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Leaderboard */}
      <View style={styles.leaderboardSection}>
        <View style={styles.leaderboardHeader}>
          <View>
            <Text style={styles.leaderboardTitle}>LEADERBOARD</Text>
            <Text style={styles.leaderboardSubhead}>See who's holding weight right now.</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Leaderboard')}>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>

        <StatusBanner message={loadError} type="error" />

        {loading ? (
          <StateBlock loading title="Loading the room..." compact />
        ) : (
          <FlatList
            data={leaderboard.slice(0, 10)}
            renderItem={renderLeaderboardItem}
            keyExtractor={(item, index) => `leader-${index}`}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={COLORS.gold}
              />
            }
            ListEmptyComponent={
              <StateBlock
                title="No leaderboard yet."
                message="Run a few games and put a name on the board."
              />
            }
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  greeting: {
    fontSize: SIZES.md,
    color: COLORS.textSecondary,
    ...FONTS.regular,
  },
  username: {
    fontSize: SIZES.xxl,
    color: COLORS.white,
    ...FONTS.bold,
  },
  logoSmall: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoB: {
    fontSize: 32,
    color: COLORS.white,
    ...FONTS.bold,
  },
  logoC: {
    fontSize: 32,
    color: COLORS.gold,
    ...FONTS.bold,
  },
  heroCard: {
    marginHorizontal: 24,
    marginBottom: 20,
    padding: 20,
    borderRadius: SIZES.radiusLg,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.gold + '22',
  },
  heroEyebrow: {
    color: COLORS.gold,
    fontSize: SIZES.xs,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 8,
    ...FONTS.medium,
  },
  heroTitle: {
    color: COLORS.white,
    fontSize: SIZES.xl,
    marginBottom: 8,
    ...FONTS.bold,
  },
  heroCopy: {
    color: COLORS.textSecondary,
    fontSize: SIZES.sm,
    lineHeight: 20,
    ...FONTS.regular,
  },
  playSection: {
    paddingHorizontal: 24,
    gap: 12,
    marginBottom: 28,
  },
  playButton: {
    backgroundColor: COLORS.gold,
    borderRadius: SIZES.radiusLg,
    paddingVertical: 20,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  playButtonText: {
    flex: 1,
  },
  playTitle: {
    fontSize: SIZES.xl,
    color: COLORS.black,
    ...FONTS.bold,
    letterSpacing: 2,
  },
  playDesc: {
    fontSize: SIZES.sm,
    color: COLORS.black,
    ...FONTS.regular,
    opacity: 0.7,
    marginTop: 2,
  },
  matchButton: {
    backgroundColor: COLORS.card,
    borderRadius: SIZES.radiusLg,
    paddingVertical: 20,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  matchTitle: {
    fontSize: SIZES.xl,
    color: COLORS.gold,
    ...FONTS.bold,
    letterSpacing: 2,
  },
  matchDesc: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
    ...FONTS.regular,
    marginTop: 2,
  },
  leaderboardSection: {
    flex: 1,
    paddingHorizontal: 24,
  },
  leaderboardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  leaderboardTitle: {
    fontSize: SIZES.lg,
    color: COLORS.white,
    ...FONTS.bold,
    letterSpacing: 2,
  },
  leaderboardSubhead: {
    marginTop: 4,
    color: COLORS.textSecondary,
    fontSize: SIZES.sm,
    ...FONTS.regular,
  },
  seeAll: {
    fontSize: SIZES.md,
    color: COLORS.gold,
    ...FONTS.medium,
  },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: SIZES.radius,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  leaderRowTop: {
    borderWidth: 1,
    borderColor: COLORS.gold + '40',
  },
  rankContainer: {
    width: 36,
    alignItems: 'center',
  },
  rank: {
    fontSize: SIZES.base,
    color: COLORS.textSecondary,
    ...FONTS.bold,
  },
  rankTop: {
    fontSize: SIZES.xl,
  },
  playerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  playerName: {
    fontSize: SIZES.base,
    color: COLORS.white,
    ...FONTS.semiBold,
  },
  playerStats: {
    fontSize: SIZES.xs,
    color: COLORS.textSecondary,
    ...FONTS.regular,
    marginTop: 2,
  },
  points: {
    fontSize: SIZES.base,
    color: COLORS.textSecondary,
    ...FONTS.bold,
  },
  pointsTop: {
    color: COLORS.gold,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: SIZES.md,
    textAlign: 'center',
  },
  vaultCard: {
    marginHorizontal: 24,
    marginBottom: 20,
    padding: 16,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.gold + '28',
  },
  vaultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vaultLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  vaultDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  vaultDotActive: {
    backgroundColor: COLORS.success,
  },
  vaultDotCaptured: {
    backgroundColor: COLORS.red,
  },
  vaultLabel: {
    fontSize: SIZES.xs,
    color: COLORS.textSecondary,
    letterSpacing: 1.5,
    ...FONTS.bold,
  },
  vaultStatus: {
    fontSize: SIZES.sm,
    color: COLORS.success,
    marginTop: 2,
    ...FONTS.medium,
  },
  vaultStatusCaptured: {
    fontSize: SIZES.sm,
    color: COLORS.red,
    marginTop: 2,
    ...FONTS.medium,
  },
  vaultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.gold + '18',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.gold + '30',
  },
  vaultBadgeText: {
    fontSize: SIZES.sm,
    color: COLORS.gold,
    ...FONTS.bold,
  },
  vaultCollected: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border + '60',
  },
  vaultCollectedLabel: {
    fontSize: 9,
    color: COLORS.gold,
    letterSpacing: 2,
    marginBottom: 4,
    ...FONTS.bold,
  },
  vaultCollectedNames: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
    ...FONTS.regular,
    lineHeight: 18,
  },
});

export default HomeScreen;
