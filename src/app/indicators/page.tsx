"use client";

import { useEffect, useState, useCallback } from "react";
import { getExpiryDates, getOptionChain, getIntradayHistory } from "@/services/api";
import {
    Button, Select, MenuItem, FormControl, InputLabel,
    Switch, FormControlLabel, Typography, Paper
} from "@mui/material";
import { RefreshCw, TrendingUp, TrendingDown, Minus } from "lucide-react";
import clsx from "clsx";

const INDICES = [
    { label: 'NIFTY', value: 'NSE_INDEX|Nifty 50' },
    { label: 'BANKNIFTY', value: 'NSE_INDEX|Nifty Bank' },
    { label: 'FINNIFTY', value: 'NSE_INDEX|Nifty Fin Service' },
    { label: 'MIDCPNIFTY', value: 'NSE_INDEX|NIFTY MID SELECT' },
    { label: 'SENSEX', value: 'BSE_INDEX|SENSEX' },
    { label: 'BANKEX', value: 'BSE_INDEX|BANKEX' },
];

type IndicatorSignal = "BUY" | "SELL" | "NEUTRAL";

interface IndicatorResult {
    name: string;
    value: number | string;
    signal: IndicatorSignal;
    description: string;
    extras?: Record<string, string | number>;
}

interface RecoveryItem {
    strike: number;
    type: 'CE' | 'PE';
    instrumentKey: string;
    ltp: number;
    low: number;
    high: number;
    recoveryPct: number;
    signal: IndicatorSignal;
    action: string;
}

function getSignalStyle(signal: IndicatorSignal) {
    switch (signal) {
        case "BUY":
            return {
                bg: "bg-emerald-500", border: "border-emerald-400", glow: "shadow-emerald-500/40",
                text: "text-white", icon: TrendingUp, gradientFrom: "from-emerald-500",
                gradientTo: "to-green-600", ringColor: "ring-emerald-400/30", pulseColor: "bg-emerald-400",
            };
        case "SELL":
            return {
                bg: "bg-rose-500", border: "border-rose-400", glow: "shadow-rose-500/40",
                text: "text-white", icon: TrendingDown, gradientFrom: "from-rose-500",
                gradientTo: "to-red-600", ringColor: "ring-rose-400/30", pulseColor: "bg-rose-400",
            };
        default:
            return {
                bg: "bg-amber-500", border: "border-amber-400", glow: "shadow-amber-500/40",
                text: "text-white", icon: Minus, gradientFrom: "from-amber-500",
                gradientTo: "to-yellow-600", ringColor: "ring-amber-400/30", pulseColor: "bg-amber-400",
            };
    }
}

// ─── Indicator #1 & #2: PCR ───

function computePCRSignal(pcr: number, name = "PCR", label = "Overall"): IndicatorResult {
    let signal: IndicatorSignal = "NEUTRAL";
    let description = `${label} PCR is in the neutral zone (0.7 – 1.3). No clear directional bias.`;

    if (pcr > 1.3) {
        signal = "SELL";
        description = `${label} PCR ${pcr.toFixed(2)} > 1.3 — Excessive put writing indicates bearish sentiment.`;
    } else if (pcr < 0.7) {
        signal = "BUY";
        description = `${label} PCR ${pcr.toFixed(2)} < 0.7 — Excessive call writing indicates bullish sentiment.`;
    } else {
        description = `${label} PCR ${pcr.toFixed(2)} is in the neutral zone (0.7 – 1.3).`;
    }

    return { name, value: pcr, signal, description, extras: { "Thresholds": "BUY < 0.7 | SELL > 1.3" } };
}

function computeAtmPcr(rawData: any[], spotPrice: number): { itmCallOi: number; itmPutOi: number; pcr: number } {
    const strikes: any = {};
    rawData.forEach((item: any) => {
        if (!strikes[item.strike_price]) strikes[item.strike_price] = { strike: item.strike_price };
        if (item.instrument_type === 'CE') strikes[item.strike_price].ce = item;
        if (item.instrument_type === 'PE') strikes[item.strike_price].pe = item;
    });

    const sorted = Object.values(strikes)
        .filter((s: any) => s.ce && s.pe)
        .sort((a: any, b: any) => a.strike - b.strike);

    let itmCallOi = 0;
    let itmPutOi = 0;

    if (spotPrice > 0 && sorted.length > 0) {
        const atmIdx = findNearestAtmIdx(sorted, spotPrice);
        if (atmIdx !== -1) {
            const startCall = Math.max(0, atmIdx - 5);
            sorted.slice(startCall, atmIdx).forEach((s: any) => { itmCallOi += (s.ce?.open_interest || 0); });
            sorted.slice(atmIdx, atmIdx + 5).forEach((s: any) => { itmPutOi += (s.pe?.open_interest || 0); });
        }
    }

    const pcr = itmCallOi > 0 ? itmPutOi / itmCallOi : 0;
    return { itmCallOi, itmPutOi, pcr };
}

// ─── Helpers ───

/** Find the index of the strike nearest to spotPrice in a sorted array of strike objects. */
function findNearestAtmIdx(sorted: any[], spotPrice: number): number {
    if (sorted.length === 0) return -1;
    const idx = sorted.findIndex((s: any) => s.strike >= spotPrice);
    if (idx === -1) return sorted.length - 1; // all strikes below spot
    if (idx === 0) return 0; // all strikes above spot
    // Compare distance to idx vs idx-1 and pick the closest
    const upperDist = Math.abs((sorted[idx] as any).strike - spotPrice);
    const lowerDist = Math.abs((sorted[idx - 1] as any).strike - spotPrice);
    return lowerDist <= upperDist ? idx - 1 : idx;
}

function deriveOverallSignal(indicators: IndicatorResult[]): IndicatorSignal {
    let buy = 0, sell = 0;
    indicators.forEach(i => {
        if (i.signal === "BUY") buy++;
        else if (i.signal === "SELL") sell++;
    });
    if (buy > sell) return "BUY";
    if (sell > buy) return "SELL";
    return "NEUTRAL";
}

// ─── Indicator #3: ITM OI Dominance ───

function computeOiDominance(itmCallOi: number, itmPutOi: number): IndicatorResult {
    const total = itmCallOi + itmPutOi;
    if (total === 0) {
        return { name: "ITM OI Dominance", value: "N/A", signal: "NEUTRAL", description: "No OI data available." };
    }

    const diff = Math.abs(itmPutOi - itmCallOi);
    const diffPct = (diff / Math.min(itmCallOi || 1, itmPutOi || 1)) * 100;

    let signal: IndicatorSignal = "NEUTRAL";
    let strength = "";
    let description = "";

    if (itmPutOi > itmCallOi) {
        // Put OI dominant → Bullish (puts being written = support)
        if (diffPct >= 50) {
            signal = "BUY";
            strength = "Strong";
            description = `Put OI (${itmPutOi.toLocaleString('en-IN')}) dominates Call OI (${itmCallOi.toLocaleString('en-IN')}) by ${diffPct.toFixed(0)}% — Super Bullish! Heavy put writing = strong support.`;
        } else if (diffPct >= 20) {
            signal = "BUY";
            description = `Put OI (${itmPutOi.toLocaleString('en-IN')}) > Call OI (${itmCallOi.toLocaleString('en-IN')}) by ${diffPct.toFixed(0)}% — Bullish. Put writing indicates support.`;
        } else {
            description = `Put OI (${itmPutOi.toLocaleString('en-IN')}) vs Call OI (${itmCallOi.toLocaleString('en-IN')}) — difference ${diffPct.toFixed(0)}% is below 20% threshold. No clear dominance.`;
        }
    } else if (itmCallOi > itmPutOi) {
        // Call OI dominant → Bearish (calls being written = resistance)
        if (diffPct >= 50) {
            signal = "SELL";
            strength = "Strong";
            description = `Call OI (${itmCallOi.toLocaleString('en-IN')}) dominates Put OI (${itmPutOi.toLocaleString('en-IN')}) by ${diffPct.toFixed(0)}% — Super Bearish! Heavy call writing = strong resistance.`;
        } else if (diffPct >= 20) {
            signal = "SELL";
            description = `Call OI (${itmCallOi.toLocaleString('en-IN')}) > Put OI (${itmPutOi.toLocaleString('en-IN')}) by ${diffPct.toFixed(0)}% — Bearish. Call writing indicates resistance.`;
        } else {
            description = `Call OI (${itmCallOi.toLocaleString('en-IN')}) vs Put OI (${itmPutOi.toLocaleString('en-IN')}) — difference ${diffPct.toFixed(0)}% is below 20% threshold. No clear dominance.`;
        }
    } else {
        description = `Call OI and Put OI are equal (${itmCallOi.toLocaleString('en-IN')}). Perfectly balanced.`;
    }

    const displayValue = `${diffPct.toFixed(0)}%${strength ? " (" + strength + ")" : ""}`;
    return {
        name: "ITM OI Dominance", value: displayValue, signal, description,
        extras: {
            "ITM Call OI (5)": itmCallOi.toLocaleString('en-IN'),
            "ITM Put OI (5)": itmPutOi.toLocaleString('en-IN'),
            "Difference": `${diff.toLocaleString('en-IN')} (${diffPct.toFixed(1)}%)`,
            "Threshold": "Min 20% diff for signal, 50%+ = Strong"
        }
    };
}

