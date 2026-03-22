// Set EXPO_PUBLIC_API_BASE_URL in your environment for production.
// Defaults to the Android emulator loopback for local development.
const ENV_URL = typeof process !== 'undefined' && process.env && process.env.EXPO_PUBLIC_API_BASE_URL;
export const API_BASE_URL = ENV_URL || 'http://10.0.2.2:8000/api';

export const ENDPOINTS = {
  register: '/register/',
  login: '/login/',
  currentUser: '/me/',
  tokenRefresh: '/token/refresh/',
  questions: '/questions/',
  randomQuestion: '/questions/random/',
  matches: '/matches/',
  joinMatch: (id) => `/matches/${id}/join/`,
  buzz: (id) => `/matches/${id}/buzz/`,
  answer: (id) => `/matches/${id}/answer/`,
  chooseCategory: (id) => `/matches/${id}/choose-category/`,
  leaveMatch: (id) => `/matches/${id}/leave/`,
  leaderboard: '/leaderboard/',
  userStatus: '/user/status/',
};
