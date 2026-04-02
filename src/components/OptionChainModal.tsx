import React, { useEffect, useState } from "react";
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button,
    Select, MenuItem, FormControl, InputLabel,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, CircularProgress
} from "@mui/material";
import { getExpiryDates, getOptionChain } from "@/services/api";
import clsx from "clsx";

interface OptionChainModalProps {
    open: boolean;
    onClose: () => void;
    onSelect: (key: string, label: string, strike: string) => void;
    indexKey: string;
}

export default function OptionChainModal({ open, onClose, onSelect, indexKey }: OptionChainModalProps) {
    const [expiryDates, setExpiryDates] = useState<string[]>([]);
    const [expiry, setExpiry] = useState("");
    const [chain, setChain] = useState<any[]>([]);
    const [spot, setSpot] = useState(0);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open && indexKey) {
            loadExpiries();
        }
    }, [open, indexKey]);

    useEffect(() => {
        if (expiry && open) {
            fetchChain();
        }
    }, [expiry, open]);

    const loadExpiries = async () => {
        const dates = await getExpiryDates(indexKey);
        setExpiryDates(dates);
        if (dates.length > 0) setExpiry(dates[0]);
    };

    const fetchChain = async () => {
        setLoading(true);
        try {
            const res = await getOptionChain(indexKey, expiry);
            const raw = res.data?.data || (Array.isArray(res.data) ? res.data : []);
            setSpot(res.data?.spot_price || 0);

            // Group by Strike for Modal Display (Converting Flat -> Hierarchical)
            const grouped: Record<number, any> = {};
            raw.forEach((item: any) => {
                const sp = item.strike_price;
                if (!grouped[sp]) grouped[sp] = { strike_price: sp };

                // Map Flat fields to Hierarchical structure expected by Modal
                // Frontend Logic: item is either CE or PE object
                const type = item.instrument_type; // 'CE' or 'PE'
                const optionData = {
                    instrument_key: item.instrument_key,
                    market_data: {
                        ltp: item.last_price,
                        oi: item.open_interest,
                        // Add other fields if needed by modal
                    }
                };

                if (type === 'CE') grouped[sp].call_options = optionData;
                if (type === 'PE') grouped[sp].put_options = optionData;
            });

            // Convert back to array and sort
            const sorted = Object.values(grouped).sort((a: any, b: any) => a.strike_price - b.strike_price);
            setChain(sorted);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    const handleSelect = (key: string, label: string, strike: string) => {
        console.log("Modal Selection:", key, label, strike);
        onSelect(key, label, strike);
        onClose();
    };

    // Find closest to spot for highlighting
    const closestIndex = chain.reduce((prevCtx: number, curr, idx) => {
        const prevDiff = Math.abs(chain[prevCtx].strike_price - spot);
        const currDiff = Math.abs(curr.strike_price - spot);
        return currDiff < prevDiff ? idx : prevCtx;
    }, 0);

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>Select Option</DialogTitle>
            <DialogContent dividers>
                <div className="mb-4 flex gap-4 items-center">
                    <div className="font-bold">Index: {indexKey.split('|')[1] || indexKey}</div>
                    <div className="text-sm text-gray-600">Spot: <span className="font-bold text-black">{spot}</span></div>

                    <FormControl size="small" className="min-w-[150px] ml-auto">
                        <InputLabel>Expiry</InputLabel>
                        <Select value={expiry} label="Expiry" onChange={(e) => setExpiry(e.target.value)}>
                            {expiryDates.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                        </Select>
                    </FormControl>
                </div>

                {loading ? (
                    <div className="flex justify-center p-8"><CircularProgress /></div>
                ) : (
                    <TableContainer component={Paper} className="max-h-[60vh] bg-white dark:bg-gray-800">
                        <Table stickyHeader size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell align="center" colSpan={2} className="bg-green-50 dark:bg-green-900/40 dark:text-green-100">CALLS</TableCell>
                                    <TableCell align="center" className="bg-gray-100 dark:bg-gray-700 font-bold dark:text-gray-100">STRIKE</TableCell>
                                    <TableCell align="center" colSpan={2} className="bg-red-50 dark:bg-red-900/40 dark:text-red-100">PUTS</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="dark:text-gray-300">Select</TableCell>
                                    <TableCell align="right" className="dark:text-gray-300">LTP</TableCell>
                                    <TableCell align="center" className="dark:text-gray-300">Strike</TableCell>
                                    <TableCell align="right" className="dark:text-gray-300">LTP</TableCell>
                                    <TableCell align="right" className="dark:text-gray-300">Select</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {chain.map((row, idx) => {
                                    const isATM = idx === closestIndex;
                                    const ce = row.call_options?.market_data;
                                    const pe = row.put_options?.market_data;

                                    return (
                                        <TableRow key={row.strike_price} hover selected={isATM} className="dark:hover:bg-gray-700">
                                            {/* CALL */}
                                            <TableCell>
                                                {row.call_options && (
                                                    <Button
                                                        size="small"
                                                        variant="outlined"
                                                        color="success"
                                                        onClick={() => handleSelect(row.call_options.instrument_key, `${row.strike_price} CE`, String(row.strike_price))}
                                                    >
                                                        Use
                                                    </Button>
                                                )}
                                            </TableCell>
                                            <TableCell align="right" className={clsx(isATM ? "font-bold" : "", "dark:text-gray-200")}>
                                                {ce?.ltp || "-"}
                                            </TableCell>

                                            {/* STRIKE */}
                                            <TableCell align="center" className="bg-gray-50 dark:bg-gray-900 font-mono font-bold dark:text-white dark:border-gray-700">
                                                {row.strike_price}
                                            </TableCell>

                                            {/* PUT */}
                                            <TableCell align="right" className={clsx(isATM ? "font-bold" : "", "dark:text-gray-200")}>
                                                {pe?.ltp || "-"}
                                            </TableCell>
                                            <TableCell align="right">
                                                {row.put_options && (
                                                    <Button
                                                        size="small"
                                                        variant="outlined"
                                                        color="error"
                                                        onClick={() => handleSelect(row.put_options.instrument_key, `${row.strike_price} PE`, String(row.strike_price))}
                                                    >
                                                        Use
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
            </DialogActions>
        </Dialog>
    );
}
