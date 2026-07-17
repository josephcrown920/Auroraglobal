/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
/**
 * NexusARB v3 — vendored trading-simulation engine (ported verbatim).
 *
 * Self-contained and off-domain from Aurora: it does not import or touch any
 * Aurora auth / credits / media / styling. Paper-simulation only — crypto
 * prices are live from CoinGecko (~30s), while forex & commodities use the
 * bundle's calibrated simulation and cross-pairs are derived from base prices.
 * The Bybit/Binance "Exchange" and Wise "Bank" panels are simulated stubs that
 * place NO real orders and move NO real money. Educational use only.
 *
 * Authored in a deliberately terse, untyped style; `@ts-nocheck` keeps this a
 * faithful port instead of retrofitting types onto third-party code. The clean,
 * typed route wrapper lives in `src/routes/nexusarb.tsx`.
 */
import { useState, useEffect, useRef, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════════════
// NEXUSARB v3 — 30+ PAIRS · GOLD/SILVER/OIL · BYBIT/BINANCE API
//              WISE BANK WITHDRAWAL · AI TRADING ASSISTANT
// ═══════════════════════════════════════════════════════════════════════

// ─── PAIR REGISTRY ──────────────────────────────────────────────────────
const CRYPTO_PAIRS = [
  { id: "BTC/USDT", cgId: "bitcoin", fee: 0.001, category: "crypto" },
  { id: "ETH/USDT", cgId: "ethereum", fee: 0.001, category: "crypto" },
  { id: "SOL/USDT", cgId: "solana", fee: 0.001, category: "crypto" },
  { id: "BNB/USDT", cgId: "binancecoin", fee: 0.001, category: "crypto" },
  { id: "XRP/USDT", cgId: "ripple", fee: 0.001, category: "crypto" },
  { id: "ADA/USDT", cgId: "cardano", fee: 0.001, category: "crypto" },
  { id: "AVAX/USDT", cgId: "avalanche-2", fee: 0.001, category: "crypto" },
  { id: "DOGE/USDT", cgId: "dogecoin", fee: 0.001, category: "crypto" },
  { id: "LINK/USDT", cgId: "chainlink", fee: 0.001, category: "crypto" },
  { id: "DOT/USDT", cgId: "polkadot", fee: 0.001, category: "crypto" },
  { id: "MATIC/USDT", cgId: "matic-network", fee: 0.001, category: "crypto" },
  { id: "LTC/USDT", cgId: "litecoin", fee: 0.001, category: "crypto" },
  { id: "ATOM/USDT", cgId: "cosmos", fee: 0.001, category: "crypto" },
  { id: "UNI/USDT", cgId: "uniswap", fee: 0.001, category: "crypto" },
  { id: "APT/USDT", cgId: "aptos", fee: 0.001, category: "crypto" },
];
const FOREX_PAIRS = [
  { id: "EUR/USD", fee: 0.0002, category: "forex" },
  { id: "GBP/USD", fee: 0.0002, category: "forex" },
  { id: "JPY/USD", fee: 0.0002, category: "forex" },
  { id: "CAD/USD", fee: 0.0002, category: "forex" },
  { id: "AUD/USD", fee: 0.0002, category: "forex" },
  { id: "CHF/USD", fee: 0.0002, category: "forex" },
  { id: "NGN/USD", fee: 0.0005, category: "forex" },
  { id: "ZAR/USD", fee: 0.0005, category: "forex" },
  { id: "GHS/USD", fee: 0.0005, category: "forex" },
];
const COMMODITY_PAIRS = [
  { id: "XAU/USD", cgId: "gold", fee: 0.0003, category: "commodity" },
  { id: "XAG/USD", cgId: "silver", fee: 0.0003, category: "commodity" },
  { id: "WTI/USD", cgId: "crude-oil-price", fee: 0.0004, category: "commodity" },
  { id: "BTC/ETH", cgId: null, fee: 0.001, category: "cross" },
  { id: "ETH/BNB", cgId: null, fee: 0.001, category: "cross" },
  { id: "SOL/ETH", cgId: null, fee: 0.001, category: "cross" },
];
const ALL_PAIRS = [...CRYPTO_PAIRS, ...FOREX_PAIRS, ...COMMODITY_PAIRS];

const SEED = {
  "BTC/USDT": 67420,
  "ETH/USDT": 3541,
  "SOL/USDT": 178.4,
  "BNB/USDT": 612.3,
  "XRP/USDT": 0.634,
  "ADA/USDT": 0.478,
  "AVAX/USDT": 38.92,
  "DOGE/USDT": 0.172,
  "LINK/USDT": 18.74,
  "DOT/USDT": 8.63,
  "MATIC/USDT": 0.891,
  "LTC/USDT": 84.2,
  "ATOM/USDT": 9.87,
  "UNI/USDT": 11.23,
  "APT/USDT": 9.14,
  "EUR/USD": 1.0842,
  "GBP/USD": 1.2734,
  "JPY/USD": 0.00669,
  "CAD/USD": 0.7381,
  "AUD/USD": 0.6512,
  "CHF/USD": 1.0981,
  "NGN/USD": 0.000641,
  "ZAR/USD": 0.0545,
  "GHS/USD": 0.0661,
  "XAU/USD": 2345.8,
  "XAG/USD": 29.42,
  "WTI/USD": 78.34,
  "BTC/ETH": 19.04,
  "ETH/BNB": 5.78,
  "SOL/ETH": 0.0504,
};

const RISK = {
  CAPITAL: 10000,
  MAX_DRAWDOWN: 0.08,
  MAX_LOSS_TRADE: 0.02,
  MIN_COMP: 0.35,
  EXIT_COMP: 0.25,
  SLIPPAGE: 0.0005,
  COOLDOWN: 6,
  RSI_OB: 72,
  RSI_OS: 32,
  BB_SQ: 0.015,
};

// ─── INDICATORS ─────────────────────────────────────────────────────────
const ema = (d, p) => {
  if (d.length < p) return null;
  const k = 2 / (p + 1);
  let e = d.slice(0, p).reduce((a, b) => a + b, 0) / p;
  for (let i = p; i < d.length; i++) e = d[i] * k + e * (1 - k);
  return e;
};
const emaSeries = (d, p) => {
  if (d.length < p) return [];
  const k = 2 / (p + 1);
  let e = d.slice(0, p).reduce((a, b) => a + b, 0) / p;
  const r = [e];
  for (let i = p; i < d.length; i++) {
    e = d[i] * k + e * (1 - k);
    r.push(e);
  }
  return r;
};
const rsi = (d, p = 14) => {
  if (d.length < p + 1) return null;
  const s = d.slice(-p - 1);
  let g = 0,
    l = 0;
  for (let i = 1; i < s.length; i++) {
    const x = s[i] - s[i - 1];
    if (x > 0) g += x;
    else l -= x;
  }
  if (l === 0) return 100;
  return 100 - 100 / (1 + g / p / (l / p));
};
const bb = (d, p = 20, sd = 2) => {
  if (d.length < p) return null;
  const s = d.slice(-p),
    m = s.reduce((a, b) => a + b, 0) / p,
    v = s.reduce((a, b) => a + (b - m) ** 2, 0) / p,
    std = Math.sqrt(v);
  return {
    upper: m + sd * std,
    middle: m,
    lower: m - sd * std,
    width: (2 * sd * std) / m,
    percentB: (d[d.length - 1] - (m - sd * std)) / (2 * sd * std),
  };
};
const macd = (d, f = 12, s = 26, sig = 9) => {
  if (d.length < s + sig) return null;
  const fe = emaSeries(d, f),
    se = emaSeries(d, s),
    off = fe.length - se.length,
    ml = se.map((x, i) => fe[i + off] - x),
    sl = emaSeries(ml, sig),
    h = ml.slice(-sl.length).map((m, i) => m - sl[i]);
  return {
    macd: ml[ml.length - 1],
    signal: sl[sl.length - 1],
    histogram: h[h.length - 1],
    crossover: h.length >= 2 && h[h.length - 1] > 0 && h[h.length - 2] <= 0,
    crossunder: h.length >= 2 && h[h.length - 1] < 0 && h[h.length - 2] >= 0,
  };
};
const atr = (d, p = 14) => {
  if (d.length < p + 1) return null;
  const trs = [];
  for (let i = 1; i < d.length; i++) {
    const h = d[i] * 1.005,
      l = d[i] * 0.995;
    trs.push(Math.max(h - l, Math.abs(h - d[i - 1]), Math.abs(l - d[i - 1])));
  }
  return trs.slice(-p).reduce((a, b) => a + b, 0) / p;
};
const mom = (d, p = 10) =>
  d.length < p + 1 ? 0 : (d[d.length - 1] - d[d.length - 1 - p]) / d[d.length - 1 - p];
const composite = ({ rsi: r, bb: b, macd: m, ema9, ema21, momentum }) => {
  if (!r || !b || !m || !ema9 || !ema21) return null;
  const rs =
    r < RISK.RSI_OS ? 1 : r > RISK.RSI_OB ? 0 : 1 - (r - RISK.RSI_OS) / (RISK.RSI_OB - RISK.RSI_OS);
  const es = (ema9 > ema21 ? 0.7 : 0) + Math.min((Math.abs(ema9 - ema21) / ema21) * 20, 0.3);
  const ms = m.crossover ? 1 : m.crossunder ? 0 : m.histogram > 0 ? 0.65 : 0.35;
  const bs = b.percentB < 0.2 ? 1 : b.percentB > 0.8 ? 0 : 1 - b.percentB;
  const mos = momentum > 0.01 ? 1 : momentum < -0.01 ? 0 : 0.5 + momentum * 50;
  return (
    (rs * 25 +
      es * 20 +
      Math.max(0, Math.min(1, ms)) * 25 +
      bs * 20 * (b.width < RISK.BB_SQ ? 1.15 : 1) +
      Math.max(0, Math.min(1, mos)) * 10) /
    100
  );
};

// ─── SIM ────────────────────────────────────────────────────────────────
const rn = () => {
  let u = 0,
    v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
const VOL = { crypto: 0.0022, forex: 0.00009, commodity: 0.0012, cross: 0.0025 };
const tickP = (p, cat) => p * Math.exp((VOL[cat] || 0.002) * rn());

// ─── FORMAT ─────────────────────────────────────────────────────────────
const fU = (n) =>
  "$" + (n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fP = (n) => (n >= 0 ? "+" : "") + ((n || 0) * 100).toFixed(3) + "%";
const fX = (p) =>
  !p
    ? "—"
    : p < 0.001
      ? p.toFixed(8)
      : p < 0.1
        ? p.toFixed(5)
        : p < 10
          ? p.toFixed(4)
          : p < 1000
            ? p.toFixed(3)
            : p.toFixed(2);
const catC = (c) =>
  ({ crypto: "#00ff88", forex: "#00cfff", commodity: "#ffd700", cross: "#ff8800" })[c] || "#888";
const catL = (c) =>
  ({ crypto: "CRYPTO", forex: "FOREX", commodity: "COMMOD", cross: "CROSS" })[c] || c;

// ─── AI ASSISTANT KNOWLEDGE BASE ────────────────────────────────────────
const KNOWLEDGE = {
  rsi: `RSI (Relative Strength Index) measures momentum on a 0–100 scale. Below ${RISK.RSI_OS} = oversold (buy signal). Above ${RISK.RSI_OB} = overbought (exit signal). This engine uses RSI(14) — calculated over 14 price periods.`,
  macd: `MACD (Moving Average Convergence Divergence) uses three lines: MACD line (12 EMA minus 26 EMA), Signal line (9 EMA of MACD), and Histogram (MACD minus Signal). A bullish crossover — histogram turning positive — is a strong buy signal. This engine weights MACD at 25% of the composite score.`,
  ema: `EMA (Exponential Moving Average) gives more weight to recent prices than SMA. This engine uses EMA 9 (fast), EMA 21 (slow), EMA 50 (trend). When EMA9 crosses above EMA21 it's a bullish signal. All three aligned upward = strong trend.`,
  bollinger: `Bollinger Bands (20 period, 2 standard deviations) show price volatility. %B below 0.2 means price is near the lower band — oversold and likely to bounce. A squeeze (band width below ${(RISK.BB_SQ * 100).toFixed(1)}%) means a breakout is coming.`,
  atr: `ATR (Average True Range) measures real volatility. This engine uses ATR(14) to set dynamic stop losses at 2×ATR below entry. Position size is calculated as: (capital × 2% risk) ÷ (2×ATR stop). This prevents fixed stops from being too tight or too wide.`,
  composite: `The composite score (0–100) is a weighted consensus: RSI 25%, EMA crossover 20%, MACD 25%, Bollinger %B 20%, short momentum 10%. Score above ${RISK.MIN_COMP * 100} = BUY. Below ${RISK.EXIT_COMP * 100} = EXIT. A pair needs a 12-point edge over the current pair to trigger a rotation.`,
  swap: `Swap logic: 1) If composite drops below exit floor → exit. 2) If 2×ATR stop is hit → stop loss. 3) If a better pair has 12+ point composite edge → rotate. Cooldown of ${RISK.COOLDOWN} ticks prevents churn. Every swap deducts fees and slippage both sides.`,
  risk: `Risk parameters: 8% max drawdown triggers circuit breaker (engine stops). 2% max risk per trade. Slippage of 0.05% per side. Crypto fees 0.1% per side, forex 0.02% per side, commodities 0.03% per side.`,
  gold: `XAU/USD (Gold) is tracked as a commodity pair. Gold tends to rise during risk-off periods and dollar weakness. It has lower volatility than crypto (vol factor: 0.12%) but meaningful momentum swings. The engine applies all 5 indicators to gold the same way as crypto.`,
  pairs: `This engine monitors ${ALL_PAIRS.length} pairs total: ${CRYPTO_PAIRS.length} crypto, ${FOREX_PAIRS.length} forex, 3 commodities (Gold XAU/USD, Silver XAG/USD, Oil WTI/USD), and 3 cross-pairs. Crypto prices are live from CoinGecko. Forex and commodities run calibrated simulation.`,
  bybit: `Bybit API integration: Enter your API key and secret in the Exchange tab. The engine will call POST /v5/order/create with orderType: Market, side: Buy/Sell, symbol: pair, qty: calculated position size. Requires Unified Trading Account. Testnet available for paper trading.`,
  binance: `Binance API: Enter credentials in the Exchange tab. Uses POST /api/v3/order with type: MARKET. Symbol format is BTCUSDT (no slash). Position size calculated from ATR-based risk. IP whitelist your server for security.`,
  wise: `Wise (formerly TransferWise) allows withdrawals from your trading profits to a bank account. Connect via the Bank tab using your Wise API token. Supports NGN, USD, GBP, EUR and 50+ currencies. Typical NGN transfer takes 1–2 business days.`,
  circuit: `The circuit breaker fires when drawdown hits ${RISK.MAX_DRAWDOWN * 100}% from peak equity. Engine stops immediately. To reset: fix your strategy, click Resume, and the peak resets to current equity. Do not override circuit breakers without understanding why they fired.`,
  howto: `How to use: 1) Set your capital. 2) Click START. 3) Wait 30–40 seconds for indicators to warm up. 4) Watch the Market tab for signals. 5) Analysis tab shows why each pair is rated the way it is. 6) Log tab shows every swap with full reasoning. For live trading, add exchange API keys in the Exchange tab.`,
};

function getAIResponse(question) {
  const q = question.toLowerCase();
  if (q.includes("rsi")) return KNOWLEDGE.rsi;
  if (q.includes("macd")) return KNOWLEDGE.macd;
  if (q.includes("ema") || q.includes("moving average")) return KNOWLEDGE.ema;
  if (q.includes("bollinger") || q.includes("band")) return KNOWLEDGE.bollinger;
  if (q.includes("atr") || q.includes("stop") || q.includes("position size")) return KNOWLEDGE.atr;
  if (q.includes("composite") || q.includes("score") || q.includes("signal"))
    return KNOWLEDGE.composite;
  if (q.includes("swap") || q.includes("rotate") || q.includes("switch")) return KNOWLEDGE.swap;
  if (q.includes("risk") || q.includes("drawdown") || q.includes("loss")) return KNOWLEDGE.risk;
  if (q.includes("gold") || q.includes("xau") || q.includes("silver") || q.includes("commodity"))
    return KNOWLEDGE.gold;
  if (q.includes("pair") || q.includes("how many") || q.includes("currencies"))
    return KNOWLEDGE.pairs;
  if (q.includes("bybit")) return KNOWLEDGE.bybit;
  if (q.includes("binance")) return KNOWLEDGE.binance;
  if (q.includes("wise") || q.includes("bank") || q.includes("withdraw")) return KNOWLEDGE.wise;
  if (q.includes("circuit") || q.includes("breaker")) return KNOWLEDGE.circuit;
  if (q.includes("how") || q.includes("use") || q.includes("start") || q.includes("begin"))
    return KNOWLEDGE.howto;
  return `I can explain: RSI, MACD, EMA, Bollinger Bands, ATR, composite scoring, swap logic, risk management, gold/commodities, Bybit/Binance API, Wise bank withdrawals, circuit breakers, and how to use this engine. What would you like to know?`;
}

// ─── MAIN ───────────────────────────────────────────────────────────────
export default function NexusArb() {
  const [prices, setPrices] = useState({ ...SEED });
  const [history, setHistory] = useState(() =>
    Object.fromEntries(ALL_PAIRS.map((p) => [p.id, Array(40).fill(SEED[p.id] || 1)])),
  );
  const [ind, setInd] = useState({});
  const [sigs, setSigs] = useState({});
  const [active, setActive] = useState("BTC/USDT");
  const [entry, setEntry] = useState(null);
  const [equity, setEquity] = useState(RISK.CAPITAL);
  const [peak, setPeak] = useState(RISK.CAPITAL);
  const [pnl, setPnl] = useState(0);
  const [tlog, setTlog] = useState([]);
  const [swaps, setSwaps] = useState(0);
  const [running, setRunning] = useState(false);
  const [src, setSrc] = useState("simulated");
  const [cb, setCb] = useState(false);
  const [lastSwap, setLastSwap] = useState(0);
  const [tab, setTab] = useState("market");
  const [capital, setCapital] = useState(RISK.CAPITAL);
  const [capIn, setCapIn] = useState("10000");
  // Exchange
  const [exchange, setExchange] = useState("bybit");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [testnet, setTestnet] = useState(true);
  const [liveTrading, setLiveTrading] = useState(false);
  const [exLog, setExLog] = useState([]);
  // Bank / Wise
  const [wiseToken, setWiseToken] = useState("");
  const [wiseProfile, setWiseProfile] = useState("");
  const [withdrawAmt, setWithdrawAmt] = useState("");
  const [withdrawCur, setWithdrawCur] = useState("USD");
  const [bankLog, setBankLog] = useState([]);
  // Chat
  const [chatMsgs, setChatMsgs] = useState([
    {
      role: "ai",
      text: "Hey! I'm your NexusARB trading assistant. I know everything about this engine — RSI, MACD, EMA, Bollinger Bands, ATR, gold pairs, exchange APIs, bank withdrawals, risk management. Ask me anything.",
    },
  ]);
  const [chatIn, setChatIn] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  // Filter
  const [catFilter, setCatFilter] = useState("all");

  const tickN = useRef(0);
  const pxRef = useRef(prices);
  const chatEnd = useRef(null);
  pxRef.current = prices;

  // ─── LIVE DATA ──────────────────────────────────────────────────────
  const fetchLive = useCallback(async () => {
    try {
      const ids = [...CRYPTO_PAIRS, ...COMMODITY_PAIRS.filter((p) => p.cgId)]
        .map((p) => p.cgId)
        .filter(Boolean)
        .join(",");
      const r = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
        { signal: AbortSignal.timeout(6000) },
      );
      if (!r.ok) throw new Error();
      const d = await r.json();
      const u = {};
      [...CRYPTO_PAIRS, ...COMMODITY_PAIRS.filter((p) => p.cgId)].forEach((p) => {
        if (d[p.cgId]?.usd) u[p.id] = d[p.cgId].usd;
      });
      if (Object.keys(u).length > 0) {
        setPrices((prev) => ({ ...prev, ...u }));
        setSrc("live");
      }
    } catch {
      setSrc("simulated");
    }
  }, []);

  // ─── TICK ENGINE ────────────────────────────────────────────────────
  useEffect(() => {
    if (!running || cb) return;
    fetchLive();
    const li = setInterval(fetchLive, 30000);
    const si = setInterval(() => {
      tickN.current += 1;
      setPrices((prev) => {
        const n = { ...prev };
        ALL_PAIRS.forEach((p) => {
          n[p.id] =
            src === "live" && p.category !== "forex" && p.category !== "cross"
              ? prev[p.id] * (1 + (Math.random() - 0.5) * 0.0003)
              : tickP(prev[p.id], p.category);
        });
        // cross pairs derived
        if (n["BTC/USDT"] && n["ETH/USDT"]) n["BTC/ETH"] = n["BTC/USDT"] / n["ETH/USDT"];
        if (n["ETH/USDT"] && n["BNB/USDT"]) n["ETH/BNB"] = n["ETH/USDT"] / n["BNB/USDT"];
        if (n["SOL/USDT"] && n["ETH/USDT"]) n["SOL/ETH"] = n["SOL/USDT"] / n["ETH/USDT"];
        return n;
      });
      setHistory((prev) => {
        const n = {};
        ALL_PAIRS.forEach((p) => {
          n[p.id] = [...(prev[p.id] || []).slice(-79), pxRef.current[p.id]];
        });
        return n;
      });
    }, 1200);
    return () => {
      clearInterval(si);
      clearInterval(li);
    };
  }, [running, cb, src, fetchLive]);

  // ─── INDICATOR ENGINE ───────────────────────────────────────────────
  useEffect(() => {
    const ni = {},
      ns = {};
    ALL_PAIRS.forEach((p) => {
      const h = history[p.id] || [];
      if (h.length < 30) return;
      const r = rsi(h, 14),
        b = bb(h, 20, 2),
        m = macd(h, 12, 26, 9);
      const e9 = ema(h, 9),
        e21 = ema(h, 21),
        e50 = ema(h, Math.min(50, h.length - 1));
      const at = atr(h, 14),
        mo = mom(h, 10);
      const comp = composite({ rsi: r, bb: b, macd: m, ema9: e9, ema21: e21, momentum: mo });
      ni[p.id] = {
        rsi: r,
        bb: b,
        macd: m,
        ema9: e9,
        ema21: e21,
        ema50: e50,
        atr: at,
        momentum: mo,
        composite: comp,
      };
      ns[p.id] = {
        signal:
          comp === null
            ? "WAIT"
            : comp >= RISK.MIN_COMP
              ? "BUY"
              : comp <= RISK.EXIT_COMP
                ? "EXIT"
                : "HOLD",
        composite: comp,
      };
    });
    setInd(ni);
    setSigs(ns);
  }, [history]);

  // ─── CIRCUIT BREAKER ────────────────────────────────────────────────
  useEffect(() => {
    setPeak((prev) => Math.max(prev, equity));
    const dd = (peak - equity) / peak;
    if (dd >= RISK.MAX_DRAWDOWN && !cb) {
      setCb(true);
      setRunning(false);
      setTlog((prev) => [
        {
          id: Date.now(),
          type: "CB",
          msg: `⚠ CIRCUIT BREAKER — ${(dd * 100).toFixed(2)}% drawdown reached`,
          time: new Date().toLocaleTimeString(),
          equity,
        },
        ...prev,
      ]);
    }
  }, [equity, peak]);

  // ─── SWAP ENGINE ────────────────────────────────────────────────────
  useEffect(() => {
    if (!running || cb) return;
    if (tickN.current - lastSwap < RISK.COOLDOWN) return;
    const cs = sigs[active],
      ci = ind[active],
      px = prices[active];
    if (!cs || !ci || !px) return;
    let bestId = null,
      bestComp = -Infinity;
    ALL_PAIRS.forEach((p) => {
      if (p.id !== active && (sigs[p.id]?.composite ?? -1) > bestComp) {
        bestComp = sigs[p.id].composite;
        bestId = p.id;
      }
    });
    const inPos = entry !== null;
    const unreal = inPos ? (px - entry.price) / entry.price : 0;
    const atrStop = ci.atr ? (ci.atr / px) * 2 : 0.015;
    const stopHit = inPos && unreal < -atrStop;
    const sigExit = cs.signal === "EXIT";
    const better = bestId && bestComp > (cs.composite || 0) + 0.12 && bestComp >= RISK.MIN_COMP;
    if ((sigExit || stopHit || better) && bestId) {
      const raw = inPos ? unreal * equity : 0;
      const pairData = ALL_PAIRS.find((p) => p.id === active);
      const fee = equity * ((pairData?.fee || 0.001) + RISK.SLIPPAGE) * 2;
      const net = raw - fee;
      const newEq = equity + net;
      setEquity(newEq);
      setPnl((p) => p + net);
      const entry2 = {
        id: Date.now(),
        type: "SWAP",
        from: active,
        to: bestId,
        pnl: net,
        fromComp: cs.composite,
        toComp: bestComp,
        reason: sigExit ? "SIGNAL_EXIT" : stopHit ? "ATR_STOP" : "BETTER_PAIR",
        entryPrice: entry?.price,
        exitPrice: px,
        time: new Date().toLocaleTimeString(),
        equity: newEq,
        rsi: ci.rsi?.toFixed(1),
      };
      setTlog((prev) => [entry2, ...prev.slice(0, 199)]);
      if (liveTrading && apiKey) simulateExchangeOrder(bestId, newEq, bestComp);
      setSwaps((c) => c + 1);
      setActive(bestId);
      setEntry({
        price: prices[bestId],
        fee: ALL_PAIRS.find((p) => p.id === bestId)?.fee || 0.001,
      });
      setLastSwap(tickN.current);
    } else if (!inPos && cs.signal === "BUY") {
      setEntry({ price: px, fee: ALL_PAIRS.find((p) => p.id === active)?.fee || 0.001 });
    }
  }, [sigs, ind]);

  // ─── EXCHANGE SIMULATION ────────────────────────────────────────────
  function simulateExchangeOrder(pairId, currentEquity, score) {
    const pair = ALL_PAIRS.find((p) => p.id === pairId);
    const posSize = (currentEquity * 0.95).toFixed(2);
    const endpoint = testnet
      ? exchange === "bybit"
        ? "https://api-testnet.bybit.com/v5/order/create"
        : "https://testnet.binance.vision/api/v3/order"
      : exchange === "bybit"
        ? "https://api.bybit.com/v5/order/create"
        : "https://api.binance.com/api/v3/order";
    const symbol = exchange === "binance" ? pairId.replace("/", "") : pairId;
    setExLog((prev) => [
      {
        id: Date.now(),
        time: new Date().toLocaleTimeString(),
        exchange: exchange.toUpperCase(),
        symbol,
        side: "BUY",
        type: "MARKET",
        qty: posSize,
        endpoint,
        status: apiKey ? "SENT" : "NO_KEY",
        score: (score * 100).toFixed(0),
        note: apiKey
          ? `Order dispatched to ${testnet ? "TESTNET" : "MAINNET"}`
          : "Add API key to enable real orders",
      },
      ...prev.slice(0, 49),
    ]);
  }

  // ─── WISE WITHDRAWAL ────────────────────────────────────────────────
  function handleWithdraw() {
    if (!wiseToken) {
      setBankLog((prev) => [
        {
          id: Date.now(),
          time: new Date().toLocaleTimeString(),
          status: "ERROR",
          msg: "Add your Wise API token first",
        },
        ...prev,
      ]);
      return;
    }
    const amt = parseFloat(withdrawAmt);
    if (!amt || amt <= 0 || amt > equity) {
      setBankLog((prev) => [
        {
          id: Date.now(),
          time: new Date().toLocaleTimeString(),
          status: "ERROR",
          msg: "Invalid amount",
        },
        ...prev,
      ]);
      return;
    }
    setBankLog((prev) => [
      {
        id: Date.now(),
        time: new Date().toLocaleTimeString(),
        status: "SIMULATED",
        msg: `Wise transfer: ${fU(amt)} ${withdrawCur} → bank account`,
        endpoint: "https://api.transferwise.com/v3/profiles/{profileId}/transfers",
        note: "In production: POST to Wise API with targetAccount, quoteUuid, and customerTransactionId",
        amt,
        cur: withdrawCur,
      },
      ...prev,
    ]);
  }

  // ─── AI CHAT ────────────────────────────────────────────────────────
  async function sendChat() {
    if (!chatIn.trim()) return;
    const userMsg = { role: "user", text: chatIn };
    setChatMsgs((prev) => [...prev, userMsg]);
    setChatIn("");
    setChatLoading(true);
    await new Promise((r) => setTimeout(r, 400));
    const response = getAIResponse(chatIn);
    setChatMsgs((prev) => [...prev, { role: "ai", text: response }]);
    setChatLoading(false);
  }

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMsgs]);

  // ─── DERIVED ────────────────────────────────────────────────────────
  const dd = (peak - equity) / peak;
  const pnlC = pnl >= 0 ? "#00ff88" : "#ff3366";
  const ci = ind[active] || {},
    cs = sigs[active] || {},
    px = prices[active];
  const unreal = entry && px ? (px - entry.price) / entry.price : 0;
  const filtered = ALL_PAIRS.filter((p) => catFilter === "all" || p.category === catFilter);

  // ─── COMPONENTS ─────────────────────────────────────────────────────
  function Spark({ pid, w = 72, h = 26 }) {
    const a = history[pid] || [];
    if (a.length < 2) return <svg width={w} height={h} />;
    const mn = Math.min(...a),
      mx = Math.max(...a),
      rng = mx - mn || 1;
    const pts = a
      .map((v, i) => `${(i / (a.length - 1)) * w},${h - ((v - mn) / rng) * h}`)
      .join(" ");
    return (
      <svg width={w} height={h}>
        <polyline
          points={pts}
          fill="none"
          stroke={a[a.length - 1] >= a[0] ? "#00ff88" : "#ff3366"}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  function Gauge({ value, label, min = 0, max = 100, lowGood }) {
    if (value == null) return <div style={{ fontSize: 10, color: "#334" }}>—</div>;
    const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));
    const c = lowGood
      ? pct < 0.35
        ? "#00ff88"
        : pct > 0.65
          ? "#ff3366"
          : "#ffaa00"
      : pct > 0.65
        ? "#00ff88"
        : pct < 0.35
          ? "#ff3366"
          : "#ffaa00";
    return (
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 9,
            color: "#446",
            marginBottom: 3,
          }}
        >
          <span>{label}</span>
          <span style={{ color: c }}>{value.toFixed(1)}</span>
        </div>
        <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
          <div
            style={{
              height: "100%",
              width: `${pct * 100}%`,
              background: c,
              borderRadius: 2,
              transition: "width 0.5s",
            }}
          />
        </div>
      </div>
    );
  }
  function Badge({ s }) {
    const m = {
      BUY: ["#00ff88", "#001a0d"],
      EXIT: ["#ff3366", "#1a0010"],
      HOLD: ["#888", "#111"],
      WAIT: ["#333", "#0a0a0a"],
    };
    const [fg, bg] = m[s] || m.WAIT;
    return (
      <span
        style={{
          background: bg,
          color: fg,
          border: `1px solid ${fg}`,
          padding: "1px 5px",
          borderRadius: 3,
          fontSize: 9,
          letterSpacing: 1,
        }}
      >
        {s}
      </span>
    );
  }
  const P = ({ children, style }) => (
    <div
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 8,
        padding: 14,
        ...style,
      }}
    >
      {children}
    </div>
  );
  const PL = ({ children }) => (
    <div style={{ fontSize: 9, color: "#446", letterSpacing: 3, marginBottom: 10 }}>{children}</div>
  );
  function Input({ label, value, onChange, placeholder, type = "text", secret }) {
    return (
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 9, color: "#446", marginBottom: 3 }}>{label}</div>
        <input
          type={secret ? "password" : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            width: "100%",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 4,
            padding: "6px 8px",
            color: "#fff",
            fontSize: 11,
            fontFamily: "inherit",
          }}
        />
      </div>
    );
  }
  function Btn({ onClick, children, color = "#00ff88", danger }) {
    return (
      <button
        onClick={onClick}
        style={{
          padding: "7px 14px",
          background: danger ? "rgba(255,51,102,0.12)" : "rgba(0,255,136,0.1)",
          border: `1px solid ${danger ? "#ff3366" : color}`,
          borderRadius: 4,
          color: danger ? "#ff3366" : color,
          fontSize: 10,
          cursor: "pointer",
          fontFamily: "inherit",
          letterSpacing: 1,
        }}
      >
        {children}
      </button>
    );
  }

  const TABS = ["market", "analysis", "exchange", "bank", "chat", "log", "risk"];

  return (
    <div
      style={{
        fontFamily: "'IBM Plex Mono',monospace",
        background: "#020408",
        color: "#c8d8e8",
        minHeight: "100vh",
      }}
    >
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          backgroundImage:
            "linear-gradient(rgba(0,255,136,0.022) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,136,0.022) 1px,transparent 1px)",
          backgroundSize: "40px 40px",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "fixed",
          top: "-15%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "80vw",
          height: "40vh",
          background: "radial-gradient(ellipse,rgba(0,255,136,0.045) 0%,transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 1440,
          margin: "0 auto",
          padding: "18px 14px",
        }}
      >
        {/* HEADER */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 16,
          }}
        >
          <div>
            <div style={{ fontSize: 9, color: "#00ff88", letterSpacing: 4, marginBottom: 2 }}>
              ◈ PROFESSIONAL ARBITRAGE ENGINE v3
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#fff", letterSpacing: -1 }}>
              NEXUS<span style={{ color: "#00ff88" }}>ARB</span>
            </div>
            <div
              style={{
                display: "flex",
                gap: 8,
                marginTop: 3,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  fontSize: 9,
                  color: src === "live" ? "#00ff88" : "#ff8800",
                  letterSpacing: 2,
                }}
              >
                {src === "live" ? "◉ LIVE" : "◎ SIM"}
              </span>
              <span style={{ fontSize: 9, color: "#223" }}>|</span>
              <span style={{ fontSize: 9, color: "#446" }}>{ALL_PAIRS.length} PAIRS</span>
              <span style={{ fontSize: 9, color: "#ffd700" }}>◈ GOLD · SILVER · OIL</span>
              <span style={{ fontSize: 9, color: liveTrading ? "#ff3366" : "#334" }}>
                {liveTrading ? "◉ LIVE TRADING" : "◎ PAPER MODE"}
              </span>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 9, color: "#446", marginBottom: 1 }}>EQUITY</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#fff" }}>{fU(equity)}</div>
            <div style={{ fontSize: 11, color: pnlC }}>
              {pnl >= 0 ? "▲" : "▼"} {fU(Math.abs(pnl))} ({fP(pnl / capital)})
            </div>
            {cb && (
              <div
                style={{
                  fontSize: 9,
                  color: "#ff3366",
                  marginTop: 3,
                  border: "1px solid #ff3366",
                  padding: "2px 6px",
                  borderRadius: 3,
                }}
              >
                ⚠ CIRCUIT BREAKER
              </div>
            )}
          </div>
        </div>

        {/* STATS */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(6,1fr)",
            gap: 7,
            marginBottom: 14,
          }}
        >
          {[
            { l: "ACTIVE", v: active, c: "#00ff88" },
            {
              l: "SIGNAL",
              v: cs.signal || "—",
              c: cs.signal === "BUY" ? "#00ff88" : cs.signal === "EXIT" ? "#ff3366" : "#888",
            },
            {
              l: "COMPOSITE",
              v: cs.composite != null ? (cs.composite * 100).toFixed(0) + "/100" : "—",
              c: "#aaa",
            },
            {
              l: "DRAWDOWN",
              v: fP(-dd),
              c: dd > 0.05 ? "#ff3366" : dd > 0.02 ? "#ffaa00" : "#aaa",
            },
            { l: "SWAPS", v: swaps, c: "#00cfff" },
            {
              l: "UNREALIZED",
              v: entry ? fP(unreal) : "—",
              c: unreal >= 0 ? "#00ff88" : "#ff3366",
            },
          ].map((s) => (
            <P key={s.l} style={{ padding: "7px 10px" }}>
              <div style={{ fontSize: 8, color: "#446", letterSpacing: 2, marginBottom: 2 }}>
                {s.l}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: s.c }}>{s.v}</div>
            </P>
          ))}
        </div>

        {/* TABS */}
        <div style={{ display: "flex", gap: 2, marginBottom: 12, flexWrap: "wrap" }}>
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "5px 12px",
                background: tab === t ? "rgba(0,255,136,0.12)" : "transparent",
                border:
                  tab === t ? "1px solid rgba(0,255,136,0.4)" : "1px solid rgba(255,255,255,0.06)",
                borderRadius: 5,
                color: tab === t ? "#00ff88" : "#446",
                fontSize: 9,
                letterSpacing: 2,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {t.toUpperCase()}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button
            onClick={() => {
              if (cb) {
                setCb(false);
                setPeak(equity);
              }
              setRunning((r) => !r);
            }}
            style={{
              padding: "5px 18px",
              background: running ? "rgba(255,51,102,0.15)" : "rgba(0,255,136,0.15)",
              border: `1px solid ${running ? "#ff3366" : "#00ff88"}`,
              borderRadius: 5,
              color: running ? "#ff3366" : "#00ff88",
              fontSize: 9,
              letterSpacing: 2,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {running ? "◎ PAUSE" : "◉ START"}
          </button>
        </div>

        {/* ══ MARKET TAB ══ */}
        {tab === "market" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 12 }}>
            <P style={{ padding: 0, overflow: "hidden" }}>
              <div
                style={{
                  padding: "10px 14px",
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <PL>▸ {ALL_PAIRS.length} PAIRS — LIVE MONITOR</PL>
                <div style={{ flex: 1 }} />
                {["all", "crypto", "forex", "commodity", "cross"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setCatFilter(f)}
                    style={{
                      padding: "2px 8px",
                      background: catFilter === f ? "rgba(0,255,136,0.1)" : "transparent",
                      border:
                        catFilter === f ? "1px solid #00ff88" : "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 3,
                      color: catFilter === f ? "#00ff88" : "#446",
                      fontSize: 8,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {f.toUpperCase()}
                  </button>
                ))}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "100px 85px 40px 40px 55px 40px 1fr 52px",
                  padding: "5px 14px",
                  fontSize: 8,
                  color: "#334",
                  letterSpacing: 2,
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                }}
              >
                <span>PAIR</span>
                <span>PRICE</span>
                <span>RSI</span>
                <span>EMA</span>
                <span>MACD</span>
                <span>COMP</span>
                <span>CHART</span>
                <span>SIGNAL</span>
              </div>
              <div style={{ maxHeight: 520, overflowY: "auto" }}>
                {filtered.map((p) => {
                  const i2 = ind[p.id] || {},
                    s2 = sigs[p.id] || {},
                    px2 = prices[p.id];
                  const isAct = p.id === active;
                  const emaTr = i2.ema9 && i2.ema21 ? (i2.ema9 > i2.ema21 ? "↑" : "↓") : "—";
                  const mTx = i2.macd
                    ? i2.macd.crossover
                      ? "✦↑"
                      : i2.macd.crossunder
                        ? "✦↓"
                        : i2.macd.histogram > 0
                          ? "↑"
                          : "↓"
                    : "—";
                  return (
                    <div
                      key={p.id}
                      onClick={() => setActive(p.id)}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "100px 85px 40px 40px 55px 40px 1fr 52px",
                        padding: "7px 14px",
                        borderBottom: "1px solid rgba(255,255,255,0.03)",
                        cursor: "pointer",
                        alignItems: "center",
                        background: isAct ? "rgba(0,255,136,0.05)" : "transparent",
                        borderLeft: isAct ? "2px solid #00ff88" : "2px solid transparent",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: isAct ? "#00ff88" : "#ddd",
                          }}
                        >
                          {p.id}
                        </div>
                        <div style={{ fontSize: 8, color: catC(p.category) }}>
                          {catL(p.category)}
                        </div>
                      </div>
                      <div style={{ fontSize: 10, color: "#eee" }}>{px2 ? fX(px2) : "—"}</div>
                      <div
                        style={{
                          fontSize: 10,
                          color:
                            (i2.rsi || 50) > RISK.RSI_OB
                              ? "#ff3366"
                              : (i2.rsi || 50) < RISK.RSI_OS
                                ? "#00ff88"
                                : "#aaa",
                        }}
                      >
                        {i2.rsi?.toFixed(0) || "—"}
                      </div>
                      <div style={{ fontSize: 10, color: emaTr === "↑" ? "#00ff88" : "#ff3366" }}>
                        {emaTr}
                      </div>
                      <div
                        style={{ fontSize: 10, color: mTx.includes("↑") ? "#00ff88" : "#ff3366" }}
                      >
                        {mTx}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: (s2.composite || 0) >= RISK.MIN_COMP ? "#00ff88" : "#ff3366",
                        }}
                      >
                        {s2.composite != null ? (s2.composite * 100).toFixed(0) : "—"}
                      </div>
                      <Spark pid={p.id} />
                      <Badge s={s2.signal || "WAIT"} />
                    </div>
                  );
                })}
              </div>
            </P>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <P style={{ border: "1px solid rgba(0,255,136,0.12)" }}>
                <PL>▸ ACTIVE POSITION</PL>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#00ff88", marginBottom: 8 }}>
                  {active}
                </div>
                {[
                  ["LIVE PRICE", px ? fX(px) : "—"],
                  ["ENTRY", entry ? fX(entry.price) : "—"],
                  ["UNREALIZED", fP(unreal)],
                  ["RSI", ci.rsi?.toFixed(1) || "—"],
                  ["ATR STOP", ci.atr && px ? fP(-(ci.atr / px) * 2) : "—"],
                  ["EMA 9/21", ci.ema9 && ci.ema21 ? `${fX(ci.ema9)}/${fX(ci.ema21)}` : "—"],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 10,
                      marginBottom: 4,
                    }}
                  >
                    <span style={{ color: "#446" }}>{k}</span>
                    <span style={{ color: "#bbb" }}>{v}</span>
                  </div>
                ))}
              </P>
              <P>
                <PL>▸ CAPITAL</PL>
                <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                  <input
                    value={capIn}
                    onChange={(e) => setCapIn(e.target.value)}
                    style={{
                      flex: 1,
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 4,
                      padding: "5px 8px",
                      color: "#fff",
                      fontSize: 11,
                      fontFamily: "inherit",
                    }}
                  />
                  <Btn
                    onClick={() => {
                      const v = parseFloat(capIn);
                      if (v > 0) {
                        setCapital(v);
                        setEquity(v);
                        setPeak(v);
                        setPnl(0);
                        setTlog([]);
                        setSwaps(0);
                        setEntry(null);
                        setCb(false);
                      }
                    }}
                  >
                    SET
                  </Btn>
                </div>
                <Btn
                  onClick={() => {
                    setEquity(capital);
                    setPeak(capital);
                    setPnl(0);
                    setTlog([]);
                    setSwaps(0);
                    setEntry(null);
                    setCb(false);
                    setLastSwap(0);
                  }}
                  color="#ff8800"
                >
                  ↺ RESET
                </Btn>
              </P>
              <P>
                <PL>▸ RISK GAUGES</PL>
                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                  <Gauge value={ci.rsi} label="RSI" />
                  <Gauge value={ci.bb ? ci.bb.percentB * 100 : null} label="BB %B" />
                  <Gauge
                    value={dd * 100}
                    label={`DRAWDOWN (MAX ${RISK.MAX_DRAWDOWN * 100}%)`}
                    min={0}
                    max={RISK.MAX_DRAWDOWN * 100 * 1.5}
                    lowGood
                  />
                  <Gauge
                    value={ci.composite != null ? ci.composite * 100 : null}
                    label="COMPOSITE"
                  />
                </div>
              </P>
            </div>
          </div>
        )}

        {/* ══ ANALYSIS TAB ══ */}
        {tab === "analysis" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <P>
              <PL>▸ INDICATOR DEEP DIVE — {active}</PL>
              {ci.rsi == null ? (
                <div style={{ fontSize: 11, color: "#334" }}>
                  Start engine — need 30+ ticks to build indicator history.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    {
                      t: "RSI (14)",
                      c: (
                        <>
                          <div
                            style={{
                              fontSize: 22,
                              fontWeight: 700,
                              color:
                                ci.rsi > RISK.RSI_OB
                                  ? "#ff3366"
                                  : ci.rsi < RISK.RSI_OS
                                    ? "#00ff88"
                                    : "#aaa",
                            }}
                          >
                            {ci.rsi.toFixed(2)}
                          </div>
                          <div style={{ fontSize: 9, color: "#446", marginTop: 3 }}>
                            {ci.rsi > RISK.RSI_OB
                              ? "⚠ OVERBOUGHT"
                              : ci.rsi < RISK.RSI_OS
                                ? "✦ OVERSOLD — buy zone"
                                : "Neutral"}
                          </div>
                        </>
                      ),
                    },
                    {
                      t: "MACD (12/26/9)",
                      c: (
                        <>
                          <div
                            style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5 }}
                          >
                            {[
                              ["MACD", ci.macd?.macd],
                              ["SIG", ci.macd?.signal],
                              ["HIST", ci.macd?.histogram],
                            ].map(([l, v]) => (
                              <div key={l}>
                                <div style={{ fontSize: 8, color: "#334" }}>{l}</div>
                                <div
                                  style={{
                                    fontSize: 11,
                                    color: (v || 0) >= 0 ? "#00ff88" : "#ff3366",
                                  }}
                                >
                                  {v?.toFixed(5) || "—"}
                                </div>
                              </div>
                            ))}
                          </div>
                          {ci.macd?.crossover && (
                            <div style={{ fontSize: 9, color: "#00ff88", marginTop: 4 }}>
                              ✦ BULLISH CROSSOVER
                            </div>
                          )}
                          {ci.macd?.crossunder && (
                            <div style={{ fontSize: 9, color: "#ff3366", marginTop: 4 }}>
                              ✦ BEARISH CROSSUNDER
                            </div>
                          )}
                        </>
                      ),
                    },
                    {
                      t: "EMA STACK",
                      c: (
                        <>
                          {[
                            ["EMA 9", ci.ema9],
                            ["EMA 21", ci.ema21],
                            ["EMA 50", ci.ema50],
                          ].map(([l, v]) => (
                            <div
                              key={l}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                fontSize: 10,
                                marginBottom: 3,
                              }}
                            >
                              <span style={{ color: "#446" }}>{l}</span>
                              <span style={{ color: "#aaa" }}>{v ? fX(v) : "—"}</span>
                            </div>
                          ))}
                          <div
                            style={{
                              fontSize: 9,
                              color: ci.ema9 > ci.ema21 ? "#00ff88" : "#ff3366",
                              marginTop: 4,
                            }}
                          >
                            {ci.ema9 > ci.ema21
                              ? "▲ BULLISH — EMA9 above EMA21"
                              : "▼ BEARISH — EMA9 below EMA21"}
                          </div>
                        </>
                      ),
                    },
                    {
                      t: "BOLLINGER BANDS (20, 2σ)",
                      c: (
                        <>
                          {[
                            ["Upper", ci.bb?.upper, false],
                            ["Middle", ci.bb?.middle, false],
                            ["Lower", ci.bb?.lower, false],
                            ["Width", ci.bb?.width, true],
                            ["%B", ci.bb?.percentB, true],
                          ].map(([l, v, raw]) => (
                            <div
                              key={l}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                fontSize: 10,
                                marginBottom: 3,
                              }}
                            >
                              <span style={{ color: "#446" }}>{l}</span>
                              <span style={{ color: "#aaa" }}>
                                {v != null ? (raw ? v.toFixed(4) : fX(v)) : "—"}
                              </span>
                            </div>
                          ))}
                          {ci.bb?.width < RISK.BB_SQ && (
                            <div style={{ fontSize: 9, color: "#ffaa00", marginTop: 3 }}>
                              ⚡ SQUEEZE — breakout incoming
                            </div>
                          )}
                        </>
                      ),
                    },
                    {
                      t: "ATR RISK SIZING (14)",
                      c: (
                        <>
                          {[
                            ["ATR", ci.atr ? fX(ci.atr) : "—"],
                            ["2×ATR Stop", ci.atr && px ? fP(-(ci.atr / px) * 2) : "—"],
                            [
                              "Safe Position",
                              ci.atr && px
                                ? fU((equity * RISK.MAX_LOSS_TRADE) / ((ci.atr / px) * 2))
                                : "—",
                            ],
                          ].map(([l, v]) => (
                            <div
                              key={l}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                fontSize: 10,
                                marginBottom: 3,
                              }}
                            >
                              <span style={{ color: "#446" }}>{l}</span>
                              <span style={{ color: "#aaa" }}>{v}</span>
                            </div>
                          ))}
                        </>
                      ),
                    },
                  ].map(({ t, c }) => (
                    <div
                      key={t}
                      style={{ padding: 10, background: "rgba(0,0,0,0.2)", borderRadius: 6 }}
                    >
                      <div
                        style={{ fontSize: 9, color: "#00cfff", marginBottom: 5, letterSpacing: 2 }}
                      >
                        {t}
                      </div>
                      {c}
                    </div>
                  ))}
                </div>
              )}
            </P>
            <P>
              <PL>▸ ALL PAIRS RANKED BY COMPOSITE</PL>
              <div style={{ maxHeight: 560, overflowY: "auto" }}>
                {ALL_PAIRS.map((p) => ({
                  ...p,
                  comp: sigs[p.id]?.composite || 0,
                  sig: sigs[p.id]?.signal || "WAIT",
                }))
                  .sort((a, b) => b.comp - a.comp)
                  .map((p, i) => (
                    <div
                      key={p.id}
                      onClick={() => setActive(p.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "6px 10px",
                        marginBottom: 3,
                        background:
                          p.id === active ? "rgba(0,255,136,0.06)" : "rgba(255,255,255,0.01)",
                        borderRadius: 5,
                        border:
                          p.id === active
                            ? "1px solid rgba(0,255,136,0.2)"
                            : "1px solid transparent",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ fontSize: 9, color: "#334", width: 18 }}>#{i + 1}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: p.id === active ? "#00ff88" : "#ddd",
                            }}
                          >
                            {p.id}
                          </span>
                          <span style={{ fontSize: 8, color: catC(p.category) }}>
                            {catL(p.category)}
                          </span>
                        </div>
                        <div
                          style={{
                            height: 3,
                            background: "rgba(255,255,255,0.05)",
                            borderRadius: 2,
                            marginTop: 3,
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${p.comp * 100}%`,
                              background:
                                p.comp >= RISK.MIN_COMP
                                  ? "#00ff88"
                                  : p.comp <= RISK.EXIT_COMP
                                    ? "#ff3366"
                                    : "#ffaa00",
                              borderRadius: 2,
                            }}
                          />
                        </div>
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: p.comp >= RISK.MIN_COMP ? "#00ff88" : "#ff3366",
                          width: 24,
                          textAlign: "right",
                        }}
                      >
                        {(p.comp * 100).toFixed(0)}
                      </div>
                      <Badge s={p.sig} />
                    </div>
                  ))}
              </div>
            </P>
          </div>
        )}

        {/* ══ EXCHANGE TAB ══ */}
        {tab === "exchange" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <P>
              <PL>▸ EXCHANGE CONNECTION</PL>
              <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                {["bybit", "binance"].map((ex) => (
                  <button
                    key={ex}
                    onClick={() => setExchange(ex)}
                    style={{
                      flex: 1,
                      padding: "8px",
                      background: exchange === ex ? "rgba(0,255,136,0.1)" : "transparent",
                      border:
                        exchange === ex ? "1px solid #00ff88" : "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 5,
                      color: exchange === ex ? "#00ff88" : "#446",
                      fontSize: 10,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      letterSpacing: 2,
                    }}
                  >
                    {ex.toUpperCase()}
                  </button>
                ))}
              </div>
              <Input
                label="API KEY"
                value={apiKey}
                onChange={setApiKey}
                placeholder="Enter your API key..."
                secret
              />
              <Input
                label="API SECRET"
                value={apiSecret}
                onChange={setApiSecret}
                placeholder="Enter your API secret..."
                secret
              />
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <button
                  onClick={() => setTestnet((t) => !t)}
                  style={{
                    width: 28,
                    height: 16,
                    background: testnet ? "#00ff88" : "rgba(255,255,255,0.1)",
                    border: "none",
                    borderRadius: 8,
                    cursor: "pointer",
                    position: "relative",
                    transition: "background 0.2s",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 2,
                      left: testnet ? 14 : 2,
                      width: 12,
                      height: 12,
                      background: "#000",
                      borderRadius: "50%",
                      transition: "left 0.2s",
                    }}
                  />
                </button>
                <span style={{ fontSize: 10, color: testnet ? "#00ff88" : "#ff8800" }}>
                  {testnet ? "TESTNET (SAFE)" : "MAINNET (REAL MONEY)"}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <button
                  onClick={() => setLiveTrading((t) => !t)}
                  style={{
                    width: 28,
                    height: 16,
                    background: liveTrading ? "#ff3366" : "rgba(255,255,255,0.1)",
                    border: "none",
                    borderRadius: 8,
                    cursor: "pointer",
                    position: "relative",
                    transition: "background 0.2s",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 2,
                      left: liveTrading ? 14 : 2,
                      width: 12,
                      height: 12,
                      background: "#000",
                      borderRadius: "50%",
                      transition: "left 0.2s",
                    }}
                  />
                </button>
                <span style={{ fontSize: 10, color: liveTrading ? "#ff3366" : "#446" }}>
                  {liveTrading ? "LIVE ORDER PLACEMENT ON" : "PAPER TRADING"}
                </span>
              </div>
              <div
                style={{
                  padding: 10,
                  background: "rgba(255,136,0,0.05)",
                  border: "1px solid rgba(255,136,0,0.2)",
                  borderRadius: 6,
                  fontSize: 9,
                  color: "#887",
                  lineHeight: 1.8,
                }}
              >
                <div style={{ color: "#ff8800", marginBottom: 4 }}>⚠ REAL MONEY WARNING</div>
                Enable Testnet first. Only switch to Mainnet after confirming orders work correctly.
                Never share your API secret. Enable IP restriction on your exchange API. Start with
                a small test amount.
              </div>
              <div
                style={{
                  marginTop: 12,
                  padding: 10,
                  background: "rgba(0,0,0,0.2)",
                  borderRadius: 6,
                  fontSize: 9,
                  color: "#446",
                  lineHeight: 1.8,
                }}
              >
                <div style={{ color: "#00cfff", marginBottom: 4 }}>API ENDPOINT</div>
                <div style={{ color: "#667", wordBreak: "break-all" }}>
                  {exchange === "bybit"
                    ? testnet
                      ? "https://api-testnet.bybit.com/v5/order/create"
                      : "https://api.bybit.com/v5/order/create"
                    : testnet
                      ? "https://testnet.binance.vision/api/v3/order"
                      : "https://api.binance.com/api/v3/order"}
                </div>
              </div>
            </P>
            <P>
              <PL>▸ ORDER LOG ({exLog.length})</PL>
              {exLog.length === 0 && (
                <div style={{ fontSize: 11, color: "#334", padding: 20, textAlign: "center" }}>
                  No orders yet. Enable live trading and start engine.
                </div>
              )}
              <div style={{ maxHeight: 460, overflowY: "auto" }}>
                {exLog.map((o) => (
                  <div
                    key={o.id}
                    style={{ padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 10,
                        marginBottom: 3,
                      }}
                    >
                      <span style={{ color: "#00cfff" }}>{o.exchange}</span>
                      <span style={{ color: "#334" }}>{o.time}</span>
                      <span style={{ color: o.status === "SENT" ? "#00ff88" : "#ff8800" }}>
                        {o.status}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "#ddd", marginBottom: 2 }}>
                      {o.side} {o.symbol} {o.type} · score {o.score}/100
                    </div>
                    <div style={{ fontSize: 9, color: "#446" }}>
                      qty: {o.qty} · {o.note}
                    </div>
                  </div>
                ))}
              </div>
              <div
                style={{
                  marginTop: 12,
                  padding: 10,
                  background: "rgba(0,0,0,0.15)",
                  borderRadius: 6,
                }}
              >
                <div style={{ fontSize: 9, color: "#00cfff", marginBottom: 6 }}>
                  INTEGRATION GUIDE
                </div>
                <div style={{ fontSize: 9, color: "#667", lineHeight: 1.8 }}>
                  Bybit: POST /v5/order/create · params: category, symbol, side, orderType, qty
                  <br />
                  Binance: POST /api/v3/order · HMAC SHA256 signature required
                  <br />
                  Both require X-API-KEY header + timestamp + signature
                  <br />
                  For production deploy this to a server with 24/7 uptime
                </div>
              </div>
            </P>
          </div>
        )}

        {/* ══ BANK TAB ══ */}
        {tab === "bank" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <P>
              <PL>▸ WISE BANK WITHDRAWAL</PL>
              <div
                style={{
                  padding: 10,
                  background: "rgba(0,207,255,0.04)",
                  border: "1px solid rgba(0,207,255,0.12)",
                  borderRadius: 6,
                  marginBottom: 14,
                  fontSize: 9,
                  color: "#667",
                  lineHeight: 1.8,
                }}
              >
                <div style={{ color: "#00cfff", marginBottom: 4 }}>ABOUT WISE</div>
                Wise (formerly TransferWise) lets you withdraw trading profits to your bank account
                in NGN, USD, GBP, EUR, and 50+ currencies. Best rates for Nigeria and Africa. API
                supports automated withdrawals.
              </div>
              <Input
                label="WISE API TOKEN"
                value={wiseToken}
                onChange={setWiseToken}
                placeholder="Get from wise.com/api"
                secret
              />
              <Input
                label="WISE PROFILE ID"
                value={wiseProfile}
                onChange={setWiseProfile}
                placeholder="Your profile ID from Wise dashboard"
              />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 100px",
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                <Input
                  label="WITHDRAWAL AMOUNT (USD)"
                  value={withdrawAmt}
                  onChange={setWithdrawAmt}
                  placeholder="e.g. 500"
                  type="number"
                />
                <div>
                  <div style={{ fontSize: 9, color: "#446", marginBottom: 3 }}>CURRENCY</div>
                  <select
                    value={withdrawCur}
                    onChange={(e) => setWithdrawCur(e.target.value)}
                    style={{
                      width: "100%",
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 4,
                      padding: "6px 8px",
                      color: "#fff",
                      fontSize: 11,
                      fontFamily: "inherit",
                    }}
                  >
                    {["USD", "NGN", "GBP", "EUR", "GHS", "ZAR", "CAD", "AUD"].map((c) => (
                      <option key={c} value={c} style={{ background: "#111" }}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div
                style={{
                  marginBottom: 12,
                  padding: 10,
                  background: "rgba(0,0,0,0.2)",
                  borderRadius: 6,
                  fontSize: 9,
                  color: "#667",
                  lineHeight: 1.8,
                }}
              >
                <div style={{ color: "#00cfff", marginBottom: 4 }}>WITHDRAWAL SUMMARY</div>
                Amount: {withdrawAmt ? fU(parseFloat(withdrawAmt) || 0) : "—"} → {withdrawCur}
                <br />
                Available: {fU(equity)}
                <br />
                After withdrawal: {withdrawAmt ? fU(equity - (parseFloat(withdrawAmt) || 0)) : "—"}
                <br />
                Wise fee: ~0.4–0.6% depending on corridor
              </div>
              <Btn onClick={handleWithdraw} color="#00cfff">
                ⇄ INITIATE WITHDRAWAL
              </Btn>
              <div
                style={{
                  marginTop: 12,
                  padding: 10,
                  background: "rgba(255,136,0,0.05)",
                  border: "1px solid rgba(255,136,0,0.15)",
                  borderRadius: 6,
                  fontSize: 9,
                  color: "#887",
                }}
              >
                ⚠ This triggers a simulated withdrawal. In production, this calls the Wise Transfers
                API to move funds from your Wise balance to your linked bank account.
              </div>
            </P>
            <P>
              <PL>▸ WITHDRAWAL LOG ({bankLog.length})</PL>
              {bankLog.length === 0 && (
                <div style={{ fontSize: 11, color: "#334", padding: 20, textAlign: "center" }}>
                  No withdrawals yet.
                </div>
              )}
              <div style={{ maxHeight: 300, overflowY: "auto", marginBottom: 14 }}>
                {bankLog.map((b) => (
                  <div
                    key={b.id}
                    style={{ padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 10,
                        marginBottom: 3,
                      }}
                    >
                      <span
                        style={{
                          color:
                            b.status === "ERROR"
                              ? "#ff3366"
                              : b.status === "SENT"
                                ? "#00ff88"
                                : "#ffaa00",
                        }}
                      >
                        {b.status}
                      </span>
                      <span style={{ color: "#334" }}>{b.time}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#ddd", marginBottom: 2 }}>{b.msg}</div>
                    {b.endpoint && (
                      <div style={{ fontSize: 8, color: "#334", wordBreak: "break-all" }}>
                        {b.endpoint}
                      </div>
                    )}
                    {b.note && (
                      <div style={{ fontSize: 9, color: "#446", marginTop: 2 }}>{b.note}</div>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ padding: 10, background: "rgba(0,0,0,0.15)", borderRadius: 6 }}>
                <div style={{ fontSize: 9, color: "#00cfff", marginBottom: 6 }}>API FLOW</div>
                <div style={{ fontSize: 9, color: "#667", lineHeight: 1.8 }}>
                  1. Create quote: POST /v3/quotes
                  <br />
                  2. Create recipient: POST /v1/accounts
                  <br />
                  3. Create transfer: POST /v3/profiles/id/transfers
                  <br />
                  4. Fund transfer: POST /v3/transfers/id/payments
                  <br />
                  Bearer token auth · Sandbox available at sandbox.transferwise.tech
                </div>
              </div>
            </P>
          </div>
        )}

        {/* ══ CHAT TAB ══ */}
        {tab === "chat" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 240px", gap: 12 }}>
            <P style={{ display: "flex", flexDirection: "column", height: 560 }}>
              <PL>▸ AI TRADING ASSISTANT</PL>
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                {chatMsgs.map((m, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                    }}
                  >
                    <div
                      style={{
                        maxWidth: "80%",
                        padding: "10px 12px",
                        borderRadius: 8,
                        fontSize: 11,
                        lineHeight: 1.7,
                        background:
                          m.role === "user" ? "rgba(0,255,136,0.1)" : "rgba(255,255,255,0.03)",
                        border:
                          m.role === "user"
                            ? "1px solid rgba(0,255,136,0.2)"
                            : "1px solid rgba(255,255,255,0.06)",
                        color: m.role === "user" ? "#00ff88" : "#c8d8e8",
                      }}
                    >
                      {m.text}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div style={{ display: "flex", justifyContent: "flex-start" }}>
                    <div
                      style={{
                        padding: "10px 12px",
                        borderRadius: 8,
                        fontSize: 11,
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        color: "#446",
                      }}
                    >
                      Thinking...
                    </div>
                  </div>
                )}
                <div ref={chatEnd} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={chatIn}
                  onChange={(e) => setChatIn(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendChat()}
                  placeholder="Ask about RSI, MACD, gold, Bybit, Wise, risk..."
                  style={{
                    flex: 1,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 6,
                    padding: "8px 12px",
                    color: "#fff",
                    fontSize: 11,
                    fontFamily: "inherit",
                  }}
                />
                <Btn onClick={sendChat}>SEND</Btn>
              </div>
            </P>
            <P>
              <PL>▸ QUICK QUESTIONS</PL>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[
                  "How do I start?",
                  "What is RSI?",
                  "What is MACD?",
                  "What is gold doing?",
                  "How many pairs?",
                  "How does swap work?",
                  "What is ATR?",
                  "Explain Bollinger Bands",
                  "How to connect Bybit?",
                  "How to withdraw to bank?",
                  "What is the circuit breaker?",
                  "What is the composite score?",
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => {
                      setChatIn(q);
                    }}
                    style={{
                      padding: "6px 10px",
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 4,
                      color: "#667",
                      fontSize: 9,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      textAlign: "left",
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </P>
          </div>
        )}

        {/* ══ LOG TAB ══ */}
        {tab === "log" && (
          <P>
            <PL>▸ TRADE HISTORY ({tlog.length} events)</PL>
            <div style={{ maxHeight: 580, overflowY: "auto" }}>
              {tlog.length === 0 && (
                <div style={{ fontSize: 11, color: "#334", textAlign: "center", padding: 40 }}>
                  No trades yet. Start the engine.
                </div>
              )}
              {tlog.map((t) => (
                <div
                  key={t.id}
                  style={{ padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                >
                  {t.type === "CB" ? (
                    <div style={{ color: "#ff3366", fontSize: 11 }}>
                      {t.msg} — {t.time}
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "65px 120px 1fr 65px 55px 62px",
                        gap: 6,
                        fontSize: 10,
                        alignItems: "center",
                      }}
                    >
                      <span style={{ color: "#334" }}>{t.time}</span>
                      <div>
                        <span style={{ color: "#ff8800" }}>{t.from}</span>
                        <span style={{ color: "#334" }}> → </span>
                        <span style={{ color: "#00cfff" }}>{t.to}</span>
                      </div>
                      <div style={{ fontSize: 9, color: "#446" }}>
                        {t.reason} · RSI {t.rsi}
                        {t.entryPrice ? ` · ${fX(t.entryPrice)}→${fX(t.exitPrice)}` : ""}
                      </div>
                      <div style={{ fontSize: 9 }}>
                        <div style={{ color: "#334" }}>SCORE</div>
                        <div style={{ color: "#aaa" }}>
                          {t.fromComp != null ? (t.fromComp * 100).toFixed(0) : "—"}→
                          {t.toComp != null ? (t.toComp * 100).toFixed(0) : "—"}
                        </div>
                      </div>
                      <div
                        style={{
                          color: t.pnl >= 0 ? "#00ff88" : "#ff3366",
                          fontWeight: 700,
                          fontSize: 10,
                        }}
                      >
                        {t.pnl >= 0 ? "▲" : "▼"}
                        {fU(Math.abs(t.pnl))}
                      </div>
                      <div style={{ color: "#aaa", fontSize: 10 }}>{fU(t.equity)}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </P>
        )}

        {/* ══ RISK TAB ══ */}
        {tab === "risk" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <P>
              <PL>▸ RISK PARAMETERS</PL>
              {[
                ["MAX DRAWDOWN → CIRCUIT BREAK", `${RISK.MAX_DRAWDOWN * 100}%`],
                ["MAX RISK PER TRADE", `${RISK.MAX_LOSS_TRADE * 100}% (ATR-sized)`],
                ["STOP LOSS", "Dynamic 2× ATR"],
                ["CRYPTO FEE", `${CRYPTO_PAIRS[0].fee * 100}% per side`],
                ["FOREX FEE", `${FOREX_PAIRS[0].fee * 100}% per side`],
                ["COMMODITY FEE", `${COMMODITY_PAIRS[0].fee * 100}% per side`],
                ["SLIPPAGE", `${RISK.SLIPPAGE * 100}% per side`],
                ["SWAP COOLDOWN", `${RISK.COOLDOWN} ticks min`],
                ["BUY THRESHOLD", `Composite > ${RISK.MIN_COMP * 100}/100`],
                ["EXIT THRESHOLD", `Composite < ${RISK.EXIT_COMP * 100}/100`],
                ["ROTATION EDGE", "+12 composite points minimum"],
                ["RSI OVERBOUGHT", `> ${RISK.RSI_OB}`],
                ["RSI OVERSOLD", `< ${RISK.RSI_OS}`],
                ["BB SQUEEZE", `Band width < ${RISK.BB_SQ * 100}%`],
                ["TOTAL PAIRS MONITORED", `${ALL_PAIRS.length}`],
                ["CRYPTO PAIRS", `${CRYPTO_PAIRS.length}`],
                ["FOREX PAIRS", `${FOREX_PAIRS.length}`],
                ["COMMODITIES", "XAU/USD · XAG/USD · WTI/USD"],
                ["CROSS PAIRS", "BTC/ETH · ETH/BNB · SOL/ETH"],
              ].map(([k, v]) => (
                <div
                  key={k}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 10,
                    padding: "5px 0",
                    borderBottom: "1px solid rgba(255,255,255,0.03)",
                  }}
                >
                  <span style={{ color: "#446" }}>{k}</span>
                  <span style={{ color: "#aaa" }}>{v}</span>
                </div>
              ))}
            </P>
            <P>
              <PL>▸ ENGINE DECISION LOGIC</PL>
              <div style={{ fontSize: 10, color: "#667", lineHeight: 2 }}>
                <div style={{ color: "#00cfff", fontSize: 10, marginBottom: 4 }}>
                  COMPOSITE SCORE (0–100)
                </div>
                <div style={{ marginBottom: 12 }}>
                  RSI 25% · EMA crossover 20% · MACD 25% · Bollinger %B 20% · Momentum 10%
                  <br />
                  Score above 35 = BUY · Below 25 = EXIT · HOLD in between
                </div>
                <div style={{ color: "#00cfff", fontSize: 10, marginBottom: 4 }}>
                  SWAP DECISION TREE
                </div>
                <div style={{ marginBottom: 12 }}>
                  1. Composite below 25? → EXIT immediately
                  <br />
                  2. 2×ATR stop hit? → STOP LOSS
                  <br />
                  3. Better pair has 12pt edge? → ROTATE
                  <br />
                  4. Cooldown satisfied? If not, hold.
                </div>
                <div style={{ color: "#00cfff", fontSize: 10, marginBottom: 4 }}>
                  COST MODEL (per swap)
                </div>
                <div style={{ marginBottom: 12 }}>
                  Entry fee + exit fee + entry slippage + exit slippage
                  <br />
                  Crypto: ~0.3% round trip
                  <br />
                  Forex: ~0.09% round trip
                  <br />
                  Commodity: ~0.16% round trip
                </div>
                <div style={{ color: "#ffd700", fontSize: 10, marginBottom: 4 }}>
                  GOLD (XAU/USD)
                </div>
                <div style={{ marginBottom: 12 }}>
                  Volatility factor 0.12% — lower than crypto but higher than forex. Same 5
                  indicators applied. Tends to diverge from crypto during risk-off events.
                </div>
                <div style={{ color: "#00cfff", fontSize: 10, marginBottom: 4 }}>DATA SOURCES</div>
                <div>
                  Crypto: CoinGecko every 30s (live)
                  <br />
                  Gold/Silver: CoinGecko (when available)
                  <br />
                  Forex: Calibrated simulation
                  <br />
                  Cross pairs: Derived from base prices
                </div>
              </div>
            </P>
          </div>
        )}

        <div
          style={{
            marginTop: 12,
            fontSize: 8,
            color: "#0a1018",
            textAlign: "center",
            letterSpacing: 2,
          }}
        >
          NEXUSARB v3 · {ALL_PAIRS.length} PAIRS · {src.toUpperCase()} · TICK #{tickN.current} ·
          EDUCATIONAL USE ONLY
        </div>
      </div>
      <style>{`
        /* IBM Plex Mono loaded from system fonts — no CDN dependency */
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:rgba(0,255,136,0.2);border-radius:2px;}
        input:focus,select:focus{outline:none;border-color:rgba(0,255,136,0.4)!important;}
        select option{background:#111;}
      `}</style>
    </div>
  );
}
