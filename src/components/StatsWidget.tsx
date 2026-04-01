"use client";

import React, { useEffect, useState } from "react";
import { getHistory, getIntradayHistory } from "@/services/api";
import {
    Typography, Paper
} from "@mui/material";

interface StatsWidgetProps {
    instrumentKey: string;
    interval: string;
    title: string;
    subtitle?: string;
    autoRefresh?: boolean;
    apiType?: 'history' | 'intraday';
    onIntervalChange?: (interval: string) => void;
    onDataUpdate?: (data: any) => void;
}

const INTERVAL_OPTIONS = [
    { label: '1m', value: '1minute' },
    { label: '3m', value: '3minute' },
    { label: '5m', value: '5minute' },
    { label: '15m', value: '15minute' },
    { label: '30m', value: '30minute' },
    { label: '1H', value: '60minute' },
    { label: '1D', value: 'day' }
];

export default function StatsWidget({ instrumentKey, interval, title, subtitle, autoRefresh = true, apiType = 'history', onIntervalChange, onDataUpdate }: StatsWidgetProps) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const isFetching = React.useRef(false);

    useEffect(() => {
        if (instrumentKey) {
            fetchChartData();
            // Polling only if autoRefresh is true
            let timer: number | undefined;
            if (autoRefresh) {
                // Initial wait or immediate? 
                timer = window.setInterval(() => fetchChartData(true), 5000);
            }
            return () => {
                if (timer) clearInterval(timer);
            };
        }
    }, [instrumentKey, interval, autoRefresh, apiType]);

    const fetchChartData = async (silent = false) => {
        if (isFetching.current) {
            console.log(`StatsWidget: Skipping fetch for ${instrumentKey} (Busy)`);
            return;
        }

        console.log(`StatsWidget: Fetching (${apiType})`, instrumentKey, interval);
        isFetching.current = true;
        if (!silent) setLoading(true);
        try {
            let d;
            if (apiType === 'intraday') {
                d = await getIntradayHistory(instrumentKey, interval);
            } else {
                d = await getHistory(instrumentKey, interval);
            }
            console.log("StatsWidget: Data Recv", d ? "OK" : "Null", d);
            setData(d);
            if (d && onDataUpdate) onDataUpdate(d);
        } catch (e) {
            console.error("StatsWidget: Fetch Error", e);
        } finally {
            isFetching.current = false;
            if (!silent) setLoading(false);
        }
    };

    const Header = () => (
        <div className="mb-2 pb-2 border-b border-gray-100 dark:border-gray-700 flex flex-col">
            <Typography variant="subtitle2" className="font-bold text-gray-700 dark:text-gray-200 truncate mb-1" title={title}>
                {title}
            </Typography>

            <div className="flex justify-between items-center">
                <Typography variant="caption" className="text-gray-500 dark:text-gray-400 truncate flex-1 mr-2 min-h-[1.25rem]">
                    {subtitle}
                </Typography>

                {onIntervalChange && (
                    <select
                        className="text-xs border rounded px-1 py-0.5 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-600 outline-none focus:border-blue-500"
                        value={interval}
                        onChange={(e) => onIntervalChange(e.target.value)}
                    >
                        {INTERVAL_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                )}
            </div>
        </div>
    );

    if (!instrumentKey) return <Paper className="p-3 border rounded-lg h-full bg-white dark:bg-gray-800 dark:border-gray-700"><Header /><div className="h-20 flex items-center justify-center text-gray-400 text-xs">Enter Key</div></Paper>;

    const indicators = data?.indicators || {};

    return (
        <Paper className="p-3 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700 shadow-sm h-full hover:shadow-md transition-shadow">
            <Header />

            {!data && loading && <div className="h-40 flex items-center justify-center text-gray-500 text-xs">Loading...</div>}
            {!data && !loading && <div className="h-40 flex items-center justify-center text-red-400 text-xs">No Data</div>}

            {data && (
                <>
                    {data.ltp && (
                        <div className="flex items-baseline justify-between mt-1">
                            <span className="text-xl font-bold text-gray-900 dark:text-white">{data.ltp}</span>
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${data.change >= 0 ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"}`}>
                                {data.change > 0 ? '+' : ''}{data.change}
                            </span>
                        </div>
                    )}

                    {/* Pivot Points & Bollinger Bands */}
                    {data && (
                        <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 space-y-2">
                            {/* Pivots */}
                            {(indicators.pivot_points) && (
                                <div className="flex flex-col space-y-1">
                                    <Typography variant="caption" className="text-gray-500 dark:text-gray-400 font-bold mb-0.5">Pivots</Typography>
                                    <div className="flex flex-col space-y-1 text-[10px]">
                                        <div className="flex justify-between items-center bg-red-50 dark:bg-red-900/40 rounded px-1.5 py-0.5">
                                            <span className="text-red-700 dark:text-red-300 font-bold">R3</span>
                                            <span className="font-mono text-gray-700 dark:text-gray-200">{indicators.pivot_points.r3 ?? 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between items-center bg-red-50 dark:bg-red-900/30 rounded px-1.5 py-0.5">
                                            <span className="text-red-600 dark:text-red-400 font-bold">R2</span>
                                            <span className="font-mono text-gray-700 dark:text-gray-200">{indicators.pivot_points.r2 ?? 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between items-center bg-red-50 dark:bg-red-900/20 rounded px-1.5 py-0.5">
                                            <span className="text-red-500 font-bold">R1</span>
                                            <span className="font-mono text-gray-700 dark:text-gray-200">{indicators.pivot_points.r1 ?? 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between items-center bg-amber-50 dark:bg-amber-900/20 rounded px-1.5 py-0.5">
                                            <span className="text-amber-500 font-bold">P</span>
                                            <span className="font-mono text-gray-700 dark:text-gray-200">{indicators.pivot_points.pivot ?? 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between items-center bg-green-50 dark:bg-green-900/20 rounded px-1.5 py-0.5">
                                            <span className="text-green-500 font-bold">S1</span>
                                            <span className="font-mono text-gray-700 dark:text-gray-200">{indicators.pivot_points.s1 ?? 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between items-center bg-green-50 dark:bg-green-900/30 rounded px-1.5 py-0.5">
                                            <span className="text-green-600 dark:text-green-400 font-bold">S2</span>
                                            <span className="font-mono text-gray-700 dark:text-gray-200">{indicators.pivot_points.s2 ?? 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between items-center bg-green-50 dark:bg-green-900/40 rounded px-1.5 py-0.5">
                                            <span className="text-green-700 dark:text-green-300 font-bold">S3</span>
                                            <span className="font-mono text-gray-700 dark:text-gray-200">{indicators.pivot_points.s3 ?? 'N/A'}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Bollinger Bands */}
                            <div className="flex flex-col space-y-1">
                                <Typography variant="caption" className="text-gray-500 dark:text-gray-400 font-bold mb-0.5">Bollinger Bands</Typography>
                                <div className="flex flex-col space-y-1 text-[10px]">
                                    <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-700 rounded px-1.5 py-0.5">
                                        <span className="text-gray-500 dark:text-gray-400">Upper</span>
                                        <span className="font-mono text-gray-700 dark:text-gray-200">
                                            {typeof indicators.bb_upper === 'number' ? indicators.bb_upper.toFixed(0) : 'N/A'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-700 rounded px-1.5 py-0.5">
                                        <span className="text-gray-500 dark:text-gray-400">Middle</span>
                                        <span className="font-mono text-gray-700 dark:text-gray-200">
                                            {typeof indicators.bb_middle === 'number' ? indicators.bb_middle.toFixed(0) : 'N/A'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-700 rounded px-1.5 py-0.5">
                                        <span className="text-gray-500 dark:text-gray-400">Lower</span>
                                        <span className="font-mono text-gray-700 dark:text-gray-200">
                                            {typeof indicators.bb_lower === 'number' ? indicators.bb_lower.toFixed(0) : 'N/A'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 space-y-2">
                        {/* Trend Strength (RSI & ADX) */}
                        <div className="flex flex-col space-y-1">
                            <Typography variant="caption" className="text-gray-500 dark:text-gray-400 font-bold mb-0.5">Trend Momentum</Typography>
                            <div className="flex flex-col space-y-1 text-[10px]">
                                <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-700 rounded px-1.5 py-0.5">
                                    <span className="text-gray-600 dark:text-gray-400">RSI</span>
                                    <span className={`font-mono font-bold ${indicators.rsi > 70 ? "text-red-500" : indicators.rsi < 30 ? "text-green-500" : "text-blue-600 dark:text-blue-400"}`}>
                                        {typeof indicators.rsi === 'number' ? indicators.rsi.toFixed(1) : 'N/A'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-700 rounded px-1.5 py-0.5">
                                    <span className="text-gray-600 dark:text-gray-400">ADX</span>
                                    <span className="font-mono text-gray-700 dark:text-gray-300 font-bold">
                                        {typeof indicators.adx === 'number' ? indicators.adx.toFixed(1) : 'N/A'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Stoch RSI */}
                        <div className="flex flex-col space-y-1">
                            <Typography variant="caption" className="text-gray-500 dark:text-gray-400 font-bold mb-0.5">Stoch RSI</Typography>
                            <div className="flex flex-col space-y-1 text-[10px]">
                                <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-700 rounded px-1.5 py-0.5">
                                    <span className="text-gray-600 dark:text-gray-400">K</span>
                                    <span className="text-blue-600 dark:text-blue-400 font-mono font-bold">
                                        {typeof indicators.stoch_k === 'number' ? indicators.stoch_k.toFixed(1) : 'N/A'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-700 rounded px-1.5 py-0.5">
                                    <span className="text-gray-600 dark:text-gray-400">D</span>
                                    <span className="text-orange-500 font-mono font-bold">
                                        {typeof indicators.stoch_d === 'number' ? indicators.stoch_d.toFixed(1) : 'N/A'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* DMI */}
                        <div className="flex flex-col space-y-1">
                            <Typography variant="caption" className="text-gray-500 dark:text-gray-400 font-bold mb-0.5">DMI</Typography>
                            <div className="flex flex-col space-y-1 text-[10px]">
                                <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-700 rounded px-1.5 py-0.5">
                                    <span className="text-gray-600 dark:text-gray-400">+DI</span>
                                    <span className="text-green-600 dark:text-green-400 font-mono font-bold">
                                        {typeof indicators.dmp === 'number' ? indicators.dmp.toFixed(1) : 'N/A'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-700 rounded px-1.5 py-0.5">
                                    <span className="text-gray-600 dark:text-gray-400">-DI</span>
                                    <span className="text-red-600 dark:text-red-400 font-mono font-bold">
                                        {typeof indicators.dmn === 'number' ? indicators.dmn.toFixed(1) : 'N/A'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* MACD */}
                        <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-700 rounded px-1.5 py-0.5">
                            <span className="text-gray-500 dark:text-gray-400 text-[10px] font-bold">MACD Hist</span>
                            <span className={`font-mono text-[10px] font-bold ${indicators.macd_hist >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
                                {typeof indicators.macd_hist === 'number' ? indicators.macd_hist.toFixed(2) : 'N/A'}
                            </span>
                        </div>

                        {/* SMAs */}
                        <div className="flex flex-col space-y-1 pt-1 border-t border-gray-100 dark:border-gray-700">
                            <div className="flex justify-between items-center text-[10px]">
                                <span className="text-gray-500 dark:text-gray-400">SMA 50</span>
                                <span className="font-mono text-gray-800 dark:text-gray-200">
                                    {typeof indicators.sma_50 === 'number' ? indicators.sma_50.toFixed(0) : 'N/A'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-[10px]">
                                <span className="text-gray-500 dark:text-gray-400">SMA 200</span>
                                <span className="font-mono text-gray-800 dark:text-gray-200">
                                    {typeof indicators.sma_200 === 'number' ? indicators.sma_200.toFixed(0) : 'N/A'}
                                </span>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </Paper>
    );
}
