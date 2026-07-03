"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { getTelegramSettings, saveTelegramSettings, testTelegramSettings, detectTelegramChat, getMiraeSettings, saveMiraeSettings, getUpstoxStatus, getAuthUrl, setManualToken, getGeneralSettings, saveGeneralSettings } from '@/services/api';
import { Send, Save, Bell, Shield, Info, CheckCircle2, AlertCircle, Search, Sparkles, Building2, ExternalLink, Key, RefreshCw } from 'lucide-react';

export default function SettingsPage() {
    const [telegram, setTelegram] = useState({
        bot_token: '',
        chat_id: '',
        group_name: '',
        enabled: false
    });
    const [mirae, setMirae] = useState({
        mirae_api_key: '',
        mirae_access_token: '',
        enabled: false
    });
    const [general, setGeneral] = useState({
        enforce_market_hours: false
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [pinging, setPinging] = useState(false);
    const [detecting, setDetecting] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Upstox Status State
    const [upstoxStatus, setUpstoxStatus] = useState<string>("Loading...");
    const [showManual, setShowManual] = useState(false);
    const [tokenInput, setTokenInput] = useState("");
    const [algoNameInput, setAlgoNameInput] = useState("");
    const [tokenLoading, setTokenLoading] = useState(false);

    const [agenticEnabled, setAgenticEnabled] = useState(false);

    useEffect(() => {
        if (typeof window !== "undefined") {
            const stored = localStorage.getItem("global_enable_agentic");
            setAgenticEnabled(stored === "true");
        }
    }, []);

    const handleToggleAgentic = (val: boolean) => {
        setAgenticEnabled(val);
        if (typeof window !== "undefined") {
            localStorage.setItem("global_enable_agentic", val.toString());
            localStorage.setItem("speed_enable_agentic", val.toString());
        }
    };

    const fetchUpstoxStatus = useCallback(async () => {
        const data = await getUpstoxStatus();
        if (data?.upstox === "connected") {
            setUpstoxStatus("Connected");
        } else {
            setUpstoxStatus("Disconnected");
        }
    }, []);

    useEffect(() => {
        const fetchSettings = async () => {
            setLoading(true);
            await Promise.all([
                (async () => {
                    const data = await getTelegramSettings();
                    setTelegram({
                        bot_token: data.bot_token || '',
                        chat_id: data.chat_id || '',
                        group_name: data.group_name || '',
                        enabled: data.enabled || false
                    });
                })(),
                (async () => {
                    const miraeData = await getMiraeSettings();
                    setMirae({
                        mirae_api_key: miraeData.mirae_api_key || miraeData.api_key || '',
                        mirae_access_token: miraeData.mirae_access_token || '',
                        enabled: miraeData.enabled || false
                    });
                })(),
                (async () => {
                    const generalData = await getGeneralSettings();
                    setGeneral({
                        enforce_market_hours: generalData.enforce_market_hours || false
                    });
                })(),
                fetchUpstoxStatus()
            ]);
            setLoading(false);
        };
        fetchSettings();

        const interval = setInterval(fetchUpstoxStatus, 10000);
        return () => clearInterval(interval);
    }, [fetchUpstoxStatus]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);
        try {
            await saveTelegramSettings(telegram);
            await saveMiraeSettings(mirae);
            await saveGeneralSettings(general);
            setMessage({ type: 'success', text: 'Settings saved successfully!' });
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to save settings.' });
        }
        setSaving(false);
    };

    const handlePing = async () => {
        const identifier = telegram.chat_id.trim();
        
        if (!telegram.bot_token.trim()) {
            setMessage({ type: 'error', text: 'Please enter your Telegram Bot Token first.' });
            return;
        }
        
        if (!identifier) {
            setMessage({ type: 'error', text: 'Please enter the Group @Username or Chat ID.' });
            return;
        }

        setPinging(true);
        setMessage(null);
        try {
            const res = await testTelegramSettings(telegram);
            if (res.status === 'success') {
                setMessage({ type: 'success', text: 'Test message sent successfully!' });
            } else {
                setMessage({ type: 'error', text: res.message || 'Failed to send test message.' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Connection error. Check your backend.' });
        }
        setPinging(false);
    };

    const handleDetect = async () => {
        if (!telegram.bot_token) {
            setMessage({ type: 'error', text: 'Please enter Bot Token first.' });
            return;
        }
        setDetecting(true);
        setMessage(null);
        try {
            const res = await detectTelegramChat(telegram.bot_token);
            if (res.status === 'success') {
                setTelegram({
                    ...telegram,
                    chat_id: res.data.chat_id,
                    group_name: res.data.title
                });
                setMessage({ type: 'success', text: `Detected: ${res.data.title}` });
            } else {
                setMessage({ type: 'error', text: res.message });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Detection failed. Make sure you messaged the bot!' });
        }
        setDetecting(false);
    };

    const handleUpstoxLogin = async () => {
        const url = await getAuthUrl();
        if (url) {
            window.location.href = url;
        } else {
            setMessage({ type: 'error', text: 'Failed to get login URL' });
        }
    };

    const handleManualToken = async () => {
        if (!tokenInput) return;
        setTokenLoading(true);
        setMessage(null);
        try {
            const res = await setManualToken(tokenInput, algoNameInput);
            if (res.status === "success") {
                setMessage({ type: 'success', text: 'Upstox Token Connected!' });
                setTokenInput("");
                setShowManual(false);
                fetchUpstoxStatus();
            } else {
                setMessage({ type: 'error', text: res.message || 'Invalid Token' });
            }
        } catch (e) {
            setMessage({ type: 'error', text: 'Failed to set manual token' });
        }
        setTokenLoading(false);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
                <div className="animate-spin h-10 w-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white p-4 md:p-8">
            <div className="max-w-3xl mx-auto space-y-8">
                {/* Header */}
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Shield className="w-8 h-8 text-indigo-500" />
                        Settings
                    </h1>
                    <p className="text-gray-400 mt-2">Manage your trading accounts and system configurations</p>
                </div>

                {/* Upstox Card */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
                    <div className="bg-blue-600/10 p-6 border-b border-gray-800 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <RefreshCw className={`w-6 h-6 ${upstoxStatus === 'Connected' ? 'text-green-400' : 'text-red-400'}`} />
                            <div>
                                <h2 className="text-lg font-bold">Upstox API Configuration</h2>
                                <p className="text-xs text-gray-500">Status: <span className={upstoxStatus === 'Connected' ? 'text-green-500 font-bold' : 'text-red-500 font-bold'}>{upstoxStatus}</span></p>
                            </div>
                        </div>
                        {upstoxStatus !== 'Connected' && (
                            <button 
                                onClick={handleUpstoxLogin}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                            >
                                <ExternalLink className="w-4 h-4" />
                                Login with Upstox
                            </button>
                        )}
                    </div>

                    <div className="p-6 space-y-6">
                        <div className="space-y-4">
                            <button 
                                onClick={() => setShowManual(!showManual)}
                                className="text-sm text-indigo-400 hover:text-indigo-300 font-medium transition-all"
                            >
                                {showManual ? "Hide Manual Entry" : (upstoxStatus === "Connected" ? "Update Access Token" : "Enter Access Token Manually")}
                            </button>

                            {showManual && (
                                <div className="space-y-4 bg-black/30 p-4 rounded-xl border border-gray-800">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-2">Access Token</label>
                                        <textarea 
                                            className="w-full bg-black/50 border border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-all font-mono min-h-[80px]"
                                            placeholder="Paste your Upstox Access Token here..."
                                            value={tokenInput}
                                            onChange={(e) => setTokenInput(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-2">Algo Name (Optional)</label>
                                        <input 
                                            type="text"
                                            className="w-full bg-black/50 border border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-all"
                                            placeholder="e.g. Default"
                                            value={algoNameInput}
                                            onChange={(e) => setAlgoNameInput(e.target.value)}
                                        />
                                    </div>
                                    <button 
                                        onClick={handleManualToken}
                                        disabled={tokenLoading || !tokenInput}
                                        className="w-full bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 border border-gray-700"
                                    >
                                        {tokenLoading ? <div className="animate-spin h-5 w-5 border-2 border-white/20 border-t-white rounded-full"></div> : <><Key className="w-5 h-5 text-indigo-400" /> Set Token</>}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* General Settings Card */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-xl mb-6">
                    <div className="bg-indigo-600/10 p-6 border-b border-gray-800 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Shield className="w-6 h-6 text-indigo-400" />
                            <div>
                                <h2 className="text-lg font-bold">Trading Constraints</h2>
                                <p className="text-xs text-gray-500">Control when live deployments execute trades</p>
                            </div>
                        </div>
                    </div>
                    <div className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-semibold text-white">Enforce Market Hours (9:00 AM - 3:30 PM)</h3>
                                <p className="text-sm text-gray-400">If enabled, automated strategy deployments will stop making API calls outside of standard trading hours. If disabled, deployments will run 24/7 (useful for Crypto or Forex if supported).</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer ml-4">
                                <input 
                                    type="checkbox" 
                                    className="sr-only peer"
                                    checked={general.enforce_market_hours}
                                    onChange={(e) => setGeneral({ ...general, enforce_market_hours: e.target.checked })}
                                />
                                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Agentic AI Configuration Card */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-xl mb-6">
                    <div className="bg-indigo-600/10 p-6 border-b border-gray-800 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Sparkles className="w-6 h-6 text-purple-400" />
                            <div>
                                <h2 className="text-lg font-bold">Agentic AI Configuration</h2>
                                <p className="text-xs text-gray-500">Enable or disable Ollama AI copilot features across the application</p>
                            </div>
                        </div>
                    </div>
                    <div className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-semibold text-white">Enable Agentic AI Systems</h3>
                                <p className="text-sm text-gray-400">If enabled, the application will activate co-pilot analysis and auto-pilot execution options powered by local Ollama AI models. If disabled, all background AI queries and logs check loops will be deactivated to conserve system resources.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer ml-4">
                                <input 
                                    type="checkbox" 
                                    className="sr-only peer"
                                    checked={agenticEnabled}
                                    onChange={(e) => handleToggleAgentic(e.target.checked)}
                                />
                                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Telegram Card */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
                    <div className="bg-indigo-600/10 p-6 border-b border-gray-800 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Send className="w-6 h-6 text-indigo-400" />
                            <div>
                                <h2 className="text-lg font-bold">Telegram Notifications</h2>
                                <p className="text-xs text-gray-500">Get instant alerts on trade execution</p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                className="sr-only peer"
                                checked={telegram.enabled}
                                onChange={(e) => setTelegram({ ...telegram, enabled: e.target.checked })}
                            />
                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                    </div>

                    <form onSubmit={handleSave} className="p-6 space-y-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Bot Token</label>
                                <input 
                                    type="password"
                                    className="w-full bg-black/50 border border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-all font-mono"
                                    placeholder="Enter Telegram Bot Token (e.g. 123456:ABC...)"
                                    value={telegram.bot_token}
                                    onChange={(e) => setTelegram({ ...telegram, bot_token: e.target.value })}
                                />
                                <p className="mt-2 text-[10px] text-gray-500 flex items-center gap-1">
                                    <Info className="w-3 h-3" /> Get this from @BotFather on Telegram
                                </p>
                            </div>

                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-400 mb-2">Group / Chat Name</label>
                                    <div className="flex gap-2">
                                        <input 
                                            type="text"
                                            className="flex-1 bg-black/50 border border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-all font-mono"
                                            placeholder="e.g. @MyTradingGroup or -100123456789"
                                            value={telegram.chat_id}
                                            onChange={(e) => setTelegram({ ...telegram, chat_id: e.target.value })}
                                        />
                                        <button 
                                            type="button"
                                            onClick={handleDetect}
                                            disabled={detecting}
                                            className="px-4 bg-gray-800 hover:bg-gray-700 rounded-xl border border-gray-700 transition-all flex items-center gap-2 text-xs font-bold text-indigo-400"
                                            title="Auto-detect from recent messages"
                                        >
                                            {detecting ? (
                                                <div className="animate-spin h-4 w-4 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full"></div>
                                            ) : (
                                                <>
                                                    <Sparkles className="w-4 h-4" />
                                                    Detect
                                                </>
                                            )}
                                        </button>
                                    </div>
                                    <p className="mt-2 text-[10px] text-gray-500 flex items-center gap-1">
                                        <Info className="w-3 h-3" /> Enter ID or use <b>Detect</b> after messaging the bot in your group.
                                    </p>
                                </div>
                        </div>

                        {message && (
                            <div className={`p-4 rounded-xl flex items-center gap-3 ${message.type === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                                <span className="text-sm font-medium">{message.text}</span>
                            </div>
                        )}

                        <div className="flex gap-4">
                            <button 
                                type="button"
                                onClick={handlePing}
                                disabled={pinging || saving}
                                className="flex-1 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-900 text-gray-300 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 border border-gray-700"
                            >
                                {pinging ? (
                                    <div className="animate-spin h-5 w-5 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full"></div>
                                ) : (
                                    <>
                                        <Send className="w-5 h-5 text-indigo-400" />
                                        Ping Test
                                    </>
                                )}
                            </button>
                            
                            <button 
                                type="submit"
                                disabled={saving || pinging}
                                className="flex-[2] bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
                            >
                                {saving ? (
                                    <div className="animate-spin h-5 w-5 border-2 border-white/20 border-t-white rounded-full"></div>
                                ) : (
                                    <>
                                        <Save className="w-5 h-5" />
                                        Save Configuration
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Mirae Asset Card */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
                    <div className="bg-indigo-600/10 p-6 border-b border-gray-800 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Building2 className="w-6 h-6 text-indigo-400" />
                            <div>
                                <h2 className="text-lg font-bold">Mirae Asset Configuration</h2>
                                <p className="text-xs text-gray-500">Configure mStock API access</p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                className="sr-only peer"
                                checked={mirae.enabled}
                                onChange={(e) => setMirae({ ...mirae, enabled: e.target.checked })}
                            />
                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                    </div>

                    <form onSubmit={handleSave} className="p-6 space-y-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Mirae API Key</label>
                                <input 
                                    type="text"
                                    className="w-full bg-black/50 border border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-all font-mono"
                                    placeholder="Enter Mirae API Key"
                                    value={mirae.mirae_api_key}
                                    onChange={(e) => setMirae({ ...mirae, mirae_api_key: e.target.value })}
                                />
                                <p className="mt-2 text-[10px] text-gray-500 flex items-center gap-1">
                                    <Info className="w-3 h-3" /> Your mStock Type A API Key.
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Mirae Access Token</label>
                                <textarea 
                                    className="w-full bg-black/50 border border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-all font-mono min-h-[100px]"
                                    placeholder="Enter mStock Access Token"
                                    value={mirae.mirae_access_token}
                                    onChange={(e) => setMirae({ ...mirae, mirae_access_token: e.target.value })}
                                />
                                <p className="mt-2 text-[10px] text-gray-500 flex items-center gap-1">
                                    <Info className="w-3 h-3" /> Paste your active Mirae Session Access Token here.
                                </p>
                            </div>
                        </div>
                        
                        <div className="flex gap-4">
                            <button 
                                type="submit"
                                disabled={saving}
                                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
                            >
                                {saving ? (
                                    <div className="animate-spin h-5 w-5 border-2 border-white/20 border-t-white rounded-full"></div>
                                ) : (
                                    <>
                                        <Save className="w-5 h-5" />
                                        Save Configuration
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Security Note */}
                <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 flex gap-4">
                    <Shield className="w-6 h-6 text-gray-500 shrink-0" />
                    <div>
                        <h4 className="text-sm font-bold text-gray-300 mb-1">Security Notice</h4>
                        <p className="text-xs text-gray-500 leading-relaxed">
                            Your Telegram Bot Token is stored securely in your local database and is used only to send notifications to your specified Chat ID. Never share your Bot Token with anyone.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
