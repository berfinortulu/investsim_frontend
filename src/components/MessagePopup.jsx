import React, { useState, useEffect, useRef } from 'react';
import { FiMessageCircle, FiX, FiSend, FiCheck } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import { API_ENDPOINTS } from '../config';
import './MessagePopup.css';

const MessagePopup = ({ friend, isOpen, onClose, isFriend }) => {
  const { authenticatedFetch } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Focus input when popup opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Fetch messages when popup opens and friend is selected
  useEffect(() => {
    if (isOpen && friend && isFriend) {
      fetchMessages();
    }
  }, [isOpen, friend]);

  const fetchMessages = async () => {
    if (!friend) return;

    setLoading(true);
    setError('');

    try {
      const response = await authenticatedFetch(`${API_ENDPOINTS.MESSAGES}?friend_id=${friend.id}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setMessages(data);
    } catch (error) {
      console.error('Error fetching messages:', error);
      setError('Failed to load messages');
      // Use dummy messages for demo
      setMessages([
        {
          id: 1,
          sender: friend.id,
          receiver: 999, // current user id
          content: 'Hey! How are you doing?',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          seen: true
        },
        {
          id: 2,
          sender: 999, // current user id
          receiver: friend.id,
          content: 'I\'m doing great! How about you?',
          timestamp: new Date(Date.now() - 1800000).toISOString(),
          seen: true
        },
        {
          id: 3,
          sender: friend.id,
          receiver: 999, // current user id
          content: 'Pretty good! Just checking out some investment opportunities.',
          timestamp: new Date(Date.now() - 600000).toISOString(),
          seen: false
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !friend) return;

    setSending(true);
    const messageToSend = newMessage.trim();
    setNewMessage('');

    // Optimistic update
    const optimisticMessage = {
      id: Date.now(),
      sender: 999, // current user id
      receiver: friend.id,
      content: messageToSend,
      timestamp: new Date().toISOString(),
      seen: false
    };

    setMessages(prev => [...prev, optimisticMessage]);

    try {
      const response = await authenticatedFetch(API_ENDPOINTS.MESSAGES, {
        method: 'POST',
        headers: {
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          receiver: friend.id,
          content: messageToSend
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Message sent successfully:', result);
      
      // Update the optimistic message with the real response
      setMessages(prev => 
        prev.map(msg => 
          msg.id === optimisticMessage.id 
            ? { ...msg, id: result.id, timestamp: result.timestamp }
            : msg
        )
      );

    } catch (error) {
      console.error('Error sending message:', error);
      alert(`Failed to send message: ${error.message}`);
      
      // Remove optimistic message on error
      setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
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

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('tr-TR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const isOwnMessage = (message) => {
    return message.sender === 999; // current user id
  };

  if (!isOpen || !friend || !isFriend) {
    return null;
  }

  return (
    <div className="message-popup">
      <div className="message-popup-header">
        <div className="friend-info">
          <div className="friend-avatar-small">
            {friend.name.charAt(0).toUpperCase()}
          </div>
          <div className="friend-details-small">
            <h3 className="friend-name-small">{friend.name}</h3>
            <span className="online-status">Online</span>
          </div>
        </div>
        <button className="close-button" onClick={onClose}>
          <FiX />
        </button>
      </div>

      <div className="message-popup-body">
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
                <span>Start a conversation with {friend.name}!</span>
              </div>
            ) : (
              <div className="messages-list">
                {messages.map((message) => (
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
                        {isOwnMessage(message) && (
                          <span className="message-status">
                            {message.seen ? <FiCheck className="seen" /> : <FiCheck />}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="message-popup-footer">
        <div className="message-input-container">
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="message-input"
            disabled={sending}
          />
          <button
            onClick={sendMessage}
            disabled={!newMessage.trim() || sending}
            className="send-button"
          >
            <FiSend />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MessagePopup; 