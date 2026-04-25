import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SIZES } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { getLeaderboard } from '../services/api';
import StatusBanner from '../components/StatusBanner';

const ProfileScreen = () => {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState({ wins: 0, points: 0, rank: '-' });
  const [loadingStats, setLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState('');
  const [helperMessage, setHelperMessage] = useState('');

  useEffect(() => {
    fetchStats();
  }, [user?.username]);

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const res = await getLeaderboard();
      const data = res.data;
      const index = data.findIndex((p) => p.user === user?.username);
      if (index !== -1) {
        setStats({
          wins: data[index].wins,
          points: data[index].points,
          rank: index + 1,
        });
      } else {
        setStats({ wins: 0, points: 0, rank: '-' });
      }
      setStatsError('');
    } catch {
      setStatsError('Could not load your stats right now.');
    } finally {
      setLoadingStats(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'You sure you want to leave?', [
      { text: 'Stay', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: logout },
    ]);
  };

  const handleViewLeaderboard = () => {
    setHelperMessage('Leaderboard lives on the board tab. Check your rank against the room there.');
  };

  const handleHowToPlay = () => {
    setHelperMessage('Quick Play gives you 10 timed questions. 1v1 Match is first to 50, with buzz-ins and steal chances after a miss.');
  };

  return (
    <View style={styles.container}>
      {/* Avatar / Name */}
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.username?.charAt(0).toUpperCase() || '?'}
          </Text>
        </View>
        <Text style={styles.username}>{user?.username || 'Player'}</Text>
        <Text style={styles.memberSince}>Black Card Member</Text>
      </View>

      {/* Stats */}
      <StatusBanner message={statsError} type="error" style={styles.bannerSpacing} />
      <StatusBanner message={helperMessage} type="info" style={styles.bannerSpacing} />
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          {loadingStats ? <ActivityIndicator color={COLORS.gold} /> : <Text style={styles.statValue}>{stats.rank}</Text>}
          <Text style={styles.statLabel}>RANK</Text>
        </View>
        <View style={[styles.statCard, styles.statCardCenter]}>
          {loadingStats ? <ActivityIndicator color={COLORS.gold} /> : <Text style={styles.statValue}>{stats.wins}</Text>}
          <Text style={styles.statLabel}>WINS</Text>
        </View>
        <View style={styles.statCard}>
          {loadingStats ? <ActivityIndicator color={COLORS.gold} /> : <Text style={styles.statValue}>{stats.points}</Text>}
          <Text style={styles.statLabel}>POINTS</Text>
        </View>
      </View>

      <View style={styles.sectionBlock}>
        <Text style={styles.sectionEyebrow}>Account</Text>
        <Text style={styles.sectionTitle}>Keep it honest.</Text>
        <Text style={styles.sectionCopy}>
          This account is signed in as <Text style={styles.sectionCopyStrong}>{user?.username || 'Player'}</Text>.
        </Text>
      </View>

      {/* Menu */}
      <View style={styles.menuSection}>
        <TouchableOpacity style={styles.menuItem} onPress={handleViewLeaderboard}>
          <Ionicons name="trophy-outline" size={22} color={COLORS.white} />
          <View style={styles.menuCopyWrap}>
            <Text style={styles.menuText}>Your Standing</Text>
            <Text style={styles.menuSubtext}>Check where you sit on the board right now.</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={handleHowToPlay}>
          <Ionicons name="help-circle-outline" size={22} color={COLORS.white} />
          <View style={styles.menuCopyWrap}>
            <Text style={styles.menuText}>How Matches Work</Text>
            <Text style={styles.menuSubtext}>Quick reminder on solo rounds, buzz-ins, and steals.</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuItem, styles.logoutItem]} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color={COLORS.red} />
          <View style={styles.menuCopyWrap}>
            <Text style={[styles.menuText, styles.logoutText]}>Logout</Text>
            <Text style={styles.menuSubtext}>Leave this account and return to sign-in.</Text>
          </View>
        </TouchableOpacity>
      </View>

      <Text style={styles.version}>Black Card v1.0.0</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: 60,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.gold,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 38,
    color: COLORS.black,
    ...FONTS.bold,
  },
  username: {
    fontSize: SIZES.xxl,
    color: COLORS.white,
    ...FONTS.bold,
  },
  memberSince: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
    ...FONTS.regular,
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  bannerSpacing: {
    marginHorizontal: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: SIZES.radius,
    paddingVertical: 20,
    alignItems: 'center',
  },
  statCardCenter: {
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: COLORS.gold + '40',
  },
  statValue: {
    fontSize: SIZES.xxl,
    color: COLORS.gold,
    ...FONTS.bold,
  },
  statLabel: {
    fontSize: SIZES.xs,
    color: COLORS.textSecondary,
    ...FONTS.bold,
    letterSpacing: 1,
    marginTop: 4,
  },
  sectionBlock: {
    marginHorizontal: 24,
    marginBottom: 24,
    padding: 18,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.gold + '22',
  },
  sectionEyebrow: {
    color: COLORS.gold,
    fontSize: SIZES.xs,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginBottom: 8,
    ...FONTS.medium,
  },
  sectionTitle: {
    color: COLORS.white,
    fontSize: SIZES.lg,
    marginBottom: 6,
    ...FONTS.bold,
  },
  sectionCopy: {
    color: COLORS.textSecondary,
    fontSize: SIZES.sm,
    lineHeight: 20,
    ...FONTS.regular,
  },
  sectionCopyStrong: {
    color: COLORS.offWhite,
    ...FONTS.semiBold,
  },
  menuSection: {
    paddingHorizontal: 24,
    gap: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.card,
    borderRadius: SIZES.radius,
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 14,
  },
  menuCopyWrap: {
    flex: 1,
  },
  menuText: {
    fontSize: SIZES.base,
    color: COLORS.white,
    ...FONTS.medium,
  },
  menuSubtext: {
    marginTop: 4,
    color: COLORS.textSecondary,
    fontSize: SIZES.sm,
    lineHeight: 18,
    ...FONTS.regular,
  },
  logoutItem: {
    marginTop: 8,
    backgroundColor: COLORS.red + '15',
    borderWidth: 1,
    borderColor: COLORS.red + '30',
  },
  logoutText: {
    color: COLORS.red,
  },
  version: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    fontSize: SIZES.xs,
    ...FONTS.regular,
    marginTop: 'auto',
    marginBottom: 32,
  },
});

export default ProfileScreen;
