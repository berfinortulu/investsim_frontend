import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './HomePage.css';

const HomePage = () => {
  const { user } = useAuth();

  return (
    <div className="homepage">
      <div className="homepage-overlay"></div>
      <div className="homepage-content-wrapper">
        <div className="homepage-content">
          <h1 className="homepage-title">
            InvestSim: Virtual Investment Simulator
          </h1>
          <p className="homepage-subtitle">
            Explore what would have happened if you invested earlier.
          </p>
          <div className="homepage-buttons">
            {user ? (
              // Logged in user - show main features
              <>
                <Link to="/simulate" className="homepage-button">
                  Start Simulation
                </Link>
                <Link to="/predict-now" className="homepage-button secondary">
                  ML Predictions
                </Link>
                <Link to="/portfolio" className="homepage-button secondary">
                  My Portfolio
                </Link>
              </>
            ) : (
              // Not logged in - show signup/login options
              <>
                <Link to="/signup" className="homepage-button">
                  Get Started
                </Link>
                <Link to="/login" className="homepage-button secondary">
                  Sign In
                </Link>
                <div className="homepage-info">
                  <p>Create an account to access all features</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage; 