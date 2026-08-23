import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ClubSurface from './ClubSurface';
import { COLORS, FONTS, SIZES } from '../constants/theme';

const MatchRecapCard = ({ recap, loading = false }) => {
  if (loading) {
    return (
      <ClubSurface style={styles.card} contentStyle={styles.content}>
        <View style={styles.loadingRow}>
          <ActivityIndicator color={COLORS.goldLight} />
          <Text style={styles.loadingText}>Closing out the last table…</Text>
        </View>
      </ClubSurface>
    );
  }

  if (!recap) return null;

  const won = recap.viewer_result === 'win';

  return (
    <ClubSurface style={styles.card} contentStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>LAST TABLE</Text>
          <Text style={styles.headline}>{recap.headline}</Text>
        </View>
        <View style={[styles.resultSeal, won ? styles.winSeal : styles.lossSeal]}>
          <Ionicons
            name={won ? 'trophy-outline' : 'refresh-outline'}
            size={17}
            color={won ? COLORS.goldLight : COLORS.red}
          />
        </View>
      </View>

      <Text style={styles.summary}>{recap.summary}</Text>

      <View style={styles.factGrid}>
        {(recap.facts || []).slice(0, 3).map((fact) => (
          <View key={`${fact.label}-${fact.value}`} style={styles.factItem}>
            <Text style={styles.factLabel}>{fact.label}</Text>
            <Text style={styles.factValue} numberOfLines={2}>{fact.value}</Text>
          </View>
        ))}
      </View>

      <View style={styles.aiReadyRow}>
        <Ionicons name="sparkles-outline" size={13} color={COLORS.goldSoft} />
        <Text style={styles.aiReadyText}>AI-ready recap from verified match facts</Text>
      </View>
    </ClubSurface>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 24,
    marginBottom: 18,
  },
  content: {
    padding: 18,
  },
  loadingRow: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: COLORS.textMuted,
    fontSize: SIZES.sm,
    ...FONTS.medium,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
  },
  eyebrow: {
    color: COLORS.goldSoft,
    fontSize: 9,
    letterSpacing: 2.2,
    marginBottom: 5,
    ...FONTS.bold,
  },
  headline: {
    flexShrink: 1,
    color: COLORS.ivory,
    fontSize: SIZES.lg,
    lineHeight: 24,
    ...FONTS.bold,
  },
  resultSeal: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  winSeal: {
    borderColor: 'rgba(245,166,35,0.34)',
    backgroundColor: COLORS.goldWash,
  },
  lossSeal: {
    borderColor: 'rgba(231,76,60,0.32)',
    backgroundColor: COLORS.crimsonWash,
  },
  summary: {
    marginTop: 12,
    color: COLORS.textMuted,
    fontSize: SIZES.sm,
    lineHeight: 20,
    ...FONTS.regular,
  },
  factGrid: {
    marginTop: 14,
    gap: 8,
  },
  factItem: {
    paddingVertical: 9,
    paddingHorizontal: 11,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  factLabel: {
    color: COLORS.goldSoft,
    fontSize: 8,
    letterSpacing: 1.8,
    marginBottom: 3,
    ...FONTS.bold,
  },
  factValue: {
    color: COLORS.offWhite,
    fontSize: SIZES.sm,
    ...FONTS.semiBold,
  },
  aiReadyRow: {
    marginTop: 13,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  aiReadyText: {
    color: COLORS.textMuted,
    fontSize: 10,
    ...FONTS.medium,
  },
});

export default MatchRecapCard;
