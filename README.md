# InvestSim - Virtual Investment Simulator

A React-based investment simulator that allows users to simulate historical investments and see potential returns.

## Features

- **Investment Simulation**: Simulate investments in stocks and cryptocurrencies
- **Real-time Data**: Uses FinancialModelingPrep API for live market data
- **Interactive Charts**: Visualize price movements with Recharts
- **Authentication**: User login/signup system
- **Portfolio Tracking**: Track your simulated investments
- **ML Predictions**: AI-powered market predictions (demo)
- **Turkish Lira Support**: All calculations and displays in TL currency

## Getting Real Market Data

To use real-time market data instead of demo data:

1. **Get a Free API Key**:
   - Go to: https://site.financialmodelingprep.com/developer/docs
   - Sign up for a free account
   - Copy your API key from the dashboard

2. **Configure Your API Key**:
   - Create a `.env` file in the project root
   - Add your API key: `VITE_FMP_API_KEY=your_actual_api_key_here`
   - Restart the development server

3. **Available Assets**:
   - **Stocks**: AAPL, GOOGL, TSLA, MSFT, AMZN, NVDA
   - **Cryptocurrencies**: BTC, ETH (prices converted to TL)

## Installation

```bash
npm install
npm run dev
```

## Environment Variables

Create a `.env` file in the project root:

```env
VITE_FMP_API_KEY=your_api_key_here
```

## Demo Mode

If no API key is provided, the app will use demo data with realistic price movements for demonstration purposes.

## Technologies Used

- React 18
- React Router DOM
- Recharts (for data visualization)
- Axios (for API calls)
- CSS3 with Flexbox/Grid
- FinancialModelingPrep API
