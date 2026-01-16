import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { API_ENDPOINTS } from '../config';
import './AuthPages.css';

const LoginPage = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const from = location.state?.from?.pathname || '/';
  const isRedirected = location.state?.from;

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(API_ENDPOINTS.LOGIN, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password
        })
      });

      const data = await response.json();

      console.log('=== LOGIN DEBUG ===');
      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);
      console.log('Response data:', data);
      console.log('Data keys:', Object.keys(data));
      console.log('Token in response:', data.token);
      console.log('Token type:', typeof data.token);
      console.log('Token length:', data.token ? data.token.length : 0);
      console.log('=== END LOGIN DEBUG ===');

      if (!response.ok) {
        setError(data.error || 'Login failed. Please check your credentials.');
      } else {
        // Store user data and token - match the structure from SignupPage
        const userData = {
          id: data.user_id,
          username: data.username,
          name: data.username, // Use username as display name for now
          token: data.token
        };
        
        // Debug: Check if token exists
        console.log('Login response data:', data);
        console.log('User data to be stored:', userData);
        console.log('Token exists:', !!data.token);
        console.log('Token value:', data.token);
        
        login(userData);
        navigate(from, { replace: true });
      }
    } catch (err) {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-card">
          <h1 className="auth-title">Welcome Back</h1>
          <p className="auth-subtitle">Sign in to your account</p>
          
          {isRedirected && (
            <div className="auth-info">
              Please log in to continue.
            </div>
          )}
          
          {error && <div className="auth-error">{error}</div>}
          
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
                className="form-input"
                placeholder="Enter your username"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                className="form-input"
                placeholder="Enter your password"
              />
            </div>
            
            <button 
              type="submit" 
              className="auth-button"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
          
          <div className="auth-footer">
            <p>
              Don't have an account?{' '}
              <Link to="/signup" className="auth-link">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage; 