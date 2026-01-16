import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useWebSocket } from './WebSocketContext';

const ChatVisitContext = createContext();

export const useChatVisit = () => {
  const context = useContext(ChatVisitContext);
  if (!context) {
    throw new Error('useChatVisit must be used within a ChatVisitProvider');
  }
  return context;
};

export const ChatVisitProvider = ({ children }) => {
  const { user } = useAuth();
  const { addNewMessageHandler } = useWebSocket();
  const [lastVisitTimes, setLastVisitTimes] = useState({});
  const [unreadCounts, setUnreadCounts] = useState({});
  // New state for message status feature
  const [friendClickTimes, setFriendClickTimes] = useState({});
  const [lastMessageTimes, setLastMessageTimes] = useState({});

  // Load last visit times from localStorage on mount
  useEffect(() => {
    if (user?.id) {
      const stored = localStorage.getItem(`chatVisits_${user.id}`);
      if (stored) {
        try {
          setLastVisitTimes(JSON.parse(stored));
        } catch (e) {
          console.warn('Failed to parse stored chat visits:', e);
        }
      }
      
      // Load friend click times
      const storedClickTimes = localStorage.getItem(`friendClickTimes_${user.id}`);
      if (storedClickTimes) {
        try {
          setFriendClickTimes(JSON.parse(storedClickTimes));
        } catch (e) {
          console.warn('Failed to parse stored friend click times:', e);
        }
      }
      
      // Load last message times
      const storedMessageTimes = localStorage.getItem(`lastMessageTimes_${user.id}`);
      if (storedMessageTimes) {
        try {
          setLastMessageTimes(JSON.parse(storedMessageTimes));
        } catch (e) {
          console.warn('Failed to parse stored last message times:', e);
        }
      }
      
      // Reset all unread counts to 0 on mount
      setUnreadCounts({});
      console.log('[ChatVisit] Reset all unread counts to 0');
    }
  }, [user]);

  // Save last visit times to localStorage whenever they change
  useEffect(() => {
    if (user?.id && Object.keys(lastVisitTimes).length > 0) {
      localStorage.setItem(`chatVisits_${user.id}`, JSON.stringify(lastVisitTimes));
    }
  }, [lastVisitTimes, user]);

  // Save friend click times to localStorage whenever they change
  useEffect(() => {
    if (user?.id && Object.keys(friendClickTimes).length > 0) {
      localStorage.setItem(`friendClickTimes_${user.id}`, JSON.stringify(friendClickTimes));
    }
  }, [friendClickTimes, user]);

  // Save last message times to localStorage whenever they change
  useEffect(() => {
    if (user?.id && Object.keys(lastMessageTimes).length > 0) {
      localStorage.setItem(`lastMessageTimes_${user.id}`, JSON.stringify(lastMessageTimes));
    }
  }, [lastMessageTimes, user]);

  // Mark that user visited a specific friend's chat
  const markChatVisited = (friendId) => {
    if (!user?.id || !friendId) return;
    
    const now = new Date().toISOString();
    setLastVisitTimes(prev => ({
      ...prev,
      [friendId]: now
    }));
    
    console.log(`[ChatVisit] Marked chat visited for friend ${friendId} at ${now}`);
  };

  // Mark that user clicked on a specific friend (for message status feature)
  const markFriendClicked = (friendId) => {
    if (!user?.id || !friendId) return;
    
    const now = new Date().toISOString();
    setFriendClickTimes(prev => ({
      ...prev,
      [friendId]: now
    }));
    
    console.log(`[ChatVisit] Marked friend clicked: ${friendId} at ${now}`);
  };

  // Update last message time from a specific friend
  const updateLastMessageTime = (friendId, messageTime) => {
    if (!user?.id || !friendId || !messageTime) return;
    
    setLastMessageTimes(prev => ({
      ...prev,
      [friendId]: messageTime
    }));
    
    console.log(`[ChatVisit] Updated last message time from ${friendId}: ${messageTime}`);
  };

  // Get message status for blue ticks feature
  const getMessageStatus = (message, friendId, isFriendOnline) => {
    if (!message || !friendId) return { showBlueTicks: false, showNormalTicks: true };
    
    // PRIORITY 1: If message is seen, always show blue ticks
    if (message.seen) {
      return { showBlueTicks: true, showNormalTicks: false };
    }
    
    const clickTime = friendClickTimes[friendId];
    const lastMessageTime = lastMessageTimes[friendId];
    
    // If no click time recorded, show normal ticks
    if (!clickTime) {
      // Default behavior if no tracking data
      return { showBlueTicks: false, showNormalTicks: true };
    }
    
    // If no last message time recorded, show normal ticks
    if (!lastMessageTime) {
      return { showBlueTicks: false, showNormalTicks: true };
    }
    
    const messageTime = new Date(message.timestamp);
    const clickTimeDate = new Date(clickTime);
    const lastMessageTimeDate = new Date(lastMessageTime);
    
    // Show blue ticks if:
    // 1. Message came BEFORE clicking on friend
    // 2. This applies to both own messages and friend messages
    const showBlueTicks = messageTime < clickTimeDate;
    
    return { showBlueTicks, showNormalTicks: !showBlueTicks };
  };

  // Count grey double ticks (unread messages) for a specific friend
  const countGreyDoubleTicks = (friendId, messages) => {
    if (!messages || !Array.isArray(messages)) return 0;
    
    return messages.filter(message => {
      // Only count messages from the friend (not own messages)
      if (message.sender === friendId) {
        // Count messages that show grey double ticks (online but unread)
        // Only count messages that are NOT seen and came after last visit
        const lastVisit = getLastVisitTime(friendId);
        if (!lastVisit) {
          // If never visited, count all unread messages
          return !message.seen;
        }
        
        const messageTime = new Date(message.timestamp);
        const lastVisitTime = new Date(lastVisit);
        
        // Only count messages that came AFTER last visit and are NOT seen
        return messageTime > lastVisitTime && !message.seen;
      }
      return false;
    }).length;
  };

  // Get total grey double ticks count across all friends
  const getTotalGreyDoubleTicks = (friendsWithMessages) => {
    if (!friendsWithMessages || !Array.isArray(friendsWithMessages)) return 0;
    
    let total = 0;
    friendsWithMessages.forEach(friendData => {
      if (friendData.friendId && friendData.messages) {
        total += countGreyDoubleTicks(friendData.friendId, friendData.messages);
      }
    });
    
    return total;
  };

  // Update grey double ticks count for a specific friend
  const updateGreyDoubleTicksCount = (friendId, messages) => {
    if (!user?.id || !friendId) return;
    
    const count = countGreyDoubleTicks(friendId, messages);
    if (count > 0) {
      console.log(`[ChatVisit] Friend ${friendId} has ${count} grey double ticks (unread messages)`);
    }
    
    return count;
  };

  // Update grey double ticks count when a message becomes seen
  const updateGreyDoubleTicksOnSeen = (friendId, messageId) => {
    if (!user?.id || !friendId || !messageId) return;
    
    console.log(`[ChatVisit] Message ${messageId} from friend ${friendId} marked as seen, updating grey ticks count`);
    
    // This will trigger a re-render in FloatingMessagesButton
    // The count will automatically decrease as messages become seen
  };

  // Get current grey double ticks count for a specific friend
  const getCurrentGreyDoubleTicksCount = (friendId, messages) => {
    return countGreyDoubleTicks(friendId, messages);
  };

  // Get last visit time for a specific friend
  const getLastVisitTime = (friendId) => {
    return lastVisitTimes[friendId] || null;
  };

  // Handle new messages from WebSocket
  const handleNewMessage = (message) => {
    if (!user?.id || !message) return;
    
    const senderId = message.sender;
    const receiverId = message.receiver;
    
    // Only count messages sent TO the current user
    if (receiverId !== user.id) return;
    
    // Update last message time from this friend
    updateLastMessageTime(senderId, message.timestamp);
    
    const lastVisit = getLastVisitTime(senderId);
    if (!lastVisit) {
      // If never visited this friend's chat, count as unread
      setUnreadCounts(prev => ({
        ...prev,
        [senderId]: (prev[senderId] || 0) + 1
      }));
      console.log(`[ChatVisit] New message from ${senderId}, never visited - count: 1`);
    } else {
      // Check if message came after last visit
      const messageTime = new Date(message.timestamp);
      const lastVisitTime = new Date(lastVisit);
      
      if (messageTime > lastVisitTime) {
        setUnreadCounts(prev => ({
          ...prev,
          [senderId]: (prev[senderId] || 0) + 1
        }));
        console.log(`[ChatVisit] New message from ${senderId} after last visit - count: ${(unreadCounts[senderId] || 0) + 1}`);
      }
    }
  };

  // Register with WebSocket to receive new messages
  useEffect(() => {
    if (addNewMessageHandler) {
      const cleanup = addNewMessageHandler(handleNewMessage);
      return cleanup;
    }
  }, [addNewMessageHandler, user?.id]);

  // Calculate unread count for a specific friend based on last visit time
  const calculateUnreadCount = (friendId, messages) => {
    if (!friendId || !messages || !Array.isArray(messages)) return 0;
    
    const lastVisit = getLastVisitTime(friendId);
    if (!lastVisit) {
      // If never visited, count all messages as unread
      return messages.filter(msg => !msg.seen && msg.sender === friendId).length;
    }
    
    const lastVisitTime = new Date(lastVisit);
    
    // Count messages that came after the last visit
    return messages.filter(msg => {
      const messageTime = new Date(msg.timestamp);
      return messageTime > lastVisitTime && 
             msg.sender === friendId && 
             !msg.seen;
    }).length;
  };

  // Update unread counts for all friends based on their messages
  const updateUnreadCounts = (friendsWithMessages) => {
    if (!friendsWithMessages || !Array.isArray(friendsWithMessages)) return;
    
    const newCounts = {};
    friendsWithMessages.forEach(friendData => {
      if (friendData.friend && friendData.messages) {
        const count = calculateUnreadCount(friendData.friend.id, friendData.messages);
        if (count > 0) {
          newCounts[friendData.friend.id] = count;
        }
      }
    });
    
    setUnreadCounts(newCounts);
    console.log('[ChatVisit] Updated unread counts:', newCounts);
  };

  // Get total unread count across all friends
  const getTotalUnread = () => {
    return Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);
  };

  // Clear unread count for a specific friend (when opening their chat)
  const clearUnreadForFriend = (friendId) => {
    setUnreadCounts(prev => {
      const newCounts = { ...prev };
      delete newCounts[friendId];
      return newCounts;
    });
  };

  const value = {
    lastVisitTimes,
    unreadCounts,
    markChatVisited,
    getLastVisitTime,
    calculateUnreadCount,
    updateUnreadCounts,
    getTotalUnread,
    clearUnreadForFriend,
    handleNewMessage,
    // New message status functions
    friendClickTimes,
    lastMessageTimes,
    markFriendClicked,
    updateLastMessageTime,
    getMessageStatus,
    countGreyDoubleTicks,
    getTotalGreyDoubleTicks,
    updateGreyDoubleTicksCount,
    updateGreyDoubleTicksOnSeen,
    getCurrentGreyDoubleTicksCount
  };

  return (
    <ChatVisitContext.Provider value={value}>
      {children}
    </ChatVisitContext.Provider>
  );
}; 