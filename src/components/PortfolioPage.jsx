import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { API_ENDPOINTS } from '../config';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './PortfolioPage.css';

const PortfolioPage = () => {
  const { authenticatedFetch } = useAuth();
  const [simulations, setSimulations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [simulationToDelete, setSimulationToDelete] = useState(null);
  const [showChartModal, setShowChartModal] = useState(false);
  const [chartData, setChartData] = useState(null);
  const [chartMeta, setChartMeta] = useState(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState('');

  useEffect(() => {
    fetchSimulations();
  }, []);

  // Close modal on ESC key
  useEffect(() => {
    const handleEsc = (event) => {
      if (event.keyCode === 27) {
        setShowChartModal(false);
        setShowDeleteModal(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const fetchSimulations = async () => {
    setLoading(true);
    setError('');

    try {
      console.log('Fetching portfolio data from Django backend...');
      
      // Use authenticatedFetch for proper authentication
      const response = await authenticatedFetch(API_ENDPOINTS.SIMULATION_LIST, {
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
      console.log('Data received:', data);
      
      // Handle paginated response format from Django REST Framework
      let simulationsData = [];
      if (data && Array.isArray(data)) {
        // Direct array response (legacy format)
        simulationsData = data;
      } else if (data && data.results && Array.isArray(data.results)) {
        // Paginated response format
        simulationsData = data.results;
      } else if (data && typeof data === 'object') {
        // Single object or other format
        console.warn('Unexpected data format, attempting to extract simulations:', data);
        simulationsData = [];
      } else {
        console.error('Unexpected data format:', data);
        setError('Received unexpected data format from server.');
        return;
      }
      
      // Sort by percentage gain descending (falling back to computed percentage if missing)
      const sorted = [...simulationsData]
        .map(sim => {
          const percentageGain = (sim.percentage_gain !== undefined && sim.percentage_gain !== null)
            ? Number(sim.percentage_gain)
            : (Number(sim.investment_amount) ? (Number(sim.total_profit) / Number(sim.investment_amount)) * 100 : -Infinity);
          const pct = Number.isFinite(percentageGain) ? percentageGain : -Infinity;
          return { ...sim, _sort_pct: pct };
        })
        .sort((a, b) => b._sort_pct - a._sort_pct);

      setSimulations(sorted);
    } catch (error) {
      console.error('Error fetching portfolio data:', error);
      
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error('Error response data:', error.response.data);
        console.error('Error response status:', error.response.status);
        console.error('Error response headers:', error.response.headers);
        setError(`Server error: ${error.response.status} - ${error.response.data?.message || 'Unknown error'}`);
      } else if (error.request) {
        // The request was made but no response was received
        console.error('No response received:', error.request);
        setError('No response from server. Please check if the backend is running.');
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error('Error setting up request:', error.message);
        setError(`Request error: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const deleteSimulation = async (id) => {
    setDeletingId(id);
    
    try {
      const response = await authenticatedFetch(`${API_ENDPOINTS.SIMULATION_LIST}${id}/`, {
        method: 'DELETE',
        headers: {
          'Accept': 'application/json'
        }
      });

      console.log('Delete response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Remove the deleted simulation from the list
      setSimulations(prevSimulations => 
        prevSimulations.filter(sim => sim.id !== id)
      );
      
      alert('Simulation deleted successfully!');
    } catch (error) {
      console.error('Error deleting simulation:', error);
      alert(`Failed to delete simulation: ${error.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteClick = (simulation) => {
    setSimulationToDelete(simulation);
    setShowDeleteModal(true);
  };

  const handleChartClick = async (simulation) => {
    setChartError('');
    // Determine if chart is available according to backend or embedded data
    const hasChartFlag = (simulation.has_chart === true) || (simulation.chart_series && simulation.chart_series.length > 0);

    // Open modal immediately to show loading state
    setShowChartModal(true);
    setChartLoading(true);
    try {
      if (simulation.chart_series && simulation.chart_series.length > 0) {
        // Use embedded series
        setChartData(simulation.chart_series);
        setChartMeta({
          symbol: simulation.chart_meta?.symbol || simulation.asset_symbol || simulation.ticker || 'Unknown',
          startDate: simulation.chart_meta?.range_start || simulation.investment_date || simulation.chart_series[0]?.date,
          endDate: simulation.chart_meta?.range_end || simulation.chart_series[simulation.chart_series.length - 1]?.date
        });
      } else if (hasChartFlag && simulation.id) {
        // Fetch from server if backend indicates chart exists
        const url = API_ENDPOINTS.SIMULATION_CHART ? API_ENDPOINTS.SIMULATION_CHART(simulation.id) : `${API_ENDPOINTS.SIMULATIONS}${simulation.id}/chart`;
        const resp = await authenticatedFetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } });
        if (!resp.ok) {
          throw new Error(`Failed to fetch chart (HTTP ${resp.status})`);
        }
        const json = await resp.json();
        const series = Array.isArray(json) ? json : (json.series || json.chart_series || []);
        if (!series || series.length === 0) {
          setChartData([]);
          setChartError('No chart saved with this simulation. Run a new simulation and Save.');
        } else {
          setChartData(series);
        }
        const meta = (!Array.isArray(json) && (json.meta || json.chart_meta)) || simulation.chart_meta || {};
        setChartMeta({
          symbol: meta.symbol || simulation.asset_symbol || simulation.ticker || 'Unknown',
          startDate: meta.range_start || simulation.investment_date || series?.[0]?.date,
          endDate: meta.range_end || series?.[series.length - 1]?.date
        });
      } else {
        // No chart available
        setChartData([]);
        setChartMeta({
          symbol: simulation.asset_symbol || simulation.ticker || 'Unknown',
          startDate: simulation.investment_date,
          endDate: simulation.investment_date
        });
        setChartError('No chart saved with this simulation. Run a new simulation and Save.');
      }
    } catch (e) {
      console.error('Chart fetch error:', e);
      setChartData([]);
      setChartError('No chart saved with this simulation. Run a new simulation and Save.');
      setChartMeta({
        symbol: simulation.asset_symbol || simulation.ticker || 'Unknown',
        startDate: simulation.investment_date,
        endDate: simulation.investment_date
      });
    } finally {
      setChartLoading(false);
    }
  };

  const confirmDelete = () => {
    if (simulationToDelete) {
      deleteSimulation(simulationToDelete.id);
      setShowDeleteModal(false);
      setSimulationToDelete(null);
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setSimulationToDelete(null);
  };

  const closeChartModal = () => {
    setShowChartModal(false);
    setChartData(null);
    setChartMeta(null);
    setChartError('');
    setChartLoading(false);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatPercentage = (percentage) => {
    return `${percentage >= 0 ? '+' : ''}${percentage.toFixed(2)}%`;
  };

  const formatChartDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="portfolio-page">
        <div className="portfolio-container">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading your portfolio...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="portfolio-page">
        <div className="portfolio-container">
          <div className="error-container">
            <h2>Error Loading Portfolio</h2>
            <p className="error-message">{error}</p>
            <div className="debug-info">
              <p><strong>Debug Info:</strong></p>
              <p>• Backend URL: /api/simulations/ (via Vite proxy)</p>
              <p>• Check if backend server is running on port 8000</p>
              <p>• Check browser console for detailed error logs</p>
            </div>
            <button onClick={fetchSimulations} className="retry-button">
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="portfolio-page">
      <div className="portfolio-container">
        <div className="portfolio-header">
          <h1>My Portfolio</h1>
          <p>Your saved investment simulations</p>
        </div>

        {simulations.length === 0 ? (
          <div className="empty-portfolio">
            <h2>No simulations found</h2>
            <p>You haven't saved any investment simulations yet.</p>
            <p>Run a simulation and save it to see it here!</p>
          </div>
        ) : (
          <div className="portfolio-table-container">
            <table className="portfolio-table">
              <thead>
                <tr>
                  <th className="text-center">Asset</th>
                  <th className="text-center">Investment Amount</th>
                  <th className="text-center">Start Date</th>
                  <th className="text-center">Current Value</th>
                  <th className="text-center">Profit/Loss</th>
                  <th className="text-center">Percentage</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {simulations.map((simulation, index) => {
                  // Calculate percentage gain if not provided by API
                  const percentageGain = simulation.percentage_gain !== undefined 
                    ? simulation.percentage_gain 
                    : ((simulation.total_profit / simulation.investment_amount) * 100);
                  
                  // Get asset symbol from various possible fields
                  const assetSymbol = simulation.asset_symbol || simulation.ticker || 'N/A';
                  
                  // Check if chart data exists/available
                  const hasChartData = (simulation.has_chart === true) || (simulation.chart_series && simulation.chart_series.length > 0);
                  
                  return (
                    <tr key={simulation.id || index} className={index % 2 === 0 ? 'even-row' : 'odd-row'}>
                      <td className="asset-cell text-center">
                        <span className="asset-symbol">{assetSymbol}</span>
                      </td>
                      <td className="amount-cell text-center">
                        {formatCurrency(simulation.investment_amount)}
                      </td>
                      <td className="date-cell text-center">
                        {formatDate(simulation.investment_date)}
                      </td>
                      <td className="value-cell text-center">
                        {formatCurrency(simulation.current_value)}
                      </td>
                      <td className={`profit-loss-cell text-center ${simulation.total_profit >= 0 ? 'profit' : 'loss'}`}>
                        {simulation.total_profit >= 0 ? '+' : ''}{formatCurrency(simulation.total_profit)}
                      </td>
                      <td className={`percentage-cell text-center ${percentageGain >= 0 ? 'profit' : 'loss'}`}>
                        {formatPercentage(percentageGain)}
                      </td>
                      <td className="actions-cell text-center">
                        <div className="action-buttons">
                          <button
                            onClick={() => handleChartClick(simulation)}
                            disabled={!hasChartData}
                            className="chart-button"
                            title={hasChartData ? "See chart" : "No chart saved"}
                          >
                            See chart
                          </button>
                          <button
                            onClick={() => handleDeleteClick(simulation)}
                            disabled={deletingId === simulation.id}
                            className="delete-button"
                          >
                            {deletingId === simulation.id ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showDeleteModal && simulationToDelete && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Confirm Deletion</h2>
            <p>Are you sure you want to delete the simulation for {simulationToDelete.asset_symbol || simulationToDelete.ticker}?</p>
            <div className="modal-actions">
              <button onClick={confirmDelete} className="confirm-button">Delete</button>
              <button onClick={cancelDelete} className="cancel-button">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showChartModal && (
        <div className="modal-overlay" onClick={closeChartModal}>
          <div className="modal-content chart-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{chartMeta?.symbol || 'Chart'}</h2>
              <button onClick={closeChartModal} className="close-button">&times;</button>
            </div>
            <div className="modal-body">
              {chartMeta && (
                <p className="chart-date-range">
                  {chartMeta.startDate ? formatChartDate(chartMeta.startDate) : ''}
                  {chartMeta.startDate || chartMeta.endDate ? ' - ' : ''}
                  {chartMeta.endDate ? formatChartDate(chartMeta.endDate) : ''}
                </p>
              )}

              {chartLoading ? (
                <div className="loading-container">
                  <div className="loading-spinner"></div>
                  <p>Loading chart...</p>
                </div>
              ) : (chartData && chartData.length > 0) ? (
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={formatChartDate}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis 
                        tickFormatter={(value) => `$${Number(value).toFixed(2)}`}
                      />
                      <Tooltip 
                        labelFormatter={formatChartDate}
                        formatter={(value) => [`$${Number(value).toFixed(2)}`, 'Close']}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="close" 
                        stroke="#3b82f6" 
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="error-container" style={{ marginTop: 12 }}>
                  {chartError || 'No chart saved with this simulation. Run a new simulation and Save.'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PortfolioPage; 