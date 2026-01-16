import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, ComposedChart } from 'recharts';
import { FiDownload, FiRefreshCw, FiTrendingUp, FiBarChart2, FiCalendar, FiDollarSign, FiClock } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import { API_ENDPOINTS } from '../config';
import './MLPredict.css';

const MLPredict = ({ showOnlyFuture = false }) => {
  const { user, authenticatedFetch } = useAuth();
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedSymbol, setSelectedSymbol] = useState('BTC');
  const [selectedDays, setSelectedDays] = useState(365);
  const [showVolume, setShowVolume] = useState(false);
  const [tableLimit, setTableLimit] = useState(30);
  const [rangeMode, setRangeMode] = useState('preset'); // 'preset' | 'custom'
  const [customStart, setCustomStart] = useState(''); // YYYY-MM-DD
  const [customEnd, setCustomEnd] = useState(''); // YYYY-MM-DD

  const symbols = ['BTC', 'ETH', 'ADA', 'DOT', 'LINK', 'LTC', 'XRP', 'BCH'];
  const dayOptions = [7, 30, 90, 365];

  // If showOnlyFuture is true, only show future features
  if (showOnlyFuture) {
    return (
      <div className="ml-predict-page">
        <div className="ml-content">
          <div className="ml-header">
            <div className="ml-title">
              <h1>Predict Now</h1>
            </div>
            <p>Machine Learning powered cryptocurrency price prediction and analysis</p>
          </div>

          {/* Future Features Placeholder */}
          <div className="future-features">
            <h3>Future Features (Coming Soon)</h3>
            <div className="feature-grid">
              <div className="feature-card">
                <h4>Model Training</h4>
                <p>POST /api/ml/train - Server-side training job enqueue</p>
                <ul>
                  <li>Train window selection</li>
                  <li>Prediction horizon configuration</li>
                  <li>Model performance metrics</li>
                </ul>
              </div>
              
              <div className="feature-card">
                <h4>Price Prediction</h4>
                <p>GET /api/ml/predict?date=YYYY-MM-DD - Single-step inference</p>
                <ul>
                  <li>Date-based predictions</li>
                  <li>Prediction overlay on chart</li>
                  <li>Confidence intervals</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Fetch ML/ OHLC History Data with Preset or Custom
  const fetchHistory = async () => {
    if (!selectedSymbol) return;
    
    try {
      setLoading(true);
      setError(null);
      const baseUrl = API_ENDPOINTS.OHLC_HISTORY || API_ENDPOINTS.ML_HISTORY;
      let url = '';
      if (rangeMode === 'preset') {
        url = `${baseUrl}?symbol=${encodeURIComponent(selectedSymbol)}&days=${encodeURIComponent(selectedDays)}`;
      } else {
        // Validate custom dates
        if (!customStart || !customEnd) {
          setHistoryData([]);
          setError('Please select both start and end dates.');
          setLoading(false);
          return;
        }
        const today = new Date();
        const start = new Date(customStart);
        const end = new Date(customEnd);
        if (start > end) {
          setHistoryData([]);
          setError('Start date must be before or equal to End date.');
          setLoading(false);
          return;
        }
        if (start > today || end > today) {
          setHistoryData([]);
          setError('Future dates are not allowed.');
          setLoading(false);
          return;
        }
        const diffMs = end.getTime() - start.getTime();
        const maxMs = 3 * 365 * 24 * 60 * 60 * 1000; // ~3 years
        if (diffMs > maxMs) {
          setHistoryData([]);
          setError('Custom range cannot exceed 3 years.');
          setLoading(false);
          return;
        }
        url = `${baseUrl}?symbol=${encodeURIComponent(selectedSymbol)}&start_date=${encodeURIComponent(customStart)}&end_date=${encodeURIComponent(customEnd)}`;
      }
      
      const response = await authenticatedFetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('[ML] Raw response data:', data);
      console.log('[ML] Response type:', typeof data);
      console.log('[ML] Is array?', Array.isArray(data));
      
      // Handle different response formats
      let dataArray = [];
      if (Array.isArray(data)) {
        dataArray = data;
        console.log('[ML] Data is already an array, length:', dataArray.length);
      } else if (data && typeof data === 'object') {
        // Check for common response wrapper keys
        if (data.results && Array.isArray(data.results)) {
          dataArray = data.results;
          console.log('[ML] Using data.results, length:', dataArray.length);
        } else if (data.data && Array.isArray(data.data)) {
          dataArray = data.data;
          console.log('[ML] Using data.data, length:', dataArray.length);
        } else if (data.items && Array.isArray(data.items)) {
          dataArray = data.items;
          console.log('[ML] Using data.items, length:', dataArray.length);
        } else if (data.history && Array.isArray(data.history)) {
          dataArray = data.history;
          console.log('[ML] Using data.history, length:', dataArray.length);
        } else {
          // If no array found, try to use the data object itself
          dataArray = [data];
          console.log('[ML] No array found, using data as single item');
        }
      }
      
      if (dataArray.length === 0) {
        setHistoryData([]);
        setError('No data for selected range');
        return;
      }
      
      console.log('[ML] First 3 items:', dataArray.slice(0, 3));
      
      // Transform data for chart display - backend now sends correct field names
      const transformedData = dataArray.map(item => {
        const transformed = {
          date: new Date(item.date || item.timestamp || item.created_at).toLocaleDateString('tr-TR'),
          close: parseFloat(item.close || 0),
          volume: parseFloat(item.volume || 0),
          open: parseFloat(item.open || 0),
          high: parseFloat(item.high || 0),
          low: parseFloat(item.low || 0)
        };
        console.log('[ML] Transformed item:', transformed);
        return transformed;
      }).filter(item => {
        // Filter out invalid items - check if close price exists and is valid
        return item.close && !isNaN(item.close) && item.close > 0;
      });

      setHistoryData(transformedData);
      console.log('[ML] Final transformed data length:', transformedData.length);
      
    } catch (error) {
      console.error('Error fetching history:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const ingestData = async () => {
    if (!selectedSymbol) return;
    
    try {
      setLoading(true); // Changed from ingestLoading to loading
      setError(''); // Changed from ingestError to error
      
      // Use exact parameter names: symbol, days
      const response = await authenticatedFetch(
        API_ENDPOINTS.ML_INGEST,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            symbol: selectedSymbol,
            days: Number(selectedDays)  // Ensure it's a number
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Ingest result:', result);
      
      // Automatically refresh history after successful ingest
      await fetchHistory();
      
    } catch (error) {
      console.error('Error ingesting data:', error);
      setError(`Failed to ingest data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Get table data based on limit
  const getTableData = () => {
    const limit = Math.min(tableLimit, historyData.length);
    console.log('[ML] Table limit:', tableLimit, 'Total data:', historyData.length, 'Will show:', limit);
    return historyData.slice(0, limit).reverse(); // Show most recent first
  };

  // Format number for display
  const formatNumber = (num) => {
    if (typeof num !== 'number') return 'N/A';
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Format volume for display (convert to billions/millions)
  const formatVolume = (num) => {
    if (typeof num !== 'number') return 'N/A';
    if (num >= 1e9) {
      return (num / 1e9).toFixed(2) + 'B';
    } else if (num >= 1e6) {
      return (num / 1e6).toFixed(2) + 'M';
    } else if (num >= 1e3) {
      return (num / 1e3).toFixed(2) + 'K';
    } else {
      return num.toFixed(2);
    }
  };

  // Calculate Y-axis domain for better chart display
  const getYAxisDomain = () => {
    const yValues = historyData.map(d => Number(d.close)).filter(Number.isFinite);
    if (yValues.length === 0) return ['auto', 'auto'];
    
    const min = Math.min(...yValues);
    const max = Math.max(...yValues);
    const padding = (max - min) * 0.1; // 10% padding
    
    return [min - padding, max + padding];
  };

  // Calculate Y-axis domain for volume (right axis)
  const getVolumeYAxisDomain = () => {
    const volumeValues = historyData.map(d => Number(d.volume)).filter(Number.isFinite);
    if (volumeValues.length === 0) return [0, 'auto'];
    
    const min = 0; // Always start from 0 for volume bars
    const max = Math.max(...volumeValues);
    const padding = max * 0.1; // 10% padding on top only
    
    return [min, max + padding];
  };

  return (
    <div className="ml-predict-page">
      <div className="ml-content">
        <div className="ml-header">
          <div className="ml-title">
            <h1>Data History</h1>
          </div>
          <p>Historical cryptocurrency data analysis and visualization</p>
        </div>
        
        <div className="ml-container">
          <div className="ml-grid">
            {/* Left Sidebar */}
            <div className="ml-sidebar">
              <div className="ml-card">
                 <div className="control-group">
                   <label htmlFor="symbol-select">Select Asset:</label>
                   <select
                    id="symbol-select"
                    value={selectedSymbol}
                    onChange={(e) => setSelectedSymbol(e.target.value)}
                    disabled={loading}
                  >
                    <option value="" disabled>Choose an asset...</option>
                    {symbols.map(symbol => (
                      <option key={symbol} value={symbol}>{symbol}</option>
                    ))}
                  </select>
                </div>

                <div className="control-group">
                  <label>Range Mode:</label>
                  <div className="range-switch">
                    <label style={{ marginRight: 10 }}>
                      <input
                        type="radio"
                        name="range-mode"
                        value="preset"
                        checked={rangeMode === 'preset'}
                        onChange={() => setRangeMode('preset')}
                        disabled={loading}
                      />
                      {' '}Preset
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="range-mode"
                        value="custom"
                        checked={rangeMode === 'custom'}
                        onChange={() => setRangeMode('custom')}
                        disabled={loading}
                      />
                      {' '}Custom
                    </label>
                  </div>
                </div>

                <div className="control-group">
                  <label htmlFor="days-select">Select Range:</label>
                    {rangeMode === 'preset' ? (
                      <select
                        id="days-select"
                        value={selectedDays}
                        onChange={(e) => setSelectedDays(parseInt(e.target.value))}
                        disabled={loading}
                      >
                        <option value="" disabled>Choose time range...</option>
                        {dayOptions.map(days => (
                          <option key={days} value={days}>{days} days</option>
                        ))}
                      </select>
                    ) : (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <small>Start</small>
                          <input
                            type="date"
                            value={customStart}
                            max={new Date().toISOString().slice(0,10)}
                            onChange={(e) => setCustomStart(e.target.value)}
                            disabled={loading}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <small>End</small>
                          <input
                            type="date"
                            value={customEnd}
                            max={new Date().toISOString().slice(0,10)}
                            onChange={(e) => setCustomEnd(e.target.value)}
                            disabled={loading}
                          />
                        </div>
                      </div>
                    )}
                </div>

                <div className="control-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={showVolume}
                      onChange={(e) => setShowVolume(e.target.checked)}
                      disabled={loading}
                    />
                    Show Volume
                  </label>
                </div>

                <div className="control-buttons">
                  <button
                    onClick={fetchHistory}
                    disabled={loading}
                    className="btn btn-primary"
                  >
                    <FiRefreshCw className={loading ? 'spinning' : ''} />
                    Fetch History
                  </button>
                  
                  {rangeMode === 'preset' && (
                    <button
                      onClick={ingestData}
                      disabled={loading}
                      className="btn btn-secondary"
                    >
                      <FiDownload />
                      Ingest Data
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Right Main Content */}
            <div className="ml-main">
              <div className="ml-card">
                {/* Error Display */}
                {error && (
                  <div className="error-message">
                    <p>{error}</p>
                    <button onClick={() => setError('')} className="btn btn-small">
                      Dismiss
                    </button>
                  </div>
                )}

                {/* Chart Section */}
                {historyData.length > 0 && (
                  <div className="ml-chart-section">
                    <h2>
                      Price Chart – {selectedSymbol}{' '}
                      {rangeMode === 'custom'
                        ? (customStart && customEnd ? `(Custom: ${customStart} → ${customEnd})` : '(Custom)')
                        : `(Last ${selectedDays} days)`}
                    </h2>
                    
                    <ResponsiveContainer width="100%" height={400}>
                      <ComposedChart data={historyData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="date" 
                          angle={-45}
                          textAnchor="end"
                          height={80}
                          interval="preserveStartEnd"
                        />
                        <YAxis 
                          yAxisId="left" 
                          domain={getYAxisDomain()} 
                          tick={{ fontSize: 10 }} // Smaller font size for price axis
                          tickFormatter={(value) => {
                            // Round and format price values to fit better in chart
                            if (value >= 1000) {
                              return `$${(value / 1000).toFixed(1)}K`;
                            } else if (value >= 1) {
                              return `$${value.toFixed(1)}`;
                            } else {
                              return `$${value.toFixed(3)}`;
                            }
                          }}
                        />
                        {showVolume && (
                          <YAxis 
                            yAxisId="right" 
                            orientation="right" 
                            domain={getVolumeYAxisDomain()} 
                            tick={{ fontSize: 10 }} // Smaller font size for volume axis
                            tickCount={5} // Limit number of ticks for better spacing
                            tickFormatter={(value) => {
                              // Better format volume values to fit better in chart
                              if (value >= 1e9) {
                                return `${Math.round(value / 1e8) / 10}B`; // Round to 1 decimal
                              } else if (value >= 1e6) {
                                return `${Math.round(value / 1e5) / 10}M`; // Round to 1 decimal
                              } else if (value >= 1e3) {
                                return `${Math.round(value / 1e2) / 10}K`; // Round to 1 decimal
                              } else if (value >= 100) {
                                return `${Math.round(value / 10) * 10}`; // Round to nearest 10
                              } else {
                                return Math.round(value); // Round to nearest integer
                              }
                            }}
                          />
                        )}
                        <Tooltip 
                          formatter={(value, name) => [
                            name === 'volume' ? formatVolume(value) : formatNumber(value), 
                            name === 'close' ? 'Close Price' : 
                            name === 'volume' ? 'Volume' : name
                          ]}
                          labelFormatter={(label) => `Date: ${label}`}
                        />
                        
                        {/* Price Line - only close price */}
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="close"
                          stroke="#8884d8"
                          strokeWidth={2}
                          dot={false}
                          name="close"
                        />
                        
                        {/* Volume Bars - only if showVolume and volume is valid */}
                        {showVolume && (
                          <Bar
                            yAxisId="right"
                            dataKey="volume"
                            fill="#82ca9d"
                            opacity={0.7}
                            name="volume"
                            radius={[2, 2, 0, 0]} // Rounded top corners
                            stackId="volume" // Ensure proper stacking
                          />
                        )}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Loading State */}
                {loading && (
                  <div className="loading-overlay">
                    <div className="loading-spinner"></div>
                    <p>Processing...</p>
                  </div>
                )}

                {/* Empty State */}
                {!loading && historyData.length === 0 && !error && (
                  <div className="empty-state">
                    <FiBarChart2 size={64} />
                    <h3>No Data Available</h3>
                    <p>Click "Fetch History" to load historical data or "Ingest Data" to fetch new data from the API.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      {(loading || historyData.length > 0) && (
        <div className="section-divider-thick"></div>
      )}
      {/* Full-width Historical Data below the grid */}
      {historyData.length > 0 && (
        <div className="ml-card ml-table-section" style={{ marginTop: 24 }}>
          <div className="table-header">
            <h2>Historical Data</h2>
            <div className="table-controls">
              <label>Show last:</label>
              <select
                value={tableLimit}
                onChange={(e) => setTableLimit(parseInt(e.target.value))}
              >
                <option value={30}>30 days</option>
                <option value={60}>60 days</option>
                <option value={90}>90 days</option>
              </select>
            </div>
          </div>
          <div className="table-container">
            <table className="ml-data-table">
              <thead>
                <tr>
                  <th><FiCalendar /> Date</th>
                  <th><FiDollarSign /> Open</th>
                  <th><FiDollarSign /> High</th>
                  <th><FiDollarSign /> Low</th>
                  <th><FiDollarSign /> Close</th>
                  <th><FiBarChart2 /> Volume</th>
                </tr>
              </thead>
              <tbody>
                {getTableData().map((row, index) => (
                  <tr key={index}>
                    <td>{row.date}</td>
                    <td>${formatNumber(row.open)}</td>
                    <td>${formatNumber(row.high)}</td>
                    <td>${formatNumber(row.low)}</td>
                    <td>${formatNumber(row.close)}</td>
                    <td>{formatVolume(row.volume)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
    </div>
  );
};

export default MLPredict; 