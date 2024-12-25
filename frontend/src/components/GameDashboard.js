import React, { useState, useEffect } from 'react';
import axios from 'axios';

const GameDashboard = () => {
  const [question, setQuestion] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);

  const accessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzM1MDgyOTc4LCJpYXQiOjE3MzUwNzkzNzgsImp0aSI6ImVhZDdjMDljYmM0ZTRiM2E5NmQ3YzIzOGEzNWU5ZmYxIiwidXNlcl9pZCI6M30.lb6DgULmp8jziQmRNlEBe6XB7wC8UJ_TNjqkdqcC6CE'; // Replace with your actual token

  // Fetch a random question from the backend
  const fetchQuestion = async () => {
    try {
      const response = await axios.get('http://127.0.0.1:8000/api/questions/random/', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      setQuestion(response.data);
    } catch (error) {
      console.error('Error fetching question:', error);
    }
  };

  // Fetch leaderboard data
  const fetchLeaderboard = async () => {
    try {
      const response = await axios.get('http://127.0.0.1:8000/api/leaderboard/', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      setLeaderboard(response.data);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  return (
    <div>
      <h1>Game Dashboard</h1>
      <button onClick={fetchQuestion}>Get Question</button>

      {/* Display the fetched question */}
      {question && (
        <div>
          <h3>Question</h3>
          <p>{question.question_text}</p>
          <ul>
            {question.answer_choices.map((choice, index) => (
              <li key={index}>{choice}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Leaderboard Section */}
      <h2>Leaderboard</h2>
      {leaderboard.length > 0 ? (
        <ul>
          {leaderboard.map((player, index) => (
            <li key={index}>
              {index + 1}. {player.user.username} - {player.points} points
            </li>
          ))}
        </ul>
      ) : (
        <p>No leaderboard data available.</p>
      )}
    </div>
  );
};

export default GameDashboard;
