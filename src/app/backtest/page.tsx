"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { runBacktest, searchInstruments, deployStrategy } from '@/services/api';
import { Play, Search, TrendingUp, TrendingDown, Percent, DollarSign, Activity, ChevronDown, ChevronUp, Info, Wallet, Rocket, X } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

export default function BacktestPage() {
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    
    const [selectedInstrument, setSelectedInstrument] = useState<any>(null);
    const [interval, setInterval] = useState("15minute");
    const [daysBack, setDaysBack] = useState(30);
    const [stopLoss, setStopLoss] = useState(1.0);
    const [takeProfit, setTakeProfit] = useState(2.0);
    const [tradeType, setTradeType] = useState<"LONG" | "SHORT">("LONG");
    const [tradeInstrument, setTradeInstrument] = useState<any>(null);
    const [useIntraday, setUseIntraday] = useState(false);
    const [isTradeSearching, setIsTradeSearching] = useState(false);
    const [tradeSearchQuery, setTradeSearchQuery] = useState("");
    const [tradeSearchResults, setTradeSearchResults] = useState<any[]>([]);
    
    // Strategy Builder State
    const [strategyMode, setStrategyMode] = useState<"simple" | "advanced">("simple");
    const [simpleStrategyId, setSimpleStrategyId] = useState<string>("default");
    const [savedStrategies, setSavedStrategies] = useState<any[]>([]);
    const [executionPlan, setExecutionPlan] = useState<any[]>([
        { id: 1, strategyId: "", timeframe: "5minute", leg: "CE" },
        { id: 2, strategyId: "", timeframe: "15minute", leg: "CE" }
    ]);
    
    useEffect(() => {
        const saved = localStorage.getItem("robotrader_strategies");
        if (saved) {
            setSavedStrategies(JSON.parse(saved));
        }
    }, []);
    
    const [isRunning, setIsRunning] = useState(false);
    const [results, setResults] = useState<any>(null);
    const [expandedSignal, setExpandedSignal] = useState<number | null>(null);

    // Deployment State
    const [showDeployModal, setShowDeployModal] = useState(false);
    const [deploymentMode, setDeploymentMode] = useState<"MOCK" | "LIVE">("MOCK");
    const [deployQuantity, setDeployQuantity] = useState(1);
    const [deployQuantityType, setDeployQuantityType] = useState<"MANUAL" | "CAPITAL" | "PERCENTAGE">("MANUAL");
    const [deployCapitalToUse, setDeployCapitalToUse] = useState<number>(100000);
    const [deployCapitalPercentage, setDeployCapitalPercentage] = useState<number>(50);
    const [deployLotSize, setDeployLotSize] = useState<number>(25);
    const [isDeploying, setIsDeploying] = useState(false);
    const [deploySuccess, setDeploySuccess] = useState<string | null>(null);

    const handleSearch = async (query: string) => {
        setSearchQuery(query);
        if (!query || query.length < 2) {
            setSearchResults([]);
            return;
        }
        
        setIsSearching(true);
        const data = await searchInstruments(query);
        setSearchResults(data);
        setIsSearching(false);
    };

    const activeKey = selectedInstrument?.instrument_key || (searchQuery.includes('|') ? searchQuery : null);

    const handleRunBacktest = async () => {
        if (strategyMode === 'simple' && !activeKey) return;
        if (strategyMode === 'advanced') {
            const isValid = executionPlan.length > 0 && executionPlan.every(p => p.strategyId && p.leg);
            if (!isValid) {
                alert("Please select a strategy and provide an Instrument Key for all execution legs.");
                return;
            }
        }
        
        setIsRunning(true);
        setResults(null);
        
        // In advanced mode, we need to send the executionPlan and savedStrategies to the backend
        let payload: any = {
            days_back: daysBack,
            stop_loss: stopLoss,
            take_profit: takeProfit,
            trade_type: tradeType,
            trade_instrument_key: tradeInstrument?.instrument_key || null,
            is_advanced: strategyMode === 'advanced' || (strategyMode === 'simple' && simpleStrategyId !== 'default'),
            use_intraday: useIntraday
        };
        
        if (strategyMode === 'advanced') {
            payload.execution_plan = executionPlan;
            payload.saved_strategies = savedStrategies;
        } else if (strategyMode === 'simple' && simpleStrategyId !== 'default') {
            // Transform simple mode with custom strategy into a 1-leg advanced plan
            payload.execution_plan = [{
                id: Date.now(),
                strategyId: simpleStrategyId,
                timeframe: interval,
                leg: activeKey
            }];
            payload.saved_strategies = savedStrategies;
        } else {
            payload.instrument_key = activeKey;
            payload.interval = interval;
        }
        
        try {
            const data = await runBacktest(payload);
            setResults(data);
        } catch (error) {
            console.error(error);
        }
        
        setIsRunning(false);
    };

    const handleDeploy = async () => {
        setIsDeploying(true);
        setDeploySuccess(null);
        
        let payload: any = {
            days_back: daysBack,
            stop_loss: stopLoss,
            take_profit: takeProfit,
            trade_type: tradeType,
            deployment_mode: deploymentMode,
            quantity: deployQuantity,
            quantity_type: deployQuantityType,
            capital_to_use: deployCapitalToUse,
            capital_percentage: deployCapitalPercentage,
            lot_size: deployLotSize,
            is_advanced: strategyMode === 'advanced' || (strategyMode === 'simple' && simpleStrategyId !== 'default'),
            use_intraday: useIntraday
        };
        
        if (strategyMode === 'advanced') {
            payload.execution_plan = executionPlan;
            payload.saved_strategies = savedStrategies;
        } else if (strategyMode === 'simple' && simpleStrategyId !== 'default') {
            payload.execution_plan = [{
                id: Date.now(),
                strategyId: simpleStrategyId,
                timeframe: interval,
                leg: activeKey
            }];
            payload.saved_strategies = savedStrategies;
        } else {
            payload.instrument_key = activeKey;
            payload.interval = interval;
        }
        
        try {
            const data = await deployStrategy(payload);
            if (data.status === 'success') {
                setDeploySuccess(data.message);
                setTimeout(() => {
                    setShowDeployModal(false);
                    setDeploySuccess(null);
                }, 3000);
            } else {
                alert(data.message || "Deployment failed.");
            }
        } catch (error) {
            console.error(error);
            alert("Error connecting to deployment server.");
        }
        setIsDeploying(false);
    };

    const isRunDisabled = isRunning || (strategyMode === 'simple' && !activeKey) || (strategyMode === 'advanced' && (executionPlan.length === 0 || executionPlan.some(p => !p.strategyId || !p.leg)));

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent mb-8">
                Strategy Backtester
            </h1>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Configuration Panel */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-6 flex flex-col h-full max-h-[800px] overflow-y-auto custom-scrollbar">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-semibold text-white">Strategy Config</h2>
                        <div className="flex bg-gray-800 rounded-lg p-1">
                            <button 
                                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${strategyMode === 'simple' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                onClick={() => setStrategyMode('simple')}
                            >Simple</button>
                            <button 
                                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${strategyMode === 'advanced' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                onClick={() => setStrategyMode('advanced')}
                            >Advanced</button>
                        </div>
                    </div>
                    
                    {/* Strategy Overview (Simple Mode) */}
                    {strategyMode === 'simple' ? (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Strategy to Apply</label>
                                <select 
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-white focus:outline-none focus:border-indigo-500"
                                    value={simpleStrategyId}
                                    onChange={(e) => setSimpleStrategyId(e.target.value)}
                                >
                                    <option value="default">Default: BB + Stoch + MACD</option>
                                    {savedStrategies.map(s => (
                                        <option key={s.id} value={s.id}>{s.name || "Unnamed Strategy"}</option>
                                    ))}
                                </select>
                            </div>

                            {simpleStrategyId === 'default' ? (
                                <div className="bg-blue-900/20 border border-blue-500/20 rounded-lg p-4 text-sm text-blue-200 mt-4">
                                    <p className="font-medium text-blue-400 mb-2">Hardcoded Default Strategy</p>
                                    <ul className="list-disc list-inside space-y-1 opacity-80">
                                        <li>Price drops below Lower BB</li>
                                        <li>Stochastic (%K) oversold &lt; 20</li>
                                        <li>Stochastic Bullish Crossover</li>
                                        <li>MACD Momentum Shifting Upwards</li>
                                    </ul>
                                </div>
                            ) : (
                                <div className="bg-indigo-900/20 border border-indigo-500/20 rounded-lg p-4 text-sm text-indigo-200 mt-4">
                                    <p className="font-medium text-indigo-400 mb-2">Custom Strategy Selected</p>
                                    <p className="opacity-80">This strategy will be executed on the selected instrument using the Advanced Evaluator Engine.</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="bg-indigo-900/20 border border-indigo-500/20 rounded-lg p-4 text-sm text-indigo-200">
                                Create your reusable indicator conditions in the <a href="/strategy-studio" className="font-bold underline">Strategy Studio</a> first.
                            </div>
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-medium text-gray-300">Multi-Leg Execution Plan</h3>
                                <button 
                                    onClick={() => setExecutionPlan([...executionPlan, { id: Date.now(), strategyId: "", timeframe: "5minute", leg: "CE" }])}
                                    className="text-xs bg-gray-800 hover:bg-gray-700 text-indigo-400 px-2 py-1 rounded border border-gray-700"
                                >+ Add Execution Leg</button>
                            </div>
                            
                            <div className="space-y-3">
                                {executionPlan.map((plan, idx) => (
                                    <div key={plan.id} className="bg-gray-800/50 border border-gray-700 p-3 rounded-lg space-y-3 relative group">
                                        <button 
                                            onClick={() => setExecutionPlan(executionPlan.filter(p => p.id !== plan.id))}
                                            className="absolute -top-2 -right-2 bg-red-900/80 text-red-300 rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                        >×</button>
                                        
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="bg-gray-800 text-gray-400 text-xs px-2 py-1 rounded font-mono">
                                                {idx === 0 ? 'IF' : 'AND'}
                                            </div>
                                            <select 
                                                className="bg-gray-900 border border-gray-600 rounded px-2 py-2 text-sm text-white flex-1 focus:border-indigo-500"
                                                value={plan.strategyId}
                                                onChange={(e) => {
                                                    const newPlan = [...executionPlan];
                                                    newPlan[idx].strategyId = e.target.value;
                                                    setExecutionPlan(newPlan);
                                                }}
                                            >
                                                <option value="" disabled>Select Saved Strategy...</option>
                                                {savedStrategies.map(s => (
                                                    <option key={s.id} value={s.id}>{s.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        
                                        <div className="flex gap-2">
                                            <div className="flex-1">
                                                <label className="block text-xs text-gray-500 mb-1">Instrument Key</label>
                                                <input 
                                                    type="text"
                                                    placeholder="e.g. BSE_FO|888771"
                                                    className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:border-indigo-500 focus:outline-none"
                                                    value={plan.leg} // We repurpose 'leg' to store the instrument key string
                                                    onChange={(e) => {
                                                        const newPlan = [...executionPlan];
                                                        newPlan[idx].leg = e.target.value;
                                                        setExecutionPlan(newPlan);
                                                    }}
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <label className="block text-xs text-gray-500 mb-1">Timeframe</label>
                                                <select 
                                                    className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-xs text-white"
                                                    value={plan.timeframe}
                                                    onChange={(e) => {
                                                        const newPlan = [...executionPlan];
                                                        newPlan[idx].timeframe = e.target.value;
                                                        setExecutionPlan(newPlan);
                                                    }}
                                                >
                                                    <option value="1minute">1 Min</option>
                                                    <option value="5minute">5 Min</option>
                                                    <option value="15minute">15 Min</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Global Search Tool */}
                    <div>
                        <label className="block text-sm text-gray-400 mb-2">Instrument Key Finder</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                            <input 
                                type="text"
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-blue-500"
                                placeholder="Search to find a key (e.g., NIFTY 50000 CE)..."
                                value={searchQuery}
                                onChange={(e) => handleSearch(e.target.value)}
                            />
                            {isSearching ? (
                                <div className="absolute left-3 top-2.5 w-5 h-5 border-2 border-gray-500 border-t-gray-300 rounded-full animate-spin"></div>
                            ) : null}
                        </div>
                        
                        {searchResults.length > 0 && !selectedInstrument && (
                            <div className="mt-2 max-h-40 overflow-y-auto bg-gray-800 border border-gray-700 rounded-lg">
                                {searchResults.map((inst, i) => (
                                    <div 
                                        key={i}
                                        className="p-2 hover:bg-gray-700 cursor-pointer text-sm"
                                        onClick={() => {
                                            setSelectedInstrument(inst);
                                            setSearchResults([]);
                                            setSearchQuery("");
                                        }}
                                    >
                                        <div className="font-medium text-white">{inst.name || inst.trading_symbol}</div>
                                        <div className="text-xs text-gray-400">
                                            <span className="font-mono text-indigo-400">{inst.instrument_key}</span> • {inst.exchange}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <p className="text-xs text-gray-500 mt-2">
                            Use this search to find the <span className="font-mono text-indigo-400">Instrument Key</span>, then copy/paste it into your Strategy Execution Plan above.
                        </p>
                    </div>

                    {/* Settings */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className={`${strategyMode === 'advanced' ? 'hidden' : ''}`}>
                            <label className="block text-sm text-gray-400 mb-2">Interval</label>
                            <select 
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                                value={interval}
                                onChange={(e) => setInterval(e.target.value)}
                            >
                                <option value="5minute">5 Minute</option>
                                <option value="15minute">15 Minute</option>
                                <option value="30minute">30 Minute</option>
                                <option value="60minute">1 Hour</option>
                                <option value="day">Daily</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-2">Days Back</label>
                            <input 
                                type="number"
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                                value={daysBack}
                                onChange={(e) => setDaysBack(Number(e.target.value))}
                                min="1" max="100"
                            />
                        </div>
                        <div className="col-span-2 md:col-span-1">
                            <label className="block text-sm text-gray-400 mb-2">Trade Direction</label>
                            <select 
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                value={tradeType}
                                onChange={(e) => setTradeType(e.target.value as "LONG" | "SHORT")}
                            >
                                <option value="LONG">LONG (Buy entry, Sell exit)</option>
                                <option value="SHORT">SHORT (Sell entry, Buy exit)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-2">Stop Loss (%)</label>
                            <input 
                                type="number"
                                step="0.1"
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-red-500"
                                value={stopLoss}
                                onChange={(e) => setStopLoss(Number(e.target.value))}
                                min="0.1" max="100"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-2">Take Profit (%)</label>
                            <input 
                                type="number"
                                step="0.1"
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-green-500"
                                value={takeProfit}
                                onChange={(e) => setTakeProfit(Number(e.target.value))}
                                min="0.1" max="100"
                            />
                        </div>
                        <div className="col-span-2 bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 flex items-center justify-between">
                            <div>
                                <label className="block text-xs font-bold text-indigo-400 uppercase tracking-wider">Intraday Data</label>
                                <p className="text-[10px] text-gray-500">Include live intraday candles in backtest</p>
                            </div>
                            <input 
                                type="checkbox"
                                className="w-5 h-5 rounded border-gray-700 bg-gray-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-gray-900"
                                checked={useIntraday}
                                onChange={(e) => setUseIntraday(e.target.checked)}
                            />
                        </div>
                    </div>

                    {/* Execution Instrument Selector */}
                    <div className="bg-gray-800/30 border border-gray-700 p-4 rounded-xl space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="block text-sm font-medium text-gray-300">Execution Instrument <span className="text-gray-500 font-normal">(Optional)</span></label>
                                {tradeInstrument && (
                                    <button 
                                        onClick={() => setTradeInstrument(null)}
                                        className="text-[10px] text-red-400 hover:text-red-300 uppercase tracking-wider"
                                    >Clear</button>
                                )}
                            </div>
                            
                            {!tradeInstrument ? (
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                                    <input 
                                        type="text"
                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                                        placeholder="Search for a different trade instrument (e.g. Put)..."
                                        value={tradeSearchQuery}
                                        onChange={(e) => {
                                            setTradeSearchQuery(e.target.value);
                                            if (e.target.value.length >= 2) {
                                                setIsTradeSearching(true);
                                                searchInstruments(e.target.value).then(res => {
                                                    setTradeSearchResults(res);
                                                    setIsTradeSearching(false);
                                                });
                                            } else {
                                                setTradeSearchResults([]);
                                            }
                                        }}
                                    />
                                    {tradeSearchResults.length > 0 && (
                                        <div className="absolute left-0 right-0 mt-2 max-h-40 overflow-y-auto bg-gray-900 border border-gray-700 rounded-lg z-50 shadow-2xl">
                                            {tradeSearchResults.map((inst, i) => (
                                                <div 
                                                    key={i}
                                                    className="p-2 hover:bg-gray-800 cursor-pointer text-xs"
                                                    onClick={() => {
                                                        setTradeInstrument(inst);
                                                        setTradeSearchResults([]);
                                                        setTradeSearchQuery("");
                                                    }}
                                                >
                                                    <div className="font-medium text-white">{inst.name || inst.trading_symbol}</div>
                                                    <div className="text-gray-500">{inst.instrument_key}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="bg-indigo-500/10 border border-indigo-500/20 p-3 rounded-lg flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-bold text-white">{tradeInstrument.name || tradeInstrument.trading_symbol}</p>
                                        <p className="text-[10px] text-indigo-400 font-mono">{tradeInstrument.instrument_key}</p>
                                    </div>
                                    <div className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded font-bold">
                                        TRADING ON THIS
                                    </div>
                                </div>
                            )}
                            <p className="text-[10px] text-gray-500 leading-relaxed">
                                By default, we trade the same instrument used for signals. Use this to trade a different asset (e.g., watch NIFTY Index but execute on a Put/Call Option).
                            </p>
                        </div>
                    
                    <div className="flex gap-4">
                        <button 
                            className={`flex-1 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${
                                isRunDisabled 
                                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_15px_rgba(79,70,229,0.3)]'
                            }`}
                            disabled={isRunDisabled}
                            onClick={handleRunBacktest}
                        >
                            {isRunning ? (
                                <><div className="animate-spin h-5 w-5 border-2 border-white/20 border-t-white rounded-full"></div> Running...</>
                            ) : (
                                <><Play className="w-5 h-5" /> Run Backtest</>
                            )}
                        </button>
                        <button 
                            className={`px-6 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all border border-indigo-500/50 ${
                                isRunDisabled 
                                    ? 'bg-gray-800 text-gray-500 border-gray-700 cursor-not-allowed'
                                    : 'bg-gray-900 hover:bg-gray-800 text-indigo-400'
                            }`}
                            disabled={isRunDisabled}
                            onClick={() => setShowDeployModal(true)}
                        >
                            <Rocket className="w-5 h-5" /> Deploy
                        </button>
                    </div>
                </div>

                {/* Deploy Modal */}
                {showDeployModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                        <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                            <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-800/30">
                                <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                                    <Rocket className="w-5 h-5 text-indigo-400" /> Deploy Strategy
                                </h3>
                                <button onClick={() => setShowDeployModal(false)} className="text-gray-400 hover:text-white">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-6 space-y-6">
                                {deploySuccess ? (
                                    <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-4 rounded-xl text-center">
                                        <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                                            <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                        </div>
                                        <h4 className="font-bold text-lg mb-1">Deployed Successfully</h4>
                                        <p className="text-sm opacity-80">{deploySuccess}</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-400 mb-2">Deployment Environment</label>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <button 
                                                        onClick={() => setDeploymentMode("MOCK")}
                                                        className={`py-3 px-4 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${deploymentMode === 'MOCK' ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300' : 'bg-gray-800 border-gray-700 text-gray-500 hover:bg-gray-750'}`}
                                                    >
                                                        <span className="font-bold">Mock Trade</span>
                                                        <span className="text-[10px]">Paper Trading</span>
                                                    </button>
                                                    <button 
                                                        onClick={() => setDeploymentMode("LIVE")}
                                                        className={`py-3 px-4 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${deploymentMode === 'LIVE' ? 'bg-red-600/20 border-red-500 text-red-300' : 'bg-gray-800 border-gray-700 text-gray-500 hover:bg-gray-750'}`}
                                                    >
                                                        <span className="font-bold">Live Trade</span>
                                                        <span className="text-[10px]">Real Capital (Upstox)</span>
                                                    </button>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-400 mb-2">Quantity Calculation</label>
                                                <div className="grid grid-cols-3 gap-2 mb-4">
                                                    <button 
                                                        onClick={() => setDeployQuantityType("MANUAL")}
                                                        className={`py-2 px-2 rounded-xl border flex items-center justify-center gap-1 transition-all ${deployQuantityType === 'MANUAL' ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300' : 'bg-gray-800 border-gray-700 text-gray-500 hover:bg-gray-750'}`}
                                                    >
                                                        <span className="font-bold text-xs">Manual</span>
                                                    </button>
                                                    <button 
                                                        onClick={() => setDeployQuantityType("CAPITAL")}
                                                        className={`py-2 px-2 rounded-xl border flex items-center justify-center gap-1 transition-all ${deployQuantityType === 'CAPITAL' ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300' : 'bg-gray-800 border-gray-700 text-gray-500 hover:bg-gray-750'}`}
                                                    >
                                                        <span className="font-bold text-xs">Fixed Capital</span>
                                                    </button>
                                                    <button 
                                                        onClick={() => setDeployQuantityType("PERCENTAGE")}
                                                        className={`py-2 px-2 rounded-xl border flex items-center justify-center gap-1 transition-all ${deployQuantityType === 'PERCENTAGE' ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300' : 'bg-gray-800 border-gray-700 text-gray-500 hover:bg-gray-750'}`}
                                                    >
                                                        <span className="font-bold text-xs">% of Total</span>
                                                    </button>
                                                </div>

                                                {deployQuantityType === "MANUAL" ? (
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-500 mb-1">Fixed Trade Quantity</label>
                                                        <input 
                                                            type="number"
                                                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                                                            value={deployQuantity}
                                                            onChange={(e) => setDeployQuantity(Number(e.target.value))}
                                                            min="1"
                                                        />
                                                        <p className="text-xs text-gray-500 mt-2">Specify the exact number of shares/lots to execute per signal.</p>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-3">
                                                        {deployQuantityType === "CAPITAL" ? (
                                                            <div>
                                                                <label className="block text-xs font-medium text-gray-500 mb-1">Capital to Allocate (₹)</label>
                                                                <input 
                                                                    type="number"
                                                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                                                                    value={deployCapitalToUse}
                                                                    onChange={(e) => setDeployCapitalToUse(Number(e.target.value))}
                                                                    min="100"
                                                                />
                                                            </div>
                                                        ) : (
                                                            <div>
                                                                <label className="block text-xs font-medium text-gray-500 mb-1">Percentage of Available Margin (%)</label>
                                                                <input 
                                                                    type="number"
                                                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                                                                    value={deployCapitalPercentage}
                                                                    onChange={(e) => setDeployCapitalPercentage(Number(e.target.value))}
                                                                    min="1" max="100"
                                                                />
                                                            </div>
                                                        )}
                                                        <div>
                                                            <label className="block text-xs font-medium text-gray-500 mb-1">Instrument Lot Size</label>
                                                            <input 
                                                                type="number"
                                                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                                                                value={deployLotSize}
                                                                onChange={(e) => setDeployLotSize(Number(e.target.value))}
                                                                min="1"
                                                            />
                                                            <p className="text-xs text-gray-500 mt-2">Example: Nifty=25, BankNifty=15, Sensex=20. Lots = Floor(Capital / (LotSize * LTP)).</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <button 
                                            onClick={handleDeploy}
                                            disabled={isDeploying}
                                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-xl transition-colors shadow-lg shadow-indigo-500/20 flex justify-center items-center gap-2"
                                        >
                                            {isDeploying ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : 'Confirm Deployment'}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Results Panel */}
<div className="md:col-span-2 space-y-6">
                    {results && !isRunning && results.status === "error" && (
                        <div className="mt-8 p-4 bg-red-900/20 border border-red-500/30 rounded-xl text-red-400">
                            <strong>Error:</strong> {results.message}
                        </div>
                    )}

                    {results && !isRunning && results.status !== "error" && (
                        <div className="mt-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl flex flex-col justify-between relative overflow-hidden">
                                    <div className="absolute -right-4 -top-4 w-16 h-16 bg-blue-500/10 rounded-full blur-xl"></div>
                                    <div className="text-gray-400 text-xs mb-1 flex items-center gap-1"><Wallet className="w-3 h-3"/> Starting Capital</div>
                                    <div className="text-2xl font-bold text-white">₹1,00,000</div>
                                </div>
                                <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl flex flex-col justify-between relative overflow-hidden">
                                    <div className={`absolute -right-4 -top-4 w-16 h-16 rounded-full blur-xl ${results.summary.total_pnl >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}></div>
                                    <div className="text-gray-400 text-xs mb-1 flex items-center gap-1"><Activity className="w-3 h-3"/> Final Capital</div>
                                    <div className={`text-2xl font-bold ${results.summary.total_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        ₹{results.summary.final_capital ? results.summary.final_capital.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '0.00'}
                                    </div>
                                </div>
                                <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl flex flex-col justify-between">
                                    <div className="text-gray-400 text-xs mb-1 flex items-center gap-1"><DollarSign className="w-3 h-3"/> Net PnL</div>
                                    <div className={`text-2xl font-bold ${results.summary.total_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {results.summary.total_pnl >= 0 ? '+' : ''}₹{results.summary.total_pnl.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                    </div>
                                </div>
                                <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl flex flex-col justify-between">
                                    <div className="text-gray-400 text-xs mb-1 flex items-center gap-1"><TrendingDown className="w-3 h-3"/> Max Drawdown</div>
                                    <div className="text-2xl font-bold text-orange-400">
                                        -{results.summary.max_drawdown_pct ? results.summary.max_drawdown_pct.toFixed(2) : '0.00'}%
                                    </div>
                                </div>
                                <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl flex flex-col justify-between">
                                    <div className="text-gray-400 text-xs mb-1 flex items-center gap-1"><Percent className="w-3 h-3"/> Win Rate ({results.summary.total_trades} trades)</div>
                                    <div className={`text-2xl font-bold ${results.summary.win_rate > 50 ? 'text-green-400' : 'text-orange-400'}`}>
                                        {results.summary.win_rate}%
                                    </div>
                                </div>
                            </div>
                            
                            {/* Equity Curve Chart */}
                            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden p-6">
                                <h3 className="font-semibold text-white mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-indigo-400" /> Equity Curve</h3>
                                <div className="h-[300px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={[{ entry_time: 'Start', running_capital: 100000 }, ...results.trades]} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorCapital" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3}/>
                                                    <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                                            <XAxis dataKey="entry_time" stroke="#9ca3af" fontSize={12} tickFormatter={(tick) => {
                                                if (tick === 'Start') return 'Start';
                                                const d = new Date(tick);
                                                return `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
                                            }} minTickGap={30} />
                                            <YAxis domain={['auto', 'auto']} stroke="#9ca3af" fontSize={12} tickFormatter={(val) => `₹${(val/1000).toFixed(0)}k`} />
                                            <RechartsTooltip 
                                                contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '0.5rem', color: '#f3f4f6' }}
                                                itemStyle={{ color: '#818cf8', fontWeight: 'bold' }}
                                                labelFormatter={(label) => label === 'Start' ? 'Initial Capital' : new Date(label).toLocaleString()}
                                                formatter={(value: number) => [`₹${value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, 'Capital']}
                                            />
                                            <Area type="monotone" dataKey="running_capital" stroke="#818cf8" strokeWidth={2} fillOpacity={1} fill="url(#colorCapital)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                            
                            {/* Strategy Debugger Stats */}
                            {results.summary.condition_stats && (
                                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                                    <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center">
                                        <h3 className="font-semibold text-white">Strategy Diagnostic Stats</h3>
                                        <div className="text-xs text-gray-500">
                                            Total Candles Analyzed: <span className="font-mono text-white">{results.summary.condition_stats.Total_Candles_Analyzed}</span>
                                        </div>
                                    </div>
                                    <div className="p-4 grid grid-cols-2 md:grid-cols-5 gap-4 bg-gray-800/20">
                                        {Object.entries(results.summary.condition_stats)
                                            .filter(([key]) => key !== 'Total_Candles_Analyzed' && key !== 'Total_Combined_Hits')
                                            .map(([key, value]) => (
                                                <div key={key} className="p-3 border border-gray-800 rounded-lg bg-gray-900">
                                                    <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 line-clamp-1" title={key.replace(/_/g, ' ')}>{key.replace(/_/g, ' ')}</div>
                                                    <div className="text-lg font-mono text-purple-400">{value as number}</div>
                                                </div>
                                            ))}
                                            
                                        {results.summary.condition_stats.Total_Combined_Hits !== undefined && (
                                            <div className="p-3 border border-indigo-500/30 rounded-lg bg-indigo-900/20">
                                                <div className="text-[10px] text-indigo-400 uppercase tracking-wider mb-1">Total Signals</div>
                                                <div className="text-lg font-mono text-indigo-400 font-bold">{results.summary.condition_stats.Total_Combined_Hits}</div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="px-6 py-2 bg-blue-900/10 border-t border-gray-800 text-xs text-blue-300">
                                        <strong>Debug Tip:</strong> If total signals are 0, check which condition or leg has the lowest hits. That's likely the bottleneck in your strategy!
                                    </div>
                                </div>
                            )}
                            
                            {/* Trade Log */}
                            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                                <div className="px-6 py-4 border-b border-gray-800">
                                    <h3 className="font-semibold text-white">Trade History</h3>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm text-gray-400">
                                        <thead className="text-xs uppercase bg-gray-800/50 text-gray-500">
                                            <tr>
                                                <th className="px-6 py-3">Entry Time</th>
                                                <th className="px-6 py-3">Entry Price</th>
                                                <th className="px-6 py-3">Exit Time</th>
                                                <th className="px-6 py-3">Exit Price</th>
                                                <th className="px-6 py-3">PnL %</th>
                                                <th className="px-6 py-3">PnL ₹</th>
                                                <th className="px-6 py-3">Capital</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {results.trades.length === 0 ? (
                                                <tr>
                                                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                                                        No trades generated by strategy in this period.
                                                    </td>
                                                </tr>
                                            ) : (
                                                results.trades.map((t: any, i: number) => (
                                                    <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/30">
                                                        <td className="px-6 py-3 whitespace-nowrap">{new Date(t.entry_time).toLocaleString()}</td>
                                                        <td className="px-6 py-3 font-medium text-white">{t.entry_price}</td>
                                                        <td className="px-6 py-3 whitespace-nowrap">{new Date(t.exit_time).toLocaleString()}</td>
                                                        <td className="px-6 py-3 font-medium text-white">{t.exit_price}</td>
                                                        <td className={`px-6 py-3 font-medium ${t.pnl_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                            {t.pnl_pct >= 0 ? '+' : ''}{t.pnl_pct}%
                                                        </td>
                                                        <td className={`px-6 py-3 font-medium ${t.pnl_value >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                            {t.pnl_value >= 0 ? '+' : ''}₹{t.pnl_value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                                        </td>
                                                        <td className="px-6 py-3 font-medium text-indigo-300">
                                                            ₹{t.running_capital ? t.running_capital.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '-'}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            
                            {/* Raw Signals Debug Log */}
                            {results.signals && results.signals.length > 0 && (
                                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mt-6">
                                    <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center">
                                        <h3 className="font-semibold text-white flex items-center gap-2"><Activity className="w-4 h-4 text-purple-400" /> Raw Signals Log</h3>
                                        <span className="text-xs bg-purple-900/30 text-purple-400 px-2 py-1 rounded-full border border-purple-500/20">{results.signals.length} Triggers Fired</span>
                                    </div>
                                    <div className="overflow-x-auto max-h-[500px] custom-scrollbar">
                                        <table className="w-full text-left text-sm text-gray-400">
                                            <thead className="text-[10px] uppercase bg-gray-800/80 text-gray-500 sticky top-0 z-10 backdrop-blur-sm">
                                                <tr>
                                                    <th className="px-4 py-3 w-10"></th>
                                                    <th className="px-4 py-3">Timestamp</th>
                                                    <th className="px-4 py-3">Price</th>
                                                    <th className="px-4 py-3">Action/Status</th>
                                                    <th className="px-4 py-3">Reason</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {results.signals.map((sig: any, i: number) => (
                                                    <React.Fragment key={i}>
                                                        <tr 
                                                            className={`border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer transition-colors ${expandedSignal === i ? 'bg-indigo-900/10' : ''}`}
                                                            onClick={() => setExpandedSignal(expandedSignal === i ? null : i)}
                                                        >
                                                            <td className="px-4 py-3">
                                                                {expandedSignal === i ? <ChevronUp className="w-4 h-4 text-indigo-400" /> : <ChevronDown className="w-4 h-4 text-gray-600" />}
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap text-xs">{new Date(sig.timestamp).toLocaleString()}</td>
                                                            <td className="px-4 py-3 font-mono text-white text-xs">{sig.price}</td>
                                                            <td className="px-4 py-3">
                                                                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${sig.traded ? 'bg-green-900/20 text-green-400 border-green-500/20' : 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                                                                    {sig.traded ? 'TRADED' : 'SKIPPED'}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 text-xs font-medium">
                                                                <span className={sig.traded ? 'text-green-400' : 'text-gray-500'}>{sig.reason}</span>
                                                            </td>
                                                        </tr>
                                                        {expandedSignal === i && (
                                                            <tr className="bg-gray-950/50 border-b border-gray-800">
                                                                <td colSpan={5} className="px-8 py-6">
                                                                    <div className="space-y-6">
                                                                        <div className="flex items-center gap-2 text-indigo-400 font-semibold text-xs uppercase tracking-wider">
                                                                            <Info className="w-3 h-3" /> Leg-Level indicator Breakdown
                                                                        </div>
                                                                        
                                                                        {sig.leg_details ? (
                                                                            <div className="grid grid-cols-1 gap-4">
                                                                                {sig.leg_details.map((leg: any, lIdx: number) => (
                                                                                    <div key={lIdx} className="bg-gray-900/80 border border-gray-800 rounded-lg overflow-hidden shadow-sm">
                                                                                        <div className="px-4 py-2 bg-gray-800/40 border-b border-gray-800 flex justify-between items-center">
                                                                                            <div className="flex items-center gap-2">
                                                                                                <span className="text-[10px] font-bold bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded">Leg {lIdx + 1}</span>
                                                                                                <span className="text-xs font-mono text-white">{leg.instrument}</span>
                                                                                                <span className="text-[10px] text-gray-500">({leg.timeframe})</span>
                                                                                            </div>
                                                                                            <span className={`text-[10px] font-bold ${leg.matched ? 'text-green-400' : 'text-red-400'}`}>
                                                                                                {leg.matched ? '✓ CRITERIA MATCHED' : '✗ CRITERIA FAILED'}
                                                                                            </span>
                                                                                        </div>
                                                                                        <div className="p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-x-6 gap-y-3">
                                                                                            {Object.entries(leg.indicators).map(([key, val]: [string, any]) => (
                                                                                                <div key={key} className="space-y-1">
                                                                                                    <div className="text-[9px] text-gray-500 uppercase font-medium">{key.replace(/_/g, ' ')}</div>
                                                                                                    <div className="text-xs font-mono text-indigo-300">{val}</div>
                                                                                                </div>
                                                                                            ))}
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        ) : (
                                                                            <div className="text-xs text-gray-500 italic p-4 bg-gray-900/40 rounded-lg border border-gray-800">
                                                                                Detailed leg data not available for this signal (Simple Mode).
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </React.Fragment>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {!results && !isRunning && (
                        <div className="h-full min-h-[400px] flex items-center justify-center border border-dashed border-gray-800 rounded-xl">
                            <div className="text-center space-y-3">
                                <Activity className="w-12 h-12 text-gray-700 mx-auto" />
                                <div className="text-gray-500 font-medium">Configure and run to see backtest results</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
