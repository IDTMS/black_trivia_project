// Game.js
import React, { useState, useEffect } from 'react';

const Game = () => {
  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [score, setScore] = useState(0);
  const [questionNumber, setQuestionNumber] = useState(0);

  useEffect(() => {
    const loadQuestions = async () => {
      try {
        const response = await fetch('questions.json');
        const data = await response.json();
        setQuestions(data);
        setCurrentQuestion(data[0]);
      } catch (error) {
        console.error('Error loading questions:', error);
      }
    };
    loadQuestions();
  }, []);

  const checkAnswer = (answer) => {
    if (currentQuestion && currentQuestion.answers) {
      const correctAnswer = currentQuestion.answers.find((answerObject) => answerObject.correct);
      if (answer === correctAnswer.answer) {
        setScore((prevScore) => prevScore + 1);
        console.log('Correct answer!');
      } else {
        console.log('Incorrect answer.');
      }
      nextQuestion();
    } else {
      console.error('No current question or answers.');
    }
  };

  const nextQuestion = () => {
    if (questions.length > questionNumber + 1) {
      setCurrentQuestion(questions[questionNumber + 1]);
      setQuestionNumber((prevQuestionNumber) => prevQuestionNumber + 1);
    } else {
      console.log('No more questions.');
    }
  };

  return (
    <div>
      <h1>Black Trivia Game</h1>
      {currentQuestion && (
        <div>
          <h2>{currentQuestion.question}</h2>
          <ul>
            {currentQuestion.answers.map((answer, index) => (
              <li key={index}>
                <button onClick={() => checkAnswer(answer.answer)}>{answer.answer}</button>
              </li>
            ))}
          </ul>
          <p>Score: {score}</p>
          <p>Question {questionNumber + 1} of {questions.length}</p>
        </div>
      )}
    </div>
  );
};

export default Game;