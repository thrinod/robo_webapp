"use client";

import React, { useEffect, useState, useRef } from "react";
import { getHistory, getIntradayHistory } from "@/services/api";
import {
    Button, Select, MenuItem, FormControl, InputLabel,
    Switch, FormControlLabel, Typography, Paper, TextField, ToggleButton, ToggleButtonGroup
} from "@mui/material";
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    ReferenceLine, AreaChart, Area, ComposedChart, Bar, BarChart
} from "recharts";
import { RefreshCw } from "lucide-react";

const INSTRUMENTS = [
    { label: 'NIFTY 50', value: 'NSE_INDEX|Nifty 50' },
    { label: 'BANKNIFTY', value: 'NSE_INDEX|Nifty Bank' },
    { label: 'FINNIFTY', value: 'NSE_INDEX|Nifty Fin Service' },
    { label: 'MIDCPNIFTY', value: 'NSE_INDEX|NIFTY MID SELECT' },
    { label: 'SENSEX', value: 'BSE_INDEX|SENSEX' },
    { label: 'BANKEX', value: 'BSE_INDEX|BANKEX' },
];

const INTERVALS = [
    { label: '1m', value: '1minute' },
    { label: '3m', value: '3minute' },
    { label: '5m', value: '5minute' },
    { label: '15m', value: '15minute' },
    { label: '30m', value: '30minute' },
    { label: '1H', value: '60minute' },
    { label: '1D', value: 'day' }
];

