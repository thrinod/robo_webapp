"use client";

import React, { useState, useEffect, useRef } from "react";
import StatsWidget from "@/components/StatsWidget";
import OptionChainModal from "@/components/OptionChainModal";
import { TextField, Button, Select, MenuItem, FormControl, InputLabel, Paper, Switch, FormControlLabel, IconButton, InputAdornment, Snackbar, Alert, ToggleButton, ToggleButtonGroup } from "@mui/material";
import { getExpiryDates, saveSnapshot, saveBasket, getBasket } from "@/services/api";
import { RefreshCw, Calendar, Search, Camera, Save, FolderOpen, UploadCloud } from "lucide-react";

export default function AnalysisPage() {
    // Keys
    const [indexKey, setIndexKey] = useState("NSE_INDEX|Nifty 50");
    const [apiType, setApiType] = useState<"history" | "intraday">("history");

    // Comparison Slots
    const [slot1Key, setSlot1Key] = useState("");
    const [slot1Label, setSlot1Label] = useState("");
    const [slot1Strike, setSlot1Strike] = useState("");

    const [slot2Key, setSlot2Key] = useState("");
    const [slot2Label, setSlot2Label] = useState("");
    const [slot2Strike, setSlot2Strike] = useState("");

    const [slot3Key, setSlot3Key] = useState("");
    const [slot3Label, setSlot3Label] = useState("");
    const [slot3Strike, setSlot3Strike] = useState("");

    const [slot4Key, setSlot4Key] = useState("");
    const [slot4Label, setSlot4Label] = useState("");
    const [slot4Strike, setSlot4Strike] = useState("");

    // Modal State
    const [modalOpen, setModalOpen] = useState(false);
    const [activeSlot, setActiveSlot] = useState<number>(0);

    // Expiry & Refresh
    const [expiryList, setExpiryList] = useState<string[]>([]);
    const [selectedExpiry, setSelectedExpiry] = useState("");
    const [loadingExpiries, setLoadingExpiries] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(true);

    // Individual Intervals
    const [indexInterval, setIndexInterval] = useState("1minute");
    const [slot1Interval, setSlot1Interval] = useState("1minute");
    const [slot2Interval, setSlot2Interval] = useState("1minute");
    const [slot3Interval, setSlot3Interval] = useState("1minute");
    const [slot4Interval, setSlot4Interval] = useState("1minute");

    // Snapshot Data Ref
    const snapshotRef = useRef<Record<string, any>>({});
    const [snackOpen, setSnackOpen] = useState(false);
    const [snackMsg, setSnackMsg] = useState("");
    const [snackSeverity, setSnackSeverity] = useState<"success" | "info" | "error">("success");

    // Basket State
    const [currentBasket, setCurrentBasket] = useState(1);
    const [basketName, setBasketName] = useState("Custom Basket");
    const [basketLoading, setBasketLoading] = useState(false);

    // Load last basket on mount
    useEffect(() => {
        const stored = localStorage.getItem("lastBasketId");
        if (stored) {
            const id = parseInt(stored);
            if (!isNaN(id)) setCurrentBasket(id);
        }
    }, []);

    // Load Basket Data when ID Changes
    useEffect(() => {
        loadBasketData(currentBasket);
        localStorage.setItem("lastBasketId", currentBasket.toString());
    }, [currentBasket]);

    const loadBasketData = async (id: number) => {
        setBasketLoading(true);
        const data = await getBasket(id);
        console.log(`Basket ${id} Loaded Data:`, data);
        if (data && data.indexKey) {
            setBasketName(data.name || `Basket ${id}`); // Load Name
            setIndexKey(data.indexKey);

            setSlot1Key(data.slot1Key || "");
            setSlot1Label(data.slot1Label || "");
            setSlot1Strike(data.slot1Strike || "");

            setSlot2Key(data.slot2Key || "");
            setSlot2Label(data.slot2Label || "");
            setSlot2Strike(data.slot2Strike || "");

            setSlot3Key(data.slot3Key || "");
            setSlot3Label(data.slot3Label || "");
            setSlot3Strike(data.slot3Strike || "");

            setSlot4Key(data.slot4Key || "");
            setSlot4Label(data.slot4Label || "");
            setSlot4Strike(data.slot4Strike || "");

            setIndexInterval(data.indexInterval || "1minute");
            setSlot1Interval(data.slot1Interval || "1minute");
            setSlot2Interval(data.slot2Interval || "1minute");
            setSlot3Interval(data.slot3Interval || "1minute");
            setSlot4Interval(data.slot4Interval || "1minute");

            showSnack(`Basket ${id} Loaded`, "info");
        } else {
            setBasketName(`Basket ${id}`);
        }
        setBasketLoading(false);
    };

    const handleSaveBasket = async () => {
        try {
            const payload = {
                name: basketName,
                indexKey,
                slot1Key, slot1Label, slot1Strike,
                slot2Key, slot2Label, slot2Strike,
                slot3Key, slot3Label, slot3Strike,
                slot4Key, slot4Label, slot4Strike,
                indexInterval, slot1Interval, slot2Interval, slot3Interval, slot4Interval
            };
            await saveBasket(currentBasket, payload);
            showSnack(`Basket ${currentBasket} Saved!`, "success");
        } catch (e) {
            showSnack("Failed to save basket", "error");
        }
    };

    // Fetch expiries on mount or manual trigger
    const fetchExpiries = async () => {
        setLoadingExpiries(true);
        try {
            const dates = await getExpiryDates(indexKey);
            if (dates.length > 0) {
                setExpiryList(dates);
                if (!selectedExpiry) setSelectedExpiry(dates[0]);
            } else {
                console.warn("No expiry dates found.");
            }
        } catch (e) {
            console.error("Error fetching expiries", e);
        }
        setLoadingExpiries(false);
    };

    const openModal = (slotId: number) => {
        setActiveSlot(slotId);
        setModalOpen(true);
    };

    const handleOptionSelect = (key: string, label: string, strike: string) => {
        console.log("Analysis Page Received:", key, label, strike);
        if (activeSlot === 1) { setSlot1Key(key); setSlot1Label(label); setSlot1Strike(strike); }
        if (activeSlot === 2) { setSlot2Key(key); setSlot2Label(label); setSlot2Strike(strike); }
        if (activeSlot === 3) { setSlot3Key(key); setSlot3Label(label); setSlot3Strike(strike); }
        if (activeSlot === 4) { setSlot4Key(key); setSlot4Label(label); setSlot4Strike(strike); }
    };

    const updateSnapshotData = (name: string, key: string, interval: string, data: any, strike: string) => {
        if (!key || !data) return;
        snapshotRef.current[name] = {
            name,
            instrument_key: key,
            interval,
            ltp: data.ltp || 0,
            strike_price: parseFloat(strike) || 0,
            indicators: data.indicators || {}
        };
    };

    const handleSaveSnapshot = async (type: string) => {
        const items = Object.values(snapshotRef.current);
        if (items.length === 0) {
            console.warn("No data available to save. Wait for charts to load.");
            return;
        }

        try {
            await saveSnapshot({
                snapshot_type: type,
                items: items,
                notes: `Manual ${type} Snapshot`
            });
            showSnack(`${type} Snapshot Saved!`, "success");
        } catch (e) {
            console.error(e);
            console.error("Failed to save snapshot");
        }
    };

    const showSnack = (msg: string, severity: "success" | "info" | "error" = "success") => {
        setSnackMsg(msg);
        setSnackSeverity(severity);
        setSnackOpen(true);
    };

    const handleApiTypeChange = (event: React.MouseEvent<HTMLElement>, newType: "history" | "intraday" | null) => {
        if (newType !== null) {
            setApiType(newType);
        }
    };

    return (
        <div className="p-4 space-y-6 pb-20">
            <Snackbar open={snackOpen} autoHideDuration={3000} onClose={() => setSnackOpen(false)}>
                <Alert onClose={() => setSnackOpen(false)} severity={snackSeverity} sx={{ width: '100%' }}>
                    {snackMsg}
                </Alert>
            </Snackbar>

            <Paper className="p-4 bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-20 transition-colors duration-200">
                <div className="flex flex-col xl:flex-row gap-4 items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Prediction Analysis</h1>

                        {/* Basket Selector */}
                        <Paper component="form" className="p-1 px-2 flex items-center bg-gray-50 dark:bg-gray-700 border dark:border-gray-600">
                            <span className="text-xs font-bold mr-2 text-gray-500 dark:text-gray-400">BASKET:</span>
                            <Select
                                value={currentBasket}
                                size="small"
                                variant="standard"
                                disableUnderline
                                onChange={(e) => setCurrentBasket(Number(e.target.value))}
                                className="font-bold text-blue-700 dark:text-blue-400 w-12"
                            >
                                {[1, 2, 3, 4, 5].map(i => <MenuItem key={i} value={i}>{i}</MenuItem>)}
                            </Select>

                            <TextField
                                value={basketName}
                                onChange={(e) => setBasketName(e.target.value)}
                                size="small"
                                variant="standard"
                                placeholder="Basket Name"
                                className="ml-2 w-32"
                                InputProps={{ className: "dark:text-white font-semibold text-sm", disableUnderline: true }}
                            />

                            <IconButton size="small" color="primary" onClick={handleSaveBasket} title="Save Basket Config">
                                <UploadCloud size={16} />
                            </IconButton>
                            <IconButton size="small" onClick={() => loadBasketData(currentBasket)} title="Reload Basket" disabled={basketLoading}>
                                <FolderOpen size={16} className="text-gray-600 dark:text-gray-300" />
                            </IconButton>
                        </Paper>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                        {/* API Toggle */}
                        <ToggleButtonGroup
                            color="primary"
                            value={apiType}
                            exclusive
                            onChange={handleApiTypeChange}
                            aria-label="API Type"
                            size="small"
                            className="bg-gray-100 dark:bg-gray-700"
                        >
                            <ToggleButton value="history" className="dark:text-gray-300">History</ToggleButton>
                            <ToggleButton value="intraday" className="dark:text-gray-300">Intraday</ToggleButton>
                        </ToggleButtonGroup>

                        <div className="h-6 w-px bg-gray-300 dark:bg-gray-600 mx-2"></div>

                        {/* Snapshot Buttons */}
                        <Button
                            variant="contained"
                            color="success"
                            startIcon={<Save />}
                            onClick={() => handleSaveSnapshot("BUY")}
                            size="small"
                        >
                            BUY
                        </Button>
                        <Button
                            variant="contained"
                            color="error"
                            startIcon={<Save />}
                            onClick={() => handleSaveSnapshot("SELL")}
                            size="small"
                        >
                            SELL
                        </Button>

                        <div className="h-6 w-px bg-gray-300 dark:bg-gray-600 mx-2"></div>

                        <FormControlLabel
                            control={<Switch checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} color="primary" />}
                            label="5s"
                            className="text-gray-800 dark:text-gray-200"
                        />

                        <Button
                            variant="outlined"
                            onClick={fetchExpiries}
                            disabled={loadingExpiries}
                            startIcon={<Calendar className="w-4 h-4" />}
                            size="small"
                            className="dark:text-gray-200 dark:border-gray-600"
                        >
                            {loadingExpiries ? "..." : "Expiries"}
                        </Button>

                        <FormControl size="small" className="min-w-[150px]">
                            <InputLabel className="dark:text-gray-400">Expiry</InputLabel>
                            <Select
                                value={selectedExpiry}
                                label="Expiry"
                                onChange={(e) => setSelectedExpiry(e.target.value)}
                                disabled={expiryList.length === 0}
                                className="dark:text-white"
                            >
                                {expiryList.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                            </Select>
                        </FormControl>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                    <TextField
                        label="Index Key"
                        size="small"
                        value={indexKey}
                        onChange={(e) => setIndexKey(e.target.value)}
                        className="dark:bg-gray-700 rounded"
                        InputLabelProps={{ className: "dark:text-gray-400" }}
                        InputProps={{ className: "dark:text-white" }}
                    />

                    {/* Slot 1 */}
                    <TextField
                        label={`Call 1 ${slot1Label ? `(${slot1Label})` : ''}`}
                        size="small"
                        value={slot1Key}
                        onChange={(e) => setSlot1Key(e.target.value)}
                        className="dark:bg-gray-700 rounded"
                        InputLabelProps={{ className: "dark:text-gray-400" }}
                        InputProps={{
                            className: "dark:text-white",
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton size="small" onClick={() => openModal(1)}><Search size={16} className="dark:text-gray-300" /></IconButton>
                                </InputAdornment>
                            )
                        }}
                    />

                    {/* Slot 2 */}
                    <TextField
                        label={`Call 2 ${slot2Label ? `(${slot2Label})` : ''}`}
                        size="small"
                        value={slot2Key}
                        onChange={(e) => setSlot2Key(e.target.value)}
                        className="dark:bg-gray-700 rounded"
                        InputLabelProps={{ className: "dark:text-gray-400" }}
                        InputProps={{
                            className: "dark:text-white",
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton size="small" onClick={() => openModal(2)}><Search size={16} className="dark:text-gray-300" /></IconButton>
                                </InputAdornment>
                            )
                        }}
                    />

                    {/* Slot 3 */}
                    <TextField
                        label={`Put 1 ${slot3Label ? `(${slot3Label})` : ''}`}
                        size="small"
                        value={slot3Key}
                        onChange={(e) => setSlot3Key(e.target.value)}
                        className="dark:bg-gray-700 rounded"
                        InputLabelProps={{ className: "dark:text-gray-400" }}
                        InputProps={{
                            className: "dark:text-white",
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton size="small" onClick={() => openModal(3)}><Search size={16} className="dark:text-gray-300" /></IconButton>
                                </InputAdornment>
                            )
                        }}
                    />

                    {/* Slot 4 */}
                    <TextField
                        label={`Put 2 ${slot4Label ? `(${slot4Label})` : ''}`}
                        size="small"
                        value={slot4Key}
                        onChange={(e) => setSlot4Key(e.target.value)}
                        className="dark:bg-gray-700 rounded"
                        InputLabelProps={{ className: "dark:text-gray-400" }}
                        InputProps={{
                            className: "dark:text-white",
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton size="small" onClick={() => openModal(4)}><Search size={16} className="dark:text-gray-300" /></IconButton>
                                </InputAdornment>
                            )
                        }}
                    />
                </div>
            </Paper>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {/* Index Chart */}
                <div className="h-full">
                    <StatsWidget
                        title="Index"
                        subtitle=""
                        instrumentKey={indexKey}
                        interval={indexInterval}
                        apiType={apiType}
                        onIntervalChange={setIndexInterval}
                        autoRefresh={autoRefresh}
                        onDataUpdate={(d) => updateSnapshotData("Index", indexKey, indexInterval, d, "")}
                    />
                </div>

                {/* Call 1 */}
                <div className="h-full">
                    <StatsWidget
                        title={`Call 1 ${slot1Label ? `(${slot1Label})` : ''}`}
                        subtitle={slot1Strike ? `Strike: ${slot1Strike}` : ''}
                        instrumentKey={slot1Key}
                        interval={slot1Interval}
                        apiType={apiType}
                        onIntervalChange={setSlot1Interval}
                        autoRefresh={autoRefresh}
                        onDataUpdate={(d) => updateSnapshotData("Call 1", slot1Key, slot1Interval, d, slot1Strike)}
                    />
                </div>

                {/* Call 2 */}
                <div className="h-full">
                    <StatsWidget
                        title={`Call 2 ${slot2Label ? `(${slot2Label})` : ''}`}
                        subtitle={slot2Strike ? `Strike: ${slot2Strike}` : ''}
                        instrumentKey={slot2Key}
                        interval={slot2Interval}
                        apiType={apiType}
                        onIntervalChange={setSlot2Interval}
                        autoRefresh={autoRefresh}
                        onDataUpdate={(d) => updateSnapshotData("Call 2", slot2Key, slot2Interval, d, slot2Strike)}
                    />
                </div>

                {/* Put 1 */}
                <div className="h-full">
                    <StatsWidget
                        title={`Put 1 ${slot3Label ? `(${slot3Label})` : ''}`}
                        subtitle={slot3Strike ? `Strike: ${slot3Strike}` : ''}
                        instrumentKey={slot3Key}
                        interval={slot3Interval}
                        apiType={apiType}
                        onIntervalChange={setSlot3Interval}
                        autoRefresh={autoRefresh}
                        onDataUpdate={(d) => updateSnapshotData("Put 1", slot3Key, slot3Interval, d, slot3Strike)}
                    />
                </div>

                {/* Put 2 */}
                <div className="h-full">
                    <StatsWidget
                        title={`Put 2 ${slot4Label ? `(${slot4Label})` : ''}`}
                        subtitle={slot4Strike ? `Strike: ${slot4Strike}` : ''}
                        instrumentKey={slot4Key}
                        interval={slot4Interval}
                        apiType={apiType}
                        onIntervalChange={setSlot4Interval}
                        autoRefresh={autoRefresh}
                        onDataUpdate={(d) => updateSnapshotData("Put 2", slot4Key, slot4Interval, d, slot4Strike)}
                    />
                </div>
            </div>

            {/* Selection Modal */}
            <OptionChainModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                indexKey={indexKey}
                onSelect={handleOptionSelect}
            />
        </div>
    );
}

