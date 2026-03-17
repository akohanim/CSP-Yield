# CSP Validator Pro 📈

> **"Get paid to buy the stocks you love at the prices you want."**

CSP Validator Pro is a high-performance web application designed for options traders to validate **Cash-Secured Put (CSP)** yield targets against real-time institutional data. Built with React, Tailwind CSS, and powered by **Databento** and **Google Gemini**, this tool transforms raw options chains into actionable investment insights.

---

## 🎬 App Demo & Visual Tour

### 1. Interactive Validation Dashboard
The core of the app is a high-contrast, dark-mode dashboard that provides instant feedback on trade viability.
- **Real-Time Indicators**: The "Validation Check" card glows emerald when your yield targets are met and transitions to a warning rose hue when the market premium falls short.
- **Live Progress Bars**: Watch your "Yield Progress" fill up in real-time as you adjust your target APY sliders.

### 2. The "Sliding Bar" Expiration Selector
Instead of a clunky dropdown, we use a custom horizontal carousel.
- **Quick Scoping**: Effortlessly scroll through weeks and months of option cycles.
- **DTE Tracking**: Each card clearly displays the "Days to Expiration" (DTE) so you can optimize for time-decay (Theta).

### 3. AI-Powered Risk Intelligence
Leverage the power of Gemini 3 Flash to get a professional "Second Opinion" on your trade.
- **Deep Context**: The AI looks at your strike, the current stock price, and the annualized yield to warn you about potential "Value Traps" or excessive downside risk.

---

## 💎 The Investment Strategy: The Power of CSP

The **Cash-Secured Put** is a conservative, income-generating strategy favored by institutional and retail "Wheel Strategy" traders. 

### Why sell Puts?
1. **Income Generation**: You collect an immediate cash "premium" for promising to buy a stock at a specific price (the Strike).
2. **Buy at a Discount**: If the stock drops, you are "assigned" the shares at your strike price—effectively buying a dip you were already waiting for.
3. **The Yield Edge**: By targeting a specific **Annualized Percentage Yield (APY)**, you treat your capital like a high-yield engine rather than a speculative bet.

---

## 🚀 Key Features

- **Databento HF Engine**: Integrated with Databento's high-fidelity market snapshots for institutional-grade accuracy.
- **Dynamic APY Validation**: Move the sliders to set your target yield (e.g., 15% APY) and your desired "Margin of Safety" (e.g., 10% OTM discount).
- **Horizontal Expiration Carousel**: A sleek, "sliding bar" UI for quickly scanning different Time-to-Expiration (DTE) cycles.
- **AI Risk Analysis (Gemini 3)**: Integrated with Google's Gemini 3 Flash model for low-latency trade reasoning.
- **Network Request Monitor**: A built-in debug console to track Databento API traffic and data integrity.

---

## 🛠 Technical Stack

- **Frontend**: React 19, TypeScript
- **Styling**: Tailwind CSS (Sleek Dark Mode UI)
- **Data Visuals**: Recharts
- **Market Data**: Databento REST API (XNAS.ITCH & OPRA datasets)
- **Artificial Intelligence**: Google Gemini API (@google/genai)

---

## 📦 Installation & Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/csp-validator-pro.git
   cd csp-validator-pro
   ```

2. **Configure Environment Variables**:
   Create a `.env` file in the root directory and add your API keys:
   ```env
   # Required for AI Analysis
   API_KEY=your_gemini_api_key
   ```

3. **Install Dependencies**:
   ```bash
   npm install
   ```

4. **Run Development Server**:
   ```bash
   npm run dev
   ```

---

## ⚠️ Disclaimer

*This application is for educational and informational purposes only. Options trading involves significant risk. Past performance is not indicative of future results. Always consult with a financial advisor before making investment decisions.*

---

**Developed with ❤️ for the Trading Community.**