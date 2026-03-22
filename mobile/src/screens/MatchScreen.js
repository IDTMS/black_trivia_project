import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  Share,
  Clipboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SIZES } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import {
  startMatch,
  getMatch,
  joinMatchByCode,
  buzz as buzzApi,
  submitAnswer as submitAnswerApi,
  cancelMatch,
  leaveMatch,
} from '../services/api';

const POLL_INTERVAL = 2000;

const MatchScreen = ({ navigation, route }) => {
  const { user } = useAuth();
  const initialMatchId = route?.params?.matchId;
  const initialMode = route?.params?.initialMode || 'create'; // 'create' or 'join'

  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [phase, setPhase] = useState(initialMatchId ? 'loading' : initialMode);
  // phases: 'create', 'join', 'loading', 'waiting', 'live', 'completed'
  const [timeLeft, setTimeLeft] = useState(15);

  const pollRef = useRef(null);
  const timerRef = useRef(null);
  const matchRef = useRef(null);

  // Keep matchRef in sync
  useEffect(() => {
    matchRef.current = match;
  }, [match]);

  // Derive phase from match state
  useEffect(() => {
    if (!match) return;
    if (match.winner) {
      setPhase('completed');
    } else if (match.player2) {
      setPhase('live');
    } else {
      setPhase('waiting');
    }
  }, [match]);

  // Poll for match updates
  const pollMatch = useCallback(async (matchId) => {
    try {
      const res = await getMatch(matchId);
      setMatch(res.data);
    } catch {
      // silent poll failure
    }
  }, []);

  const startPolling = useCallback((matchId) => {
    stopPolling();
    pollRef.current = setInterval(() => pollMatch(matchId), POLL_INTERVAL);
  }, [pollMatch]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Timer for questions
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (!match || !match.question_deadline || match.winner) {
      setTimeLeft(15);
      return;
    }

    const tick = () => {
      const deadline = new Date(match.question_deadline).getTime();
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setTimeLeft(remaining);
    };

    tick();
    timerRef.current = setInterval(tick, 250);

    return () => clearInterval(timerRef.current);
  }, [match?.question_deadline, match?.current_question?.id]);

  // Initial load
  useEffect(() => {
    if (initialMatchId) {
      loadMatch(initialMatchId);
    } else {
      setLoading(false);
    }

    return () => {
      stopPolling();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const loadMatch = async (matchId) => {
    setLoading(true);
    try {
      const res = await getMatch(matchId);
      setMatch(res.data);
      startPolling(matchId);
    } catch (error) {
      Alert.alert('Error', 'Could not load match.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const showActiveMatchAlert = (matchData) => {
    if (matchData?.result === 'active_match_exists' && matchData?.message) {
      Alert.alert('Active Match', matchData.message);
    }
  };

  const handleCreateMatch = async () => {
    setActionLoading(true);
    try {
      const res = await startMatch();
      setMatch(res.data);
      if (res.data?.id) {
        startPolling(res.data.id);
      }
      showActiveMatchAlert(res.data);
    } catch (error) {
      const msg = error.response?.data?.detail || error.response?.data?.error || 'Could not create match.';
      Alert.alert('Error', msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleJoinMatch = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      Alert.alert('Enter a code', 'Type the 6-character match code.');
      return;
    }
    setActionLoading(true);
    try {
      const res = await joinMatchByCode(code);
      setMatch(res.data);
      if (res.data?.id) {
        startPolling(res.data.id);
      }
      showActiveMatchAlert(res.data);
    } catch (error) {
      const msg = error.response?.data?.detail || error.response?.data?.error || 'Could not join match.';
      Alert.alert('Error', msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleBuzz = async () => {
    if (!match) return;
    setActionLoading(true);
    try {
      const res = await buzzApi(match.id);
      setMatch(res.data);
    } catch (error) {
      const msg = error.response?.data?.detail || error.response?.data?.error || 'Buzz failed.';
      Alert.alert('Error', msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAnswer = async (answer) => {
    if (!match) return;
    setActionLoading(true);
    try {
      const res = await submitAnswerApi(match.id, null, answer);
      setMatch(res.data);
    } catch (error) {
      const msg = error.response?.data?.detail || error.response?.data?.error || 'Answer failed.';
      Alert.alert('Error', msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelMatch = async () => {
    if (!match) return;
    try {
      await cancelMatch(match.id);
      stopPolling();
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Could not cancel match.');
    }
  };

  const handleCopyCode = async () => {
    if (!match?.invite_code) return;
    try {
      Clipboard.setString(match.invite_code);
      Alert.alert('Copied', `Code ${match.invite_code} copied.`);
    } catch {
      // fallback
    }
  };

  const handleShareCode = async () => {
    if (!match?.invite_code) return;
    try {
      await Share.share({
        message: `Pull up to my Black Card match. First to ${match.target_score || 50} takes the card. Code: ${match.invite_code}`,
      });
    } catch {
      // user cancelled
    }
  };

  const handleLeave = () => {
    if (match && match.player2 && !match.winner) {
      Alert.alert(
        'Leave Match?',
        'You will forfeit the match and your opponent wins.',
        [
          { text: 'Stay', style: 'cancel' },
          {
            text: 'Leave',
            style: 'destructive',
            onPress: async () => {
              try {
                await leaveMatch(match.id);
              } catch {
                // match may already be completed
              }
              stopPolling();
              navigation.goBack();
            },
          },
        ],
      );
      return;
    }
    stopPolling();
    navigation.goBack();
  };

  const handleRematch = async () => {
    setActionLoading(true);
    try {
      const res = await startMatch();
      setMatch(res.data);
      startPolling(res.data.id);
    } catch (error) {
      const msg = error.response?.data?.detail || error.response?.data?.error || 'Could not create rematch.';
      Alert.alert('Error', msg);
    } finally {
      setActionLoading(false);
    }
  };

  // Helper: am I this player?
  const isPlayer1 = user && match?.player1?.id === user.id;
  const isPlayer2 = user && match?.player2?.id === user.id;
  const isParticipant = isPlayer1 || isPlayer2;
  const isBuzzer = user && match?.current_buzzer?.id === user.id;
  const canBuzz = match?.status === 'live' && isParticipant && !match.current_buzzer;
  const canAnswer = match?.status === 'live' && isBuzzer;

  const getTimerColor = () => {
    if (timeLeft > 10) return COLORS.green;
    if (timeLeft > 5) return COLORS.gold;
    return COLORS.red;
  };

  // ─── Lobby (create or join) ───
  if (phase === 'create' || phase === 'join') {
    return (
      <View style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={28} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>1v1 MATCH</Text>
          <View style={{ width: 28 }} />
        </View>

        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, phase === 'create' && styles.tabActive]}
            onPress={() => setPhase('create')}
          >
            <Text style={[styles.tabText, phase === 'create' && styles.tabTextActive]}>
              START MATCH
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, phase === 'join' && styles.tabActive]}
            onPress={() => setPhase('join')}
          >
            <Text style={[styles.tabText, phase === 'join' && styles.tabTextActive]}>
              GOT A CODE?
            </Text>
          </TouchableOpacity>
        </View>

        {phase === 'create' ? (
          <View style={styles.lobbyContent}>
            <Ionicons name="flash" size={48} color={COLORS.gold} style={{ alignSelf: 'center' }} />
            <Text style={styles.lobbyTitle}>Open a Room</Text>
            <Text style={styles.lobbyDesc}>
              Create a match and send the code to whoever you want smoke with. First to 50 takes the black card.
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleCreateMatch}
              disabled={actionLoading}
              activeOpacity={0.85}
            >
              {actionLoading ? (
                <ActivityIndicator color={COLORS.black} />
              ) : (
                <Text style={styles.primaryButtonText}>CREATE MATCH</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.lobbyContent}>
            <Ionicons name="people" size={48} color={COLORS.gold} style={{ alignSelf: 'center' }} />
            <Text style={styles.lobbyTitle}>Join a Match</Text>
            <Text style={styles.lobbyDesc}>
              Got a code from someone? Punch it in and pull up.
            </Text>
            <TextInput
              style={styles.codeInput}
              value={joinCode}
              onChangeText={setJoinCode}
              placeholder="ABC123"
              placeholderTextColor={COLORS.gray}
              maxLength={6}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleJoinMatch}
              disabled={actionLoading}
              activeOpacity={0.85}
            >
              {actionLoading ? (
                <ActivityIndicator color={COLORS.black} />
              ) : (
                <Text style={styles.primaryButtonText}>JOIN MATCH</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  // ─── Loading ───
  if (phase === 'loading' || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.gold} />
        <Text style={styles.loadingText}>Loading match...</Text>
      </View>
    );
  }

  // ─── Waiting for opponent ───
  if (phase === 'waiting' && match) {
    return (
      <View style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={handleLeave}>
            <Ionicons name="arrow-back" size={28} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>WAITING</Text>
          <View style={{ width: 28 }} />
        </View>

        <View style={styles.waitingContent}>
          <View style={styles.codeCard}>
            <Text style={styles.codeLabel}>MATCH CODE</Text>
            <Text style={styles.codeValue}>{match.invite_code || '------'}</Text>
          </View>

          <Text style={styles.waitingDesc}>
            Send this code to your opponent. It's on when they join.
          </Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleCopyCode}>
              <Ionicons name="copy-outline" size={18} color={COLORS.white} />
              <Text style={styles.secondaryButtonText}>COPY</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleShareCode}>
              <Ionicons name="share-outline" size={18} color={COLORS.white} />
              <Text style={styles.secondaryButtonText}>SHARE</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.cancelButton} onPress={handleCancelMatch}>
            <Text style={styles.cancelButtonText}>CANCEL MATCH</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── Completed ───
  if (phase === 'completed' && match) {
    const isWinner = user && match.winner?.id === user.id;
    const winnerName = match.winner?.username || 'Winner';
    const loserName = match.loser?.username || 'Loser';

    return (
      <View style={styles.container}>
        <View style={styles.topBar}>
          <View style={{ width: 28 }} />
          <Text style={styles.topTitle}>MATCH OVER</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView contentContainerStyle={styles.completedContent}>
          <Text style={[styles.resultLabel, { color: isWinner ? COLORS.gold : COLORS.red }]}>
            {isWinner ? 'VICTORY' : 'DEFEAT'}
          </Text>
          <Text style={styles.resultHeadline}>
            {isWinner
              ? `You took ${loserName}'s black card.`
              : `${winnerName} took ${loserName}'s black card.`}
          </Text>

          <View style={styles.finalScoreRow}>
            <View style={[styles.finalScoreCard, match.player1_score > match.player2_score && styles.finalScoreWinner]}>
              <Text style={styles.finalScoreLabel}>{match.player1?.username}</Text>
              <Text style={styles.finalScoreValue}>{match.player1_score}</Text>
            </View>
            <Text style={styles.vsText}>VS</Text>
            <View style={[styles.finalScoreCard, match.player2_score > match.player1_score && styles.finalScoreWinner]}>
              <Text style={styles.finalScoreLabel}>{match.player2?.username}</Text>
              <Text style={styles.finalScoreValue}>{match.player2_score}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleRematch}
            disabled={actionLoading}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonText}>REMATCH</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelButton} onPress={handleLeave}>
            <Text style={styles.cancelButtonText}>LEAVE ARENA</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ─── Live match ───
  if (!match || !match.current_question) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.gold} />
        <Text style={styles.loadingText}>Loading question...</Text>
      </View>
    );
  }

  const question = match.current_question;
  const turnMessage = isBuzzer
    ? 'You got the buzzer. Pick your answer.'
    : match.current_buzzer
      ? `${match.current_buzzer.username} buzzed. Waiting on their answer.`
      : match.locked_out_player && user && match.locked_out_player.id === user.id
        ? 'You missed. Opponent can steal.'
        : match.locked_out_player
          ? `${match.locked_out_player.username} missed. Steal it.`
          : 'Buzz in first!';

  return (
    <View style={styles.container}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={handleLeave}>
          <Ionicons name="arrow-back" size={28} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>LIVE</Text>
        <View style={[styles.timerBadge, { borderColor: getTimerColor() }]}>
          <Text style={[styles.timerText, { color: getTimerColor() }]}>{timeLeft}s</Text>
        </View>
      </View>

      {/* Score row */}
      <View style={styles.scoreRow}>
        <View style={[styles.scoreCard, match.player1_score > match.player2_score && styles.scoreCardLeading]}>
          <Text style={styles.scoreName} numberOfLines={1}>{match.player1?.username}</Text>
          <Text style={styles.scoreValue}>{match.player1_score}</Text>
        </View>
        <Text style={styles.vsSmall}>VS</Text>
        <View style={[styles.scoreCard, match.player2_score > match.player1_score && styles.scoreCardLeading]}>
          <Text style={styles.scoreName} numberOfLines={1}>{match.player2?.username}</Text>
          <Text style={styles.scoreValue}>{match.player2_score}</Text>
        </View>
      </View>

      {/* Category */}
      <View style={styles.categoryRow}>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>
            {question.category.replace('_', ' ').toUpperCase()}
          </Text>
        </View>
        <Text style={styles.turnText} numberOfLines={1}>{turnMessage}</Text>
      </View>

      {/* Question */}
      <ScrollView style={styles.questionScroll} contentContainerStyle={styles.questionScrollContent}>
        <Text style={styles.questionText}>{question.text}</Text>

        {/* Buzz button */}
        {!match.current_buzzer && !match.locked_out_player && (
          <TouchableOpacity
            style={[styles.buzzButton, !canBuzz && styles.buzzButtonDisabled]}
            onPress={handleBuzz}
            disabled={!canBuzz || actionLoading}
            activeOpacity={0.8}
          >
            <Text style={styles.buzzButtonText}>
              {actionLoading ? 'BUZZING...' : 'BUZZ IN'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Steal buzz - when opponent missed, you can buzz to steal */}
        {match.locked_out_player && !match.current_buzzer && isParticipant &&
          user && match.locked_out_player.id !== user.id && (
          <TouchableOpacity
            style={styles.buzzButton}
            onPress={handleBuzz}
            disabled={actionLoading}
            activeOpacity={0.8}
          >
            <Text style={styles.buzzButtonText}>
              {actionLoading ? 'BUZZING...' : 'STEAL IT'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Answer choices */}
        {question.choices && (
          <View style={styles.choicesContainer}>
            {question.choices.map((choice, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.choiceButton, canAnswer && styles.choiceButtonActive]}
                onPress={() => handleAnswer(choice)}
                disabled={!canAnswer || actionLoading}
                activeOpacity={0.8}
              >
                <Text style={styles.choiceLetter}>
                  {String.fromCharCode(65 + index)}
                </Text>
                <Text style={[styles.choiceText, canAnswer && styles.choiceTextActive]}>
                  {choice}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: 56,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: SIZES.base,
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  topTitle: {
    fontSize: SIZES.lg,
    color: COLORS.white,
    ...FONTS.bold,
    letterSpacing: 3,
  },

  // Tabs
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabActive: {
    backgroundColor: COLORS.gold,
    borderColor: COLORS.gold,
  },
  tabText: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
    ...FONTS.bold,
    letterSpacing: 1.5,
  },
  tabTextActive: {
    color: COLORS.black,
  },

  // Lobby
  lobbyContent: {
    gap: 16,
    paddingTop: 20,
  },
  lobbyTitle: {
    fontSize: SIZES.xxl,
    color: COLORS.white,
    ...FONTS.bold,
    textAlign: 'center',
  },
  lobbyDesc: {
    fontSize: SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 12,
  },
  codeInput: {
    backgroundColor: COLORS.card,
    borderRadius: SIZES.radius,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.white,
    fontSize: SIZES.xxl,
    ...FONTS.bold,
    textAlign: 'center',
    letterSpacing: 8,
    paddingVertical: 18,
    marginTop: 8,
  },
  primaryButton: {
    backgroundColor: COLORS.gold,
    borderRadius: SIZES.radius,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: COLORS.black,
    fontSize: SIZES.lg,
    ...FONTS.bold,
    letterSpacing: 2,
  },

  // Waiting
  waitingContent: {
    flex: 1,
    justifyContent: 'center',
    gap: 20,
  },
  codeCard: {
    backgroundColor: COLORS.card,
    borderRadius: SIZES.radiusLg,
    borderWidth: 1,
    borderColor: COLORS.gold + '40',
    padding: 28,
    alignItems: 'center',
  },
  codeLabel: {
    fontSize: SIZES.xs,
    color: COLORS.gold,
    ...FONTS.bold,
    letterSpacing: 3,
    marginBottom: 8,
  },
  codeValue: {
    fontSize: 42,
    color: COLORS.gold,
    ...FONTS.bold,
    letterSpacing: 10,
  },
  waitingDesc: {
    fontSize: SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    backgroundColor: COLORS.card,
    borderRadius: SIZES.radius,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: COLORS.white,
    fontSize: SIZES.sm,
    ...FONTS.bold,
    letterSpacing: 1,
  },
  cancelButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: COLORS.textSecondary,
    fontSize: SIZES.sm,
    ...FONTS.medium,
    letterSpacing: 1,
  },

  // Scores
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  scoreCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: SIZES.radius,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    alignItems: 'center',
  },
  scoreCardLeading: {
    borderColor: COLORS.gold + '60',
    backgroundColor: COLORS.card + 'ee',
  },
  scoreName: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
    ...FONTS.medium,
  },
  scoreValue: {
    fontSize: SIZES.xxl,
    color: COLORS.white,
    ...FONTS.bold,
  },
  vsSmall: {
    fontSize: SIZES.xs,
    color: COLORS.gold,
    ...FONTS.bold,
    letterSpacing: 2,
  },

  // Category & turn
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  categoryBadge: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  categoryText: {
    fontSize: SIZES.xs,
    color: COLORS.gold,
    ...FONTS.bold,
    letterSpacing: 1,
  },
  turnText: {
    flex: 1,
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
    ...FONTS.medium,
  },

  // Timer
  timerBadge: {
    borderWidth: 2,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 3,
  },
  timerText: {
    fontSize: SIZES.md,
    ...FONTS.bold,
  },

  // Question
  questionScroll: {
    flex: 1,
  },
  questionScrollContent: {
    paddingBottom: 40,
  },
  questionText: {
    fontSize: SIZES.xl,
    color: COLORS.white,
    ...FONTS.semiBold,
    lineHeight: 30,
    marginBottom: 20,
  },

  // Buzz
  buzzButton: {
    backgroundColor: COLORS.red,
    borderRadius: 999,
    paddingVertical: 22,
    alignItems: 'center',
    marginBottom: 20,
  },
  buzzButtonDisabled: {
    opacity: 0.4,
  },
  buzzButtonText: {
    color: COLORS.white,
    fontSize: SIZES.xl,
    ...FONTS.bold,
    letterSpacing: 3,
  },

  // Choices
  choicesContainer: {
    gap: 10,
  },
  choiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: SIZES.radius,
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 14,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    opacity: 0.4,
  },
  choiceButtonActive: {
    opacity: 1,
    borderColor: COLORS.gold + '40',
  },
  choiceLetter: {
    fontSize: SIZES.md,
    color: COLORS.gold,
    ...FONTS.bold,
    width: 24,
  },
  choiceText: {
    flex: 1,
    fontSize: SIZES.base,
    color: COLORS.textSecondary,
  },
  choiceTextActive: {
    color: COLORS.white,
  },

  // Completed
  completedContent: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 40,
    gap: 16,
  },
  resultLabel: {
    fontSize: SIZES.xxxl,
    ...FONTS.bold,
    letterSpacing: 6,
  },
  resultHeadline: {
    fontSize: SIZES.lg,
    color: COLORS.white,
    ...FONTS.medium,
    textAlign: 'center',
    lineHeight: 26,
    paddingHorizontal: 12,
  },
  finalScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
    marginBottom: 16,
  },
  finalScoreCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: SIZES.radiusLg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    alignItems: 'center',
  },
  finalScoreWinner: {
    borderColor: COLORS.gold,
  },
  finalScoreLabel: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
    ...FONTS.medium,
    marginBottom: 4,
  },
  finalScoreValue: {
    fontSize: SIZES.xxxl,
    color: COLORS.white,
    ...FONTS.bold,
  },
  vsText: {
    fontSize: SIZES.sm,
    color: COLORS.gold,
    ...FONTS.bold,
    letterSpacing: 2,
  },
});

export default MatchScreen;
