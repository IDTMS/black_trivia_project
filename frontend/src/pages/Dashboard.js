import React, { useEffect, useState } from 'react';
import axios from 'axios';

const Dashboard = () => {
    const [question, setQuestion] = useState(null);
    const [leaderboard, setLeaderboard] = useState([]);
    const token = localStorage.getItem('accessToken');

    useEffect(() => {
        fetchLeaderboard();
    }, []);

    const fetchLeaderboard = async () => {
        try {
            const res = await axios.get('http://127.0.0.1:8000/api/leaderboard/', {
                headers: { Authorization: `Bearer ${token}` },
            });
            setLeaderboard(res.data);
        } catch (error) {
            console.error('Failed to fetch leaderboard:', error);
        }
    };

    const fetchRandomQuestion = async () => {
        try {
            const res = await axios.get('http://127.0.0.1:8000/api/questions/random/', {
                headers: { Authorization: `Bearer ${token}` },
            });
            setQuestion(res.data);
        } catch (error) {
            console.error('Failed to fetch question:', error);
        }
    };

    return (
        <div>
            <h1>Game Dashboard</h1>
            <button onClick={fetchRandomQuestion}>Get Question</button>
            {question && (
                <div>
                    <h2>{question.question_text}</h2>
                    <ul>
                        {question.answer_choices.map((choice, index) => (
                            <li key={index}>{choice}</li>
                        ))}
                    </ul>
                </div>
            )}
            <h3>Leaderboard</h3>
            <ul>
                {leaderboard.map((player, index) => (
                    <li key={index}>
                        {player.user}: {player.points} points
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default Dashboard;
