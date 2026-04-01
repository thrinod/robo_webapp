"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
    Paper, TextField, Button, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, IconButton, Typography, CircularProgress,
    FormControl, InputLabel, Select as MuiSelect, MenuItem, Box, LinearProgress,
    TableSortLabel
} from "@mui/material";
import { getScannerInstruments, getScannerData, getUpstoxStatus, populateScannerInstruments, getScannerResults, populateScannerFno, fetchFnoList, fetchMasterInstruments } from "@/services/api";
import { Activity, Search, RefreshCw, StopCircle, Database, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";

// Types
interface ScannerData {
    [key: string]: any;
}

type SortKey = 'name' | 'ltp' | 'change' | 'd1' | 'd2' | 'd3' | 'd4' | 'd5' | 'change_7d' | 'change_30d' | 'rsi' | 'adx' | 'stoch_k' | 'stoch_d' | 'dmp' | 'dmn' | 'macd_hist' | 'bb_upper' | 'bb_middle' | 'bb_lower' | 'sma_50' | 'sma_200' | 's1' | 'r1' | 's2' | 'r2' | 'box_formation';

export default function ScannerPage() {
    // Data State
    const [instruments, setInstruments] = useState<any[]>([]);
    const [scannerData, setScannerData] = useState<ScannerData>({});

    // UI State
    const [searchTerm, setSearchTerm] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [interval, setInterval] = useState("day");
    const [dataSource, setDataSource] = useState("history"); // combined, history, intraday

    // Sorting State
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({
        key: 'name',
        direction: 'asc'
    });

    // Batch Process State
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const processRef = useRef(false);
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [refreshInterval, setRefreshInterval] = useState(5); // Minutes
    const autoRefreshRef = useRef<any>(null);

    // Initial Load
    useEffect(() => {
        // loadInstruments();
    }, []);



    const loadInstruments = async () => {
        setIsLoading(true);
        try {
            const data = await getScannerInstruments();
            setInstruments(data);

            // Load Saved Results
            const savedResults = await getScannerResults();
            if (savedResults && savedResults.length > 0) {
                const initialData: Record<string, any> = {};
                savedResults.forEach((item: any) => {
                    if (item.instrument_key) {
                        initialData[item.instrument_key] = item;
                    }
                });
                setScannerData(initialData);
                if (savedResults[0].updated_at) {
                    setLastUpdated(new Date(savedResults[0].updated_at));
                }
            }

        } catch (error) {
            console.error("Failed to load instruments", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Sorting Handler
    const handleRequestSort = (property: SortKey) => {
        const isAsc = sortConfig.key === property && sortConfig.direction === 'asc';
        setSortConfig({ key: property, direction: isAsc ? 'desc' : 'asc' });
    };

    // Derived State (Search + Sort)
    const processedInstruments = useMemo(() => {
        // 1. Filter
        let result = instruments.filter(i => {
            const term = searchTerm.toLowerCase();
            const name = (i.name || i.instrument_key || "").toLowerCase();
            const symbol = (i.trading_symbol || "").toLowerCase();
            return name.includes(term) || symbol.includes(term);
        });

        // 2. Sort
        result.sort((a, b) => {
            const key = sortConfig.key;
            const dir = sortConfig.direction === 'asc' ? 1 : -1;

            // Helper to get value
            const getVal = (inst: any, k: SortKey) => {
                if (k === 'name') return (inst.name || inst.trading_symbol || "").toLowerCase();

                const data = scannerData[inst.instrument_key];
                if (!data) return -999999999;

                if (k === 'ltp') return data[k] ?? -999999;

                if (k === 'change') {
                    const change = data.change;
                    const ltp = data.ltp;
                    const prev_close = data.prev_close;
                    if (change !== undefined && ltp !== undefined) {
                        const prev = prev_close > 0 ? prev_close : (ltp - change);
                        if (prev === 0) return 0;
                        return (change / prev) * 100;
                    }
                    return -999999;
                }

                // Multi-day change sorting
                if (k.startsWith('d') && k.length === 2) {
                    const idx = parseInt(k.substring(1)) - 1;
                    return data.daily_changes?.[idx]?.pct ?? -999999;
                }
                if (k === 'change_7d' || k === 'change_30d') {
                    return data[k] ?? -999999;
                }

                const inds = data.indicators || {};
                const pp = inds.pivot_points || {};

                // Pivot Sorting: Sort by Diff % (LTP - Level) / Level
                if (['s1', 'r1', 's2', 'r2', 'sma_50', 'sma_200'].includes(k)) {
                    const ltp = data.ltp;
                    let level = 0;

                    if (['s1', 'r1', 's2', 'r2'].includes(k)) level = pp[k];
                    else level = inds[k];

                    if (level && ltp) {
                        return (ltp - level) / level;
                    }
                    return -999999;
                }

                if (k === 'box_formation') {
                    if (!inds.box_formation) return -1;
                    // Sort by breakout first, then containment
                    const b = inds.box_formation.breakout;
                    if (b === 'up') return 1000 + (inds.box_formation.containment || 0);
                    if (b === 'down') return 500 + (inds.box_formation.containment || 0);
                    if (inds.box_formation.detected) return 100 + (inds.box_formation.containment || 0);
                    return inds.box_formation.containment || 0;
                }

                return inds[k] ?? -999999;
            };

            const valA = getVal(a, key);
            const valB = getVal(b, key);

            if (valA < valB) return -1 * dir;
            if (valA > valB) return 1 * dir;
            return 0;
        });

        return result;

    }, [instruments, searchTerm, scannerData, sortConfig]);

    // Populate Logic
    const handlePopulate = async () => {
        setIsLoading(true);
        await populateScannerInstruments("NIFTY 50");
        await loadInstruments();
        setIsLoading(false);
    };

    const handlePopulateFno = async () => {
        if (!confirm("This will replace current scanner instruments with all FNO stocks. Continue?")) return;
        setIsLoading(true);
        const res = await populateScannerFno();
        if (res.status === "success") {
            // alert(`Loaded ${res.count} FNO instruments.`);
            await loadInstruments();
            return true;
        } else {
            console.error("Failed to load FNO: " + res.message);
            return false;
        }
    };



    const handleUpdateFno = async () => {
        setIsLoading(true);
        try {
            // 1. Fetch from NSE
            const fnoRes = await fetchFnoList();
            if (fnoRes.status !== "success") {
                console.error("Failed to fetch FNO list from NSE: " + fnoRes.message);
                setIsLoading(false);
                return;
            }
            // alert(fnoRes.message);

            // 2. Populate Scanner
            const popRes = await handlePopulateFno();
            if (popRes) {
                console.log(`Successfully Updated FNO List & Loaded ${fnoRes.count} Symbols.`);
            }

        } catch (error) {
            console.error(error);
            console.error("Error updating FNO list");
        }
        setIsLoading(false);
    };

    const handleUpdateMaster = async () => {
        if (!confirm("This will download 10MB+ Master List. It may take 10-20 seconds. Continue?")) return;
        setIsLoading(true);
        try {
            const res = await fetchMasterInstruments();
            if (res.status === "success") {
                console.log(res.message);
                setLastUpdated(new Date());
            } else {
                console.error("Failed: " + res.message);
            }
        } catch (e) {
            console.error(e);
            console.error("Error updating master list");
        }
        setIsLoading(false);
    };

    // Scan Logic
    const handleStartScan = async (batchSize = 5, force = false) => {
        const targetList = processedInstruments; // Scan what we see (sorted order doesn't matter for scanning)
        if (targetList.length === 0) return;

        setIsProcessing(true);
        processRef.current = true;

        const allKeys = targetList.map(i => i.instrument_key);
        const total = allKeys.length;
        setProgress({ current: 0, total });

        const BATCH_SIZE = batchSize;

        for (let i = 0; i < total; i += BATCH_SIZE) {
            if (!processRef.current) break; // Stop

            const batch = allKeys.slice(i, i + BATCH_SIZE);
            console.log(`Scanning Batch ${Math.floor(i / BATCH_SIZE) + 1} (Force: ${force}):`, batch);

            await fetchBatch(batch, force);

            setProgress({ current: Math.min(i + BATCH_SIZE, total), total });
            await new Promise(r => setTimeout(r, 100)); // Slight delay
        }

        setIsProcessing(false);
        processRef.current = false;
        setLastUpdated(new Date());
    };

    const handleStopScan = () => {
        processRef.current = false;
        setIsProcessing(false);
    };

    // Auto Refresh Effect (Placed here to access handleStartScan)
    useEffect(() => {
        if (autoRefresh) {
            // Use window.setInterval to strictly get a number (Browser env)
            const ms = Math.max(refreshInterval, 1) * 60 * 1000;
            const intervalId = window.setInterval(() => {
                if (!processRef.current && !isProcessing) {
                    // Only start if not running
                    handleStartScan(1, false); // Auto Refresh = No Force
                }
            }, ms > 10000 ? ms : 10000); // Minimum 10 seconds safety

            autoRefreshRef.current = intervalId;
        } else {
            if (autoRefreshRef.current) {
                clearInterval(autoRefreshRef.current);
                autoRefreshRef.current = null;
            }
        }
        return () => {
            if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
        };
    }, [autoRefresh, isProcessing, refreshInterval]);

    // Fetch and Merge Logic
    // Fetch and Merge Logic
    const fetchBatch = async (keys: string[], force = false) => {
        const dataList = await getScannerData(keys, interval, dataSource, force);
        console.log("Scanner Batch Response:", dataList); // DEBUG

        if (dataList && dataList.length > 0) {
            setScannerData(prev => {
                const next = { ...prev };
                dataList.forEach((item: any) => {
                    if (item && item.instrument_key) {
                        next[item.instrument_key] = item;
                    }
                    if (item && item.data && item.data.instrument_key) {
                        next[item.data.instrument_key] = item.data;
                    }
                });
                return next;
            });
        }
    };

    // Formatters
    const fmt = (n: number) => n?.toFixed(2) ?? "-";

    // Sortable Header Component
    const SortHeader = ({ id, label, align = "right" }: { id: SortKey, label: string, align?: "left" | "right" | "center" }) => (
        <TableCell align={align} className="font-bold dark:bg-gray-700 dark:text-gray-200 p-2">
            <TableSortLabel
                active={sortConfig.key === id}
                direction={sortConfig.key === id ? sortConfig.direction : 'asc'}
                onClick={() => handleRequestSort(id)}
            >
                {label}
            </TableSortLabel>
        </TableCell>
    );

    return (
        <div className="p-4 bg-gray-50 dark:bg-gray-900 min-h-screen">
            {/* Header / Toolbar */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold dark:text-gray-100">Market Scanner</h1>
                    <p className="text-xs text-gray-500">
                        Instruments: {instruments.length} | Visible: {processedInstruments.length}
                        {lastUpdated && ` | Updated: ${lastUpdated.toLocaleTimeString()}`}
                    </p>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    {/* Interval Select */}
                    <FormControl size="small" className="min-w-[100px]">
                        <InputLabel>Interval</InputLabel>
                        <MuiSelect
                            value={interval}
                            label="Interval"
                            onChange={(e) => setInterval(e.target.value)}
                            disabled={isProcessing}
                        >
                            <MenuItem value="1minute">1 Min</MenuItem>
                            <MenuItem value="3minute">3 Min</MenuItem>
                            <MenuItem value="5minute">5 Min</MenuItem>
                            <MenuItem value="15minute">15 Min</MenuItem>
                            <MenuItem value="30minute">30 Min</MenuItem>
                            <MenuItem value="60minute">1 Hour</MenuItem>
                            <MenuItem value="day">Day</MenuItem>
                        </MuiSelect>
                    </FormControl>

                    {/* Data Source Select */}
                    <FormControl size="small" className="min-w-[120px]">
                        <InputLabel>Source</InputLabel>
                        <MuiSelect
                            value={dataSource}
                            label="Source"
                            onChange={(e) => setDataSource(e.target.value)}
                            disabled={isProcessing}
                        >
                            <MenuItem value="combined">Combined</MenuItem>
                            <MenuItem value="history">History Only</MenuItem>
                            <MenuItem value="intraday">Intraday Only</MenuItem>
                        </MuiSelect>
                    </FormControl>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                        <Input
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-8 w-[150px] md:w-[200px]"
                        />
                    </div>

                    {/* Scan Controls */}
                    <div className="flex gap-2 mr-2">
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={handlePopulate} // Default Nifty 50
                            disabled={isProcessing || isLoading}
                            className="dark:text-gray-300"
                        >
                            Load Main
                        </Button>
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={handlePopulateFno}
                            disabled={isProcessing || isLoading}
                            className="dark:text-gray-300"
                        >
                            Load FnO
                        </Button>
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={handleUpdateFno}
                            disabled={isProcessing || isLoading}
                            className="dark:text-gray-300 ml-2"
                        >
                            Update FNO List (NSE)
                        </Button>
                        <Button
                            variant="outlined"
                            size="small"
                            color="warning"
                            onClick={handleUpdateMaster}
                            disabled={isProcessing || isLoading}
                            className="dark:text-gray-300 ml-2"
                        >
                            Update Master DB
                        </Button>
                    </div>

                    {isProcessing ? (
                        <div className="flex items-center gap-2 bg-blue-100 dark:bg-blue-900 px-3 py-1.5 rounded-md">
                            <CircularProgress size={16} />
                            <span className="text-xs font-mono">{progress.current}/{progress.total}</span>
                            <IconButton size="small" color="error" onClick={handleStopScan}>
                                <StopCircle size={16} />
                            </IconButton>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <Button
                                variant="contained"
                                color="success"
                                startIcon={<Activity size={16} />}
                                onClick={() => handleStartScan(5, true)}
                                disabled={processedInstruments.length === 0}
                            >
                                Start Scan (Force)
                            </Button>

                            <div className="flex items-center gap-1 bg-gray-200 dark:bg-gray-800 px-2 py-1 rounded">
                                <span className="text-xs">Auto (min):</span>
                                <input
                                    type="number"
                                    value={refreshInterval}
                                    onChange={(e) => setRefreshInterval(Number(e.target.value))}
                                    className="w-12 text-xs p-1 rounded border border-gray-300 dark:bg-gray-700 dark:text-white"
                                    min={1}
                                />
                                <input
                                    type="checkbox"
                                    checked={autoRefresh}
                                    onChange={(e) => setAutoRefresh(e.target.checked)}
                                    className="cursor-pointer ml-1"
                                />
                            </div>
                        </div>
                    )}

                    <IconButton onClick={loadInstruments} disabled={isProcessing}>
                        <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
                    </IconButton>
                </div>
            </div>

            {/* Table */}
            <TableContainer component={Paper} className="shadow-md rounded-lg overflow-x-auto dark:bg-gray-800">
                <Table size="small" stickyHeader>
                    <TableHead>
                        <TableRow>
                            <SortHeader id="name" label="Instrument" align="left" />
                            <SortHeader id="ltp" label="LTP" />
                            <SortHeader id="change" label="Chg %" />
                            <SortHeader id="box_formation" label="Box" align="center" />
                            <SortHeader id="d1" label="D-1" />
                            <SortHeader id="d2" label="D-2" />
                            <SortHeader id="d3" label="D-3" />
                            <SortHeader id="d4" label="D-4" />
                            <SortHeader id="d5" label="D-5" />
                            <SortHeader id="change_7d" label="7D" />
                            <SortHeader id="change_30d" label="30D" />

                            {/* Technical Indicators */}
                            <SortHeader id="rsi" label="RSI" />
                            <SortHeader id="adx" label="ADX" />
                            <SortHeader id="sma_50" label="SMA 50" />
                            <SortHeader id="sma_200" label="SMA 200" />
                            <SortHeader id="stoch_k" label="Stochastic" />
                            <SortHeader id="dmp" label="DMI" />
                            <SortHeader id="macd_hist" label="MACD" />
                            <TableCell align="right" className="font-bold dark:bg-gray-700 dark:text-gray-200">Bollinger</TableCell>

                            {/* Pivot Points */}
                            <SortHeader id="s1" label="S1" />
                            <SortHeader id="r1" label="R1" />
                            <SortHeader id="s2" label="S2" />
                            <SortHeader id="r2" label="R2" />
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {processedInstruments.map((inst) => {
                            const data = scannerData[inst.instrument_key];
                            const indicators = data?.indicators || {};
                            // DEBUG: Check SMA 200 value
                            if (indicators.sma_200 === undefined || indicators.sma_200 === null) {
                                // console.log(`Missing SMA 200 for ${inst.name}:`, indicators);
                            }
                            const ltp = data?.ltp || 0;
                            const change = data?.change || 0;
                            const prev_close = data?.prev_close || 0;
                            const changePct = prev_close > 0 ? (change / prev_close) * 100 : (ltp ? (change / (ltp - change)) * 100 : 0);
                            const hasData = !!data;
                            const pp = indicators.pivot_points || {};

                            return (
                                <TableRow key={inst.instrument_key} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                    <TableCell component="th" scope="row">
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium dark:text-gray-100">{inst.name || inst.trading_symbol || inst.instrument_key}</span>
                                                {inst.trading_symbol && (
                                                    <a
                                                        href={`https://www.screener.in/company/${inst.trading_symbol.replace(/-EQ$/i, '')}/`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-gray-400 hover:text-blue-500"
                                                        title="Open in Screener.in"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <ExternalLink size={12} />
                                                    </a>
                                                )}
                                            </div>
                                            <span className="text-[10px] text-gray-400">{inst.instrument_key.split('|')[0]}</span>
                                        </div>
                                    </TableCell>

                                    <TableCell align="right" className="font-mono dark:text-gray-200">
                                        {hasData ? fmt(ltp) : '-'}
                                    </TableCell>

                                    <TableCell align="right">
                                        {hasData ? (
                                            <div className={`text-xs ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {change > 0 && '+'}{fmt(change)} <br />
                                                ({changePct.toFixed(2)}%)
                                            </div>
                                        ) : '-'}
                                    </TableCell>

                                    {/* Box Formation */}
                                    <TableCell align="center">
                                        {hasData && indicators.box_formation ? (
                                            <div className="flex flex-col items-center gap-1 min-w-[50px]">
                                                {indicators.box_formation.breakout === 'up' && (
                                                    <span className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 font-bold px-1.5 py-0.5 rounded text-[10px] border border-emerald-200 dark:border-emerald-800">🚀 UP</span>
                                                )}
                                                {indicators.box_formation.breakout === 'down' && (
                                                    <span className="bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 font-bold px-1.5 py-0.5 rounded text-[10px] border border-rose-200 dark:border-rose-800">📉 DOWN</span>
                                                )}
                                                {indicators.box_formation.breakout === 'none' && indicators.box_formation.detected && (
                                                    <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-bold px-1.5 py-0.5 rounded text-[10px] border border-blue-200 dark:border-blue-800">BOX</span>
                                                )}
                                                {!indicators.box_formation.detected && indicators.box_formation.breakout === 'none' && (
                                                    <span className="text-[10px] text-gray-400">-</span>
                                                )}
                                                {indicators.box_formation.detected && (
                                                    <span className="text-[9px] text-gray-500 dark:text-gray-400 font-mono">{indicators.box_formation.containment}%</span>
                                                )}
                                            </div>
                                        ) : '-'}
                                    </TableCell>

                                    {/* D-1 through D-5 as separate columns */}
                                    {[0, 1, 2, 3, 4].map((idx) => {
                                        const dc = data?.daily_changes?.[idx];
                                        return (
                                            <TableCell key={idx} align="right">
                                                {hasData && dc?.pct != null ? (
                                                    <div className="flex flex-col items-end text-[10px] font-mono">
                                                        <span className="dark:text-gray-200">{fmt(dc.close)}</span>
                                                        <span className={dc.pct >= 0 ? 'text-green-600' : 'text-red-600'}>
                                                            {dc.pct > 0 && '+'}{dc.pct.toFixed(2)}%
                                                        </span>
                                                    </div>
                                                ) : '-'}
                                            </TableCell>
                                        );
                                    })}

                                    {/* 7D Change */}
                                    <TableCell align="right">
                                        {hasData && data?.change_7d != null ? (
                                            <div className="flex flex-col items-end text-[10px] font-mono">
                                                <span className="dark:text-gray-200">{fmt(data.close_7d)}</span>
                                                <span className={data.change_7d >= 0 ? 'text-green-600' : 'text-red-600'}>
                                                    {data.change_7d > 0 && '+'}{data.change_7d.toFixed(2)}%
                                                </span>
                                            </div>
                                        ) : '-'}
                                    </TableCell>

                                    {/* 30D Change */}
                                    <TableCell align="right">
                                        {hasData && data?.change_30d != null ? (
                                            <div className="flex flex-col items-end text-[10px] font-mono">
                                                <span className="dark:text-gray-200">{fmt(data.close_30d)}</span>
                                                <span className={data.change_30d >= 0 ? 'text-green-600' : 'text-red-600'}>
                                                    {data.change_30d > 0 && '+'}{data.change_30d.toFixed(2)}%
                                                </span>
                                            </div>
                                        ) : '-'}
                                    </TableCell>



                                    {/* Separate Columns */}
                                    <TableCell align="right" className={`font-bold ${indicators.rsi > 70 ? 'text-red-500' : indicators.rsi < 30 ? 'text-green-500' : 'dark:text-gray-200'}`}>
                                        {hasData ? fmt(indicators.rsi) : '-'}
                                    </TableCell>
                                    <TableCell align="right" className="font-mono dark:text-gray-300">
                                        {hasData ? fmt(indicators.adx) : '-'}
                                    </TableCell>
                                    <TableCell align="right" className="font-mono dark:text-gray-300">
                                        {hasData ? (
                                            <div className="flex flex-col items-end text-[10px]">
                                                <span>{fmt(indicators.sma_50)}</span>
                                                <span className={ltp > indicators.sma_50 ? "text-green-500" : "text-red-500"}>
                                                    {indicators.sma_50 ? `${((ltp - indicators.sma_50) / indicators.sma_50 * 100).toFixed(2)}%` : '-'}
                                                </span>
                                            </div>
                                        ) : '-'}
                                    </TableCell>
                                    <TableCell align="right" className="font-mono dark:text-gray-300">
                                        {hasData ? (
                                            <div className="flex flex-col items-end text-[10px]">
                                                <span>{fmt(indicators.sma_200)}</span>
                                                <span className={ltp > indicators.sma_200 ? "text-green-500" : "text-red-500"}>
                                                    {indicators.sma_200 ? `${((ltp - indicators.sma_200) / indicators.sma_200 * 100).toFixed(2)}%` : '-'}
                                                </span>
                                            </div>
                                        ) : '-'}
                                    </TableCell>

                                    {/* Stoch */}
                                    <TableCell align="right">
                                        {hasData ? (
                                            <div className="flex flex-col text-[10px]">
                                                <span className="text-blue-500">K: {fmt(indicators.stoch_k)}</span>
                                                <span className="text-orange-500">D: {fmt(indicators.stoch_d)}</span>
                                            </div>
                                        ) : '-'}
                                    </TableCell>

                                    {/* DMI */}
                                    <TableCell align="right">
                                        {hasData ? (
                                            <div className="flex flex-col text-[10px]">
                                                <span className="text-green-500">+DI: {fmt(indicators.dmp)}</span>
                                                <span className="text-red-500">-DI: {fmt(indicators.dmn)}</span>
                                            </div>
                                        ) : '-'}
                                    </TableCell>

                                    {/* MACD */}
                                    <TableCell align="right">
                                        {hasData ? (
                                            <div className="flex flex-col text-[10px] items-end">
                                                <span className="text-gray-500 dark:text-gray-400">M: {fmt(indicators.macd)}</span>
                                                <span className="text-gray-500 dark:text-gray-400">S: {fmt(indicators.macd_signal)}</span>
                                                <span className={`font-bold ${indicators.macd_hist >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                    H: {fmt(indicators.macd_hist)}
                                                </span>
                                            </div>
                                        ) : '-'}
                                    </TableCell>

                                    {/* Bollinger */}
                                    <TableCell align="right">
                                        {hasData ? (
                                            <div className="flex flex-col gap-0.5 items-end text-[10px]">
                                                <span className="text-gray-400">U: <span className="text-gray-600 dark:text-gray-300">{fmt(indicators.bb_upper)}</span></span>
                                                <span className="text-gray-400">M: <span className="text-gray-600 dark:text-gray-300">{fmt(indicators.bb_middle)}</span></span>
                                                <span className="text-gray-400">L: <span className="text-gray-600 dark:text-gray-300">{fmt(indicators.bb_lower)}</span></span>
                                            </div>
                                        ) : '-'}
                                    </TableCell>

                                    {/* Pivots */}
                                    {/* Pivots Split */}
                                    {[
                                        { key: 's1', label: 'S1', color: 'text-green-500' },
                                        { key: 'r1', label: 'R1', color: 'text-red-500' },
                                        { key: 's2', label: 'S2', color: 'text-green-600' },
                                        { key: 'r2', label: 'R2', color: 'text-red-600' }
                                    ].map(({ key, color }) => {
                                        const val = pp[key];
                                        const diff = val && ltp ? ((ltp - val) / val) * 100 : null;
                                        return (
                                            <TableCell key={key} align="right">
                                                {hasData && val ? (
                                                    <div className="flex flex-col items-end text-[10px]">
                                                        <span className={`${color} font-bold`}>{fmt(val)}</span>
                                                        <span className={diff && diff > 0 ? "text-green-400" : "text-red-400"}>
                                                            {diff ? `${diff > 0 ? '+' : ''}${diff.toFixed(2)}%` : '-'}
                                                        </span>
                                                    </div>
                                                ) : '-'}
                                            </TableCell>
                                        );
                                    })}

                                </TableRow>
                            );
                        })}
                        {processedInstruments.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={23} align="center" className="py-8 text-gray-500">
                                    <div className="flex flex-col items-center gap-4">
                                        <Typography variant="body2">No instruments found.</Typography>
                                        {instruments.length === 0 && (
                                            <Button
                                                variant="outlined"
                                                startIcon={<Database size={16} />}
                                                onClick={handlePopulate}
                                            >
                                                Populate Nifty 50
                                            </Button>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </div >
    );
}
