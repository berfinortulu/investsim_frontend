import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useWallet } from '../contexts/WalletContext';
import { API_ENDPOINTS } from '../config';
import './CoinGame.css';

const CoinGame = () => {
  const { user, authenticatedFetch } = useAuth();
  const { walletBalance, updateWalletBalance } = useWallet();
  const [positions, setPositions] = useState([]);
  const [formData, setFormData] = useState({
    symbol: 'ETH',
    amount: ''
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [currentPrices, setCurrentPrices] = useState({});
  
  // New state for refresh functionality
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);

  // Predict First dropdown state
  const [showPredict, setShowPredict] = useState(false);
  const [predLoading, setPredLoading] = useState(false);
  const [predError, setPredError] = useState('');
  const [predList, setPredList] = useState([]);

  // Available symbols for trading
  const symbols = ['ETH', 'BTC', 'ADA', 'DOT', 'LINK', 'LTC', 'XRP', 'BCH'];

  // Mock current prices (in TL) - in real app, this would come from API
  const mockCurrentPrices = {
    'ETH': 42000,
    'BTC': 1260000,
    'ADA': 15,
    'DOT': 450,
    'LINK': 1200,
    'LTC': 2800,
    'XRP': 8,
    'BCH': 1800
  };

  // Get current price for a symbol
  const getCurrentPrice = (symbol) => {
    return mockCurrentPrices[symbol] || 0;
  };

  // Fetch real current price from API
  const fetchCurrentPrice = async (symbol) => {
    // DISABLED: API limit reached, using mock prices only
    console.log('🔍 DEBUG: API calls disabled, using mock price for:', symbol);
    return mockCurrentPrices[symbol] || 0;
  };

  // Fetch current prices for all symbols
  const fetchCurrentPrices = async (symbols) => {
    // DISABLED: API limit reached, using mock prices only
    console.log('🔍 DEBUG: API calls disabled, using mock prices for symbols:', symbols);
    setCurrentPrices(mockCurrentPrices);
  };

  // Fetch ML recommendations
  const fetchPred = async (period) => {
    try {
      setPredLoading(true);
      setPredError('');
      const url = `${API_ENDPOINTS.ML_RECOMMENDATIONS}?period=${encodeURIComponent(period)}`;
      const resp = await authenticatedFetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Failed (${resp.status}) ${text || ''}`);
      }
      const data = await resp.json();
      const items = Array.isArray(data) ? data : (data.items || data.results || []);
      setPredList(items);
    } catch (e) {
      console.error('Predict fetch error:', e);
      setPredList([]);
      setPredError(e.message || 'Failed to fetch recommendations');
      // simple toast
      try { alert(`Recommendation error: ${e.message}`); } catch (_) {}
    } finally {
      setPredLoading(false);
    }
  };

  // Format quantity to be more readable
  const formatQuantity = (qty) => {
    if (qty === 'N/A') return 'N/A';
    const num = parseFloat(qty);
    if (isNaN(num)) return 'N/A';
    
    if (num < 0.01) {
      return num.toFixed(6); // Show more decimals for very small amounts
    } else if (num < 1) {
      return num.toFixed(4); // Show 4 decimals for small amounts
    } else {
      return num.toFixed(2); // Show 2 decimals for larger amounts
    }
  };

  // Format TRY currency with proper handling for N/A values
  const formatTRY = (amount) => {
    if (amount === "N/A" || amount === null || amount === undefined) {
      return "N/A";
    }
    
    const num = Number(amount);
    if (isNaN(num)) return "N/A";
    
    return num.toLocaleString('tr-TR', { 
      style: 'currency', 
      currency: 'TRY' 
    });
  };

  // Format percentage with proper handling for N/A values
  const formatPercent = (value) => {
    if (value === "N/A" || value === null || value === undefined) {
      return "N/A";
    }
    
    const num = parseFloat(value);
    if (isNaN(num)) return "N/A";
    
    return `${num.toFixed(2)}%`;
  };

  // Fetch wallet balance on mount
  useEffect(() => {
    fetchWallet();
  }, []);

  // Fetch positions on mount only (removed polling)
  useEffect(() => {
    fetchPositions();
  }, []);

  // New refresh function that fetches both wallet and positions
  const handleRefresh = async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    
    try {
      // Fetch wallet and positions sequentially
      await fetchWallet();
      await fetchPositions();
      
      // Update last updated timestamp
      setLastUpdated(new Date());
      
      // Set cooldown for 10 seconds
      setCooldownUntil(Date.now() + 10000);
    } catch (error) {
      console.error('Error during refresh:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Check if refresh button should be disabled
  const isRefreshDisabled = isRefreshing || Date.now() < cooldownUntil;

  const fetchWallet = async () => {
    try {
      const response = await authenticatedFetch(API_ENDPOINTS.COIN_WALLET, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.detail || 'Failed to load wallet data');
      }

      const data = await response.json();
      const balance = Number(data.balance || 0);
      updateWalletBalance(isNaN(balance) ? 0 : balance);
    } catch (error) {
      console.error('Error fetching wallet:', error);
      setError(error.message || 'Failed to load wallet data');
    } finally {
      setLoading(false);
    }
  };

  const fetchPositions = async () => {
    try {
      const response = await authenticatedFetch(API_ENDPOINTS.COIN_POSITIONS, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Error fetching positions:', errorData.error || errorData.detail || 'Failed to fetch positions');
        return;
      }

      const data = await response.json();
      console.log('🔍 DEBUG: Fetched positions data:', data);
      console.log('🔍 DEBUG: Data type:', typeof data);
      console.log('🔍 DEBUG: Data length:', data.length);
      console.log('🔍 DEBUG: Is array?', Array.isArray(data));
      
      // Her position için debug
      data.forEach((position, index) => {
        console.log(`🔍 DEBUG: Position ${index}:`, {
          id: position.id,
          symbol: position.symbol,
          qty: position.qty,
          entry_price: position.entry_price,
          current_price: position.current_price,
          current_value: position.current_value,
          pnl_amount: position.pnl_amount,
          pnl_percent: position.pnl_percent,
          // Check data types
          types: {
            qty: typeof position.qty,
            entry_price: typeof position.entry_price,
            current_value: typeof position.current_value,
            pnl_amount: typeof position.pnl_amount,
            pnl_percent: typeof position.pnl_percent
          },
          // Check if values exist
          exists: {
            qty: position.qty !== null && position.qty !== undefined,
            entry_price: position.entry_price !== null && position.entry_price !== undefined,
            current_value: position.current_value !== null && position.current_value !== undefined,
            pnl_amount: position.pnl_amount !== null && position.pnl_amount !== undefined,
            pnl_percent: position.pnl_percent !== null && position.pnl_percent !== undefined
          }
        });
      });
      
      setPositions(data);
      
      // Fetch current prices for all symbols in positions
      if (data.length > 0) {
        const symbols = [...new Set(data.map(pos => pos.symbol))];
        await fetchCurrentPrices(symbols);
      }
    } catch (error) {
      console.error('Error fetching positions:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleInvest = async (e) => {
    e.preventDefault();
    
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const amount = Number(formData.amount);
      
      // ✅ Guard against NaN/missing price
      if (isNaN(amount) || amount <= 0) {
        setError('Please enter a valid amount');
        return;
      }

      console.log('🔍 DEBUG: Investing:', { 
        symbol: formData.symbol, 
        amount: amount 
      });

      const response = await authenticatedFetch(API_ENDPOINTS.COIN_INVEST, {
        method: 'POST',
        headers: { 
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          symbol: formData.symbol,
          amount: amount // ✅ Send raw number, no formatting
        })
      });

      console.log('🔍 DEBUG: Investment response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('🔍 DEBUG: Investment error data:', errorData);
        throw new Error(errorData.error || errorData.detail || 'Failed to place investment');
      }

      const result = await response.json();
      console.log('🔍 DEBUG: Investment successful:', result);
      
      // Reset form
      setFormData(prev => ({ ...prev, amount: '' }));
      
      // ✅ API response as source of truth
      if (result.balance !== undefined) {
        updateWalletBalance(Number(result.balance));
      } else {
        await fetchWallet();
      }
      
      // Refetch positions
      await fetchPositions();
    } catch (error) {
      console.error('🔍 DEBUG: Investment failed:', error);
      setError(error.message || 'Failed to place investment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClosePosition = async (positionId) => {
    console.log('🔍 DEBUG: Closing position:', positionId);
    
    if (!positionId) {
      console.error('🔍 DEBUG: No position ID provided');
      setError('Invalid position ID');
      return;
    }
    
    try {
      // Get current price for this position
      const position = positions.find(p => p.id === positionId);
      const currentPrice = currentPrices[position?.symbol] || 0;
      
      console.log('🔍 DEBUG: Current price for close:', currentPrice);
      
      const response = await authenticatedFetch(API_ENDPOINTS.COIN_CLOSE(positionId), {
        method: 'POST',
        headers: { 
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          current_price: currentPrice
        })
      });

      console.log('🔍 DEBUG: Close position response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('🔍 DEBUG: Close position error data:', errorData);
        throw new Error(errorData.error || errorData.detail || 'Failed to close position');
      }

      const result = await response.json();
      console.log('🔍 DEBUG: Close successful:', result);
      
      // ✅ Calculate the actual amount to add to wallet: investment amount + P&L
      const investmentAmount = Number(position.entry_price) * Number(position.qty);
      const pnlAmount = Number(result.pnl_amount || 0);
      const amountToAdd = investmentAmount + pnlAmount;
      
      // Calculate frontend P&L for comparison
      const qty = Number(position.qty);
      const entryPrice = Number(position.entry_price);
      const frontendPnlAmount = (qty * currentPrice) - (qty * entryPrice);
      
      console.log('🔍 DEBUG: P&L Comparison:', {
        position: position.symbol,
        qty,
        entryPrice,
        currentPrice,
        investmentAmount,
        backendPnlAmount: pnlAmount,
        frontendPnlAmount,
        difference: Math.abs(pnlAmount - frontendPnlAmount),
        amountToAdd
      });
      
      // ✅ Update wallet balance by adding the calculated amount
      const newBalance = walletBalance + amountToAdd;
      updateWalletBalance(newBalance);
      console.log('🔍 DEBUG: New wallet balance:', newBalance);
      
      // ✅ Show modal with calculated values and comparison
      const realizedValue = Number(result.realized_value || result.current_value || 0);
      const pnlPercent = Number(result.pnl_percent || 0);
      
      const message = `Position closed successfully!

Investment Amount: ${investmentAmount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
Backend P&L Amount: ${pnlAmount >= 0 ? '+' : ''}${pnlAmount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
Frontend P&L Amount: ${frontendPnlAmount >= 0 ? '+' : ''}${frontendPnlAmount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
P&L Difference: ${Math.abs(pnlAmount - frontendPnlAmount).toFixed(2)} TL
P&L Percentage: ${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%
Amount Added to Wallet: ${amountToAdd.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}

New Wallet Balance: ${newBalance.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}`;
      
      alert(message);
      
      // ✅ Refetch positions from API (wallet already updated locally)
      await fetchPositions();
      
      console.log('🔍 DEBUG: Close operation completed');
      
    } catch (error) {
      console.error('🔍 DEBUG: Close failed:', error);
      setError(error.message || 'Failed to close position');
      alert(`Failed to close position: ${error.message}`);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="coin-game-page">
        <div className="coin-game-container">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading Coin Game...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="coin-game-page">
      <div className="coin-game-container">
        {/* Main Page Title */}
        <div className="page-header">
          <h1 className="page-title">Coin Trading Simulation</h1>
          <div className="welcome-message">
            <p>Invest in cryptocurrencies with your virtual wallet balance.</p>
            <p>Select a coin, enter an amount, and track your profit or loss in real-time.</p>
          </div>
          
          {/* Refresh Button and Last Updated Info */}
          <div className="refresh-section" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Predict First - now on the left, with its own relative wrapper */}
            <div className="predict-wrap" style={{ position: 'relative', display: 'inline-block' }}>
              <button
                onClick={() => setShowPredict(prev => !prev)}
                disabled={isRefreshDisabled}
                className="refresh-button"
              >
                Predict First
              </button>

              {showPredict && (
                <div className="predict-dropdown" style={{ position: 'absolute', top: '100%', left: 0, marginTop: 8, width: 360, maxHeight: 380, overflowY: 'auto', background: 'rgba(17,25,40,0.95)', border: '1px solid rgba(102,204,255,0.2)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 50 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="predict-mini" onClick={() => fetchPred('weekly')} disabled={predLoading}>
                        Weekly
                      </button>
                      <button type="button" className="predict-mini" onClick={() => fetchPred('monthly')} disabled={predLoading}>
                        Monthly
                      </button>
                    </div>
                    <button type="button" className="predict-mini" onClick={() => setShowPredict(false)}>Close</button>
                  </div>

                  <div style={{ padding: 10 }}>
                    {predLoading && (
                      <div style={{ padding: 20, textAlign: 'center' }}>
                        <div className="loading-spinner" style={{ margin: '0 auto' }}></div>
                        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>Loading...</div>
                      </div>
                    )}
                    {!predLoading && predError && (
                      <div style={{ color: '#fca5a5', padding: '8px 10px', fontSize: 13 }}>{predError}</div>
                    )}
                    {!predLoading && !predError && predList.length === 0 && (
                      <div style={{ padding: 12, fontSize: 13, opacity: 0.8 }}>No suggestions yet</div>
                    )}
                    {!predLoading && !predError && predList.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {predList.map((it, idx) => {
                          const sym = it.symbol || it.ticker || it.asset || '—';
                          const direction = (it.direction || it.trend || '').toString().toUpperCase();
                          const conf = Number(it.confidence || it.confidence_score || it.score);
                          const advice = it.advice_text || it.advice || it.note || '';
                          const isUp = direction.includes('UP');
                          return (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 12px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, background: 'rgba(255,255,255,0.03)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                <span style={{ display: 'inline-block', minWidth: 24, height: 24, borderRadius: 999, background: 'rgba(102,204,255,0.15)', color: '#66ccff', fontSize: 12, fontWeight: 700, textAlign: 'center', lineHeight: '24px' }}>#{idx + 1}</span>
                                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                    <strong style={{ color: '#e5e7eb' }}>{sym}</strong>
                                    <span style={{ color: isUp ? '#22c55e' : '#ef4444', fontWeight: 600 }}>{isUp ? 'UP' : 'DOWN'}</span>
                                    <span style={{ color: '#a1a1aa', fontSize: 12 }}>{Number.isFinite(conf) ? `${(conf * 100).toFixed(0)}%` : '—'}</span>
                                  </div>
                                  {advice && (
                                    <div style={{ color: '#9ca3af', fontSize: 12, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220 }}>
                                      {advice}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <button
                                type="button"
                                className="predict-use"
                                onClick={() => {
                                  setFormData(prev => ({ ...prev, symbol: sym }));
                                  setShowPredict(false);
                                }}
                              >
                                Use
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Refresh button on the right */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshDisabled}
              className="refresh-button"
            >
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            {lastUpdated && (
              <span className="last-updated">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>

        <div className="coin-game-layout">
          {/* Left Column - Wallet and Investment */}
          <div className="wallet-investment-panel">
            <h2 className="panel-title">Wallet Balance</h2>
            {/* Wallet Section */}
            <div className="wallet-section">
              <div className="wallet-balance">
                <span className="balance-amount">{formatTRY(walletBalance)}</span>
              </div>
            </div>

            <h2 className="panel-title">Place Investment</h2>
            {/* Investment Form */}
            <div className="investment-form-section">
              <form onSubmit={handleInvest} className="investment-form">
                <div className="form-group">
                  <label htmlFor="symbol">Symbol:</label>
                  <select
                    id="symbol"
                    name="symbol"
                    value={formData.symbol}
                    onChange={handleInputChange}
                    className="form-select"
                  >
                    {symbols.map(symbol => (
                      <option key={symbol} value={symbol}>{symbol}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="amount">Amount (TL):</label>
                  <input
                    type="number"
                    id="amount"
                    name="amount"
                    value={formData.amount}
                    onChange={handleInputChange}
                    placeholder="Enter amount"
                    min="0"
                    step="0.01"
                    className="form-input"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="invest-button"
                >
                  {submitting ? 'Placing Investment...' : 'Place Investment'}
                </button>

                {error && (
                  <div className="error-message">
                    {error}
                  </div>
                )}
              </form>
            </div>
          </div>

          {/* Right Column - Positions Table */}
          <div className="positions-panel">
            <h2 className="panel-title">Open Positions</h2>
            <div className="positions-section">
              {positions.length === 0 ? (
                <div className="empty-positions">
                  <p>Start trading to see your positions here</p>
                </div>
              ) : (
                <div className="positions-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Symbol</th>
                        <th>Qty</th>
                        <th>Entry Price</th>
                        <th>Current Price</th>
                        <th>Current Value</th>
                        <th>P&L (TL)</th>
                        <th>P&L (%)</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {positions.map(position => {
                        console.log('🔍 DEBUG: Rendering position:', position);
                        
                        // Prefer ONLY backend values
                        const qty = position.qty != null ? parseFloat(position.qty) : null;
                        const entryPrice = position.entry_price != null ? parseFloat(position.entry_price) : null;
                        const backendCurrentPrice = position.current_price != null ? parseFloat(position.current_price) : null;
                        const backendCurrentValue = position.current_value != null ? parseFloat(position.current_value) : null;
                        const pnlAmount = position.pnl_amount != null ? parseFloat(position.pnl_amount) : null;
                        const pnlPercent = position.pnl_percent != null ? parseFloat(position.pnl_percent) : null;
                        
                        // Presence checks
                        const hasEntryPrice = entryPrice !== null && !Number.isNaN(entryPrice);
                        const hasCurrentPrice = backendCurrentPrice !== null && !Number.isNaN(backendCurrentPrice);
                        const hasCurrentValue = backendCurrentValue !== null && !Number.isNaN(backendCurrentValue);
                        const hasPnlAmount = pnlAmount !== null && !Number.isNaN(pnlAmount);
                        const hasPnlPercent = pnlPercent !== null && !Number.isNaN(pnlPercent);
                        
                        console.log('🔍 DEBUG: Backend API Data for', position.symbol, ':', {
                          qty,
                          entryPrice,
                          current_price: position.current_price,
                          current_value: position.current_value,
                          pnl_amount: position.pnl_amount,
                          pnl_percent: position.pnl_percent,
                          missingData: {
                            entryPrice: !hasEntryPrice,
                            currentPrice: !hasCurrentPrice,
                            currentValue: !hasCurrentValue,
                            pnlAmount: !hasPnlAmount,
                            pnlPercent: !hasPnlPercent,
                          },
                          rawPosition: position,
                        });
                        
                        return (
                          <tr key={position.id}>
                            <td className="symbol-cell">{position.symbol || 'N/A'}</td>
                            <td>{formatQuantity(position.qty)}</td>
                            <td>
                              {hasEntryPrice ? (
                                formatTRY(entryPrice)
                              ) : (
                                <span style={{ color: '#ffa500', fontStyle: 'italic' }}>Backend data missing</span>
                              )}
                            </td>
                            <td>
                              {hasCurrentPrice ? (
                                formatTRY(backendCurrentPrice)
                              ) : (
                                <span style={{ color: '#ffa500', fontStyle: 'italic' }}>Backend data missing</span>
                              )}
                            </td>
                            <td>
                              {hasCurrentValue ? (
                                formatTRY(backendCurrentValue)
                              ) : (
                                <span style={{ color: '#ffa500', fontStyle: 'italic' }}>Backend data missing</span>
                              )}
                            </td>
                            <td className={hasPnlAmount && pnlAmount >= 0 ? 'positive' : 'negative'}>
                              {hasPnlAmount ? (
                                `${pnlAmount >= 0 ? '+' : ''}${formatTRY(pnlAmount)}`
                              ) : (
                                <span style={{ color: '#ffa500', fontStyle: 'italic' }}>Backend data missing</span>
                              )}
                            </td>
                            <td className={hasPnlPercent && pnlPercent >= 0 ? 'positive' : 'negative'}>
                              {hasPnlPercent ? (
                                `${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%`
                              ) : (
                                <span style={{ color: '#ffa500', fontStyle: 'italic' }}>Backend data missing</span>
                              )}
                            </td>
                            <td>
                              <button
                                onClick={() => {
                                  console.log('🔍 DEBUG: Close button clicked for position:', position);
                                  console.log('🔍 DEBUG: Position ID:', position.id);
                                  console.log('🔍 DEBUG: Position ID type:', typeof position.id);
                                  handleClosePosition(position.id);
                                }}
                                className="close-button"
                              >
                                Close
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoinGame; 