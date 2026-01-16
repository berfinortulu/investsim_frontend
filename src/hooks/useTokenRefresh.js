import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const useTokenRefresh = () => {
  const { user, refreshToken, logout } = useAuth();
  const refreshTimeoutRef = useRef(null);

  useEffect(() => {
    if (!user?.token || !user?.token_expires_at) return;

    const now = new Date();
    const expiresAt = new Date(user.token_expires_at);
    const timeUntilExpiry = expiresAt.getTime() - now.getTime();

    // If token is already expired, logout immediately
    if (timeUntilExpiry <= 0) {
      console.log('❌ Token already expired, logging out');
      logout();
      return;
    }

    // Refresh token 5 minutes before it expires
    const refreshTime = Math.max(timeUntilExpiry - 5 * 60 * 1000, 0);
    
    console.log(`🔄 Token expires in ${Math.round(timeUntilExpiry / 1000 / 60)} minutes`);
    console.log(`🔄 Will refresh in ${Math.round(refreshTime / 1000 / 60)} minutes`);

    refreshTimeoutRef.current = setTimeout(async () => {
      try {
        console.log('🔄 Refreshing token...');
        await refreshToken();
        console.log('✅ Token refreshed successfully');
      } catch (error) {
        console.error('❌ Token refresh failed:', error);
        logout();
      }
    }, refreshTime);

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [user?.token, user?.token_expires_at, refreshToken, logout]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);
}; 