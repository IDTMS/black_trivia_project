import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SIZES } from '../constants/theme';
import { getRandomQuestion } from '../services/api';

const TOTAL_QUESTIONS = 10;
const QUESTION_TIME = 15; // seconds per question

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

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const timerRef = useRef(null);

  useEffect(() => {
    fetchQuestion();
    return () => clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    if (question && selectedAnswer === null) {
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
    }
    return () => clearInterval(timerRef.current);
  }, [question]);

  const handleTimeout = () => {
    setSelectedAnswer('__timeout__');
    setIsCorrect(false);
    setStreak(0);
    setTimeout(() => advanceOrEnd(), 1500);
  };

  const fetchQuestion = async () => {
    setLoading(true);
    setSelectedAnswer(null);
    setIsCorrect(null);
    try {
      const res = await getRandomQuestion();
      setQuestion(res.data);
      animateIn();
    } catch (error) {
      Alert.alert('Error', 'Could not load question. Check your connection.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const animateIn = () => {
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.95);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  };

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
      setScore((prev) => prev + points);
      setStreak((prev) => {
        const newStreak = prev + 1;
        if (newStreak > bestStreak) setBestStreak(newStreak);
        return newStreak;
      });
    } else {
      setStreak(0);
    }

    setTimeout(() => advanceOrEnd(), 1500);
  };

  const advanceOrEnd = () => {
    if (questionNum + 1 >= TOTAL_QUESTIONS) {
      setGameOver(true);
    } else {
      setQuestionNum((prev) => prev + 1);
      fetchQuestion();
    }
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

  const getTimerColor = () => {
    if (timeLeft > 10) return COLORS.green;
    if (timeLeft > 5) return COLORS.gold;
    return COLORS.red;
  };

  // Game Over screen
  if (gameOver) {
    const grade =
      score >= 120 ? 'LEGENDARY' :
      score >= 90 ? 'ELITE' :
      score >= 60 ? 'SOLID' :
      score >= 30 ? 'ROOKIE' : 'TRY AGAIN';

    const gradeColor =
      score >= 120 ? COLORS.gold :
      score >= 90 ? COLORS.green :
      score >= 60 ? COLORS.white :
      COLORS.red;

    return (
      <View style={styles.gameOverContainer}>
        <Text style={styles.gameOverLabel}>GAME OVER</Text>
        <Text style={[styles.grade, { color: gradeColor }]}>{grade}</Text>

        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{score}</Text>
            <Text style={styles.statLabel}>POINTS</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{bestStreak}</Text>
            <Text style={styles.statLabel}>BEST STREAK</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.playAgainButton}
          onPress={() => {
            setScore(0);
            setQuestionNum(0);
            setStreak(0);
            setBestStreak(0);
            setGameOver(false);
            fetchQuestion();
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.playAgainText}>PLAY AGAIN</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.homeButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.homeButtonText}>BACK TO HOME</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading && !question) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.gold} />
        <Text style={styles.loadingText}>Loading question...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={28} color={COLORS.white} />
        </TouchableOpacity>

        {/* Progress bar */}
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${((questionNum + 1) / TOTAL_QUESTIONS) * 100}%` },
            ]}
          />
        </View>

        <Text style={styles.scoreText}>{score}</Text>
      </View>

      {/* Timer */}
      <View style={styles.timerRow}>
        <View style={[styles.timerBadge, { borderColor: getTimerColor() }]}>
          <Text style={[styles.timerText, { color: getTimerColor() }]}>{timeLeft}s</Text>
        </View>
        <Text style={styles.questionCount}>
          {questionNum + 1} / {TOTAL_QUESTIONS}
        </Text>
        {streak >= 2 && (
          <View style={styles.streakBadge}>
            <Text style={styles.streakText}>🔥 {streak}</Text>
          </View>
        )}
      </View>

      {/* Category badge */}
      {question?.category && (
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>
            {question.category.replace('_', ' ').toUpperCase()}
          </Text>
        </View>
      )}

      {/* Question */}
      <Animated.View
        style={[
          styles.questionCard,
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
        ]}
      >
        <Text style={styles.questionText}>{question?.question_text}</Text>
      </Animated.View>

      {/* Answer choices */}
      <View style={styles.choicesContainer}>
        {question?.answer_choices?.map((choice, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.choiceButton, getChoiceStyle(choice)]}
            onPress={() => handleAnswer(choice)}
            disabled={selectedAnswer !== null}
            activeOpacity={0.8}
          >
            <Text style={styles.choiceLetter}>
              {String.fromCharCode(65 + index)}
            </Text>
            <Text style={[styles.choiceText, getChoiceTextStyle(choice)]}>
              {choice}
            </Text>
            {selectedAnswer !== null && choice === question.correct_answer && (
              <Ionicons name="checkmark-circle" size={24} color={COLORS.green} />
            )}
            {selectedAnswer === choice && !isCorrect && (
              <Ionicons name="close-circle" size={24} color={COLORS.red} />
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Feedback */}
      {selectedAnswer !== null && selectedAnswer !== '__timeout__' && (
        <View style={styles.feedbackContainer}>
          <Text style={[styles.feedbackText, { color: isCorrect ? COLORS.green : COLORS.red }]}>
            {isCorrect ? '🎯 Correct!' : '❌ Wrong!'}
          </Text>
        </View>
      )}
      {selectedAnswer === '__timeout__' && (
        <View style={styles.feedbackContainer}>
          <Text style={[styles.feedbackText, { color: COLORS.red }]}>
            ⏰ Time's up!
          </Text>
        </View>
      )}
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
    gap: 12,
    marginBottom: 16,
  },
  progressBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: COLORS.card,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.gold,
    borderRadius: 3,
  },
  scoreText: {
    fontSize: SIZES.lg,
    color: COLORS.gold,
    ...FONTS.bold,
    minWidth: 40,
    textAlign: 'right',
  },

  // Timer
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  timerBadge: {
    borderWidth: 2,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  timerText: {
    fontSize: SIZES.base,
    ...FONTS.bold,
  },
  questionCount: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
    ...FONTS.medium,
  },
  streakBadge: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  streakText: {
    fontSize: SIZES.sm,
    color: COLORS.gold,
    ...FONTS.bold,
  },

  // Category
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.card,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 12,
  },
  categoryText: {
    fontSize: SIZES.xs,
    color: COLORS.gold,
    ...FONTS.bold,
    letterSpacing: 1,
  },

  // Question
  questionCard: {
    backgroundColor: COLORS.card,
    borderRadius: SIZES.radiusLg,
    padding: 24,
    marginBottom: 24,
    minHeight: 120,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  questionText: {
    fontSize: SIZES.xl,
    color: COLORS.white,
    ...FONTS.semiBold,
    lineHeight: 30,
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
  },
  choiceDefault: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  choiceCorrect: {
    backgroundColor: COLORS.green + '20',
    borderWidth: 1,
    borderColor: COLORS.green,
  },
  choiceWrong: {
    backgroundColor: COLORS.red + '20',
    borderWidth: 1,
    borderColor: COLORS.red,
  },
  choiceDisabled: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    opacity: 0.4,
  },
  choiceTextDefault: { color: COLORS.white },
  choiceTextCorrect: { color: COLORS.green, ...FONTS.semiBold },
  choiceTextWrong: { color: COLORS.red, ...FONTS.semiBold },
  choiceTextDisabled: { color: COLORS.textSecondary },

  // Feedback
  feedbackContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  feedbackText: {
    fontSize: SIZES.xl,
    ...FONTS.bold,
  },

  // Game Over
  gameOverContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  gameOverLabel: {
    fontSize: SIZES.lg,
    color: COLORS.textSecondary,
    ...FONTS.bold,
    letterSpacing: 4,
    marginBottom: 8,
  },
  grade: {
    fontSize: 48,
    ...FONTS.bold,
    letterSpacing: 4,
    marginBottom: 40,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 48,
  },
  statBox: {
    backgroundColor: COLORS.card,
    borderRadius: SIZES.radiusLg,
    paddingVertical: 24,
    paddingHorizontal: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statValue: {
    fontSize: SIZES.xxxl,
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
  playAgainButton: {
    backgroundColor: COLORS.gold,
    borderRadius: SIZES.radius,
    paddingVertical: 18,
    paddingHorizontal: 48,
    marginBottom: 16,
  },
  playAgainText: {
    color: COLORS.black,
    fontSize: SIZES.lg,
    ...FONTS.bold,
    letterSpacing: 2,
  },
  homeButton: {
    paddingVertical: 12,
  },
  homeButtonText: {
    color: COLORS.textSecondary,
    fontSize: SIZES.md,
    ...FONTS.medium,
    letterSpacing: 1,
  },
});

export default GameScreen;
