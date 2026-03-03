// Update this to your backend URL
// For local dev with Android emulator, use 10.0.2.2 instead of localhost
// For physical device, use your machine's local IP
export const API_BASE_URL = 'http://10.0.2.2:8000/api';

export const ENDPOINTS = {
  register: '/register/',
  login: '/login/',
  tokenRefresh: '/token/refresh/',
  questions: '/questions/',
  randomQuestion: '/questions/random/',
  matches: '/matches/',
  joinMatch: (id) => `/matches/${id}/join/`,
  buzz: (id) => `/matches/${id}/buzz/`,
  answer: (id) => `/matches/${id}/answer/`,
  chooseCategory: (id) => `/matches/${id}/choose-category/`,
  leaderboard: '/leaderboard/',
  userStatus: '/user/status/',
};
