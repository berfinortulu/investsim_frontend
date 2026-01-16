import React, { useEffect, useRef, useState } from 'react';
import { FiMessageCircle, FiX, FiSend, FiCheck } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import { API_ENDPOINTS } from '../config';
import { useUnreadMessages } from '../hooks/useUnreadMessages';
import { useChatVisit } from '../contexts/ChatVisitContext';
import './MessageBox.css';
import { useWebSocket } from '../contexts/WebSocketContext';

const MessageBox = ({ friend, onClose }) => {
  const { user, authenticatedFetch } = useAuth();
  const { refetchUnreadMessages } = useUnreadMessages();
  const { markChatVisited, clearUnreadForFriend, getMessageStatus, updateGreyDoubleTicksOnSeen } = useChatVisit();
  const { onlineUsers: contextOnlineUsers, socket, wsConnected: contextWsConnected } = useWebSocket();
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [isTyping, setIsTyping] = useState(false);
  const [friendTyping, setFriendTyping] = useState(false);
  const typingTimeoutRef = useRef(null);
  const [friendOnlineFromApi, setFriendOnlineFromApi] = useState(null);
  const [friendLastSeenFromApi, setFriendLastSeenFromApi] = useState(null);

  // Açık değilse veya friend yoksa render etme
  if (!friend) return null;

  // Güvenli friend property erişimi
  const friendName = friend?.name || friend?.username || 'Unknown User';
  const friendInitial = (friend?.name?.charAt(0) || friend?.username?.charAt(0) || 'U').toUpperCase();
  const friendUsername = friend?.username || null;
  const friendEmail = friend?.email || null;
  const friendId = friend?.id;

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when popup opens
  useEffect(() => {
    inputRef.current?.focus();
  }, [friend]);

  // Mark chat as visited when MessageBox opens
  useEffect(() => {
    if (friend?.id && user?.id) {
      markChatVisited(friend.id);
      clearUnreadForFriend(friend.id);
      console.log(`[MessageBox] Marked chat visited for friend ${friend.id}`);
    }
  }, [friend?.id, user?.id, markChatVisited, clearUnreadForFriend]);

  // Monitor message seen status changes and update grey double ticks count
  useEffect(() => {
    if (friend?.id && messages.length > 0) {
      // Check for newly seen messages
      messages.forEach(message => {
        if (message.seen && message.sender === friend.id) {
          // Message from friend is now seen, update grey ticks count
          updateGreyDoubleTicksOnSeen(friend.id, message.id);
        }
      });
    }
  }, [messages, friend?.id, updateGreyDoubleTicksOnSeen]);

  // Mark messages as seen when chat is opened
  const markMessagesAsSeen = async () => {
    if (!friend?.id || !user?.id) return;
    
    // Security check: Don't mark own messages as seen
    if (friend.id === user.id) {
      console.warn('[MessageBox] Cannot mark own messages as seen');
      return;
    }
    
    try {
      console.log(`[MessageBox] Marking conversation with ${friend.id} as seen`);
      
      const response = await authenticatedFetch(`${API_ENDPOINTS.MESSAGES}mark_conversation_as_seen/`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          friend_id: friend.id
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('[MessageBox] Successfully marked conversation as seen:', result);
        // Update local messages to reflect seen status - ONLY for messages from friend
        setMessages(prev => 
          prev.map(msg => 
            msg.sender === friend.id && !msg.seen 
              ? { ...msg, seen: true }
              : msg
          )
        );
      } else {
        console.warn('[MessageBox] Failed to mark conversation as seen:', response.status);
      }
    } catch (error) {
      console.error('[MessageBox] Error marking conversation as seen:', error);
    }
  };

  // Mark messages as seen ONLY when the RECEIVER opens the chat
  useEffect(() => {
    if (friend?.id && user?.id && messages.length > 0) {
      // Only mark messages as seen if current user is the RECEIVER of messages from friend
      // This means we need to check if there are any unread messages from friend to current user
      const hasUnreadMessagesFromFriend = messages.some(msg => 
        msg.sender === friend.id && 
        msg.receiver === user.id && 
        !msg.seen
      );
      
      if (hasUnreadMessagesFromFriend) {
        console.log('[MessageBox] Found unread messages from friend, marking as seen');
        markMessagesAsSeen();
      } else {
        console.log('[MessageBox] No unread messages from friend, skipping seen marking');
      }
    }
  }, [friend?.id, user?.id, messages]);

  // Helper to normalize sender to always be a numeric ID
  const normalizeSenderId = (sender) => {
    if (!sender) return null;
    if (typeof sender === 'object') return sender.id || null;
    if (typeof sender === 'number') return sender;
    if (typeof sender === 'string') {
      // If it's a numeric string, convert to number
      const num = parseInt(sender, 10);
      return isNaN(num) ? null : num;
    }
    return null;
  };

  // Helper function to sort messages chronologically
  const sortMessagesByTimestamp = (messages) => {
    return [...messages].sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeA - timeB; // Ascending order (oldest first)
    });
  };

  // Normalize various truthy/falsey representations to a boolean when possible
  const normalizeOnline = (value) => {
    if (value === true) return true;
    if (value === false) return false;
    if (value === 1 || value === '1') return true;
    if (value === 0 || value === '0') return false;
    if (typeof value === 'string') {
      const s = value.trim().toLowerCase();
      if (s === 'true' || s === 'yes' || s === 'online') return true;
      if (s === 'false' || s === 'no' || s === 'offline') return false;
    }
    return null;
  };

  // Fetch friend presence (isOnline, last_seen) from backend
  const fetchFriendPresence = async () => {
    if (!friendId && !friendUsername && !friendEmail) return;
    try {
      const pickPresence = (obj) => ({
        isOnline: obj?.is_online ?? null,
        lastSeen: obj?.last_seen ?? null,
      });
      console.log('[Presence][API] query start', { friendId, friendUsername, friendEmail });
      // Try detail endpoint by ID (with trailing slash)
      if (friendId) {
        const detailUrlWithSlash = `${API_ENDPOINTS.USERS}${friendId}/`;
        const resById = await authenticatedFetch(detailUrlWithSlash, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });
        if (resById.ok) {
          const data = await resById.json();
          const p = pickPresence(data);
          setFriendOnlineFromApi(normalizeOnline(p.isOnline));
          setFriendLastSeenFromApi(p.lastSeen || null);
          console.log('[Presence][API] detail (with slash) ok', { url: detailUrlWithSlash, p, raw: data });
          return;
        } else {
          console.warn('[Presence][API] detail with slash not ok', resById.status);
          // Try without trailing slash
          const detailUrlNoSlash = `${API_ENDPOINTS.USERS}${friendId}`;
          const resByIdNoSlash = await authenticatedFetch(detailUrlNoSlash, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
          });
          if (resByIdNoSlash.ok) {
            const data = await resByIdNoSlash.json();
            const p = pickPresence(data);
            setFriendOnlineFromApi(normalizeOnline(p.isOnline));
            setFriendLastSeenFromApi(p.lastSeen || null);
            console.log('[Presence][API] detail (no slash) ok', { url: detailUrlNoSlash, p, raw: data });
            return;
          } else {
            console.warn('[Presence][API] detail no slash not ok', resByIdNoSlash.status);
          }
        }
      }
      // Fallback: query by username param
      if (friendUsername) {
        const urlUser = `${API_ENDPOINTS.USERS}?username=${encodeURIComponent(friendUsername)}`;
        const resByUsername = await authenticatedFetch(urlUser, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });
        if (resByUsername.ok) {
          const data = await resByUsername.json();
          const userObj = Array.isArray(data) ? data.find(u => (u.username === friendUsername) || (u.name === friendUsername) || (u.id === friendId)) : data;
          if (userObj) {
            const p = pickPresence(userObj);
            setFriendOnlineFromApi(normalizeOnline(p.isOnline));
            setFriendLastSeenFromApi(p.lastSeen || null);
            console.log('[Presence][API] by username ok', { url: urlUser, p, raw: userObj });
            return;
          } else {
            console.warn('[Presence][API] by username returned empty');
          }
        } else {
          console.warn('[Presence][API] /users?username= not ok', resByUsername.status);
        }
      }
      // Fallback: query by email param
      if (friendEmail) {
        const urlEmail = `${API_ENDPOINTS.USERS}?email=${encodeURIComponent(friendEmail)}`;
        const resByEmail = await authenticatedFetch(urlEmail, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });
        if (resByEmail.ok) {
          const data = await resByEmail.json();
          const userObj = Array.isArray(data) ? data.find(u => (u.email === friendEmail)) : data;
          if (userObj) {
            const p = pickPresence(userObj);
            setFriendOnlineFromApi(normalizeOnline(p.isOnline));
            setFriendLastSeenFromApi(p.lastSeen || null);
            console.log('[Presence][API] by email ok', { url: urlEmail, p, raw: userObj });
            return;
          } else {
            console.warn('[Presence][API] by email returned empty');
          }
        } else {
          console.warn('[Presence][API] /users?email= not ok', resByEmail.status);
        }
      }
      // Final fallback: fetch all users and filter locally (heavier but reliable)
      const listUrl = `${API_ENDPOINTS.USERS}`;
      const resAll = await authenticatedFetch(listUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      if (resAll.ok) {
        const all = await resAll.json();
        const userObj = Array.isArray(all)
          ? all.find(u => (u.id === friendId) || (friendUsername && (u.username === friendUsername || u.name === friendUsername)) || (friendEmail && u.email === friendEmail))
          : null;
        if (userObj) {
          const p = pickPresence(userObj);
          setFriendOnlineFromApi(normalizeOnline(p.isOnline));
          setFriendLastSeenFromApi(p.lastSeen || null);
          console.log('[Presence][API] list ok', { url: listUrl, p, raw: userObj });
        } else {
          console.warn('[Presence][API] list returned but friend not found');
        }
      } else {
        console.warn('[Presence][API] /users list not ok', resAll.status);
      }
    } catch (e) {
      console.warn('[Presence][API] fetch error', e);
      // Silent fail, fallback to WS presence
    }
  };

  // Poll presence while the MessageBox is open
  useEffect(() => {
    if (!friend || !user) return;
    let intervalId = null;
    fetchFriendPresence();
    intervalId = setInterval(fetchFriendPresence, 5000); // every 5s
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friendId, friendUsername, friendEmail, user]);

  // WebSocket connection
  useEffect(() => {
    if (friend && user) {
      setMessages([]);
      fetchMessages();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friend, user]);

  // Listen for new messages from WebSocketContext
  useEffect(() => {
    if (!friend || !user) return;

    const handleNewMessage = (data) => {
      // Only react if this message is between current user and the opened friend
      const getId = (v) => {
        if (v == null) return null;
        if (typeof v === 'object') return v.id ?? null;
        const n = Number(v);
        return Number.isNaN(n) ? null : n;
      };
      const senderId = getId(data.sender || data.from_user || (data.user && data.user.id) || data.user_id);
      const receiverId = getId(data.receiver || data.to_user || data.to_user_id || data.to);
      const involvesThisChat = (
        (senderId === friend.id && receiverId === user.id) ||
        (senderId === user.id && receiverId === friend.id)
      );
      
      if (involvesThisChat) {
        console.log('[MessageBox] New message for this chat:', data);
        fetchMessages(); // reload messages
        // Stop typing indicator when message received from friend
        if (senderId === friend.id) setFriendTyping(false);
        // Refresh unread counts
        refetchUnreadMessages();
      }
    };

    // Subscribe to new message events
    if (contextWsConnected) {
      // Add event listener for new messages
      const handleMessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'chat_message') {
            handleNewMessage(data);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      if (socket) {
        socket.addEventListener('message', handleMessage);
        return () => socket.removeEventListener('message', handleMessage);
      }
    }
  }, [friend, user, contextWsConnected, socket, refetchUnreadMessages]);

  const fetchMessages = async () => {
    if (!friend) return;
    setLoading(true);
    setError('');
    try {
      const response = await authenticatedFetch(`${API_ENDPOINTS.MESSAGES}?friend_id=${friendId}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      // Normalize all messages from backend and sort chronologically
      const normalizedMessages = data.map(msg => ({
        ...msg,
        sender: normalizeSenderId(msg.sender),
        receiver: normalizeSenderId(msg.receiver),
        // Ensure seen is a proper boolean regardless of backend field naming
        seen: typeof msg.seen !== 'undefined' ? Boolean(msg.seen) : Boolean(msg.is_seen)
      }));
      setMessages(sortMessagesByTimestamp(normalizedMessages));
      
      // After messages are loaded, check if current user should mark any as seen
      // Only mark messages as seen if current user is the RECEIVER of unread messages from friend
      const unreadMessagesFromFriend = normalizedMessages.filter(msg => 
        msg.sender === friend.id && 
        msg.receiver === user.id && 
        !msg.seen
      );
      
      if (unreadMessagesFromFriend.length > 0) {
        console.log(`[MessageBox] Found ${unreadMessagesFromFriend.length} unread messages from friend after fetch, marking as seen`);
        // Add a small delay to ensure backend is ready
        setTimeout(() => {
          markMessagesAsSeen();
        }, 100);
      } else {
        console.log('[MessageBox] No unread messages from friend after fetch, skipping seen marking');
      }
    } catch (error) {
      setError('Failed to load messages');
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || !friend || !user) return;
    setSending(true);
    const messageToSend = inputMessage.trim();
    setInputMessage('');
    
    // Create optimistic message with numeric sender ID
    const optimisticMessage = {
      id: Date.now(),
      sender: user.id, // Always numeric ID
      receiver: friendId,
      content: messageToSend,
      timestamp: new Date().toISOString()
      // Remove seen field from optimistic message - let backend handle it
    };
    
    // Add optimistic message immediately and sort
    setMessages(prev => sortMessagesByTimestamp([...prev, optimisticMessage]));
    
    try {
      // Send via HTTP API first (more reliable)
      const token = user?.token;
      const requestBody = {
        to_user: friendId,
        to_user_id: friendId,
        receiver: friendId,
        content: messageToSend
      };
      console.log('[HTTP][MessageBox] Sending message:', requestBody);
      const requestHeaders = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };
      
      const response = await fetch(API_ENDPOINTS.MESSAGES, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}. Response: ${errorText}`);
      }
      
      const result = await response.json();
      
      // Update optimistic message with real backend data but KEEP it in the list and sort
      setMessages(prev => 
        sortMessagesByTimestamp(
          prev.map(msg => 
            msg.id === optimisticMessage.id 
              ? { 
                  ...msg, 
                  id: result.id, 
                  timestamp: result.timestamp,
                  // Keep the sender as user.id to ensure it's recognized as own message
                  sender: user.id,
                  // Add seen field from backend response if available
                  seen: result.seen !== undefined ? result.seen : false
                }
              : msg
          )
        )
      );
      
      // Send via WebSocket for real-time updates (after HTTP success)
      if (contextWsConnected && socket) {
        const messageData = {
          type: 'chat_message',
          content: messageToSend,
          to_user: friendId,
          to_user_id: friendId,
          receiver: friendId,
          // Optionally include sender for backends that rely on it
          sender: user.id
        };
        console.log('[WS][MessageBox] Sending message via WebSocket:', messageData);
        socket.send(JSON.stringify(messageData));
      }
      
      // Refresh unread counts after sending message
      refetchUnreadMessages();
      
    } catch (error) {
      // Remove optimistic message only on error and sort
      setMessages(prev => sortMessagesByTimestamp(prev.filter(msg => msg.id !== optimisticMessage.id)));
      alert(`Failed to send message: ${error.message}`);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Handle typing indicator
  const handleInputChange = (e) => {
    setInputMessage(e.target.value);
    
    // Send typing start if not already typing
    if (!isTyping && contextWsConnected && socket) {
      setIsTyping(true);
      socket.send(JSON.stringify({
        type: 'typing_start',
        to_user: friendId
      }));
    }
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      if (contextWsConnected && socket) {
        setIsTyping(false);
        socket.send(JSON.stringify({
          type: 'typing_stop',
          to_user: friendId
        }));
      }
    }, 1000); // Stop typing indicator after 1 second of no input
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('tr-TR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    
    // Reset time to compare only dates
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const nowOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const diffTime = nowOnly.getTime() - dateOnly.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays === 0) {
      return 'Today';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'long' });
    } else {
      return date.toLocaleDateString('tr-TR', { 
        day: 'numeric', 
        month: 'long',
        year: 'numeric'
      });
    }
  };

  const shouldShowDateSeparator = (currentMessage, previousMessage) => {
    if (!previousMessage) return true;
    
    const currentDate = new Date(currentMessage.timestamp).toDateString();
    const previousDate = new Date(previousMessage.timestamp).toDateString();
    
    return currentDate !== previousDate;
  };

  // Kullanıcı kimliğini normalize eden yardımcı fonksiyon
  const getUserIdentifiers = (user) => {
    if (!user) return [];
    if (typeof user === 'object') {
      return [user.id, user.username].filter(Boolean);
    }
    return [user];
  };

  // Use strict numeric ID comparison for own message
  const isOwnMessage = (message) => {
    return message.sender === user.id;
  };
 
  // Build identifier tokens for a user (id, username)
  const getIdentifierTokens = (u) => {
    const tokens = [];
    if (!u) return tokens;
    if (typeof u === 'object') {
      if (u.id !== undefined && u.id !== null) tokens.push(String(u.id));
      if (u.username) tokens.push(String(u.username));
      if (u.name) tokens.push(String(u.name));
    } else {
      tokens.push(String(u));
    }
    return tokens;
  };

  // Union of local presence and shared context presence
  const combinedPresence = new Set([...(contextOnlineUsers || []), ...onlineUsers]);
  // Determine if friend is online using API presence first, then combined identifiers
  const isFriendOnline = (() => {
    if (friendOnlineFromApi !== null) return friendOnlineFromApi;
    const tokens = getIdentifierTokens(friend);
    const result = tokens.some((t) => combinedPresence.has(String(t)));
    console.log('[Presence][MessageBox] check', { friend, tokens, combinedPresence: [...combinedPresence], result, friendOnlineFromApi });
    return result;
  })();
 
  // Calculate last seen time
  const getLastSeenText = () => {
    if (isFriendOnline) return 'Online now';
    
    // Prefer API last_seen if available
    const lastSeenStr = friendLastSeenFromApi || friend.last_seen;
    if (lastSeenStr) {
      const lastSeen = new Date(lastSeenStr);
      const now = new Date();
      const diffMs = now - lastSeen;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
      if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
      return lastSeen.toLocaleDateString();
    }
    
    return 'Offline';
  };

  return (
    <div className="message-box">
      <div className="message-box-header">
        <div className="friend-info">
          <div className="friend-avatar-small">
            {friendInitial}
          </div>
          <div className="friend-details-small">
            <h3 className="friend-name-small">{friendName}</h3>
            <div className="online-status-container">
              <span className={`online-status-dot ${isFriendOnline ? 'online' : 'offline'}`}></span>
              <span className="online-status-text">
                {isFriendOnline ? 'Online' : getLastSeenText()}
              </span>
            </div>
          </div>
        </div>
        <button className="close-button" onClick={onClose} title="Close chat" aria-label="Close chat" type="button">
          <span className="close-text" aria-hidden="true">×</span>
        </button>
      </div>
      <div className="message-box-body">
        {loading ? (
          <div className="loading-messages">
            <div className="loading-spinner-small"></div>
            <p>Loading messages...</p>
          </div>
        ) : (
          <div className="messages-container">
            {messages.length === 0 ? (
              <div className="no-messages">
                <FiMessageCircle />
                <p>No messages yet</p>
                <span>Start a conversation with {friendName}!</span>
              </div>
            ) : (
              <div className="messages-list">
                {messages.map((message, index) => {
                  const previousMessage = messages[index - 1];
                  const showDateSeparator = shouldShowDateSeparator(message, previousMessage);
                  console.log(`[DateSeparator] Message ${index}:`, {
                    timestamp: message.timestamp,
                    formattedDate: formatDate(message.timestamp),
                    showSeparator: showDateSeparator,
                    previousMessage: previousMessage?.timestamp
                  });
                  return (
                    <React.Fragment key={message.id}>
                      {showDateSeparator && (
                        <div className="date-separator">
                          {formatDate(message.timestamp)}
                        </div>
                      )}
                      <div
                        key={message.id}
                        className={`message ${isOwnMessage(message) ? 'own-message' : 'friend-message'}`}
                      >
                        <div className="message-content">
                          <p>{message.content}</p>
                          <div className="message-meta">
                            <span className="message-time">
                              {formatTime(message.timestamp)}
                            </span>
                            {/* Show message status for both own and friend messages */}
                            {(() => {
                              // Only show ticks for own messages
                              if (!isOwnMessage(message)) {
                                return null;
                              }
                              
                              // For own messages, show appropriate tick status
                              if (message.seen === true) {
                                // Message is seen by friend - show blue ticks
                                return (
                                  <span className="message-status">
                                    <FiCheck className="blue-ticks" />
                                    <FiCheck className="blue-ticks" />
                                  </span>
                                );
                              } else {
                                // Message is not seen yet - show normal ticks
                                if (isFriendOnline) {
                                  return (
                                    <span className="message-status">
                                      <FiCheck />
                                      <FiCheck />
                                    </span>
                                  );
                                } else {
                                  return (
                                    <span className="message-status">
                                      <FiCheck />
                                    </span>
                                  );
                                }
                              }
                            })()}
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
                {/* Typing Indicator */}
                {friendTyping && (
                  <div className="typing-indicator">
                    <div className="typing-dots">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                    <span className="typing-text">{friendName} is typing...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        )}
      </div>
      <div className="message-box-footer">
        <div className="message-input-container">
          <input
            ref={inputRef}
            type="text"
            value={inputMessage}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="message-input"
            disabled={sending}
          />
          <button
            onClick={sendMessage}
            disabled={!inputMessage.trim() || sending}
            className="send-button"
          >
            <FiSend />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MessageBox; 