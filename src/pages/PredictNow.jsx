import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { postPredict, getRequirements, ingestHistory, getHistoricalData } from '../api/mlApi';
import { FiTrendingUp, FiTrendingDown, FiMinus, FiAlertCircle, FiCheckCircle, FiRefreshCw, FiDownload, FiX, FiBarChart2, FiCalendar, FiDollarSign, FiCopy, FiSave } from 'react-icons/fi';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, ComposedChart, ReferenceLine } from 'recharts';
import { API_ENDPOINTS } from '../config';
import './PredictNow.css';

const PredictNow = () => {
  const { user, authenticatedFetch } = useAuth();
  const [symbol, setSymbol] = useState('BTC');
  const [horizon, setHorizon] = useState(1);
  
  // State management
  const [prediction, setPrediction] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState('');
  const [formErrors, setFormErrors] = useState({});
  
  // Loading states
  const [loadingRequirements, setLoadingRequirements] = useState(false);
  const [loadingPredict, setLoadingPredict] = useState(false);
  const [ingestingHistory, setIngestingHistory] = useState(false);
  const [loadingHistorical, setLoadingHistorical] = useState(false);
  
  // Chart controls
  const [showMA10, setShowMA10] = useState(true); // Default ON
  const [showMA30, setShowMA30] = useState(false); // Default OFF
  const [showMA90, setShowMA90] = useState(false); // Default OFF
  const [showPrediction, setShowPrediction] = useState(true);
  
  // Today marker from backend
  const [todayStr, setTodayStr] = useState(null);
  const [todayTs, setTodayTs] = useState(null);

  // Data requirements
  const [hasEnoughData, setHasEnoughData] = useState(true);
  const [dataRange, setDataRange] = useState('');
  const [dataStatus, setDataStatus] = useState('');

  // Today marker and last close from backend meta
  const [lastClose, setLastClose] = useState(null);

  // Notes and copy functionality
  const [userNotes, setUserNotes] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const symbols = ['BTC', 'ETH', 'ADA', 'DOT', 'LINK', 'LTC', 'XRP', 'BCH'];

  // Form validation
  const validateForm = () => {
    const errors = {};
    
    if (!symbol) {
      errors.symbol = 'Asset seçimi zorunludur';
    }
    
    if (!horizon || horizon < 1 || horizon > 365) {
      errors.horizon = 'Horizon 1-365 gün arasında olmalıdır';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Calculate Moving Averages
  const calculateMA = (data, period) => {
    const result = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        result.push(null);
      } else {
        const sum = data.slice(i - period + 1, i + 1).reduce((acc, val) => acc + val, 0);
        result.push(sum / period);
      }
    }
    return result;
  };

  // Process chart data with historical + prediction data
  const processChartData = (historicalData, predictionData, injectedTodayStr = null) => {
    if (!historicalData || !Array.isArray(historicalData)) return [];
    
    // Process historical data with Number() parsing
    const closePrices = historicalData.map(item => Number(item.close) || 0);
    const ma10 = calculateMA(closePrices, 10);
    const ma30 = calculateMA(closePrices, 30);
    const ma90 = calculateMA(closePrices, 90);
    
    let processedData = historicalData.map((item, index) => {
      const iso = toISODate(item.date);
      const tsVal = parseISOToUTCms(iso);
      return {
        date: iso,
        ts: tsVal,
        close: Number(item.close) || 0,
        ma10: ma10[index],
        ma30: ma30[index],
        ma90: ma90[index],
        type: 'historical'
      };
    }).filter(item => Number.isFinite(item.close) && item.close > 0);
    
    // Only add prediction data if has_enough_data is true
    if (predictionData && predictionData.has_enough_data !== false) {
      // Handle series data (historical line continuation) - series.close
      if (predictionData.series && Array.isArray(predictionData.series)) {
        const seriesData = predictionData.series
          .map((item, index) => {
            const iso = toISODate(item.date);
            const tsVal = parseISOToUTCms(iso);
            return {
              date: iso,
              ts: tsVal,
              close: Number(item.close) || 0,
              ma10: null, // No MA for prediction data
              ma30: null,
              ma90: null,
              type: 'series',
              predicted: true
            };
          })
          .filter(item => Number.isFinite(item.close)); // Only numeric points
        processedData = [...processedData, ...seriesData];
      }
      
      // Handle forecast data (dotted line, separate dataset) - forecast.price
      if (predictionData.forecast && Array.isArray(predictionData.forecast)) {
        const forecastData = predictionData.forecast
          .map((item, index) => {
            const iso = toISODate(item.date);
            const tsVal = parseISOToUTCms(iso);
            return {
              date: iso,
              ts: tsVal,
              forecast: Number(item.price) || Number(item.close) || 0, // Handle both price and close
              confLow: Number(item.conf_band?.low) || Number(item.conf_low) || 0,
              confHigh: Number(item.conf_band?.high) || Number(item.conf_high) || 0,
              type: 'forecast',
              isFuture: true
            };
          })
          .filter(item => Number.isFinite(item.forecast)); // Only numeric points
        processedData = [...processedData, ...forecastData];
      }
      
      // Alternative: Handle conf_band directly if available
      if (predictionData.conf_band && Array.isArray(predictionData.conf_band)) {
        const confBandData = predictionData.conf_band
          .map((item, index) => {
            const iso = toISODate(item.date);
            const tsVal = parseISOToUTCms(iso);
            return {
              date: iso,
              ts: tsVal,
              forecast: Number(item.price) || 0,
              confLow: Number(item.low) || 0,
              confHigh: Number(item.high) || 0,
              type: 'forecast',
              isFuture: true
            };
          })
          .filter(item => Number.isFinite(item.forecast)); // Only numeric points
        processedData = [...processedData, ...confBandData];
      }
    }
    
    // Inject today marker if missing to allow ReferenceLine to anchor
    const markerDate = injectedTodayStr || todayStr;
    if (markerDate && !processedData.some(d => d.date === markerDate)) {
      processedData.push({ date: markerDate, ts: todayTs || parseISOToUTCms(markerDate), type: 'marker' });
    }
    
    // Sort by ts for consistent domain
    processedData.sort((a, b) => {
      const ats = Number.isFinite(a.ts) ? a.ts : parseISOToUTCms(a.date) || 0;
      const bts = Number.isFinite(b.ts) ? b.ts : parseISOToUTCms(b.date) || 0;
      return ats - bts;
    });
    
    return processedData;
  };

  // Check requirements before prediction
  const checkRequirements = async () => {
    if (!user) return false;
    
    setLoadingRequirements(true);
    setError('');
    
    try {
      const requirements = await getRequirements({
        symbol,
        horizon: Number(horizon),
        token: user.token
      });
      
      console.log('[PredictNow] Requirements:', requirements);
      
      setHasEnoughData(requirements.has_enough_data || false);
      setDataRange(requirements.data_range || '');
      setDataStatus(requirements.status || '');
      
      return requirements.has_enough_data;
      
    } catch (error) {
      console.error('[PredictNow] Error checking requirements:', error);
      
      // Handle NOT_ENOUGH_HISTORY specifically
      if (error.message.includes('NOT_ENOUGH_HISTORY')) {
        setHasEnoughData(false);
        setDataStatus('insufficient');
        setError('Not enough historical data for prediction. Please fetch more data first.');
        return false;
      }
      
      setError(`Requirements check failed: ${error.message}`);
      return false;
    } finally {
      setLoadingRequirements(false);
    }
  };

  // Fetch historical data for chart
  const fetchHistoricalData = async () => {
    if (!user) return [];
    
    setLoadingHistorical(true);
    
    try {
      const data = await getHistoricalData({
        symbol,
        days: Math.max(horizon * 3, 365), // Get enough data for MA calculations
        token: user.token
      });
      
      console.log('[PredictNow] Historical data:', data);
      return data;
      
    } catch (error) {
      console.error('[PredictNow] Error fetching historical data:', error);
      setError(`Failed to fetch historical data: ${error.message}`);
      return [];
    } finally {
      setLoadingHistorical(false);
    }
  };

  // Ingest historical data
  const handleIngestHistory = async () => {
    if (!user) return;
    
    setIngestingHistory(true);
    setError('');
    
    try {
      // Calculate required days (horizon + buffer)
      const requiredDays = Math.max(horizon * 3, 365);
      
      await ingestHistory({
        symbol,
        days: requiredDays,
        token: user.token
      });
      
      // Wait a bit for ingestion to complete
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check requirements again
      const hasData = await checkRequirements();
      
      if (hasData) {
        // Fetch historical data and retry prediction
        const historicalData = await fetchHistoricalData();
        if (historicalData.length > 0) {
          // Automatically retry prediction after successful ingestion
          await handlePredict(historicalData);
        }
      }
      
    } catch (error) {
      console.error('[PredictNow] Error ingesting history:', error);
      setError(`Data ingestion failed: ${error.message}`);
    } finally {
      setIngestingHistory(false);
    }
  };

  // Main prediction function
  const handlePredict = async (existingHistoricalData = null) => {
    if (!user) return;
    
    // Clear previous errors and results
    setError('');
    setFormErrors({});
    setPrediction(null);
    setChartData([]);
    setMeta(null);
    
    // Validate form
    if (!validateForm()) {
      return;
    }
    
    // Check requirements first
    const canPredict = await checkRequirements();
    
    if (!canPredict) {
      return; // Error already set by checkRequirements
    }
    
    setLoadingPredict(true);
    
    try {
      const resp = await postPredict({
        symbol, 
        horizon: Number(horizon), 
        token: user.token
      });
      
      // Raw console.log of response
      console.log('Raw prediction response:', resp);
      
      // Handle NOT_ENOUGH_HISTORY error
      if (resp.error === 'NOT_ENOUGH_HISTORY' || resp.status === 'NOT_ENOUGH_HISTORY') {
        setHasEnoughData(false);
        setDataStatus('insufficient');
        setError('Not enough historical data for prediction. Please fetch more data first.');
        setLoadingPredict(false);
        return;
      }
      
      // Strict parsing with validation
      const pp = Number(resp.predicted_price);
      const conf = Number(resp.confidence);
      
      // Only show card if predicted_price is valid
      if (!Number.isFinite(pp)) {
        setError('Invalid prediction data received from server');
        setLoadingPredict(false);
        return;
      }
      
      // Fallback direction logic
      const direction = resp.direction ?? (pp > (resp.meta?.last_close || 0) ? "up" : pp < (resp.meta?.last_close || 0) ? "down" : "flat");
      
      // Create validated prediction object
      const validatedPrediction = {
        ...resp,
        predicted_price: pp,
        confidence: conf,
        direction: direction
      };
      
      console.log('[PredictNow] Validated prediction result:', validatedPrediction);
      console.log('[PredictNow] Advice field:', validatedPrediction.advice);
      console.log('[PredictNow] Full response structure:', JSON.stringify(validatedPrediction, null, 2));
      
      setPrediction(validatedPrediction);
      setMeta(validatedPrediction.meta || null);
      
      // Today/meta
      let isoToday = validatedPrediction.meta?.today || validatedPrediction.meta?.today_str ? toISODate(validatedPrediction.meta.today || validatedPrediction.meta.today_str) : null;
      if (!isoToday) {
        // Fallback to GET
        const t = await fetchTodayViaGet(symbol);
        isoToday = t?.iso || null;
        if (!isoToday && Array.isArray(validatedPrediction.series) && validatedPrediction.series.length > 0) {
          // Fallback to last series.date
          const lastSeriesISO = toISODate(validatedPrediction.series[validatedPrediction.series.length - 1].date);
          isoToday = lastSeriesISO;
        }
      }
      if (isoToday) {
        setTodayStr(isoToday);
        setTodayTs(parseISOToUTCms(isoToday));
      }
      
      // Get historical data for chart
      let historicalData = existingHistoricalData;
      if (!historicalData) {
        historicalData = await fetchHistoricalData();
      }
      
      // Process chart data with both historical and prediction data
      if (historicalData.length > 0) {
        const processedData = processChartData(historicalData, validatedPrediction, isoToday || null);
        setChartData(processedData);
      }
      
    } catch (error) {
      console.error('[PredictNow] Error making prediction:', error);
      
      // Handle NOT_ENOUGH_HISTORY specifically
      if (error.message.includes('NOT_ENOUGH_HISTORY')) {
        setHasEnoughData(false);
        setDataStatus('insufficient');
        setError('Not enough historical data for prediction. Please fetch more data first.');
        // Clear forecast datasets
        setChartData(prevData => prevData.filter(item => item.type === 'historical'));
      } else {
        const errorMessage = error.message || 'Prediction failed';
        setError(errorMessage.length > 120 ? errorMessage.substring(0, 120) + '...' : errorMessage);
      }
    } finally {
      setLoadingPredict(false);
    }
  };

  // Refresh prediction with same parameters
  const handleRefresh = async () => {
    const historicalData = await fetchHistoricalData();
    await handlePredict(historicalData);
  };

  // Copy advice to clipboard
  const handleCopyAdvice = async () => {
    const adviceText = prediction?.advice || generateAdvice(prediction);
    if (adviceText) {
      try {
        await navigator.clipboard.writeText(adviceText);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      } catch (error) {
        console.error('Failed to copy to clipboard:', error);
      }
    }
  };

  // Save advice to local notes
  const handleSaveToNotes = () => {
    const adviceText = prediction?.advice || generateAdvice(prediction);
    if (adviceText) {
      const timestamp = new Date().toLocaleString('tr-TR');
      const noteEntry = `[${timestamp}] ${prediction.symbol || symbol} - ${horizon} day prediction:\n${adviceText}\n\n`;
      
      const existingNotes = localStorage.getItem('userNotes') || '';
      const updatedNotes = existingNotes + noteEntry;
      
      localStorage.setItem('userNotes', updatedNotes);
      setUserNotes(updatedNotes);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    }
  };

  // Load existing notes on component mount
  useEffect(() => {
    const savedNotes = localStorage.getItem('userNotes') || '';
    setUserNotes(savedNotes);
  }, []);

  // Generate advice based on prediction data
  const generateAdvice = (predictionData) => {
    if (!predictionData) return null;
    
    const { direction, confidence, predicted_price, symbol, horizon } = predictionData;
    const currentPrice = Number(predictionData.current_price) || 0;
    const confidenceValue = Number(confidence);
    const confPercent = Number.isFinite(confidenceValue)
      ? (confidenceValue <= 1 ? confidenceValue * 100 : confidenceValue)
      : 0;
    const predictedPriceValue = Number(predicted_price) || 0;
    
    // Professional but accessible explanation about how our system works
    let systemExplanation = `Our prediction system analyzes ${symbol}'s historical performance to identify market patterns and trends. `;
    systemExplanation += `It examines price movements, trading volumes, and market indicators to provide comprehensive forecasts. `;
    
    let advice = `${systemExplanation}Based on our ${horizon}-day prediction analysis for ${symbol}, `;
    
    if (direction && confPercent) {
      if (direction.toLowerCase() === 'up') {
        if (confPercent >= 80) {
          advice += `we have high confidence (${confPercent.toFixed(1)}%) that the price will increase. `;
          advice += `The predicted price is $${formatNumber(predictedPriceValue)}, indicating strong upward potential. `;
          advice += `This analysis suggests favorable market conditions, though we recommend conducting additional research.`;
        } else if (confPercent >= 60) {
          advice += `we have moderate confidence (${confPercent.toFixed(1)}%) that the price will increase. `;
          advice += `The predicted price is $${formatNumber(predictedPriceValue)}. `;
          advice += `This indicates positive market signals with some uncertainty. `;
          advice += `We recommend monitoring market developments closely.`;
        } else {
          advice += `we have low confidence (${confPercent.toFixed(1)}%) that the price will increase. `;
          advice += `The predicted price is $${formatNumber(predictedPriceValue)}. `;
          advice += `Please exercise caution as our confidence level is limited. `;
          advice += `Market conditions appear uncertain at this time.`;
        }
      } else if (direction.toLowerCase() === 'down') {
        if (confPercent >= 80) {
          advice += `we have high confidence (${confPercent.toFixed(1)}%) that the price will decrease. `;
          advice += `The predicted price is $${formatNumber(predictedPriceValue)}, suggesting a potential decline. `;
          advice += `This analysis indicates challenging market conditions. `;
          advice += `We recommend careful consideration and additional market research.`;
        } else if (confPercent >= 60) {
          advice += `we have moderate confidence (${confPercent.toFixed(1)}%) that the price will decrease. `;
          advice += `The predicted price is $${formatNumber(predictedPriceValue)}. `;
          advice += `This suggests a possible downward trend with some uncertainty. `;
          advice += `We recommend monitoring market conditions and key price levels.`;
        } else {
          advice += `we have low confidence (${confPercent.toFixed(1)}%) that the price will decrease. `;
          advice += `The predicted price is $${formatNumber(predictedPriceValue)}. `;
          advice += `Please exercise caution as our confidence level is limited. `;
          advice += `Market signals are currently unclear.`;
        }
      } else if (direction.toLowerCase() === 'neutral') {
        advice += `we predict a neutral trend with ${confPercent.toFixed(1)}% confidence. `;
        advice += `The predicted price is $${formatNumber(predictedPriceValue)}. `;
        advice += `This suggests market stability over the next ${horizon} days. `;
        advice += `Prices may remain within a narrow range without significant directional movement.`;
      }
    } else {
      advice += `we have insufficient information to provide a reliable prediction. `;
      if (predictedPriceValue) {
        advice += `The predicted price is $${formatNumber(predictedPriceValue)}. `;
      }
      advice += `Our system requires additional data to generate accurate forecasts. `;
      advice += `We recommend considering multiple factors before making any investment decisions.`;
    }
    
    return advice;
  };

  // Get direction icon and color
  const getDirectionInfo = (direction) => {
    switch (direction?.toLowerCase()) {
      case 'up':
        return { icon: <FiTrendingUp />, color: '#10b981', label: 'UP' };
      case 'down':
        return { icon: <FiTrendingDown />, color: '#ef4444', label: 'DOWN' };
      case 'neutral':
        return { icon: <FiMinus />, color: '#f59e0b', label: 'NEUTRAL' };
      default:
        return { icon: <FiMinus />, color: '#6b7280', label: 'UNKNOWN' };
    }
  };

  // Get confidence level color
  const getConfidenceColor = (confidence) => {
    if (confidence >= 80) return '#10b981';
    if (confidence >= 60) return '#f59e0b';
    if (confidence >= 40) return '#f97316';
    return '#ef4444';
  };

  // Format number for display
  const formatNumber = (num) => {
    if (typeof num !== 'number' || isNaN(num)) return 'N/A';
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Format date for display and normalization
  const toISODate = (value) => {
    try {
      const d = new Date(value);
      if (isNaN(d.getTime())) return String(value);
      return d.toISOString().slice(0, 10);
    } catch {
      return String(value);
    }
  };

  const formatDate = (dateStr) => {
    try {
      return new Date(dateStr).toISOString().slice(0, 10); // Ensure ISO format for XAxis
    } catch {
      return dateStr;
    }
  };

  // UTC helpers for ts-based axes
  const MS_DAY = 24 * 60 * 60 * 1000;
  const parseISOToUTCms = (iso) => {
    if (!iso || typeof iso !== 'string') return null;
    const parts = iso.split('-');
    if (parts.length !== 3) return null;
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    const d = Number(parts[2]);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
    return Date.UTC(y, m - 1, d);
  };
  const formatTs = (ts) => {
    if (!Number.isFinite(ts)) return '';
    return new Date(ts).toISOString().slice(0, 10);
  };

  // Get data status display
  const getDataStatusDisplay = () => {
    if (!hasEnoughData) {
      return (
        <div className="insufficient-data">
          <div className="status-badge error">
            <FiAlertCircle />
            Not enough history
          </div>
          <p>Historical data is insufficient for {horizon}-day prediction</p>
          {dataStatus && <p className="data-status-detail">Status: {dataStatus}</p>}
          <button
            onClick={handleIngestHistory}
            disabled={ingestingHistory}
            className="fetch-history-button"
          >
            {ingestingHistory ? (
              <>
                <div className="loading-spinner"></div>
                Fetching...
              </>
            ) : (
              <>
                <FiDownload />
                Fetch History
              </>
            )}
          </button>
        </div>
      );
    }
    
    if (dataRange) {
      return (
        <div className="sufficient-data">
          <div className="status-badge success">
            <FiCheckCircle />
            Data available
          </div>
          <p>Data range: {dataRange}</p>
          {dataStatus && <p className="data-status-detail">Status: {dataStatus}</p>}
        </div>
      );
    }
    
    return null;
  };

  // Get comprehensive chart data for the new chart section
  const getComprehensiveChartData = () => {
    if (!prediction) return [];
    
    let data = [];
    
    // Add historical data first
    if (chartData.length > 0) {
      const historicalData = chartData.filter(item => item.type === 'historical').map(item => ({
        date: toISODate(item.date),
        ts: Number.isFinite(item.ts) ? item.ts : parseISOToUTCms(toISODate(item.date)),
        close: item.close,
        ma10: item.ma10,
        ma30: item.ma30,
        ma90: item.ma90,
        isFuture: false,
        isHistorical: true,
        isSeries: false
      }));
      data = [...data, ...historicalData];
    }
    
    const todayTsLocal = Number.isFinite(todayTs) ? todayTs : (todayStr ? parseISOToUTCms(todayStr) : null);
    
    // Only add prediction data if has_enough_data is true
    if (prediction.has_enough_data !== false) {
      // Add series data (historical line continuation) - series.close as main line
      if (prediction.series && Array.isArray(prediction.series)) {
        const seriesData = prediction.series
          .map(item => {
            const iso = toISODate(item.date);
            return {
              date: iso,
              ts: parseISOToUTCms(iso),
              close: Number(item.close) || 0, // This is the main line
              ma10: null,
              ma30: null,
              ma90: null,
              isFuture: false,
              isHistorical: false,
              isSeries: true
            };
          })
          .filter(item => Number.isFinite(item.close) && item.close > 0); // Only valid numeric points
        data = [...data, ...seriesData];
      }
      
      // Add forecast data (dotted line, only after today) - forecast.price
      if (prediction.forecast && Array.isArray(prediction.forecast)) {
        const forecastData = prediction.forecast
          .map(item => {
            const iso = toISODate(item.date);
            return {
              date: iso,
              ts: parseISOToUTCms(iso),
              close: null, // No historical close for forecast
              ma10: null,
              ma30: null,
              ma90: null,
              forecast: Number(item.price) || Number(item.close) || 0,
              confHigh: Number(item.conf_band?.high) || Number(item.conf_high) || 0,
              confLow: Number(item.conf_band?.low) || Number(item.conf_low) || 0,
              isFuture: true,
              isHistorical: false,
              isSeries: false,
              isForecast: true
            };
          })
          .filter(item => (!todayTsLocal || (Number.isFinite(item.ts) && item.ts > todayTsLocal)) && Number.isFinite(item.forecast) && item.forecast > 0); // Only valid numeric points
        data = [...data, ...forecastData];
      }
      
      // Alternative: Handle conf_band directly if available (future only)
      if (prediction.conf_band && Array.isArray(prediction.conf_band)) {
        const confBandData = prediction.conf_band
          .map(item => {
            const iso = toISODate(item.date);
            return {
              date: iso,
              ts: parseISOToUTCms(iso),
              close: null,
              ma10: null,
              ma30: null,
              ma90: null,
              forecast: Number(item.price) || 0,
              confHigh: Number(item.high) || 0,
              confLow: Number(item.low) || 0,
              isFuture: true,
              isHistorical: false,
              isSeries: false,
              isForecast: true
            };
          })
          .filter(item => (!todayTsLocal || (Number.isFinite(item.ts) && item.ts > todayTsLocal)) && Number.isFinite(item.forecast) && item.forecast > 0); // Only valid numeric points
        data = [...data, ...confBandData];
      }
    }
    
    // Inject today marker if missing to allow ReferenceLine to anchor
    if (todayStr && !data.some(d => d.date === todayStr)) {
      data.push({ date: todayStr, ts: todayTs || parseISOToUTCms(todayStr), isMarker: true });
    }
    
    // Sort data by ts to ensure proper order
    data.sort((a, b) => {
      const ats = Number.isFinite(a.ts) ? a.ts : parseISOToUTCms(a.date) || 0;
      const bts = Number.isFinite(b.ts) ? b.ts : parseISOToUTCms(b.date) || 0;
      return ats - bts;
    });
    
    return data;
  };

  // Compute explicit X domain (UTC ms) using meta hints and data fallbacks
  const getXDomainTs = () => {
    // Meta-based preferred bounds
    const metaFirst = meta?.first_date ? parseISOToUTCms(toISODate(meta.first_date)) : null;
    const metaLastForecast = meta?.last_forecast_date ? parseISOToUTCms(toISODate(meta.last_forecast_date)) : null;

    // Data-based fallbacks
    const leftTs = (chartData || []).map(d => Number.isFinite(d.ts) ? d.ts : parseISOToUTCms(toISODate(d.date))).filter(Number.isFinite);
    const rightData = getComprehensiveChartData();
    const rightTs = rightData.map(d => Number.isFinite(d.ts) ? d.ts : parseISOToUTCms(toISODate(d.date))).filter(Number.isFinite);
    const allTs = [...leftTs, ...rightTs];
    const dataMinTs = allTs.length ? Math.min(...allTs) : null;
    const dataMaxTs = allTs.length ? Math.max(...allTs) : null;

    // Use the widest range available to ensure historical MA window is visible
    const minCandidates = [metaFirst, dataMinTs].filter(Number.isFinite);
    const maxCandidates = [metaLastForecast, dataMaxTs].filter(Number.isFinite);
    const minTs = minCandidates.length ? Math.min(...minCandidates) : (todayTs ?? 0);
    const maxTs = maxCandidates.length ? Math.max(...maxCandidates) : (todayTs ?? 0);

    return [minTs ?? todayTs ?? 0, maxTs ?? todayTs ?? 0];
  };

  // Dynamic tick count by horizon (optional cleanliness)
  const getXTicksCount = () => {
    if (horizon <= 14) return 8;
    if (horizon <= 60) return 6;
    if (horizon <= 180) return 6;
    return 6;
  };

  // Fallback: GET predict to fetch meta.today if missing in POST response
  const fetchTodayViaGet = async (sym) => {
    try {
      const resp = await authenticatedFetch(`${API_ENDPOINTS.ML_PREDICT}?symbol=${encodeURIComponent(sym)}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      const t = data?.meta?.today || data?.meta?.today_str;
      if (t) {
        const iso = toISODate(t);
        const ts = parseISOToUTCms(iso);
        setTodayStr(iso);
        setTodayTs(ts);
        return { iso, ts };
      }
      return null;
    } catch (e) {
      return null;
    }
  };

  return (
    <div className="predict-now-page">
      <div className="predict-content">
        <div className="predict-header">
          <h1>Predict Now</h1>
          <p>Machine Learning powered cryptocurrency price prediction and analysis</p>
        </div>
        
        {/* Two Column Layout - Full Page Width */}
        <div className="two-column-layout">
          {/* Left Column - Form & Prediction Result */}
          <div className="left-column">
        <div className="predict-form-container">
          <div className="predict-form">
            <div className="form-group">
                  <label htmlFor="symbol-select">Select Asset:</label>
              <select
                id="symbol-select"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                    disabled={loadingPredict || loadingRequirements}
                className={formErrors.symbol ? 'error' : ''}
              >
                    <option value="" disabled>Choose an asset...</option>
                {symbols.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              {formErrors.symbol && (
                <span className="error-text">
                  <FiAlertCircle /> {formErrors.symbol}
                </span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="horizon-input">Horizon (days):</label>
              <div className="horizon-input-container">
                <input
                  id="horizon-input"
                  type="number"
                  min="1"
                  max="365"
                  value={horizon}
                  onChange={(e) => setHorizon(parseInt(e.target.value) || 1)}
                      disabled={loadingPredict || loadingRequirements}
                  className={formErrors.horizon ? 'error' : ''}
                  placeholder="Enter days (1-365)"
                />
                <div className="horizon-presets">
                  <button
                    type="button"
                    onClick={() => setHorizon(7)}
                        disabled={loadingPredict || loadingRequirements}
                    className={`preset-btn ${horizon === 7 ? 'active' : ''}`}
                  >
                    7d
                  </button>
                  <button
                    type="button"
                    onClick={() => setHorizon(30)}
                        disabled={loadingPredict || loadingRequirements}
                        className={`preset-btn ${horizon === 7 ? 'active' : ''}`}
                  >
                    30d
                  </button>
                  <button
                    type="button"
                    onClick={() => setHorizon(90)}
                        disabled={loadingPredict || loadingRequirements}
                    className={`preset-btn ${horizon === 90 ? 'active' : ''}`}
                  >
                    90d
                  </button>
                  <button
                    type="button"
                    onClick={() => setHorizon(180)}
                        disabled={loadingPredict || loadingRequirements}
                    className={`preset-btn ${horizon === 180 ? 'active' : ''}`}
                  >
                    180d
                  </button>
                  <button
                    type="button"
                    onClick={() => setHorizon(365)}
                        disabled={loadingPredict || loadingRequirements}
                    className={`preset-btn ${horizon === 365 ? 'active' : ''}`}
                  >
                    1y
                  </button>
                </div>
              </div>
              {formErrors.horizon && (
                <span className="error-text">
                  <FiAlertCircle /> {formErrors.horizon}
                </span>
              )}
            </div>

                <div className="form-buttons">
            <button
                    onClick={() => handlePredict()}
                    disabled={loadingPredict || loadingRequirements || ingestingHistory}
              className="predict-button"
            >
                    {loadingPredict ? (
                <>
                  <div className="loading-spinner"></div>
                  Predicting...
                </>
              ) : (
                <>
                  <FiTrendingUp />
                        Predict Tomorrow's Trend
                </>
              )}
            </button>

                  {prediction && (
                    <button
                      onClick={handleRefresh}
                      disabled={loadingPredict || loadingRequirements || ingestingHistory}
                      className="refresh-button"
                    >
                      <FiRefreshCw />
                      Refresh
                    </button>
                  )}
                </div>
              </div>

              {/* Data Status */}
              <div className="data-status">
                {getDataStatusDisplay()}
          </div>

          {/* Error Display */}
          {error && (
            <div className="error-message">
              <FiAlertCircle />
              <p>{error}</p>
                  <button onClick={() => setError('')} className="dismiss-error">
                    <FiX />
                  </button>
                </div>
              )}
            </div>

          {/* Prediction Result */}
          {prediction && (
            <div className="prediction-result">
              {/* Insufficient Data Warning */}
              {prediction.has_enough_data === false && (
                <div className="insufficient-data-warning">
                  <FiAlertCircle />
                  <span>Insufficient data for reliable prediction</span>
                </div>
              )}
              
              <div className="result-header">
                <h3>Prediction Result</h3>
                <div className="result-badge">
                  <FiCheckCircle />
                  Success
                </div>
              </div>
              
              <div className="kpi-grid">
                <div className="kpi-card">
                    <div className="kpi-icon">
                      <FiBarChart2 size={24} />
                    </div>
                  <div className="kpi-content">
                    <span className="kpi-label">Symbol</span>
                      <span className="kpi-value">{prediction.symbol || symbol}</span>
                    </div>
                </div>
                
                <div className="kpi-card">
                    <div className="kpi-icon">
                      <FiCalendar size={24} />
                    </div>
                  <div className="kpi-content">
                    <span className="kpi-label">Prediction Date</span>
                      <span className="kpi-value">{prediction.prediction_date ? formatDate(prediction.prediction_date) : 'N/A'}</span>
                    </div>
                </div>
                
                <div className="kpi-card">
                    <div className="kpi-icon">
                      <FiDollarSign size={24} />
                    </div>
                  <div className="kpi-content">
                    <span className="kpi-label">Predicted Price</span>
                      <span className="kpi-value">
                        {Number.isFinite(Number(prediction.predicted_price)) ? 
                          `$${Number(prediction.predicted_price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 
                          '—'
                        }
                      </span>
                      {(() => {
                        const curr = Number(prediction.current_price);
                        const pred = Number(prediction.predicted_price);
                        if (!Number.isFinite(curr) || !Number.isFinite(pred)) return null;
                        const deltaAbs = pred - curr;
                        const deltaPct = curr !== 0 ? ((pred - curr) / curr) * 100 : null;
                        if (!Number.isFinite(deltaPct)) return null;
                        const color = deltaPct > 0 ? '#10b981' : deltaPct < 0 ? '#ef4444' : '#6b7280';
                        const sign = deltaPct > 0 ? '+' : deltaPct < 0 ? '' : '';
                        return (
                          <span
                            className="delta-badge"
                            style={{
                              marginTop: '4px',
                              display: 'inline-block',
                              padding: '1px 6px',
                              borderRadius: '999px',
                              backgroundColor: color,
                              color: '#ffffff',
                              fontSize: '11px',
                              fontWeight: 500
                            }}
                          >
                            {`${sign}${Math.abs(deltaPct).toFixed(1)}% (${sign}$${Math.abs(deltaAbs).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`}
                          </span>
                        );
                      })()}
                  </div>
                  </div>

                  {/* Current Price with Delta */}
                  <div className="kpi-card">
                    <div className="kpi-icon">
                      <FiDollarSign size={24} />
                    </div>
                    <div className="kpi-content">
                      <span className="kpi-label">Current Price</span>
                      {(() => {
                        const curr = Number(prediction.current_price);
                        if (!Number.isFinite(curr)) {
                          return <span className="kpi-value">N/A</span>;
                        }
                        return <span className="kpi-value">{`$${curr.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</span>;
                      })()}
                    </div>
                  </div>

                  <div className="kpi-card">
                    <div className="kpi-icon">
                      <FiTrendingUp size={24} />
                    </div>
                    <div className="kpi-content">
                      <span className="kpi-label">Horizon</span>
                      <span className="kpi-value">{horizon} days</span>
                    </div>
                </div>
              </div>

              <div className="direction-confidence-section">
                <div className="direction-card">
                  <h4>Direction</h4>
                  <div className="direction-badge">
                    {(() => {
                      const { icon, color, label } = getDirectionInfo(prediction.direction);
                      return (
                        <>
                          <span className="direction-icon" style={{ color }}>
                            {icon}
                          </span>
                          <span className="direction-text" style={{ color }}>
                            {label}
                          </span>
                        </>
                      );
                    })()}
                  </div>
                </div>

                <div className="confidence-card">
                  <h4>Confidence</h4>
                  <div className="confidence-bar-container">
                    <div className="confidence-bar">
                      <div 
                        className="confidence-fill"
                        style={{ 
                          width: `${(() => {
                            const conf = Number(prediction.confidence);
                            if (!Number.isFinite(conf)) return 0;
                            // Convert 0-1 to 0-100 if needed
                            return conf <= 1 ? conf * 100 : conf;
                          })()}%`,
                          backgroundColor: getConfidenceColor((() => {
                            const conf = Number(prediction.confidence);
                            if (!Number.isFinite(conf)) return 0;
                            return conf <= 1 ? conf * 100 : conf;
                          })())
                        }}
                      ></div>
                    </div>
                    <span className="confidence-percentage">
                      {(() => {
                        const conf = Number(prediction.confidence);
                        if (!Number.isFinite(conf)) return '—';
                        // Convert 0-1 to 0-100 if needed
                        const confPercent = conf <= 1 ? conf * 100 : conf;
                        return `${confPercent.toFixed(1)}%`;
                      })()}
                    </span>
                  </div>
                  <div className="confidence-level">
                    {(() => {
                      const conf = Number(prediction.confidence);
                      if (!Number.isFinite(conf)) return 'Unknown';
                      // Convert 0-1 to 0-100 if needed
                      const confPercent = conf <= 1 ? conf * 100 : conf;
                      
                      if (confPercent >= 80) return 'High Confidence';
                      if (confPercent >= 60) return 'Medium Confidence';
                      if (confPercent >= 40) return 'Low Confidence';
                      return 'Very Low Confidence';
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}

            {/* Chart Section */}
            {chartData.length > 0 && (
              <div className="chart-section">
                {/* Chart Header */}
                <div className="chart-header">
                  <h3>Price Chart - {symbol}</h3>
                </div>

                {/* Chart Controls */}
                <div className="chart-controls">
                  <div className="chart-controls-left">
                    <h3>Chart Settings</h3>
                  </div>
                  <div className="chart-controls-right">
                    <label className="chart-checkbox">
                      <input
                        type="checkbox"
                        checked={showMA10}
                        onChange={(e) => setShowMA10(e.target.checked)}
                      />
                      MA10
                    </label>
                    <label className="chart-checkbox">
                      <input
                        type="checkbox"
                        checked={showMA30}
                        onChange={(e) => setShowMA30(e.target.checked)}
                      />
                      MA30
                    </label>
                    <label className="chart-checkbox">
                      <input
                        type="checkbox"
                        checked={showMA90}
                        onChange={(e) => setShowMA90(e.target.checked)}
                      />
                      MA90
                    </label>
                    <label className="chart-checkbox">
                      <input
                        type="checkbox"
                        checked={showPrediction}
                        onChange={(e) => setShowPrediction(e.target.checked)}
                      />
                      Forecast
                    </label>
                  </div>
                </div>
                
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={chartData} margin={{ left: 0, right: 0, top: 32, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    
                    {/* Today Reference Line from backend meta */}
                    {Number.isFinite(todayTs) && (
                      <ReferenceLine
                        x={todayTs}
                        stroke="#60a5fa"
                        strokeWidth={4}
                        isFront={true}
                        ifOverflow="extendDomain"
                        label={{ value: 'Today', position: 'top', dy: -10, fill: '#60a5fa', fontSize: 12 }}
                      />
                    )}
                    
                    <XAxis 
                      dataKey="ts" 
                      type="number"
                      scale="time"
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      interval="preserveStartEnd"
                      tickFormatter={(value) => formatTs(value)}
                      allowDuplicatedCategory={false}
                      domain={getXDomainTs()}
                      allowDataOverflow={true}
                      tickCount={getXTicksCount()}
                      padding={{ left: 0, right: 0 }}
                    />
                    <YAxis 
                      tickFormatter={(value) => `$${formatNumber(value)}`}
                    />
                    <Tooltip 
                      formatter={(value, name, ctx) => [
                        name === 'close' ? `$${formatNumber(value)}` : formatNumber(value), 
                        name === 'close' ? 'Close Price' : 
                        name === 'ma10' ? 'MA10' :
                        name === 'ma30' ? 'MA30' :
                        name === 'ma90' ? 'MA90' : name
                      ]}
                      labelFormatter={(label) => {
                        const curr = Number(prediction?.current_price);
                        if (Number.isFinite(todayTs) && label === todayTs && Number.isFinite(curr)) {
                          return `Today • Close: $${curr.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                        }
                        return `Date: ${formatTs(label)}`;
                      }}
                    />
                    
                    {/* Custom Legend with Better Spacing */}
                    <Legend 
                      content={({ payload }) => (
                        <div className="custom-legend">
                          {payload?.map((entry, index) => {
                            // Only show legend items for visible datasets
                            if (entry.value === 'MA10' && !showMA10) return null;
                            if (entry.value === 'MA30' && !showMA30) return null;
                            if (entry.value === 'MA90' && !showMA90) return null;
                            if (entry.value === 'Forecast' && !showPrediction) return null;
                            
                            return (
                              <div key={index} className="legend-item">
                                <div
                                  className="legend-color"
                                  style={{ backgroundColor: entry.color }}
                                />
                                <span className="legend-label">{entry.value}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    />
                    
                    {/* Meta Note Display */}
                    {meta?.note && (
                      <text
                        x="50%"
                        y="25"
                        textAnchor="middle"
                        fill="#66ccff"
                        fontSize="14"
                        fontWeight="500"
                        className="meta-note"
                      >
                        {meta.note}
                      </text>
                    )}
                    
                    {/* Single Close Price Line (historical + series combined) */}
                    <Line
                      type="monotone"
                      dataKey="close"
                      stroke="#8884d8"
                      strokeWidth={2}
                      dot={false}
                      name="Close"
                      data={chartData.filter(item => item.type === 'historical' || item.type === 'series')}
                      connectNulls={true}
                    />
                    
                    {/* Moving Averages - only render if data exists */}
                    {showMA10 && chartData.some(item => item.ma10 !== null) && (
                      <Line
                        type="monotone"
                        dataKey="ma10"
                        stroke="#82ca9d"
                        strokeWidth={1.5}
                        dot={false}
                        name="MA10"
                        data={chartData.filter(item => item.ma10 !== null)}
                        connectNulls={true}
                      />
                    )}
                    
                    {showMA30 && chartData.some(item => item.ma30 !== null) && (
                      <Line
                        type="monotone"
                        dataKey="ma30"
                        stroke="#ffc658"
                        strokeWidth={1.5}
                        dot={false}
                        name="MA30"
                        data={chartData.filter(item => item.ma30 !== null)}
                        connectNulls={true}
                      />
                    )}
                    
                    {showMA90 && chartData.some(item => item.ma90 !== null) && (
                      <Line
                        type="monotone"
                        dataKey="ma90"
                        stroke="#ff7300"
                        strokeWidth={1.5}
                        dot={false}
                        name="MA90"
                        data={chartData.filter(item => item.ma90 !== null)}
                        connectNulls={true}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
                
              </div>
            )}
          </div>

          {/* Right Column - Auto-generated Summary */}
          <div className="right-column">
            <div className="advice-section">
              <div className="advice-header">
                <h4>Auto-Generated Summary</h4>
                <div className="advice-actions">
                  <button
                    onClick={handleCopyAdvice}
                    className={`action-button copy-button ${copySuccess ? 'success' : ''}`}
                    title="Copy to clipboard"
                  >
                    <FiCopy size={16} />
                    {copySuccess ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
              
              <div className="advice-content">
                {prediction?.advice ? (
                  <p className="advice-text">{prediction.advice}</p>
                ) : (
                  <p className="advice-text">{generateAdvice(prediction)}</p>
                )}
              </div>
              
              <div className="advice-disclaimer">
                <small>This content is not investment advice.</small>
              </div>
            </div>

            {/* Comprehensive Chart Section */}
            {prediction && (
              <div className="comprehensive-chart-section">
                <div className="chart-header">
                  <h4>Price Analysis & Forecast</h4>
                  <div className="chart-controls">
                    <label className="chart-checkbox">
                      <input
                        type="checkbox"
                        checked={showMA10}
                        onChange={(e) => setShowMA10(e.target.checked)}
                      />
                      MA10
                    </label>
                    <label className="chart-checkbox">
                      <input
                        type="checkbox"
                        checked={showMA30}
                        onChange={(e) => setShowMA30(e.target.checked)}
                      />
                      MA30
                    </label>
                    <label className="chart-checkbox">
                      <input
                        type="checkbox"
                        checked={showMA90}
                        onChange={(e) => setShowMA90(e.target.checked)}
                      />
                      MA90
                    </label>
                  </div>
                </div>

                {/* Chart */}
                <ResponsiveContainer width="100%" height={400}>
                  <ComposedChart data={getComprehensiveChartData()} margin={{ left: 0, right: 0, top: 32, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    
                    {/* Today Reference Line from backend meta */}
                    {Number.isFinite(todayTs) && (
                      <ReferenceLine
                        x={todayTs}
                        stroke="#60a5fa"
                        strokeWidth={4}
                        isFront={true}
                        ifOverflow="extendDomain"
                        label={{ value: 'Today', position: 'top', dy: -10, fill: '#60a5fa', fontSize: 12 }}
                      />
                    )}
                    
                    <XAxis 
                      dataKey="ts" 
                      type="number"
                      scale="time"
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      interval="preserveStartEnd"
                      tickFormatter={(value) => formatTs(value)}
                      allowDuplicatedCategory={false}
                      domain={getXDomainTs()}
                      allowDataOverflow={true}
                      tickCount={getXTicksCount()}
                      padding={{ left: 0, right: 0 }}
                    />
                    <YAxis 
                      tickFormatter={(value) => `$${formatNumber(value)}`}
                    />
                    <Tooltip 
                      formatter={(value, name) => [
                        name === 'close' ? `$${formatNumber(value)}` : 
                        name === 'forecast' ? `$${formatNumber(value)}` :
                        name === 'ma10' ? `$${formatNumber(value)}` :
                        name === 'ma30' ? `$${formatNumber(value)}` :
                        name === 'ma90' ? `$${formatNumber(value)}` : 
                        `$${formatNumber(value)}`
                      ]}
                      labelFormatter={(label) => `Date: ${formatTs(label)}`}
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          const isFuture = data.isFuture;
                          
                          return (
                            <div className="custom-tooltip">
                              <p className="tooltip-date">
                                {Number.isFinite(todayTs) && label === todayTs && Number.isFinite(Number(prediction?.current_price))
                                  ? `Today • Close: $${Number(prediction.current_price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                  : formatTs(label)}
                              </p>
                              {payload.map((entry, index) => {
                                if (entry.dataKey === 'close' && !isFuture) {
                                  return (
                                    <p key={index} style={{ color: entry.color }}>
                                      {entry.name}: ${formatNumber(entry.value)}
                                    </p>
                                  );
                                }
                                if (entry.dataKey === 'forecast' && isFuture) {
                                  return (
                                    <p key={index} style={{ color: entry.color }}>
                                      Forecast: ${formatNumber(entry.value)}
                                    </p>
                                  );
                                }
                                if (['ma10', 'ma30', 'ma90'].includes(entry.dataKey) && !isFuture) {
                                  return (
                                    <p key={index} style={{ color: entry.color }}>
                                      {entry.name}: ${formatNumber(entry.value)}
                                    </p>
                                  );
                                }
                                return null;
                              })}
                              {isFuture && data.confLow && data.confHigh && (
                                <>
                                  <p style={{ color: '#ff6b6b' }}>
                                    Low: ${formatNumber(data.confLow)}
                                  </p>
                                  <p style={{ color: '#ff6b6b' }}>
                                    High: ${formatNumber(data.confHigh)}
                                  </p>
                                </>
                              )}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend />
                    
                    {/* Main Close Price Line (series.close) */}
                    <Line
                      type="monotone"
                      dataKey="close"
                      stroke="#8884d8"
                      strokeWidth={3}
                      dot={false}
                      name="Close"
                      data={getComprehensiveChartData().filter(item => item.isHistorical || item.isSeries)}
                      connectNulls={true}
                    />
                    
                    {/* Moving Averages - only render if data exists and checkbox is checked */}
                    {showMA10 && getComprehensiveChartData().some(item => item.ma10 !== null) && (
                      <Line
                        type="monotone"
                        dataKey="ma10"
                        stroke="#82ca9d"
                        strokeWidth={2}
                        dot={false}
                        name="MA10"
                        data={getComprehensiveChartData().filter(item => item.ma10 !== null)}
                        connectNulls={true}
                      />
                    )}
                    
                    {showMA30 && getComprehensiveChartData().some(item => item.ma30 !== null) && (
                      <Line
                        type="monotone"
                        dataKey="ma30"
                        stroke="#ffc658"
                        strokeWidth={2}
                        dot={false}
                        name="MA30"
                        data={getComprehensiveChartData().filter(item => item.ma30 !== null)}
                        connectNulls={true}
                      />
                    )}
                    
                    {showMA90 && getComprehensiveChartData().some(item => item.ma90 !== null) && (
                      <Line
                        type="monotone"
                        dataKey="ma90"
                        stroke="#ff7300"
                        strokeWidth={2}
                        dot={false}
                        name="MA90"
                        data={getComprehensiveChartData().filter(item => item.ma90 !== null)}
                        connectNulls={true}
                      />
                    )}
                    
                    {/* Forecast Line (dotted, only after today) */}
                    {showPrediction && getComprehensiveChartData().some(item => item.isForecast) && (
                      <Line
                        type="monotone"
                        dataKey="forecast"
                        stroke="#ff6b6b"
                        strokeWidth={3}
                        strokeDasharray="6,4"
                        dot={false}
                        name="Forecast"
                        data={getComprehensiveChartData().filter(item => item.isForecast)}
                        connectNulls={true}
                      />
                    )}
                    
                    {/* Confidence Band Area - fill between conf_band.low and conf_band.high */}
                    {showPrediction && getComprehensiveChartData().some(item => item.isForecast && item.confLow && item.confHigh) && (
                      <Area
                        type="monotone"
                        dataKey="confHigh"
                        stroke="none"
                        fill="rgba(255, 107, 107, 0.3)"
                        name="Band"
                        data={getComprehensiveChartData().filter(item => item.isForecast)}
                        fillOpacity={0.3}
                        stackId="confidence"
                      />
                    )}
                    
                    {/* Confidence Band Low - to create proper area fill */}
                    {showPrediction && getComprehensiveChartData().some(item => item.isForecast && item.confLow && item.confHigh) && (
                      <Area
                        type="monotone"
                        dataKey="confLow"
                        stroke="none"
                        fill="rgba(255, 107, 107, 0.3)"
                        name=""
                        data={getComprehensiveChartData().filter(item => item.isForecast)}
                        fillOpacity={0.3}
                        stackId="confidence"
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Loading States */}
        {(loadingRequirements || loadingPredict || ingestingHistory || loadingHistorical) && (
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
            <p>
              {loadingRequirements && 'Checking data requirements...'}
              {loadingPredict && 'Making prediction...'}
              {ingestingHistory && 'Fetching historical data...'}
              {loadingHistorical && 'Loading chart data...'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PredictNow; 