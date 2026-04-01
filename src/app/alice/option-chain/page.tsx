"use client";

import { useEffect, useState } from "react";
import {
    getAliceStatus,
    getAliceOptionChain,
    // Add Alice Blue specific trade APIs when ready
} from "@/services/api";
import {
    Paper, Typography, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Button, Box, Select, MenuItem, FormControl, InputLabel,
    Checkbox, TextField, Link
} from "@mui/material";
import { RefreshCw, TrendingUp, Zap, Link as LinkIcon, AlertTriangle } from "lucide-react";
import clsx from "clsx";

// Instrument Keys (Alice Blue might use different symbols, adapt as needed)
const INDICES = [
    { label: "NIFTY 50", value: "NIFTY" }, // Simplified
    { label: "BANK NIFTY", value: "BANKNIFTY" },
];

export default function AliceOptionChain() {
    const [status, setStatus] = useState("DISCONNECTED");
    const [index, setIndex] = useState("NIFTY");
    const [expiry, setExpiry] = useState("");
    const [expiryDates, setExpiryDates] = useState<string[]>([]);
    const [chain, setChain] = useState<any[]>([]);
    const [spot, setSpot] = useState(0);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        checkStatus();
    }, []);

    useEffect(() => {
        if (status === 'CONNECTED') {
            fetchChain();
        }
    }, [status, index, expiry]);

    const checkStatus = async () => {
        const s = await getAliceStatus();
        setStatus(s.status);
    };

    const fetchChain = async () => {
        setLoading(true);
        // Note: expiry handled by backend or needs distinct fetch
        const data = await getAliceOptionChain(index, expiry);
        if (data) {
            setSpot(data.spot_price || 0);
            if (data.expiry_dates && data.expiry_dates.length > 0) {
                setExpiryDates(data.expiry_dates);
                if (!expiry) setExpiry(data.expiry_dates[0]);
            }
            if (data.chain) setChain(data.chain);
        }
        setLoading(false);
    };

    return (
        <div className="p-4 max-w-7xl mx-auto space-y-4 pb-20">
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
                <Typography variant="h5" className="font-bold dark:text-blue-300 flex items-center gap-2">
                    <TrendingUp /> Alice Blue Option Chain
                </Typography>
                <div className="flex items-center gap-2">
                    <span className={clsx("px-2 py-1 rounded text-xs font-bold",
                        status === 'CONNECTED' ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")}>
                        {status}
                    </span>
                    <Button startIcon={<RefreshCw />} onClick={fetchChain} variant="outlined" size="small">Refresh</Button>
                </div>
            </div>

            {/* Controls */}
            <Paper className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4 items-center shadow-sm bg-white dark:bg-gray-800 dark:border-gray-700">
                <FormControl size="small" fullWidth>
                    <InputLabel className="dark:text-gray-400">Index</InputLabel>
                    <Select value={index} label="Index" onChange={(e) => setIndex(e.target.value)} className="dark:text-white">
                        {INDICES.map(idx => <MenuItem key={idx.value} value={idx.value}>{idx.label}</MenuItem>)}
                    </Select>
                </FormControl>

                <FormControl size="small" fullWidth disabled={expiryDates.length === 0}>
                    <InputLabel className="dark:text-gray-400">Expiry</InputLabel>
                    <Select value={expiry} label="Expiry" onChange={(e) => setExpiry(e.target.value)} className="dark:text-white">
                        {expiryDates.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                    </Select>
                </FormControl>

                <div className="text-center">
                    <Typography variant="caption" className="dark:text-gray-400 block">Spot Price</Typography>
                    <Typography variant="h6" className="font-bold text-blue-600 dark:text-blue-400">{spot.toFixed(2)}</Typography>
                </div>
            </Paper>

            {/* Chain Table */}
            <TableContainer component={Paper} className="max-h-[70vh] bg-white dark:bg-gray-800">
                <Table stickyHeader size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell align="center" colSpan={4} className="bg-green-50 dark:bg-green-900/30">CALLS</TableCell>
                            <TableCell className="bg-gray-800 text-white w-24 text-center">STRIKE</TableCell>
                            <TableCell align="center" colSpan={4} className="bg-red-50 dark:bg-red-900/30">PUTS</TableCell>
                        </TableRow>
                        <TableRow className="bg-gray-100 dark:bg-gray-900">
                            <TableCell align="right" className="dark:text-gray-300">OI</TableCell>
                            <TableCell align="right" className="dark:text-gray-300">LTP</TableCell>
                            <TableCell align="center" className="dark:text-gray-300">Buy</TableCell>
                            <TableCell align="center" className="dark:text-gray-300">Sell</TableCell>
                            <TableCell align="center" className="bg-gray-200 dark:bg-gray-800 font-bold dark:text-white">Price</TableCell>
                            <TableCell align="center" className="dark:text-gray-300">Buy</TableCell>
                            <TableCell align="center" className="dark:text-gray-300">Sell</TableCell>
                            <TableCell align="right" className="dark:text-gray-300">LTP</TableCell>
                            <TableCell align="right" className="dark:text-gray-300">OI</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {chain.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={9} align="center" className="py-10 dark:text-gray-400">
                                    {status === 'CONNECTED' ? "No Data Available" : "Please Connect to Alice Blue"}
                                </TableCell>
                            </TableRow>
                        ) : chain.map((row: any) => (
                            <TableRow key={row.strike} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                {/* CALLS */}
                                <TableCell align="right" className="dark:text-gray-200">{row.ce?.oi || '-'}</TableCell>
                                <TableCell align="right" className="font-bold text-green-700 dark:text-green-400">{row.ce?.ltp || '-'}</TableCell>
                                <TableCell padding="checkbox"><Checkbox size="small" disabled /></TableCell>
                                <TableCell padding="checkbox"><Checkbox size="small" disabled /></TableCell>

                                {/* STRIKE */}
                                <TableCell align="center" className="bg-gray-100 dark:bg-gray-900 font-bold dark:text-white">{row.strike}</TableCell>

                                {/* PUTS */}
                                <TableCell padding="checkbox"><Checkbox size="small" disabled /></TableCell>
                                <TableCell padding="checkbox"><Checkbox size="small" disabled /></TableCell>
                                <TableCell align="right" className="font-bold text-red-700 dark:text-red-400">{row.pe?.ltp || '-'}</TableCell>
                                <TableCell align="right" className="dark:text-gray-200">{row.pe?.oi || '-'}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </div>
    );
}
