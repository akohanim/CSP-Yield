
import { GoogleGenAI } from "@google/genai";
import { TradeCalculation, TradeInputs } from '../types';

export const analyzeTradeRisk = async (
  inputs: TradeInputs,
  calculation: TradeCalculation,
  currentPrice: number
): Promise<string> => {
  // Always initialize with process.env.API_KEY
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    You are a senior financial risk analyst. Provide a concise risk assessment (max 100 words) for the following Cash-Secured Put (CSP) trade.
    
    Ticker: ${inputs.ticker}
    Current Price: $${currentPrice.toFixed(2)}
    
    Trade Details:
    - Strike Price: $${calculation.calculatedStrike}
    - Expiration (DTE): ${calculation.dte} days
    - Target Discount: ${inputs.targetDiscount}%
    - Collateral: $${calculation.collateral}
    - Premium Received: $${calculation.actualTotalCredit}
    - Annualized Return (APY): ${calculation.actualAPY.toFixed(2)}%
    
    Target APY was ${inputs.targetAPY}%. ${calculation.isTargetMet ? "Target Met." : "Target Missed."}
    
    Assess the downside risk, the quality of the premium relative to the risk, and the buffer against a drop. Be direct and professional.
  `;

  try {
    // Using gemini-3-pro-preview for advanced financial reasoning
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
    });
    // Use .text property getter as per guidelines
    return response.text || "No analysis generated.";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "Unable to generate analysis at this time.";
  }
};
