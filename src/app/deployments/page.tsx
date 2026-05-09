"use client";

import React, { useState, useEffect } from 'react';
import { listDeployments, stopDeployment, deleteDeployment, getDeploymentLogs, startDeployment, testDeployTrigger } from '@/services/api';
import { Rocket, Power, Clock, Activity, AlertCircle, CheckCircle2, StopCircle, RefreshCw, Trash2, ChevronDown, ChevronUp, FileText, Eye, X, Zap } from 'lucide-react';

export default function DeploymentsPage() {
    const [deployments, setDeployments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [logsMap, setLogsMap] = useState<Record<string, any[]>>({});
    const [logsLoading, setLogsLoading] = useState<string | null>(null);

    const fetchDeployments = async () => {
        if (deployments.length === 0) setLoading(true);
        const data = await listDeployments();
        setDeployments(data);
        setLoading(false);
        
        // If there's an expanded deployment, refresh its logs too
        if (expandedId) {
            const logs = await getDeploymentLogs(expandedId);
            setLogsMap(prev => ({ ...prev, [expandedId]: logs }));
        }
    };

    useEffect(() => {
        fetchDeployments();
        const interval = setInterval(fetchDeployments, 10000); // 10s interval for better live tracking
        return () => clearInterval(interval);
    }, [expandedId]); // Re-run effect when expandedId changes to ensure immediate log fetch

    const handleStop = async (id: string) => {
        if (confirm("Are you sure you want to stop this strategy?")) {
            await stopDeployment(id);
            fetchDeployments();
        }
    };

    const handleStart = async (id: string) => {
        await startDeployment(id);
        fetchDeployments();
    };

    const handleDelete = async (id: string) => {
        if (confirm("Delete this deployment and ALL its logs permanently? This cannot be undone.")) {
            await deleteDeployment(id);
            setExpandedId(null);
            fetchDeployments();
        }
    };

    const handleTestTrigger = async (id: string) => {
        if (confirm("This will FORCE a trade execution for this strategy immediately (ignoring all technical conditions). Are you sure?")) {
            await testDeployTrigger(id);
            fetchDeployments();
        }
    };

    const handleToggleLogs = async (id: string) => {
        if (expandedId === id) {
            setExpandedId(null);
            return;
        }
        setExpandedId(id);
        setLogsLoading(id);
        const logs = await getDeploymentLogs(id);
        setLogsMap(prev => ({ ...prev, [id]: logs }));
        setLogsLoading(null);
    };

    const getStatusBadge = (status: string) => {
        const colors: any = {
            'ACTIVE': 'bg-green-500/10 text-green-500 border-green-500/20',
            'TRADED': 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
            'STOPPED': 'bg-gray-500/10 text-gray-500 border-gray-500/20',
        };
        return (
            <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${colors[status] || 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'}`}>
                {status}
            </span>
        );
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white p-4 md:p-8">
            <div className="max-w-6xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-3">
                            <Rocket className="w-8 h-8 text-indigo-500" />
                            Live Deployments
                        </h1>
                        <p className="text-gray-400 mt-2">Monitor, inspect logs, and manage your deployed trading strategies</p>
                    </div>
                    <button
                        onClick={fetchDeployments}
                        className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg transition-all text-sm"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>

                {/* Content */}
                {loading && deployments.length === 0 ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin h-10 w-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full"></div>
                    </div>
                ) : deployments.length === 0 ? (
                    <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-12 text-center">
                        <div className="bg-gray-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Rocket className="w-8 h-8 text-gray-600" />
                        </div>
                        <h3 className="text-xl font-semibold mb-2">No Deployments Found</h3>
                        <p className="text-gray-500 max-w-sm mx-auto mb-6">Deploy a strategy from the Backtester to get started.</p>
                        <a href="/backtest" className="bg-indigo-600 hover:bg-indigo-500 px-6 py-2 rounded-lg transition-all font-medium">Go to Backtester</a>
                    </div>
                ) : (
                    <div className="grid gap-6">
                        {deployments.map((dep) => {
                            const isExpanded = expandedId === dep._id;
                            const logs = logsMap[dep._id] || [];

                            return (
                                <div key={dep._id} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-xl transition-all">
                                    {/* Main Card */}
                                    <div className="p-6">
                                        <div className="flex flex-col md:flex-row justify-between gap-6">
                                            <div className="flex gap-4">
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${dep.deployment_mode === 'LIVE' ? 'bg-red-500/10' : 'bg-indigo-500/10'}`}>
                                                    <Activity className={`w-6 h-6 ${dep.deployment_mode === 'LIVE' ? 'text-red-500' : 'text-indigo-500'}`} />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                        <h3 className="text-lg font-bold text-white">{dep.primary_instrument}</h3>
                                                        {getStatusBadge(dep.status)}
                                                        <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold ${dep.deployment_mode === 'LIVE' ? 'bg-red-900/30 text-red-400' : 'bg-blue-900/30 text-blue-400'}`}>
                                                            {dep.deployment_mode}
                                                        </span>
                                                        {dep.trade_instrument_key && dep.trade_instrument_key !== dep.primary_instrument && (
                                                            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-900/30 text-amber-400 font-bold">
                                                                Exec: {dep.trade_instrument_key}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                                                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(dep.deployed_at).toLocaleString()}</span>
                                                        <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> {dep.interval || 'N/A'}</span>
                                                        <span className="flex items-center gap-1 font-mono text-indigo-400">Qty: {dep.quantity}</span>
                                                        <span className="font-mono text-[10px]">ID: {dep._id?.slice(-6)}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0 flex-wrap">
                                                <button
                                                    onClick={() => handleToggleLogs(dep._id)}
                                                    className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-2 rounded-lg transition-all text-xs font-medium border border-gray-700"
                                                >
                                                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                                    {isExpanded ? 'Hide Logs' : 'View Logs'}
                                                </button>
                                                {dep.status === 'ACTIVE' || dep.status === 'TRADED' ? (
                                                    <button
                                                        onClick={() => handleStop(dep._id)}
                                                        className="flex items-center gap-1.5 bg-amber-600/10 hover:bg-amber-600 text-amber-500 hover:text-white px-3 py-2 rounded-lg transition-all text-xs font-medium border border-amber-500/20"
                                                    >
                                                        <Power className="w-3.5 h-3.5" />
                                                        Stop
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handleStart(dep._id)}
                                                        className="flex items-center gap-1.5 bg-green-600/10 hover:bg-green-600 text-green-500 hover:text-white px-3 py-2 rounded-lg transition-all text-xs font-medium border border-green-500/20"
                                                    >
                                                        <Power className="w-3.5 h-3.5" />
                                                        Resume
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleTestTrigger(dep._id)}
                                                    className="flex items-center gap-1.5 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-500 hover:text-white px-3 py-2 rounded-lg transition-all text-xs font-medium border border-indigo-500/20"
                                                >
                                                    <Zap className="w-3.5 h-3.5" />
                                                    Test Fire
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(dep._id)}
                                                    className="flex items-center gap-1.5 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white px-3 py-2 rounded-lg transition-all text-xs font-medium border border-red-500/20"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                    Delete
                                                </button>
                                            </div>
                                        </div>

                                        {/* Strategy Info Grid */}
                                        <div className="mt-6 pt-6 border-t border-gray-800 grid grid-cols-2 md:grid-cols-5 gap-3">
                                            <div className="bg-black/20 p-3 rounded-xl border border-gray-800/50">
                                                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Direction</p>
                                                <p className={`font-bold text-sm ${dep.trade_type === 'LONG' ? 'text-green-500' : 'text-red-500'}`}>{dep.trade_type || 'LONG'}</p>
                                            </div>
                                            <div className="bg-black/20 p-3 rounded-xl border border-gray-800/50">
                                                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Stop Loss</p>
                                                <p className="font-bold text-sm text-red-400">{dep.stop_loss}%</p>
                                            </div>
                                            <div className="bg-black/20 p-3 rounded-xl border border-gray-800/50">
                                                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Take Profit</p>
                                                <p className="font-bold text-sm text-green-400">{dep.take_profit}%</p>
                                            </div>
                                            <div className="bg-black/20 p-3 rounded-xl border border-gray-800/50">
                                                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Mode</p>
                                                <p className="font-bold text-sm text-gray-300">{dep.is_advanced ? 'Advanced' : 'Simple'}</p>
                                            </div>
                                            <div className="bg-black/20 p-3 rounded-xl border border-gray-800/50">
                                                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Days Back</p>
                                                <p className="font-bold text-sm text-gray-300">{dep.days_back || 'N/A'}</p>
                                            </div>
                                        </div>

                                        {/* Saved Strategies Display */}
                                        {dep.saved_strategies && dep.saved_strategies.length > 0 && (
                                            <div className="mt-4 space-y-2">
                                                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Applied Strategies</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {dep.saved_strategies.map((s: any, si: number) => (
                                                        <div key={si} className="bg-indigo-500/5 border border-indigo-500/20 rounded-lg px-3 py-2 text-xs">
                                                            <span className="text-indigo-400 font-bold">{s.name || 'Unnamed'}</span>
                                                            <span className="text-gray-600 ml-2">{s.rules?.length || 0} rules</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Execution Plan Legs */}
                                        {dep.execution_plan && dep.execution_plan.length > 0 && (
                                            <div className="mt-4 space-y-2">
                                                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Execution Plan ({dep.execution_plan.length} Legs)</p>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                    {dep.execution_plan.map((leg: any, li: number) => (
                                                        <div key={li} className="bg-gray-800/50 border border-gray-700 rounded-lg p-2 text-xs flex items-center gap-3">
                                                            <span className="bg-gray-700 text-gray-300 px-2 py-0.5 rounded font-mono text-[10px]">Leg {li + 1}</span>
                                                            <span className="text-white font-medium flex-1 truncate">{leg.leg}</span>
                                                            <span className="text-gray-500">{leg.timeframe}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Traded banner */}
                                        {dep.status === 'TRADED' && dep.last_trade_at && (
                                            <div className="mt-4 p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-xl flex items-center justify-between">
                                                <div className="flex items-center gap-2 text-indigo-400 text-sm">
                                                    <CheckCircle2 className="w-4 h-4" />
                                                    <span>Signal triggered and trade executed</span>
                                                </div>
                                                <span className="text-[10px] text-gray-500">{new Date(dep.last_trade_at).toLocaleString()}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Expandable Logs Panel */}
                                    {isExpanded && (
                                        <div className="border-t border-gray-800 bg-black/30">
                                            <div className="p-4 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <FileText className="w-4 h-4 text-gray-400" />
                                                    <h4 className="text-sm font-semibold text-gray-200">Evaluation Logs (Last 24h)</h4>
                                                    <span className="text-[10px] text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">{logs.length} entries</span>
                                                </div>
                                                <button onClick={() => setExpandedId(null)} className="text-gray-500 hover:text-gray-300">
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>

                                            {logsLoading === dep._id ? (
                                                <div className="p-8 flex justify-center">
                                                    <div className="animate-spin h-6 w-6 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full"></div>
                                                </div>
                                            ) : logs.length === 0 ? (
                                                <div className="p-8 text-center text-gray-600 text-sm">
                                                    No logs found in the last 24 hours. The engine may not have evaluated this strategy yet.
                                                </div>
                                            ) : (
                                                <div className="max-h-[500px] overflow-y-auto">
                                                    <table className="w-full text-xs">
                                                        <thead className="sticky top-0 bg-gray-900 z-10">
                                                            <tr className="text-gray-500 text-[10px] uppercase tracking-wider">
                                                                <th className="px-4 py-2 text-left">Time</th>
                                                                <th className="px-4 py-2 text-left">Instrument</th>
                                                                <th className="px-4 py-2 text-right">Close</th>
                                                                <th className="px-4 py-2 text-center">Signal</th>
                                                                <th className="px-4 py-2 text-center">Traded</th>
                                                                <th className="px-4 py-2 text-left">Rule Results</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {logs.map((log: any, li: number) => (
                                                                <tr key={li} className={`border-t border-gray-800/50 hover:bg-gray-800/30 transition-colors ${log.signal ? 'bg-green-500/5' : ''} ${log.error ? 'bg-red-500/5' : ''}`}>
                                                                    <td className="px-4 py-2.5 text-gray-400 font-mono whitespace-nowrap">
                                                                        {new Date(log.timestamp).toLocaleTimeString()}
                                                                    </td>
                                                                    <td className="px-4 py-2.5 text-white font-medium truncate max-w-[150px]">{log.instrument}</td>
                                                                    <td className="px-4 py-2.5 text-right font-mono text-gray-300">
                                                                        {log.close_price ? `₹${log.close_price?.toFixed(2)}` : '—'}
                                                                    </td>
                                                                    <td className="px-4 py-2.5 text-center">
                                                                        {log.error ? (
                                                                            <span className="text-red-500 font-bold text-[10px]">ERR</span>
                                                                        ) : log.signal ? (
                                                                            <span className="inline-flex items-center gap-1 text-green-500 font-bold">
                                                                                <CheckCircle2 className="w-3 h-3" /> YES
                                                                            </span>
                                                                        ) : (
                                                                            <span className="text-gray-600">NO</span>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-4 py-2.5 text-center">
                                                                        {log.traded ? (
                                                                            <span className="text-indigo-400 font-bold">EXECUTED</span>
                                                                        ) : (
                                                                            <span className="text-gray-600">—</span>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-4 py-2.5">
                                                                        {log.error ? (
                                                                            <span className="text-red-400 text-[10px] font-mono">{log.error}</span>
                                                                        ) : (
                                                                            <div className="flex flex-wrap gap-1.5">
                                                                                {log.rules?.map((r: any, ri: number) => (
                                                                                    <span
                                                                                        key={ri}
                                                                                        title={`${r.rule}: ${r.left} vs ${r.right}`}
                                                                                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono border ${
                                                                                            r.matched
                                                                                                ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                                                                                : 'bg-red-500/10 text-red-400 border-red-500/20'
                                                                                        }`}
                                                                                    >
                                                                                        {r.matched ? '✓' : '✗'} {r.rule?.length > 25 ? r.rule.substring(0, 25) + '…' : r.rule}
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