// ─── Indicator #4: Premium Skew ───

interface SkewPair {
    label: string;
    ceStrike: number;
    peStrike: number;
    ceLtp: number;
    peLtp: number;
    ceExtrinsic: number;
    peExtrinsic: number;
    diffPct: number;
    signal: IndicatorSignal;
}

function computePremiumSkew(rawData: any[], spotPrice: number): IndicatorResult {
    const strikes: Record<number, any> = {};
    rawData.forEach((item: any) => {
        if (!strikes[item.strike_price]) strikes[item.strike_price] = { strike: item.strike_price };
        if (item.instrument_type === 'CE') strikes[item.strike_price].ce = item;
        if (item.instrument_type === 'PE') strikes[item.strike_price].pe = item;
    });

    const sorted = Object.values(strikes)
        .filter((s: any) => s.ce && s.pe)
        .sort((a: any, b: any) => a.strike - b.strike);

    if (spotPrice <= 0 || sorted.length < 5) {
        return { name: "Premium Skew", value: "N/A", signal: "NEUTRAL", description: "Insufficient data to compute premium skew." };
    }

    const atmIdx = findNearestAtmIdx(sorted, spotPrice);
    if (atmIdx === -1) {
        return { name: "Premium Skew", value: "N/A", signal: "NEUTRAL", description: "Cannot determine ATM strike." };
    }

    // Helper: subtract intrinsic value to get extrinsic (time) value
    const getExtrinsic = (ltp: number, strike: number, type: 'CE' | 'PE'): number => {
        const intrinsic = type === 'CE'
            ? Math.max(0, spotPrice - strike)   // CE intrinsic = max(0, spot - strike)
            : Math.max(0, strike - spotPrice);  // PE intrinsic = max(0, strike - spot)
        return Math.max(0, ltp - intrinsic);
    };

    const buildPair = (label: string, ceRow: any, peRow: any): SkewPair | null => {
        if (!ceRow.ce || !peRow.pe) return null;
        const ceLtp = ceRow.ce.last_price || 0;
        const peLtp = peRow.pe.last_price || 0;
        const ceExtrinsic = getExtrinsic(ceLtp, ceRow.strike, 'CE');
        const peExtrinsic = getExtrinsic(peLtp, peRow.strike, 'PE');
        const avg = (ceExtrinsic + peExtrinsic) / 2;
        const diffPct = avg > 0 ? ((ceExtrinsic - peExtrinsic) / avg) * 100 : 0;
        return {
            label, ceStrike: ceRow.strike, peStrike: peRow.strike,
            ceLtp, peLtp, ceExtrinsic, peExtrinsic, diffPct,
            signal: Math.abs(diffPct) < 10 ? "NEUTRAL" : (diffPct > 0 ? "SELL" : "BUY")
        };
    };

    const pairs: SkewPair[] = [];

    // Pair 1: ATM CE vs ATM PE
    const atmPair = buildPair("ATM vs ATM", sorted[atmIdx], sorted[atmIdx]);
    if (atmPair) pairs.push(atmPair);

    // Pair 2: ATM-1 CE vs ATM+1 PE
    if (atmIdx - 1 >= 0 && atmIdx + 1 < sorted.length) {
        const p = buildPair("ATM-1 CE vs ATM+1 PE", sorted[atmIdx - 1], sorted[atmIdx + 1]);
        if (p) pairs.push(p);
    }

    // Pair 3: ATM-2 CE vs ATM+2 PE
    if (atmIdx - 2 >= 0 && atmIdx + 2 < sorted.length) {
        const p = buildPair("ATM-2 CE vs ATM+2 PE", sorted[atmIdx - 2], sorted[atmIdx + 2]);
        if (p) pairs.push(p);
    }

    if (pairs.length === 0) {
        return { name: "Premium Skew", value: "N/A", signal: "NEUTRAL", description: "Could not compute premium skew pairs." };
    }

    let buyCount = 0, sellCount = 0;
    pairs.forEach(p => {
        if (p.signal === "BUY") buyCount++;
        else if (p.signal === "SELL") sellCount++;
    });
    const overallSig: IndicatorSignal = buyCount > sellCount ? "BUY" : (sellCount > buyCount ? "SELL" : "NEUTRAL");

    let desc = "";
    if (overallSig === "SELL") {
        desc = `PE extrinsic value is relatively cheap across ${sellCount}/${pairs.length} pairs — bearish skew. Market expects downside (buy puts).`;
    } else if (overallSig === "BUY") {
        desc = `CE extrinsic value is relatively cheap across ${buyCount}/${pairs.length} pairs — bullish skew. Market expects upside (buy calls).`;
    } else {
        desc = `CE and PE extrinsic values are balanced — no clear directional skew.`;
    }

    const extras: Record<string, string | number> = {};
    pairs.forEach((p) => {
        const ceIntrinsic = p.ceLtp - p.ceExtrinsic;
        const peIntrinsic = p.peLtp - p.peExtrinsic;
        const diff = Math.abs(p.ceExtrinsic - p.peExtrinsic);
        const sigEmoji = p.signal === "BUY" ? "🟢" : (p.signal === "SELL" ? "🔴" : "🟡");
        extras[`${p.label} CE (${p.ceStrike})`] = `LTP ₹${p.ceLtp.toFixed(1)} − ₹${ceIntrinsic.toFixed(1)} intrinsic = ₹${p.ceExtrinsic.toFixed(1)} extrinsic`;
        extras[`${p.label} PE (${p.peStrike})`] = `LTP ₹${p.peLtp.toFixed(1)} − ₹${peIntrinsic.toFixed(1)} intrinsic = ₹${p.peExtrinsic.toFixed(1)} extrinsic (fair ≈ ₹${p.ceExtrinsic.toFixed(1)})`;
        if (p.ceExtrinsic > p.peExtrinsic) {
            extras[`${p.label} Verdict`] = `PE is ₹${diff.toFixed(1)} cheaper than fair value (${Math.abs(p.diffPct).toFixed(1)}%) ${sigEmoji}`;
        } else if (p.peExtrinsic > p.ceExtrinsic) {
            extras[`${p.label} Verdict`] = `CE is ₹${diff.toFixed(1)} cheaper than fair value (${Math.abs(p.diffPct).toFixed(1)}%) ${sigEmoji}`;
        } else {
            extras[`${p.label} Verdict`] = `CE and PE extrinsic are equal ${sigEmoji}`;
        }
    });
    extras["Logic"] = "Fair value: CE extrinsic ≈ PE extrinsic (by put-call parity). Difference = skew.";

    const avgDiff = pairs.reduce((s, p) => s + p.diffPct, 0) / pairs.length;
    return {
        name: "Premium Skew", value: `${avgDiff > 0 ? "+" : ""}${avgDiff.toFixed(1)}%`,
        signal: overallSig, description: desc, extras
    };
}

