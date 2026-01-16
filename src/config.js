// API Configuration
export const API_BASE_URL = ''; // Vite proxy kullanarak

// API Endpoints
export const API_ENDPOINTS = {
  LOGIN: `${API_BASE_URL}/api/login/`,
  SIGNUP: `${API_BASE_URL}/api/signup/`,
  LOGOUT: `${API_BASE_URL}/api/logout/`,
  REFRESH_TOKEN: `${API_BASE_URL}/api/refresh-token/`,
  USERS: `${API_BASE_URL}/api/users/`,
  USERS_ONLINE: `${API_BASE_URL}/api/users/online/`,
  FRIEND_REQUESTS: `${API_BASE_URL}/api/friend-requests/`,
  MESSAGES: `${API_BASE_URL}/api/messages/`,
  MESSAGE_STATISTICS: `${API_BASE_URL}/api/statistics/`,
  MESSAGE_CONVERSATIONS: `${API_BASE_URL}/api/conversations/`,
  SEND_MESSAGE: `${API_BASE_URL}/api/send/`,
  SIMULATIONS: `${API_BASE_URL}/api/simulations/`,
  SIMULATION_LIST: `${API_BASE_URL}/api/simulations/`, // Backend'de simulations endpoint'i var
  SIMULATION_CHART: (id) => `${API_BASE_URL}/api/simulations/${id}/chart`,
  COIN: `${API_BASE_URL}/api/coin/`,
  COIN_WALLET: `${API_BASE_URL}/api/coin/wallet/`,
  COIN_INVEST: `${API_BASE_URL}/api/coin/invest/`,
  COIN_POSITIONS: `${API_BASE_URL}/api/coin/positions/`,
  COIN_CLOSE: (id) => `${API_BASE_URL}/api/coin/positions/${id}/close/`,
  // ML / OHLC Endpoints
  ML_HISTORY: `${API_BASE_URL}/api/ml/history/`,
  ML_INGEST: `${API_BASE_URL}/api/ml/ingest/`,
  ML_TRAIN: `${API_BASE_URL}/api/ml/train/`,
  ML_PREDICT: `${API_BASE_URL}/api/ml/predict/`,
  OHLC_HISTORY: `${API_BASE_URL}/api/ohlc/history`,
  ML_RECOMMENDATIONS: `${API_BASE_URL}/api/ml/recommendations/`,
}; 