export default function Charts() {
    const [instrument, setInstrument] = useState(INSTRUMENTS[0].value);
    const [chartInterval, setChartInterval] = useState("1minute");
    const [apiType, setApiType] = useState<"history" | "intraday">("history");
    const [data, setData] = useState<any>(null);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchChartData();
    }, [instrument, chartInterval, apiType]);

    useEffect(() => {
        let timer: any;
        if (autoRefresh) {
            timer = window.setInterval(() => fetchChartData(true), 5000);
        }
        return () => clearInterval(timer);
    }, [autoRefresh, instrument, chartInterval, apiType]);

    const fetchChartData = async (silent = false) => {
        if (!silent) setLoading(true);
        let d = null;
        if (apiType === 'intraday') {
            d = await getIntradayHistory(instrument, chartInterval);
        } else {
            d = await getHistory(instrument, chartInterval);
        }
        setData(d);
        if (!silent) setLoading(false);
    };

    if (!data && loading) return <div className="p-10 text-center">Loading Charts...</div>;
    if (!data) return <div className="p-10 text-center">No Data</div>;

    const candles = data.candles || [];
    const indicators = data.indicators || {};
    const series = data.indicators_series || {};

    // Format Data for Recharts
    const chartData = candles.map((c: any, i: number) => {
        const d = new Date(c.timestamp);
        let label = '';
        if (chartInterval === 'day' && apiType === 'history') {
            label = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
        } else {
            label = `${d.getDate()}/${d.getMonth() + 1} ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })}`;
        }

        return {
            time: label,
            original_ts: c.timestamp,
            price: parseFloat(c.close),
            open: parseFloat(c.open),
            high: parseFloat(c.high),
            low: parseFloat(c.low),
            close: parseFloat(c.close),
            // Indicators
            stoch_k: series.stoch_k?.[i],
            stoch_d: series.stoch_d?.[i],
            macd: series.macd?.[i],
            signal: series.macd_signal?.[i],
            hist: series.macd_hist?.[i],
            dmp: series.dmp?.[i],
            dmn: series.dmn?.[i],
            // Bollinger Bands
            bb_upper: series.bb_upper?.[i],
            bb_middle: series.bb_middle?.[i],
            bb_lower: series.bb_lower?.[i],
        };
    }).slice(-100);

    const handlePresetChange = (val: string) => {
        setInstrument(val);
    };

    const pivots = indicators.pivot_points;

    // Calculate domain for Y-Axis
    const validLows = chartData.map((d: any) => d.low).filter((v: number) => v && v > 0);
    const validHighs = chartData.map((d: any) => d.high).filter((v: number) => v && v > 0);

    const minPrice = validLows.length > 0 ? Math.min(...validLows) : 0;
    const maxPrice = validHighs.length > 0 ? Math.max(...validHighs) : 100;
    const padding = (maxPrice - minPrice) * 0.05;

    return (
        <div className="space-y-6 pb-20">
            {/* Controls */}
            <div className="flex flex-wrap items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded shadow-sm sticky top-0 z-20 transition-colors duration-200">
                <h1 className="text-2xl font-bold mr-4 dark:text-white">Charts</h1>

                <FormControl size="small" className="min-w-[150px]">
                    <InputLabel className="dark:text-gray-400">Quick Select</InputLabel>
                    <Select label="Quick Select" onChange={(e) => handlePresetChange(e.target.value as string)} value={INSTRUMENTS.find(i => i.value === instrument) ? instrument : ''} className="dark:text-white">
                        {INSTRUMENTS.map(i => <MenuItem key={i.value} value={i.value}>{i.label}</MenuItem>)}
                    </Select>
                </FormControl>

                <TextField
                    size="small"
                    label="Instrument Key"
                    value={instrument}
                    onChange={(e) => setInstrument(e.target.value)}
                    className="min-w-[200px]"
                    InputLabelProps={{ className: "dark:text-gray-400" }}
                    InputProps={{ className: "dark:text-white" }}
                />

                <FormControl size="small" className="min-w-[100px]">
                    <InputLabel className="dark:text-gray-400">Interval</InputLabel>
                    <Select value={chartInterval} label="Interval" onChange={(e) => setChartInterval(e.target.value)} className="dark:text-white">
                        {INTERVALS.map(i => <MenuItem key={i.value} value={i.value}>{i.label}</MenuItem>)}
                    </Select>
                </FormControl>

                <div className="flex items-center gap-2 border-l border-gray-300 dark:border-gray-700 pl-4">
                    <FormControlLabel
                        control={<Switch checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />}
                        label={<span className="dark:text-gray-200">Auto</span>}
                    />
                    <Button variant="outlined" startIcon={<RefreshCw />} onClick={() => fetchChartData()} className="dark:text-gray-200 dark:border-gray-600">
                        Refresh
                    </Button>
                </div>

                <ToggleButtonGroup
                    value={apiType}
                    exclusive
                    onChange={(e, val) => { if (val) setApiType(val); }}
                    size="small"
                    className="ml-4"
                >
                    <ToggleButton value="history" className="dark:text-white dark:border-gray-600">
                        History
                    </ToggleButton>
                    <ToggleButton value="intraday" className="dark:text-white dark:border-gray-600">
                        Intraday
                    </ToggleButton>
                </ToggleButtonGroup>

                {data.ltp && (
                    <div className="ml-auto text-right">
                        <div className="text-2xl font-bold dark:text-white">{data.ltp}</div>
                        <div className={data.change >= 0 ? "text-green-600 dark:text-green-400 font-bold" : "text-red-600 dark:text-red-400 font-bold"}>
                            {data.change > 0 ? '+' : ''}{data.change}
                        </div>
                    </div>
                )}
            </div>

            {/* Key Stats Summary */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
                <Paper className="p-3 bg-purple-50 border border-purple-100 dark:bg-purple-900/20 dark:border-purple-800 flex flex-col items-center">
                    <Typography variant="caption" className="text-purple-800 dark:text-purple-300 font-bold">RSI (14)</Typography>
                    <Typography variant="h6" className="font-bold text-gray-800 dark:text-gray-200">
                        {typeof indicators.rsi === 'number' ? indicators.rsi.toFixed(2) : 'N/A'}
                    </Typography>
                </Paper>
                <Paper className="p-3 bg-blue-50 border border-blue-100 dark:bg-blue-900/20 dark:border-blue-800 flex flex-col items-center">
                    <Typography variant="caption" className="text-blue-800 dark:text-blue-300 font-bold">SMA 50</Typography>
                    <Typography variant="h6" className="font-bold text-gray-800 dark:text-gray-200">
                        {typeof indicators.sma_50 === 'number' ? indicators.sma_50.toFixed(2) : 'N/A'}
                    </Typography>
                </Paper>
                <Paper className="p-3 bg-indigo-50 border border-indigo-100 dark:bg-indigo-900/20 dark:border-indigo-800 flex flex-col items-center">
                    <Typography variant="caption" className="text-indigo-800 dark:text-indigo-300 font-bold">SMA 200</Typography>
                    <Typography variant="h6" className="font-bold text-gray-800 dark:text-gray-200">
                        {typeof indicators.sma_200 === 'number' ? indicators.sma_200.toFixed(2) : 'N/A'}
                    </Typography>
                </Paper>
                <Paper className="p-3 bg-gray-50 border border-gray-200 dark:bg-gray-800 dark:border-gray-700 flex flex-col items-center">
                    <Typography variant="caption" className="text-gray-800 dark:text-gray-400 font-bold">ADX (14)</Typography>
                    <Typography variant="h6" className="font-bold text-gray-800 dark:text-gray-200">
                        {typeof indicators.adx === 'number' ? indicators.adx.toFixed(2) : 'N/A'}
                    </Typography>
                </Paper>
                {/* Pivot Points Card */}
                <Paper className="p-3 bg-amber-50 border border-amber-100 dark:bg-amber-900/20 dark:border-amber-800 flex flex-col items-center justify-center">
                    <Typography variant="caption" className="text-amber-800 dark:text-amber-300 font-bold mb-1">Standard Pivots</Typography>
                    {pivots ? (
                        <div className="text-[10px] text-center w-full grid grid-cols-2 gap-x-2">
                            <div className="text-red-800 font-bold">R3: {pivots.r3}</div>
                            <div className="text-green-800 font-bold">S3: {pivots.s3}</div>
                            <div className="text-red-700">R2: {pivots.r2}</div>
                            <div className="text-green-700">S2: {pivots.s2}</div>
                            <div className="text-red-500">R1: {pivots.r1}</div>
                            <div className="text-green-500">S1: {pivots.s1}</div>
                            <div className="col-span-2 text-gray-600 dark:text-gray-400 font-bold border-t border-amber-200 mt-0.5 pt-0.5">P: {pivots.pivot}</div>
                        </div>
                    ) : <span className="text-xs text-gray-400">N/A</span>}
                </Paper>
            </div>

            {/* Price Chart */}
            <Paper className="p-4 h-[400px]">
                <Typography variant="h6" className="mb-2 font-bold text-gray-700">Price Action & Bollinger Bands</Typography>
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="time" />
                        <YAxis domain={[Math.floor(minPrice - padding), Math.ceil(maxPrice + padding)]} />
                        <Tooltip content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                                const d = payload[0].payload;
                                return (
                                    <div className="bg-white p-2 border border-gray-300 rounded shadow text-sm">
                                        <p className="font-bold">{d.time}</p>
                                        <p>Open: {d.open} | High: {d.high} | Low: {d.low} | Close: {d.close}</p>
                                        <hr className="my-1" />
                                        <p className="text-blue-500">Upper BB: {d.bb_upper?.toFixed(2)}</p>
                                        <p className="text-gray-500">Mid BB: {d.bb_middle?.toFixed(2)}</p>
                                        <p className="text-blue-500">Lower BB: {d.bb_lower?.toFixed(2)}</p>
                                    </div>
                                );
                            }
                            return null;
                        }} />
                        {/* invisible lines for domain calculation */}
                        <Line dataKey="high" stroke="none" dot={false} />
                        <Line dataKey="low" stroke="none" dot={false} />

                        {/* Bollinger Bands */}
                        <Line dataKey="bb_upper" stroke="#60a5fa" dot={false} strokeWidth={1} />
                        <Line dataKey="bb_middle" stroke="#9ca3af" dot={false} strokeWidth={1} strokeDasharray="3 3" />
                        <Line dataKey="bb_lower" stroke="#60a5fa" dot={false} strokeWidth={1} />

                        {/* Pivot Points Reference Lines */}
                        {pivots && (
                            <>
                                <ReferenceLine y={pivots.pivot} stroke="#fbbf24" strokeDasharray="3 3" label={{ value: 'P', position: 'right', fill: '#fbbf24', fontSize: 10 }} />
                                <ReferenceLine y={pivots.r1} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'R1', position: 'right', fill: '#ef4444', fontSize: 10 }} />
                                <ReferenceLine y={pivots.s1} stroke="#22c55e" strokeDasharray="3 3" label={{ value: 'S1', position: 'right', fill: '#22c55e', fontSize: 10 }} />
                                <ReferenceLine y={pivots.r2} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'R2', position: 'right', fill: '#ef4444', fontSize: 10 }} />
                                <ReferenceLine y={pivots.s2} stroke="#22c55e" strokeDasharray="3 3" label={{ value: 'S2', position: 'right', fill: '#22c55e', fontSize: 10 }} />
                                <ReferenceLine y={pivots.r3} stroke="#991b1b" strokeDasharray="3 3" label={{ value: 'R3', position: 'right', fill: '#991b1b', fontSize: 10 }} />
                                <ReferenceLine y={pivots.s3} stroke="#166534" strokeDasharray="3 3" label={{ value: 'S3', position: 'right', fill: '#166534', fontSize: 10 }} />
                            </>
                        )}

                        {/* Candlestick Construction using ReferenceLine */}
                        {chartData.map((entry: any, index: number) => {
                            const isUp = entry.close >= entry.open;
                            const color = isUp ? "#22c55e" : "#ef4444";
                            return (
                                <React.Fragment key={index}>
                                    {/* Wick */}
                                    <ReferenceLine segment={[{ x: entry.time, y: entry.high }, { x: entry.time, y: entry.low }]} stroke={color} />
                                    {/* Body */}
                                    <ReferenceLine segment={[{ x: entry.time, y: entry.open }, { x: entry.time, y: entry.close }]} stroke={color} strokeWidth={8} />
                                </React.Fragment>
                            );
                        })}
                    </ComposedChart>
                </ResponsiveContainer>
            </Paper>

            {/* Indicators Grid */}
            <div className="grid grid-cols-1 gap-6">
                {/* 1. Stoch RSI */}
                <Paper className="p-4 h-[400px] bg-white dark:bg-gray-800 dark:border-gray-700">
                    <div className="flex justify-between items-center mb-2">
                        <Typography variant="subtitle2" className="font-bold dark:text-gray-200">Stoch RSI</Typography>
                        <div className="flex gap-2 text-xs font-bold">
                            <span className="text-blue-600 dark:text-blue-400">K: {indicators.stoch_k?.toFixed(2)}</span>
                            <span className="text-orange-500">D: {indicators.stoch_d?.toFixed(2)}</span>
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height="85%">
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.3} stroke="#888" />
                            <XAxis dataKey="time" hide />
                            <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#888' }} />
                            <Tooltip contentStyle={{ fontSize: '12px' }} />
                            <ReferenceLine y={80} stroke="#ef4444" strokeDasharray="3 3" />
                            <ReferenceLine y={20} stroke="#22c55e" strokeDasharray="3 3" />
                            <Line type="monotone" dataKey="stoch_k" stroke="#2563eb" dot={false} strokeWidth={2} />
                            <Line type="monotone" dataKey="stoch_d" stroke="#f97316" dot={false} strokeWidth={2} />
                        </LineChart>
                    </ResponsiveContainer>
                </Paper>

                {/* 2. MACD */}
                <Paper className="p-4 h-[400px] bg-white dark:bg-gray-800 dark:border-gray-700">
                    <div className="flex justify-between items-center mb-2">
                        <Typography variant="subtitle2" className="font-bold dark:text-gray-200">MACD</Typography>
                        <div className="flex gap-2 text-xs font-bold">
                            <span className="text-blue-600 dark:text-blue-400">M: {indicators.macd?.toFixed(2)}</span>
                            <span className="text-orange-500">S: {indicators.macd_signal?.toFixed(2)}</span>
                            <span className="text-gray-500 dark:text-gray-400">H: {indicators.macd_hist?.toFixed(2)}</span>
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height="85%">
                        <ComposedChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.3} stroke="#888" />
                            <XAxis dataKey="time" hide />
                            <YAxis tick={{ fontSize: 10, fill: '#888' }} />
                            <Tooltip contentStyle={{ fontSize: '12px' }} />
                            <ReferenceLine y={0} stroke="#666" />
                            <Bar dataKey="hist" fill="#8884d8" opacity={0.5} />
                            <Line type="monotone" dataKey="macd" stroke="#2563eb" dot={false} strokeWidth={2} />
                            <Line type="monotone" dataKey="signal" stroke="#f97316" dot={false} strokeWidth={2} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </Paper>

                {/* 3. DMI */}
                <Paper className="p-4 h-[400px] bg-white dark:bg-gray-800 dark:border-gray-700">
                    <div className="flex justify-between items-center mb-2">
                        <Typography variant="subtitle2" className="font-bold dark:text-gray-200">DMI (14)</Typography>
                        <div className="flex gap-2 text-xs font-bold">
                            <span className="text-green-600 dark:text-green-400">+DI: {indicators.dmp?.toFixed(2)}</span>
                            <span className="text-red-500 dark:text-red-400">-DI: {indicators.dmn?.toFixed(2)}</span>
                            <span className="text-gray-600 dark:text-gray-400">ADX: {indicators.adx?.toFixed(2)}</span>
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height="85%">
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.3} stroke="#888" />
                            <XAxis dataKey="time" hide />
                            <YAxis tick={{ fontSize: 10, fill: '#888' }} />
                            <Tooltip contentStyle={{ fontSize: '12px' }} />
                            <ReferenceLine y={25} stroke="#ccc" strokeDasharray="5 5" />
                            <Line type="monotone" dataKey="dmp" stroke="#16a34a" dot={false} strokeWidth={2} />
                            <Line type="monotone" dataKey="dmn" stroke="#dc2626" dot={false} strokeWidth={2} />
                        </LineChart>
                    </ResponsiveContainer>
                </Paper>
            </div>
        </div>
    );
}
