"use client";

import { useEffect, useState } from "react";
import { getMockPositions, getMockHistory } from "@/services/api";
import {
    Paper, Typography, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Button, Box
} from "@mui/material";
import { RefreshCw, TrendingUp, DollarSign, Activity, BarChart as BarChartIcon } from "lucide-react";
import clsx from "clsx";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Cell
} from 'recharts';

export default function PaperTradingDashboard() {
    const [history, setHistory] = useState<any[]>([]);
    const [dailyData, setDailyData] = useState<any[]>([]);
    const [stats, setStats] = useState({
        totalTrades: 0,
        winRate: 0,
        totalPnL: 0,
        bestTrade: 0,
        worstTrade: 0
    });

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        try {
            const data = await getMockHistory();
            setHistory(data);
            calculateStats(data);
            processDailyData(data);
        } catch (e) { console.error(e); }
    };

    const calculateStats = (data: any[]) => {
        let totalPnL = 0;
        let wins = 0;
        let best = -Infinity;
        let worst = Infinity;

        data.forEach(t => {
            const pnl = t.pnl || 0;
            totalPnL += pnl;
            if (pnl > 0) wins++;
            if (pnl > best) best = pnl;
            if (pnl < worst) worst = pnl;
        });

        setStats({
            totalTrades: data.length,
            winRate: data.length > 0 ? (wins / data.length) * 100 : 0,
            totalPnL,
            bestTrade: best === -Infinity ? 0 : best,
            worstTrade: worst === Infinity ? 0 : worst
        });
    };

    const processDailyData = (data: any[]) => {
        const map: Record<string, number> = {};

        data.forEach(t => {
            // Use exit_timestamp if available, else timestamp
            const dateStr = t.exit_timestamp || t.timestamp;
            if (!dateStr) return;

            const date = new Date(dateStr).toLocaleDateString('en-CA'); // YYYY-MM-DD
            const pnl = t.pnl || 0;

            if (!map[date]) map[date] = 0;
            map[date] += pnl;
        });

        const chartData = Object.keys(map).sort().map(date => ({
            date,
            pnl: map[date]
        }));

        setDailyData(chartData);
    };

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white dark:bg-gray-800 p-2 border dark:border-gray-700 shadow rounded">
                    <p className="font-bold dark:text-white">{label}</p>
                    <p className={clsx("font-bold", payload[0].value >= 0 ? "text-green-600" : "text-red-600")}>
                        P&L: {payload[0].value.toFixed(2)}
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 pb-20">
            <div className="flex justify-between items-center">
                <Typography variant="h4" className="font-bold dark:text-purple-300 flex items-center gap-2">
                    <Activity /> Paper Trading Dashboard
                </Typography>
                <Button startIcon={<RefreshCw />} onClick={fetchHistory} variant="outlined">Refresh</Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Paper className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                    <Typography variant="subtitle2" className="text-purple-800 dark:text-purple-300">Total P&L</Typography>
                    <Typography variant="h4" className={clsx("font-bold", stats.totalPnL >= 0 ? "text-green-600" : "text-red-600")}>
                        ₹{stats.totalPnL.toFixed(2)}
                    </Typography>
                </Paper>

                <Paper className="p-4 bg-gray-50 dark:bg-gray-800 border dark:border-gray-700">
                    <Typography variant="subtitle2" className="dark:text-gray-400">Win Rate</Typography>
                    <Typography variant="h4" className="font-bold dark:text-white">
                        {stats.winRate.toFixed(1)}%
                    </Typography>
                    <Typography variant="caption" className="dark:text-gray-400">{stats.totalTrades} Trades</Typography>
                </Paper>

                <Paper className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                    <Typography variant="subtitle2" className="text-green-800 dark:text-green-300">Best Trade</Typography>
                    <Typography variant="h4" className="font-bold text-green-600 dark:text-green-400">
                        +₹{stats.bestTrade.toFixed(2)}
                    </Typography>
                </Paper>

                <Paper className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                    <Typography variant="subtitle2" className="text-red-800 dark:text-red-300">Worst Trade</Typography>
                    <Typography variant="h4" className="font-bold text-red-600 dark:text-red-400">
                        {stats.worstTrade.toFixed(2)}
                    </Typography>
                </Paper>
            </div>

            {/* Daily P&L Chart */}
            <Paper className="p-4 dark:bg-gray-800 dark:border-gray-700 h-[350px]">
                <Typography variant="h6" className="dark:text-gray-200 mb-4 flex items-center gap-2">
                    <BarChartIcon size={20} /> Daily Performance
                </Typography>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                        <XAxis dataKey="date" stroke="#9CA3AF" />
                        <YAxis stroke="#9CA3AF" />
                        <Tooltip content={<CustomTooltip />} />
                        <ReferenceLine y={0} stroke="#9CA3AF" />
                        <Bar dataKey="pnl">
                            {dailyData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#10B981' : '#EF4444'} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </Paper>

            {/* History Table */}
            <Paper className="dark:bg-gray-800 dark:border-gray-700">
                <div className="p-4 border-b dark:border-gray-700">
                    <Typography variant="h6" className="dark:text-gray-200 flex items-center gap-2">
                        <TrendingUp size={20} /> Trade History
                    </Typography>
                </div>
                <TableContainer className="max-h-[500px]">
                    <Table stickyHeader size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell className="dark:bg-gray-900 dark:text-gray-300">Time</TableCell>
                                <TableCell className="dark:bg-gray-900 dark:text-gray-300">Symbol</TableCell>
                                <TableCell className="dark:bg-gray-900 dark:text-gray-300">Action</TableCell>
                                <TableCell align="right" className="dark:bg-gray-900 dark:text-gray-300">Qty</TableCell>
                                <TableCell align="right" className="dark:bg-gray-900 dark:text-gray-300">Entry</TableCell>
                                <TableCell align="right" className="dark:bg-gray-900 dark:text-gray-300">Exit</TableCell>
                                <TableCell align="right" className="dark:bg-gray-900 dark:text-gray-300">P&L</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {history.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} align="center" className="dark:text-gray-400 py-8">
                                        No Mock Trades Found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                history.map((row: any) => (
                                    <TableRow key={row.trade_id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                        <TableCell className="dark:text-gray-300">
                                            {new Date(row.timestamp).toLocaleString()}
                                        </TableCell>
                                        <TableCell className="font-bold dark:text-gray-200">{row.trading_symbol}</TableCell>
                                        <TableCell>
                                            <span className={clsx("px-2 py-1 rounded text-xs font-bold", row.transaction_type === 'BUY' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800')}>
                                                {row.transaction_type}
                                            </span>
                                        </TableCell>
                                        <TableCell align="right" className="dark:text-gray-300">{row.quantity}</TableCell>
                                        <TableCell align="right" className="dark:text-gray-300">{row.average_price?.toFixed(2)}</TableCell>
                                        <TableCell align="right" className="dark:text-gray-300">{row.exit_price?.toFixed(2) || '-'}</TableCell>
                                        <TableCell align="right" className={clsx("font-bold", (row.pnl || 0) >= 0 ? "text-green-600" : "text-red-600")}>
                                            {row.pnl?.toFixed(2)}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        </div>
    );
}
