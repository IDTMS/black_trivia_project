import React from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import ClubSurface from './ClubSurface';
import { COLORS, FONTS, SIZES } from '../constants/theme';

const MatchRecapCard = ({
  recap,
  loading = false,
  media = null,
  mediaLoading = false,
  mediaError = '',
  onGenerateMedia,
}) => {
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
  const hasImage = Boolean(media?.image_url);
  const artStatus = media?.status || null;
  const progress = Math.round(Number(media?.progress || 0));

  return (
    <ClubSurface style={styles.card} contentStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
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

      {hasImage ? (
        <ImageBackground
          source={{ uri: media.image_url }}
          style={styles.poster}
          imageStyle={styles.posterImage}
          resizeMode="cover"
        >
          <LinearGradient
            colors={['rgba(4,4,4,0.18)', 'rgba(4,4,4,0.58)', 'rgba(4,4,4,0.92)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.posterTopline}>
            <Text style={styles.posterKicker}>HAVNAI RIVALRY CARD</Text>
            <View style={styles.havnBadge}>
              <Ionicons name="sparkles" size={11} color={COLORS.goldLight} />
              <Text style={styles.havnBadgeText}>HAVNAI</Text>
            </View>
          </View>
          <View style={styles.posterScoreWrap}>
            <Text style={styles.posterWinner}>{recap.telemetry?.winner}</Text>
            <Text style={styles.posterScore}>
              {recap.telemetry?.winner_score} — {recap.telemetry?.loser_score}
            </Text>
            <Text style={styles.posterLoser}>{recap.telemetry?.loser}</Text>
          </View>
        </ImageBackground>
      ) : null}

      <View style={styles.factGrid}>
        {(recap.facts || []).slice(0, 3).map((fact) => (
          <View key={`${fact.label}-${fact.value}`} style={styles.factItem}>
            <Text style={styles.factLabel}>{fact.label}</Text>
            <Text style={styles.factValue} numberOfLines={2}>{fact.value}</Text>
          </View>
        ))}
      </View>

      {mediaError ? (
        <Text style={styles.mediaError}>{mediaError}</Text>
      ) : null}

      {onGenerateMedia && !hasImage ? (
        <TouchableOpacity
          style={[styles.generateButton, mediaLoading && styles.generateButtonDisabled]}
          onPress={onGenerateMedia}
          disabled={mediaLoading}
          activeOpacity={0.86}
        >
          {mediaLoading ? (
            <ActivityIndicator size="small" color={COLORS.black} />
          ) : (
            <Ionicons name="images-outline" size={16} color={COLORS.black} />
          )}
          <Text style={styles.generateButtonText}>
            {mediaLoading
              ? `${artStatus || 'Generating'}${progress > 0 ? ` ${progress}%` : ''}`
              : 'GENERATE RIVALRY CARD'}
          </Text>
        </TouchableOpacity>
      ) : null}

      <View style={styles.aiReadyRow}>
        <Ionicons name="shield-checkmark-outline" size={13} color={COLORS.goldSoft} />
        <Text style={styles.aiReadyText}>
          Scores and names are verified by Black Card; HavnAI generates the background only
        </Text>
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
  headerCopy: {
    flex: 1,
  },
  eyebrow: {
    color: COLORS.goldSoft,
    fontSize: 9,
    letterSpacing: 2.2,
    marginBottom: 5,
    ...FONTS.bold,
  },
  headline: {
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
  poster: {
    minHeight: 265,
    marginTop: 16,
    borderRadius: 18,
    overflow: 'hidden',
    padding: 16,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.borderPremium,
  },
  posterImage: {
    borderRadius: 18,
  },
  posterTopline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  posterKicker: {
    color: COLORS.champagne,
    fontSize: 8,
    letterSpacing: 2,
    ...FONTS.bold,
  },
  havnBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,200,87,0.25)',
    backgroundColor: 'rgba(0,0,0,0.48)',
  },
  havnBadgeText: {
    color: COLORS.goldLight,
    fontSize: 8,
    letterSpacing: 1.4,
    ...FONTS.bold,
  },
  posterScoreWrap: {
    alignItems: 'center',
    paddingTop: 72,
  },
  posterWinner: {
    color: COLORS.ivory,
    fontSize: SIZES.lg,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    ...FONTS.bold,
  },
  posterScore: {
    color: COLORS.goldLight,
    fontSize: 34,
    marginVertical: 5,
    letterSpacing: 2,
    ...FONTS.bold,
  },
  posterLoser: {
    color: COLORS.textSecondary,
    fontSize: SIZES.md,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    ...FONTS.semiBold,
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
  mediaError: {
    marginTop: 11,
    color: '#F3CAC6',
    fontSize: SIZES.xs,
    lineHeight: 17,
    ...FONTS.medium,
  },
  generateButton: {
    marginTop: 14,
    minHeight: 48,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.gold,
  },
  generateButtonDisabled: {
    opacity: 0.72,
  },
  generateButtonText: {
    color: COLORS.black,
    fontSize: 11,
    letterSpacing: 1.4,
    ...FONTS.bold,
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
    flex: 1,
    color: COLORS.textMuted,
    fontSize: 10,
    lineHeight: 15,
    ...FONTS.medium,
  },
});

export default MatchRecapCard;
