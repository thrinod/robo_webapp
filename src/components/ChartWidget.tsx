"use client";

import React, { useEffect, useState } from "react";
import { getHistory } from "@/services/api";
import {
    Typography, Paper
} from "@mui/material";
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    ReferenceLine, ComposedChart, Bar
} from "recharts";

interface ChartWidgetProps {
    instrumentKey: string;
    interval: string;
    title: string;
}

export default function ChartWidget({ instrumentKey, interval, title }: ChartWidgetProps) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (instrumentKey) {
            fetchChartData();
            // Polling
            const timer = window.setInterval(() => fetchChartData(true), 5000);
            return () => clearInterval(timer);
        }
    }, [instrumentKey, interval]);

    const fetchChartData = async (silent = false) => {
        if (!silent) setLoading(true);
        const d = await getHistory(instrumentKey, interval);
        setData(d);
        if (!silent) setLoading(false);
    };

    if (!instrumentKey) return <Paper className="p-10 text-center"><Typography>Enter Instrument Key</Typography></Paper>;
    if (!data && loading) return <Paper className="p-10 text-center"><Typography>Loading {title}...</Typography></Paper>;
    if (!data) return <Paper className="p-10 text-center"><Typography>No Data for {title}</Typography></Paper>;

    const candles = data.candles || [];
    const indicators = data.indicators || {};
    const series = data.indicators_series || {};

    const chartData = candles.map((c: any, i: number) => {
        const d = new Date(c.timestamp);
        let label = '';
        if (isNaN(d.getTime())) {
            label = '-';
        } else if (interval === 'day') {
            label = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
        } else {
            label = `${d.getDate()}/${d.getMonth() + 1} ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })}`;
        }

        return {
            time: label,
            original_ts: c.timestamp,
            price: c.close,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            stoch_k: series.stoch_k?.[i],
            stoch_d: series.stoch_d?.[i],
            macd: series.macd?.[i],
            signal: series.macd_signal?.[i],
            hist: series.macd_hist?.[i],
            dmp: series.dmp?.[i],
            dmn: series.dmn?.[i],
        };
    }).slice(-100);

    return (
        <div className="space-y-4 border rounded p-4 bg-gray-50">
            <div className="flex justify-between items-center">
                <Typography variant="h6" className="font-bold">{title}</Typography>
                {data.ltp && (
                    <div className="text-right">
                        <span className="font-bold mr-2">{data.ltp}</span>
                        <span className={data.change >= 0 ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                            {data.change > 0 ? '+' : ''}{data.change}
                        </span>
                    </div>
                )}
            </div>

            {/* Key Stats Summary */}
            <div className="grid grid-cols-4 gap-2 mb-2">
                <div className="bg-white p-2 rounded border text-center">
                    <div className="text-[10px] text-purple-800 font-bold">RSI</div>
                    <div className="text-sm font-bold">{indicators.rsi?.toFixed(2)}</div>
                </div>
                <div className="bg-white p-2 rounded border text-center">
                    <div className="text-[10px] text-blue-800 font-bold">SMA 50</div>
                    <div className="text-sm font-bold">{indicators.sma_50?.toFixed(2)}</div>
                </div>
                <div className="bg-white p-2 rounded border text-center">
                    <div className="text-[10px] text-indigo-800 font-bold">SMA 200</div>
                    <div className="text-sm font-bold">{indicators.sma_200?.toFixed(2)}</div>
                </div>
                <div className="bg-white p-2 rounded border text-center">
                    <div className="text-[10px] text-gray-800 font-bold">ADX</div>
                    <div className="text-sm font-bold">{indicators.adx?.toFixed(2)}</div>
                </div>
            </div>

            {/* Price Chart */}
            <Paper className="p-2 h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="time" hide />
                        <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10 }} width={40} />
                        <Tooltip contentStyle={{ fontSize: '10px' }} />
                        {/* Candles */}
                        {chartData.map((entry: any, index: number) => {
                            const isUp = entry.close >= entry.open;
                            const color = isUp ? "#22c55e" : "#ef4444";
                            return (
                                <React.Fragment key={index}>
                                    <ReferenceLine segment={[{ x: entry.time, y: entry.high }, { x: entry.time, y: entry.low }]} stroke={color} />
                                    <ReferenceLine segment={[{ x: entry.time, y: entry.open }, { x: entry.time, y: entry.close }]} stroke={color} strokeWidth={5} />
                                </React.Fragment>
                            );
                        })}
                    </ComposedChart>
                </ResponsiveContainer>
            </Paper>

            {/* Stoch RSI */}
            <Paper className="p-2 h-[100px]">
                <div className="flex justify-between text-[10px] mb-1">
                    <span className="font-bold">Stoch RSI</span>
                    <span>K:{indicators.stoch_k?.toFixed(1)} D:{indicators.stoch_d?.toFixed(1)}</span>
                </div>
                <ResponsiveContainer width="100%" height="80%">
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="time" hide />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} width={40} />
                        <ReferenceLine y={80} stroke="red" strokeDasharray="3 3" />
                        <ReferenceLine y={20} stroke="green" strokeDasharray="3 3" />
                        <Line type="monotone" dataKey="stoch_k" stroke="#2563eb" dot={false} strokeWidth={1} />
                        <Line type="monotone" dataKey="stoch_d" stroke="#f97316" dot={false} strokeWidth={1} />
                    </LineChart>
                </ResponsiveContainer>
            </Paper>

            {/* MACD */}
            <Paper className="p-2 h-[100px]">
                <div className="flex justify-between text-[10px] mb-1">
                    <span className="font-bold">MACD</span>
                    <span>H:{indicators.macd_hist?.toFixed(1)}</span>
                </div>
                <ResponsiveContainer width="100%" height="80%">
                    <ComposedChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <YAxis tick={{ fontSize: 10 }} width={40} />
                        <ReferenceLine y={0} stroke="#666" />
                        <Bar dataKey="hist" fill="#8884d8" opacity={0.5} />
                        <Line type="monotone" dataKey="macd" stroke="#2563eb" dot={false} strokeWidth={1} />
                        <Line type="monotone" dataKey="signal" stroke="#f97316" dot={false} strokeWidth={1} />
                    </ComposedChart>
                </ResponsiveContainer>
            </Paper>

            {/* DMI */}
            <Paper className="p-2 h-[100px]">
                <div className="flex justify-between text-[10px] mb-1">
                    <span className="font-bold">DMI</span>
                    <div className="flex gap-2">
                        <span className="text-green-600">+DI:{indicators.dmp?.toFixed(1)}</span>
                        <span className="text-red-500">-DI:{indicators.dmn?.toFixed(1)}</span>
                        <span className="text-gray-600">ADX:{indicators.adx?.toFixed(1)}</span>
                    </div>
                </div>
                <ResponsiveContainer width="100%" height="80%">
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="time" hide />
                        <YAxis tick={{ fontSize: 10 }} width={40} />
                        <ReferenceLine y={25} stroke="#ccc" strokeDasharray="5 5" />
                        <Line type="monotone" dataKey="dmp" stroke="#16a34a" dot={false} strokeWidth={1} />
                        <Line type="monotone" dataKey="dmn" stroke="#dc2626" dot={false} strokeWidth={1} />
                    </LineChart>
                </ResponsiveContainer>
            </Paper>
        </div>
    );
}