// ─── Indicator #5: ATM Technical Signals ───

interface TechSignal {
    indicator: string;
    value: string;
    signal: IndicatorSignal;
}

interface OptionTechnicals {
    label: string; // "ATM CE" or "ATM PE"
    strike: number;
    instrumentKey: string;
    tf5: TechSignal[];
    tf15: TechSignal[];
    signal5: IndicatorSignal;
    signal15: IndicatorSignal;
    overall: IndicatorSignal;
}

function deriveTechSignals(indicators: any): TechSignal[] {
    if (!indicators) return [];
    const signals: TechSignal[] = [];

    // DMI: DI+ > DI- → BUY, DI- > DI+ → SELL
    const dmp = indicators.dmp || 0;
    const dmn = indicators.dmn || 0;
    const adx = indicators.adx || 0;
    if (adx > 20) {
        signals.push({
            indicator: "DMI",
            value: `DI+ ${dmp.toFixed(1)} / DI- ${dmn.toFixed(1)} (ADX ${adx.toFixed(1)})`,
            signal: dmp > dmn ? "BUY" : (dmn > dmp ? "SELL" : "NEUTRAL")
        });
    } else {
        signals.push({
            indicator: "DMI",
            value: `DI+ ${dmp.toFixed(1)} / DI- ${dmn.toFixed(1)} (ADX ${adx.toFixed(1)} weak)`,
            signal: "NEUTRAL"
        });
    }

    // MACD: MACD > Signal → BUY, MACD < Signal → SELL
    const macd = indicators.macd || 0;
    const macdSignal = indicators.macd_signal || 0;
    const macdHist = indicators.macd_hist || 0;
    signals.push({
        indicator: "MACD",
        value: `Line ${macd.toFixed(2)} / Signal ${macdSignal.toFixed(2)} (Hist ${macdHist.toFixed(2)})`,
        signal: macdHist > 0 ? "BUY" : (macdHist < 0 ? "SELL" : "NEUTRAL")
    });

    // StochRSI: K > D and K < 80 → BUY, K < D and K > 20 → SELL
    const stochK = indicators.stoch_k || 0;
    const stochD = indicators.stoch_d || 0;
    let stochSig: IndicatorSignal = "NEUTRAL";
    if (stochK > stochD && stochK < 80) stochSig = "BUY";
    else if (stochK < stochD && stochK > 20) stochSig = "SELL";
    else if (stochK >= 80) stochSig = "SELL"; // overbought
    else if (stochK <= 20) stochSig = "BUY"; // oversold
    signals.push({
        indicator: "Stoch RSI",
        value: `K ${stochK.toFixed(1)} / D ${stochD.toFixed(1)}`,
        signal: stochSig
    });

    return signals;
}

function majoritySignal(signals: TechSignal[]): IndicatorSignal {
    let b = 0, s = 0;
    signals.forEach(sig => { if (sig.signal === "BUY") b++; else if (sig.signal === "SELL") s++; });
    if (b > s) return "BUY";
    if (s > b) return "SELL";
    return "NEUTRAL";
}

async function fetchOptionTechnicals(instrumentKey: string, label: string, strike: number): Promise<OptionTechnicals | null> {
    try {
        const [data5, data15] = await Promise.all([
            getIntradayHistory(instrumentKey, '5minute'),
            getIntradayHistory(instrumentKey, '15minute')
        ]);

        const ind5 = data5?.indicators || null;
        const ind15 = data15?.indicators || null;

        const tf5 = deriveTechSignals(ind5);
        const tf15 = deriveTechSignals(ind15);

        const signal5 = majoritySignal(tf5);
        const signal15 = majoritySignal(tf15);

        // Overall: both timeframes must agree for a strong signal
        let overall: IndicatorSignal = "NEUTRAL";
        if (signal5 === signal15 && signal5 !== "NEUTRAL") overall = signal5;
        else if (signal5 !== "NEUTRAL" && signal15 === "NEUTRAL") overall = signal5;
        else if (signal15 !== "NEUTRAL" && signal5 === "NEUTRAL") overall = signal15;

        return { label, strike, instrumentKey, tf5, tf15, signal5, signal15, overall };
    } catch (e) {
        console.error(`Failed to fetch technicals for ${label}:`, e);
        return null;
    }
}

function buildTechnicalsIndicator(ce: OptionTechnicals | null, pe: OptionTechnicals | null): IndicatorResult {
    if (!ce && !pe) {
        return { name: "ATM Technical Signals", value: "N/A", signal: "NEUTRAL", description: "Could not fetch technical data for ATM options." };
    }

    // Build extras showing all values
    const extras: Record<string, string | number> = {};

    const formatOption = (opt: OptionTechnicals, type: string) => {
        opt.tf5.forEach(s => {
            const emoji = s.signal === "BUY" ? "🟢" : (s.signal === "SELL" ? "🔴" : "🟡");
            extras[`${type} 5m ${s.indicator}`] = `${s.value} ${emoji}`;
        });
        opt.tf15.forEach(s => {
            const emoji = s.signal === "BUY" ? "🟢" : (s.signal === "SELL" ? "🔴" : "🟡");
            extras[`${type} 15m ${s.indicator}`] = `${s.value} ${emoji}`;
        });
        const e5 = opt.signal5 === "BUY" ? "🟢" : (opt.signal5 === "SELL" ? "🔴" : "🟡");
        const e15 = opt.signal15 === "BUY" ? "🟢" : (opt.signal15 === "SELL" ? "🔴" : "🟡");
        extras[`${type} Verdict`] = `5m: ${opt.signal5} ${e5} | 15m: ${opt.signal15} ${e15} → ${opt.overall}`;
    };

    if (ce) formatOption(ce, "CE");
    if (pe) formatOption(pe, "PE");

    // Overall: CE technicals bullish → BUY CE; PE technicals bullish → BUY PE (SELL underlying)
    // If CE shows BUY → underlying bullish → BUY
    // If PE shows BUY → underlying bearish → SELL
    let signal: IndicatorSignal = "NEUTRAL";
    let desc = "";

    const ceSignal = ce?.overall || "NEUTRAL";
    const peSignal = pe?.overall || "NEUTRAL";

    if (ceSignal === "BUY" && peSignal !== "BUY") {
        signal = "BUY";
        desc = `ATM CE (${ce?.strike}) technicals are bullish across timeframes — CE momentum confirms upside. Buy CE.`;
    } else if (peSignal === "BUY" && ceSignal !== "BUY") {
        signal = "SELL";
        desc = `ATM PE (${pe?.strike}) technicals are bullish across timeframes — PE momentum confirms downside. Buy PE.`;
    } else if (ceSignal === "BUY" && peSignal === "BUY") {
        signal = "NEUTRAL";
        desc = `Both ATM CE and PE show bullish technicals — conflicting signals, likely high volatility. Wait for clarity.`;
    } else if (ceSignal === "SELL" && peSignal === "SELL") {
        signal = "NEUTRAL";
        desc = `Both ATM CE and PE show bearish technicals — both sides losing momentum. Wait for clarity.`;
    } else {
        desc = `ATM CE: ${ceSignal}, ATM PE: ${peSignal} — no clear directional alignment in technicals.`;
    }

    return { name: "ATM Technical Signals", value: `CE:${ceSignal} PE:${peSignal}`, signal, description: desc, extras };
}

// ─── Indicator #6: Box Formation Detection ───

interface BoxResult {
    label: string;
    detected: boolean;
    boxHigh: number;
    boxLow: number;
    rangeWidth: number;
    containment: number;
    candleCount: number;
    ltp: number;
    breakout: "up" | "down" | "none";
    positionInBox: string;
    firstSupportTime: string;
}

