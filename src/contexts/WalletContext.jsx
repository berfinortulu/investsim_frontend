import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { API_ENDPOINTS } from '../config';

const WalletContext = createContext();

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

export const WalletProvider = ({ children }) => {
  const { user, authenticatedFetch } = useAuth();
  const [walletBalance, setWalletBalance] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchWalletBalance = async () => {
    if (!user || !authenticatedFetch) return;
    
    try {
      setLoading(true);
      const response = await authenticatedFetch(API_ENDPOINTS.COIN_WALLET, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      console.log('🔍 DEBUG: Wallet API response status:', response.status);
      console.log('🔍 DEBUG: Wallet API response ok:', response.ok);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.detail || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('🔍 DEBUG: WalletContext received data:', data);
      console.log('🔍 DEBUG: Data type:', typeof data);
      console.log('🔍 DEBUG: Data keys:', Object.keys(data));
      
      // Try different possible balance field names and ensure it's a number
      let balance = data.balance || data.amount || data.wallet_balance || data.total || data.value || 0;
      console.log('🔍 DEBUG: Initial balance value:', balance, 'Type:', typeof balance);
      
      // Convert to number if it's a string
      if (typeof balance === 'string') {
        balance = Number(balance);
        console.log('🔍 DEBUG: Converted string balance to number:', balance);
      }
      
      // Ensure it's a valid number
      if (isNaN(balance)) {
        console.error('🔍 DEBUG: Invalid balance value:', data.balance);
        balance = 0;
      }
      
      console.log('🔍 DEBUG: Final balance value:', balance);
      
      setWalletBalance(balance);
    } catch (error) {
      console.error('Error fetching wallet balance:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch wallet balance when user changes
  useEffect(() => {
    if (user) {
      fetchWalletBalance();
    } else {
      setWalletBalance(0);
    }
  }, [user]);

  const updateWalletBalance = (newBalance) => {
    setWalletBalance(newBalance);
  };

  const value = {
    walletBalance,
    loading,
    fetchWalletBalance,
    updateWalletBalance
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}; 