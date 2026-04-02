"use client";

import { useEffect, useState } from "react";
import { getUserFunds, getPositions, getHoldings, exitPosition } from "@/services/api";
import {
    Card, CardContent, Typography, Button,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
    Chip, Alert, Snackbar, Switch, FormControlLabel
} from "@mui/material";
import { RefreshCw, IndianRupee } from "lucide-react";

export default function Portfolio() {
    const [funds, setFunds] = useState<any>(null);
    const [positions, setPositions] = useState<any[]>([]);
    const [holdings, setHoldings] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [autoRefreshPositions, setAutoRefreshPositions] = useState(false);
    const [autoRefreshHoldings, setAutoRefreshHoldings] = useState(false);

    useEffect(() => {
        fetchFunds();
        fetchPositions();
        fetchHoldings();
    }, []);

    // Auto Refresh Positions
    useEffect(() => {
        let interval: any;
        if (autoRefreshPositions) {
            interval = setInterval(() => fetchPositions(true), 5000);
        }
        return () => clearInterval(interval);
    }, [autoRefreshPositions]);

    // Auto Refresh Holdings
    useEffect(() => {
        let interval: any;
        if (autoRefreshHoldings) {
            interval = setInterval(() => fetchHoldings(true), 5000);
        }
        return () => clearInterval(interval);
    }, [autoRefreshHoldings]);

    const fetchFunds = async () => {
        const f = await getUserFunds();
        setFunds(f);
    };

    const fetchPositions = async (silent = false) => {
        if (!silent) setLoading(true);
        const p = await getPositions();
        setPositions(p);
        if (!silent) setLoading(false);
    };

    const fetchHoldings = async (silent = false) => {
        if (!silent) setLoading(true);
        const h = await getHoldings();
        setHoldings(h);
        if (!silent) setLoading(false);
    };

    const refreshAll = () => {
        setLoading(true);
        Promise.all([fetchFunds(), fetchPositions(), fetchHoldings()]).then(() => setLoading(false));
    };

    const handleExit = async (key: string) => {
        console.log("Attempting exit for:", key);
        // if (!confirm(`Confirm Exit for ${key}?`)) return; // Commented out for debugging/automation
        try {
            const res = await exitPosition(key);
            console.log("Exit Response:", res);
            if (res.status === 'success') {
                console.log(`Exit Success: ${res.message}`);
                fetchPositions();
            } else {
                console.error(`Exit Failed: ${res.message || 'Unknown Error'}`);
            }
        } catch (err: any) {
            console.error("Exit Error:", err);
            console.error(`Exit Error: ${err.message || JSON.stringify(err)}`);
        }
    };

    // Helper to format currency
    const fmt = (val: number) => val ? val.toLocaleString('en-IN') : '0';

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">My Portfolio</h1>
                <div className="flex items-center gap-4">
                    <Button
                        variant="outlined"
                        startIcon={<RefreshCw className={loading ? "animate-spin" : ""} />}
                        onClick={refreshAll}
                        className="dark:text-gray-200 dark:border-gray-600"
                    >
                        Refresh All
                    </Button>
                </div>
            </div>

            {/* Funds Card */}
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 dark:bg-none dark:bg-gray-800 dark:border-gray-700">
                <CardContent className="flex justify-between items-center">
                    <div>
                        <Typography color="textSecondary" gutterBottom className="dark:text-gray-400">
                            Available Funds
                        </Typography>
                        <Typography variant="h4" className="font-bold text-blue-700 dark:text-blue-400">
                            ₹ {fmt(funds?.available_margin || funds?.net || 0)}
                        </Typography>
                    </div>
                    <div className="text-right">
                        <Typography color="textSecondary" className="dark:text-gray-400">Used Margin</Typography>
                        <Typography variant="h6" className="dark:text-gray-200">₹ {fmt(funds?.used_margin || 0)}</Typography>
                    </div>
                </CardContent>
            </Card>

            {/* Positions Table */}
            <Paper className="p-4 shadow-md bg-white dark:bg-gray-800">
                <div className="flex justify-between items-center mb-4">
                    <Typography variant="h6" className="text-gray-700 dark:text-gray-200">Open Positions ({positions.length})</Typography>
                    <FormControlLabel
                        control={<Switch size="small" checked={autoRefreshPositions} onChange={e => setAutoRefreshPositions(e.target.checked)} />}
                        label={<span className="text-sm dark:text-gray-300">Auto Refresh</span>}
                    />
                </div>
                <TableContainer>
                    <Table size="small">
                        <TableHead className="bg-gray-100 dark:bg-gray-700">
                            <TableRow>
                                <TableCell className="font-bold dark:text-gray-200">Instrument</TableCell>
                                <TableCell className="font-bold text-right dark:text-gray-200">Qty</TableCell>
                                <TableCell className="font-bold text-right dark:text-gray-200">Avg Price</TableCell>
                                <TableCell className="font-bold text-right dark:text-gray-200">LTP</TableCell>
                                <TableCell className="font-bold text-right dark:text-gray-200">P&L</TableCell>
                                <TableCell className="font-bold text-center dark:text-gray-200">Action</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {positions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} align="center" className="text-gray-500 dark:text-gray-400 py-8">
                                        No open positions
                                    </TableCell>
                                </TableRow>
                            ) : (
                                positions.map((row: any, idx: number) => {
                                    const pnl = (row.last_price - row.average_price) * row.quantity; // Simplified P&L
                                    const isProfit = pnl >= 0;
                                    return (
                                        <TableRow key={idx} hover className="dark:hover:bg-gray-700">
                                            <TableCell className="dark:text-gray-200">{row.trading_symbol}</TableCell>
                                            <TableCell align="right">
                                                <Chip
                                                    label={row.quantity}
                                                    color={row.quantity > 0 ? "success" : "error"}
                                                    size="small"
                                                    variant="outlined"
                                                />
                                            </TableCell>
                                            <TableCell align="right" className="dark:text-gray-200">{row.average_price?.toFixed(2)}</TableCell>
                                            <TableCell align="right" className="dark:text-gray-200">{row.last_price?.toFixed(2)}</TableCell>
                                            <TableCell align="right" className={isProfit ? "text-green-600 dark:text-green-400 font-bold" : "text-red-600 dark:text-red-400 font-bold"}>
                                                {pnl.toFixed(2)}
                                            </TableCell>
                                            <TableCell align="center">
                                                <Button
                                                    size="small"
                                                    color="error"
                                                    variant="contained"
                                                    onClick={() => handleExit(row.instrument_key || row.instrument_token)}
                                                >
                                                    EXIT
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>

            {/* Holdings Table */}
            <Paper className="p-4 shadow-md bg-white dark:bg-gray-800">
                <div className="flex justify-between items-center mb-4">
                    <Typography variant="h6" className="text-gray-700 dark:text-gray-200">Holdings ({holdings.length})</Typography>
                    <FormControlLabel
                        control={<Switch size="small" checked={autoRefreshHoldings} onChange={e => setAutoRefreshHoldings(e.target.checked)} />}
                        label={<span className="text-sm dark:text-gray-300">Auto Refresh</span>}
                    />
                </div>
                <TableContainer>
                    <Table size="small">
                        <TableHead className="bg-gray-100 dark:bg-gray-700">
                            <TableRow>
                                <TableCell className="font-bold dark:text-gray-200">Stock</TableCell>
                                <TableCell className="font-bold text-right dark:text-gray-200">Qty</TableCell>
                                <TableCell className="font-bold text-right dark:text-gray-200">Avg Price</TableCell>
                                <TableCell className="font-bold text-right dark:text-gray-200">LTP</TableCell>
                                <TableCell className="font-bold text-right dark:text-gray-200">Current Val</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {holdings.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} align="center" className="text-gray-500 dark:text-gray-400 py-8">
                                        No holdings found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                holdings.map((row: any, idx: number) => (
                                    <TableRow key={idx} hover className="dark:hover:bg-gray-700">
                                        <TableCell className="dark:text-gray-200">{row.trading_symbol}</TableCell>
                                        <TableCell align="right" className="dark:text-gray-200">{row.quantity}</TableCell>
                                        <TableCell align="right" className="dark:text-gray-200">{row.average_price?.toFixed(2)}</TableCell>
                                        <TableCell align="right" className="dark:text-gray-200">{row.last_price?.toFixed(2)}</TableCell>
                                        <TableCell align="right" className="dark:text-gray-200">{(row.quantity * row.last_price).toFixed(2)}</TableCell>
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