async function detectBoxFormation(instrumentKey: string, label: string, liveLtp: number): Promise<BoxResult | null> {
    try {
        const data = await getIntradayHistory(instrumentKey, '15minute');
        if (!data?.candles || data.candles.length < 10) return null;

        const allCandles = data.candles;

        // Separate today's candles from previous days
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        const prevDayCandles = allCandles.filter((c: any) => {
            const ts = c.timestamp || '';
            return !ts.startsWith(todayStr);
        });

        if (prevDayCandles.length < 10) return null;
        const len = prevDayCandles.length;

        const highs = prevDayCandles.map((c: any) => c.high);
        const lows = prevDayCandles.map((c: any) => c.low);
        const closes = prevDayCandles.map((c: any) => c.close);
        const avgPrice = closes.reduce((a: number, b: number) => a + b, 0) / len;

        // --- Find support & resistance using price zone clustering ---
        const allPrices = [...highs, ...lows, ...closes];
        const minPrice = Math.min(...allPrices);
        const maxPrice = Math.max(...allPrices);
        const priceRange = maxPrice - minPrice;
        if (priceRange <= 0) return null;

        const numBuckets = 20;
        const bucketSize = priceRange / numBuckets;
        const buckets = new Array(numBuckets).fill(0);

        prevDayCandles.forEach((c: any) => {
            const lowBucket = Math.min(Math.floor((c.low - minPrice) / bucketSize), numBuckets - 1);
            const highBucket = Math.min(Math.floor((c.high - minPrice) / bucketSize), numBuckets - 1);
            for (let b = lowBucket; b <= highBucket; b++) buckets[b]++;
        });

        // Sliding window to find densest contiguous zone (the box)
        let bestStart = 0, bestEnd = numBuckets - 1, bestDensity = 0;
        for (let width = 4; width <= 14; width++) {
            for (let start = 0; start <= numBuckets - width; start++) {
                let density = 0;
                for (let b = start; b < start + width; b++) density += buckets[b];
                if (density > bestDensity) {
                    bestDensity = density;
                    bestStart = start;
                    bestEnd = start + width - 1;
                }
            }
        }

        const boxLow = minPrice + bestStart * bucketSize;
        const boxHigh = minPrice + (bestEnd + 1) * bucketSize;
        const boxRange = avgPrice > 0 ? ((boxHigh - boxLow) / avgPrice) * 100 : 0;

        // Count candles whose body is mostly inside the box
        let insideCount = 0;
        prevDayCandles.forEach((c: any) => {
            const bodyHigh = Math.max(c.open, c.close);
            const bodyLow = Math.min(c.open, c.close);
            const overlap = Math.min(bodyHigh, boxHigh) - Math.max(bodyLow, boxLow);
            const bodySize = bodyHigh - bodyLow || 0.01;
            if (overlap / bodySize >= 0.5) insideCount++;
        });
        const containment = (insideCount / len) * 100;

        // Use live LTP to detect breakout from historical box
        const ltp = liveLtp > 0 ? liveLtp : closes[len - 1];
        let breakout: "up" | "down" | "none" = "none";
        let positionInBox = "inside box";

        if (ltp > boxHigh * 1.02) {
            breakout = "up";
            positionInBox = `ABOVE box (breakout ${((ltp - boxHigh) / boxHigh * 100).toFixed(1)}%)`;
        } else if (ltp < boxLow * 0.98) {
            breakout = "down";
            positionInBox = `BELOW box (breakdown ${((boxLow - ltp) / boxLow * 100).toFixed(1)}%)`;
        } else if (ltp >= boxHigh * 0.97) {
            positionInBox = "near resistance (breakout zone)";
        } else if (ltp <= boxLow * 1.03) {
            positionInBox = "near support";
        } else {
            positionInBox = "inside box (mid-range)";
        }

        // Box detected if 60%+ containment
        const detected = containment >= 60;

        // Find when support was first formed (first candle touching the box low zone)
        let firstSupportTime = "";
        for (const c of prevDayCandles) {
            const cLow = c.low;
            if (cLow >= boxLow * 0.98 && cLow <= boxLow * 1.05) {
                const ts = c.timestamp || '';
                // Format: extract date and time
                const dt = new Date(ts);
                if (!isNaN(dt.getTime())) {
                    firstSupportTime = dt.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
                } else {
                    firstSupportTime = ts.substring(0, 16).replace('T', ' ');
                }
                break;
            }
        }

        return {
            label, detected, boxHigh, boxLow,
            rangeWidth: boxRange, containment,
            candleCount: len, ltp, breakout, positionInBox,
            firstSupportTime
        };
    } catch (e) {
        console.error(`Box detection failed for ${label}:`, e);
        return null;
    }
}

function buildBoxIndicator(ceBox: BoxResult | null, peBox: BoxResult | null): IndicatorResult {
    const extras: Record<string, string | number> = {};
    let signal: IndicatorSignal = "NEUTRAL";
    let desc = "";

    const formatBox = (box: BoxResult, type: string) => {
        extras[`${type} Box`] = box.detected ? "Detected" : "Not found";
        extras[`${type} Support`] = `${box.boxLow.toFixed(1)}`;
        extras[`${type} Resistance`] = `${box.boxHigh.toFixed(1)}`;
        if (box.firstSupportTime) {
            extras[`${type} Box Formed`] = box.firstSupportTime;
        }
        extras[`${type} Width`] = `${box.rangeWidth.toFixed(1)}%`;
        extras[`${type} Containment`] = `${box.containment.toFixed(0)}% (${box.candleCount} candles)`;
        extras[`${type} LTP`] = `${box.ltp.toFixed(1)} - ${box.positionInBox}`;
        if (box.breakout !== "none") {
            extras[`${type} Breakout`] = box.breakout === "up" ? "Upside breakout!" : "Downside breakdown!";
        }
    };

    if (ceBox) formatBox(ceBox, "CE");
    if (peBox) formatBox(peBox, "PE");

    const ceDetected = ceBox?.detected || false;
    const peDetected = peBox?.detected || false;
    const ceBreakout = ceBox?.breakout || "none";
    const peBreakout = peBox?.breakout || "none";

    // Breakout signals take priority
    if (ceDetected && ceBreakout === "up") {
        signal = "BUY";
        desc = `CE box broken out! LTP ${ceBox!.ltp.toFixed(1)} above resistance.`;
    } else if (peDetected && peBreakout === "up") {
        signal = "SELL";
        desc = `PE box broken out! LTP ${peBox!.ltp.toFixed(1)} above resistance.`;
    } else if (ceDetected && ceBreakout === "down") {
        signal = "SELL";
        desc = `CE box broken down! LTP ${ceBox!.ltp.toFixed(1)} below support.`;
    } else if (peDetected && peBreakout === "down") {
        signal = "BUY";
        desc = `PE box broken down! LTP ${peBox!.ltp.toFixed(1)} below support.`;
    } else if (ceDetected || peDetected) {
        signal = "NEUTRAL";
        desc = `Price currently consolidating within a price box. Breakout expected soon.`;
    } else {
        desc = `No box formation detected.`;
    }

    const ceLabel = ceDetected ? (ceBreakout !== "none" ? "CE Breakout" : "CE Box") : "CE None";
    const peLabel = peDetected ? (peBreakout !== "none" ? "PE Breakout" : "PE Box") : "PE None";

    return { name: "Box Formation", value: `${ceLabel} | ${peLabel}`, signal, description: desc, extras };
}

// ─── Indicator #7: Day's Low Recovery ───

