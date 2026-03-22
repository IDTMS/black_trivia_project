import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, FONTS, SIZES } from '../constants/theme';
import {
  cancelMatch,
  buzz as buzzApi,
  getMatch,
  joinMatchByCode,
  leaveMatch,
  startMatch,
  submitAnswer as submitAnswerApi,
} from '../services/api';
import {
  fadeOutAmbient,
  playConfirm,
  playCorrect,
  playDefeat,
  playVictory,
  playWrong,
} from '../utils/soundEngine';

const POLL_INTERVAL = 2000;
const CARD_ART = require('../../assets/blackcard.png');

const getParticipantId = (match, fallbackUserId) => {
  if (!match) return fallbackUserId || null;
  if (match.user_role === 'player1') return match.player1?.id || fallbackUserId || null;
  if (match.user_role === 'player2') return match.player2?.id || fallbackUserId || null;
  if (match.player1?.id === fallbackUserId) return fallbackUserId;
  if (match.player2?.id === fallbackUserId) return fallbackUserId;
  return fallbackUserId || null;
};

const getScoreForUser = (match, fallbackUserId) => {
  const participantId = getParticipantId(match, fallbackUserId);
  if (!match || !participantId) return 0;
  if (participantId === match.player1?.id) return match.player1_score || 0;
  if (participantId === match.player2?.id) return match.player2_score || 0;
  return 0;
};

const getTimerColor = (timeLeft) => {
  if (timeLeft > 10) return COLORS.green;
  if (timeLeft > 5) return COLORS.goldLight;
  return COLORS.red;
};

const ScoreMeter = ({ name, score, target, align = 'left' }) => {
  const progress = Math.min(1, score / Math.max(1, target || 50));

  return (
    <View style={styles.scoreMeter}>
      <View style={[styles.scoreMeterHeader, align === 'right' && styles.scoreMeterHeaderRight]}>
        <Text style={styles.scoreMeterName} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.scoreMeterValue}>{score}</Text>
      </View>
      <View style={styles.scoreMeterTrack}>
        <LinearGradient
          colors={['#7A1526', '#D3A54D', '#F5A623']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[styles.scoreMeterFill, { width: `${progress * 100}%` }]}
        />
      </View>
    </View>
  );
};

