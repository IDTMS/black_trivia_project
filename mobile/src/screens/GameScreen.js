import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, FONTS, SIZES } from '../constants/theme';
import { getRandomQuestion } from '../services/api';
import {
  fadeOutAmbient,
  playCorrect,
  playDefeat,
  playVictory,
  playWrong,
} from '../utils/soundEngine';

const TOTAL_QUESTIONS = 10;
const QUESTION_TIME = 15;

const getTimerColor = (timeLeft) => {
  if (timeLeft > 10) return COLORS.green;
  if (timeLeft > 5) return COLORS.goldLight;
  return COLORS.red;
};

const GameScreen = ({ navigation, route }) => {
  const mode = route?.params?.mode || 'solo';

  const [question, setQuestion] = useState(null);
  const [score, setScore] = useState(0);
  const [questionNum, setQuestionNum] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isCorrect, setIsCorrect] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gameOver, setGameOver] = useState(false);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME);

  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardShift = useRef(new Animated.Value(18)).current;
  const answersOpacity = useRef(new Animated.Value(0)).current;
  const answersShift = useRef(new Animated.Value(18)).current;
  const timerScale = useRef(new Animated.Value(1)).current;
  const feedbackOpacity = useRef(new Animated.Value(0)).current;
  const pulseLoopRef = useRef(null);
  const timerRef = useRef(null);
  const scoreRef = useRef(0);

  useFocusEffect(
    useCallback(() => {
      fadeOutAmbient(450, true).catch(() => {});
      return undefined;
    }, [])
  );

  const animateQuestionIn = useCallback(() => {
    cardOpacity.setValue(0);
    cardShift.setValue(18);
    answersOpacity.setValue(0);
    answersShift.setValue(18);

    Animated.parallel([
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(cardShift, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(answersOpacity, {
        toValue: 1,
        duration: 340,
        delay: 80,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(answersShift, {
        toValue: 0,
        duration: 340,
        delay: 80,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [answersOpacity, answersShift, cardOpacity, cardShift]);

  const fetchQuestion = useCallback(async () => {
    setLoading(true);
    setSelectedAnswer(null);
    setIsCorrect(null);
    feedbackOpacity.setValue(0);

    try {
      const res = await getRandomQuestion();
      setQuestion(res.data);
      animateQuestionIn();
    } catch {
      Alert.alert('Error', 'Could not load question. Check your connection.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [animateQuestionIn, feedbackOpacity, navigation]);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    fetchQuestion();
    return () => {
      clearInterval(timerRef.current);
      if (pulseLoopRef.current) {
        pulseLoopRef.current.stop();
      }
    };
  }, [fetchQuestion]);

  useEffect(() => {
    if (!question || selectedAnswer !== null) {
      clearInterval(timerRef.current);
      return undefined;
    }

    setTimeLeft(QUESTION_TIME);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [question, selectedAnswer]);

  useEffect(() => {
    if (pulseLoopRef.current) {
      pulseLoopRef.current.stop();
      pulseLoopRef.current = null;
    }

    if (!gameOver && timeLeft <= 5 && selectedAnswer === null) {
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
  }, [gameOver, selectedAnswer, timeLeft, timerScale]);

  const revealFeedback = () => {
    feedbackOpacity.setValue(0);
    Animated.timing(feedbackOpacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  };

  const advanceOrEnd = useCallback((finalScore = scoreRef.current) => {
    if (questionNum + 1 >= TOTAL_QUESTIONS) {
      setGameOver(true);
      if (finalScore >= 60) {
        playVictory().catch(() => {});
      } else {
        playDefeat().catch(() => {});
      }
    } else {
      setQuestionNum((prev) => prev + 1);
      fetchQuestion();
    }
  }, [fetchQuestion, questionNum]);

  const handleTimeout = useCallback(() => {
    setSelectedAnswer('__timeout__');
    setIsCorrect(false);
    setStreak(0);
    playWrong().catch(() => {});
    revealFeedback();
    setTimeout(() => advanceOrEnd(scoreRef.current), 1400);
  }, [advanceOrEnd]);

  const handleAnswer = (choice) => {
    if (selectedAnswer !== null) return;
    clearInterval(timerRef.current);

    setSelectedAnswer(choice);
    const correct = choice === question.correct_answer;
    setIsCorrect(correct);

    if (correct) {
      const timeBonus = Math.max(0, timeLeft);
      const streakBonus = streak >= 3 ? 5 : 0;
      const points = 10 + timeBonus + streakBonus;
      const nextScore = scoreRef.current + points;
      scoreRef.current = nextScore;
      setScore(nextScore);
      setStreak((prev) => {
        const nextStreak = prev + 1;
        setBestStreak((current) => Math.max(current, nextStreak));
        return nextStreak;
      });
      playCorrect().catch(() => {});
    } else {
      setStreak(0);
      playWrong().catch(() => {});
    }

    revealFeedback();
    setTimeout(() => advanceOrEnd(scoreRef.current), 1400);
  };

  const getChoiceStyle = (choice) => {
    if (selectedAnswer === null) return styles.choiceDefault;
    if (choice === question.correct_answer) return styles.choiceCorrect;
    if (choice === selectedAnswer && !isCorrect) return styles.choiceWrong;
    return styles.choiceDisabled;
  };

  const getChoiceTextStyle = (choice) => {
    if (selectedAnswer === null) return styles.choiceTextDefault;
    if (choice === question.correct_answer) return styles.choiceTextCorrect;
    if (choice === selectedAnswer && !isCorrect) return styles.choiceTextWrong;
    return styles.choiceTextDisabled;
  };

  if (gameOver) {
    const grade =
      score >= 120 ? 'Legendary' :
      score >= 90 ? 'Elite' :
      score >= 60 ? 'Solid' :
      score >= 30 ? 'Rookie' : 'Try Again';

    const gradeColor =
      score >= 120 ? COLORS.goldLight :
      score >= 90 ? COLORS.green :
      score >= 60 ? COLORS.offWhite :
      '#D77A73';

    return (
      <View style={styles.screen}>
        <LinearGradient colors={['#050505', '#110c0f', '#060606']} style={StyleSheet.absoluteFill} />
        <View style={styles.resultShell}>
          <Text style={styles.resultEyebrow}>Quick Play Complete</Text>
          <Text style={[styles.resultGrade, { color: gradeColor }]}>{grade}</Text>
          <Text style={styles.resultSubtitle}>
            {mode === 'solo' ? 'Solo table closed.' : 'Round complete.'}
          </Text>

          <View style={styles.resultStatsRow}>
            <View style={styles.resultStatCard}>
              <Text style={styles.resultStatValue}>{score}</Text>
              <Text style={styles.resultStatLabel}>Points</Text>
            </View>
            <View style={styles.resultStatCard}>
              <Text style={styles.resultStatValue}>{bestStreak}</Text>
              <Text style={styles.resultStatLabel}>Best Streak</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.goldButton}
            onPress={() => {
              setScore(0);
              scoreRef.current = 0;
              setQuestionNum(0);
              setStreak(0);
              setBestStreak(0);
              setGameOver(false);
              fetchQuestion();
            }}
            activeOpacity={0.88}
          >
            <Text style={styles.goldButtonText}>PLAY AGAIN</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.textButton} onPress={() => navigation.popToTop()}>
            <Text style={styles.textButtonText}>Return to Start</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading && !question) {
    return (
      <View style={styles.loadingScreen}>
        <LinearGradient colors={['#050505', '#110c0f', '#060606']} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color={COLORS.goldLight} />
        <Text style={styles.loadingText}>Loading question...</Text>
      </View>
    );
  }

  const timerColor = getTimerColor(timeLeft);

  return (
    <View style={styles.screen}>
      <LinearGradient colors={['#040404', '#130d10', '#050505']} style={StyleSheet.absoluteFill} />

      <View style={styles.shell}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={28} color={COLORS.offWhite} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerEyebrow}>Quick Play</Text>
            <Text style={styles.headerScore}>{score} pts</Text>
          </View>

          <Animated.View style={{ transform: [{ scale: timerScale }] }}>
            <LinearGradient
              colors={['rgba(17,17,17,0.95)', 'rgba(32,18,18,0.95)']}
              style={[styles.timerOrb, { borderColor: `${timerColor}66` }]}
            >
              <Text style={[styles.timerOrbText, { color: timerColor }]}>{timeLeft}s</Text>
            </LinearGradient>
          </Animated.View>
        </View>

        <View style={styles.progressBarBg}>
          <LinearGradient
            colors={['#7A1526', '#D3A54D', '#F5A623']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[
              styles.progressBarFill,
              { width: `${((questionNum + 1) / TOTAL_QUESTIONS) * 100}%` },
            ]}
          />
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.questionCount}>
            Question {questionNum + 1} / {TOTAL_QUESTIONS}
          </Text>
          {streak >= 2 ? (
            <View style={styles.streakPill}>
              <Text style={styles.streakText}>Streak {streak}</Text>
            </View>
          ) : null}
        </View>

        {question?.category ? (
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>
              {question.category.replace('_', ' ').toUpperCase()}
            </Text>
          </View>
        ) : null}

        <Animated.View
          style={[
            styles.questionCard,
            {
              opacity: cardOpacity,
              transform: [{ translateY: cardShift }],
            },
          ]}
        >
          <Text style={styles.questionText}>{question?.question_text}</Text>
        </Animated.View>

        {selectedAnswer !== null ? (
          <Animated.View
            style={[
              styles.feedbackPill,
              isCorrect ? styles.feedbackPillCorrect : styles.feedbackPillWrong,
              { opacity: feedbackOpacity },
            ]}
          >
            <Text style={styles.feedbackPillText}>
              {selectedAnswer === '__timeout__'
                ? `Time's up. ${question.correct_answer}`
                : isCorrect
                  ? 'Correct'
                  : `Wrong. ${question.correct_answer}`}
            </Text>
          </Animated.View>
        ) : null}

        <Animated.View
          style={[
            styles.choicesContainer,
            {
              opacity: answersOpacity,
              transform: [{ translateY: answersShift }],
            },
          ]}
        >
          {question?.answer_choices?.map((choice, index) => (
            <TouchableOpacity
              key={`${question.id}-${choice}`}
              style={[styles.choiceButton, getChoiceStyle(choice)]}
              onPress={() => handleAnswer(choice)}
              disabled={selectedAnswer !== null}
              activeOpacity={0.88}
            >
              <Text style={styles.choiceLetter}>{String.fromCharCode(65 + index)}</Text>
              <Text style={[styles.choiceText, getChoiceTextStyle(choice)]}>{choice}</Text>
              {selectedAnswer !== null && choice === question.correct_answer ? (
                <Ionicons name="checkmark-circle" size={22} color={COLORS.goldLight} />
              ) : null}
              {selectedAnswer === choice && !isCorrect ? (
                <Ionicons name="close-circle" size={22} color="#D77A73" />
              ) : null}
            </TouchableOpacity>
          ))}
        </Animated.View>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerCenter: {
    alignItems: 'center',
    gap: 4,
  },
  headerEyebrow: {
    color: COLORS.goldSoft,
    fontSize: SIZES.xs,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    ...FONTS.medium,
  },
  headerScore: {
    color: COLORS.offWhite,
    fontSize: SIZES.lg,
    ...FONTS.bold,
  },
  progressBarBg: {
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 999,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  questionCount: {
    color: COLORS.textSecondary,
    fontSize: SIZES.sm,
    ...FONTS.medium,
  },
  streakPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.18)',
    backgroundColor: 'rgba(20, 15, 15, 0.78)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  streakText: {
    color: COLORS.goldLight,
    fontSize: SIZES.sm,
    ...FONTS.medium,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.16)',
    backgroundColor: 'rgba(12, 12, 12, 0.92)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 14,
  },
  categoryText: {
    color: COLORS.goldSoft,
    fontSize: SIZES.xs,
    letterSpacing: 1.4,
    ...FONTS.medium,
  },
  timerOrb: {
    minWidth: 72,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  timerOrbText: {
    fontSize: SIZES.base,
    ...FONTS.bold,
  },
  questionCard: {
    borderRadius: 26,
    padding: 22,
    marginBottom: 14,
    backgroundColor: 'rgba(10, 10, 10, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255, 200, 87, 0.12)',
  },
  questionText: {
    color: COLORS.offWhite,
    fontSize: 28,
    lineHeight: 38,
    ...FONTS.bold,
  },
  feedbackPill: {
    marginBottom: 14,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
  },
  feedbackPillCorrect: {
    backgroundColor: 'rgba(211, 165, 77, 0.12)',
    borderColor: 'rgba(211, 165, 77, 0.28)',
  },
  feedbackPillWrong: {
    backgroundColor: 'rgba(122, 21, 38, 0.18)',
    borderColor: 'rgba(122, 21, 38, 0.34)',
  },
  feedbackPillText: {
    color: COLORS.offWhite,
    fontSize: SIZES.sm,
    ...FONTS.medium,
  },
  choicesContainer: {
    gap: 10,
  },
  choiceButton: {
    minHeight: 64,
    borderRadius: 18,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
  },
  choiceLetter: {
    width: 18,
    color: COLORS.goldLight,
    fontSize: SIZES.md,
    ...FONTS.bold,
  },
  choiceText: {
    flex: 1,
    fontSize: SIZES.base,
    ...FONTS.medium,
  },
  choiceDefault: {
    backgroundColor: 'rgba(10, 10, 10, 0.92)',
    borderColor: 'rgba(255, 200, 87, 0.08)',
  },
  choiceCorrect: {
    backgroundColor: 'rgba(211, 165, 77, 0.12)',
    borderColor: 'rgba(211, 165, 77, 0.34)',
  },
  choiceWrong: {
    backgroundColor: 'rgba(122, 21, 38, 0.18)',
    borderColor: 'rgba(122, 21, 38, 0.34)',
  },
  choiceDisabled: {
    backgroundColor: 'rgba(10, 10, 10, 0.7)',
    borderColor: 'rgba(255, 255, 255, 0.05)',
    opacity: 0.55,
  },
  choiceTextDefault: {
    color: COLORS.offWhite,
  },
  choiceTextCorrect: {
    color: COLORS.goldLight,
  },
  choiceTextWrong: {
    color: '#F3CAC6',
  },
  choiceTextDisabled: {
    color: COLORS.textSecondary,
  },
  resultShell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  resultEyebrow: {
    color: COLORS.goldSoft,
    fontSize: SIZES.sm,
    letterSpacing: 2.4,
    marginBottom: 10,
    textTransform: 'uppercase',
    ...FONTS.medium,
  },
  resultGrade: {
    fontSize: 50,
    lineHeight: 58,
    marginBottom: 8,
    textAlign: 'center',
    ...FONTS.bold,
  },
  resultSubtitle: {
    color: COLORS.textSecondary,
    fontSize: SIZES.base,
    marginBottom: 24,
  },
  resultStatsRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 22,
  },
  resultStatCard: {
    minWidth: 124,
    borderRadius: 22,
    paddingVertical: 20,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 200, 87, 0.12)',
    backgroundColor: 'rgba(10, 10, 10, 0.92)',
    alignItems: 'center',
  },
  resultStatValue: {
    color: COLORS.goldLight,
    fontSize: SIZES.xxxl,
    ...FONTS.bold,
  },
  resultStatLabel: {
    color: COLORS.textSecondary,
    fontSize: SIZES.xs,
    letterSpacing: 1.6,
    marginTop: 6,
    textTransform: 'uppercase',
    ...FONTS.medium,
  },
  goldButton: {
    minWidth: 220,
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: COLORS.gold,
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
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textButtonText: {
    color: COLORS.textSecondary,
    fontSize: SIZES.base,
    ...FONTS.medium,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: COLORS.obsidian,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: SIZES.base,
  },
});

export default GameScreen;
