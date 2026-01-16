import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { API_ENDPOINTS } from '../config';

const WebSocketContext = createContext();

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

export const WebSocketProvider = ({ children }) => {
  const { user, logout } = useAuth();
  const [wsConnected, setWsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const socketRef = useRef(null);
  const messageHandlers = useRef(new Set());
  const pollIntervalRef = useRef(null);
  const newMessageHandlers = useRef(new Set());

  // Add message handler
  const addMessageHandler = (handler) => {
    messageHandlers.current.add(handler);
    return () => {
      messageHandlers.current.delete(handler);
    };
  };

  // Add new message handler for unread count updates
  const addNewMessageHandler = (handler) => {
    newMessageHandlers.current.add(handler);
    return () => {
      newMessageHandlers.current.delete(handler);
    };
  };

  const addPresenceIdentifiers = (ids = []) => {
    setOnlineUsers(prev => {
      const next = new Set(prev);
      ids.filter(Boolean).forEach((i) => next.add(String(i)));
      return next;
    });
  };

  const removePresenceIdentifiers = (ids = []) => {
    setOnlineUsers(prev => {
      const next = new Set(prev);
      ids.filter(Boolean).forEach((i) => next.delete(String(i)));
      return next;
    });
  };

  const refreshOnlineUsers = async () => {
    if (!user) return;
    try {
      const response = await fetch(API_ENDPOINTS.USERS_ONLINE, {
        method: 'GET',
        headers: { 'Accept': 'application/json', ...(user?.token ? { 'Authorization': `Bearer ${user.token}` } : {}) }
      });
      if (response.ok) {
        const data = await response.json();
        // Expecting array of ids or usernames or objects {id, username}
        const normalized = [];
        if (Array.isArray(data)) {
          for (const u of data) {
            if (u && typeof u === 'object') {
              if (u.id !== undefined && u.id !== null) normalized.push(String(u.id));
              if (u.username) normalized.push(String(u.username));
              if (u.name) normalized.push(String(u.name));
            } else if (u !== undefined && u !== null) {
              normalized.push(String(u));
            }
          }
        }
        setOnlineUsers(new Set(normalized));
      }
    } catch (e) {
      // silent
    }
  };

  // WebSocket connection
  useEffect(() => {
    if (!user || !user.username) return;

    const token = user.token;
    const wsUrl = `ws://localhost:8002/ws/chat/${user.username}/?token=${token}`;
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      console.log('[WS][Context] connected');
      setWsConnected(true);
      try { ws.send(JSON.stringify({ type: 'presence_sync' })); } catch (_) {}
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Notify all message handlers
        messageHandlers.current.forEach(handler => {
          try { handler(data); } catch (error) { console.error('Error in message handler:', error); }
        });

        if (data.type === 'user_connected' || data.type === 'user_online') {
          const uname = data.user_username || data.username || data.user;
          const ids = [];
          if (data.user_id !== undefined && data.user_id !== null) ids.push(String(data.user_id));
          if (uname) ids.push(String(uname));
          addPresenceIdentifiers(ids);
        } else if (data.type === 'user_disconnected' || data.type === 'user_offline') {
          const uname = data.user_username || data.username || data.user;
          const ids = [];
          if (data.user_id !== undefined && data.user_id !== null) ids.push(String(data.user_id));
          if (uname) ids.push(String(uname));
          removePresenceIdentifiers(ids);
        } else if ((data.type === 'online_users' || data.type === 'online_users_list') && Array.isArray(data.users)) {
          const normalized = [];
          for (const u of data.users) {
            if (u && typeof u === 'object') {
              if (u.id !== undefined && u.id !== null) normalized.push(String(u.id));
              if (u.userId !== undefined && u.userId !== null) normalized.push(String(u.userId));
              if (u.username) normalized.push(String(u.username));
              if (u.user) normalized.push(String(u.user));
            } else if (u !== undefined && u !== null) {
              normalized.push(String(u));
            }
          }
          setOnlineUsers(new Set(normalized));
        } else if (data.type === 'force_logout') {
          // Backend instructs client to logout (e.g., token revoked or session ended)
          logout();
          try { ws.close(); } catch (_) {}
        } else if (data.type === 'chat_message') {
          // New message received - update unread counts
          newMessageHandlers.current.forEach(handler => {
            try { handler(data); } catch (error) { console.error('Error in new message handler:', error); }
          });
        } else if (data.type === 'message' || data.type === 'new_message' || data.type === 'msg') {
          // Alternative message event types
          newMessageHandlers.current.forEach(handler => {
            try { handler(data); } catch (error) { console.error('Error in new message handler:', error); }
          });
        } else {
          // Log all other message types to see what's coming
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onclose = () => {
      console.log('[WS][Context] disconnected');
      setWsConnected(false);
    };

    ws.onerror = (error) => {
      console.error('[WS][Context] error:', error);
      setWsConnected(false);
    };

    // Start periodic refresh while logged in
    pollIntervalRef.current = setInterval(refreshOnlineUsers, 15000);
    refreshOnlineUsers();

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      try { ws.close(); } catch (_) {}
    };
  }, [user]);

  // Send message function
  const sendMessage = (messageData) => {
    if (wsConnected && socketRef.current) {
      socketRef.current.send(JSON.stringify(messageData));
    }
  };

  const value = {
    wsConnected,
    onlineUsers,
    sendMessage,
    addMessageHandler,
    addNewMessageHandler
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}; 