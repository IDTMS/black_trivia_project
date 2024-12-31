import React, { useState, useEffect } from 'react';

const Game = () => {
  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [score, setScore] = useState(0);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [playerNames, setPlayerNames] = useState(['']);
  const [numPlayers, setNumPlayers] = useState(1);
  const [playerScores, setPlayerScores] = useState([0]);
  const [questionId, setQuestionId] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [buzzerLocked, setBuzzerLocked] = useState(false);
  const [winningPlayer, setWinningPlayer] = useState(null);

  // Fetch questions from the JSON file
  useEffect(() => {
    const loadQuestions = async () => {
      try {
        const response = await fetch('questions.json');
        if (!response.ok) {
          throw new Error('Failed to load questions');
        }
        const data = await response.json();
        setQuestions(data);
        setCurrentQuestion(data[0]);
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading questions:', error);
        setError(error.message);
        setIsLoading(false);
      }
    };
    loadQuestions();
  }, []);

  // Handle player name input
  const handlePlayerName = (index, event) => {
    const updatedNames = [...playerNames];
    updatedNames[index] = event.target.value;
    setPlayerNames(updatedNames);
  };

  // Handle number of players input
  const handleNumPlayers = (event) => {
    const num = parseInt(event.target.value);
    setNumPlayers(num);
    setPlayerScores(new Array(num).fill(0));
    setPlayerNames(new Array(num).fill('')); // Reset player names
  };

  // Check if the selected answer is correct
  const checkAnswer = (answer) => {
    if (!currentQuestion || !currentQuestion.answers) {
      console.error('No current question or answers.');
      return;
    }

    const correctAnswer = currentQuestion.answers.find((answerObject) => answerObject.correct);
    if (answer === correctAnswer.answer) {
      console.log('Correct answer!');
      const updatedScores = [...playerScores];
      updatedScores[0] += 1; // Update the first player's score
      setPlayerScores(updatedScores);
    } else {
      console.log('Incorrect answer.');
    }
    nextQuestion();
  };

  // Move to the next question
  const nextQuestion = () => {
    if (questions.length > questionNumber + 1) {
      setCurrentQuestion(questions[questionNumber + 1]);
      setQuestionNumber((prev) => prev + 1);
      setBuzzerLocked(false); // Unlock the buzzer for the next question
      setWinningPlayer(null); // Reset the winning player
    } else {
      console.log('No more questions.');
    }
  };

  // Handle question ID input
  const handleQuestionId = (event) => {
    const id = parseInt(event.target.value);
    if (id >= 0 && id < questions.length) {
      setQuestionId(id);
      setCurrentQuestion(questions[id]);
    } else {
      console.error('Invalid question ID.');
    }
  };

  // Handle buzzer press
  const handleBuzzer = (playerIndex) => {
    if (!buzzerLocked) {
      setBuzzerLocked(true); // Lock the buzzer
      setWinningPlayer(playerNames[playerIndex]); // Set the winning player
    }
  };

  // Render loading or error state
  if (isLoading) {
    return <div>Loading questions...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Black Trivia Game</h1>
      <div className="mb-4">
        <input
          type="number"
          value={numPlayers}
          onChange={handleNumPlayers}
          placeholder="Enter number of players"
          className="p-2 border rounded"
        />
      </div>
      {Array.from({ length: numPlayers }).map((_, index) => (
        <div key={index} className="mb-4">
          <input
            type="text"
            value={playerNames[index]}
            onChange={(e) => handlePlayerName(index, e)}
            placeholder={`Enter player ${index + 1} name`}
            className="p-2 border rounded"
          />
        </div>
      ))}
      <div className="mb-4">
        <input
          type="number"
          value={questionId}
          onChange={handleQuestionId}
          placeholder="Enter question ID"
          className="p-2 border rounded"
        />
      </div>
      {currentQuestion && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">{currentQuestion.question}</h2>
          <ul className="space-y-2">
            {currentQuestion.answers.map((answer, index) => (
              <li key={index}>
                <button
                  onClick={() => checkAnswer(answer.answer)}
                  className="w-full p-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  {answer.answer}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <p>Score: {playerScores[0]}</p>
            <p>Question {questionNumber + 1} of {questions.length}</p>
          </div>
          <div className="mt-4">
            <h3 className="text-lg font-semibold">Buzzer</h3>
            {Array.from({ length: numPlayers }).map((_, index) => (
              <button
                key={index}
                onClick={() => handleBuzzer(index)}
                disabled={buzzerLocked}
                className="p-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {playerNames[index] || `Player ${index + 1}`}
              </button>
            ))}
            {winningPlayer && (
              <p className="mt-2 text-green-600">{winningPlayer} pressed the buzzer first!</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Game;