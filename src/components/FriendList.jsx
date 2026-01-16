import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { API_ENDPOINTS } from '../config';
import MessageBox from './MessageBox';
import './FriendList.css';
import { useWebSocket } from '../contexts/WebSocketContext';

const FriendList = () => {
  const { user, authenticatedFetch } = useAuth();
  const { notifications, pendingCount, refreshNotifications } = useNotifications();
  const { onlineUsers: contextOnlineUsers } = useWebSocket();
  const [users, setUsers] = useState([]);
  const [friendRequests, setFriendRequests] = useState(new Set());
  const [friends, setFriends] = useState(new Set());
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingLoading, setPendingLoading] = useState(true);
  const [activeChat, setActiveChat] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const socketRef = useRef(null);

  // IMMEDIATE localStorage load on component mount (synchronous)
  useEffect(() => {
    if (user && user.id) {
      const storedRequests = localStorage.getItem(`incomingRequests_${user.id}`);
      if (storedRequests) {
        try {
          const localRequests = JSON.parse(storedRequests);
          console.log('🔍 DEBUG: IMMEDIATE localStorage load:', localRequests);
          setIncomingRequests(localRequests);
          setPendingLoading(false); // Don't show loading if we have cached data
        } catch (e) {
          console.error('🔍 DEBUG: Error parsing localStorage data:', e);
        }
      }
    }
  }, [user]);

  // Fetch users from Django backend
  useEffect(() => {
    fetchUsers();
  }, []);

  // WebSocket connection for online status
  useEffect(() => {
    if (user) {
      const token = user.token;
      const wsUrl = `ws://localhost:8002/ws/chat/${user.username}/?token=${token}`;
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected for online status tracking');
        // Optionally request a presence sync if backend supports it
        try { ws.send(JSON.stringify({ type: 'presence_sync' })); } catch (_) {}
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'user_connected') {
            const username = data.user_username || data.username || data.user;
            const identifiers = [];
            if (data.user_id !== undefined && data.user_id !== null) identifiers.push(String(data.user_id));
            if (username) identifiers.push(String(username));
            setOnlineUsers(prev => new Set([...prev, ...identifiers]));
          } else if (data.type === 'user_disconnected') {
            const username = data.user_username || data.username || data.user;
            const identifiers = [];
            if (data.user_id !== undefined && data.user_id !== null) identifiers.push(String(data.user_id));
            if (username) identifiers.push(String(username));
            setOnlineUsers(prev => {
              const updated = new Set(prev);
              identifiers.forEach((id) => updated.delete(String(id)));
              return updated;
            });
          } else if (data.type === 'online_users' && Array.isArray(data.users)) {
            // Backend may send initial roster as array of ids/usernames or objects
            const normalized = [];
            for (const u of data.users) {
              if (u && typeof u === 'object') {
                if (u.id !== undefined && u.id !== null) normalized.push(String(u.id));
                if (u.username) normalized.push(String(u.username));
              } else if (u !== undefined && u !== null) {
                normalized.push(String(u));
              }
            }
            setOnlineUsers(new Set(normalized));
          } else if (data.type === 'connection_established') {
            // no-op
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      return () => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      };
    }
  }, [user]);

  const isUserOnline = (userLike) => {
    if (!userLike) return false;
    const tokens = [];
    if (userLike.id !== undefined && userLike.id !== null) tokens.push(String(userLike.id));
    if (userLike.username) tokens.push(String(userLike.username));
    if (userLike.name) tokens.push(String(userLike.name));
    const combined = new Set([...(contextOnlineUsers || []), ...onlineUsers]);
    const result = tokens.some((t) => combined.has(String(t)));
    console.log('[Presence][FriendList] check', { userLike, tokens, combined: [...combined], result });
    return result;
  };

  // Process notifications to extract incoming friend requests for current user
  useEffect(() => {
    console.log('🔍 DEBUG: Processing notifications for user:', user);
    console.log('🔍 DEBUG: Notifications from context:', notifications);
    
    if (notifications && notifications.length > 0 && user) {
      // Extract friend request notifications for the current user
      const friendRequestNotifications = notifications.filter(notification => 
        notification.type === 'friend_request' && 
        notification.status === 'pending' &&
        notification.receiver_id === user.id
      );
      
      console.log(`🔍 DEBUG: Processing ${friendRequestNotifications.length} friend request notifications for user ${user.id}`);
      console.log('🔍 DEBUG: Filtered friend request notifications:', friendRequestNotifications);
      
      // Convert notifications to incoming requests format
      const requests = friendRequestNotifications.map(notification => ({
        id: notification.id,
        request_id: notification.request_id || notification.id,
        from_user_name: notification.sender_name || notification.from_user_name,
        from_user_username: notification.sender_username || notification.from_user_username,
        from_user_email: notification.sender_email || notification.from_user_email,
        created_at: notification.created_at,
        notification_id: notification.id,
        sender_id: notification.sender_id
      }));
      
      // Save to localStorage for persistence
      if (user.id) {
        localStorage.setItem(`incomingRequests_${user.id}`, JSON.stringify(requests));
        console.log('🔍 DEBUG: Saved incoming requests to localStorage:', requests);
      }
      
      setIncomingRequests(requests);
      console.log('🔍 DEBUG: Incoming requests processed:', requests);
      console.log('🔍 DEBUG: incomingRequests.length:', requests.length);
    } else {
      console.log('🔍 DEBUG: No notifications or user, setting empty array');
      setIncomingRequests([]);
    }
  }, [notifications, user]);

  // Load pending requests from localStorage on mount and sync with backend
  useEffect(() => {
    const loadAndSyncIncomingRequests = async () => {
      if (!user || !user.id) return;
      
      // Don't set loading if we already have data from localStorage
      if (incomingRequests.length === 0) {
        setPendingLoading(true);
      }
      
      try {
        // Fetch from backend to sync
        const response = await authenticatedFetch(`${API_ENDPOINTS.FRIEND_REQUESTS}incoming/?user_id=${user.id}`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });
        
        if (response.ok) {
          const data = await response.json();
          const backendRequests = data
            .filter(req => req.status === 'pending')
            .map(request => ({
              id: request.id,
              request_id: request.id,
              from_user_name: request.from_user?.username || request.from_user_name || 'Unknown User',
              from_user_username: request.from_user?.username,
              from_user_email: request.from_user?.email,
              created_at: request.created_at,
              sender_id: request.from_user?.id
            }));
          
          console.log('🔍 DEBUG: Fetched from backend:', backendRequests);
          
          // If backend has data, use it; otherwise keep localStorage data
          if (backendRequests.length > 0) {
            setIncomingRequests(backendRequests);
            // Update localStorage with backend data
            localStorage.setItem(`incomingRequests_${user.id}`, JSON.stringify(backendRequests));
            console.log('🔍 DEBUG: Updated with backend data');
          } else {
            console.log('🔍 DEBUG: Backend empty, keeping localStorage data');
          }
        } else {
          console.warn('🔍 DEBUG: Backend fetch failed, keeping localStorage data');
        }
      } catch (e) {
        console.error('🔍 DEBUG: Error fetching/syncing incoming requests:', e);
        // Keep localStorage data if backend fails
      }
      
      setPendingLoading(false);
    };
    
    // Only run backend sync if we have user and haven't already loaded from localStorage
    if (user && user.id) {
      loadAndSyncIncomingRequests();
    }
  }, [user]);

  // After approve/reject, always re-fetch from backend
  const handleApprove = async (requestId) => {
    try {
      const response = await authenticatedFetch(`${API_ENDPOINTS.FRIEND_REQUESTS}${requestId}/approve/?user_id=${user.id}`, {
        method: 'POST',
        headers: { 'Accept': 'application/json' }
      });
      if (response.ok) {
        await refreshNotifications();
        
        // Remove from localStorage
        if (user.id) {
          const storedRequests = localStorage.getItem(`incomingRequests_${user.id}`);
          if (storedRequests) {
            const localRequests = JSON.parse(storedRequests);
            const updatedRequests = localRequests.filter(req => req.request_id !== requestId && req.id !== requestId);
            localStorage.setItem(`incomingRequests_${user.id}`, JSON.stringify(updatedRequests));
            console.log('🔍 DEBUG: Removed approved request from localStorage:', requestId);
          }
        }
        
        // Update local state immediately
        setIncomingRequests(prev => prev.filter(req => req.request_id !== requestId && req.id !== requestId));
        
        // Always re-fetch to ensure state is up-to-date
        const res = await authenticatedFetch(`${API_ENDPOINTS.FRIEND_REQUESTS}incoming/?user_id=${user.id}`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });
        if (res.ok) {
          const data = await res.json();
          const pendingRequests = data.filter(req => req.status === 'pending');
          setIncomingRequests(pendingRequests);
          
          // Update localStorage with fresh data
          if (user.id) {
            localStorage.setItem(`incomingRequests_${user.id}`, JSON.stringify(pendingRequests));
          }
        }
      }
    } catch (e) {
      console.error('Error approving request:', e);
    }
  };

  const handleReject = async (requestId) => {
    try {
      const response = await authenticatedFetch(`${API_ENDPOINTS.FRIEND_REQUESTS}${requestId}/reject/?user_id=${user.id}`, {
        method: 'POST',
        headers: { 'Accept': 'application/json' }
      });
      if (response.ok) {
        await refreshNotifications();
        
        // Remove from localStorage
        if (user.id) {
          const storedRequests = localStorage.getItem(`incomingRequests_${user.id}`);
          if (storedRequests) {
            const localRequests = JSON.parse(storedRequests);
            const updatedRequests = localRequests.filter(req => req.request_id !== requestId && req.id !== requestId);
            localStorage.setItem(`incomingRequests_${user.id}`, JSON.stringify(updatedRequests));
            console.log('🔍 DEBUG: Removed rejected request from localStorage:', requestId);
          }
        }
        
        // Update local state immediately
        setIncomingRequests(prev => prev.filter(req => req.request_id !== requestId && req.id !== requestId));
        
        // Always re-fetch to ensure state is up-to-date
        const res = await authenticatedFetch(`${API_ENDPOINTS.FRIEND_REQUESTS}incoming/?user_id=${user.id}`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });
        if (res.ok) {
          const data = await res.json();
          const pendingRequests = data.filter(req => req.status === 'pending');
          setIncomingRequests(pendingRequests);
          
          // Update localStorage with fresh data
          if (user.id) {
            localStorage.setItem(`incomingRequests_${user.id}`, JSON.stringify(pendingRequests));
          }
        }
      }
    } catch (e) {
      console.error('Error rejecting request:', e);
    }
  };

  // Add a separate effect to log when incomingRequests changes
  useEffect(() => {
    console.log('🔍 DEBUG: incomingRequests state changed to:', incomingRequests);
    console.log('🔍 DEBUG: incomingRequests.length:', incomingRequests.length);
  }, [incomingRequests]);

  // Add a separate effect to log when friends state changes
  useEffect(() => {
    console.log('🔍 DEBUG: friends state changed to:', [...friends]);
    console.log('🔍 DEBUG: friends.size:', friends.size);
  }, [friends]);

  // Add a safeguard to prevent clearing incomingRequests when user changes
  useEffect(() => {
    if (user && user.id) {
      console.log('🔍 DEBUG: User changed to:', user.id);
      console.log('🔍 DEBUG: Current incomingRequests:', incomingRequests);
      console.log('🔍 DEBUG: Current friends:', [...friends]);
    }
  }, [user]);

  // Fetch friends list on mount and after approve
  useEffect(() => {
    const fetchFriends = async () => {
      if (!user || !user.id) {
        console.log('🔍 DEBUG: No user or user.id, skipping friends fetch');
        return;
      }
      
      console.log('🔍 DEBUG: Fetching friends for user ID:', user.id);
      console.log('🔍 DEBUG: User object:', user);
      
      try {
        const friendsUrl = `${API_ENDPOINTS.FRIEND_REQUESTS}my_friends/?user_id=${user.id}`;
        console.log('🔍 DEBUG: Calling friends endpoint:', friendsUrl);
        
        const response = await authenticatedFetch(friendsUrl, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });
        
        console.log('🔍 DEBUG: Friends response status:', response.status);
        console.log('🔍 DEBUG: Friends response headers:', response.headers);
        
        if (response.ok) {
          const data = await response.json();
          console.log('🔍 DEBUG: Friends response data:', data);
          console.log('🔍 DEBUG: Friends data type:', typeof data);
          console.log('🔍 DEBUG: Friends data is array:', Array.isArray(data));
          
          if (Array.isArray(data)) {
            const friendIds = data.map(friend => friend.id);
            console.log('🔍 DEBUG: Extracted friend IDs:', friendIds);
            setFriends(new Set(friendIds));
            console.log('🔍 DEBUG: Friends set updated to:', friendIds);
          } else {
            console.warn('🔍 DEBUG: Friends response is not an array:', data);
            setFriends(new Set());
          }
        } else {
          console.error('🔍 DEBUG: Friends response not OK:', response.status);
          const errorText = await response.text();
          console.error('🔍 DEBUG: Friends error response:', errorText);
        }
      } catch (e) {
        console.error('🔍 DEBUG: Error fetching friends:', e);
        console.error('🔍 DEBUG: Error details:', {
          message: e.message,
          stack: e.stack,
          name: e.name
        });
      }
    };
    
    console.log('🔍 DEBUG: fetchFriends useEffect triggered');
    fetchFriends();
  }, [user]);

  // Backend ve localStorage pendinglerini birleştir
  useEffect(() => {
    if (user) {
      const stored = localStorage.getItem(`friendRequests_${user.id}`);
      const localPending = stored ? new Set(JSON.parse(stored)) : new Set();
      const backendPending = new Set(incomingRequests.map(req => req.sender_id));
      const merged = new Set([...localPending, ...backendPending]);
      setFriendRequests(merged);
    }
  }, [user, incomingRequests]);

  // Only show pending requests that exist in backend
  useEffect(() => {
    const syncPendingWithBackend = async () => {
      if (!user || !user.id) return;
      try {
        const response = await authenticatedFetch(`${API_ENDPOINTS.FRIEND_REQUESTS}incoming/?user_id=${user.id}`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });
        if (response.ok) {
          const data = await response.json();
          const backendIds = new Set(data.map(r => r.id));
          setIncomingRequests(prev => {
            const filtered = prev.filter(r => backendIds.has(r.id));
            return filtered;
          });
        }
      } catch (e) {
        // ignore
      }
    };
    syncPendingWithBackend();
  }, [user]);

  const handleAddFriend = async (userId) => {
    if (!user) {
      alert('Please log in to send friend requests');
      return;
    }

    // Pending state’i hemen ekle (optimistic UI)
    const newFriendRequests = new Set([...friendRequests, userId]);
    setFriendRequests(newFriendRequests);
    localStorage.setItem(`friendRequests_${user.id}`, JSON.stringify([...newFriendRequests]));

    try {
      const response = await authenticatedFetch(API_ENDPOINTS.FRIEND_REQUESTS, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sender: user.id,
          receiver: userId
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        // Sadece “already exists” hatasında pending’i silme!
        if (!errorText.includes('already exists')) {
          // Diğer hatalarda pending’i kaldır
          const updatedFriendRequests = new Set(friendRequests);
          updatedFriendRequests.delete(userId);
          setFriendRequests(updatedFriendRequests);
          localStorage.setItem(`friendRequests_${user.id}`, JSON.stringify([...updatedFriendRequests]));
        }
        throw new Error(`HTTP error! status: ${response.status}. Response: ${errorText}`);
      }
      // Başarılıysa zaten pending olarak kalacak
    } catch (error) {
      alert(`Failed to send friend request: ${error.message}`);
    }
  };

  const handlePendingBadgeClick = () => {
    // Scroll to incoming requests section or highlight them
    const incomingSection = document.getElementById('incoming-requests-section');
    if (incomingSection) {
      incomingSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Add a temporary highlight effect
      incomingSection.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
      setTimeout(() => {
        incomingSection.style.backgroundColor = '';
      }, 2000);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    setError('');

    try {
      console.log('Fetching users from Django backend...');
      
      const response = await authenticatedFetch(API_ENDPOINTS.USERS, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Users data received:', data);
      console.log('User names and usernames:', data.map(user => ({ 
        id: user.id, 
        name: user.name, 
        username: user.username, 
        email: user.email 
      })));
      
      if (data && Array.isArray(data)) {
        setUsers(data);
      } else {
        console.error('Unexpected data format:', data);
        setError('Received unexpected data format from server.');
      }

      // Also fetch friend requests and friends data
      await fetchFriendData();

    } catch (error) {
      console.error('Error fetching users:', error);
      
      if (error.response) {
        console.error('Error response data:', error.response.data);
        console.error('Error response status:', error.response.status);
        setError(`Server error: ${error.response.status} - ${error.response.data?.message || 'Unknown error'}`);
      } else if (error.request) {
        console.error('No response received:', error.request);
        setError('No response from server. Please check if the backend is running.');
      } else {
        console.error('Error setting up request:', error.message);
        setError(`Request error: ${error.message}`);
      }

      // Fallback to dummy data for demo
      console.log('Using fallback dummy data...');
      const dummyUsers = [
        { id: 1, name: 'Ahmet Yılmaz', email: 'ahmet.yilmaz@email.com' },
        { id: 2, name: 'Fatma Demir', email: 'fatma.demir@email.com' },
        { id: 3, name: 'Mehmet Kaya', email: 'mehmet.kaya@email.com' },
        { id: 4, name: 'Ayşe Özkan', email: 'ayse.ozkan@email.com' },
        { id: 5, name: 'Ali Çelik', email: 'ali.celik@email.com' },
        { id: 6, name: 'Zeynep Arslan', email: 'zeynep.arslan@email.com' }
      ];
      setUsers(dummyUsers);
      
      // Simulate some existing friends and pending requests
      setFriends(new Set([1, 3]));
      setFriendRequests(new Set([2]));
    } finally {
      setLoading(false);
    }
  };

  const fetchFriendData = async () => {
    try {
      // Fetch friend requests - get all requests where current user is the sender
      const requestsResponse = await authenticatedFetch(`${API_ENDPOINTS.FRIEND_REQUESTS}?user_id=${user.id}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (requestsResponse.ok) {
        const requestsData = await requestsResponse.json();
        console.log('Friend requests data:', requestsData);
        
        // Extract user IDs from pending requests where current user is the sender
        const pendingUserIds = requestsData
          .filter(request => request.status === 'pending' && request.sender === user.id)
          .map(request => request.receiver);
        
        console.log('Pending friend requests:', pendingUserIds);
        
        // Merge with existing localStorage data to ensure persistence
        const existingRequests = new Set(friendRequests);
        const newRequests = new Set(pendingUserIds);
        const mergedRequests = new Set([...existingRequests, ...newRequests]);
        
        setFriendRequests(mergedRequests);
        
        // Update localStorage with merged data
        if (user) {
          localStorage.setItem(`friendRequests_${user.id}`, JSON.stringify([...mergedRequests]));
        }
      }

      // Fetch friends list
      const friendsResponse = await authenticatedFetch(`${API_ENDPOINTS.FRIEND_REQUESTS}my_friends/?user_id=${user.id}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (friendsResponse.ok) {
        const friendsData = await friendsResponse.json();
        console.log('🔍 DEBUG: fetchFriendData - Friends response data:', friendsData);
        console.log('🔍 DEBUG: fetchFriendData - Friends data type:', typeof friendsData);
        console.log('🔍 DEBUG: fetchFriendData - Friends data is array:', Array.isArray(friendsData));
        
        if (Array.isArray(friendsData)) {
          // Extract friend user IDs
          const friendUserIds = friendsData.map(friend => friend.id);
          console.log('🔍 DEBUG: fetchFriendData - Extracted friend IDs:', friendUserIds);
          setFriends(new Set(friendUserIds));
          console.log('🔍 DEBUG: fetchFriendData - Friends set updated to:', friendUserIds);
        } else {
          console.warn('🔍 DEBUG: fetchFriendData - Friends response is not an array:', friendsData);
          setFriends(new Set());
        }
      } else {
        console.error('🔍 DEBUG: fetchFriendData - Friends response not OK:', friendsResponse.status);
        const errorText = await friendsResponse.text();
        console.error('🔍 DEBUG: fetchFriendData - Friends error response:', errorText);
      }

    } catch (error) {
      console.error('Error fetching friend data:', error);
      // Keep existing localStorage data if API calls fail
    }
  };

  const getFriendStatus = (userId) => {
    if (friends.has(userId)) {
      return { status: 'friends', text: 'Friends', className: 'friends' };
    } else if (friendRequests.has(userId)) {
      return { status: 'pending', text: 'Pending', className: 'pending' };
    } else {
      return { status: 'add', text: 'Add Friend', className: 'add-friend' };
    }
  };

  const isCurrentUser = (userId) => {
    return user && user.id === userId;
  };

  if (loading) {
    return (
      <div className="friend-list-page">
        <div className="friend-list-container">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading users...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="friend-list-page">
        <div className="friend-list-container">
          <div className="error-container">
            <h2>Error Loading Users</h2>
            <p className="error-message">{error}</p>
            <div className="debug-info">
              <p><strong>Debug Info:</strong></p>
              <p>• Backend URL: /api/users/ (via Vite proxy)</p>
              <p>• Check if Django backend is running on port 8000</p>
              <p>• Check browser console for detailed error logs</p>
            </div>
            <button onClick={fetchUsers} className="retry-button">
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Filter out current user from the list
  const filteredUsers = users.filter(userItem => !isCurrentUser(userItem.id));

  return (
    <div className="friend-list-page">
      <div className="friend-list-container">
        <div className="friend-list-header">
          <div className="header-title-container">
            <h1>Find Friends</h1>
            {/* Pending badge removed from here; only shown in Navbar */}
          </div>
          <p>Connect with other investors and share insights together.</p>
        </div>

        {pendingLoading ? (
          <div className="loading-container"><div className="loading-spinner"></div>Loading pending requests...</div>
        ) : (
          incomingRequests.length > 0 && (
            <div id="incoming-requests-section" className="incoming-requests-box">
              <h3>Pending Friend Requests ({incomingRequests.length})</h3>
              {incomingRequests.map(req => (
                <div key={req.id} className="incoming-request-item">
                  <div className="incoming-request-info">
                    <div className="incoming-request-avatar">
                      {(req.from_user_name || req.from_user_username) ? 
                        (req.from_user_name || req.from_user_username).charAt(0).toUpperCase() : 
                        (req.from_user_email ? req.from_user_email.charAt(0).toUpperCase() : 'U')}
                    </div>
                    <div className="incoming-request-details">
                      <p className="incoming-request-text">
                        <strong>{req.from_user_name || req.from_user_username || 'Unknown User'}</strong> wants to add you as a friend.
                      </p>
                      {req.created_at && (
                        <p className="incoming-request-date">
                          Requested on {new Date(req.created_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="incoming-request-actions">
                    <button 
                      onClick={() => {
                        console.log('[FriendList] Approve button clicked for request:', req.request_id || req.id);
                        handleApprove(req.request_id || req.id);
                      }}
                      className="approve-request-button"
                    >
                      Approve
                    </button>
                    <button 
                      onClick={() => {
                        console.log('[FriendList] Reject button clicked for request:', req.request_id || req.id);
                        handleReject(req.request_id || req.id);
                      }}
                      className="reject-request-button"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {filteredUsers.length === 0 ? (
          <div className="empty-friends">
            <h2>No users found</h2>
            <p>There are no other users to connect with at the moment.</p>
            <p>Check if your Django backend is running and has users in the database.</p>
          </div>
        ) : (
          <div className="friend-list">
            {filteredUsers.map((userItem) => {
              const friendStatus = getFriendStatus(userItem.id);
              const isFriend = friends.has(userItem.id);
              
              // Always show message icon for friends, never show Add Friend for them
              return (
                <div key={userItem.id} className="friend-item">
                  <div className="friend-info">
                    <div className="friend-avatar">
                      {(userItem.name || userItem.username) ? 
                        (userItem.name || userItem.username).charAt(0).toUpperCase() : 
                        (userItem.email ? userItem.email.charAt(0).toUpperCase() : 'U')}
                    </div>
                    <div className="friend-details">
                      <h3 className="friend-name">{userItem.name || userItem.username || 'Unknown User'}</h3>
                      <p className="friend-email">{userItem.email || 'No email'}</p>
                    </div>
                  </div>
                  <div className="friend-actions">
                    {isFriend ? (
                      <button
                        onClick={() => {
                          console.log('[FriendList] Message button clicked for:', userItem);
                          setActiveChat(userItem);
                        }}
                        className="message-friend-button"
                        title="Send message"
                      >
                        💬
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          console.log('[FriendList] Add friend button clicked for:', userItem.id);
                          handleAddFriend(userItem.id);
                        }}
                        disabled={friendStatus.status !== 'add'}
                        className={`friend-button ${friendStatus.className}`}
                      >
                        {friendStatus.text}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Active Chat MessageBox */}
      {activeChat && (
        <MessageBox
          friend={activeChat}
          onClose={() => setActiveChat(null)}
        />
      )}
    </div>
  );
};

export default FriendList; 