import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { API_ENDPOINTS } from '../config';

export const useUnreadMessages = () => {
  const { user } = useAuth();
  const [unreadCounts, setUnreadCounts] = useState({});
  const [totalUnread, setTotalUnread] = useState(0);
  const [acceptedFriends, setAcceptedFriends] = useState([]);

  // Helper to normalize user IDs consistently
  const normalizeUserId = (userId) => {
    if (!userId) return null;
    if (typeof userId === 'object') return userId.id || null;
    if (typeof userId === 'number') return userId;
    if (typeof userId === 'string') {
      const num = parseInt(userId, 10);
      return isNaN(num) ? null : num;
    }
    return null;
  };

  // Fetch accepted friends
  const fetchAcceptedFriends = useCallback(async () => {
    if (!user || !user.id) return;
    try {
      const response = await fetch(`${API_ENDPOINTS.FRIEND_REQUESTS}my_friends/?user_id=${user.id}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      if (response.ok) {
        const data = await response.json();
        setAcceptedFriends(data);
      }
    } catch (e) {
      console.error('Error fetching accepted friends:', e);
    }
  }, [user]);

  // Fetch and count unread messages
  const fetchAndCountUnreadMessages = useCallback(async () => {
    if (!user || !user.id) return;
    
    try {
      const response = await fetch(`${API_ENDPOINTS.MESSAGES}?unread=true`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      
      if (response.ok) {
        const data = await response.json();
        const currentUserId = normalizeUserId(user.id);
        
        // Count unread messages per sender
        const counts = {};
        let total = 0;
        
        data.forEach(msg => {
          const senderId = normalizeUserId(msg.sender);
          const receiverId = normalizeUserId(msg.receiver);
          
          // Only count messages where:
          // 1. Receiver is the current user
          // 2. Seen flag is false
          // 3. Sender is an accepted friend
          if (receiverId === currentUserId && 
              msg.seen === false && 
              senderId && 
              acceptedFriends.some(f => normalizeUserId(f.id) === senderId)) {
            
            counts[senderId] = (counts[senderId] || 0) + 1;
            total += 1;
          }
        });
        
        setUnreadCounts(counts);
        setTotalUnread(total);
      }
    } catch (e) {
      console.error('Error fetching unread messages:', e);
    }
  }, [user, acceptedFriends]);

  // Fetch accepted friends on mount and when user changes
  useEffect(() => {
    fetchAcceptedFriends();
  }, [fetchAcceptedFriends]);

  // Fetch and count unread messages when acceptedFriends changes
  useEffect(() => {
    fetchAndCountUnreadMessages();
  }, [fetchAndCountUnreadMessages]);

  return {
    unreadCounts,
    totalUnread,
    acceptedFriends,
    refetchUnreadMessages: fetchAndCountUnreadMessages,
    refetchFriends: fetchAcceptedFriends
  };
}; 