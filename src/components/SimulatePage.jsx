import React, { useState, useEffect } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { API_ENDPOINTS } from '../config';
import './SimulatePage.css';

const SimulatePage = () => {
  const [selectedAsset, setSelectedAsset] = useState('');
  const [investmentDate, setInvestmentDate] = useState('');
  const [investmentAmount, setInvestmentAmount] = useState('');
  const [simulationResult, setSimulationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const { authenticatedFetch } = useAuth();

  // API Configuration
  const API_KEY = import.meta.env.VITE_FMP_API_KEY || 'demo'; // Get your key from https://site.financialmodelingprep.com/developer/docs
  const BASE_URL = 'https://financialmodelingprep.com/api/v3';

  // Fallback mock data for when API fails
  const mockHistoricalData = {
    'AAPL': [
      { date: '2024-01-01', price: 130 },
      { date: '2024-02-01', price: 135 },
      { date: '2024-03-01', price: 140 },
      { date: '2024-04-01', price: 145 },
      { date: '2024-05-01', price: 150 },
      { date: '2024-06-01', price: 155 },
      { date: '2024-07-01', price: 160 },
      { date: '2024-08-01', price: 165 },
      { date: '2024-09-01', price: 145 },
      { date: '2024-10-01', price: 170 },
      { date: '2024-11-01', price: 175 },
      { date: '2024-12-01', price: 182 }
    ],
    'GOOGL': [
      { date: '2024-01-01', price: 2600 },
      { date: '2024-02-01', price: 2650 },
      { date: '2024-03-01', price: 2700 },
      { date: '2024-04-01', price: 2750 },
      { date: '2024-05-01', price: 2800 },
      { date: '2024-06-01', price: 2850 },
      { date: '2024-07-01', price: 2900 },
      { date: '2024-08-01', price: 2950 },
      { date: '2024-09-01', price: 2800 },
      { date: '2024-10-01', price: 3000 },
      { date: '2024-11-01', price: 3100 },
      { date: '2024-12-01', price: 3200 }
    ],
    'TSLA': [
      { date: '2024-01-01', price: 200 },
      { date: '2024-02-01', price: 210 },
      { date: '2024-03-01', price: 215 },
      { date: '2024-04-01', price: 220 },
      { date: '2024-05-01', price: 225 },
      { date: '2024-06-01', price: 230 },
      { date: '2024-07-01', price: 235 },
      { date: '2024-08-01', price: 240 },
      { date: '2024-09-01', price: 220 },
      { date: '2024-10-01', price: 250 },
      { date: '2024-11-01', price: 265 },
      { date: '2024-12-01', price: 280 }
    ],
    'MSFT': [
      { date: '2024-01-01', price: 300 },
      { date: '2024-02-01', price: 305 },
      { date: '2024-03-01', price: 310 },
      { date: '2024-04-01', price: 315 },
      { date: '2024-05-01', price: 320 },
      { date: '2024-06-01', price: 325 },
      { date: '2024-07-01', price: 330 },
      { date: '2024-08-01', price: 335 },
      { date: '2024-09-01', price: 320 },
      { date: '2024-10-01', price: 340 },
      { date: '2024-11-01', price: 360 },
      { date: '2024-12-01', price: 380 }
    ],
    'AMZN': [
      { date: '2024-01-01', price: 3000 },
      { date: '2024-02-01', price: 3050 },
      { date: '2024-03-01', price: 3100 },
      { date: '2024-04-01', price: 3150 },
      { date: '2024-05-01', price: 3200 },
      { date: '2024-06-01', price: 3250 },
      { date: '2024-07-01', price: 3300 },
      { date: '2024-08-01', price: 3350 },
      { date: '2024-09-01', price: 3200 },
      { date: '2024-10-01', price: 3400 },
      { date: '2024-11-01', price: 3600 },
      { date: '2024-12-01', price: 3800 }
    ],
    'NVDA': [
      { date: '2024-01-01', price: 400 },
      { date: '2024-02-01', price: 420 },
      { date: '2024-03-01', price: 440 },
      { date: '2024-04-01', price: 460 },
      { date: '2024-05-01', price: 480 },
      { date: '2024-06-01', price: 500 },
      { date: '2024-07-01', price: 520 },
      { date: '2024-08-01', price: 540 },
      { date: '2024-09-01', price: 450 },
      { date: '2024-10-01', price: 580 },
      { date: '2024-11-01', price: 620 },
      { date: '2024-12-01', price: 650 }
    ],
    'BTC': [
      { date: '2024-01-01', price: 660000 },
      { date: '2024-02-01', price: 705000 },
      { date: '2024-03-01', price: 735000 },
      { date: '2024-04-01', price: 780000 },
      { date: '2024-05-01', price: 840000 },
      { date: '2024-06-01', price: 900000 },
      { date: '2024-07-01', price: 960000 },
      { date: '2024-08-01', price: 1050000 },
      { date: '2024-09-01', price: 750000 },
      { date: '2024-10-01', price: 1140000 },
      { date: '2024-11-01', price: 1200000 },
      { date: '2024-12-01', price: 1260000 }
    ],
    'ETH': [
      { date: '2024-01-01', price: 42000 },
      { date: '2024-02-01', price: 45000 },
      { date: '2024-03-01', price: 46500 },
      { date: '2024-04-01', price: 49500 },
      { date: '2024-05-01', price: 52500 },
      { date: '2024-06-01', price: 55500 },
      { date: '2024-07-01', price: 58500 },
      { date: '2024-08-01', price: 63000 },
      { date: '2024-09-01', price: 48000 },
      { date: '2024-10-01', price: 66000 },
      { date: '2024-11-01', price: 67500 },
      { date: '2024-12-01', price: 69000 }
    ]
  };

  const assets = [
    { value: 'AAPL', label: 'Apple Inc. (AAPL)', type: 'stock' },
    { value: 'GOOGL', label: 'Alphabet Inc. (GOOGL)', type: 'stock' },
    { value: 'TSLA', label: 'Tesla Inc. (TSLA)', type: 'stock' },
    { value: 'MSFT', label: 'Microsoft Corp. (MSFT)', type: 'stock' },
    { value: 'AMZN', label: 'Amazon.com Inc. (AMZN)', type: 'stock' },
    { value: 'NVDA', label: 'NVIDIA Corp. (NVDA)', type: 'stock' },
    { value: 'BTC', label: 'Bitcoin (BTC)', type: 'crypto' },
    { value: 'ETH', label: 'Ethereum (ETH)', type: 'crypto' }
  ];

  const formatDate = (dateStr) => {
    return dayjs(dateStr).format('MMM DD');
  };

  const formatPrice = (price) => {
    if (price >= 1000) {
      return `₺${(price / 1000).toFixed(1)}K`;
    }
    return `₺${price}`;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatNumber = (number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4
    }).format(number);
  };

  const fetchHistoricalData = async (symbol, fromDate, toDate) => {
    try {
      console.log(`Fetching data for ${symbol} from ${fromDate} to ${toDate}`);
      
      const response = await axios.get(`${BASE_URL}/historical-price-full/${symbol}`, {
        params: {
          from: fromDate,
          to: toDate,
          apikey: API_KEY
        },
        timeout: 10000 // 10 second timeout
      });

      console.log('API Response:', response.data);

      if (response.data && response.data.historical) {
        return response.data.historical.map(item => ({
          date: item.date,
          price: parseFloat(item.close)
        }));
      }
      
      // If no historical data in response, throw error to trigger fallback
      throw new Error('No historical data in API response');
      
    } catch (error) {
      console.error('Error fetching historical data:', error);
      
      // Check if we have mock data for this symbol
      if (mockHistoricalData[symbol]) {
        console.log('Using mock data as fallback');
        return mockHistoricalData[symbol];
      }
      
      throw new Error(`Failed to fetch data for ${symbol}. Using demo mode with limited functionality. Get a free API key from https://site.financialmodelingprep.com/developer/docs`);
    }
  };

  const saveToPortfolio = async () => {
    if (!simulationResult) {
      alert('No simulation to save');
      return;
    }

    setSaving(true);

    try {
      // Build chart series in ascending chronological order with close values
      const series = (simulationResult.chartData || []).map(p => ({ date: p.date, close: Number(p.price) }));
      const range_start = series.length > 0 ? series[0].date : simulationResult.investmentDate;
      const range_end = series.length > 0 ? series[series.length - 1].date : simulationResult.investmentDate;

      const payload = {
        asset_symbol: simulationResult.asset,
        investment_date: simulationResult.investmentDate,
        investment_amount: simulationResult.investmentAmount,
        current_value: simulationResult.currentValue,
        profit_loss: simulationResult.profitLoss,
        profit_loss_percentage: simulationResult.profitLossPercentage,
        units_bought: simulationResult.unitsBought,
        investment_price: simulationResult.investmentPrice,
        current_price: simulationResult.currentPrice,
        price_on_date: simulationResult.investmentPrice,
        total_profit: simulationResult.profitLoss,
        chart_series: series,
        chart_meta: {
          symbol: simulationResult.asset,
          range_start,
          range_end,
          currency: 'USD',
          source: 'yahoo'
        }
      };

      console.log('Sending payload to backend:', payload);

      const response = await authenticatedFetch(API_ENDPOINTS.SIMULATIONS, {
        method: 'POST',
        headers: {
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}. Server response: ${errorText}`);
      }

      const result = await response.json();
      console.log('Success response:', result);
      alert('Simulation saved successfully!');
    } catch (error) {
      console.error('Error saving simulation:', error);
      alert(`Failed to save simulation: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSimulate = async () => {
    if (!selectedAsset || !investmentDate || !investmentAmount) {
      setError('Please fill in all fields');
      return;
    }

    const amount = parseFloat(investmentAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setLoading(true);
    setError('');
    setSimulationResult(null);

    try {
      const selectedAssetData = assets.find(asset => asset.value === selectedAsset);
      if (!selectedAssetData) {
        throw new Error('Asset not found');
      }

      // Calculate date range for chart (6 months before investment date to today)
      const investmentDateObj = new Date(investmentDate);
      const chartStartDate = new Date(investmentDateObj);
      chartStartDate.setMonth(chartStartDate.getMonth() - 6);
      
      const today = new Date();
      const chartEndDate = today.toISOString().split('T')[0];

      // Fetch historical data for chart
      const historicalData = await fetchHistoricalData(
        selectedAssetData.value,
        chartStartDate.toISOString().split('T')[0],
        chartEndDate
      );

      if (historicalData.length === 0) {
        throw new Error('No historical data available for this asset');
      }

      // Find the price on investment date (or closest available date)
      const investmentDatePrice = historicalData.find(item => 
        item.date === investmentDate
      ) || historicalData[historicalData.length - 1];

      // Get current price (most recent data point)
      const currentPrice = historicalData[0].price;

      // Calculate simulation results
      const unitsBought = amount / investmentDatePrice.price;
      const currentValue = unitsBought * currentPrice;
      const profitLoss = currentValue - amount;
      const profitLossPercentage = ((profitLoss / amount) * 100);

      // Check if we're using mock data (for demo purposes)
      const isUsingMockData = mockHistoricalData[selectedAssetData.value] && 
        historicalData === mockHistoricalData[selectedAssetData.value];

      // Prepare chart data in ascending chronological order for display and saving
      const chartDataAsc = [...historicalData].reverse();

      setSimulationResult({
        asset: selectedAsset,
        assetLabel: selectedAssetData.label,
        investmentDate,
        investmentAmount: amount,
        investmentPrice: investmentDatePrice.price,
        currentPrice,
        unitsBought,
        currentValue,
        profitLoss,
        profitLossPercentage,
        chartData: chartDataAsc,
        isDemo: isUsingMockData
      });

      // Show info message if using demo data
      if (isUsingMockData) {
        setError('Demo mode: Using sample data. For real-time data, please get a free API key from https://site.financialmodelingprep.com/developer/docs and add it to your .env file as VITE_FMP_API_KEY=your_key_here');
      }

    } catch (error) {
      console.error('Simulation error:', error);
      setError(error.message || 'Failed to simulate investment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="simulate-page">
      <div className="simulate-container">
        <div className="simulate-layout">
          {/* Left Column - Simulation Panel */}
          <div className="simulation-panel">
            <div className="panel-header">
              <h1 className="simulate-title">Simulate Your Investment</h1>
              <p className="simulate-subtitle">See what would have happened if you invested earlier</p>
            </div>
            
            <div className="simulate-form">
              {error && (
                <div className={`error-message ${error.includes('Demo mode') ? 'demo-info' : ''}`}>
                  {error}
                </div>
              )}

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

              <div className="form-group">
                <label htmlFor="investment-date">Investment Date:</label>
                <input
                  type="date"
                  id="investment-date"
                  value={investmentDate}
                  onChange={(e) => setInvestmentDate(e.target.value)}
                  className="form-input"
                  max="2024-12-31"
                />
              </div>

              <div className="form-group">
                <label htmlFor="investment-amount">Investment Amount (TL):</label>
                <input
                  type="number"
                  id="investment-amount"
                  value={investmentAmount}
                  onChange={(e) => setInvestmentAmount(e.target.value)}
                  className="form-input"
                  placeholder="Enter amount in TL"
                  min="1"
                  step="0.01"
                />
              </div>

              <button 
                onClick={handleSimulate}
                className="simulate-button"
                disabled={loading}
              >
                {loading ? 'Simulating...' : 'Simulate Investment'}
              </button>
            </div>

            {simulationResult && (
              <div className="simulation-result">
                <h2>Simulation Results</h2>
                <div className="result-card">
                  <div className="result-header">
                    <h3>{simulationResult.assetLabel} Investment</h3>
                    <span className={`profit-loss-badge ${simulationResult.profitLoss >= 0 ? 'profit' : 'loss'}`}>
                      {simulationResult.profitLoss >= 0 ? '+' : ''}{formatCurrency(simulationResult.profitLoss)}
                    </span>
                  </div>
                  
                  <div className="result-details">
                    <div className="detail-row">
                      <span className="detail-label">Investment Date:</span>
                      <span className="detail-value">{simulationResult.investmentDate}</span>
                    </div>
                    
                    <div className="detail-row">
                      <span className="detail-label">Amount Invested:</span>
                      <span className="detail-value">{formatCurrency(simulationResult.investmentAmount)}</span>
                    </div>
                    
                    <div className="detail-row">
                      <span className="detail-label">Price on Investment Date:</span>
                      <span className="detail-value">
                        {formatPrice(simulationResult.investmentPrice)}
                      </span>
                    </div>
                    
                    <div className="detail-row">
                      <span className="detail-label">Units Bought:</span>
                      <span className="detail-value">{formatNumber(simulationResult.unitsBought)}</span>
                    </div>
                    
                    <div className="detail-row">
                      <span className="detail-label">Current Price:</span>
                      <span className="detail-value">
                        {formatPrice(simulationResult.currentPrice)}
                      </span>
                    </div>
                    
                    <div className="detail-row">
                      <span className="detail-label">Current Value:</span>
                      <span className="detail-value">{formatCurrency(simulationResult.currentValue)}</span>
                    </div>
                    
                    <div className="detail-row total">
                      <span className="detail-label">Total Profit/Loss:</span>
                      <span className={`detail-value ${simulationResult.profitLoss >= 0 ? 'profit' : 'loss'}`}>
                        {simulationResult.profitLoss >= 0 ? '+' : ''}{formatCurrency(simulationResult.profitLoss)} 
                        ({simulationResult.profitLossPercentage >= 0 ? '+' : ''}{simulationResult.profitLossPercentage.toFixed(2)}%)
                      </span>
                    </div>
                  </div>
                  
                  <div className="save-portfolio-section">
                    <button 
                      onClick={saveToPortfolio}
                      disabled={saving}
                      className="save-portfolio-button"
                    >
                      {saving ? 'Saving...' : 'Save to Portfolio'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Chart Panel */}
          <div className="chart-panel">
            <div className="panel-header">
              <h1 className="chart-title">Price Chart Overview</h1>
              <p className="chart-subtitle">Historical price performance for selected asset</p>
              <p className="chart-instruction">Select an asset and run simulation to see the price chart</p>
            </div>
            
            <div className="chart-container">
              {loading ? (
                <div className="loading-container">
                  <div className="loading-spinner"></div>
                  <p>Fetching historical data...</p>
                </div>
              ) : simulationResult && simulationResult.chartData ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={simulationResult.chartData.filter((_, index) => index % 5 === 0)}
                    margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a3a4a" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fill: '#87ceeb', fontSize: 12 }}
                      tickFormatter={(date) => dayjs(date).format("MMM YY")}
                      stroke="#2a3a4a"
                    />
                    <YAxis 
                      tick={{ fill: '#87ceeb', fontSize: 12 }}
                      tickFormatter={formatPrice}
                      stroke="#2a3a4a"
                      domain={['auto', 'auto']}
                      padding={{ top: 10, bottom: 10 }}
                    />
                    <Tooltip 
                      formatter={(value) => [`₺${value.toFixed(2)}`, 'Price']}
                      labelFormatter={(label) => `Date: ${dayjs(label).format("DD MMM YYYY")}`}
                      contentStyle={{
                        backgroundColor: '#1a2a3a',
                        border: '1px solid rgba(135, 206, 235, 0.3)',
                        borderRadius: '8px',
                        color: '#ffffff'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="price" 
                      stroke="#87ceeb" 
                      strokeWidth={3}
                      dot={{ fill: '#87ceeb', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, fill: '#66ccff' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="chart-placeholder">
                  <img 
                    src="/grafik.png" 
                    alt="Investment Chart" 
                    className="placeholder-chart-image"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimulatePage; 






