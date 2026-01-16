import React, { useState } from 'react';
import './MLPredictPage.css';

const MLPredictPage = () => {
  const [selectedAsset, setSelectedAsset] = useState('');
  const [predictionResult, setPredictionResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const assets = [
    { value: 'BTC', label: 'Bitcoin (BTC)' },
    { value: 'ETH', label: 'Ethereum (ETH)' },
    { value: 'AAPL', label: 'Apple Inc. (AAPL)' },
    { value: 'GOOGL', label: 'Alphabet Inc. (GOOGL)' },
    { value: 'TSLA', label: 'Tesla Inc. (TSLA)' },
    { value: 'MSFT', label: 'Microsoft Corp. (MSFT)' },
    { value: 'AMZN', label: 'Amazon.com Inc. (AMZN)' },
    { value: 'NVDA', label: 'NVIDIA Corp. (NVDA)' }
  ];

  const handlePredict = () => {
    if (!selectedAsset) {
      alert('Please select an asset first');
      return;
    }

    setIsLoading(true);
    
    // Simulate ML prediction delay
    setTimeout(() => {
      const isUp = Math.random() > 0.4; // 60% chance of UP
      const probability = Math.floor(Math.random() * 30) + 65; // 65-95% probability
      
      setPredictionResult({
        asset: selectedAsset,
        direction: isUp ? 'UP' : 'DOWN',
        probability: probability,
        confidence: probability > 80 ? 'HIGH' : probability > 70 ? 'MEDIUM' : 'LOW'
      });
      
      setIsLoading(false);
    }, 2000);
  };

  return (
    <div className="mlpredict-page">
      <div className="mlpredict-container">
        <div className="mlpredict-layout">
          {/* Left Column - Prediction Panel */}
          <div className="prediction-panel">
            <div className="panel-header">
              <h1 className="mlpredict-title">ML Price Prediction</h1>
              <p className="mlpredict-subtitle">Get AI-powered predictions for tomorrow's market trends</p>
            </div>
            
            <div className="mlpredict-form">
              <div className="form-group">
                <label htmlFor="asset-select">Select Asset:</label>
                <select
                  id="asset-select"
                  value={selectedAsset}
                  onChange={(e) => setSelectedAsset(e.target.value)}
                  className="form-input"
                >
                  <option value="">Choose an asset...</option>
                  {assets.map(asset => (
                    <option key={asset.value} value={asset.value}>
                      {asset.label}
                    </option>
                  ))}
                </select>
              </div>

              <button 
                onClick={handlePredict}
                className="predict-button"
                disabled={isLoading}
              >
                {isLoading ? 'Analyzing...' : 'Predict Tomorrow\'s Trend'}
              </button>
            </div>

            {isLoading && (
              <div className="loading-section">
                <div className="loading-spinner"></div>
                <p>Running ML analysis...</p>
              </div>
            )}

            {predictionResult && !isLoading && (
              <div className="prediction-result">
                <h2>Prediction Result</h2>
                <div className="prediction-card">
                  <div className="prediction-header">
                    <span className="asset-name">{predictionResult.asset}</span>
                    <span className={`prediction-direction ${predictionResult.direction.toLowerCase()}`}>
                      {predictionResult.direction}
                    </span>
                  </div>
                  <div className="prediction-details">
                    <p className="probability-text">
                      Probability: <span className="probability-value">{predictionResult.probability}%</span>
                    </p>
                    <p className="confidence-text">
                      Confidence: <span className={`confidence-level ${predictionResult.confidence.toLowerCase()}`}>
                        {predictionResult.confidence}
                      </span>
                    </p>
                  </div>
                  <div className="prediction-explanation">
                    <p>Based on historical data, technical indicators, and market sentiment analysis.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Info Panel */}
          <div className="info-panel">
            <div className="panel-header">
              <div className="mlpredict-header-image">
                <img 
                  src="/caricature.jpg" 
                  alt="ML Prediction Illustration" 
                  className="header-caricature"
                />
              </div>
            </div>
            
            <div className="ml-info">
              <h3>How it works</h3>
              <div className="info-grid">
                <div className="info-item">
                  <h4>Technical Analysis</h4>
                  <p>Analyzes price patterns, moving averages, and volume data to identify market trends and potential reversal points.</p>
                  <div className="subtitle">Pattern Recognition</div>
                </div>
                <div className="info-item">
                  <h4>Machine Learning</h4>
                  <p>Uses neural networks trained on historical market data to predict future price movements with high accuracy.</p>
                  <div className="subtitle">AI-Powered Predictions</div>
                </div>
                <div className="info-item">
                  <h4>Sentiment Analysis</h4>
                  <p>Processes news, social media, and market sentiment to understand the broader market context and investor psychology.</p>
                  <div className="subtitle">Market Sentiment</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MLPredictPage; 





