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
import { getLeaderboard } from '../services/api';

const HomeScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await getLeaderboard();
      setLeaderboard(res.data);
    } catch (error) {
      // silently fail on leaderboard fetch
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLeaderboard();
    setRefreshing(false);
  };

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
          <Text style={styles.leaderboardTitle}>LEADERBOARD</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Leaderboard')}>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>
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
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No players yet. Be the first!</Text>
            </View>
          }
        />
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
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: SIZES.md,
  },
});

export default HomeScreen;