function computeRecoveryIndicator(chain: any[], spot: number): { items: RecoveryItem[]; result: IndicatorResult } {
    if (!chain || chain.length === 0 || spot <= 0) {
        return { items: [], result: { name: "Day's Low Recovery", value: "N/A", signal: "NEUTRAL", description: "No chain data available." } };
    }

    const uniqueStrikes = Array.from(new Set(chain.map(c => c.strike_price))).sort((a, b) => (a as number) - (b as number));
    const atmIdx = findNearestAtmIdx(uniqueStrikes.map(s => ({ strike: s })), spot);
    if (atmIdx === -1) {
        return { items: [], result: { name: "Day's Low Recovery", value: "N/A", signal: "NEUTRAL", description: "Could not find ATM strike." } };
    }

    const atmStrike = uniqueStrikes[atmIdx];
    const atmPlus1 = uniqueStrikes[Math.min(atmIdx + 1, uniqueStrikes.length - 1)];
    const atmMinus1 = uniqueStrikes[Math.max(atmIdx - 1, 0)];

    const targetStrikes = Array.from(new Set([atmMinus1, atmStrike, atmPlus1])).sort((a, b) => (a as number) - (b as number)) as number[];
    const items: RecoveryItem[] = [];

    targetStrikes.forEach(strike => {
        ['CE', 'PE'].forEach(type => {
            const contract = chain.find(c => c.strike_price === strike && c.instrument_type === type);
            if (contract) {
                const ltp = contract.last_price || 0;
                const low = contract.low_price || 0;
                const high = contract.high_price || 0;
                let recoveryPct = 0;
                if (low > 0) recoveryPct = ((ltp - low) / low) * 100;

                let signal: IndicatorSignal = "NEUTRAL";
                let action = "-";
                if (recoveryPct >= 100) { signal = "BUY"; action = "SELL OPTION"; }
                else if (recoveryPct >= 50) { signal = "NEUTRAL"; action = "CHANCE OF REVERSAL"; }

                items.push({ strike, type: type as 'CE' | 'PE', instrumentKey: contract.instrument_key, ltp, low, high, recoveryPct, signal, action });
            }
        });
    });

    const hasBuy = items.some(i => i.signal === "BUY");
    return {
        items,
        result: {
            name: "Day's Low Recovery",
            value: items.length > 0 ? `${items.filter(i => i.signal === "BUY").length} Signals` : "None",
            signal: hasBuy ? "BUY" : "NEUTRAL",
            description: "Monitors recovery from day's low for ATM +/- 1 strikes. 50%+ recovery suggests reversal; 100%+ signals strong move/target reached.",
            extras: {}
        }
    };
}

