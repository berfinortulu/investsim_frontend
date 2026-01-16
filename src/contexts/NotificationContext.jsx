import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { API_ENDPOINTS } from '../config';

const NotificationContext = createContext();

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const { user, authenticatedFetch } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Fetch user-specific notifications from backend
  const fetchNotifications = async () => {
    console.log('🔍 DEBUG: fetchNotifications called for user:', user);
    
    if (!user || !user.id) {
      console.log('🔍 DEBUG: No user or user.id, clearing notifications');
      setNotifications([]);
      setPendingCount(0);
      return;
    }

    setLoading(true);
    try {
      const apiUrl = `${API_ENDPOINTS.FRIEND_REQUESTS}notifications/?user_id=${user.id}`;
      console.log('🔍 DEBUG: Fetching notifications from:', apiUrl);
      
      // Fetch notifications for the current user with user_id parameter
      const response = await authenticatedFetch(apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      console.log('🔍 DEBUG: Response status:', response.status);
      console.log('🔍 DEBUG: Response ok:', response.ok);

      if (response.ok) {
        const data = await response.json();
        console.log('🔍 DEBUG: User notifications from backend:', data);
        
        // Handle different response formats from backend
        let notificationData = [];
        
        if (data.pending_count !== undefined) {
          // Backend only returns pending_count, we need to fetch the actual notifications
          console.log('🔍 DEBUG: Backend returned pending_count, fetching actual notifications...');
          
          // Try to fetch the actual notifications from a different endpoint
          try {
            const notificationsResponse = await authenticatedFetch(`${API_ENDPOINTS.FRIEND_REQUESTS}incoming/?user_id=${user.id}`, {
              method: 'GET',
              headers: {
                'Accept': 'application/json'
              }
            });
            
            if (notificationsResponse.ok) {
              const notificationsData = await notificationsResponse.json();
              console.log('🔍 DEBUG: Actual notifications from incoming endpoint:', notificationsData);
              notificationData = notificationsData.results || notificationsData || [];
            } else {
              console.log('🔍 DEBUG: Could not fetch actual notifications, using pending_count only');
              // If we can't get actual notifications, create a dummy structure
              notificationData = [];
            }
          } catch (error) {
            console.log('🔍 DEBUG: Error fetching actual notifications:', error);
            notificationData = [];
          }
        } else {
          // Backend returned full notification objects
          notificationData = data.results || data.notifications || data || [];
        }
        
        console.log('🔍 DEBUG: Processed notification data:', notificationData);
        console.log('🔍 DEBUG: Setting notifications to:', notificationData);
        
        setNotifications(notificationData);
        
        // Count pending friend requests for this user
        const pendingRequests = notificationData.filter(notification => 
          notification.type === 'friend_request' && 
          notification.status === 'pending' &&
          notification.receiver_id === user.id
        );
        
        // If we have pending_count from backend, use it
        const finalPendingCount = data.pending_count !== undefined ? data.pending_count : pendingRequests.length;
        console.log('🔍 DEBUG: Setting pendingCount to:', finalPendingCount);
        setPendingCount(finalPendingCount);
        
        console.log(`🔍 DEBUG: Found ${finalPendingCount} pending friend requests for user ${user.id}`);
      } else {
        const errorText = await response.text();
        console.error('🔍 DEBUG: Failed to fetch user notifications from backend:', errorText);
        // Don't clear existing notifications on error, keep them
        console.log('🔍 DEBUG: Keeping existing notifications due to error');
      }
    } catch (error) {
      console.error('🔍 DEBUG: Error fetching user notifications from backend:', error);
      // Don't clear existing notifications on error, keep them
      console.log('🔍 DEBUG: Keeping existing notifications due to error');
    } finally {
      setLoading(false);
    }
  };

  // Mark notification as read
  const markAsRead = async (notificationId) => {
    if (!user || !user.id) return;
    
    try {
      const response = await authenticatedFetch(`${API_ENDPOINTS.FRIEND_REQUESTS}notifications/${notificationId}/mark-read/?user_id=${user.id}`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        // Update local state
        setNotifications(prev => 
          prev.map(notification => 
            notification.id === notificationId 
              ? { ...notification, read: true }
              : notification
          )
        );
        
        // Recalculate pending count
        const updatedNotifications = notifications.map(notification => 
          notification.id === notificationId 
            ? { ...notification, read: true }
            : notification
        );
        const pendingRequests = updatedNotifications.filter(notification => 
          notification.type === 'friend_request' && 
          notification.status === 'pending' &&
          notification.receiver_id === user.id
        );
        setPendingCount(pendingRequests.length);
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    if (!user || !user.id) return;
    
    try {
      const response = await authenticatedFetch(`${API_ENDPOINTS.FRIEND_REQUESTS}notifications/mark-all-read/?user_id=${user.id}`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        // Update local state
        setNotifications(prev => 
          prev.map(notification => ({ ...notification, read: true }))
        );
        setPendingCount(0);
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  // Delete notification
  const deleteNotification = async (notificationId) => {
    if (!user || !user.id) return;
    
    try {
      const response = await authenticatedFetch(`${API_ENDPOINTS.FRIEND_REQUESTS}notifications/${notificationId}/delete/?user_id=${user.id}`, {
        method: 'DELETE',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        // Remove from local state
        setNotifications(prev => prev.filter(notification => notification.id !== notificationId));
        
        // Recalculate pending count
        const updatedNotifications = notifications.filter(notification => notification.id !== notificationId);
        const pendingRequests = updatedNotifications.filter(notification => 
          notification.type === 'friend_request' && 
          notification.status === 'pending' &&
          notification.receiver_id === user.id
        );
        setPendingCount(pendingRequests.length);
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  // Fetch notifications when user changes
  useEffect(() => {
    fetchNotifications();
  }, [user]);

  // Set up polling to check for new notifications every 60 seconds (increased from 30)
  useEffect(() => {
    if (!user || !user.id) return;

    console.log('🔍 DEBUG: Setting up polling for user:', user.id);

    const interval = setInterval(() => {
      console.log('🔍 DEBUG: Polling for new notifications...');
      fetchNotifications();
    }, 60000); // Check every 60 seconds (increased from 30)

    return () => {
      console.log('🔍 DEBUG: Clearing polling interval');
      clearInterval(interval);
    };
  }, [user]);

  // Refresh notifications function that can be called from other components
  const refreshNotifications = () => {
    fetchNotifications();
  };

  const value = {
    notifications,
    pendingCount,
    loading,
    refreshNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}; 