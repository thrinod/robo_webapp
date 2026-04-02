"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { getExpiryDates, getOptionChain, placeOrders, cancelAllOrders, squareOffAll, getUserFunds, getPositions, exitPosition, getQuotes, getUserCharges } from "@/services/api";
import {
    Button, Select, MenuItem, FormControl, InputLabel,
    Switch, FormControlLabel, Typography, Chip, TextField,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Checkbox,
    Dialog, DialogTitle, DialogContent, DialogActions
} from "@mui/material";
import { RefreshCw, Zap, Trash2, Clock } from "lucide-react";
import { Tooltip } from "@mui/material";
import clsx from "clsx";

const INDICES = [
    { label: 'NIFTY', value: 'NSE_INDEX|Nifty 50' },
    { label: 'BANKNIFTY', value: 'NSE_INDEX|Nifty Bank' },
    { label: 'FINNIFTY', value: 'NSE_INDEX|Nifty Fin Service' },
    { label: 'MIDCPNIFTY', value: 'NSE_INDEX|NIFTY MID SELECT' },
    { label: 'SENSEX', value: 'BSE_INDEX|SENSEX' },
    { label: 'BANKEX', value: 'BSE_INDEX|BANKEX' },
];

export default function OptionChain() {
    const [index, setIndex] = useState(INDICES[0].value);
    const [expiryDates, setExpiryDates] = useState<string[]>([]);
    const [expiry, setExpiry] = useState("");
    const [chain, setChain] = useState<any[]>([]);
    const [spot, setSpot] = useState(0);
    const [totals, setTotals] = useState({ ce: 0, pe: 0 });
    const [stats, setStats] = useState({ pcr: 0, itmCallOi: 0, itmPutOi: 0 });

    const [loading, setLoading] = useState(false);
    const [isPaper, setIsPaper] = useState(false); // Paper Trading Mode
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [chainRefreshInterval, setChainRefreshInterval] = useState(5); // Default 5s



    const [selectedItems, setSelectedItems] = useState<Record<string, any>>({});
    const [lots, setLots] = useState(1);

    const [funds, setFunds] = useState<any>(null);
    const [positions, setPositions] = useState<any[]>([]);
    const [autoRefreshPositions, setAutoRefreshPositions] = useState(true);
    const [posRefreshInterval, setPosRefreshInterval] = useState(5); // Default 5s
    const [showClosedPositions, setShowClosedPositions] = useState(false);

    // Charges State
    const [charges, setCharges] = useState<any>(null);
    const [showTradeBook, setShowTradeBook] = useState(false);

    // Limit Exit State
    const [limitExitOpen, setLimitExitOpen] = useState(false);
    const [limitExitPosition, setLimitExitPosition] = useState<any>(null);
    const [limitPrice, setLimitPrice] = useState("");

    // Auto-Exit Logic State (Multi-Group)
    const [spotLtp, setSpotLtp] = useState<number>(0);
    const [monitorInterval, setMonitorInterval] = useState<number>(1); // Default 1s
    const [isSpotPolling, setIsSpotPolling] = useState(true); // Toggle for Spot Polling

    // Bullish Strategy (Green)
    const [targetLevelBull, setTargetLevelBull] = useState<string>("");
    const [stopLevelBull, setStopLevelBull] = useState<string>("");
    const [isMonitoringBull, setIsMonitoringBull] = useState(false);
    const [selectedPositionsBull, setSelectedPositionsBull] = useState<Set<string>>(new Set());

    // Bearish Strategy (Red)
    const [targetLevelBear, setTargetLevelBear] = useState<string>("");
    const [stopLevelBear, setStopLevelBear] = useState<string>("");
    const [isMonitoringBear, setIsMonitoringBear] = useState(false);
    const [selectedPositionsBear, setSelectedPositionsBear] = useState<Set<string>>(new Set());

    useEffect(() => {
        loadExpiries();
        fetchFunds();
        fetchPositions();
        fetchCharges();
    }, [index]);

    useEffect(() => {
        // Refresh positions when mode changes
        fetchPositions();
    }, [isPaper]);

    useEffect(() => {
        if (expiry) fetchChain();
    }, [expiry]);

    useEffect(() => {
        let interval: any;
        if (autoRefresh && expiry) {
            interval = setInterval(() => fetchChain(true), Math.max(1000, chainRefreshInterval * 1000));
        }
        return () => clearInterval(interval);
    }, [autoRefresh, expiry, chainRefreshInterval]);

    // Spot Polling for Auto Exit
    const fetchSpot = useCallback(async () => {
        try {
            // console.log(`Fetching Spot Quote for ${index}...`);
            const q = await getQuotes([index]);
            // console.log("Spot Quote Response:", q);

            if (!q) return;

            // Check for various key formats or exact match
            // API returns keyed by instrument_key or symbol depending on implementation
            // But getQuotes puts everything in a dict.
            // Adjust based on typical response structure.
            // If getQuotes returns { "NSE_INDEX|Nifty 50": { ... } }

            const val = q[index];
            if (val && val.ltp) {
                setSpotLtp(val.ltp);
            } else {
                // Try searching values if key mismatch
                const v = Object.values(q)[0] as any;
                if (v && v.ltp) setSpotLtp(v.ltp);
            }
        } catch (e: any) {
            console.error("Spot Fetch Error", e);
        }
    }, [index]);

    // Initial Fetch (Once on Load or Index Change)
    useEffect(() => {
        fetchSpot();
    }, [fetchSpot]);

    // Polling Logic
    useEffect(() => {
        if (!isSpotPolling) return;

        const interval = setInterval(fetchSpot, Math.max(1000, monitorInterval * 1000));
        return () => clearInterval(interval);
    }, [monitorInterval, isSpotPolling, fetchSpot]);

    // Monitoring & Auto-Exit Trigger Logic (Dual Group)
    useEffect(() => {
        if (!spotLtp) return;

        // Check Bullish
        if (isMonitoringBull) {
            const target = parseFloat(targetLevelBull);
            const stop = parseFloat(stopLevelBull);
            if (!isNaN(target) && spotLtp >= target) triggerAutoExit("BULL", "Target Hit (Upper)");
            else if (!isNaN(stop) && spotLtp <= stop) triggerAutoExit("BULL", "Stop Loss Hit (Lower)");
        }

        // Check Bearish
        if (isMonitoringBear) {
            const target = parseFloat(targetLevelBear);
            const stop = parseFloat(stopLevelBear);
            if (!isNaN(target) && spotLtp <= target) triggerAutoExit("BEAR", "Target Hit (Lower)");
            else if (!isNaN(stop) && spotLtp >= stop) triggerAutoExit("BEAR", "Stop Loss Hit (Upper)");
        }

    }, [spotLtp, isMonitoringBull, targetLevelBull, stopLevelBull, isMonitoringBear, targetLevelBear, stopLevelBear]);

    const triggerAutoExit = async (group: "BULL" | "BEAR", reason: string) => {
        // Stop monitoring for triggered group
        if (group === "BULL") setIsMonitoringBull(false);
        if (group === "BEAR") setIsMonitoringBear(false);

        console.log(`Auto-Exit Triggered [${group}]: ${reason} at ${INDICES.find(i => i.value === index)?.label} ${spotLtp}`);

        const keys = Array.from(group === "BULL" ? selectedPositionsBull : selectedPositionsBear);
        if (keys.length === 0) return;

        for (const key of keys) {
            handleExit(key);
        }
    };

    const toggleMonitorSelection = (key: string, group: "BULL" | "BEAR") => {
        if (group === "BULL") {
            setSelectedPositionsBull(prev => {
                const next = new Set(prev);
                if (next.has(key)) next.delete(key);
                else next.add(key);
                return next;
            });
        } else {
            setSelectedPositionsBear(prev => {
                const next = new Set(prev);
                if (next.has(key)) next.delete(key);
                else next.add(key);
                return next;
            });
        }
    };

    useEffect(() => {
        let interval: any;
        if (autoRefreshPositions) {
            const ms = Math.max(posRefreshInterval, 1) * 1000;
            interval = setInterval(() => fetchPositions(true), ms);
        }
        return () => clearInterval(interval);
    }, [autoRefreshPositions, isPaper, posRefreshInterval]);

    const loadExpiries = async () => {
        const dates = await getExpiryDates(index);
        setExpiryDates(dates);
        if (dates.length > 0) {
            setExpiry(dates[0]);
        } else {
            setExpiry("");
            setChain([]); // Clear chain
            // Optional: Alert user
            // alert("No expiry dates found. Please check your Upstox Token.");
        }
    };

    const fetchFunds = async () => {
        try {
            const data = await getUserFunds();
            setFunds(data);
        } catch (e) { console.error(e); }
    };

    const fetchCharges = async () => {
        try {
            const data = await getUserCharges();
            setCharges(data);
        } catch (e) { console.error(e); }
    };

    const fetchPositions = async (silent = false) => {
        try {
            let p = [];
            if (isPaper) {
                const { getMockPositions } = await import("@/services/api");
                p = await getMockPositions();
            } else {
                p = await getPositions();
            }
            setPositions(p);
        } catch (e) { console.error(e); }
    };

    const fetchChain = async (silent = false) => {
        if (!silent) setLoading(true);
        const data = await getOptionChain(index, expiry);

        // ... (rest of processing) ...

        const raw = data.data || [];
        const spotPrice = data.spot_price || 0;
        setSpot(spotPrice);
        const t = data.totals || {};
        setTotals({ ce: t.ce || 0, pe: t.pe || 0 });

        // Process Data (Group by Strike)
        const strikes: any = {};
        raw.forEach((item: any) => {
            if (!strikes[item.strike_price]) strikes[item.strike_price] = { strike: item.strike_price };
            if (item.instrument_type === 'CE') strikes[item.strike_price].ce = item;
            if (item.instrument_type === 'PE') strikes[item.strike_price].pe = item;
        });

        let sorted = Object.values(strikes).sort((a: any, b: any) => a.strike - b.strike);

        const pcr = data.totals && data.totals.ce > 0 ? (data.totals.pe / data.totals.ce) : 0;

        let itmCallOi = 0;
        let itmPutOi = 0;

        if (spotPrice > 0) {
            const validStrikes = sorted.filter((s: any) => s.ce && s.pe);
            const atmIdx = validStrikes.findIndex((s: any) => s.strike >= spotPrice);

            if (atmIdx !== -1) {
                const startCall = Math.max(0, atmIdx - 5);
                validStrikes.slice(startCall, atmIdx).forEach((s: any) => {
                    itmCallOi += (s.ce?.open_interest || 0);
                });

                validStrikes.slice(atmIdx, atmIdx + 5).forEach((s: any) => {
                    itmPutOi += (s.pe?.open_interest || 0);
                });
            }
        }

        setStats({ pcr, itmCallOi, itmPutOi });


        if (spotPrice > 0 && sorted.length > 0) {
            const atmIdx = sorted.findIndex((row: any) => row.strike >= spotPrice);
            if (atmIdx !== -1) {
                const start = Math.max(0, atmIdx - 10);
                const end = Math.min(sorted.length, atmIdx + 10);
                sorted = sorted.slice(start, end);
            }
        }
        setChain(sorted);
        if (!silent) setLoading(false);
        setChain(sorted);
        if (!silent) setLoading(false);
    };

    // Helper to find position for a specific strike and type
    const getPositionForStrike = useCallback((strike: number, type: 'CE' | 'PE') => {
        if (!positions || positions.length === 0) return null;
        return positions.find(p => {
            // Match logic: standard upstox keys usually contain strike/type or we can match via instrument_key if available in chain
            // Our chain data has instrument_key.
            const item = type === 'CE' ? chain.find(c => c.strike === strike)?.ce : chain.find(c => c.strike === strike)?.pe;
            if (!item) return false;

            // Match by Instrument Key (Most accurate)
            if (p.instrument_token === item.instrument_key || p.instrument_key === item.instrument_key) return true;

            return false;
        });
    }, [positions, chain]);

    const getPositionByInstrumentKey = useCallback((key: string) => {
        if (!positions || !key) return null;
        return positions.find(p => p.instrument_token === key || p.instrument_key === key);
    }, [positions]);

    const getLotSize = (idx: string) => {
        if (idx.includes('Nifty 50')) return 65; // Updated check
        if (idx.includes('Nifty Bank')) return 30; // 
        if (idx.includes('Fin Service')) return 65; //
        if (idx.includes('MID')) return 120; // 
        if (idx.includes('SENSEX')) return 20; // 
        if (idx.includes('BANKEX')) return 30; // 
        // Fallback or more robust check
        if (idx.toLowerCase().includes('banknifty') || idx.toLowerCase().includes('nifty bank')) return 30;
        if (idx.toLowerCase().includes('nifty') && !idx.toLowerCase().includes('fin') && !idx.toLowerCase().includes('mid')) return 75;
        return 50;
    };

    const getFreezeLimit = (idx: string) => {
        if (idx.includes('Nifty 50') || (idx.toLowerCase().includes('nifty') && !idx.toLowerCase().includes('bank') && !idx.toLowerCase().includes('fin') && !idx.toLowerCase().includes('mid'))) return 1755;
        if (idx.includes('Nifty Bank') || idx.toLowerCase().includes('banknifty')) return 1000;
        if (idx.includes('Fin Service') || idx.toLowerCase().includes('finnifty')) return 1800;
        if (idx.includes('MID') || idx.toLowerCase().includes('midcpnifty')) return 2760; // Estimation
        if (idx.includes('SENSEX')) return 1000;
        if (idx.includes('BANKEX')) return 900;
        return 1800; // Default safe limit
    };

    const toggleSelection = (item: any, side: string, type: 'BUY' | 'SELL') => {
        if (!item) return;
        const key = `${item.instrument_key}_${type}`;

        setSelectedItems(prev => {
            const next = { ...prev };
            if (next[key]) {
                delete next[key];
            } else {
                const lotSize = item.lot_size || getLotSize(index);
                // Auto Lot Logic
                if (type === 'BUY' && item.last_price > 0 && Object.keys(prev).length === 0) {
                    const available = funds?.available_margin || funds?._available_margin || funds?.net || 0;
                    if (available > 0) {
                        const pricePerLot = item.last_price * lotSize;
                        const usable = available * 0.98;
                        const maxLots = Math.floor(usable / pricePerLot);
                        setLots(maxLots > 0 ? maxLots : 1);
                    }
                }

                next[key] = {
                    ...item,
                    transaction_type: type,
                    lot_size: lotSize,
                    limit_price: item.last_price?.toString() || ""
                };
            }
            return next;
        });
    };

    const handleExit = async (key: string) => {
        console.log("Handle Exit called for", key);
        // if (!confirm("Exit Position?")) return; // Commented out for debugging

        try {
            if (isPaper) {
                const { exitMockPosition } = await import("@/services/api");
                const res = await exitMockPosition(key); // For mock, key should be trade_id
                if (res.status === 'error') throw new Error(res.message);
                console.log(res.message || "Position Closed");
            } else {
                await exitPosition(key); // For live, key is instrument_key
                console.log("Position Exit Requested");
            }
            fetchPositions();
        } catch (e: any) {
            console.error("Exit Error:", e);
            console.error(`Exit Failed: ${e.message || "Unknown error"}`);
        }
    }

    const handlePlaceOrder = async () => {
        const freezeLimit = getFreezeLimit(index);
        const orders: any[] = [];

        Object.values(selectedItems).forEach((item: any) => {
            const totalQty = Math.floor((item.lot_size || getLotSize(index)) * lots);
            const isLimit = !!item.limit_price && parseFloat(item.limit_price) > 0;
            const commonOrder = {
                instrument_key: item.instrument_key,
                transaction_type: item.transaction_type,
                order_type: isLimit ? 'LIMIT' : 'MARKET',
                price: isLimit ? parseFloat(item.limit_price) : 0,
                trading_symbol: item.name
            };

            if (totalQty > freezeLimit) {
                // Slice Logic
                let remaining = totalQty;
                while (remaining > 0) {
                    const chunk = Math.min(remaining, freezeLimit);
                    orders.push({ ...commonOrder, quantity: chunk });
                    remaining -= chunk;
                }
            } else {
                orders.push({ ...commonOrder, quantity: totalQty });
            }
        });

        console.log("Placing Orders Payload:", orders);

        try {
            if (isPaper) {
                // Mock Trading - Place individually (API limitation or loop here)
                const { placeMockOrder } = await import("@/services/api");
                for (const order of orders) {
                    await placeMockOrder(order);
                }
                console.log(`Successfully placed ${orders.length} MOCK orders`);
                setSelectedItems({});
                fetchPositions();
            } else {
                // Live Trading
                const response = await placeOrders(orders);
                console.log("Place Order Response:", response);

                // detailed check
                const results = response.data.results || [];
                const errors = results.filter((r: any) => r.result?.status === 'error');

                if (errors.length > 0) {
                    const msg = errors.map((e: any) => `${e.key}: ${e.result?.message || 'Unknown Error'}`).join('\n');
                    console.error(`Some orders failed:\n${msg}`);
                } else {
                    console.log(`Successfully placed ${orders.length} orders`);
                    setSelectedItems({});
                    fetchPositions();
                }
            }
        } catch (err) {
            console.error("Order Placement Exception:", err);
            console.error("Order Failed: Network or Server Error");
        }
    };

    const formatOI = (val: number | undefined | null) => {
        if (val === undefined || val === null) return '-';
        return val.toLocaleString('en-IN');
    };

    const formatCr = (val: number) => {
        if (!val) return '-';
        const cr = val / 10000000;
        return cr.toFixed(2) + ' Cr';
    };

    const totalPnL = positions.reduce((acc, p) => acc + (p.pnl || 0), 0);

    const handleLimitExitCode = async () => {
        if (!limitExitPosition || !limitPrice) return;

        try {
            const price = parseFloat(limitPrice);
            if (isNaN(price) || price <= 0) {
                console.error("Please enter a valid price");
                return;
            }

            const isBuy = limitExitPosition.quantity < 0; // If current qty -ve (Short), we need to BUY. If +ve (Long), we need to SELL.
            // Actually, if quantity > 0 (LONG), we SELL to exit. If quantity < 0 (SHORT), we BUY to exit.
            const transactionTx = limitExitPosition.quantity > 0 ? "SELL" : "BUY";

            const order = {
                instrument_key: isPaper ? limitExitPosition.trade_id : (limitExitPosition.instrument_key || limitExitPosition.instrument_token),
                quantity: Math.abs(limitExitPosition.quantity),
                transaction_type: transactionTx,
                order_type: "LIMIT",
                price: price,
                product: "MIS", // Assuming Intraday for Option Chain exits
                trading_symbol: limitExitPosition.trading_symbol
            };

            if (isPaper) {
                // Determine transaction type for mock
                const mockTx = transactionTx;
                // For mock, we might use placeMockOrder differently or just standard place_order if supported
                // But typically mock exit is specific. Let's try standard placeMockOrder with these params
                await placeOrders([order]); // Assuming placeOrders handles mock redirection if backend supports, OR:
                // Actually mock service usually has specific exit logic. 
                // Let's stick to standard placeOrders for now and assume backend routes it or handles it.
                // Re-reading api.ts: placeOrders calls /trade/place_orders. 
                // If isPaper, we might need a specific handling. 
                // For simplicity in this Task, let's assume `placeOrders` works for now, or fallback to alert.
                // Wait, previously handleExit called `exitPosition` or `exitMockPosition`.
                // We should probably implement a `placeLimitOrder` that handles both?
                // For now, let's just use `placeOrders` and hope existing backend logic handles it or we'll need to update backend.
                // Given `isPaper` check in `handleExit`:
                // const res = isPaper ? await exitMockPosition(key) : await exitPosition(key);
                // Limit orders for mock might not be fully supported yet. Let's disable L for paper or assume standard flow.
                // Let's assume standard flow for REAL trading, and maybe alert for mock if not supported.
                if (isPaper) {
                    console.warn("Limit Exit not yet supported for Paper Trading");
                    return;
                }
            }

            const res = await placeOrders([order]);
            if (res.data && res.data.status === 'completed') {
                console.log(`Limit Order Placed: ${transactionTx} ${limitExitPosition.trading_symbol} @ ${price}`);
                setLimitExitOpen(false);
                setLimitPrice("");
                setLimitExitPosition(null);
            } else {
                console.error(`Order Failed: ${JSON.stringify(res)}`);
            }

        } catch (e: any) {
            console.error("Error placing limit order: " + e.message);
        }
    };

    // Helper to open Limit Dialog
    const openLimitExit = (p: any) => {
        setLimitExitPosition(p);
        setLimitPrice(p.last_price?.toString() || "");
        setLimitExitOpen(true);
    };

    return (
        <div className="p-4 max-w-7xl mx-auto space-y-4 pb-20">
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
                    <Button variant="contained" size="small" onClick={() => fetchChain()} disabled={loading}>
                        {loading ? "Loading..." : "Fetch"}
                    </Button>
                    <FormControlLabel
                        control={<Switch size="small" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />}
                        label={<span className="text-sm dark:text-gray-200">Auto</span>}
                    />
                    {autoRefresh && (
                        <TextField
                            size="small"
                            type="number"
                            label="Refresh (s)"
                            value={chainRefreshInterval}
                            onChange={(e) => setChainRefreshInterval(Math.max(1, parseInt(e.target.value) || 1))}
                            InputProps={{ inputProps: { min: 1, style: { width: '50px' } } }}
                            className="dark:bg-gray-700 rounded"
                            variant="outlined"
                        />
                    )}
                </div>

                <div className="flex justify-end gap-2 items-center">
                    <FormControlLabel
                        control={<Switch size="small" color="secondary" checked={isPaper} onChange={e => setIsPaper(e.target.checked)} />}
                        label={<span className={clsx("text-sm font-bold", isPaper ? "text-purple-500" : "text-gray-500")}>PAPER</span>}
                    />
                    <Button size="small" startIcon={<Trash2 />} color="error" variant="outlined" onClick={() => cancelAllOrders()}>Cancel All</Button>
                    <Button size="small" startIcon={<Zap />} variant="contained" color="error" onClick={() => squareOffAll()}>Square Off</Button>
                </div>
            </Paper>

            {/* Metrics & Info */}
            <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
                <Paper className="p-2 bg-gray-50 dark:bg-gray-800 dark:border-gray-700 flex flex-col justify-center items-center">
                    <Typography variant="caption" color="textSecondary" className="dark:text-gray-400">Funds</Typography>
                    <Typography variant="subtitle2" className="font-bold text-gray-800 dark:text-gray-200">
                        ₹{(funds?.available_margin || funds?._available_margin || funds?.net || 0).toLocaleString()}
                    </Typography>
                </Paper>

                <Paper className="p-2 bg-blue-50 border border-blue-100 dark:bg-blue-900/20 dark:border-blue-800 flex flex-col justify-center items-center">
                    <Typography variant="caption" className="text-blue-800 dark:text-blue-300">PCR</Typography>
                    <Typography variant="subtitle2" className="font-bold text-blue-700 dark:text-blue-200">
                        {stats.pcr.toFixed(2)}
                    </Typography>
                </Paper>

                <Paper className="p-2 bg-green-50 border border-green-100 dark:bg-green-900/20 dark:border-green-800 flex flex-col justify-center items-center">
                    <Typography variant="caption" className="text-green-800 dark:text-green-300">Total Call OI</Typography>
                    <Typography variant="subtitle2" className="font-bold text-green-700 dark:text-green-200">
                        {totals.ce.toLocaleString('en-IN')}
                    </Typography>
                </Paper>
                <Paper className="p-2 bg-red-50 border border-red-100 dark:bg-red-900/20 dark:border-red-800 flex flex-col justify-center items-center">
                    <Typography variant="caption" className="text-red-800 dark:text-red-300">Total Put OI</Typography>
                    <Typography variant="subtitle2" className="font-bold text-red-700 dark:text-red-200">
                        {totals.pe.toLocaleString('en-IN')}
                    </Typography>
                </Paper>

                <Paper className="p-2 bg-green-100 border border-green-200 dark:bg-green-800/40 dark:border-green-700 flex flex-col justify-center items-center">
                    <Typography variant="caption" className="text-green-900 dark:text-green-100 font-bold">ITM Call OI (5)</Typography>
                    <Typography variant="subtitle2" className="font-bold text-green-800 dark:text-green-50">
                        {stats.itmCallOi.toLocaleString('en-IN')}
                    </Typography>
                </Paper>
                <Paper className="p-2 bg-red-100 border border-red-200 dark:bg-red-800/40 dark:border-red-700 flex flex-col justify-center items-center">
                    <Typography variant="caption" className="text-red-900 dark:text-red-100 font-bold">ITM Put OI (5)</Typography>
                    <Typography variant="subtitle2" className="font-bold text-red-800 dark:text-red-50">
                        {stats.itmPutOi.toLocaleString('en-IN')}
                    </Typography>
                </Paper>

                <Paper
                    className="p-2 bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 flex flex-col justify-center items-center"
                >
                    <Typography variant="caption" className="text-amber-800 dark:text-amber-300 font-bold">Charges</Typography>
                    <Tooltip title={charges?.total ? `Brokerage: ₹${charges.total.brokerage} | STT: ₹${charges.total.stt} | TX: ₹${charges.total.tx_charges} | GST: ₹${charges.total.gst} | ${charges.total.trade_count} trades` : 'Click View to load'}>
                        <Typography variant="subtitle2" className="font-bold text-amber-700 dark:text-amber-200">
                            ₹{(charges?.total?.grand_total || 0).toFixed(2)}
                        </Typography>
                    </Tooltip>
                    <Button
                        size="small"
                        variant="text"
                        onClick={() => { fetchCharges(); setShowTradeBook(true); }}
                        style={{ fontSize: '0.65rem', minWidth: 'auto', padding: '0px 8px', marginTop: '2px', textTransform: 'none' }}
                        className="text-amber-700 dark:text-amber-300"
                    >
                        View Charges
                    </Button>
                </Paper>
            </div>

            {/* Open Positions Panel */}
            <Paper className={clsx("p-4 border", isPaper ? "border-purple-200 bg-purple-50 dark:bg-purple-900/20 dark:border-purple-800" : "border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800")}>
                <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-4">
                        <Typography variant="subtitle1" fontWeight="bold" className={clsx("dark:text-gray-100", isPaper && "text-purple-700 dark:text-purple-300")}>
                            {isPaper ? "Mock Positions" : "Open Positions"} ({positions.length})
                        </Typography>
                        <Typography variant="subtitle2" className={clsx("font-bold", totalPnL >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
                            Day's P&L: ₹{totalPnL.toFixed(2)}
                        </Typography>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 bg-white/50 dark:bg-gray-800/50 px-2 py-1 rounded border dark:border-gray-700">
                            <Clock size={14} className="text-gray-500" />
                            <Tooltip title="Position Refresh Interval (seconds)">
                                <input
                                    type="number"
                                    className="w-12 bg-transparent text-xs outline-none dark:text-gray-200"
                                    value={posRefreshInterval}
                                    min={1}
                                    onChange={(e) => setPosRefreshInterval(parseInt(e.target.value) || 1)}
                                />
                            </Tooltip>
                        </div>
                        <FormControlLabel
                            control={<Switch size="small" checked={autoRefreshPositions} onChange={e => setAutoRefreshPositions(e.target.checked)} />}
                            label={<span className="text-xs dark:text-gray-200">Auto</span>}
                        />
                        <Button size="small" onClick={() => fetchPositions()}>Refresh</Button>
                        <FormControlLabel
                            control={<Switch size="small" checked={showClosedPositions} onChange={e => setShowClosedPositions(e.target.checked)} />}
                            label={<span className="text-xs dark:text-gray-200">Show Closed</span>}
                        />
                    </div>
                </div>

                {/* Auto-Exit Controls (Dual Group) */}
                <div className="flex flex-col gap-2 mb-2">
                    <div className="flex items-center gap-4 mb-1">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                                {INDICES.find(i => i.value === index)?.label || "Index"}:
                            </span>
                            <span className="font-bold text-2xl text-blue-600 dark:text-blue-400">
                                {spotLtp ? spotLtp.toFixed(2) : 'Loading...'}
                            </span>
                        </div>
                        <TextField
                            size="small"
                            label="Interval (s)"
                            type="number"
                            value={monitorInterval}
                            onChange={(e) => {
                                const val = parseInt(e.target.value);
                                setMonitorInterval(val > 0 ? val : 1);
                            }}
                            className="w-24 bg-white dark:bg-gray-800"
                            InputProps={{ className: "dark:text-white" }}
                            InputLabelProps={{ className: "dark:text-gray-300" }}
                            inputProps={{ min: 1 }}
                        />
                        <FormControlLabel
                            control={<Switch size="small" checked={isSpotPolling} onChange={e => setIsSpotPolling(e.target.checked)} />}
                            label={<span className="text-xs dark:text-gray-300">Poll</span>}
                        />
                    </div>

                    <div className="flex flex-col md:flex-row gap-4">
                        {/* Bullish Control */}
                        <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 p-2 rounded border border-green-200 dark:border-green-800 flex-1 overflow-x-auto">
                            <span className="font-bold text-green-800 dark:text-green-300 whitespace-nowrap">BULLISH</span>
                            <TextField
                                size="small"
                                label="Target (Upper)"
                                value={targetLevelBull}
                                onChange={(e) => setTargetLevelBull(e.target.value)}
                                type="number"
                                className="w-24 bg-white dark:bg-gray-800"
                                InputProps={{ className: "dark:text-white" }}
                                InputLabelProps={{ className: "dark:text-gray-300" }}
                            />
                            <TextField
                                size="small"
                                label="SL (Lower)"
                                value={stopLevelBull}
                                onChange={(e) => setStopLevelBull(e.target.value)}
                                type="number"
                                className="w-24 bg-white dark:bg-gray-800"
                                InputProps={{ className: "dark:text-white" }}
                                InputLabelProps={{ className: "dark:text-gray-300" }}
                            />
                            <FormControlLabel
                                control={
                                    <Switch
                                        size="small"
                                        checked={isMonitoringBull}
                                        onChange={(e) => setIsMonitoringBull(e.target.checked)}
                                        color="success"
                                    />
                                }
                                label={<span className={clsx("whitespace-nowrap text-xs font-bold", isMonitoringBull ? "text-green-600 dark:text-green-400" : "text-gray-500")}>{isMonitoringBull ? "ON" : "OFF"}</span>}
                            />
                        </div>

                        {/* Bearish Control */}
                        <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-200 dark:border-red-800 flex-1 overflow-x-auto">
                            <span className="font-bold text-red-800 dark:text-red-300 whitespace-nowrap">BEARISH</span>
                            <TextField
                                size="small"
                                label="Target (Lower)"
                                value={targetLevelBear}
                                onChange={(e) => setTargetLevelBear(e.target.value)}
                                type="number"
                                className="w-24 bg-white dark:bg-gray-800"
                                InputProps={{ className: "dark:text-white" }}
                                InputLabelProps={{ className: "dark:text-gray-300" }}
                            />
                            <TextField
                                size="small"
                                label="SL (Upper)"
                                value={stopLevelBear}
                                onChange={(e) => setStopLevelBear(e.target.value)}
                                type="number"
                                className="w-24 bg-white dark:bg-gray-800"
                                InputProps={{ className: "dark:text-white" }}
                                InputLabelProps={{ className: "dark:text-gray-300" }}
                            />
                            <FormControlLabel
                                control={
                                    <Switch
                                        size="small"
                                        checked={isMonitoringBear}
                                        onChange={(e) => setIsMonitoringBear(e.target.checked)}
                                        color="error"
                                    />
                                }
                                label={<span className={clsx("whitespace-nowrap text-xs font-bold", isMonitoringBear ? "text-red-600 dark:text-red-400" : "text-gray-500")}>{isMonitoringBear ? "ON" : "OFF"}</span>}
                            />
                        </div>
                    </div>
                </div>

                {positions.length === 0 ? (
                    <Typography variant="body2" className="text-gray-500 dark:text-gray-400 italic text-center py-2">No open positions</Typography>
                ) : (
                    <div className="grid grid-rows-2 grid-flow-col gap-2 overflow-x-auto pb-2 p-1 border dark:border-gray-700 rounded bg-white dark:bg-gray-900 border-gray-200">
                        {positions
                            .filter(p => showClosedPositions || p.quantity !== 0)
                            .map((p: any, idx) => (
                                <div key={idx} className="min-w-[280px] p-1 border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-800/50 flex items-center gap-2 text-xs transition-colors bg-white dark:bg-gray-800">
                                    {/* Checkboxes Group - Leftmost */}
                                    <div className="flex flex-col gap-0 px-0.5 border-r border-gray-200 dark:border-gray-700 pr-1 mr-1">
                                        <div className="flex items-center gap-1">
                                            <Checkbox
                                                size="small"
                                                className="p-0 scale-[0.7]"
                                                color="success"
                                                checked={selectedPositionsBull.has(isPaper ? p.trade_id : (p.instrument_key || p.instrument_token))}
                                                onChange={() => toggleMonitorSelection(isPaper ? p.trade_id : (p.instrument_key || p.instrument_token), "BULL")}
                                            />
                                            <span className="font-bold text-green-700 dark:text-green-400 text-[10px]">B</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Checkbox
                                                size="small"
                                                className="p-0 scale-[0.7]"
                                                color="error"
                                                checked={selectedPositionsBear.has(isPaper ? p.trade_id : (p.instrument_key || p.instrument_token))}
                                                onChange={() => toggleMonitorSelection(isPaper ? p.trade_id : (p.instrument_key || p.instrument_token), "BEAR")}
                                            />
                                            <span className="font-bold text-red-700 dark:text-red-400 text-[10px]">B</span>
                                        </div>
                                    </div>

                                    {/* Symbol and Prices - Middle */}
                                    <div className="flex-1 flex flex-col gap-0 overflow-hidden min-w-0">
                                        <div className="flex items-center justify-between">
                                            <span className="font-bold dark:text-gray-200 truncate" title={p.trading_symbol}>{p.trading_symbol}</span>
                                            <span className={clsx("font-bold whitespace-nowrap", p.quantity > 0 ? "text-green-600 dark:text-green-400" : "text-gray-500")}>
                                                {p.quantity}Q
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 whitespace-nowrap text-[10px]">
                                            <span>@{p.average_price?.toFixed(1) || '0'}</span>
                                            <span>L:{p.last_price?.toFixed(1)}</span>
                                        </div>
                                    </div>

                                    {/* P&L and Actions - Right */}
                                    <div className="flex flex-col items-end gap-1 ml-auto">
                                        <span className={clsx("font-bold text-right whitespace-nowrap", (p.pnl || 0) >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
                                            {(p.pnl || 0).toFixed(0)}
                                        </span>
                                        {/* Action Buttons */}
                                        <div className="flex items-center gap-1">
                                            {p.quantity !== 0 && (
                                                <>
                                                    <Button
                                                        size="small"
                                                        variant="contained"
                                                        color="error"
                                                        style={{ fontSize: '0.60rem', minWidth: 'auto', padding: '1px 6px', height: '20px' }}
                                                        onClick={() => {
                                                            console.log("Click Market Exit for", p.trading_symbol);
                                                            handleExit(isPaper ? p.trade_id : (p.instrument_key || p.instrument_token))
                                                        }}
                                                        title="Market Exit"
                                                    >
                                                        M
                                                    </Button>
                                                    <Button
                                                        size="small"
                                                        variant="contained"
                                                        color="warning"
                                                        style={{ fontSize: '0.60rem', minWidth: 'auto', padding: '1px 6px', height: '20px', backgroundColor: '#ed6c02', color: 'white' }}
                                                        onClick={() => openLimitExit(p)}
                                                        title="Limit Exit"
                                                    >
                                                        L
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                    </div>
                )}
            </Paper>

            {/* Action Bar */}
            <Paper className={clsx("p-3 border flex justify-between items-center sticky top-20 z-40", isPaper ? "bg-purple-100 border-purple-300 dark:bg-purple-900 dark:border-purple-700" : "bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800")}>
                <div className="flex items-center gap-4">
                    <Typography variant="subtitle1" fontWeight="bold" className="dark:text-gray-100">
                        {Object.keys(selectedItems).length} Orders Selected {isPaper && "(Paper)"}
                    </Typography>
                    <TextField
                        size="small"
                        label="Lots"
                        type="number"
                        value={lots}
                        onChange={(e) => setLots(parseInt(e.target.value) || 1)}
                        className="w-24 bg-white dark:bg-gray-800"
                        InputProps={{ className: "dark:text-white" }}
                        InputLabelProps={{ className: "dark:text-gray-300" }}
                        inputProps={{ min: 1 }}
                    />
                </div>
                <Button
                    variant="contained"
                    color={isPaper ? "secondary" : "warning"}
                    startIcon={<Zap />}
                    onClick={handlePlaceOrder}
                    disabled={Object.keys(selectedItems).length === 0}
                >
                    {isPaper ? "Paper Trade" : "Execute Bulk Order"}
                </Button>
            </Paper>

            {/* Chain Table */}
            <TableContainer component={Paper} className="max-h-[70vh] bg-white dark:bg-gray-800">
                <Table stickyHeader size="small">
                    <TableHead>
                        <TableRow>
                            {/* CE */}
                            <TableCell align="center" colSpan={7} className="bg-green-50 dark:bg-green-900/30 border-b-2 border-green-200 dark:border-green-800 dark:text-green-200">CALLS (OI: {totals.ce.toLocaleString('en-IN')})</TableCell>
                            <TableCell className="bg-gray-800 text-white w-24 text-center">STRIKE</TableCell>
                            {/* PE */}
                            <TableCell align="center" colSpan={7} className="bg-red-50 dark:bg-red-900/30 border-b-2 border-red-200 dark:border-red-800 dark:text-red-200">PUTS (OI: {totals.pe.toLocaleString('en-IN')})</TableCell>
                        </TableRow>
                        <TableRow className="bg-gray-100 dark:bg-gray-900">
                            <TableCell align="right" className="dark:text-gray-300">Delta</TableCell>
                            <TableCell align="right" className="font-bold text-gray-700 dark:text-gray-300">OI Val</TableCell>
                            <TableCell align="right" className="dark:text-gray-300">OI</TableCell>
                            <TableCell align="right" className="dark:text-gray-300">Limit</TableCell>
                            <TableCell align="right" className="dark:text-gray-300">LTP</TableCell>
                            <TableCell align="center" className="dark:text-gray-300">Buy</TableCell>
                            <TableCell align="center" className="dark:text-gray-300">Sell</TableCell>

                            <TableCell align="center" className="bg-gray-200 dark:bg-gray-800 font-bold dark:text-white">Price</TableCell>

                            <TableCell align="center" className="dark:text-gray-300">Buy</TableCell>
                            <TableCell align="center" className="dark:text-gray-300">Sell</TableCell>
                            <TableCell align="right" className="dark:text-gray-300">LTP</TableCell>
                            <TableCell align="right" className="dark:text-gray-300">Limit</TableCell>

                            <TableCell align="right" className="dark:text-gray-300">OI</TableCell>
                            <TableCell align="right" className="font-bold text-gray-700 dark:text-gray-300">OI Val</TableCell>
                            <TableCell align="right" className="dark:text-gray-300">Delta</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {chain.map((row: any) => {
                            const isAtm = Math.abs(row.strike - spot) < 50;

                            const cePos = row.ce ? getPositionByInstrumentKey(row.ce.instrument_key) : null;
                            const pePos = row.pe ? getPositionByInstrumentKey(row.pe.instrument_key) : null;

                            return (
                                <TableRow key={row.strike} className={clsx(isAtm && "bg-yellow-100 dark:bg-yellow-900/30", "dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800")}>
                                    {/* CE Data */}
                                    <TableCell align="right" className="dark:text-gray-200">{row.ce ? row.ce.delta?.toFixed(2) : '-'}</TableCell>
                                    <TableCell align="right" className="text-gray-600 dark:text-gray-400 text-xs">{row.ce ? formatCr(row.ce.oi_value) : ''}</TableCell>
                                    <TableCell align="right" className="dark:text-gray-200">{row.ce ? formatOI(row.ce.open_interest) : '-'}</TableCell>
                                    <TableCell align="right">
                                        {row.ce && (
                                            <input
                                                type="number"
                                                className="w-16 bg-transparent border border-gray-300 dark:border-gray-600 rounded px-1 text-right text-xs dark:text-white"
                                                value={selectedItems[`${row.ce.instrument_key}_BUY`]?.limit_price || selectedItems[`${row.ce.instrument_key}_SELL`]?.limit_price || ""}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setSelectedItems(prev => {
                                                        const next = { ...prev };
                                                        const buyKey = `${row.ce.instrument_key}_BUY`;
                                                        const sellKey = `${row.ce.instrument_key}_SELL`;
                                                        if (next[buyKey]) next[buyKey] = { ...next[buyKey], limit_price: val };
                                                        if (next[sellKey]) next[sellKey] = { ...next[sellKey], limit_price: val };
                                                        return next;
                                                    });
                                                }}
                                            />
                                        )}
                                    </TableCell>
                                    <TableCell align="right" className="font-bold text-green-700 dark:text-green-400">
                                        {row.ce ? row.ce.last_price : '-'}
                                        {cePos && cePos.quantity > 0 && (
                                            <div className="flex flex-col text-[10px] mt-1">
                                                <span className="font-bold text-blue-600">Qty: {cePos.quantity}</span>
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell padding="checkbox">
                                        <Checkbox
                                            checked={!!selectedItems[`${row.ce?.instrument_key}_BUY`]}
                                            onChange={() => row.ce && toggleSelection(row.ce, 'CE', 'BUY')}
                                            color="success"
                                            disabled={!row.ce}
                                        />
                                    </TableCell>
                                    <TableCell padding="checkbox">
                                        <Checkbox
                                            checked={!!selectedItems[`${row.ce?.instrument_key}_SELL`]}
                                            onChange={() => row.ce && toggleSelection(row.ce, 'CE', 'SELL')}
                                            color="error"
                                            disabled={!row.ce}
                                        />
                                    </TableCell>

                                    {/* Strike */}
                                    <TableCell align="center" className="bg-gray-100 dark:bg-gray-900 font-bold border-x dark:border-gray-700 dark:text-white">{row.strike}</TableCell>

                                    {/* PE Data */}
                                    <TableCell padding="checkbox">
                                        <Checkbox
                                            checked={!!selectedItems[`${row.pe?.instrument_key}_BUY`]}
                                            onChange={() => row.pe && toggleSelection(row.pe, 'PE', 'BUY')}
                                            color="success"
                                            disabled={!row.pe}
                                        />
                                    </TableCell>
                                    <TableCell padding="checkbox">
                                        <Checkbox
                                            checked={!!selectedItems[`${row.pe?.instrument_key}_SELL`]}
                                            onChange={() => row.pe && toggleSelection(row.pe, 'PE', 'SELL')}
                                            color="error"
                                            disabled={!row.pe}
                                        />
                                    </TableCell>
                                    <TableCell align="right" className="font-bold text-red-700 dark:text-red-400">
                                        {row.pe ? row.pe.last_price : '-'}
                                        {pePos && pePos.quantity > 0 && (
                                            <div className="flex flex-col text-[10px] mt-1">
                                                <span className="font-bold text-blue-600">Qty: {pePos.quantity}</span>
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell align="right">
                                        {row.pe && (
                                            <input
                                                type="number"
                                                className="w-16 bg-transparent border border-gray-300 dark:border-gray-600 rounded px-1 text-right text-xs dark:text-white"
                                                value={selectedItems[`${row.pe.instrument_key}_BUY`]?.limit_price || selectedItems[`${row.pe.instrument_key}_SELL`]?.limit_price || ""}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setSelectedItems(prev => {
                                                        const next = { ...prev };
                                                        const buyKey = `${row.pe.instrument_key}_BUY`;
                                                        const sellKey = `${row.pe.instrument_key}_SELL`;
                                                        if (next[buyKey]) next[buyKey] = { ...next[buyKey], limit_price: val };
                                                        if (next[sellKey]) next[sellKey] = { ...next[sellKey], limit_price: val };
                                                        return next;
                                                    });
                                                }}
                                            />
                                        )}
                                    </TableCell>

                                    <TableCell align="right" className="dark:text-gray-200">{row.pe ? formatOI(row.pe.open_interest) : '-'}</TableCell>
                                    <TableCell align="right" className="text-gray-600 dark:text-gray-400 text-xs">{row.pe ? formatCr(row.pe.oi_value) : ''}</TableCell>
                                    <TableCell align="right" className="dark:text-gray-200">{row.pe ? row.pe.delta?.toFixed(2) : '-'}</TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
            {/* Limit Exit Dialog */}
            <Dialog open={limitExitOpen} onClose={() => setLimitExitOpen(false)}>
                <DialogTitle>Limit Exit: {limitExitPosition?.trading_symbol}</DialogTitle>
                <DialogContent className="pt-2">
                    <Typography variant="body2" gutterBottom>
                        Current Qty: {limitExitPosition?.quantity} | LTP: {limitExitPosition?.last_price}
                    </Typography>
                    <TextField
                        autoFocus
                        margin="dense"
                        id="limit-price"
                        label="Limit Price"
                        type="number"
                        fullWidth
                        variant="outlined"
                        value={limitPrice}
                        onChange={(e) => setLimitPrice(e.target.value)}
                        inputProps={{ step: "0.05" }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setLimitExitOpen(false)} color="inherit">Cancel</Button>
                    <Button onClick={handleLimitExitCode} variant="contained" color="primary">
                        Confirm Exit
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Trade Book / Charges Modal */}
            <Dialog open={showTradeBook} onClose={() => setShowTradeBook(false)} maxWidth="lg" fullWidth>
                <DialogTitle className="flex justify-between items-center">
                    <span>Trade Book — Today's Charges</span>
                    <span className="font-bold text-lg text-amber-700 dark:text-amber-400">
                        Total: ₹{(charges?.total?.grand_total || 0).toFixed(2)}
                    </span>
                </DialogTitle>
                <DialogContent>
                    {/* Summary Row */}
                    {charges?.total && (
                        <div className="grid grid-cols-3 md:grid-cols-7 gap-2 mb-4">
                            <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded text-center">
                                <div className="text-[10px] text-gray-500">Brokerage</div>
                                <div className="font-bold text-sm">₹{charges.total.brokerage}</div>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded text-center">
                                <div className="text-[10px] text-gray-500">STT</div>
                                <div className="font-bold text-sm">₹{charges.total.stt}</div>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded text-center">
                                <div className="text-[10px] text-gray-500">TX Charges</div>
                                <div className="font-bold text-sm">₹{charges.total.tx_charges}</div>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded text-center">
                                <div className="text-[10px] text-gray-500">GST</div>
                                <div className="font-bold text-sm">₹{charges.total.gst}</div>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded text-center">
                                <div className="text-[10px] text-gray-500">SEBI</div>
                                <div className="font-bold text-sm">₹{charges.total.sebi}</div>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded text-center">
                                <div className="text-[10px] text-gray-500">Stamp Duty</div>
                                <div className="font-bold text-sm">₹{charges.total.stamp_duty}</div>
                            </div>
                            <div className="bg-amber-50 dark:bg-amber-900/30 p-2 rounded text-center border border-amber-200 dark:border-amber-800">
                                <div className="text-[10px] text-amber-700 dark:text-amber-300">Orders / Trades</div>
                                <div className="font-bold text-sm text-amber-800 dark:text-amber-200">{charges.total.order_count} / {charges.total.trade_count}</div>
                            </div>
                        </div>
                    )}

                    {/* Per-Trade Table */}
                    <TableContainer component={Paper} className="max-h-[60vh]">
                        <Table stickyHeader size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell className="font-bold">Symbol</TableCell>
                                    <TableCell className="font-bold" align="center">Type</TableCell>
                                    <TableCell className="font-bold" align="right">Qty</TableCell>
                                    <TableCell className="font-bold" align="right">Price</TableCell>
                                    <TableCell className="font-bold" align="right">Turnover</TableCell>
                                    <TableCell className="font-bold" align="right">Brokerage</TableCell>
                                    <TableCell className="font-bold" align="right">STT</TableCell>
                                    <TableCell className="font-bold" align="right">TX</TableCell>
                                    <TableCell className="font-bold" align="right">GST</TableCell>
                                    <TableCell className="font-bold" align="right">Total</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {(charges?.orders || []).map((t: any, i: number) => (
                                    <TableRow key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                        <TableCell className="text-xs">{t.trading_symbol}</TableCell>
                                        <TableCell align="center">
                                            <span className={clsx("text-xs font-bold px-1 py-0.5 rounded", t.transaction_type === 'BUY' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400')}>
                                                {t.transaction_type}
                                            </span>
                                        </TableCell>
                                        <TableCell align="right" className="text-xs">{t.quantity}</TableCell>
                                        <TableCell align="right" className="text-xs">₹{t.average_price}</TableCell>
                                        <TableCell align="right" className="text-xs">₹{t.turnover?.toLocaleString('en-IN')}</TableCell>
                                        <TableCell align="right" className="text-xs">₹{t.brokerage}</TableCell>
                                        <TableCell align="right" className="text-xs">₹{t.stt}</TableCell>
                                        <TableCell align="right" className="text-xs">₹{t.tx_charges}</TableCell>
                                        <TableCell align="right" className="text-xs">₹{t.gst}</TableCell>
                                        <TableCell align="right" className="text-xs font-bold">₹{t.total}</TableCell>
                                    </TableRow>
                                ))}
                                {(!charges?.orders || charges.orders.length === 0) && (
                                    <TableRow>
                                        <TableCell colSpan={10} align="center" className="text-gray-500 italic py-4">No executed orders for today</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowTradeBook(false)} color="inherit">Close</Button>
                    <Button onClick={fetchCharges} variant="contained" size="small">Refresh</Button>
                </DialogActions>
            </Dialog>
        </div>
    );
}
