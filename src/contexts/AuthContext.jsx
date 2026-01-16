import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_BASE_URL, API_ENDPOINTS } from '../config';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing user session in localStorage
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        console.log('🔍 DEBUG: Found saved user in localStorage:', userData);
        console.log('🔍 DEBUG: Saved user ID:', userData.id);
        console.log('🔍 DEBUG: Saved username:', userData.username);
        
        // Check if token is expired
        if (userData.token_expires_at) {
          const now = new Date();
          const expiresAt = new Date(userData.token_expires_at);
          
          if (now >= expiresAt) {
            console.log('❌ Saved token expired, clearing session');
            localStorage.removeItem('user');
            setUser(null);
          } else {
            console.log('✅ Token still valid, restoring session');
            console.log('🔍 DEBUG: Restoring user with ID:', userData.id);
            setUser(userData);
          }
        } else {
          // No expiration time, assume valid for now
          console.log('⚠️ No token expiration time, assuming valid');
          console.log('🔍 DEBUG: Restoring user with ID:', userData.id);
          setUser(userData);
        }
      } catch (error) {
        console.error('Error parsing saved user data:', error);
        localStorage.removeItem('user');
        setUser(null);
      }
    } else {
      console.log('🔍 DEBUG: No saved user found in localStorage');
    }
    setLoading(false);
  }, []);

  const login = (userData) => {
    console.log('🔍 DEBUG: Login called with userData:', userData);
    console.log('🔍 DEBUG: User ID in userData:', userData.id);
    console.log('🔍 DEBUG: Username in userData:', userData.username);
    console.log('🔍 DEBUG: Token in userData:', userData.token);
    console.log('🔍 DEBUG: Token type:', typeof userData.token);
    console.log('🔍 DEBUG: Token length:', userData.token ? userData.token.length : 0);
    
    // Add token expiration time (default: 24 hours from now)
    const userWithExpiry = {
      ...userData,
      token_expires_at: userData.token_expires_at || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };
    
    console.log('🔍 DEBUG: Final user object to be set:', userWithExpiry);
    console.log('🔍 DEBUG: Final user ID:', userWithExpiry.id);
    
    setUser(userWithExpiry);
    localStorage.setItem('user', JSON.stringify(userWithExpiry));
    console.log('🔍 DEBUG: User saved to localStorage:', localStorage.getItem('user'));
    console.log('🔍 DEBUG: Token expires at:', userWithExpiry.token_expires_at);
  };

  const logout = async () => {
    try {
      // Attempt server-side logout to flip is_online=False and broadcast force_logout
      const token = user?.token;
      if (token) {
        await fetch(API_ENDPOINTS.LOGOUT, { 
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
      }
    } catch (e) {
      console.warn('Logout API call failed, proceeding to clear session locally', e);
    } finally {
      setUser(null);
      localStorage.removeItem('user');
    }
  };

  const signup = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  // Helper function to make authenticated API requests
  const authenticatedFetch = async (url, options = {}) => {
    const token = user?.token;
    
    console.log('=== AUTHENTICATED FETCH DEBUG ===');
    console.log('URL:', url);
    console.log('User object:', user);
    console.log('Token exists:', !!token);
    console.log('Token value:', token);
    console.log('Token type:', typeof token);
    console.log('Token length:', token ? token.length : 0);
    
    // Check if token is expired
    if (user?.token_expires_at) {
      const now = new Date();
      const expiresAt = new Date(user.token_expires_at);
      
      if (now >= expiresAt) {
        console.log('❌ Token expired, logging out user');
        logout();
        throw new Error('Token expired. Please login again.');
      }
    }
    
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      // Backend uses TokenAuthentication, so use Token format
      headers['Authorization'] = `Bearer ${token}`;
      console.log('Authorization header added:', headers['Authorization']);
      console.log('Full headers:', headers);
    } else {
      console.log('❌ No token found, request will be sent without Authorization header');
    }

    console.log('Final request options:', {
      ...options,
      headers,
    });
    console.log('=== END DEBUG ===');

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });
      
      // Check if token is invalid (401 Unauthorized)
      if (response.status === 401) {
        console.log('❌ Token invalid (401), logging out user');
        logout();
        throw new Error('Authentication failed. Please login again.');
      }
      
      return response;
    } catch (error) {
      // If it's a network error, don't logout (might be backend down)
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        console.log('Network error, not logging out user');
        throw error;
      }
      
      // For other errors, check if it's auth-related
      if (error.message.includes('Token expired') || error.message.includes('Authentication failed')) {
        throw error;
      }
      
      throw error;
    }
  };

  // Function to refresh token (can be called before it expires)
  const refreshToken = async () => {
    if (!user?.token) {
      throw new Error('No token to refresh');
    }
    
    try {
      // Call backend to refresh token
      const response = await fetch(API_ENDPOINTS.REFRESH_TOKEN || '/api/refresh-token/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        }
      });
      
      if (response.ok) {
        const newTokenData = await response.json();
        
        // Update user with new token
        const updatedUser = {
          ...user,
          token: newTokenData.token || newTokenData.access,
          token_expires_at: newTokenData.token_expires_at || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        };
        
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
        console.log('✅ Token refreshed successfully');
        return updatedUser;
      } else {
        throw new Error('Failed to refresh token');
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      // If refresh fails, logout user
      logout();
      throw error;
    }
  };

  const value = {
    user,
    login,
    logout,
    signup,
    authenticatedFetch,
    refreshToken,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 