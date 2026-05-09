"use client";

import React, { useState, useEffect } from 'react';
import { getMockPositions, exitMockPosition, getMockHistory } from '@/services/api';
import { 
    Activity, Clock, RefreshCw, XCircle, ChevronUp, ChevronDown, 
    TrendingUp, TrendingDown, Target, History, LayoutDashboard, ShieldAlert
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function MockTradesPage() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'OPEN' | 'HISTORY'>('OPEN');
    
    // Open Positions
    const [positions, setPositions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    // History
    const [history, setHistory] = useState<any[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    useEffect(() => {
        if (activeTab === 'OPEN') {
            fetchPositions();
            const interval = setInterval(fetchPositions, 2000); // Live update P&L
            return () => clearInterval(interval);
        } else {
            fetchHistory();
        }
    }, [activeTab]);

    const fetchPositions = async () => {
        try {
            const data = await getMockPositions();
            setPositions(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error fetching mock positions:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchHistory = async () => {
        setHistoryLoading(true);
        try {
            const data = await getMockHistory();
            setHistory(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error fetching mock history:", error);
        } finally {
            setHistoryLoading(false);
        }
    };

    const handleExit = async (id: string) => {
        if (confirm("Are you sure you want to market exit this mock position?")) {
            await exitMockPosition(id);
            fetchPositions();
        }
    };

    const totalOpenPnL = positions.reduce((acc, p) => acc + (p.pnl || 0), 0);
    const totalHistoryPnL = history.reduce((acc, p) => acc + (p.pnl || 0), 0);

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
                        <Activity className="w-8 h-8 text-indigo-500" />
                        Mock Trading
                    </h1>
                    <p className="text-gray-400 mt-1">Paper trading environment for strategy validation</p>
                </div>
                
                <div className="flex bg-gray-900/50 p-1 rounded-xl border border-gray-800">
                    <button 
                        onClick={() => setActiveTab('OPEN')}
                        className={`px-6 py-2.5 rounded-lg flex items-center gap-2 font-medium transition-all ${activeTab === 'OPEN' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                    >
                        <LayoutDashboard className="w-4 h-4" />
                        Open Positions
                        {positions.length > 0 && activeTab !== 'OPEN' && (
                            <span className="bg-indigo-500 text-white text-[10px] px-2 py-0.5 rounded-full ml-1">{positions.length}</span>
                        )}
                    </button>
                    <button 
                        onClick={() => setActiveTab('HISTORY')}
                        className={`px-6 py-2.5 rounded-lg flex items-center gap-2 font-medium transition-all ${activeTab === 'HISTORY' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                    >
                        <History className="w-4 h-4" />
                        Trade History
                    </button>
                </div>
            </div>

            {/* Total P&L Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl flex items-center justify-between">
                    <div>
                        <p className="text-gray-400 text-sm font-medium mb-1">Live Unrealized P&L</p>
                        <h2 className={`text-3xl font-bold ${totalOpenPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {totalOpenPnL >= 0 ? '+' : '-'}₹{Math.abs(totalOpenPnL).toFixed(2)}
                        </h2>
                    </div>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${totalOpenPnL >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                        {totalOpenPnL >= 0 ? <TrendingUp className={`w-6 h-6 text-green-500`} /> : <TrendingDown className={`w-6 h-6 text-red-500`} />}
                    </div>
                </div>
                
                <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl flex items-center justify-between">
                    <div>
                        <p className="text-gray-400 text-sm font-medium mb-1">Historical Realized P&L</p>
                        <h2 className={`text-3xl font-bold ${totalHistoryPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {totalHistoryPnL >= 0 ? '+' : '-'}₹{Math.abs(totalHistoryPnL).toFixed(2)}
                        </h2>
                    </div>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${totalHistoryPnL >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                        <Target className={`w-6 h-6 ${totalHistoryPnL >= 0 ? 'text-green-500' : 'text-red-500'}`} />
                    </div>
                </div>
            </div>

            {/* Content Area */}
            {activeTab === 'OPEN' ? (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
                    <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-800/20">
                        <h3 className="font-semibold text-white flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            Live Positions ({positions.length})
                        </h3>
                        {loading && positions.length === 0 && <RefreshCw className="w-4 h-4 text-gray-500 animate-spin" />}
                    </div>
                    
                    {positions.length === 0 && !loading ? (
                        <div className="p-12 text-center flex flex-col items-center justify-center">
                            <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-4">
                                <ShieldAlert className="w-8 h-8 text-gray-500" />
                            </div>
                            <p className="text-gray-400 font-medium">No open mock positions</p>
                            <p className="text-gray-600 text-sm mt-2">Deploy a strategy in MOCK mode to see live trades here.</p>
                            <button onClick={() => router.push('/backtest')} className="mt-6 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg transition-all text-sm font-medium">
                                Go to Backtester
                            </button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-800/40 text-gray-400 text-xs uppercase tracking-wider">
                                        <th className="p-4 font-medium rounded-tl-xl">Instrument</th>
                                        <th className="p-4 font-medium">Side</th>
                                        <th className="p-4 font-medium text-right">Qty</th>
                                        <th className="p-4 font-medium text-right">Avg Price</th>
                                        <th className="p-4 font-medium text-right">Live Price</th>
                                        <th className="p-4 font-medium text-right">P&L</th>
                                        <th className="p-4 font-medium text-center rounded-tr-xl">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800 text-sm">
                                    {positions.map((pos) => (
                                        <tr key={pos.trade_id} className="hover:bg-gray-800/20 transition-colors group">
                                            <td className="p-4">
                                                <div className="font-bold text-white">{pos.trading_symbol || pos.instrument_key}</div>
                                                <div className="text-[10px] text-gray-500 mt-1 flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {new Date(pos.timestamp).toLocaleTimeString()}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${pos.transaction_type === 'BUY' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                                    {pos.transaction_type}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right font-mono text-gray-300">{pos.quantity}</td>
                                            <td className="p-4 text-right font-mono text-gray-400">₹{pos.average_price?.toFixed(2)}</td>
                                            <td className="p-4 text-right font-mono">
                                                <div className="flex items-center justify-end gap-2">
                                                    {pos.last_price > pos.average_price ? (
                                                        <ChevronUp className="w-4 h-4 text-green-500" />
                                                    ) : pos.last_price < pos.average_price ? (
                                                        <ChevronDown className="w-4 h-4 text-red-500" />
                                                    ) : null}
                                                    <span className="text-gray-200">₹{pos.last_price?.toFixed(2) || '---'}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-right">
                                                <span className={`font-bold font-mono px-3 py-1.5 rounded-lg ${
                                                    (pos.pnl || 0) > 0 ? 'bg-green-500/10 text-green-400' : 
                                                    (pos.pnl || 0) < 0 ? 'bg-red-500/10 text-red-400' : 'text-gray-400'
                                                }`}>
                                                    {(pos.pnl || 0) > 0 ? '+' : ''}₹{(pos.pnl || 0).toFixed(2)}
                                                </span>
                                            </td>
                                            <td className="p-4 text-center">
                                                <button
                                                    onClick={() => handleExit(pos.trade_id)}
                                                    className="opacity-0 group-hover:opacity-100 transition-opacity bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 mx-auto border border-red-500/20"
                                                >
                                                    <XCircle className="w-3.5 h-3.5" />
                                                    Exit Market
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
                    <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-800/20">
                        <h3 className="font-semibold text-white flex items-center gap-2">
                            <History className="w-4 h-4 text-indigo-400" />
                            Trade History ({history.length})
                        </h3>
                        <button onClick={fetchHistory} className="text-gray-500 hover:text-white p-1 rounded-md hover:bg-gray-800 transition-colors">
                            <RefreshCw className={`w-4 h-4 ${historyLoading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                    
                    {history.length === 0 && !historyLoading ? (
                        <div className="p-12 text-center flex flex-col items-center justify-center">
                            <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-4">
                                <History className="w-8 h-8 text-gray-500" />
                            </div>
                            <p className="text-gray-400 font-medium">No history available</p>
                            <p className="text-gray-600 text-sm mt-2">Completed mock trades will appear here.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-800/40 text-gray-400 text-xs uppercase tracking-wider">
                                        <th className="p-4 font-medium rounded-tl-xl">Instrument</th>
                                        <th className="p-4 font-medium">Side</th>
                                        <th className="p-4 font-medium text-right">Qty</th>
                                        <th className="p-4 font-medium text-right">Entry</th>
                                        <th className="p-4 font-medium text-right">Exit</th>
                                        <th className="p-4 font-medium text-right">Final P&L</th>
                                        <th className="p-4 font-medium text-right rounded-tr-xl">Duration</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800 text-sm">
                                    {history.map((pos) => {
                                        const durationMs = new Date(pos.exit_timestamp).getTime() - new Date(pos.timestamp).getTime();
                                        const mins = Math.floor(durationMs / 60000);
                                        const hrs = Math.floor(mins / 60);
                                        const durationStr = hrs > 0 ? `${hrs}h ${mins % 60}m` : `${mins}m`;

                                        return (
                                            <tr key={pos.trade_id} className="hover:bg-gray-800/20 transition-colors">
                                                <td className="p-4">
                                                    <div className="font-bold text-white">{pos.trading_symbol || pos.instrument_key}</div>
                                                    <div className="text-[10px] text-gray-500 mt-1 flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        {new Date(pos.exit_timestamp).toLocaleString()}
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${pos.transaction_type === 'BUY' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                                        {pos.transaction_type}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right font-mono text-gray-300">{pos.quantity}</td>
                                                <td className="p-4 text-right font-mono text-gray-400">₹{pos.average_price?.toFixed(2)}</td>
                                                <td className="p-4 text-right font-mono text-gray-300">₹{pos.exit_price?.toFixed(2)}</td>
                                                <td className="p-4 text-right">
                                                    <span className={`font-bold font-mono ${
                                                        (pos.pnl || 0) > 0 ? 'text-green-500' : 
                                                        (pos.pnl || 0) < 0 ? 'text-red-500' : 'text-gray-400'
                                                    }`}>
                                                        {(pos.pnl || 0) > 0 ? '+' : ''}₹{(pos.pnl || 0).toFixed(2)}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right text-xs text-gray-500">
                                                    {durationStr}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
