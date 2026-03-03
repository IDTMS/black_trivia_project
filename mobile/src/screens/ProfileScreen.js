import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SIZES } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { getUserStatus, getLeaderboard } from '../services/api';

const ProfileScreen = () => {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState({ wins: 0, points: 0, rank: '-' });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
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
      }
    } catch (error) {
      // silently fail
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'You sure you want to leave?', [
      { text: 'Stay', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: logout },
    ]);
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
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.rank}</Text>
          <Text style={styles.statLabel}>RANK</Text>
        </View>
        <View style={[styles.statCard, styles.statCardCenter]}>
          <Text style={styles.statValue}>{stats.wins}</Text>
          <Text style={styles.statLabel}>WINS</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.points}</Text>
          <Text style={styles.statLabel}>POINTS</Text>
        </View>
      </View>

      {/* Menu */}
      <View style={styles.menuSection}>
        <TouchableOpacity style={styles.menuItem}>
          <Ionicons name="settings-outline" size={22} color={COLORS.white} />
          <Text style={styles.menuText}>Settings</Text>
          <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Ionicons name="help-circle-outline" size={22} color={COLORS.white} />
          <Text style={styles.menuText}>How to Play</Text>
          <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Ionicons name="share-social-outline" size={22} color={COLORS.white} />
          <Text style={styles.menuText}>Share with Friends</Text>
          <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuItem, styles.logoutItem]} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color={COLORS.red} />
          <Text style={[styles.menuText, styles.logoutText]}>Logout</Text>
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
  menuSection: {
    paddingHorizontal: 24,
    gap: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: SIZES.radius,
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 14,
  },
  menuText: {
    flex: 1,
    fontSize: SIZES.base,
    color: COLORS.white,
    ...FONTS.medium,
  },
  logoutItem: {
    marginTop: 16,
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