const MatchScreen = ({ navigation, route }) => {
  const initialMatchId = route?.params?.matchId;
  const initialMode = route?.params?.initialMode || 'create';

  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(Boolean(initialMatchId));
  const [actionLoading, setActionLoading] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [phase, setPhase] = useState(initialMatchId ? 'loading' : initialMode);
  const [timeLeft, setTimeLeft] = useState(15);
  const [feedback, setFeedback] = useState(null);

  const pollRef = useRef(null);
  const timerRef = useRef(null);
  const pulseLoopRef = useRef(null);
  const feedbackTimeoutRef = useRef(null);
  const matchRef = useRef(null);
  const questionAnim = useRef(new Animated.Value(0)).current;
  const answersAnim = useRef(new Animated.Value(0)).current;
  const feedbackAnim = useRef(new Animated.Value(0)).current;
  const joinFlashAnim = useRef(new Animated.Value(0)).current;
  const timerScale = useRef(new Animated.Value(1)).current;
  const hasPlayedResultAudioRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      fadeOutAmbient(500, true).catch(() => {});
      return undefined;
    }, [])
  );

  const animateQuestionIn = useCallback(() => {
    questionAnim.setValue(0);
    answersAnim.setValue(0);
    Animated.parallel([
      Animated.timing(questionAnim, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(answersAnim, {
        toValue: 1,
        duration: 360,
        delay: 90,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [answersAnim, questionAnim]);

  const showFeedback = useCallback(
    (type, text) => {
      setFeedback({ type, text });
      feedbackAnim.setValue(0);

      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }

      Animated.sequence([
        Animated.timing(feedbackAnim, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(1000),
        Animated.timing(feedbackAnim, {
          toValue: 0,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          setFeedback(null);
        }
      });
    },
    [feedbackAnim]
  );

  const flashJoinCue = useCallback(() => {
    joinFlashAnim.setValue(0);
    Animated.sequence([
      Animated.timing(joinFlashAnim, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(joinFlashAnim, {
        toValue: 0,
        duration: 420,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [joinFlashAnim]);

  const applyMatchState = useCallback(
    (nextMatch, source = 'poll') => {
      const previousMatch = matchRef.current;
      const participantId = getParticipantId(nextMatch);
      const prevParticipantId = getParticipantId(previousMatch);

      setMatch(nextMatch);

      if (!previousMatch?.current_question?.id || previousMatch.current_question.id !== nextMatch?.current_question?.id) {
        animateQuestionIn();
      }

      if (previousMatch && !previousMatch.player2 && nextMatch?.player2 && !nextMatch?.winner) {
        flashJoinCue();
        playConfirm().catch(() => {});
      }

      if (previousMatch && nextMatch) {
        const previousScore = getScoreForUser(previousMatch, prevParticipantId);
        const nextScore = getScoreForUser(nextMatch, participantId);

        if (nextScore > previousScore) {
          showFeedback('correct', `+${nextScore - previousScore} points`);
          playCorrect().catch(() => {});
        } else if (
          source === 'answer' &&
          previousMatch.current_buzzer?.id === participantId &&
          nextMatch.locked_out_player?.id === participantId
        ) {
          showFeedback('wrong', 'Wrong answer');
          playWrong().catch(() => {});
        }
      }

      if (nextMatch?.winner && !hasPlayedResultAudioRef.current) {
        hasPlayedResultAudioRef.current = true;
        if (nextMatch.winner.id === participantId) {
          playVictory().catch(() => {});
        } else {
          playDefeat().catch(() => {});
        }
      }

      if (!nextMatch?.winner) {
        hasPlayedResultAudioRef.current = false;
      }
    },
    [animateQuestionIn, flashJoinCue, showFeedback]
  );

  useEffect(() => {
    matchRef.current = match;
  }, [match]);

  useEffect(() => {
    if (!match) return;
    if (match.winner) {
      setPhase('completed');
      return;
    }
    if (match.player2) {
      setPhase('live');
      return;
    }
    setPhase('waiting');
  }, [match]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollMatch = useCallback(
    async (matchId) => {
      try {
        const res = await getMatch(matchId);
        applyMatchState(res.data);
      } catch {
        // keep polling quiet
      }
    },
    [applyMatchState]
  );

  const startPolling = useCallback(
    (matchId) => {
      stopPolling();
      pollRef.current = setInterval(() => pollMatch(matchId), POLL_INTERVAL);
    },
    [pollMatch, stopPolling]
  );

  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    if (!match?.question_deadline || match?.winner) {
      setTimeLeft(match?.question_time_limit_seconds || 15);
      return undefined;
    }

    const tick = () => {
      const deadline = new Date(match.question_deadline).getTime();
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setTimeLeft(remaining);
    };

    tick();
    timerRef.current = setInterval(tick, 250);

    return () => clearInterval(timerRef.current);
  }, [match?.question_deadline, match?.winner, match?.question_time_limit_seconds]);

  useEffect(() => {
    if (pulseLoopRef.current) {
      pulseLoopRef.current.stop();
      pulseLoopRef.current = null;
    }

    if (phase === 'live' && timeLeft <= 5 && !match?.winner) {
      pulseLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(timerScale, {
            toValue: 1.08,
            duration: 260,
            useNativeDriver: true,
          }),
          Animated.timing(timerScale, {
            toValue: 1,
            duration: 260,
            useNativeDriver: true,
          }),
        ])
      );
      pulseLoopRef.current.start();
    } else {
      timerScale.setValue(1);
    }

    return () => {
      if (pulseLoopRef.current) {
        pulseLoopRef.current.stop();
        pulseLoopRef.current = null;
      }
    };
  }, [match?.winner, phase, timeLeft, timerScale]);

  useEffect(() => {
    return () => {
      stopPolling();
      if (timerRef.current) clearInterval(timerRef.current);
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
      if (pulseLoopRef.current) pulseLoopRef.current.stop();
    };
  }, [stopPolling]);

  useEffect(() => {
    if (!initialMatchId) {
      setLoading(false);
      return undefined;
    }

    let active = true;

    const loadInitialMatch = async () => {
      try {
        const res = await getMatch(initialMatchId);
        if (!active) return;
        applyMatchState(res.data, 'load');
        startPolling(initialMatchId);
      } catch {
        if (active) {
          Alert.alert('Error', 'Could not load match.');
          navigation.goBack();
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadInitialMatch();

    return () => {
      active = false;
      stopPolling();
      if (timerRef.current) clearInterval(timerRef.current);
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    };
  }, [applyMatchState, initialMatchId, navigation, startPolling, stopPolling]);

  const showActiveMatchAlert = useCallback((matchData) => {
    if (matchData?.result === 'active_match_exists' && matchData?.message) {
      Alert.alert('Active Match', matchData.message);
      return true;
    }
    return false;
  }, []);

  const resolveErrorMessage = (error, fallback) =>
    error.response?.data?.message ||
    error.response?.data?.detail ||
    error.response?.data?.error ||
    fallback;

  const handleCreateMatch = async () => {
    setActionLoading(true);
    try {
      const res = await startMatch();
      applyMatchState(res.data, 'create');
      if (res.data?.id) {
        startPolling(res.data.id);
      }
      showActiveMatchAlert(res.data);
    } catch (error) {
      Alert.alert('Error', resolveErrorMessage(error, 'Could not create match.'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleJoinMatch = async () => {
    const inviteCode = joinCode.trim().toUpperCase();
    if (!inviteCode) {
      Alert.alert('Enter a code', 'Type the 6-character match code.');
      return;
    }

    setActionLoading(true);
    try {
      const res = await joinMatchByCode(inviteCode);
      applyMatchState(res.data, 'join');
      if (res.data?.id) {
        startPolling(res.data.id);
      }
      showActiveMatchAlert(res.data);
    } catch (error) {
      Alert.alert('Unable to Join', resolveErrorMessage(error, 'Could not join match.'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleBuzz = async () => {
    if (!match) return;
    setActionLoading(true);
    try {
      const res = await buzzApi(match.id);
      applyMatchState(res.data, 'buzz');
    } catch (error) {
      Alert.alert('Buzz Failed', resolveErrorMessage(error, 'Could not claim the buzzer.'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleAnswer = async (answer) => {
    if (!match) return;
    setActionLoading(true);
    try {
      const res = await submitAnswerApi(match.id, null, answer);
      applyMatchState(res.data, 'answer');
    } catch (error) {
      Alert.alert('Answer Failed', resolveErrorMessage(error, 'Could not submit answer.'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelMatch = async () => {
    if (!match) return;
    try {
      await cancelMatch(match.id);
      stopPolling();
      navigation.popToTop();
    } catch (error) {
      Alert.alert('Error', resolveErrorMessage(error, 'Could not cancel match.'));
    }
  };

  const handleCopyCode = async () => {
    if (!match?.invite_code) return;
    try {
      await Clipboard.setStringAsync(match.invite_code);
      Alert.alert('Copied', `${match.invite_code} is ready to send.`);
    } catch {
      Alert.alert('Copy Failed', 'Could not copy the match code on this device.');
    }
  };

  const handleShareCode = async () => {
    if (!match?.invite_code) return;
    try {
      await Share.share({
        message: `I opened a Black Card match. First to ${match.target_score || 50} takes the card. Code: ${match.invite_code}`,
      });
    } catch {
      // share sheet dismissed
    }
  };

  const leaveAndReturn = useCallback(() => {
    stopPolling();
    navigation.popToTop();
  }, [navigation, stopPolling]);

  const handleLeave = () => {
    if (match && match.player2 && !match.winner) {
      Alert.alert(
        'Leave Match?',
        'Leaving now forfeits the match and gives the card away.',
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
              leaveAndReturn();
            },
          },
        ]
      );
      return;
    }

    leaveAndReturn();
  };

  const handleRematch = async () => {
    setActionLoading(true);
    try {
      const res = await startMatch();
      applyMatchState(res.data, 'rematch');
      if (res.data?.id) {
        startPolling(res.data.id);
      }
      showActiveMatchAlert(res.data);
    } catch (error) {
      Alert.alert('Error', resolveErrorMessage(error, 'Could not create rematch.'));
    } finally {
      setActionLoading(false);
    }
  };

  const currentUserMatchId = getParticipantId(match);
  const isBuzzer = Boolean(currentUserMatchId && match?.current_buzzer?.id === currentUserMatchId);
  const canBuzz = match?.status === 'live' && Boolean(currentUserMatchId) && !match.current_buzzer;
  const canAnswer = match?.status === 'live' && isBuzzer;

  const question = match?.current_question;
  const targetScore = match?.target_score || 50;
  const roundName = match?.round_name || 'Private Match';
  const timerColor = getTimerColor(timeLeft);
  const turnMessage = useMemo(() => {
    if (!match) return '';
    if (isBuzzer) return 'You have the buzzer. Lock it in.';
    if (match.current_buzzer) return `${match.current_buzzer.username} has control.`;
    if (match.locked_out_player?.id === currentUserMatchId) return 'You missed. Your opponent can steal.';
    if (match.locked_out_player) return `${match.locked_out_player.username} missed. Take the steal.`;
    return 'Buzz in first and control the round.';
  }, [currentUserMatchId, isBuzzer, match]);

  if (phase === 'create' || phase === 'join') {
    return (
      <View style={styles.screen}>
        <LinearGradient colors={['#050505', '#110c0f', '#060606']} style={StyleSheet.absoluteFill} />
        <View style={styles.shell}>
          <View style={styles.navBar}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={26} color={COLORS.offWhite} />
            </TouchableOpacity>
            <Text style={styles.navTitle}>PRIVATE MATCH</Text>
            <View style={{ width: 26 }} />
          </View>

          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.modeTab, phase === 'create' && styles.modeTabActive]}
              onPress={() => setPhase('create')}
            >
              <Text style={[styles.modeTabText, phase === 'create' && styles.modeTabTextActive]}>
                CREATE
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeTab, phase === 'join' && styles.modeTabActive]}
              onPress={() => setPhase('join')}
            >
              <Text style={[styles.modeTabText, phase === 'join' && styles.modeTabTextActive]}>
                JOIN
              </Text>
            </TouchableOpacity>
          </View>

          <LinearGradient
            colors={['rgba(19, 17, 19, 0.98)', 'rgba(11, 11, 11, 0.98)']}
            style={styles.panel}
          >
            <Text style={styles.panelEyebrow}>
              {phase === 'create' ? 'Open The Table' : 'Enter The Code'}
            </Text>
            <Text style={styles.panelTitle}>
              {phase === 'create' ? 'Create a Black Card Match' : 'Join an Active Match'}
            </Text>
            <Text style={styles.panelCopy}>
              {phase === 'create'
                ? 'Open the room, share the code, and make the challenge official.'
                : 'Enter the room code from the card holder and step into the arena.'}
            </Text>

            {phase === 'join' ? (
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
            ) : (
              <View style={styles.createHintRow}>
                <Ionicons name="sparkles-outline" size={18} color={COLORS.goldLight} />
                <Text style={styles.createHintText}>First to 50 claims the card.</Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.goldButton}
              onPress={phase === 'create' ? handleCreateMatch : handleJoinMatch}
              disabled={actionLoading}
              activeOpacity={0.88}
            >
              {actionLoading ? (
                <ActivityIndicator color={COLORS.black} />
              ) : (
                <Text style={styles.goldButtonText}>
                  {phase === 'create' ? 'CREATE MATCH' : 'JOIN MATCH'}
                </Text>
              )}
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </View>
    );
  }

  if (phase === 'loading' || loading) {
    return (
      <View style={styles.loadingScreen}>
        <LinearGradient colors={['#050505', '#110c0f', '#060606']} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color={COLORS.goldLight} />
        <Text style={styles.loadingText}>Loading match...</Text>
      </View>
    );
  }

  if (phase === 'waiting' && match) {
    return (
      <View style={styles.screen}>
        <LinearGradient colors={['#050505', '#110c0f', '#060606']} style={StyleSheet.absoluteFill} />
        <Animated.View
          pointerEvents="none"
          style={[styles.joinFlash, { opacity: joinFlashAnim }]}
        />

        <View style={styles.shell}>
          <View style={styles.navBar}>
            <TouchableOpacity onPress={handleLeave}>
              <Ionicons name="arrow-back" size={26} color={COLORS.offWhite} />
            </TouchableOpacity>
            <Text style={styles.navTitle}>WAITING</Text>
            <View style={{ width: 26 }} />
          </View>

          <LinearGradient
            colors={['rgba(19, 17, 19, 0.98)', 'rgba(8, 8, 8, 0.98)']}
            style={styles.panel}
          >
            <Text style={styles.panelEyebrow}>Invite Code</Text>
            <Text style={styles.codeHero}>{match.invite_code || '------'}</Text>
            <Text style={styles.panelCopy}>
              Share the code with your opponent. The room will light up the second they arrive.
            </Text>

            <View style={styles.waitingButtonRow}>
              <TouchableOpacity style={styles.secondaryButton} onPress={handleCopyCode}>
                <Ionicons name="copy-outline" size={16} color={COLORS.offWhite} />
                <Text style={styles.secondaryButtonText}>Copy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={handleShareCode}>
                <Ionicons name="share-social-outline" size={16} color={COLORS.offWhite} />
                <Text style={styles.secondaryButtonText}>Share</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.textButton} onPress={handleCancelMatch}>
              <Text style={styles.textButtonText}>Cancel Match</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </View>
    );
  }

  if (phase === 'completed' && match) {
    const isWinner = currentUserMatchId && match.winner?.id === currentUserMatchId;
    const winnerName = match.winner?.username || 'Winner';
    const loserName = match.loser?.username || 'Loser';

    return (
      <View style={styles.screen}>
        <LinearGradient colors={['#040404', '#120d10', '#050505']} style={StyleSheet.absoluteFill} />
        <View style={styles.shell}>
          <View style={styles.navBar}>
            <View style={{ width: 26 }} />
            <Text style={styles.navTitle}>MATCH OVER</Text>
            <View style={{ width: 26 }} />
          </View>

          <ScrollView contentContainerStyle={styles.resultScroll}>
            <Text style={[styles.resultTag, { color: isWinner ? COLORS.goldLight : '#D77A73' }]}>
              {isWinner ? 'VICTORY' : 'DEFEAT'}
            </Text>
            <Text style={styles.resultHeadline}>
              {isWinner
                ? `You claimed ${loserName}'s Black Card.`
                : `${winnerName} claimed the Black Card.`}
            </Text>
            <Text style={styles.resultCopy}>
              {isWinner
                ? 'The room is closed. The card is yours until somebody takes it back.'
                : 'The challenge is over. Reset at the start screen when you want another shot.'}
            </Text>

            <LinearGradient
              colors={['rgba(17, 17, 17, 0.96)', 'rgba(8, 8, 8, 0.98)']}
              style={styles.resultCard}
            >
              <Image source={CARD_ART} style={styles.resultCardImage} resizeMode="contain" />
              <View style={styles.resultNameplate}>
                <Text style={styles.resultWinnerName}>{winnerName.toUpperCase()}</Text>
              </View>
            </LinearGradient>

            <View style={styles.resultScoreRow}>
              <ScoreMeter
                name={match.player1?.username}
                score={match.player1_score}
                target={targetScore}
              />
              <ScoreMeter
                name={match.player2?.username}
                score={match.player2_score}
                target={targetScore}
                align="right"
              />
            </View>

            <TouchableOpacity
              style={styles.goldButton}
              onPress={handleRematch}
              disabled={actionLoading}
              activeOpacity={0.88}
            >
              {actionLoading ? (
                <ActivityIndicator color={COLORS.black} />
              ) : (
                <Text style={styles.goldButtonText}>REMATCH</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.textButton} onPress={leaveAndReturn}>
              <Text style={styles.textButtonText}>Return to Start</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    );
  }

  if (!match || !question) {
    return (
      <View style={styles.loadingScreen}>
        <LinearGradient colors={['#050505', '#110c0f', '#060606']} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color={COLORS.goldLight} />
        <Text style={styles.loadingText}>Loading question...</Text>
      </View>
    );
  }

  const player1Leading = match.player1_score >= match.player2_score;
  const player2Leading = match.player2_score >= match.player1_score;
  const canSteal = Boolean(
    match.locked_out_player &&
      !match.current_buzzer &&
      currentUserMatchId &&
      match.locked_out_player.id !== currentUserMatchId
  );

  return (
    <View style={styles.screen}>
      <LinearGradient colors={['#040404', '#130d10', '#050505']} style={StyleSheet.absoluteFill} />
      <Animated.View pointerEvents="none" style={[styles.joinFlash, { opacity: joinFlashAnim }]} />

      <View style={styles.shell}>
        <View style={styles.liveHeader}>
          <TouchableOpacity onPress={handleLeave}>
            <Ionicons name="arrow-back" size={26} color={COLORS.offWhite} />
          </TouchableOpacity>
          <View style={styles.liveHeaderCenter}>
            <Text style={styles.roundEyebrow}>{roundName}</Text>
            <Text style={styles.navTitle}>LIVE MATCH</Text>
          </View>
          <Animated.View style={{ transform: [{ scale: timerScale }] }}>
            <LinearGradient
              colors={['rgba(17, 17, 17, 0.95)', 'rgba(32, 18, 18, 0.95)']}
              style={[styles.timerOrb, { borderColor: `${timerColor}66` }]}
            >
              <Text style={[styles.timerOrbText, { color: timerColor }]}>{timeLeft}s</Text>
            </LinearGradient>
          </Animated.View>
        </View>

        <LinearGradient
          colors={['rgba(17, 17, 17, 0.94)', 'rgba(10, 10, 10, 0.98)']}
          style={styles.arena}
        >
          <View style={styles.arenaTopline}>
            <Text style={styles.targetText}>Race to {targetScore}</Text>
            <Text style={styles.turnText} numberOfLines={1}>
              {turnMessage}
            </Text>
          </View>

          <View style={styles.progressArena}>
            <View style={[styles.progressSide, player1Leading && styles.progressSideLeading]}>
              <ScoreMeter name={match.player1?.username} score={match.player1_score} target={targetScore} />
            </View>
            <View style={[styles.progressSide, player2Leading && styles.progressSideLeading]}>
              <ScoreMeter
                name={match.player2?.username}
                score={match.player2_score}
                target={targetScore}
                align="right"
              />
            </View>
          </View>

          <View style={styles.categoryRow}>
            <View style={styles.categoryChip}>
              <Text style={styles.categoryChipText}>
                {question.category.replace('_', ' ').toUpperCase()}
              </Text>
            </View>
          </View>

          <Animated.View
            style={[
              styles.questionPanel,
              {
                opacity: questionAnim,
                transform: [
                  {
                    translateY: questionAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [18, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.questionText}>{question.text}</Text>
          </Animated.View>

          {feedback ? (
            <Animated.View
              style={[
                styles.feedbackBanner,
                feedback.type === 'wrong' ? styles.feedbackBannerWrong : styles.feedbackBannerCorrect,
                {
                  opacity: feedbackAnim,
                  transform: [
                    {
                      translateY: feedbackAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [12, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Text style={styles.feedbackBannerText}>{feedback.text}</Text>
            </Animated.View>
          ) : null}

          {!match.current_buzzer && !match.locked_out_player ? (
            <TouchableOpacity
              style={[styles.buzzButton, !canBuzz && styles.buzzButtonDisabled]}
              onPress={handleBuzz}
              disabled={!canBuzz || actionLoading}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={canBuzz ? ['#6A1420', '#2B090E'] : ['#272224', '#151314']}
                style={styles.buzzButtonSurface}
              >
                <Text style={styles.buzzButtonLabel}>{actionLoading ? 'Claiming...' : 'Buzz In'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : null}

          {canSteal ? (
            <TouchableOpacity
              style={styles.buzzButton}
              onPress={handleBuzz}
              disabled={actionLoading}
              activeOpacity={0.88}
            >
              <LinearGradient colors={['#7A1526', '#2B090E']} style={styles.buzzButtonSurface}>
                <Text style={styles.buzzButtonLabel}>{actionLoading ? 'Claiming...' : 'Steal The Round'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : null}

          <Animated.View
            style={[
              styles.answersWrap,
              {
                opacity: answersAnim,
                transform: [
                  {
                    translateY: answersAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [24, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            {question.choices?.map((choice, index) => (
              <TouchableOpacity
                key={`${question.id}-${choice}`}
                style={[styles.answerCard, canAnswer && styles.answerCardActive]}
                onPress={() => handleAnswer(choice)}
                disabled={!canAnswer || actionLoading}
                activeOpacity={0.88}
              >
                <Text style={styles.answerIndex}>{String.fromCharCode(65 + index)}</Text>
                <Text style={[styles.answerText, canAnswer && styles.answerTextActive]}>{choice}</Text>
              </TouchableOpacity>
            ))}
          </Animated.View>
        </LinearGradient>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.obsidian,
  },
  shell: {
    flex: 1,
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  navTitle: {
    color: COLORS.offWhite,
    fontSize: SIZES.lg,
    letterSpacing: 3,
    ...FONTS.bold,
  },
  modeTab: {
    flex: 1,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: 'rgba(17, 15, 17, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255, 200, 87, 0.08)',
  },
  modeTabActive: {
    borderColor: 'rgba(245, 166, 35, 0.28)',
    backgroundColor: 'rgba(40, 18, 20, 0.82)',
  },
  modeTabText: {
    color: COLORS.textSecondary,
    fontSize: SIZES.sm,
    letterSpacing: 2,
    ...FONTS.bold,
  },
  modeTabTextActive: {
    color: COLORS.goldLight,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  panel: {
    borderRadius: 26,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.16)',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  panelEyebrow: {
    color: COLORS.goldSoft,
    fontSize: SIZES.sm,
    letterSpacing: 2.5,
    marginBottom: 10,
    textTransform: 'uppercase',
    ...FONTS.medium,
  },
  panelTitle: {
    color: COLORS.offWhite,
    fontSize: SIZES.xxl,
    lineHeight: 34,
    marginBottom: 10,
    ...FONTS.bold,
  },
  panelCopy: {
    color: COLORS.textSecondary,
    fontSize: SIZES.base,
    lineHeight: 24,
  },
  createHintRow: {
    marginTop: 20,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  createHintText: {
    color: COLORS.goldSoft,
    fontSize: SIZES.base,
    ...FONTS.medium,
  },
  codeInput: {
    marginTop: 20,
    marginBottom: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.16)',
    backgroundColor: 'rgba(7, 7, 7, 0.94)',
    paddingVertical: 18,
    color: COLORS.offWhite,
    fontSize: 32,
    textAlign: 'center',
    letterSpacing: 10,
    ...FONTS.bold,
  },
  goldButton: {
    marginTop: 22,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: COLORS.gold,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goldButtonText: {
    color: COLORS.black,
    fontSize: SIZES.base,
    letterSpacing: 2,
    ...FONTS.bold,
  },
  textButton: {
    marginTop: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  textButtonText: {
    color: COLORS.textSecondary,
    fontSize: SIZES.base,
    letterSpacing: 1.4,
    ...FONTS.medium,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: COLORS.obsidian,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: SIZES.base,
  },
  waitingButtonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 22,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 200, 87, 0.12)',
    backgroundColor: 'rgba(16, 16, 16, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  secondaryButtonText: {
    color: COLORS.offWhite,
    fontSize: SIZES.md,
    ...FONTS.medium,
  },
  codeHero: {
    color: COLORS.goldLight,
    fontSize: 44,
    letterSpacing: 10,
    marginTop: 6,
    ...FONTS.bold,
  },
  joinFlash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 200, 87, 0.08)',
  },
  liveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  liveHeaderCenter: {
    alignItems: 'center',
    gap: 4,
  },
  roundEyebrow: {
    color: COLORS.goldSoft,
    fontSize: SIZES.xs,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    ...FONTS.medium,
  },
  timerOrb: {
    minWidth: 70,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerOrbText: {
    fontSize: SIZES.base,
    ...FONTS.bold,
  },
  arena: {
    flex: 1,
    borderRadius: 28,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.14)',
  },
  arenaTopline: {
    marginBottom: 14,
    gap: 6,
  },
  targetText: {
    color: COLORS.goldSoft,
    fontSize: SIZES.sm,
    letterSpacing: 2,
    textTransform: 'uppercase',
    ...FONTS.medium,
  },
  turnText: {
    color: COLORS.textSecondary,
    fontSize: SIZES.sm,
    ...FONTS.medium,
  },
  progressArena: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  progressSide: {
    flex: 1,
    borderRadius: 18,
    padding: 12,
    backgroundColor: 'rgba(11, 11, 11, 0.76)',
    borderWidth: 1,
    borderColor: 'rgba(255, 200, 87, 0.08)',
  },
  progressSideLeading: {
    borderColor: 'rgba(245, 166, 35, 0.2)',
    backgroundColor: 'rgba(26, 15, 15, 0.78)',
  },
  scoreMeter: {
    gap: 8,
  },
  scoreMeterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  scoreMeterHeaderRight: {
    flexDirection: 'row-reverse',
  },
  scoreMeterName: {
    flex: 1,
    color: COLORS.offWhite,
    fontSize: SIZES.md,
    ...FONTS.semiBold,
  },
  scoreMeterValue: {
    color: COLORS.goldLight,
    fontSize: SIZES.lg,
    ...FONTS.bold,
  },
  scoreMeterTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  scoreMeterFill: {
    height: '100%',
    borderRadius: 999,
  },
  categoryRow: {
    marginBottom: 12,
  },
  categoryChip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.16)',
    backgroundColor: 'rgba(15, 15, 15, 0.9)',
  },
  categoryChipText: {
    color: COLORS.goldSoft,
    fontSize: SIZES.xs,
    letterSpacing: 1.5,
    ...FONTS.medium,
  },
  questionPanel: {
    borderRadius: 24,
    padding: 22,
    marginBottom: 14,
    backgroundColor: 'rgba(10, 10, 10, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255, 200, 87, 0.12)',
  },
  questionText: {
    color: COLORS.offWhite,
    fontSize: 28,
    lineHeight: 38,
    ...FONTS.bold,
  },
  feedbackBanner: {
    marginBottom: 14,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  feedbackBannerCorrect: {
    backgroundColor: 'rgba(211, 165, 77, 0.12)',
    borderColor: 'rgba(211, 165, 77, 0.28)',
  },
  feedbackBannerWrong: {
    backgroundColor: 'rgba(122, 21, 38, 0.18)',
    borderColor: 'rgba(122, 21, 38, 0.34)',
  },
  feedbackBannerText: {
    color: COLORS.offWhite,
    fontSize: SIZES.sm,
    letterSpacing: 1.2,
    ...FONTS.medium,
  },
  buzzButton: {
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.18)',
  },
  buzzButtonDisabled: {
    opacity: 0.5,
  },
  buzzButtonSurface: {
    minHeight: 70,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  buzzButtonLabel: {
    color: COLORS.offWhite,
    fontSize: SIZES.xl,
    letterSpacing: 2,
    ...FONTS.bold,
  },
  answersWrap: {
    gap: 10,
  },
  answerCard: {
    minHeight: 64,
    borderRadius: 18,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(10, 10, 10, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255, 200, 87, 0.08)',
  },
  answerCardActive: {
    borderColor: 'rgba(245, 166, 35, 0.2)',
    backgroundColor: 'rgba(34, 18, 18, 0.84)',
  },
  answerIndex: {
    color: COLORS.goldLight,
    fontSize: SIZES.md,
    width: 18,
    ...FONTS.bold,
  },
  answerText: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: SIZES.base,
    ...FONTS.medium,
  },
  answerTextActive: {
    color: COLORS.offWhite,
  },
  resultScroll: {
    paddingBottom: 24,
    alignItems: 'center',
  },
  resultTag: {
    marginTop: 8,
    marginBottom: 10,
    fontSize: SIZES.sm,
    letterSpacing: 3,
    textTransform: 'uppercase',
    ...FONTS.bold,
  },
  resultHeadline: {
    color: COLORS.offWhite,
    fontSize: 30,
    lineHeight: 38,
    textAlign: 'center',
    marginBottom: 10,
    ...FONTS.bold,
  },
  resultCopy: {
    color: COLORS.textSecondary,
    fontSize: SIZES.base,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 24,
    maxWidth: 320,
  },
  resultCard: {
    width: '100%',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.16)',
    padding: 16,
    alignItems: 'center',
    marginBottom: 22,
  },
  resultCardImage: {
    width: '100%',
    height: 220,
  },
  resultNameplate: {
    marginTop: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.2)',
    backgroundColor: 'rgba(14, 14, 14, 0.88)',
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  resultWinnerName: {
    color: COLORS.goldLight,
    fontSize: SIZES.base,
    letterSpacing: 2.2,
    ...FONTS.bold,
  },
  resultScoreRow: {
    width: '100%',
    gap: 12,
    marginBottom: 16,
  },
});

export default MatchScreen;
