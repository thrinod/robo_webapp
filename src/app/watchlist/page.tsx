"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    Paper, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, IconButton, Typography, CircularProgress,
    FormControl, InputLabel, Select as MuiSelect, MenuItem, Box, LinearProgress,
    TableSortLabel, Tabs, Tab, Autocomplete, TextField, Button, Tooltip,
    Checkbox
} from '@mui/material';
import {
    getWatchlist, addToWatchlist, removeFromWatchlist, getScannerData,
    searchInstruments, getUpstoxStatus, getInstrumentTypes
} from '@/services/api';
import {
    Trash2, RefreshCw, StopCircle, Eye, Search, Plus,
    ExternalLink, Activity, Info, Clock
} from 'lucide-react';
import { Input } from "@/components/ui/input";

// Types
interface WatchlistItem {
    instrument_key: string;
    trading_symbol?: string;
    name?: string;
    added_at?: string;
    watchlist_id: number;
}

interface ScannerData {
    [key: string]: any;
}

type SortKey = 'name' | 'ltp' | 'change' | 'change_7d' | 'change_30d' | 'rsi' | 'adx' | 'stoch_k' | 'stoch_d' | 'dmp' | 'dmn' | 'macd_hist' | 'bb_upper' | 'bb_middle' | 'bb_lower' | 'sma_50' | 'sma_200' | 's1' | 'r1' | 's2' | 'r2';

