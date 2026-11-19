/**
 * Pure TypeScript Technical Indicator Calculations for Interactive Canvas Chart.
 * SMA, EMA, Bollinger Bands, RSI, MACD, Fibonacci.
 */

export interface PricePoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface LinePoint {
  time: string;
  value: number;
}

export interface BollingerPoint {
  time: string;
  upper: number;
  middle: number;
  lower: number;
}

export interface MacdPoint {
  time: string;
  macd: number;
  signal: number;
  histogram: number;
}

export interface FibonacciLevel {
  label: string;
  ratio: number;
  price: number;
}

export function calculateSMA(data: PricePoint[], period: number = 30): LinePoint[] {
  const result: LinePoint[] = [];
  if (data.length < period) return result;

  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i].close;
    if (i >= period - 1) {
      if (i >= period) {
        sum -= data[i - period].close;
      }
      result.push({
        time: data[i].time,
        value: Number((sum / period).toFixed(3)),
      });
    }
  }
  return result;
}

export function calculateEMA(data: PricePoint[], period: number = 100): LinePoint[] {
  const result: LinePoint[] = [];
  if (data.length < period) return result;

  const multiplier = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i].close;
  }
  let prevEma = sum / period;
  result.push({ time: data[period - 1].time, value: Number(prevEma.toFixed(3)) });

  for (let i = period; i < data.length; i++) {
    const currentEma = (data[i].close - prevEma) * multiplier + prevEma;
    result.push({ time: data[i].time, value: Number(currentEma.toFixed(3)) });
    prevEma = currentEma;
  }
  return result;
}

export function calculateBollingerBands(
  data: PricePoint[],
  period: number = 30,
  stdDevMultiplier: number = 2
): BollingerPoint[] {
  const result: BollingerPoint[] = [];
  if (data.length < period) return result;

  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1);
    const mean = slice.reduce((acc, curr) => acc + curr.close, 0) / period;
    const variance = slice.reduce((acc, curr) => acc + Math.pow(curr.close - mean, 2), 0) / period;
    const stdDev = Math.sqrt(variance);

    result.push({
      time: data[i].time,
      upper: Number((mean + stdDevMultiplier * stdDev).toFixed(3)),
      middle: Number(mean.toFixed(3)),
      lower: Number((mean - stdDevMultiplier * stdDev).toFixed(3)),
    });
  }
  return result;
}

export function calculateRSI(data: PricePoint[], period: number = 13): LinePoint[] {
  const result: LinePoint[] = [];
  if (data.length <= period) return result;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = data[i].close - data[i - 1].close;
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  let rsi = 100 - 100 / (1 + rs);
  result.push({ time: data[period].time, value: Number(rsi.toFixed(2)) });

  for (let i = period + 1; i < data.length; i++) {
    const diff = data[i].close - data[i - 1].close;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi = 100 - 100 / (1 + rs);
    result.push({ time: data[i].time, value: Number(rsi.toFixed(2)) });
  }

  return result;
}

export function calculateMACD(
  data: PricePoint[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MacdPoint[] {
  const result: MacdPoint[] = [];
  if (data.length < slowPeriod + signalPeriod) return result;

  // EMA fast & slow
  const fastMultiplier = 2 / (fastPeriod + 1);
  const slowMultiplier = 2 / (slowPeriod + 1);
  const signalMultiplier = 2 / (signalPeriod + 1);

  let fastSum = 0;
  for (let i = 0; i < fastPeriod; i++) fastSum += data[i].close;
  let fastEma = fastSum / fastPeriod;

  let slowSum = 0;
  for (let i = 0; i < slowPeriod; i++) slowSum += data[i].close;
  let slowEma = slowSum / slowPeriod;

  // Track fast EMA forward to slowPeriod
  for (let i = fastPeriod; i < slowPeriod; i++) {
    fastEma = (data[i].close - fastEma) * fastMultiplier + fastEma;
  }

  const macdValues: { time: string; macd: number }[] = [];
  macdValues.push({ time: data[slowPeriod - 1].time, macd: fastEma - slowEma });

  for (let i = slowPeriod; i < data.length; i++) {
    fastEma = (data[i].close - fastEma) * fastMultiplier + fastEma;
    slowEma = (data[i].close - slowEma) * slowMultiplier + slowEma;
    macdValues.push({ time: data[i].time, macd: fastEma - slowEma });
  }

  if (macdValues.length < signalPeriod) return result;

  let signalSum = 0;
  for (let i = 0; i < signalPeriod; i++) signalSum += macdValues[i].macd;
  let signalEma = signalSum / signalPeriod;

  result.push({
    time: macdValues[signalPeriod - 1].time,
    macd: Number(macdValues[signalPeriod - 1].macd.toFixed(3)),
    signal: Number(signalEma.toFixed(3)),
    histogram: Number((macdValues[signalPeriod - 1].macd - signalEma).toFixed(3)),
  });

  for (let i = signalPeriod; i < macdValues.length; i++) {
    signalEma = (macdValues[i].macd - signalEma) * signalMultiplier + signalEma;
    const m = macdValues[i].macd;
    result.push({
      time: macdValues[i].time,
      macd: Number(m.toFixed(3)),
      signal: Number(signalEma.toFixed(3)),
      histogram: Number((m - signalEma).toFixed(3)),
    });
  }

  return result;
}

export function calculateFibonacciLevels(high: number, low: number): FibonacciLevel[] {
  const diff = high - low;
  const ratios = [
    { label: '0.0% (High)', ratio: 0 },
    { label: '23.6%', ratio: 0.236 },
    { label: '38.2%', ratio: 0.382 },
    { label: '50.0%', ratio: 0.5 },
    { label: '61.8%', ratio: 0.618 },
    { label: '78.6%', ratio: 0.786 },
    { label: '100.0% (Low)', ratio: 1.0 },
  ];

  return ratios.map((r) => ({
    label: r.label,
    ratio: r.ratio,
    price: Number((high - diff * r.ratio).toFixed(3)),
  }));
}