export default function IndicatorsPage() {
    const [index, setIndex] = useState(INDICES[0].value);
    const [expiryDates, setExpiryDates] = useState<string[]>([]);
    const [expiry, setExpiry] = useState("");
    const [loading, setLoading] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [lastFetched, setLastFetched] = useState<string>("");

    const [spot, setSpot] = useState(0);
    const [totals, setTotals] = useState({ ce: 0, pe: 0 });
    const [indicators, setIndicators] = useState<IndicatorResult[]>([]);
    const [overallSignal, setOverallSignal] = useState<IndicatorSignal>("NEUTRAL");
    const [techData, setTechData] = useState<{ ce: OptionTechnicals | null; pe: OptionTechnicals | null }>({ ce: null, pe: null });
    const [boxData, setBoxData] = useState<{ ce: BoxResult | null; pe: BoxResult | null }>({ ce: null, pe: null });
    const [recoveryData, setRecoveryData] = useState<RecoveryItem[]>([]);

    const loadExpiries = useCallback(async () => {
        const dates = await getExpiryDates(index);
        setExpiryDates(dates);
        if (dates.length > 0) setExpiry(dates[0]);
        else setExpiry("");
    }, [index]);

    useEffect(() => { loadExpiries(); }, [loadExpiries]);

    const fetchData = useCallback(async (silent = false) => {
        if (!expiry) return;
        if (!silent) setLoading(true);

        try {
            const data = await getOptionChain(index, expiry);
            const spotPrice = data.spot_price || 0;
            setSpot(spotPrice);

            const t = data.totals || {};
            const ce = t.ce || 0;
            const pe = t.pe || 0;
            setTotals({ ce, pe });

            // 1. Overall PCR
            const pcr = ce > 0 ? pe / ce : 0;
            const pcrResult = computePCRSignal(pcr, "PCR", "Overall");

            // 2. ATM PCR (5 strikes each side)
            const raw = data.data || [];
            const atm = computeAtmPcr(raw, spotPrice);
            const atmPcrResult = computePCRSignal(atm.pcr, "ATM PCR (5)", "ATM (5 strikes)");
            atmPcrResult.extras = {
                ...atmPcrResult.extras,
                "ITM Call OI (5)": atm.itmCallOi.toLocaleString('en-IN'),
                "ITM Put OI (5)": atm.itmPutOi.toLocaleString('en-IN'),
            };

            // 3. ITM OI Dominance
            const oiDominanceResult = computeOiDominance(atm.itmCallOi, atm.itmPutOi);

            // 4. Premium Skew
            const skewResult = computePremiumSkew(raw, spotPrice);

            // 5. ATM Technical Signals (DMI, MACD, StochRSI on 5m & 15m)
            let techResult: IndicatorResult = { name: "ATM Technical Signals", value: "Loading...", signal: "NEUTRAL", description: "Fetching technical data..." };
            const strikes: any = {};
            raw.forEach((item: any) => {
                if (!strikes[item.strike_price]) strikes[item.strike_price] = { strike: item.strike_price };
                if (item.instrument_type === 'CE') strikes[item.strike_price].ce = item;
                if (item.instrument_type === 'PE') strikes[item.strike_price].pe = item;
            });
            const sortedStrikes = Object.values(strikes)
                .filter((s: any) => s.ce && s.pe)
                .sort((a: any, b: any) => a.strike - b.strike);
            const atmIdx = findNearestAtmIdx(sortedStrikes, spotPrice);
            if (atmIdx !== -1 && spotPrice > 0) {
                const atmRow: any = sortedStrikes[atmIdx];
                const ceKey = atmRow.ce?.instrument_key;
                const peKey = atmRow.pe?.instrument_key;
                const [ceTech, peTech] = await Promise.all([
                    ceKey ? fetchOptionTechnicals(ceKey, "ATM CE", atmRow.strike) : Promise.resolve(null),
                    peKey ? fetchOptionTechnicals(peKey, "ATM PE", atmRow.strike) : Promise.resolve(null)
                ]);
                techResult = buildTechnicalsIndicator(ceTech, peTech);
                setTechData({ ce: ceTech, pe: peTech });
            }

            // 6. Box Formation (15min, last 3 days)
            let boxResult: IndicatorResult = { name: "Box Formation", value: "N/A", signal: "NEUTRAL", description: "Detecting box formations..." };
            if (atmIdx !== -1 && spotPrice > 0) {
                const atmRow2: any = sortedStrikes[atmIdx];
                const ceKey2 = atmRow2.ce?.instrument_key;
                const peKey2 = atmRow2.pe?.instrument_key;
                const ceLtp = atmRow2.ce?.last_price || 0;
                const peLtp = atmRow2.pe?.last_price || 0;
                const [ceBox, peBox] = await Promise.all([
                    ceKey2 ? detectBoxFormation(ceKey2, "ATM CE", ceLtp) : Promise.resolve(null),
                    peKey2 ? detectBoxFormation(peKey2, "ATM PE", peLtp) : Promise.resolve(null)
                ]);
                boxResult = buildBoxIndicator(ceBox, peBox);
                setBoxData({ ce: ceBox, pe: peBox });
            }

            // 7. Day's Low Recovery
            const recovery = computeRecoveryIndicator(raw, spotPrice);
            setRecoveryData(recovery.items);
            const recoveryResult = recovery.result;

            const results: IndicatorResult[] = [pcrResult, atmPcrResult, oiDominanceResult, skewResult, techResult, boxResult, recoveryResult];
            setIndicators(results);
            setOverallSignal(deriveOverallSignal(results));
            setLastFetched(new Date().toLocaleTimeString());
        } catch (e) {
            console.error("Failed to fetch option chain:", e);
        }

        if (!silent) setLoading(false);
    }, [index, expiry]);

    useEffect(() => {
        let interval: any;
        if (autoRefresh && expiry) {
            interval = setInterval(() => fetchData(true), 5000);
        }
        return () => clearInterval(interval);
    }, [autoRefresh, expiry, fetchData]);

    const indexLabel = INDICES.find(i => i.value === index)?.label || "Index";
    const overallStyle = getSignalStyle(overallSignal);
    const OverallIcon = overallStyle.icon;

    return (
        <div className="p-4 max-w-5xl mx-auto space-y-6 pb-20">
            {/* Header */}
            <div className="text-center">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Market Indicators</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">BUY / SELL signals based on option chain analysis</p>
            </div>

            {/* Controls */}
            <Paper className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4 items-center shadow-sm bg-white dark:bg-gray-800 dark:border-gray-700">
                <FormControl size="small" fullWidth>
                    <InputLabel className="dark:text-gray-400">Index</InputLabel>
                    <Select value={index} label="Index" onChange={(e) => setIndex(e.target.value)} className="dark:text-white">
                        {INDICES.map(idx => <MenuItem key={idx.value} value={idx.value}>{idx.label}</MenuItem>)}
                    </Select>
                </FormControl>

                <FormControl size="small" fullWidth>
                    <InputLabel className="dark:text-gray-400">Expiry</InputLabel>
                    <Select value={expiry} label="Expiry" onChange={(e) => setExpiry(e.target.value)} className="dark:text-white">
                        {expiryDates.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                    </Select>
                </FormControl>

                <div className="flex items-center space-x-2">
                    <Button variant="contained" size="small" onClick={() => fetchData()} disabled={loading || !expiry}
                        startIcon={<RefreshCw className={clsx("w-4 h-4", loading && "animate-spin")} />}>
                        {loading ? "Loading..." : "Fetch"}
                    </Button>
                    <FormControlLabel
                        control={<Switch size="small" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />}
                        label={<span className="text-sm dark:text-gray-200">Auto</span>}
                    />
                </div>

                <div className="flex flex-col items-end text-xs text-gray-500 dark:text-gray-400">
                    {spot > 0 && <span className="font-semibold text-base text-gray-800 dark:text-gray-200">{indexLabel}: {spot.toFixed(2)}</span>}
                    {lastFetched && <span>Last: {lastFetched}</span>}
                </div>
            </Paper>

            {/* Overall Signal - Hero Card */}
            {indicators.length > 0 && (
                <div className="flex justify-center">
                    <div className={clsx(
                        "relative flex flex-col items-center justify-center rounded-2xl px-16 py-10",
                        "bg-gradient-to-br", overallStyle.gradientFrom, overallStyle.gradientTo,
                        "shadow-2xl", overallStyle.glow, "ring-4", overallStyle.ringColor,
                        "transition-all duration-500 ease-in-out"
                    )}>
                        <div className="absolute top-4 right-4 flex items-center gap-2">
                            <span className="relative flex h-3 w-3">
                                <span className={clsx("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", overallStyle.pulseColor)} />
                                <span className={clsx("relative inline-flex rounded-full h-3 w-3", overallStyle.pulseColor)} />
                            </span>
                            <span className="text-white/70 text-xs font-medium uppercase tracking-wider">Live</span>
                        </div>
                        <OverallIcon className="w-16 h-16 text-white/90 mb-3" strokeWidth={2.5} />
                        <span className="text-6xl font-black text-white tracking-tight">{overallSignal}</span>
                        <span className="text-white/70 text-sm mt-2 font-medium">Overall Signal • {indexLabel}</span>
                    </div>
                </div>
            )}

            {/* Individual Indicator Cards - Vertical */}
            {indicators.length > 0 && (
                <div className="space-y-4">
                    <Typography variant="subtitle1" fontWeight="bold" className="dark:text-gray-200">Indicator Breakdown</Typography>

                    <div className="flex flex-col gap-5">
                        {indicators.map((ind) => {
                            const style = getSignalStyle(ind.signal);
                            const Icon = style.icon;

                            return (
                                <Paper key={ind.name} className={clsx(
                                    "p-0 overflow-hidden border",
                                    "bg-white dark:bg-gray-800",
                                    "shadow-md hover:shadow-lg transition-shadow duration-200",
                                    ind.signal === "BUY" && "border-emerald-300 dark:border-emerald-700",
                                    ind.signal === "SELL" && "border-rose-300 dark:border-rose-700",
                                    ind.signal === "NEUTRAL" && "border-amber-300 dark:border-amber-700"
                                )}>
                                    {/* Card Header */}
                                    <div className={clsx(
                                        "flex items-center justify-between px-5 py-4 bg-gradient-to-r",
                                        ind.signal === "BUY" && "from-emerald-50 to-green-50 dark:from-emerald-900/30 dark:to-green-900/20",
                                        ind.signal === "SELL" && "from-rose-50 to-red-50 dark:from-rose-900/30 dark:to-red-900/20",
                                        ind.signal === "NEUTRAL" && "from-amber-50 to-yellow-50 dark:from-amber-900/30 dark:to-yellow-900/20"
                                    )}>
                                        <div className="flex items-center gap-3">
                                            <div className={clsx(
                                                "w-10 h-10 rounded-lg flex items-center justify-center",
                                                "bg-gradient-to-br", style.gradientFrom, style.gradientTo, "shadow-sm"
                                            )}>
                                                <Icon className="w-5 h-5 text-white" />
                                            </div>
                                            <div>
                                                <Typography variant="h6" className="font-bold dark:text-gray-100 leading-tight">{ind.name}</Typography>
                                                <Typography variant="caption" className="text-gray-500 dark:text-gray-400">
                                                    Value: {typeof ind.value === "number" ? ind.value.toFixed(2) : ind.value}
                                                </Typography>
                                            </div>
                                        </div>
                                        <div className={clsx(
                                            "flex items-center gap-2 px-5 py-2 rounded-full text-base font-extrabold",
                                            "bg-gradient-to-r", style.gradientFrom, style.gradientTo, "text-white shadow-md"
                                        )}>
                                            <Icon className="w-5 h-5" />
                                            {ind.signal}
                                        </div>
                                    </div>

                                    {/* Card Body */}
                                    <div className="px-5 py-4 space-y-4">
                                        {/* Description */}
                                        <div className="flex items-start gap-2">
                                            <div className={clsx(
                                                "mt-1 w-1 h-full min-h-[20px] rounded-full flex-shrink-0",
                                                ind.signal === "BUY" && "bg-emerald-400",
                                                ind.signal === "SELL" && "bg-rose-400",
                                                ind.signal === "NEUTRAL" && "bg-amber-400"
                                            )} />
                                            <Typography variant="body2" className="text-gray-600 dark:text-gray-300 leading-relaxed">{ind.description}</Typography>
                                        </div>

                                        {/* Extra Stats — skip for custom layouts (ATM Technical Signals, Box Formation) */}
                                        {ind.name !== "ATM Technical Signals" && ind.name !== "Box Formation" && ind.extras && Object.keys(ind.extras).length > 0 && (
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                {Object.entries(ind.extras).map(([key, val]) => (
                                                    <div key={key} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2 text-center">
                                                        <Typography variant="caption" className="text-gray-500 dark:text-gray-400 block">{key}</Typography>
                                                        <Typography variant="body2" className="font-bold text-gray-800 dark:text-gray-200">{val}</Typography>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* ATM Technical Signals — custom CE/PE layout */}
                                        {ind.name === "ATM Technical Signals" && (techData.ce || techData.pe) && (() => {
                                            const signalColor = (sig: IndicatorSignal) =>
                                                sig === "BUY" ? "text-emerald-500" : (sig === "SELL" ? "text-rose-500" : "text-amber-500");
                                            const signalBg = (sig: IndicatorSignal) =>
                                                sig === "BUY" ? "bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700"
                                                    : (sig === "SELL" ? "bg-rose-100 dark:bg-rose-900/40 border-rose-300 dark:border-rose-700"
                                                        : "bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-amber-700");
                                            const emoji = (sig: IndicatorSignal) => sig === "BUY" ? "🟢" : (sig === "SELL" ? "🔴" : "🟡");

                                            const renderOptionColumn = (opt: OptionTechnicals | null, type: string, headerColor: string) => {
                                                if (!opt) return (
                                                    <div className="flex-1 text-center text-gray-400 py-8">
                                                        <Typography variant="body2">No {type} data</Typography>
                                                    </div>
                                                );
                                                return (
                                                    <div className="flex-1 space-y-3">
                                                        {/* Column Header */}
                                                        <div className={`text-center py-2 rounded-lg ${headerColor}`}>
                                                            <Typography variant="subtitle2" className="font-bold">
                                                                {type} — Strike {opt.strike}
                                                            </Typography>
                                                            <Typography variant="caption" className={signalColor(opt.overall)}>
                                                                Overall: {opt.overall} {emoji(opt.overall)}
                                                            </Typography>
                                                        </div>

                                                        {/* 5min Card */}
                                                        <div className={`border rounded-lg p-3 ${signalBg(opt.signal5)}`}>
                                                            <div className="flex items-center justify-between mb-2">
                                                                <Typography variant="caption" className="font-bold text-gray-700 dark:text-gray-200">
                                                                    ⏱ 5 Min
                                                                </Typography>
                                                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${signalColor(opt.signal5)} ${signalBg(opt.signal5)}`}>
                                                                    {opt.signal5} {emoji(opt.signal5)}
                                                                </span>
                                                            </div>
                                                            <div className="space-y-1.5">
                                                                {opt.tf5.map(s => (
                                                                    <div key={s.indicator} className="flex items-center justify-between text-xs">
                                                                        <span className="text-gray-600 dark:text-gray-300 font-medium">{s.indicator}</span>
                                                                        <div className="flex items-center gap-1">
                                                                            <span className="text-gray-500 dark:text-gray-400 text-[11px]">{s.value}</span>
                                                                            <span className={signalColor(s.signal)}>{emoji(s.signal)}</span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* 15min Card */}
                                                        <div className={`border rounded-lg p-3 ${signalBg(opt.signal15)}`}>
                                                            <div className="flex items-center justify-between mb-2">
                                                                <Typography variant="caption" className="font-bold text-gray-700 dark:text-gray-200">
                                                                    ⏱ 15 Min
                                                                </Typography>
                                                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${signalColor(opt.signal15)} ${signalBg(opt.signal15)}`}>
                                                                    {opt.signal15} {emoji(opt.signal15)}
                                                                </span>
                                                            </div>
                                                            <div className="space-y-1.5">
                                                                {opt.tf15.map(s => (
                                                                    <div key={s.indicator} className="flex items-center justify-between text-xs">
                                                                        <span className="text-gray-600 dark:text-gray-300 font-medium">{s.indicator}</span>
                                                                        <div className="flex items-center gap-1">
                                                                            <span className="text-gray-500 dark:text-gray-400 text-[11px]">{s.value}</span>
                                                                            <span className={signalColor(s.signal)}>{emoji(s.signal)}</span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            };

                                            return (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {renderOptionColumn(techData.ce, "CE (Call)", "bg-blue-50 dark:bg-blue-900/20")}
                                                    {renderOptionColumn(techData.pe, "PE (Put)", "bg-purple-50 dark:bg-purple-900/20")}
                                                </div>
                                            );
                                        })()}

                                        {/* Box Formation — custom CE/PE layout */}
                                        {ind.name === "Box Formation" && (boxData.ce || boxData.pe) && (() => {
                                            const statusColor = (detected: boolean, breakout: string) => {
                                                if (breakout === "up") return "text-emerald-500";
                                                if (breakout === "down") return "text-rose-500";
                                                return detected ? "text-blue-500" : "text-gray-500";
                                            };
                                            const statusBg = (detected: boolean, breakout: string) => {
                                                if (breakout === "up") return "bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700";
                                                if (breakout === "down") return "bg-rose-100 dark:bg-rose-900/40 border-rose-300 dark:border-rose-700";
                                                return detected ? "bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700" : "bg-gray-100 dark:bg-gray-800/40 border-gray-300 dark:border-gray-700";
                                            };

                                            const renderBoxColumn = (box: BoxResult | null, type: string, headerColor: string) => {
                                                if (!box) return (
                                                    <div className="flex-1 text-center text-gray-400 py-8">
                                                        <Typography variant="body2">No {type} data</Typography>
                                                    </div>
                                                );

                                                return (
                                                    <div className="flex-1 space-y-3">
                                                        {/* Column Header */}
                                                        <div className={`text-center py-2 rounded-lg ${headerColor}`}>
                                                            <Typography variant="subtitle2" className="font-bold">
                                                                {type} {box.detected ? "Box detected" : "No box"}
                                                            </Typography>
                                                            {box.breakout !== "none" && (
                                                                <Typography variant="caption" className={statusColor(box.detected, box.breakout)}>
                                                                    {box.breakout === "up" ? "🚀 Upside Breakout!" : "📉 Downside Breakdown!"}
                                                                </Typography>
                                                            )}
                                                        </div>

                                                        <div className={`border rounded-lg p-3 ${statusBg(box.detected, box.breakout)}`}>
                                                            <div className="space-y-1.5">
                                                                <div className="flex justify-between text-xs">
                                                                    <span className="text-gray-600 dark:text-gray-300">Support / Resistance</span>
                                                                    <span className="font-bold">{box.boxLow.toFixed(1)} – {box.boxHigh.toFixed(1)}</span>
                                                                </div>
                                                                <div className="flex justify-between text-xs">
                                                                    <span className="text-gray-600 dark:text-gray-300">Formation Start</span>
                                                                    <span className="font-bold">{box.firstSupportTime || "N/A"}</span>
                                                                </div>
                                                                <div className="flex justify-between text-xs">
                                                                    <span className="text-gray-600 dark:text-gray-300">Width / Containment</span>
                                                                    <span className="font-bold">{box.rangeWidth.toFixed(1)}% / {box.containment.toFixed(0)}%</span>
                                                                </div>
                                                                <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                                                                    <Typography variant="caption" className="block text-[10px] text-gray-500 uppercase font-bold mb-1">Live Position</Typography>
                                                                    <div className="flex justify-between items-center bg-white/50 dark:bg-black/20 p-2 rounded">
                                                                        <span className="text-xs font-bold">{box.ltp.toFixed(1)}</span>
                                                                        <span className={`text-[10px] uppercase font-black ${statusColor(box.detected, box.breakout)}`}>
                                                                            {box.positionInBox}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            };

                                            return (
                                                <div className="space-y-4">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {renderBoxColumn(boxData.ce, "CE (Call)", "bg-blue-50 dark:bg-blue-900/20")}
                                                        {renderBoxColumn(boxData.pe, "PE (Put)", "bg-purple-50 dark:bg-purple-900/20")}
                                                    </div>
                                                    {ind.extras?.["Action"] && (
                                                        <div className="bg-gray-100 dark:bg-gray-900/60 p-3 rounded-lg border border-dashed border-gray-400 dark:border-gray-600">
                                                            <Typography variant="subtitle2" className="text-center font-black uppercase tracking-widest text-gray-800 dark:text-gray-200">
                                                                🎯 RECOMMENDED ACTION: {ind.extras["Action"]}
                                                            </Typography>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}

                                        {/* Day's Low Recovery — custom CE/PE layout */}
                                        {ind.name === "Day's Low Recovery" && recoveryData.length > 0 && (
                                            <div className="overflow-x-auto border rounded-xl dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/40 p-4">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    {['CE (Calls)', 'PE (Puts)'].map((title, idx) => {
                                                        const items = recoveryData.filter(i => i.type === (idx === 0 ? 'CE' : 'PE'));
                                                        return (
                                                            <div key={title} className="space-y-4">
                                                                <Typography variant="subtitle2" className="flex items-center gap-2 font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">
                                                                    {idx === 0 ? "🔵" : "🟣"} {title}
                                                                </Typography>
                                                                <div className="grid gap-3">
                                                                    {items.map(item => {
                                                                        const sigStyle = getSignalStyle(item.signal);
                                                                        // Safely extract values with defaults to prevent toFixed errors
                                                                        const lowVal = item.low ?? 0;
                                                                        const highVal = item.high ?? 0;
                                                                        const ltpVal = item.ltp ?? 0;
                                                                        const recoveryVal = item.recoveryPct ?? 0;

                                                                        const range = highVal - lowVal;
                                                                        const progressPct = range > 0 ? Math.min(Math.max(((ltpVal - lowVal) / range) * 100, 0), 100) : 0;

                                                                        return (
                                                                            <div key={`${item.type}-${item.strike}`} className="bg-white dark:bg-gray-800 rounded-xl p-3 border dark:border-gray-700 shadow-sm relative overflow-hidden group">
                                                                                {item.signal === "BUY" && (
                                                                                    <div className="absolute top-0 right-0 w-16 h-16 -mr-8 -mt-8 bg-emerald-500/10 rounded-full blur-xl group-hover:bg-emerald-500/20 transition-colors" />
                                                                                )}
                                                                                <div className="flex justify-between items-center mb-2">
                                                                                    <span className="text-sm font-black text-gray-800 dark:text-gray-100">{item.strike}</span>
                                                                                    <span className={clsx("text-[10px] font-black px-2 py-0.5 rounded-full uppercase", sigStyle.bg, sigStyle.text)}>
                                                                                        {item.signal}
                                                                                    </span>
                                                                                </div>
                                                                                <div className="grid grid-cols-1 gap-2 text-[11px]">
                                                                                    <div className="flex justify-between bg-gray-50 dark:bg-gray-900/60 p-1.5 rounded">
                                                                                        <span className="text-gray-500">LTP / Low</span>
                                                                                        <span className="font-bold">{ltpVal.toFixed(1)} / {lowVal.toFixed(1)}</span>
                                                                                    </div>

                                                                                    {/* Price Progress Bar */}
                                                                                    <div className="space-y-1">
                                                                                        <div className="flex justify-between text-[9px] uppercase font-bold text-gray-400">
                                                                                            <span>Low</span>
                                                                                            <span>High</span>
                                                                                        </div>
                                                                                        <div className="relative h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                                                                            {/* 50% Marker */}
                                                                                            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-400 dark:bg-gray-500 z-10 opacity-50" />
                                                                                            <div
                                                                                                className={clsx(
                                                                                                    "absolute h-full transition-all duration-500",
                                                                                                    recoveryVal >= 100 ? "bg-emerald-500" : (recoveryVal >= 50 ? "bg-amber-400" : "bg-blue-400")
                                                                                                )}
                                                                                                style={{ width: `${progressPct}%` }}
                                                                                            />
                                                                                        </div>
                                                                                        <div className="flex justify-between text-[9px] text-gray-500">
                                                                                            <span>{lowVal.toFixed(1)}</span>
                                                                                            <span className="font-black text-gray-800 dark:text-gray-200">LTP: {ltpVal.toFixed(1)} ({progressPct.toFixed(0)}%)</span>
                                                                                            <span>{highVal.toFixed(1)}</span>
                                                                                        </div>
                                                                                    </div>

                                                                                    <div className="flex justify-between bg-gray-50 dark:bg-gray-900/60 p-1.5 rounded">
                                                                                        <span className="text-gray-500">Recovery</span>
                                                                                        <span className={clsx("font-black", recoveryVal >= 50 ? "text-emerald-500" : "text-gray-700 dark:text-gray-300")}>
                                                                                            {recoveryVal.toFixed(1)}%
                                                                                        </span>
                                                                                    </div>
                                                                                </div>
                                                                                {item.action !== "-" && (
                                                                                    <div className="mt-2 pt-2 border-t dark:border-gray-700 flex justify-between items-center">
                                                                                        <span className={clsx(
                                                                                            "text-[10px] uppercase font-black text-center w-full py-1 rounded",
                                                                                            item.action === "SELL OPTION" ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400" : "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400"
                                                                                        )}>
                                                                                            {item.action === "SELL OPTION" ? "🚀 TARGET HIT / SELL OPTION" : "⚠️ CHANCE OF REVERSAL"}
                                                                                        </span>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* PCR gauge bar */}
                                        {ind.name.includes("PCR") && typeof ind.value === "number" && (
                                            <div>
                                                <div className="flex justify-between text-xs text-gray-400 mb-1">
                                                    <span className="text-emerald-500 font-medium">BUY (&lt;0.7)</span>
                                                    <span className="text-amber-500 font-medium">NEUTRAL</span>
                                                    <span className="text-rose-500 font-medium">SELL (&gt;1.3)</span>
                                                </div>
                                                <div className="relative h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                    <div className="absolute inset-0 flex">
                                                        <div className="w-[35%] bg-gradient-to-r from-emerald-500 to-emerald-400" />
                                                        <div className="w-[30%] bg-gradient-to-r from-amber-400 to-amber-500" />
                                                        <div className="w-[35%] bg-gradient-to-r from-rose-400 to-rose-500" />
                                                    </div>
                                                    <div
                                                        className="absolute top-0 h-full w-1.5 bg-white border border-gray-800 rounded shadow-lg transition-all duration-500"
                                                        style={{ left: `${Math.min(Math.max((ind.value / 2) * 100, 2), 98)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {/* OI Dominance bar */}
                                        {ind.name === "ITM OI Dominance" && ind.extras && (
                                            <div>
                                                <div className="flex justify-between text-xs mb-1">
                                                    <span className="text-rose-500 font-medium">Call OI (Bearish)</span>
                                                    <span className="text-emerald-500 font-medium">Put OI (Bullish)</span>
                                                </div>
                                                <div className="relative h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                    {(() => {
                                                        const callOi = Number(String(ind.extras!["ITM Call OI (5)"]).replace(/,/g, '')) || 0;
                                                        const putOi = Number(String(ind.extras!["ITM Put OI (5)"]).replace(/,/g, '')) || 0;
                                                        const total = callOi + putOi;
                                                        const callPct = total > 0 ? (callOi / total) * 100 : 50;
                                                        return (
                                                            <>
                                                                <div className="absolute inset-0 flex">
                                                                    <div className="bg-gradient-to-r from-rose-500 to-rose-400" style={{ width: `${callPct}%` }} />
                                                                    <div className="bg-gradient-to-r from-emerald-400 to-emerald-500" style={{ width: `${100 - callPct}%` }} />
                                                                </div>
                                                                <div className="absolute top-0 h-full w-0.5 bg-white/80" style={{ left: '50%' }} />
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </Paper>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* OI Summary */}
            {indicators.length > 0 && (
                <div className="grid grid-cols-2 gap-4">
                    <Paper className="p-4 bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800 text-center">
                        <Typography variant="caption" className="text-green-800 dark:text-green-300 font-medium">Total Call OI</Typography>
                        <Typography variant="h6" className="font-bold text-green-700 dark:text-green-200">{totals.ce.toLocaleString('en-IN')}</Typography>
                    </Paper>
                    <Paper className="p-4 bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800 text-center">
                        <Typography variant="caption" className="text-red-800 dark:text-red-300 font-medium">Total Put OI</Typography>
                        <Typography variant="h6" className="font-bold text-red-700 dark:text-red-200">{totals.pe.toLocaleString('en-IN')}</Typography>
                    </Paper>
                </div>
            )}

            {/* Empty state */}
            {indicators.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500">
                    <RefreshCw className="w-12 h-12 mb-4 opacity-30" />
                    <Typography variant="h6">Select an index and click Fetch</Typography>
                    <Typography variant="body2">to generate BUY / SELL indicators</Typography>
                </div>
            )}
        </div>
    );
}