export default function WatchlistPage() {
    // Watchlist State
    const [activeTab, setActiveTab] = useState(0); // 0-4 mapping to watchlist_id 1-5
    const [items, setItems] = useState<WatchlistItem[]>([]);
    const [scannerData, setScannerData] = useState<ScannerData>({});

    // UI State
    const [isLoading, setIsLoading] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [interval, setInterval] = useState("day");
    const [dataSource, setDataSource] = useState("combined");
    const [searchTerm, setSearchTerm] = useState("");

    // Search State
    const [searchOptions, setSearchOptions] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearching, setIsSearching] = useState(false);
    const [instrumentTypes, setInstrumentTypes] = useState<string[]>([]);
    const [selectedType, setSelectedType] = useState<string>("ALL");

    const processRef = useRef(false);
    const watchlistId = activeTab + 1;

    // Sorting State
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({
        key: 'name',
        direction: 'asc'
    });

    // Auto Refresh
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [refreshInterval, setRefreshInterval] = useState(10); // Default to 10 seconds
    const autoRefreshRef = useRef<any>(null);

    // Initial Load & Tab Change
    useEffect(() => {
        loadWatchlist();
        fetchInstrumentTypes();
    }, [activeTab]);

    const loadWatchlist = async () => {
        setIsLoading(true);
        const data = await getWatchlist(watchlistId);
        setItems(data);
        setIsLoading(false);
    };

    const fetchInstrumentTypes = async () => {
        const types = await getInstrumentTypes();
        setInstrumentTypes(types);
    };

    // Instrument Search
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchQuery.length >= 2 || selectedType !== "ALL") {
                setIsSearching(true);
                const filters: any = {};
                if (selectedType !== "ALL") filters.instrument_type = selectedType;

                const results = await searchInstruments(searchQuery, filters);
                setSearchOptions(results || []);
                setIsSearching(false);
            } else {
                setSearchOptions([]);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery, selectedType]);

    const handleAddInstrument = async (instrument: any) => {
        if (!instrument) return;
        setIsLoading(true);
        try {
            const res = await addToWatchlist(instrument.instrument_key, watchlistId);
            if (res.status === "success") {
                await loadWatchlist();
            } else {
                console.error("Failed to add instrument:", res.message);
            }
        } catch (error: any) {
            console.error("Watchlist Update Error:", error);
            console.error(error.message || "Weightage update failed");
        }
        setIsLoading(false);
    };

    const handleDelete = async (key: string) => {
        if (!confirm("Remove from watchlist?")) return;
        setIsLoading(true);
        await removeFromWatchlist(key, watchlistId);
        await loadWatchlist();
        setIsLoading(false);
    };

    // Scan Logic (Replicated from Scanner)
    const handleStartScan = async (batchSize = 5, force = false) => {
        if (items.length === 0) return;

        setIsProcessing(true);
        processRef.current = true;

        const allKeys = items.map(i => i.instrument_key);
        const total = allKeys.length;
        setProgress({ current: 0, total });

        for (let i = 0; i < total; i += batchSize) {
            if (!processRef.current) break;
            const batch = allKeys.slice(i, i + batchSize);
            await fetchBatch(batch, force);
            setProgress({ current: Math.min(i + batchSize, total), total });
            await new Promise(r => setTimeout(r, 100));
        }

        setIsProcessing(false);
        processRef.current = false;
        setLastUpdated(new Date());
    };

    const fetchBatch = async (keys: string[], force = false) => {
        const dataList = await getScannerData(keys, interval, dataSource, force);
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

    const handleStopScan = () => {
        processRef.current = false;
        setIsProcessing(false);
    };

    // Auto Refresh Effect
    useEffect(() => {
        if (autoRefresh) {
            const ms = Math.max(refreshInterval, 5) * 1000;
            const intervalId = window.setInterval(() => {
                if (!processRef.current && !isProcessing) {
                    handleStartScan(5, false);
                }
            }, ms);
            autoRefreshRef.current = intervalId;
        } else {
            if (autoRefreshRef.current) {
                clearInterval(autoRefreshRef.current);
                autoRefreshRef.current = null;
            }
        }
        return () => { if (autoRefreshRef.current) clearInterval(autoRefreshRef.current); };
    }, [autoRefresh, isProcessing, refreshInterval, items, interval, dataSource]);

    // Sorting & Formatting
    const handleRequestSort = (property: SortKey) => {
        const isAsc = sortConfig.key === property && sortConfig.direction === 'asc';
        setSortConfig({ key: property, direction: isAsc ? 'desc' : 'asc' });
    };

    const processedInstruments = useMemo(() => {
        let result = items.filter(i => {
            const term = searchTerm.toLowerCase();
            const name = (i.name || i.instrument_key || "").toLowerCase();
            const symbol = (i.trading_symbol || "").toLowerCase();
            return name.includes(term) || symbol.includes(term);
        });

        result.sort((a, b) => {
            const key = sortConfig.key;
            const dir = sortConfig.direction === 'asc' ? 1 : -1;

            const getVal = (inst: any, k: SortKey) => {
                if (k === 'name') return (inst.name || inst.trading_symbol || "").toLowerCase();
                const data = scannerData[inst.instrument_key];
                if (!data) return -999999999;
                if (k === 'ltp') return data[k] ?? -999999;
                if (k === 'change') {
                    const change = data.change;
                    const prev = data.prev_close > 0 ? data.prev_close : (data.ltp - change);
                    return prev === 0 ? 0 : (change / prev) * 100;
                }
                if (k === 'change_7d' || k === 'change_30d') return data[k] ?? -999999;

                const inds = data.indicators || {};
                const pp = inds.pivot_points || {};
                if (['s1', 'r1', 's2', 'r2', 'sma_50', 'sma_200'].includes(k)) {
                    const ltp = data.ltp;
                    let level = ['s1', 'r1', 's2', 'r2'].includes(k) ? pp[k] : inds[k];
                    return (level && ltp) ? (ltp - level) / level : -999999;
                }
                if (['bb_upper', 'bb_middle', 'bb_lower'].includes(k)) {
                    const ltp = data.ltp;
                    return (inds[k] && ltp) ? (ltp - inds[k]) / inds[k] : -999999;
                }
                return inds[k] ?? -999999;
            };

            const valA = getVal(a, key);
            const valB = getVal(b, key);
            return valA < valB ? -1 * dir : valA > valB ? 1 * dir : 0;
        });
        return result;
    }, [items, searchTerm, scannerData, sortConfig]);

    const fmt = (n: number) => n?.toFixed(2) ?? "-";

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
            {/* Multi-Watchlist Tabs */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                <Tabs value={activeTab} onChange={(e, n) => setActiveTab(n)} variant="scrollable" scrollButtons="auto">
                    {[1, 2, 3, 4, 5].map(id => (
                        <Tab key={id} label={`Watchlist ${id}`} />
                    ))}
                </Tabs>
            </Box>

            {/* Toolbar */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-bold dark:text-gray-100 flex items-center gap-2">
                        Watchlist {watchlistId}
                        <Tooltip title="Rich watchlist with indicator processing.">
                            <Info className="w-4 h-4 text-gray-400 cursor-help" />
                        </Tooltip>
                    </h1>
                    <p className="text-xs text-gray-500">
                        Items: {items.length} | Refresh: {lastUpdated?.toLocaleTimeString() || 'Never'}
                    </p>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
                    {/* Search & Add */}
                    <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-1.5 rounded-lg border dark:border-gray-700">
                        <FormControl size="small" sx={{ width: 130 }}>
                            <InputLabel>Type</InputLabel>
                            <MuiSelect
                                value={selectedType}
                                label="Type"
                                onChange={(e) => setSelectedType(e.target.value)}
                            >
                                <MenuItem value="ALL">ALL Types</MenuItem>
                                {instrumentTypes.map(t => (
                                    <MenuItem key={t} value={t}>{t}</MenuItem>
                                ))}
                            </MuiSelect>
                        </FormControl>

                        <Autocomplete
                            size="small"
                            sx={{ width: 220 }}
                            options={searchOptions}
                            getOptionLabel={(o) => `${o.trading_symbol} - ${o.name}`}
                            filterOptions={(x) => x}
                            onInputChange={(e, val) => setSearchQuery(val)}
                            onChange={(e, val) => handleAddInstrument(val)}
                            loading={isSearching}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label="Search & Add"
                                    placeholder="Symbol or Name..."
                                    InputProps={{
                                        ...params.InputProps,
                                        endAdornment: (
                                            <React.Fragment>
                                                {isSearching ? <CircularProgress color="inherit" size={20} /> : null}
                                                {params.InputProps.endAdornment}
                                            </React.Fragment>
                                        ),
                                    }}
                                />
                            )}
                            renderOption={(props, option) => (
                                <li {...props} key={option.instrument_key}>
                                    <div className="flex flex-col">
                                        <div className="flex items-center justify-between gap-2 w-full">
                                            <span className="font-bold">{option.trading_symbol}</span>
                                            <span className="text-[10px] bg-blue-100 text-blue-800 px-1 rounded">{option.instrument_type}</span>
                                        </div>
                                        <span className="text-xs text-gray-500">{option.name}</span>
                                    </div>
                                </li>
                            )}
                        />
                    </div>

                    {/* Controls */}
                    <FormControl size="small" className="min-w-[100px]">
                        <InputLabel>Interval</InputLabel>
                        <MuiSelect value={interval} label="Interval" onChange={(e) => setInterval(e.target.value)}>
                            <MenuItem value="1minute">1 Min</MenuItem>
                            <MenuItem value="5minute">5 Min</MenuItem>
                            <MenuItem value="15minute">15 Min</MenuItem>
                            <MenuItem value="day">Day</MenuItem>
                        </MuiSelect>
                    </FormControl>

                    <div className="flex items-center gap-2">
                        {isProcessing ? (
                            <div className="flex items-center gap-2 bg-blue-100 dark:bg-blue-900 px-3 py-1.5 rounded-md">
                                <CircularProgress size={16} />
                                <span className="text-xs font-mono">{progress.current}/{progress.total}</span>
                                <IconButton size="small" color="error" onClick={handleStopScan}><StopCircle size={16} /></IconButton>
                            </div>
                        ) : (
                            <Button
                                variant="contained"
                                color="primary"
                                startIcon={<Activity size={16} />}
                                onClick={() => handleStartScan(5, true)}
                                disabled={items.length === 0}
                            >
                                Scan
                            </Button>
                        )}

                        <div className="flex items-center gap-1 bg-gray-200 dark:bg-gray-800 px-2 py-1.5 rounded-md border dark:border-gray-700">
                            <Clock size={16} className="text-gray-500" />
                            <Tooltip title="Polling Interval (seconds). Min 5s.">
                                <Input
                                    type="number"
                                    className="w-14 h-8 text-xs p-1"
                                    value={refreshInterval}
                                    min={5}
                                    onChange={(e) => setRefreshInterval(parseInt(e.target.value) || 5)}
                                />
                            </Tooltip>
                            <Checkbox
                                size="small"
                                checked={autoRefresh}
                                onChange={(e) => setAutoRefresh(e.target.checked)}
                            />
                        </div>

                        <IconButton onClick={loadWatchlist}><RefreshCw size={18} className={isLoading ? "animate-spin" : ""} /></IconButton>
                    </div>
                </div>
            </div>

            {/* Table (Replicated Scanner Structure) */}
            <TableContainer component={Paper} className="shadow-md rounded-lg overflow-hidden dark:bg-gray-800">
                <Table size="small" stickyHeader>
                    <TableHead>
                        <TableRow>
                            <SortHeader id="name" label="Instrument" align="left" />
                            <SortHeader id="ltp" label="LTP" />
                            <SortHeader id="change" label="Chg %" />
                            <TableCell align="right" className="font-bold dark:bg-gray-700 dark:text-gray-200" style={{ minWidth: 55 }}>D-1</TableCell>
                            <TableCell align="right" className="font-bold dark:bg-gray-700 dark:text-gray-200" style={{ minWidth: 55 }}>D-2</TableCell>
                            <TableCell align="right" className="font-bold dark:bg-gray-700 dark:text-gray-200" style={{ minWidth: 55 }}>D-3</TableCell>
                            <TableCell align="right" className="font-bold dark:bg-gray-700 dark:text-gray-200" style={{ minWidth: 55 }}>D-4</TableCell>
                            <TableCell align="right" className="font-bold dark:bg-gray-700 dark:text-gray-200" style={{ minWidth: 55 }}>D-5</TableCell>
                            <SortHeader id="change_7d" label="7D" />
                            <SortHeader id="change_30d" label="30D" />
                            <SortHeader id="rsi" label="RSI" />
                            <SortHeader id="adx" label="ADX" />
                            <SortHeader id="sma_50" label="SMA 50" />
                            <SortHeader id="sma_200" label="SMA 200" />
                            <SortHeader id="stoch_k" label="Stoch" />
                            <SortHeader id="dmp" label="DMI" />
                            <SortHeader id="macd_hist" label="MACD" />
                            <TableCell align="right" className="font-bold dark:bg-gray-700 dark:text-gray-200">Bollinger</TableCell>
                            <SortHeader id="s1" label="S1" />
                            <SortHeader id="r1" label="R1" />
                            <SortHeader id="s2" label="S2" />
                            <SortHeader id="r2" label="R2" />
                            <TableCell align="center" className="font-bold dark:bg-gray-700 p-2">Del</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {processedInstruments.map((item) => {
                            const data = scannerData[item.instrument_key];
                            const indicators = data?.indicators || {};
                            const ltp = data?.ltp || 0;
                            const change = data?.change || 0;
                            const prev_close = data?.prev_close || 0;
                            const changePct = prev_close > 0 ? (change / prev_close) * 100 : (ltp ? (change / (ltp - change)) * 100 : 0);
                            const pp = indicators.pivot_points || {};
                            const hasData = !!data;

                            return (
                                <TableRow key={item.instrument_key} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium dark:text-gray-100">{item.name || item.trading_symbol || item.instrument_key}</span>
                                                {item.trading_symbol && (
                                                    <a
                                                        href={`https://www.screener.in/company/${item.trading_symbol.replace(/-EQ$/i, '')}/`}
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
                                            <span className="text-[10px] text-gray-400">{item.instrument_key.split('|')[0]}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell align="right" className="font-mono dark:text-gray-200">{hasData ? fmt(ltp) : '-'}</TableCell>
                                    <TableCell align="right">
                                        {hasData ? (
                                            <div className={`text-xs ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {changePct.toFixed(2)}%
                                            </div>
                                        ) : '-'}
                                    </TableCell>
                                    {/* D-1 through D-5 */}
                                    {[0, 1, 2, 3, 4].map(idx => (
                                        <TableCell key={idx} align="right">
                                            {hasData && data?.daily_changes?.[idx]?.pct != null ? (
                                                <div className="flex flex-col items-end text-[10px] font-mono">
                                                    <span className="dark:text-gray-200">{fmt(data.daily_changes[idx].close)}</span>
                                                    <span className={data.daily_changes[idx].pct >= 0 ? 'text-green-600' : 'text-red-600'}>
                                                        {data.daily_changes[idx].pct.toFixed(2)}%
                                                    </span>
                                                </div>
                                            ) : '-'}
                                        </TableCell>
                                    ))}
                                    <TableCell align="right">
                                        {hasData && data?.change_7d != null ? (
                                            <div className="flex flex-col items-end text-[10px] font-mono">
                                                <span className="dark:text-gray-200">{fmt(data.close_7d)}</span>
                                                <span className={data.change_7d >= 0 ? 'text-green-600' : 'text-red-600'}>
                                                    {data.change_7d.toFixed(2)}%
                                                </span>
                                            </div>
                                        ) : '-'}
                                    </TableCell>
                                    <TableCell align="right">
                                        {hasData && data?.change_30d != null ? (
                                            <div className="flex flex-col items-end text-[10px] font-mono">
                                                <span className="dark:text-gray-200">{fmt(data.close_30d)}</span>
                                                <span className={data.change_30d >= 0 ? 'text-green-600' : 'text-red-600'}>
                                                    {data.change_30d.toFixed(2)}%
                                                </span>
                                            </div>
                                        ) : '-'}
                                    </TableCell>

                                    <TableCell align="right" className={`font-bold ${indicators.rsi > 70 ? 'text-red-500' : indicators.rsi < 30 ? 'text-green-500' : 'dark:text-gray-200'}`}>
                                        {hasData ? fmt(indicators.rsi) : '-'}
                                    </TableCell>
                                    <TableCell align="right" className="font-mono dark:text-gray-300">{hasData ? fmt(indicators.adx) : '-'}</TableCell>

                                    <TableCell align="right" className="font-mono dark:text-gray-300">
                                        {hasData ? (
                                            <div className="flex flex-col items-end text-[10px]">
                                                <span>{fmt(indicators.sma_50)}</span>
                                                <span className={ltp > indicators.sma_50 ? "text-green-500" : "text-red-500"}>
                                                    {indicators.sma_50 ? `${((ltp - indicators.sma_50) / indicators.sma_50 * 100).toFixed(1)}%` : '-'}
                                                </span>
                                            </div>
                                        ) : '-'}
                                    </TableCell>
                                    <TableCell align="right" className="font-mono dark:text-gray-300">
                                        {hasData ? (
                                            <div className="flex flex-col items-end text-[10px]">
                                                <span>{fmt(indicators.sma_200)}</span>
                                                <span className={ltp > indicators.sma_200 ? "text-green-500" : "text-red-500"}>
                                                    {indicators.sma_200 ? `${((ltp - indicators.sma_200) / indicators.sma_200 * 100).toFixed(1)}%` : '-'}
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

                                    <TableCell align="center">
                                        <IconButton size="small" color="error" onClick={() => handleDelete(item.instrument_key)}>
                                            <Trash2 size={14} />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
        </div>
    );
}
