import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { WalletProvider } from './contexts/WalletContext';
import { WebSocketProvider } from './contexts/WebSocketContext';
import { ChatVisitProvider } from './contexts/ChatVisitContext';
import { useTokenRefresh } from './hooks/useTokenRefresh';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import HomePage from './components/HomePage';
import SimulatePage from './components/SimulatePage';
import MLPredictPage from './components/MLPredictPage';
import PortfolioPage from './components/PortfolioPage';
import FriendList from './components/FriendList';
import AdminPanel from './components/AdminPanel';
import MLPredict from './pages/MLPredict';
import CoinGame from './pages/CoinGame';
import PredictNow from './pages/PredictNow';
import LoginPage from './components/LoginPage';
import SignupPage from './components/SignupPage';
import FloatingMessagesButton from './components/FloatingMessagesButton';
import NewsSentiment from './pages/NewsSentiment';
import './App.css';

// Component to handle token refresh
const TokenRefreshHandler = () => {
  useTokenRefresh();
  return null;
};

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <WalletProvider>
          <WebSocketProvider>
            <ChatVisitProvider>
              <TokenRefreshHandler />
              <div className="App">
                <Navbar />
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/signup" element={<SignupPage />} />
                  <Route 
                    path="/simulate" 
                    element={
                      <ProtectedRoute>
                        <SimulatePage />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/predict" 
                    element={
                      <ProtectedRoute>
                        <MLPredictPage />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/portfolio" 
                    element={
                      <ProtectedRoute>
                        <PortfolioPage />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/coin-game" 
                    element={
                      <ProtectedRoute>
                        <CoinGame />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/friends" 
                    element={
                      <ProtectedRoute>
                        <FriendList />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/admin" 
                    element={
                      <ProtectedRoute>
                        <AdminPanel />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/news" 
                    element={
                      <ProtectedRoute>
                        <NewsSentiment />
                      </ProtectedRoute>
                    } 
                  />
                  <Route path="/ml" element={
                    <ProtectedRoute>
                      <MLPredict />
                    </ProtectedRoute>
                  } />
                  <Route path="/ml/predict" element={
                    <ProtectedRoute>
                      <MLPredict showOnlyFuture={true} />
                    </ProtectedRoute>
                  } />
                  <Route path="/predict-now" element={
                    <ProtectedRoute>
                      <PredictNow />
                    </ProtectedRoute>
                  } />
                </Routes>
                <FloatingMessagesButton />
              </div>
            </ChatVisitProvider>
          </WebSocketProvider>
        </WalletProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
