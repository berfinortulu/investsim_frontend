import React, { useState, useRef, useEffect } from 'react';
import { FiMessageCircle } from 'react-icons/fi';
import MessageBox from './MessageBox';
import './FloatingMessagesButton.css';
import { useAuth } from '../contexts/AuthContext';
import { useChatVisit } from '../contexts/ChatVisitContext';
import { useWebSocket } from '../contexts/WebSocketContext';

const FloatingMessagesButton = () => {
  const { user, authenticatedFetch } = useAuth();
  const { unreadCounts, getTotalUnread, markFriendClicked, countGreyDoubleTicks } = useChatVisit();
  const [showPopup, setShowPopup] = useState(false);
  const [activeChatFriend, setActiveChatFriend] = useState(null);
  const { onlineUsers: contextOnlineUsers } = useWebSocket();
  const [acceptedFriends, setAcceptedFriends] = useState([]);
  const [friendsWithMessages, setFriendsWithMessages] = useState({});
  const popupRef = useRef(null);

  // Fetch accepted friends
  useEffect(() => {
    if (!user?.id) {
      console.log('🔍 DEBUG: FloatingMessagesButton - No user or user.id, skipping friends fetch');
      return;
    }
    
    console.log('🔍 DEBUG: FloatingMessagesButton - Fetching friends for user ID:', user.id);
    console.log('🔍 DEBUG: FloatingMessagesButton - User object:', user);
    
    const fetchFriends = async () => {
      try {
        const friendsUrl = `/api/friend-requests/my_friends/?user_id=${user.id}`;
        console.log('🔍 DEBUG: FloatingMessagesButton - Calling friends endpoint:', friendsUrl);
        
        const response = await authenticatedFetch(friendsUrl, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });
        
        console.log('🔍 DEBUG: FloatingMessagesButton - Friends response status:', response.status);
        console.log('🔍 DEBUG: FloatingMessagesButton - Friends response headers:', response.headers);
        
        if (response.ok) {
          const data = await response.json();
          console.log('🔍 DEBUG: FloatingMessagesButton - Friends response data:', data);
          console.log('🔍 DEBUG: FloatingMessagesButton - Friends data type:', typeof data);
          console.log('🔍 DEBUG: FloatingMessagesButton - Friends data is array:', Array.isArray(data));
          console.log('🔍 DEBUG: FloatingMessagesButton - Friends data length:', Array.isArray(data) ? data.length : 'N/A');
          
          // Normalize: backend may return objects like { friend: {id, ...} } or direct user objects
          const normalized = Array.isArray(data) ? data.map(f => (f && (f.friend || f.user || f))) : [];
          const withIds = normalized.filter(f => f && (typeof f.id === 'number' || typeof f.id === 'string'));
          setAcceptedFriends(withIds);
          console.log('🔍 DEBUG: FloatingMessagesButton - acceptedFriends normalized:', withIds);
          
          // Fetch messages for each friend to calculate grey double ticks
          await fetchMessagesForFriends(withIds);
        } else {
          console.error('🔍 DEBUG: FloatingMessagesButton - Friends response not OK:', response.status);
          const errorText = await response.text();
          console.error('🔍 DEBUG: FloatingMessagesButton - Friends error response:', errorText);
        }
      } catch (e) {
        console.error('🔍 DEBUG: FloatingMessagesButton - Error fetching friends:', e);
        console.error('🔍 DEBUG: FloatingMessagesButton - Error details:', {
          message: e.message,
          stack: e.stack,
          name: e.name
        });
      }
    };
    
    console.log('🔍 DEBUG: FloatingMessagesButton - fetchFriends useEffect triggered');
    fetchFriends();
  }, [user]);

  // Fetch messages for each friend to calculate grey double ticks count
  const fetchMessagesForFriends = async (friends) => {
    if (!user?.id || !friends) return;
    
    const friendsMessages = {};
    
    for (const friend of friends) {
      try {
        const response = await authenticatedFetch(`/api/messages/?friend_id=${friend.id}`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });
        
        if (response.ok) {
          const messages = await response.json();
          friendsMessages[friend.id] = messages;
          
          // Calculate grey double ticks count for this friend
          const greyTicksCount = countGreyDoubleTicks(friend.id, messages);
          if (greyTicksCount > 0) {
            console.log(`[FloatingMessagesButton] Friend ${friend.username || friend.name} has ${greyTicksCount} grey double ticks`);
          }
        }
      } catch (e) {
        console.error(`Error fetching messages for friend ${friend.id}:`, e);
      }
    }
    
    setFriendsWithMessages(friendsMessages);
  };

  // Refresh grey double ticks count periodically to keep it updated
  useEffect(() => {
    if (acceptedFriends.length > 0) {
      const interval = setInterval(() => {
        fetchMessagesForFriends(acceptedFriends);
      }, 5000); // Refresh every 5 seconds
      
      return () => clearInterval(interval);
    }
  }, [acceptedFriends, user?.id]);

  // Refresh grey double ticks count when messages change
  const refreshGreyTicksCount = () => {
    if (acceptedFriends.length > 0) {
      fetchMessagesForFriends(acceptedFriends);
    }
  };

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

  const isFriendOnline = (friend) => {
    const tokens = getIdentifierTokens(friend);
    return tokens.some((t) => (contextOnlineUsers || new Set()).has(String(t)));
  };

  // Don't render if user is not authenticated
  if (!user) {
    return null;
  }

  return (
    <>
      <div className={`floating-messages-button-container ${activeChatFriend ? 'hidden' : ''}`}>
        <button
          className="floating-messages-button"
          onMouseEnter={() => setShowPopup(true)}
          aria-label="Mesajlar"
        >
          <FiMessageCircle size={36} />
          {/* Show total unread messages badge */}
          {getTotalUnread() > 0 && (
            <span className="floating-messages-badge">
              {getTotalUnread() > 99 ? '99+' : getTotalUnread()}
            </span>
          )}
          {/* Show total grey double ticks badge */}
          {(() => {
            let totalGreyTicks = 0;
            acceptedFriends.forEach(friend => {
              const messages = friendsWithMessages[friend.id] || [];
              totalGreyTicks += countGreyDoubleTicks(friend.id, messages);
            });
            
            if (totalGreyTicks > 0) {
              return (
                <span className="floating-messages-grey-ticks-badge">
                  {totalGreyTicks > 99 ? '99+' : totalGreyTicks}
                </span>
              );
            }
            return null;
          })()}
        </button>
        {showPopup && (
          <div 
            className="floating-messages-popup" 
            ref={popupRef}
            onMouseEnter={() => setShowPopup(true)}
            onMouseLeave={() => setShowPopup(false)}
          >
            {acceptedFriends.length === 0 ? (
              <div className="floating-messages-empty">
                {console.log('🔍 DEBUG: FloatingMessagesButton - Rendering "No friends yet" message')}
                {console.log('🔍 DEBUG: FloatingMessagesButton - acceptedFriends state:', acceptedFriends)}
                {console.log('🔍 DEBUG: FloatingMessagesButton - acceptedFriends.length:', acceptedFriends.length)}
                No friends yet.
              </div>
            ) : (
              <ul className="floating-messages-list">
                {acceptedFriends.map(friend => (
                  <li
                    key={friend.id}
                    className="floating-messages-list-item"
                    onClick={() => { 
                      // Don't mark own profile as clicked
                      if (friend.id !== user.id) {
                        markFriendClicked(friend.id);
                      }
                      setActiveChatFriend(friend); 
                      setShowPopup(false); 
                    }}
                  >
                    <span className={`online-status-dot ${isFriendOnline(friend) ? 'online' : ''}`}></span>
                    <span className="friend-name">
                      {friend.username || friend.name || 'Unknown User'}
                    </span>
                    {/* Show grey double ticks count for this friend */}
                    {(() => {
                      const messages = friendsWithMessages[friend.id] || [];
                      const greyTicksCount = countGreyDoubleTicks(friend.id, messages);
                      
                      if (greyTicksCount > 0) {
                        return (
                          <span className="grey-ticks-badge">
                            {greyTicksCount > 99 ? '99+' : greyTicksCount}
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      {activeChatFriend && (
        <MessageBox friend={activeChatFriend} onClose={() => setActiveChatFriend(null)} />
      )}
    </>
  );
};

export default FloatingMessagesButton; 