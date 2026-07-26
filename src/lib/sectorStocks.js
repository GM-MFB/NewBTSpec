export const SECTORS = [
  {
    name: 'Technology', stocks: [
      { sym: 'AAPL', name: 'Apple' }, { sym: 'MSFT', name: 'Microsoft' }, { sym: 'GOOGL', name: 'Alphabet' },
      { sym: 'META', name: 'Meta Platforms' }, { sym: 'ORCL', name: 'Oracle' }, { sym: 'ADBE', name: 'Adobe' },
      { sym: 'CRM', name: 'Salesforce' }, { sym: 'IBM', name: 'IBM' }, { sym: 'INTU', name: 'Intuit' },
      { sym: 'NOW', name: 'ServiceNow' }, { sym: 'SAP', name: 'SAP' }, { sym: 'UBER', name: 'Uber' },
    ],
  },
  {
    name: 'Semiconductors', stocks: [
      { sym: 'NVDA', name: 'NVIDIA' }, { sym: 'AVGO', name: 'Broadcom' }, { sym: 'AMD', name: 'AMD' },
      { sym: 'QCOM', name: 'Qualcomm' }, { sym: 'TXN', name: 'Texas Instruments' }, { sym: 'INTC', name: 'Intel' },
      { sym: 'MU', name: 'Micron' }, { sym: 'AMAT', name: 'Applied Materials' }, { sym: 'LRCX', name: 'Lam Research' },
      { sym: 'ASML', name: 'ASML' }, { sym: 'TSM', name: 'Taiwan Semiconductor' },
    ],
  },
  {
    name: 'Healthcare', stocks: [
      { sym: 'UNH', name: 'UnitedHealth' }, { sym: 'JNJ', name: 'Johnson & Johnson' }, { sym: 'LLY', name: 'Eli Lilly' },
      { sym: 'ABBV', name: 'AbbVie' }, { sym: 'MRK', name: 'Merck' }, { sym: 'TMO', name: 'Thermo Fisher' },
      { sym: 'ABT', name: 'Abbott' }, { sym: 'PFE', name: 'Pfizer' }, { sym: 'DHR', name: 'Danaher' },
      { sym: 'CVS', name: 'CVS Health' },
    ],
  },
  {
    name: 'Biotech & Pharma', stocks: [
      { sym: 'AMGN', name: 'Amgen' }, { sym: 'GILD', name: 'Gilead Sciences' }, { sym: 'VRTX', name: 'Vertex Pharma' },
      { sym: 'REGN', name: 'Regeneron' }, { sym: 'BIIB', name: 'Biogen' }, { sym: 'MRNA', name: 'Moderna' },
      { sym: 'BNTX', name: 'BioNTech' }, { sym: 'ILMN', name: 'Illumina' },
    ],
  },
  {
    name: 'Financial Services', stocks: [
      { sym: 'JPM', name: 'JPMorgan Chase' }, { sym: 'BAC', name: 'Bank of America' }, { sym: 'WFC', name: 'Wells Fargo' },
      { sym: 'GS', name: 'Goldman Sachs' }, { sym: 'MS', name: 'Morgan Stanley' }, { sym: 'V', name: 'Visa' },
      { sym: 'MA', name: 'Mastercard' }, { sym: 'AXP', name: 'American Express' }, { sym: 'C', name: 'Citigroup' },
      { sym: 'SCHW', name: 'Charles Schwab' },
    ],
  },
  {
    name: 'Consumer Discretionary', stocks: [
      { sym: 'AMZN', name: 'Amazon' }, { sym: 'TSLA', name: 'Tesla' }, { sym: 'HD', name: 'Home Depot' },
      { sym: 'MCD', name: "McDonald's" }, { sym: 'NKE', name: 'Nike' }, { sym: 'SBUX', name: 'Starbucks' },
      { sym: 'LOW', name: "Lowe's" }, { sym: 'BKNG', name: 'Booking Holdings' }, { sym: 'TJX', name: 'TJX Companies' },
    ],
  },
  {
    name: 'Consumer Staples', stocks: [
      { sym: 'WMT', name: 'Walmart' }, { sym: 'PG', name: 'Procter & Gamble' }, { sym: 'KO', name: 'Coca-Cola' },
      { sym: 'PEP', name: 'PepsiCo' }, { sym: 'COST', name: 'Costco' }, { sym: 'PM', name: 'Philip Morris' },
      { sym: 'MDLZ', name: 'Mondelez' }, { sym: 'CL', name: 'Colgate-Palmolive' },
    ],
  },
  {
    name: 'Energy', stocks: [
      { sym: 'XOM', name: 'ExxonMobil' }, { sym: 'CVX', name: 'Chevron' }, { sym: 'COP', name: 'ConocoPhillips' },
      { sym: 'SLB', name: 'Schlumberger' }, { sym: 'EOG', name: 'EOG Resources' }, { sym: 'PSX', name: 'Phillips 66' },
      { sym: 'MPC', name: 'Marathon Petroleum' },
    ],
  },
  {
    name: 'Industrials', stocks: [
      { sym: 'CAT', name: 'Caterpillar' }, { sym: 'BA', name: 'Boeing' }, { sym: 'HON', name: 'Honeywell' },
      { sym: 'UPS', name: 'UPS' }, { sym: 'GE', name: 'GE Aerospace' }, { sym: 'RTX', name: 'RTX Corp' },
      { sym: 'DE', name: 'Deere & Co' }, { sym: 'LMT', name: 'Lockheed Martin' },
    ],
  },
  {
    name: 'Materials', stocks: [
      { sym: 'LIN', name: 'Linde' }, { sym: 'APD', name: 'Air Products' }, { sym: 'SHW', name: 'Sherwin-Williams' },
      { sym: 'FCX', name: 'Freeport-McMoRan' }, { sym: 'NEM', name: 'Newmont' }, { sym: 'ECL', name: 'Ecolab' },
    ],
  },
  {
    name: 'Real Estate', stocks: [
      { sym: 'PLD', name: 'Prologis' }, { sym: 'AMT', name: 'American Tower' }, { sym: 'EQIX', name: 'Equinix' },
      { sym: 'SPG', name: 'Simon Property' }, { sym: 'O', name: 'Realty Income' }, { sym: 'PSA', name: 'Public Storage' },
    ],
  },
  {
    name: 'Utilities', stocks: [
      { sym: 'NEE', name: 'NextEra Energy' }, { sym: 'DUK', name: 'Duke Energy' }, { sym: 'SO', name: 'Southern Co' },
      { sym: 'D', name: 'Dominion Energy' }, { sym: 'AEP', name: 'American Electric Power' },
    ],
  },
  {
    name: 'Communication Services', stocks: [
      { sym: 'GOOG', name: 'Alphabet (Class C)' }, { sym: 'NFLX', name: 'Netflix' }, { sym: 'DIS', name: 'Disney' },
      { sym: 'CMCSA', name: 'Comcast' }, { sym: 'T', name: 'AT&T' }, { sym: 'VZ', name: 'Verizon' },
      { sym: 'TMUS', name: 'T-Mobile' },
    ],
  },
]
