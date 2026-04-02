"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { getPositions, getMockPositions, exitPosition, exitMockPosition, getUserFunds } from "@/services/api";
import {
    Card, CardContent, Typography, Button,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
    Chip, Switch, FormControlLabel, TextField, InputAdornment, IconButton, Tooltip,
    Box, LinearProgress, Select, MenuItem, FormControl, InputLabel
} from "@mui/material";
import { RefreshCw, Play, Square, Target, AlertTriangle, Trash2, Zap } from "lucide-react";
import clsx from "clsx";

interface MonitorSettings {
    sl: number;
    target: number;
    enabled: boolean;
}

export default function PositionsPage() {
    const [positions, setPositions] = useState<any[]>([]);
    const [funds, setFunds] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [isPaper, setIsPaper] = useState(false);
    const [monitorInterval, setMonitorInterval] = useState(1); // Seconds
    const [isPolling, setIsPolling] = useState(true);

    // Store SL/Target settings per instrument_key
    const [monitors, setMonitors] = useState<Record<string, MonitorSettings>>({});

    const lastRefreshRef = useRef<number>(Date.now());

    const fetchPositions = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const p = isPaper ? await getMockPositions() : await getPositions();
            setPositions(p || []);

            // Check SL/Target triggers
            checkTriggers(p || []);
        } catch (e) {
            console.error("Fetch Positions Error:", e);
        } finally {
            if (!silent) setLoading(false);
        }
    }, [isPaper]);

    const fetchFunds = useCallback(async () => {
        const f = await getUserFunds();
        setFunds(f);
    }, []);

    useEffect(() => {
        fetchFunds();
        fetchPositions();
    }, [fetchPositions, fetchFunds]);

    // Polling Effect
    useEffect(() => {
        if (!isPolling) return;
        const interval = setInterval(() => {
            fetchPositions(true);
        }, monitorInterval * 1000);
        return () => clearInterval(interval);
    }, [isPolling, monitorInterval, fetchPositions]);

    const checkTriggers = (currentPositions: any[]) => {
        currentPositions.forEach(pos => {
            const key = isPaper ? pos.trade_id : (pos.instrument_key || pos.instrument_token);
            const setting = monitors[key];
            if (setting && setting.enabled) {
                const ltp = pos.last_price;
                const qty = pos.quantity || pos.net_quantity;
                if (qty === 0) return;

                const isLong = qty > 0;

                // SL Trigger
                if (setting.sl > 0) {
                    const slHit = isLong ? (ltp <= setting.sl) : (ltp >= setting.sl);
                    if (slHit) {
                        console.log(`SL Hit for ${pos.trading_symbol}: LTP ${ltp} vs SL ${setting.sl}`);
                        handleExit(pos, `SL Hit at ${ltp}`);
                        toggleMonitor(key, false); // Disable after trigger
                    }
                }

                // Target Trigger
                if (setting.target > 0) {
                    const targetHit = isLong ? (ltp >= setting.target) : (ltp <= setting.target);
                    if (targetHit) {
                        console.log(`Target Hit for ${pos.trading_symbol}: LTP ${ltp} vs Target ${setting.target}`);
                        handleExit(pos, `Target Hit at ${ltp}`);
                        toggleMonitor(key, false); // Disable after trigger
                    }
                }
            }
        });
    };

    const handleExit = async (pos: any, reason?: string) => {
        const key = isPaper ? pos.trade_id : (pos.instrument_key || pos.instrument_token);
        try {
            if (reason) {
                console.log(`Auto-Exiting ${pos.trading_symbol}: ${reason}`);
            }
            const res = isPaper ? await exitMockPosition(key) : await exitPosition(key);
            if (res.status === 'success') {
                if (!reason) console.log(`Exit requested for ${pos.trading_symbol}`);
            } else {
                console.error("Exit failed", res);
            }
            fetchPositions(true);
        } catch (e) {
            console.error("Exit Error", e);
        }
    };

    const updateMonitor = (key: string, field: 'sl' | 'target', value: string) => {
        const val = parseFloat(value) || 0;
        setMonitors(prev => ({
            ...prev,
            [key]: {
                ...(prev[key] || { sl: 0, target: 0, enabled: false }),
                [field]: val
            }
        }));
    };

    const toggleMonitor = (key: string, enabled?: boolean) => {
        setMonitors(prev => {
            const current = prev[key] || { sl: 0, target: 0, enabled: false };
            return {
                ...prev,
                [key]: {
                    ...current,
                    enabled: enabled !== undefined ? enabled : !current.enabled
                }
            };
        });
    };

    const fmt = (val: number) => val ? val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';

    return (
        <div className="space-y-6 pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Live Positions</h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Monitor and automate your exits</p>
                </div>

                <Paper className="p-2 flex items-center gap-4 bg-white dark:bg-gray-800 shadow-sm border dark:border-gray-700">
                    <FormControlLabel
                        control={<Switch checked={isPaper} onChange={e => setIsPaper(e.target.checked)} color="secondary" />}
                        label={<span className={clsx("font-bold text-sm", isPaper ? "text-purple-600" : "text-gray-500")}>PAPER</span>}
                    />

                    <FormControl size="small" variant="outlined" sx={{ minWidth: 120 }}>
                        <InputLabel>Refresh</InputLabel>
                        <Select
                            value={monitorInterval}
                            label="Refresh"
                            onChange={(e) => setMonitorInterval(Number(e.target.value))}
                        >
                            <MenuItem value={1}>1 Second</MenuItem>
                            <MenuItem value={2}>2 Seconds</MenuItem>
                            <MenuItem value={5}>5 Seconds</MenuItem>
                            <MenuItem value={10}>10 Seconds</MenuItem>
                        </Select>
                    </FormControl>

                    <IconButton onClick={() => fetchPositions()} disabled={loading} color="primary">
                        <RefreshCw className={clsx(loading && "animate-spin")} size={20} />
                    </IconButton>

                    <IconButton
                        onClick={() => setIsPolling(!isPolling)}
                        color={isPolling ? "success" : "error"}
                        title={isPolling ? "Pause Monitoring" : "Start Monitoring"}
                    >
                        {isPolling ? <Square size={20} /> : <Play size={20} />}
                    </IconButton>
                </Paper>
            </div>

            {isPolling && (
                <Box sx={{ width: '100%', mt: -2 }}>
                    <LinearProgress variant="indeterminate" sx={{ height: 2, borderRadius: 1 }} />
                </Box>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Summary Cards */}
                <Card className="lg:col-span-1 shadow-sm border dark:bg-gray-800 dark:border-gray-700">
                    <CardContent>
                        <Typography color="textSecondary" variant="subtitle2" className="dark:text-gray-400">Total P&L</Typography>
                        <Typography variant="h4" className={clsx("font-bold",
                            positions.reduce((acc, p) => acc + (p.pnl || 0), 0) >= 0 ? "text-green-600" : "text-red-600"
                        )}>
                            ₹ {fmt(positions.reduce((acc, p) => acc + (p.pnl || 0), 0))}
                        </Typography>
                        <div className="mt-4 pt-4 border-t dark:border-gray-700">
                            <Typography color="textSecondary" variant="caption" className="dark:text-gray-400 block">Available Margin</Typography>
                            <Typography variant="h6" className="dark:text-gray-100">₹ {fmt(funds?.available_margin || 0)}</Typography>
                        </div>
                    </CardContent>
                </Card>

                {/* Positions Main Area */}
                <div className="lg:col-span-3">
                    <TableContainer component={Paper} className="shadow-sm border dark:bg-gray-800 dark:border-gray-700">
                        <Table size="small">
                            <TableHead className="bg-gray-50 dark:bg-gray-700">
                                <TableRow>
                                    <TableCell className="font-bold dark:text-gray-200 py-3">Symbol / Qty</TableCell>
                                    <TableCell align="right" className="font-bold dark:text-gray-200">Price / LTP</TableCell>
                                    <TableCell align="right" className="font-bold dark:text-gray-200">PnL</TableCell>
                                    <TableCell align="center" className="font-bold dark:text-gray-200" style={{ width: '300px' }}>Auto Exit Controls</TableCell>
                                    <TableCell align="center" className="font-bold dark:text-gray-200">Action</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {positions.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} align="center" className="py-12 text-gray-400">
                                            No open positions found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    positions.map((pos, idx) => {
                                        const key = isPaper ? pos.trade_id : (pos.instrument_key || pos.instrument_token);
                                        const monitor = monitors[key] || { sl: 0, target: 0, enabled: false };
                                        const qty = pos.quantity || pos.net_quantity || 0;

                                        if (qty === 0) return null;

                                        return (
                                            <TableRow key={key || idx} hover className="dark:hover:bg-gray-700 transition-colors">
                                                <TableCell className="py-4">
                                                    <div className="font-bold dark:text-gray-100">{pos.trading_symbol}</div>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <Chip
                                                            label={qty > 0 ? `LONG: ${qty}` : `SHORT: ${qty}`}
                                                            size="small"
                                                            color={qty > 0 ? "success" : "error"}
                                                            variant="outlined"
                                                        />
                                                    </div>
                                                </TableCell>
                                                <TableCell align="right">
                                                    <div className="text-xs text-gray-500 dark:text-gray-400">Avg: {pos.average_price?.toFixed(2)}</div>
                                                    <div className="font-mono font-bold dark:text-gray-200">{pos.last_price?.toFixed(2)}</div>
                                                </TableCell>
                                                <TableCell align="right">
                                                    <div className={clsx("font-bold", (pos.pnl || 0) >= 0 ? "text-green-600" : "text-red-600")}>
                                                        {fmt(pos.pnl || 0)}
                                                    </div>
                                                    <div className="text-[10px] text-gray-400">
                                                        {(((pos.pnl || 0) / (pos.average_price * Math.abs(qty))) * 100).toFixed(2)}%
                                                    </div>
                                                </TableCell>
                                                <TableCell align="center">
                                                    <div className="flex items-center gap-2">
                                                        <TextField
                                                            size="small"
                                                            placeholder="SL"
                                                            type="number"
                                                            value={monitor.sl || ''}
                                                            onChange={(e) => updateMonitor(key, 'sl', e.target.value)}
                                                            InputProps={{
                                                                startAdornment: <InputAdornment position="start"><AlertTriangle size={14} className="text-red-400" /></InputAdornment>,
                                                            }}
                                                            sx={{
                                                                width: '100px',
                                                                '& .MuiInputBase-input': { fontSize: '12px', py: 0.5 }
                                                            }}
                                                        />
                                                        <TextField
                                                            size="small"
                                                            placeholder="Target"
                                                            type="number"
                                                            value={monitor.target || ''}
                                                            onChange={(e) => updateMonitor(key, 'target', e.target.value)}
                                                            InputProps={{
                                                                startAdornment: <InputAdornment position="start"><Target size={14} className="text-green-400" /></InputAdornment>,
                                                            }}
                                                            sx={{
                                                                width: '100px',
                                                                '& .MuiInputBase-input': { fontSize: '12px', py: 0.5 }
                                                            }}
                                                        />
                                                        <Tooltip title={monitor.enabled ? "Disable Auto Exit" : "Enable Auto Exit"}>
                                                            <IconButton
                                                                onClick={() => toggleMonitor(key)}
                                                                color={monitor.enabled ? "success" : "default"}
                                                                size="small"
                                                            >
                                                                {monitor.enabled ? <Zap size={18} fill="currentColor" /> : <Zap size={18} />}
                                                            </IconButton>
                                                        </Tooltip>
                                                    </div>
                                                </TableCell>
                                                <TableCell align="center">
                                                    <Button
                                                        variant="contained"
                                                        color="error"
                                                        size="small"
                                                        onClick={() => handleExit(pos)}
                                                        startIcon={<Trash2 size={14} />}
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
                </div>
            </div>

            <Card className="bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-900">
                <CardContent className="py-3 flex items-start gap-2">
                    <AlertTriangle size={18} className="text-amber-600 mt-1" />
                    <Typography variant="caption" className="text-amber-800 dark:text-amber-200">
                        <strong>Monitoring Active:</strong> Ensure this browser tab remains open for automatic exit triggers to function. Auto-exits are executed as MARKET orders when your SL or Target levels are breached.
                    </Typography>
                </CardContent>
            </Card>
        </div>
    );
}
