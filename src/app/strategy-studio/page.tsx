"use client";

import React, { useState, useEffect } from 'react';
import { Save, Plus, Trash2, Code, ArrowRight, FileJson } from 'lucide-react';

export default function StrategyStudio() {
    const [strategies, setStrategies] = useState<any[]>([]);
    const [activeStrategy, setActiveStrategy] = useState<any>(null);
    const [viewMode, setViewMode] = useState<"visual" | "json">("visual");
    const [jsonError, setJsonError] = useState<string>("");

    useEffect(() => {
        const saved = localStorage.getItem("robotrader_strategies");
        if (saved) {
            setStrategies(JSON.parse(saved));
        }
    }, []);

    const saveStrategies = (strats: any[]) => {
        setStrategies(strats);
        localStorage.setItem("robotrader_strategies", JSON.stringify(strats));
    };

    const createNewStrategy = () => {
        const newStrat = {
            id: Date.now().toString(),
            name: "New Strategy",
            rules: []
        };
        saveStrategies([...strategies, newStrat]);
        setActiveStrategy(newStrat);
    };

    const deleteStrategy = (id: string) => {
        const filtered = strategies.filter(s => s.id !== id);
        saveStrategies(filtered);
        if (activeStrategy?.id === id) setActiveStrategy(null);
    };

    const addRule = () => {
        if (!activeStrategy) return;
        const newRule = {
            id: Date.now().toString(),
            indicator: "close",
            operator: ">",
            valueType: "number",
            value: "0"
        };
        const updated = { ...activeStrategy, rules: [...activeStrategy.rules, newRule] };
        
        setActiveStrategy(updated);
        saveStrategies(strategies.map(s => s.id === updated.id ? updated : s));
    };

    const updateRule = (ruleId: string, field: string, val: string) => {
        if (!activeStrategy) return;
        const updatedRules = activeStrategy.rules.map((r: any) => {
            if (r.id === ruleId) {
                const newR = { ...r, [field]: val };
                if (field === 'valueType') {
                    newR.value = val === 'number' ? '0' : 'close';
                }
                return newR;
            }
            return r;
        });
        const updated = { ...activeStrategy, rules: updatedRules };
        setActiveStrategy(updated);
        saveStrategies(strategies.map(s => s.id === updated.id ? updated : s));
    };

    const deleteRule = (ruleId: string) => {
        if (!activeStrategy) return;
        const updated = { ...activeStrategy, rules: activeStrategy.rules.filter((r: any) => r.id !== ruleId) };
        setActiveStrategy(updated);
        saveStrategies(strategies.map(s => s.id === updated.id ? updated : s));
    };

    const updateName = (name: string) => {
        if (!activeStrategy) return;
        const updated = { ...activeStrategy, name };
        setActiveStrategy(updated);
        saveStrategies(strategies.map(s => s.id === updated.id ? updated : s));
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent mb-8">
                Strategy Studio
            </h1>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* Sidebar */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
                    <button 
                        onClick={createNewStrategy}
                        className="w-full bg-purple-600 hover:bg-purple-500 text-white py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                    >
                        <Plus className="w-4 h-4" /> New Strategy
                    </button>
                    
                    <div className="space-y-2">
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Saved Strategies</h3>
                        {strategies.length === 0 && (
                            <div className="text-sm text-gray-500 text-center py-4">No strategies saved.</div>
                        )}
                        {strategies.map(strat => (
                            <div 
                                key={strat.id}
                                onClick={() => setActiveStrategy(strat)}
                                className={`p-3 rounded-lg cursor-pointer flex justify-between items-center transition-colors border ${
                                    activeStrategy?.id === strat.id 
                                        ? 'bg-purple-900/30 border-purple-500/50 text-white' 
                                        : 'bg-gray-800/50 border-transparent text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                                }`}
                            >
                                <span className="font-medium text-sm truncate">{strat.name}</span>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); deleteStrategy(strat.id); }}
                                    className="text-gray-500 hover:text-red-400"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Editor */}
                <div className="md:col-span-3">
                    {activeStrategy ? (
                        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-6">
                            <div className="flex justify-between items-center border-b border-gray-800 pb-4">
                                <div className="flex-1">
                                    <label className="text-xs text-purple-400 font-semibold uppercase tracking-wider mb-1 block">Strategy Name</label>
                                    <input 
                                        type="text"
                                        value={activeStrategy.name}
                                        onChange={(e) => updateName(e.target.value)}
                                        placeholder="e.g. MACD Momentum Builder"
                                        className="text-2xl font-bold bg-transparent text-white focus:outline-none focus:border-b-2 focus:border-purple-500 w-full"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <div className="flex bg-gray-800 rounded-lg p-1 mr-4">
                                        <button 
                                            className={`px-3 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1 ${viewMode === 'visual' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                            onClick={() => setViewMode('visual')}
                                        ><Code className="w-3 h-3" /> Visual</button>
                                        <button 
                                            className={`px-3 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1 ${viewMode === 'json' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                            onClick={() => setViewMode('json')}
                                        ><FileJson className="w-3 h-3" /> JSON</button>
                                    </div>
                                    <div className="text-xs text-gray-500 flex items-center gap-1">
                                        <Save className="w-3 h-3" /> Auto-saved
                                    </div>
                                </div>
                            </div>
                            
                            {viewMode === 'json' ? (
                                <div className="space-y-4">
                                    <p className="text-sm text-gray-400">
                                        Paste JSON generated by AI here to instantly build your strategy rules. 
                                    </p>
                                    <textarea 
                                        className="w-full h-[400px] bg-gray-950 border border-gray-700 rounded-lg p-4 text-green-400 font-mono text-sm focus:border-purple-500 focus:outline-none custom-scrollbar"
                                        value={JSON.stringify(activeStrategy.rules, null, 4)}
                                        onChange={(e) => {
                                            try {
                                                const parsed = JSON.parse(e.target.value);
                                                if (Array.isArray(parsed)) {
                                                    const updated = { ...activeStrategy, rules: parsed };
                                                    setActiveStrategy(updated);
                                                    saveStrategies(strategies.map(s => s.id === updated.id ? updated : s));
                                                    setJsonError("");
                                                } else {
                                                    setJsonError("JSON must be an array of rule objects.");
                                                }
                                            } catch (err: any) {
                                                setJsonError(err.message);
                                            }
                                        }}
                                    />
                                    {jsonError && <p className="text-red-400 text-xs">{jsonError}</p>}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                    <h3 className="text-lg font-medium text-gray-300">Rules Builder</h3>
                                    <button 
                                        onClick={addRule}
                                        className="text-xs bg-gray-800 hover:bg-gray-700 text-purple-400 px-3 py-1.5 rounded border border-gray-700 transition-colors flex items-center gap-1"
                                    >
                                        <Plus className="w-3 h-3" /> Add Rule
                                    </button>
                                </div>
                                
                                <div className="space-y-3">
                                    {activeStrategy.rules.length === 0 && (
                                        <div className="text-center p-8 border border-dashed border-gray-700 rounded-lg text-gray-500">
                                            <Code className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                            Add rules to define when this strategy triggers a BUY.
                                        </div>
                                    )}
                                    
                                    {activeStrategy.rules.map((rule: any, idx: number) => (
                                        <div key={rule.id} className="flex items-center gap-3 bg-gray-800/50 border border-gray-700 p-3 rounded-lg group">
                                            <div className="bg-gray-800 text-gray-500 text-xs px-2 py-1 rounded font-mono">
                                                IF
                                            </div>
                                            
                                            <select 
                                                className="bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm text-white flex-1 focus:border-purple-500 focus:outline-none"
                                                value={rule.indicator}
                                                onChange={(e) => updateRule(rule.id, 'indicator', e.target.value)}
                                            >
                                                <option value="open">Open Price</option>
                                                <option value="close">Close Price</option>
                                                <option value="low">Low Price</option>
                                                <option value="high">High Price</option>
                                                <option value="STOCHk">Stoch %K</option>
                                                <option value="STOCHd">Stoch %D</option>
                                                <option value="STOCHRSIk">Stoch RSI %K</option>
                                                <option value="STOCHRSId">Stoch RSI %D</option>
                                                <option value="MACDh">MACD Histogram</option>
                                                <option value="BBL_20_2">BB Lower</option>
                                                <option value="BBU_20_2">BB Upper</option>
                                                <option value="open_prev">Prev Open Price</option>
                                                <option value="close_prev">Prev Close Price</option>
                                                <option value="low_prev">Prev Low Price</option>
                                                <option value="high_prev">Prev High Price</option>
                                                <option value="STOCHk_prev">Prev Stoch %K</option>
                                                <option value="STOCHd_prev">Prev Stoch %D</option>
                                                <option value="STOCHRSIk_prev">Prev Stoch RSI %K</option>
                                                <option value="STOCHRSId_prev">Prev Stoch RSI %D</option>
                                                <option value="MACDh_prev">Prev MACD Histogram</option>
                                                <option value="BBL_20_2_prev">Prev BB Lower</option>
                                                <option value="BBU_20_2_prev">Prev BB Upper</option>
                                            </select>
                                            
                                            <select 
                                                className="bg-gray-900 border border-gray-600 rounded px-2 py-2 text-sm text-purple-400 w-24 text-center font-bold focus:border-purple-500 focus:outline-none"
                                                value={rule.operator}
                                                onChange={(e) => updateRule(rule.id, 'operator', e.target.value)}
                                            >
                                                <option value=">">&gt;</option>
                                                <option value="<">&lt;</option>
                                                <option value=">=">&gt;=</option>
                                                <option value="<=">&lt;=</option>
                                                <option value="==">==</option>
                                                <option value="cross_above">↑ Cross</option>
                                                <option value="cross_below">↓ Cross</option>
                                            </select>
                                            
                                            <div className="flex gap-0 flex-1">
                                                <select 
                                                    className="bg-gray-800 border border-gray-600 rounded-l px-2 text-xs text-gray-400 focus:outline-none"
                                                    value={rule.valueType}
                                                    onChange={(e) => updateRule(rule.id, 'valueType', e.target.value)}
                                                >
                                                    <option value="number">Num</option>
                                                    <option value="indicator">Ind</option>
                                                </select>
                                                {rule.valueType === 'number' ? (
                                                    <input 
                                                        type="text"
                                                        className="bg-gray-900 border border-gray-600 rounded-r px-3 py-2 text-sm text-white w-full focus:border-purple-500 focus:outline-none"
                                                        value={rule.value}
                                                        onChange={(e) => updateRule(rule.id, 'value', e.target.value)}
                                                    />
                                                ) : (
                                                    <select 
                                                        className="bg-gray-900 border border-gray-600 rounded-r px-3 py-2 text-sm text-white w-full focus:border-purple-500 focus:outline-none"
                                                        value={rule.value}
                                                        onChange={(e) => updateRule(rule.id, 'value', e.target.value)}
                                                    >
                                                        <option value="open">Open Price</option>
                                                        <option value="close">Close Price</option>
                                                        <option value="STOCHd">Stoch %D</option>
                                                        <option value="STOCHRSId">Stoch RSI %D</option>
                                                        <option value="BBL_20_2">BB Lower</option>
                                                        <option value="open_prev">Prev Open Price</option>
                                                        <option value="close_prev">Prev Close Price</option>
                                                        <option value="STOCHd_prev">Prev Stoch %D</option>
                                                        <option value="STOCHRSId_prev">Prev Stoch RSI %D</option>
                                                        <option value="BBL_20_2_prev">Prev BB Lower</option>
                                                        <option value="0">Zero Line</option>
                                                    </select>
                                                )}
                                            </div>
                                            
                                            <button 
                                                onClick={() => deleteRule(rule.id)}
                                                className="text-gray-600 hover:text-red-400 p-2"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            )}
                            
                            <div className="pt-6 border-t border-gray-800">
                                <div className="bg-purple-900/10 border border-purple-500/20 rounded-lg p-4">
                                    <h4 className="text-sm font-medium text-purple-300 mb-2 flex items-center gap-2">
                                        <ArrowRight className="w-4 h-4" /> Next Steps
                                    </h4>
                                    <p className="text-sm text-gray-400">
                                        Once your strategy is defined here, go to the <strong>Backtesting</strong> page. You can apply this named strategy simultaneously across multiple timeframes (like 5min and 15min) and legs (CE and PE).
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 flex flex-col items-center justify-center text-center h-full min-h-[400px]">
                            <Code className="w-16 h-16 text-gray-800 mb-4" />
                            <h2 className="text-xl font-medium text-gray-400 mb-2">No Strategy Selected</h2>
                            <p className="text-gray-600 text-sm max-w-md">
                                Create a new strategy or select an existing one from the sidebar to define your technical indicator rules.
                            </p>
                            <button 
                                onClick={createNewStrategy}
                                className="mt-6 bg-purple-600/20 text-purple-400 hover:bg-purple-600 hover:text-white px-4 py-2 rounded-lg font-medium transition-colors"
                            >
                                Create First Strategy
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
