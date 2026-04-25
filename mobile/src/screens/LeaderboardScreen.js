import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
} from 'react-native';
import { COLORS, FONTS, SIZES } from '../constants/theme';
import { getLeaderboard } from '../services/api';
import { useAuth } from '../context/AuthContext';
import StatusBanner from '../components/StatusBanner';
import StateBlock from '../components/StateBlock';

const LeaderboardScreen = () => {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await getLeaderboard();
      setLeaderboard(res.data);
      setLoadError('');
    } catch (error) {
      setLoadError('Could not load the leaderboard right now. Pull to try again.');
    } finally {
      setLoading(false);
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

  const getRankDisplay = (index) => {
    if (index === 0) return { text: '1ST', color: COLORS.gold };
    if (index === 1) return { text: '2ND', color: '#C0C0C0' };
    if (index === 2) return { text: '3RD', color: '#CD7F32' };
    return { text: `${index + 1}`, color: COLORS.textSecondary };
  };

  const renderItem = ({ item, index }) => {
    const rank = getRankDisplay(index);
    const isCurrentUser = item.user === user?.username;

    return (
      <View style={[styles.row, isCurrentUser && styles.rowHighlight]}>
        <View style={[styles.rankBadge, { borderColor: rank.color }]}>
          <Text style={[styles.rankText, { color: rank.color }]}>{rank.text}</Text>
        </View>

        <View style={styles.playerInfo}>
          <Text style={[styles.playerName, isCurrentUser && styles.playerNameHighlight]}>
            {item.user} {isCurrentUser ? '(you)' : ''}
          </Text>
          <View style={styles.statsRow}>
            <Text style={styles.statText}>{item.wins} wins</Text>
          </View>
        </View>

        <View style={styles.pointsCol}>
          <Text style={[styles.pointsValue, index < 3 && styles.pointsTop]}>
            {item.points}
          </Text>
          <Text style={styles.pointsLabel}>pts</Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StateBlock loading title="Loading the board..." compact />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>LEADERBOARD</Text>
        <Text style={styles.subtitle}>{leaderboard.length} players</Text>
      </View>

      <StatusBanner message={loadError} type="error" style={styles.bannerSpacing} />

      <FlatList
        data={leaderboard}
        renderItem={renderItem}
        keyExtractor={(item, index) => `lb-${index}`}
        contentContainerStyle={styles.list}
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
            title="No players on the board yet."
            message="Play a game to get ranked."
          />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: 60,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  title: {
    fontSize: SIZES.xxl,
    color: COLORS.white,
    ...FONTS.bold,
    letterSpacing: 3,
  },
  subtitle: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
    ...FONTS.regular,
    marginTop: 4,
  },
  list: {
    paddingHorizontal: 24,
    paddingBottom: 100,
  },
  bannerSpacing: {
    marginHorizontal: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: SIZES.radius,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  rowHighlight: {
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  rankBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankText: {
    fontSize: SIZES.sm,
    ...FONTS.bold,
  },
  playerInfo: {
    flex: 1,
    marginLeft: 14,
  },
  playerName: {
    fontSize: SIZES.base,
    color: COLORS.white,
    ...FONTS.semiBold,
  },
  playerNameHighlight: {
    color: COLORS.gold,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  statText: {
    fontSize: SIZES.xs,
    color: COLORS.textSecondary,
    ...FONTS.regular,
  },
  pointsCol: {
    alignItems: 'center',
  },
  pointsValue: {
    fontSize: SIZES.xl,
    color: COLORS.textSecondary,
    ...FONTS.bold,
  },
  pointsTop: {
    color: COLORS.gold,
  },
  pointsLabel: {
    fontSize: SIZES.xs,
    color: COLORS.textSecondary,
    ...FONTS.regular,
  },
  emptySubtext: {
    color: COLORS.textSecondary,
    fontSize: SIZES.md,
    marginTop: 8,
  },
});

export default LeaderboardScreen;
