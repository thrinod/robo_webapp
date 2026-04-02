"use client";

import { useEffect, useState } from "react";
import { getCollections, getCollectionData } from "@/services/api";
import {
    TextField, Button, Chip, Card, CardContent, Typography,
    InputAdornment, IconButton
} from "@mui/material";
import { Search, Database } from "lucide-react";

export default function DataViewer() {
    const [collections, setCollections] = useState<string[]>([]);
    const [selected, setSelected] = useState("");
    const [data, setData] = useState<any[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadCols();
    }, []);

    useEffect(() => {
        if (selected) loadData();
    }, [selected]);

    const loadCols = async () => {
        const cols = await getCollections();
        setCollections(cols);
        if (cols.length > 0) setSelected(cols[0]);
    };

    const loadData = async () => {
        setLoading(true);
        const d = await getCollectionData(selected, search);
        setData(d);
        setLoading(false);
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        loadData();
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center space-x-2">
                <Database className="text-blue-600" />
                <h1 className="text-2xl font-bold">Data Viewer</h1>
            </div>

            {/* Collection Selector */}
            <div className="flex flex-wrap gap-2 p-4 bg-white dark:bg-gray-800 rounded shadow-sm">
                {collections.map(col => (
                    <Chip
                        key={col}
                        label={col}
                        onClick={() => setSelected(col)}
                        color={selected === col ? "primary" : "default"}
                        variant={selected === col ? "filled" : "outlined"}
                        className="cursor-pointer dark:text-gray-200 dark:border-gray-600"
                    />
                ))}
            </div>

            {/* Search & Content */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
                <form onSubmit={handleSearch} className="flex gap-2 mb-4">
                    <TextField
                        size="small"
                        fullWidth
                        placeholder="Search JSON..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="dark:bg-gray-700"
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <Search size={18} className="dark:text-gray-400" />
                                </InputAdornment>
                            ),
                            className: "dark:text-white"
                        }}
                    />
                    <Button variant="contained" type="submit" disabled={loading}>
                        Search
                    </Button>
                </form>

                <div className="grid grid-cols-1 gap-4">
                    {loading ? (
                        <Typography className="dark:text-gray-300">Loading...</Typography>
                    ) : data.length === 0 ? (
                        <Typography color="textSecondary" className="dark:text-gray-400">No records found.</Typography>
                    ) : (
                        data.map((item, idx) => (
                            <Card key={item._id || idx} variant="outlined" className="bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700">
                                <CardContent>
                                    <pre className="text-xs overflow-x-auto whitespace-pre-wrap font-mono text-gray-800 dark:text-gray-300">
                                        {JSON.stringify(item, null, 2)}
                                    </pre>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
