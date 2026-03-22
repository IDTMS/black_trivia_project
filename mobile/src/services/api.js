import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, ENDPOINTS } from '../constants/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-refresh token on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = await AsyncStorage.getItem('refreshToken');
        if (refreshToken) {
          const res = await axios.post(`${API_BASE_URL}${ENDPOINTS.tokenRefresh}`, {
            refresh: refreshToken,
          });
          await AsyncStorage.setItem('accessToken', res.data.access);
          originalRequest.headers.Authorization = `Bearer ${res.data.access}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'username']);
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const registerUser = (username, email, password) =>
  api.post(ENDPOINTS.register, { username, email, password });

export const loginUser = (username, password) =>
  api.post(ENDPOINTS.login, { username, password });

// Questions
export const getRandomQuestion = () => api.get(ENDPOINTS.randomQuestion);

export const getQuestionsByCategory = (category) =>
  api.get(ENDPOINTS.questions, { params: { category } });

// Matches
export const startMatch = () => api.post(ENDPOINTS.matches);

export const getMatch = (matchId) => api.get(`${ENDPOINTS.matches}${matchId}/`);

export const joinMatchByCode = (inviteCode) =>
  api.post(`${ENDPOINTS.matches}join/`, { invite_code: inviteCode });

export const joinMatch = (matchId) => api.post(ENDPOINTS.joinMatch(matchId));

export const buzz = (matchId) => api.post(ENDPOINTS.buzz(matchId));

export const submitAnswer = (matchId, questionId, answer) =>
  api.post(ENDPOINTS.answer(matchId), { question_id: questionId, answer });

export const chooseCategory = (matchId, category) =>
  api.post(ENDPOINTS.chooseCategory(matchId), { category });

export const submitMatchResult = (matchId, winnerId) =>
  api.patch(`${ENDPOINTS.matches}${matchId}/`, { winner_id: winnerId });

export const cancelMatch = (matchId) =>
  api.delete(`${ENDPOINTS.matches}${matchId}/`);

export const leaveMatch = (matchId) =>
  api.post(ENDPOINTS.leaveMatch(matchId));

// Leaderboard
export const getLeaderboard = () => api.get(ENDPOINTS.leaderboard);

// User
export const getUserStatus = () => api.get(ENDPOINTS.userStatus);

export default api;
