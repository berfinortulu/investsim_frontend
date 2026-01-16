import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FiTrendingUp, FiUser, FiLogOut, FiChevronDown, FiMessageCircle, FiBarChart2 } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import { useWallet } from '../contexts/WalletContext';
import { API_ENDPOINTS } from '../config';
import './Navbar.css';
import MessageBox from './MessageBox';
import { useChatVisit } from '../contexts/ChatVisitContext';

const Navbar = () => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { walletBalance } = useWallet();
  const { getTotalUnread } = useChatVisit();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [activeChatFriend, setActiveChatFriend] = useState(null);

  // Format wallet balance
  const formatWalletBalance = (balance) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(balance);
  };

  // Fetch only pending friend requests (incoming)
  const fetchPendingRequests = async () => {
    if (!user || !user.id) return;
    try {
      const response = await fetch(`${API_ENDPOINTS.FRIEND_REQUESTS}incoming/?user_id=${user.id}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      if (response.ok) {
        const data = await response.json();
        setPendingRequests(data.filter(req => req.status === 'pending'));
      }
    } catch (e) {
      console.error('Error fetching pending requests:', e);
    }
  };

  // Fetch on mount and when user changes
  useEffect(() => {
    fetchPendingRequests();
  }, [user]);

  // Handle clicking outside dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    setShowDropdown(false);
  };

  // Approve/Reject handlers that keep dropdown open and re-fetch
  const handleApprove = async (requestId) => {
    try {
      const response = await fetch(`${API_ENDPOINTS.FRIEND_REQUESTS}${requestId}/approve/?user_id=${user.id}`, {
        method: 'POST',
        headers: { 'Accept': 'application/json' }
      });
      if (response.ok) {
        await fetchPendingRequests(); // Re-fetch after action
      }
    } catch (e) {
      console.error('Error approving request:', e);
    }
  };
  const handleReject = async (requestId) => {
    try {
      const response = await fetch(`${API_ENDPOINTS.FRIEND_REQUESTS}${requestId}/reject/?user_id=${user.id}`, {
        method: 'POST',
        headers: { 'Accept': 'application/json' }
      });
      if (response.ok) {
        await fetchPendingRequests(); // Re-fetch after action
      }
    } catch (e) {
      console.error('Error rejecting request:', e);
    }
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        {/* Left Section - Logo */}
        <div className="navbar-brand">
          <FiTrendingUp className="navbar-icon" />
          <Link to="/" className="navbar-logo">
            InvestSim
          </Link>
        </div>

        {/* Center Section - Navigation Links */}
        <ul className="navbar-nav">
          {['/', '/simulate', '/ml', '/portfolio', '/coin-game', '/friends'].map((path, idx) => (
            <li key={path} className="nav-item">
              {path === '/ml' ? (
                <span
                  className={`nav-link ${location.pathname === path || location.pathname === '/ml/predict' ? "active" : ""}`}
                  style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}
                >
                  {['Home', 'Simulate', 'ML Predict', 'Portfolio', 'Trade Coin', 'Friends'][idx]}
                </span>
              ) : (
                <Link
                  to={path}
                  className={`nav-link ${location.pathname === path ? "active" : ""}`}
                  style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
                >
                  {['Home', 'Simulate', 'ML Predict', 'Portfolio', 'Trade Coin', 'Friends'][idx]}
                </Link>
              )}
              {/* Friends badge */}
              {path === '/friends' && user && pendingRequests.length > 0 && (
                <span className="notification-badge" style={{ marginLeft: 6, position: 'relative', top: -8 }}>
                  {pendingRequests.length > 99 ? '99+' : pendingRequests.length}
                </span>
              )}
              {path === '/ml' && (
                <div className="dropdown-menu">
                  <Link to="/ml" className="dropdown-item">
                    <FiBarChart2 />
                    Data History
                  </Link>
                  <Link to="/predict-now" className="dropdown-item">
                    <FiTrendingUp />
                    Predict Now
                  </Link>
                </div>
              )}
            </li>
          ))}
          {user && (
            <li className="nav-item">
              <Link
                to="/news"
                className={`nav-link ${location.pathname === '/news' ? 'active' : ''}`}
                style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
              >
                News
              </Link>
            </li>
          )}
          {/* Admin Panel Link - Only for staff users */}
          {user?.is_staff && (
            <li className="nav-item">
              <Link
                to="/admin"
                className={`nav-link ${location.pathname === '/admin' ? "active" : ""}`}
              >
                Admin Panel
              </Link>
            </li>
          )}
        </ul>

        {/* Right Section - Profile and Button */}
        <div className="navbar-right">
          {!user ? (
            <>
              <Link to="/signup" className="navbar-button">
                Get Started
              </Link>
              <Link to="/login" className="navbar-profile">
                <FiUser />
              </Link>
            </>
          ) : (
            <>
              {/* Wallet Badge */}
              <div className="wallet-badge">
                <span className="wallet-label">INV:</span>
                <span className="wallet-amount">{formatWalletBalance(walletBalance)}</span>
              </div>
              
              <div className="navbar-profile-container" ref={dropdownRef}>
                <button 
                  className="navbar-profile"
                  onMouseEnter={() => setShowDropdown(true)}
                  onMouseLeave={() => {
                    // Small delay to allow moving to dropdown
                    setTimeout(() => {
                      if (!dropdownRef.current?.matches(':hover')) {
                        setShowDropdown(false);
                      }
                    }, 100);
                  }}
                >
                  <FiUser />
                </button>
                {showDropdown && (
                  <div 
                    className={`profile-dropdown ${showDropdown ? 'show' : ''}`}
                    onMouseEnter={() => setShowDropdown(true)}
                    onMouseLeave={() => setShowDropdown(false)}
                  >
                    <div className="dropdown-header">
                      <div className="user-info">
                        <div className="user-name">{user.name || user.username}</div>
                        {user.email && <div className="user-email">{user.email}</div>}
                      </div>
                    </div>
                    <div className="dropdown-divider"></div>
                    <button 
                      className="dropdown-item logout-button"
                      onClick={handleLogout}
                    >
                      <FiLogOut />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      {/* MessageBox for chat with a friend */}
      {activeChatFriend && (
        <MessageBox friend={activeChatFriend} onClose={() => setActiveChatFriend(null)} />
      )}
    </nav>
  );
};

export default Navbar; 