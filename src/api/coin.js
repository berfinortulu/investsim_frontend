import { API_ENDPOINTS } from '../config';

// Get wallet balance
export const getWallet = async (authenticatedFetch) => {
  try {
    const response = await authenticatedFetch(`${API_ENDPOINTS.COIN}wallet/`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    console.log('🔍 DEBUG: Wallet API response status:', response.status);
    console.log('🔍 DEBUG: Wallet API response ok:', response.ok);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('🔍 DEBUG: Wallet API response data:', data);
    return data;
  } catch (error) {
    console.error('Error fetching wallet:', error);
    throw error;
  }
};

// Place investment
export const invest = async (symbol, amount, authenticatedFetch) => {
  try {
    const response = await authenticatedFetch(`${API_ENDPOINTS.COIN}invest/`, {
      method: 'POST',
      headers: { 'Accept': 'application/json' },
      body: JSON.stringify({
        symbol,
        amount: parseFloat(amount)
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to place investment');
    }

    return await response.json();
  } catch (error) {
    console.error('Error placing investment:', error);
    throw error;
  }
};

// Get positions
export const getPositions = async (authenticatedFetch) => {
  try {
    const response = await authenticatedFetch(`${API_ENDPOINTS.COIN}positions/`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching positions:', error);
    throw error;
  }
};

// Close position
export const closePosition = async (id, authenticatedFetch) => {
  try {
    const response = await authenticatedFetch(`${API_ENDPOINTS.COIN}positions/${id}/close/`, {
      method: 'POST',
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error closing position:', error);
    throw error;
  }
}; 