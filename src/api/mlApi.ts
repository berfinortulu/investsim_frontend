export async function postPredict({symbol, horizon, token}: {
  symbol: string;
  horizon: number;
  token: string;
}) {
  const res = await fetch(`/api/ml/predict/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Token ${token}`
    },
    body: JSON.stringify({symbol, horizon})
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    
    // Handle specific error cases
    if (errorText.includes('NOT_ENOUGH_HISTORY')) {
      throw new Error('NOT_ENOUGH_HISTORY: Insufficient historical data for prediction');
    }
    
    throw new Error(errorText || 'Prediction failed');
  }
  
  return res.json();
}

export async function getRequirements({symbol, horizon, token}: {
  symbol: string;
  horizon: number;
  token: string;
}) {
  
  const res = await fetch(`/api/ml/predict/requirements?symbol=${symbol}&horizon=${horizon}`, {
    method: "GET",
    headers: {
      "Authorization": `Token ${token}`
    }
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || 'Failed to get requirements');
  }
  
  return res.json();
}

export async function ingestHistory({symbol, days, token}: {
  symbol: string;
  days: number;
  token: string;
}) {
  const res = await fetch(`/api/ml/ingest/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Token ${token}`
    },
    body: JSON.stringify({symbol, days})
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || 'Failed to ingest history');
  }
  
  return res.json();
}

// New function to get historical data for chart
export async function getHistoricalData({symbol, days, token}: {
  symbol: string;
  days: number;
  token: string;
}) {
  const res = await fetch(`/api/ml/history/?symbol=${symbol}&limit=${days}`, {
    method: "GET",
    headers: {
      "Authorization": `Token ${token}`
    }
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || 'Failed to fetch historical data');
  }
  
  return res.json();
} 