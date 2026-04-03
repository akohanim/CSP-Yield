
export interface OptionContract {
  ticker: string;
  strike: number;
  bid: number | null;
  ask: number | null;
  last: number | null;
  vol: number | null;
  oi: number | null;
  iv: number | null;
  delta: number | null;
  theta: number | null;
}

export interface ExpirationDate {
  date: string; // ISO date string YYYY-MM-DD
  daysToExpiration: number;
  strikes: OptionContract[];
}

export interface MarketData {
  ticker: string;
  currentPrice: number;
  lastUpdated: number;
  chain: ExpirationDate[];
}

export interface TradeInputs {
  ticker: string;
  targetAPY: number; // Percentage, e.g., 15
  targetDiscount: number; // Percentage, e.g., 10
  selectedDate: string | null; // Selected expiration date
  collateralYield: number; // APY on cash collateral, e.g., 4.5
}

export interface TradeCalculation {
  date: string; // ISO date string YYYY-MM-DD
  calculatedStrike: number;
  collateral: number;
  dte: number;
  requiredTotalCredit: number;
  actualTotalCredit: number; // Based on market data bid
  actualAPY: number; // Total APY (Option + Collateral)
  optionAPY: number; // APY from the option premium alone
  collateralAPY: number; // APY from the cash collateral
  netPurchasePrice: number;
  isTargetMet: boolean;
  actualPremiumPerShare: number;
  option: OptionContract;
}
