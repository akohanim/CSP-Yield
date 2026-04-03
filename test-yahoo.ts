import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

async function test() {
  try {
    const ticker = 'SPY';
    console.log(`Fetching options for ${ticker}...`);
    const result = await yahooFinance.options(ticker) as any;
    console.log('Keys:', Object.keys(result));
    console.log('ExpirationDates length:', result.expirationDates?.length);
    if (result.expirationDates) {
      console.log('First 5 expirationDates:', result.expirationDates.slice(0, 5));
    }
    console.log('Options length:', result.options?.length);
    if (result.options && result.options[0] && result.options[0].puts && result.options[0].puts[0]) {
      const firstPut = result.options[0].puts[0];
      console.log('First put keys:', Object.keys(firstPut));
      console.log('First put delta:', firstPut.delta);
      console.log('First put theta:', firstPut.theta);
      console.log('First put impliedVolatility:', firstPut.impliedVolatility);
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
