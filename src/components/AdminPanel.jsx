import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { API_ENDPOINTS } from '../config';
import { FiMessageCircle, FiEye, FiEyeOff, FiUsers, FiBarChart2, FiSearch, FiFilter, FiCheck } from 'react-icons/fi';
import './AdminPanel.css';

const AdminPanel = () => {
  const { user, authenticatedFetch } = useAuth();
  const [activeTab, setActiveTab] = useState('messages');
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [messageStats, setMessageStats] = useState({
    total: 0,
    unread: 0,
    read: 0,
    today: 0
  });

  // Check if user is admin
  useEffect(() => {
    if (user && !user.is_staff) {
      setError('Access denied. Admin privileges required.');
    }
  }, [user]);

  // Test basic API connectivity
  const testAPIConnectivity = async () => {
    if (!user?.is_staff) return;
    
    try {
      console.log('🔍 DEBUG: Testing API connectivity...');
      
      // Test basic users endpoint
      const usersResponse = await authenticatedFetch(API_ENDPOINTS.USERS, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      console.log('🔍 DEBUG: Users endpoint test - Status:', usersResponse.status);
      
      // Test messages endpoint
      const messagesResponse = await authenticatedFetch(API_ENDPOINTS.MESSAGES, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      console.log('🔍 DEBUG: Messages endpoint test - Status:', messagesResponse.status);
      
      // Test admin-specific endpoints
      if (API_ENDPOINTS.MESSAGE_STATISTICS) {
        const statsResponse = await authenticatedFetch(API_ENDPOINTS.MESSAGE_STATISTICS, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });
        console.log('🔍 DEBUG: Statistics endpoint test - Status:', statsResponse.status);
      }
      
    } catch (error) {
      console.error('🔍 DEBUG: API connectivity test failed:', error);
    }
  };

  // Run connectivity test on mount
  useEffect(() => {
    if (user?.is_staff) {
      testAPIConnectivity();
    }
  }, [user]);

  // Fetch all messages
  const fetchMessages = async () => {
    if (!user?.is_staff) return;
    
    setLoading(true);
    setError('');
    
    try {
      console.log('🔍 DEBUG: Fetching messages from:', API_ENDPOINTS.MESSAGES);
      console.log('🔍 DEBUG: User token:', user.token ? 'Present' : 'Missing');
      console.log('🔍 DEBUG: User is_staff:', user.is_staff);
      console.log('🔍 DEBUG: Full user object:', user);
      
      const response = await authenticatedFetch(API_ENDPOINTS.MESSAGES, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      
      console.log('🔍 DEBUG: Response status:', response.status);
      console.log('🔍 DEBUG: Response headers:', response.headers);
      console.log('🔍 DEBUG: Response URL:', response.url);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔍 DEBUG: Error response:', errorText);
        console.error('🔍 DEBUG: Response status text:', response.statusText);
        throw new Error(`HTTP error! status: ${response.status}. Response: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('🔍 DEBUG: Messages data received:', data);
      console.log('🔍 DEBUG: Number of messages:', data.length);
      console.log('🔍 DEBUG: Data type:', typeof data);
      console.log('🔍 DEBUG: Is array:', Array.isArray(data));
      
      setMessages(data);
      
    } catch (error) {
      console.error('🔍 DEBUG: Error fetching messages:', error);
      console.error('🔍 DEBUG: Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      // Try to get more error details
      if (error.response) {
        console.error('🔍 DEBUG: Error response object:', error.response);
      }
      
      setError(`Failed to load messages: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Fetch message statistics from backend
  const fetchMessageStatistics = async () => {
    if (!user?.is_staff) return;
    
    try {
      console.log('🔍 DEBUG: Fetching statistics from:', API_ENDPOINTS.MESSAGE_STATISTICS);
      
      const response = await authenticatedFetch(API_ENDPOINTS.MESSAGE_STATISTICS, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('🔍 DEBUG: Statistics data received:', data);
        
        setMessageStats({
          total: data.total || 0,
          unread: data.unread || 0,
          read: data.read || 0,
          today: data.today || 0
        });
      } else {
        console.warn('🔍 DEBUG: Statistics fetch failed, calculating locally');
        // Fallback to local calculation
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        const stats = {
          total: messages.length,
          unread: messages.filter(msg => !msg.seen).length,
          read: messages.filter(msg => msg.seen).length,
          today: messages.filter(msg => new Date(msg.timestamp) >= today).length
        };
        
        setMessageStats(stats);
      }
    } catch (error) {
      console.error('🔍 DEBUG: Error fetching statistics:', error);
      // Fallback to local calculation
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      const stats = {
        total: messages.length,
        unread: messages.filter(msg => !msg.seen).length,
        read: messages.filter(msg => msg.seen).length,
        today: messages.filter(msg => new Date(msg.timestamp) >= today).length
      };
      
      setMessageStats(stats);
    }
  };

  // Fetch conversations from backend
  const fetchConversations = async () => {
    if (!user?.is_staff) return;
    
    try {
      console.log('🔍 DEBUG: Fetching conversations from:', API_ENDPOINTS.MESSAGE_CONVERSATIONS);
      
      const response = await authenticatedFetch(API_ENDPOINTS.MESSAGE_CONVERSATIONS, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('🔍 DEBUG: Conversations data received:', data);
        // Store conversations data if needed
      } else {
        console.warn('🔍 DEBUG: Conversations fetch failed, using local calculation');
      }
    } catch (error) {
      console.error('🔍 DEBUG: Error fetching conversations:', error);
    }
  };

  // Send test message
  const sendTestMessage = async () => {
    if (!user?.is_staff) return;
    
    try {
      // Find first user that's not the current user
      const targetUser = users.find(u => u.id !== user.id);
      if (!targetUser) {
        alert('No other users found to send test message to');
        return;
      }
      
      const testMessage = {
        to_user_id: targetUser.id,
        content: `Test message from Admin Panel - ${new Date().toLocaleString()}`
      };
      
      console.log('🔍 DEBUG: Sending test message:', testMessage);
      
      const response = await authenticatedFetch(API_ENDPOINTS.SEND_MESSAGE, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testMessage)
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('🔍 DEBUG: Test message sent successfully:', result);
        alert(`Test message sent successfully to ${targetUser.username || targetUser.name}!`);
        
        // Refresh messages and statistics
        await fetchMessages();
        await fetchMessageStatistics();
      } else {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}. Response: ${errorText}`);
      }
    } catch (error) {
      console.error('🔍 DEBUG: Error sending test message:', error);
      alert(`Failed to send test message: ${error.message}`);
    }
  };

  // Fetch all users
  const fetchUsers = async () => {
    if (!user?.is_staff) return;
    
    try {
      const response = await authenticatedFetch(API_ENDPOINTS.USERS, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  // Load data on component mount
  useEffect(() => {
    if (user?.is_staff) {
      fetchMessages();
      fetchUsers();
      fetchMessageStatistics(); // Initial fetch for statistics
      fetchConversations(); // Initial fetch for conversations
    }
  }, [user]);

  // Filter messages by search term and selected user
  const filteredMessages = messages.filter(message => {
    const matchesSearch = searchTerm === '' || 
      message.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      message.sender?.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      message.receiver?.username?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesUser = !selectedUser || 
      message.sender?.id === selectedUser || 
      message.receiver?.id === selectedUser;
    
    return matchesSearch && matchesUser;
  });

  // Get user by ID
  const getUserById = (userId) => {
    return users.find(user => user.id === userId);
  };

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('tr-TR');
  };

  // Get conversation between two users
  const getConversation = (user1Id, user2Id) => {
    return messages.filter(msg => 
      (msg.sender?.id === user1Id && msg.receiver?.id === user2Id) ||
      (msg.sender?.id === user2Id && msg.receiver?.id === user1Id)
    ).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  };

  // Get unique conversations
  const getUniqueConversations = () => {
    const conversations = new Map();
    
    messages.forEach(message => {
      const senderId = message.sender?.id;
      const receiverId = message.receiver?.id;
      
      if (senderId && receiverId) {
        const key = [senderId, receiverId].sort().join('-');
        if (!conversations.has(key)) {
          conversations.set(key, {
            users: [senderId, receiverId],
            lastMessage: message,
            messageCount: 0
          });
        }
        conversations.get(key).messageCount++;
      }
    });
    
    return Array.from(conversations.values());
  };

  if (!user?.is_staff) {
    return (
      <div className="admin-panel">
        <div className="access-denied">
          <h2>Access Denied</h2>
          <p>Admin privileges required to access this panel.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h1>Admin Panel</h1>
        <p>Manage messages, users, and system analytics</p>
        
        {/* Test Message Button */}
        <button 
          onClick={sendTestMessage}
          className="test-message-button"
          title="Send a test message to verify the system"
        >
          🧪 Send Test Message
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">
            <FiMessageCircle />
          </div>
          <div className="stat-content">
            <h3>Total Messages</h3>
            <p className="stat-number">{messageStats.total}</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon unread">
            <FiEyeOff />
          </div>
          <div className="stat-content">
            <h3>Unread Messages</h3>
            <p className="stat-number">{messageStats.unread}</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon read">
            <FiEye />
          </div>
          <div className="stat-content">
            <h3>Read Messages</h3>
            <p className="stat-number">{messageStats.read}</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon today">
            <FiBarChart2 />
          </div>
          <div className="stat-content">
            <h3>Today's Messages</h3>
            <p className="stat-number">{messageStats.today}</p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="admin-tabs">
        <button 
          className={`tab-button ${activeTab === 'messages' ? 'active' : ''}`}
          onClick={() => setActiveTab('messages')}
        >
          <FiMessageCircle />
          All Messages
        </button>
        <button 
          className={`tab-button ${activeTab === 'conversations' ? 'active' : ''}`}
          onClick={() => setActiveTab('conversations')}
        >
          <FiUsers />
          Conversations
        </button>
      </div>

      {/* Search and Filter */}
      <div className="search-filter-bar">
        <div className="search-box">
          <FiSearch />
          <input
            type="text"
            placeholder="Search messages..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="filter-box">
          <FiFilter />
          <select 
            value={selectedUser || ''} 
            onChange={(e) => setSelectedUser(e.target.value ? parseInt(e.target.value) : null)}
          >
            <option value="">All Users</option>
            {users.map(user => (
              <option key={user.id} value={user.id}>
                {user.username || user.name || user.email}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Content Area */}
      <div className="admin-content">
        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading...</p>
          </div>
        ) : error ? (
          <div className="error-container">
            <p className="error-message">{error}</p>
            <button onClick={fetchMessages} className="retry-button">
              Try Again
            </button>
          </div>
        ) : (
          <>
            {activeTab === 'messages' && (
              <div className="messages-tab">
                <h2>All Messages ({filteredMessages.length})</h2>
                
                {filteredMessages.length === 0 ? (
                  <div className="empty-state">
                    <FiMessageCircle />
                    <p>No messages found</p>
                  </div>
                ) : (
                  <div className="messages-list">
                    {filteredMessages.map(message => {
                      const sender = getUserById(message.sender?.id);
                      const receiver = getUserById(message.receiver?.id);
                      
                      return (
                        <div key={message.id} className={`message-item ${!message.seen ? 'unread' : ''}`}>
                          <div className="message-header">
                            <div className="message-users">
                              <span className="sender">
                                {sender?.username || sender?.name || 'Unknown'} →
                              </span>
                              <span className="receiver">
                                {receiver?.username || receiver?.name || 'Unknown'}
                              </span>
                            </div>
                            <div className="message-meta">
                              <span className="timestamp">{formatTimestamp(message.timestamp)}</span>
                              <div className="message-status-container">
                                <span className={`status ${message.seen ? 'read' : 'unread'}`}>
                                  {message.seen ? 'Read' : 'Unread'}
                                </span>
                                {/* Message Status Ticks */}
                                <span className="message-status-ticks">
                                  {message.seen ? (
                                    // Two blue ticks for read messages
                                    <>
                                      <FiCheck className="tick blue-tick" />
                                      <FiCheck className="tick blue-tick" />
                                    </>
                                  ) : (
                                    // Single grey tick for unread messages
                                    <FiCheck className="tick grey-tick" />
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="message-content">
                            {message.content}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'conversations' && (
              <div className="conversations-tab">
                <h2>User Conversations</h2>
                
                {getUniqueConversations().length === 0 ? (
                  <div className="empty-state">
                    <FiUsers />
                    <p>No conversations found</p>
                  </div>
                ) : (
                  <div className="conversations-list">
                    {getUniqueConversations().map((conversation, index) => {
                      const user1 = getUserById(conversation.users[0]);
                      const user2 = getUserById(conversation.users[1]);
                      
                      return (
                        <div key={index} className="conversation-item">
                          <div className="conversation-header">
                            <div className="conversation-users">
                              <span className="user">
                                {user1?.username || user1?.name || 'Unknown'}
                              </span>
                              <span className="separator">↔</span>
                              <span className="user">
                                {user2?.username || user2?.name || 'Unknown'}
                              </span>
                            </div>
                            <div className="conversation-stats">
                              <span className="message-count">
                                {conversation.messageCount} messages
                              </span>
                              <span className="last-message">
                                {formatTimestamp(conversation.lastMessage.timestamp)}
                              </span>
                            </div>
                          </div>
                          
                          <div className="conversation-preview">
                            <p>{conversation.lastMessage.content}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AdminPanel; 