"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  searchInstruments,
  placeOrders,
  placeMockOrder,
  getUpstoxStatus,
  getChecklistRules,
  saveChecklistRules,
  getChecklistThreshold,
  saveChecklistThreshold,
  getChecklistJournal,
  addChecklistJournalEntry,
  clearChecklistJournal
} from "@/services/api";
import {
  ClipboardList,
  Plus,
  Trash2,
  Edit2,
  Check,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  Search,
  CheckSquare,
  Square,
  ShieldCheck,
  ShieldAlert,
  Calendar,
  X,
  History,
  CheckCircle2,
  Trash,
  BookmarkPlus,
  BookmarkMinus
} from "lucide-react";

interface Rule {
  id: string;
  title: string;
  desc: string;
  weight: number;
  checked: boolean;
}

interface CustomTemplate {
  id: string;
  name: string;
  rules: Rule[];
  createdAt: string;
}

interface JournalEntry {
  id: string;
  timestamp: string;
  symbol: string;
  name: string;
  action: "BUY" | "SELL";
  qty: number;
  price: number;
  orderType: string;
  product: string;
  mode: "LIVE" | "MOCK";
  score: number;
  threshold: number;
  passedRules: Array<{ title: string; weight: number }>;
  failedRules: Array<{ title: string; weight: number }>;
  status: "success" | "error";
  errorMsg?: string;
}

const PRESET_TEMPLATES = {
  risk: [
    { id: "r1", title: "Risk-to-Reward Ratio is 1:2 or Better", desc: "Ensure stop loss and target are placed to satisfy at least a 1:2 ratio.", weight: 3, checked: false },
    { id: "r2", title: "Position Size within Daily Risk Limit (<2%)", desc: "Never risk more than 2% of total trading account size on a single trade.", weight: 3, checked: false },
    { id: "r3", title: "Stop Loss Levels Defined and Validated", desc: "Invalidate the trade if price goes beyond a key structural level.", weight: 2, checked: false },
    { id: "r4", title: "No High-Impact Economic News Scheduled", desc: "Check calendar. Avoid entry if major announcements are within 1 hour.", weight: 2, checked: false }
  ],
  trend: [
    { id: "t1", title: "Price Above 200 EMA (Daily/1hr)", desc: "Confirms overall long-term trend direction.", weight: 3, checked: false },
    { id: "t2", title: "RSI is in Bullish Territory (> 50)", desc: "Indicates momentum is in favor of the trade direction.", weight: 2, checked: false },
    { id: "t3", title: "MACD Signal Line Bullish Crossover", desc: "Recent momentum shift confirms bullish entry trigger.", weight: 2, checked: false },
    { id: "t4", title: "Volume Exceeds 20-period Moving Average", desc: "Validates breakout with high institutional participation.", weight: 1, checked: false },
    { id: "t5", title: "Key Support Level Respected / Validated", desc: "Price bounced or consolidated off support.", weight: 2, checked: false }
  ],
  reversion: [
    { id: "m1", title: "RSI in Extreme Zone (< 30 or > 70)", desc: "Price is statistically overbought or oversold.", weight: 3, checked: false },
    { id: "m2", title: "Price Pierced Outer Bollinger Band (2.0)", desc: "Strong probability of mean reversion back to the 20 SMA.", weight: 3, checked: false },
    { id: "m3", title: "Stochastic %K crossed %D in Extreme Zone", desc: "Confirms short-term cycle turn.", weight: 2, checked: false },
    { id: "m4", title: "Key Weekly or Daily Resistance Zone Touched", desc: "High probability pivot area.", weight: 2, checked: false }
  ]
};

const DEFAULT_RULES: Rule[] = [
  { id: "d1", title: "Risk-to-Reward Ratio is 1:2 or Better", desc: "Verify stop loss is placed to satisfy risk parameters.", weight: 3, checked: false },
  { id: "d2", title: "Price trend aligns with the trade direction", desc: "Higher highs/lower lows or moving average alignment.", weight: 2, checked: false },
  { id: "d3", title: "Key support/resistance level is respected", desc: "Do not buy directly into major resistance levels.", weight: 2, checked: false },
  { id: "d4", title: "Position size is calculated and within limits", desc: "Max risk per trade does not exceed 1-2% of total capital.", weight: 3, checked: false }
];

export default function PreOrderRulesPage() {
  const [mounted, setMounted] = useState(false);
  const [rules, setRules] = useState<Rule[]>([]);
  const [minThreshold, setMinThreshold] = useState(70);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>([]);

  // Rule Form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newWeight, setNewWeight] = useState(2);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Save-as-Template form state
  const [showSaveTemplateForm, setShowSaveTemplateForm] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");

  // Search Instruments state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOptions, setSearchOptions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Order Form state
  const [selectedInst, setSelectedInst] = useState<any | null>(null);
  const [orderAction, setOrderAction] = useState<"BUY" | "SELL">("BUY");
  const [orderType, setOrderType] = useState<"MARKET" | "LIMIT" | "SL" | "SL-M">("MARKET");
  const [quantity, setQuantity] = useState<number>(1);
  const [price, setPrice] = useState<number>(0);
  const [product, setProduct] = useState<"MIS" | "CNC">("MIS");
  const [isPaper, setIsPaper] = useState<boolean>(true);

  // Modals / Status notifications
  const [showGuardModal, setShowGuardModal] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [upstoxConnected, setUpstoxConnected] = useState<boolean>(false);
  const [expandedJournalId, setExpandedJournalId] = useState<string | null>(null);

  const isLoaded = useRef(false);

  // SSR protection and initial load
  useEffect(() => {
    setMounted(true);

    // Load custom templates from localStorage
    const storedTemplates = localStorage.getItem("robotrader_checklist_custom_templates");
    if (storedTemplates) setCustomTemplates(JSON.parse(storedTemplates));
    
    const loadDbData = async () => {
      try {
        // Load Rules from DB
        const dbRules = await getChecklistRules();
        if (dbRules && dbRules.length > 0) {
          setRules(dbRules);
        } else {
          // Fallback to LocalStorage
          const storedRules = localStorage.getItem("robotrader_checklist_rules");
          setRules(storedRules ? JSON.parse(storedRules) : DEFAULT_RULES);
        }

        // Load Threshold from DB
        const dbThreshold = await getChecklistThreshold();
        if (dbThreshold !== null) {
          setMinThreshold(dbThreshold);
        } else {
          const storedThreshold = localStorage.getItem("robotrader_checklist_threshold");
          if (storedThreshold) setMinThreshold(parseInt(storedThreshold, 10));
        }

        // Load Journal from DB
        const dbJournal = await getChecklistJournal();
        if (dbJournal && dbJournal.length > 0) {
          setJournal(dbJournal);
        } else {
          const storedJournal = localStorage.getItem("robotrader_checklist_journal");
          if (storedJournal) setJournal(JSON.parse(storedJournal));
        }
      } catch (err) {
        console.error("Failed to load checklist data from DB, falling back to LocalStorage", err);
        const storedRules = localStorage.getItem("robotrader_checklist_rules");
        setRules(storedRules ? JSON.parse(storedRules) : DEFAULT_RULES);
        const storedThreshold = localStorage.getItem("robotrader_checklist_threshold");
        if (storedThreshold) setMinThreshold(parseInt(storedThreshold, 10));
        const storedJournal = localStorage.getItem("robotrader_checklist_journal");
        if (storedJournal) setJournal(JSON.parse(storedJournal));
      } finally {
        isLoaded.current = true;
      }
    };

    loadDbData();

    // Check Upstox Status
    const checkUpstox = async () => {
      try {
        const res = await getUpstoxStatus();
        setUpstoxConnected(res?.upstox === "connected");
      } catch (err) {
        console.error(err);
      }
    };
    checkUpstox();
  }, []);

  // Save rules when they change
  useEffect(() => {
    if (mounted) {
      localStorage.setItem("robotrader_checklist_rules", JSON.stringify(rules));
      if (isLoaded.current) {
        saveChecklistRules(rules).catch(err => console.error("Error saving rules to DB:", err));
      }
    }
  }, [rules, mounted]);

  // Save threshold when it changes
  useEffect(() => {
    if (mounted) {
      localStorage.setItem("robotrader_checklist_threshold", minThreshold.toString());
      if (isLoaded.current) {
        saveChecklistThreshold(minThreshold).catch(err => console.error("Error saving threshold to DB:", err));
      }
    }
  }, [minThreshold, mounted]);

  // Save journal when it changes
  useEffect(() => {
    if (mounted) {
      localStorage.setItem("robotrader_checklist_journal", JSON.stringify(journal));
    }
  }, [journal, mounted]);

  // Autocomplete search debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchOptions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchInstruments(searchQuery);
        // Take top 10 items
        setSearchOptions((results || []).slice(0, 10));
      } catch (err) {
        console.error("Search Error", err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Close search dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // calculations
  const totalWeight = rules.reduce((acc, r) => acc + r.weight, 0);
  const checkedWeight = rules.reduce((acc, r) => acc + (r.checked ? r.weight : 0), 0);
  const score = totalWeight > 0 ? Math.round((checkedWeight / totalWeight) * 100) : 0;
  const isSatisfied = score >= minThreshold;

  // Rule Handlers
  const handleToggleCheck = (id: string) => {
    setRules(prev =>
      prev.map(r => (r.id === id ? { ...r, checked: !r.checked } : r))
    );
  };

  const handleSelectAll = () => {
    setRules(prev => prev.map(r => ({ ...r, checked: true })));
  };

  const handleDeselectAll = () => {
    setRules(prev => prev.map(r => ({ ...r, checked: false })));
  };

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    if (editingId) {
      setRules(prev =>
        prev.map(r =>
          r.id === editingId
            ? { ...r, title: newTitle, desc: newDesc, weight: newWeight }
            : r
        )
      );
      setEditingId(null);
    } else {
      const newRule: Rule = {
        id: "custom_" + Date.now(),
        title: newTitle,
        desc: newDesc,
        weight: newWeight,
        checked: false
      };
      setRules(prev => [...prev, newRule]);
    }

    setNewTitle("");
    setNewDesc("");
    setNewWeight(2);
    setShowAddForm(false);
  };

  const handleEditRuleClick = (r: Rule) => {
    setEditingId(r.id);
    setNewTitle(r.title);
    setNewDesc(r.desc);
    setNewWeight(r.weight);
    setShowAddForm(true);
  };

  const handleDeleteRule = (id: string) => {
    setRules(prev => prev.filter(r => r.id !== id));
  };

  const handleLoadPreset = (presetKey: keyof typeof PRESET_TEMPLATES) => {
    if (confirm("Are you sure? This will replace your current checklist rules.")) {
      setRules(PRESET_TEMPLATES[presetKey]);
    }
  };

  const handleSaveAsTemplate = () => {
    if (!newTemplateName.trim()) return;
    if (rules.length === 0) {
      alert("No rules to save. Add at least one rule first.");
      return;
    }
    const template: CustomTemplate = {
      id: "tpl_" + Date.now(),
      name: newTemplateName.trim(),
      rules: rules.map(r => ({ ...r, checked: false })),
      createdAt: new Date().toLocaleDateString()
    };
    const updated = [...customTemplates, template];
    setCustomTemplates(updated);
    localStorage.setItem("robotrader_checklist_custom_templates", JSON.stringify(updated));
    setNewTemplateName("");
    setShowSaveTemplateForm(false);
  };

  const handleLoadCustomTemplate = (tpl: CustomTemplate) => {
    if (confirm(`Load template "${tpl.name}"? This will replace your current checklist rules.`)) {
      setRules(tpl.rules);
    }
  };

  const handleDeleteCustomTemplate = (id: string) => {
    if (confirm("Delete this template?")) {
      const updated = customTemplates.filter(t => t.id !== id);
      setCustomTemplates(updated);
      localStorage.setItem("robotrader_checklist_custom_templates", JSON.stringify(updated));
    }
  };

  // Order Placement Handlers
  const handleOrderSubmission = () => {
    if (!selectedInst) {
      alert("Please select a trading instrument / symbol first!");
      return;
    }
    if (quantity <= 0) {
      alert("Quantity must be greater than 0");
      return;
    }

    if (!isSatisfied) {
      // Open safety warning modal before placing order
      setShowGuardModal(true);
    } else {
      // Met threshold, execute directly
      executeOrder();
    }
  };

  const executeOrder = async () => {
    if (!selectedInst) return;
    setShowGuardModal(false);

    const orderPayload = {
      instrument_key: selectedInst.instrument_key,
      trading_symbol: selectedInst.trading_symbol,
      transaction_type: orderAction,
      order_type: orderType,
      quantity: quantity,
      price: orderType === "LIMIT" || orderType === "SL" ? price : 0,
      product: product
    };

    const timestamp = new Date().toLocaleTimeString() + " " + new Date().toLocaleDateString();
    const passedRulesList = rules
      .filter(r => r.checked)
      .map(r => ({ title: r.title, weight: r.weight }));
    const failedRulesList = rules
      .filter(r => !r.checked)
      .map(r => ({ title: r.title, weight: r.weight }));

    try {
      if (isPaper) {
        // Place Mock Order
        const res = await placeMockOrder(orderPayload);
        if (res.status === "error") {
          throw new Error(res.message || "Mock placement rejected by backend server.");
        }
        
        // Log Success
        logJournalEntry({
          id: "journal_" + Date.now(),
          timestamp,
          symbol: selectedInst.trading_symbol,
          name: selectedInst.name || selectedInst.trading_symbol,
          action: orderAction,
          qty: quantity,
          price: orderPayload.price || selectedInst.last_price || 0,
          orderType,
          product,
          mode: "MOCK",
          score,
          threshold: minThreshold,
          passedRules: passedRulesList,
          failedRules: failedRulesList,
          status: "success"
        });

        setStatusMsg({
          type: "success",
          text: `Paper Order placed successfully: ${orderAction} ${quantity} ${selectedInst.trading_symbol}`
        });
      } else {
        // Live Order
        const response = await placeOrders([orderPayload]);
        const results = response.data?.results || [];
        const errors = results.filter((r: any) => r.result?.status === "error");

        if (errors.length > 0) {
          const errMsg = errors.map((e: any) => e.result?.message || "Error").join("; ");
          throw new Error(errMsg || "Live order execution rejected");
        }

        // Log Success
        logJournalEntry({
          id: "journal_" + Date.now(),
          timestamp,
          symbol: selectedInst.trading_symbol,
          name: selectedInst.name || selectedInst.trading_symbol,
          action: orderAction,
          qty: quantity,
          price: orderPayload.price || selectedInst.last_price || 0,
          orderType,
          product,
          mode: "LIVE",
          score,
          threshold: minThreshold,
          passedRules: passedRulesList,
          failedRules: failedRulesList,
          status: "success"
        });

        setStatusMsg({
          type: "success",
          text: `Live Order submitted: ${orderAction} ${quantity} ${selectedInst.trading_symbol}`
        });
      }
    } catch (err: any) {
      console.error(err);
      
      // Log Failure
      logJournalEntry({
        id: "journal_" + Date.now(),
        timestamp,
        symbol: selectedInst.trading_symbol,
        name: selectedInst.name || selectedInst.trading_symbol,
        action: orderAction,
        qty: quantity,
        price: orderPayload.price || selectedInst.last_price || 0,
        orderType,
        product,
        mode: isPaper ? "MOCK" : "LIVE",
        score,
        threshold: minThreshold,
        passedRules: passedRulesList,
        failedRules: failedRulesList,
        status: "error",
        errorMsg: err.message || "Network Error"
      });

      setStatusMsg({
        type: "error",
        text: `Order failed: ${err.message || "Check API connection"}`
      });
    }

    // Auto clear notification after 5s
    setTimeout(() => {
      setStatusMsg(null);
    }, 6000);
  };

  const logJournalEntry = async (entry: JournalEntry) => {
    setJournal(prev => [entry, ...prev]);
    try {
      await addChecklistJournalEntry(entry);
    } catch (err) {
      console.error("Failed to log entry to DB:", err);
    }
  };

  const handleClearHistory = async () => {
    if (confirm("Are you sure you want to clear your trade checklist history journal?")) {
      setJournal([]);
      try {
        await clearChecklistJournal();
      } catch (err) {
        console.error("Failed to clear DB journal:", err);
      }
    }
  };

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-indigo-500"></div>
      </div>
    );
  }

  // Determine progress bar and ring colors
  const getGradientClass = (scoreVal: number) => {
    if (scoreVal < 50) return "from-rose-500 to-orange-500";
    if (scoreVal < minThreshold) return "from-orange-500 to-yellow-500";
    return "from-emerald-500 to-teal-500";
  };

  const getBorderColorClass = (scoreVal: number) => {
    if (scoreVal < 50) return "border-rose-500/30 text-rose-500 bg-rose-500/5";
    if (scoreVal < minThreshold) return "border-yellow-500/30 text-yellow-500 bg-yellow-500/5";
    return "border-emerald-500/30 text-emerald-500 bg-emerald-500/5";
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-[#4a6fa5] pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
            <ClipboardList className="w-8 h-8 text-indigo-500" />
            Pre-Order Checklist
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Build discipline. Grade your strategy checklist, verify target weightage, and place orders directly.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 p-2 bg-gray-100 dark:bg-[#252d3d]/50 rounded-xl border border-gray-200 dark:border-[#4a6fa5]">
            <div className={`w-2 h-2 rounded-full ${upstoxConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-[11px] font-semibold tracking-wider text-gray-500 dark:text-slate-400 uppercase">
              Upstox: {upstoxConnected ? "Connected" : "Disconnected"}
            </span>
          </div>
        </div>
      </div>

      {/* Top Section - Flight Control Indicators */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Score Ring Meter */}
        <div className="bg-white dark:bg-[#252d3d]/40 backdrop-blur-md rounded-3xl p-6 border border-gray-200 dark:border-[#4a6fa5]/80 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
          <div className="flex flex-col items-center md:items-start text-center md:text-left">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Checklist Score</span>
            <span className="text-4xl font-extrabold mt-1 text-gray-900 dark:text-white">
              {score}%
            </span>
            <div className={`mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${getBorderColorClass(score)}`}>
              {score < 50 ? (
                <>
                  <ShieldAlert className="w-4 h-4" /> Danger Zone
                </>
              ) : score < minThreshold ? (
                <>
                  <AlertTriangle className="w-4 h-4" /> Underscored
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-emerald-500" /> Authorized
                </>
              )}
            </div>
          </div>
          {/* Progress bar visual container */}
          <div className="relative w-32 h-32 flex items-center justify-center flex-shrink-0">
            {/* SVG Ring */}
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="64"
                cy="64"
                r="50"
                className="stroke-gray-100 dark:stroke-gray-800"
                strokeWidth="10"
                fill="transparent"
              />
              <circle
                cx="64"
                cy="64"
                r="50"
                className={`transition-all duration-500 ease-out`}
                strokeWidth="10"
                fill="transparent"
                strokeDasharray={314}
                strokeDashoffset={314 - (314 * score) / 100}
                strokeLinecap="round"
                stroke={`url(#scoreGradient)`}
              />
              <defs>
                <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" className="text-indigo-500" stopColor="currentColor" />
                  <stop offset="100%" className="text-emerald-500" stopColor="currentColor" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute text-center">
              <span className="text-2xl font-black text-gray-900 dark:text-white">{checkedWeight}</span>
              <span className="text-xs text-gray-400 block border-t border-gray-200 dark:border-[#4a6fa5]/50 pt-0.5 mt-0.5">out of {totalWeight}w</span>
            </div>
          </div>
        </div>

        {/* Min Threshold Setup */}
        <div className="bg-white dark:bg-[#252d3d]/40 backdrop-blur-md rounded-3xl p-6 border border-gray-200 dark:border-[#4a6fa5]/80 flex flex-col justify-between shadow-sm lg:col-span-2">
          <div>
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Minimum Target Threshold</span>
              <span className="text-lg font-black text-indigo-500">{minThreshold}% Satisfied Weight</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">
              Set the minimum aggregate rules weightage required before placing orders without triggering safety override dialogs.
            </p>
          </div>
          <div className="mt-4 flex items-center gap-4">
            <span className="text-xs text-gray-400">0%</span>
            <input
              type="range"
              min="10"
              max="100"
              step="5"
              value={minThreshold}
              onChange={(e) => setMinThreshold(parseInt(e.target.value))}
              className="flex-1 accent-indigo-500 h-2 bg-gray-200 dark:bg-[#2d3748] rounded-lg cursor-pointer appearance-none"
            />
            <span className="text-xs text-gray-400">100%</span>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleSelectAll}
              className="flex-1 py-1.5 px-3 bg-gray-100 hover:bg-gray-200 dark:bg-[#252d3d] dark:hover:bg-[#2d3748] text-xs font-semibold rounded-xl text-gray-700 dark:text-slate-300 transition-colors flex items-center justify-center gap-1.5"
            >
              <CheckSquare className="w-3.5 h-3.5" /> Check All
            </button>
            <button
              onClick={handleDeselectAll}
              className="flex-1 py-1.5 px-3 bg-gray-100 hover:bg-gray-200 dark:bg-[#252d3d] dark:hover:bg-[#2d3748] text-xs font-semibold rounded-xl text-gray-700 dark:text-slate-300 transition-colors flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Clear Ticks
            </button>
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Rule Checklist Board */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white dark:bg-[#252d3d]/40 backdrop-blur-md rounded-3xl border border-gray-200 dark:border-[#4a6fa5]/80 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-[#4a6fa5] flex justify-between items-center flex-wrap gap-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  Strategy Checklist Rules
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Manage checklist items and weights</p>
              </div>
              <button
                onClick={() => {
                  setEditingId(null);
                  setNewTitle("");
                  setNewDesc("");
                  setNewWeight(2);
                  setShowAddForm(!showAddForm);
                }}
                className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-xs font-bold rounded-2xl text-white transition-all shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Add Rule
              </button>
            </div>

            {/* Quick Presets Picker */}
            <div className="p-4 bg-gray-50 dark:bg-[#252d3d]/20 border-b border-gray-200 dark:border-[#4a6fa5]/50 space-y-3">
              {/* Built-in templates row */}
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-bold text-gray-400 whitespace-nowrap">Built-in:</span>
                <button
                  onClick={() => handleLoadPreset("risk")}
                  className="py-1 px-2.5 bg-rose-500/10 text-rose-500 hover:bg-rose-500/25 border border-rose-500/20 text-xs font-bold rounded-lg transition-colors"
                >
                  Risk Management
                </button>
                <button
                  onClick={() => handleLoadPreset("trend")}
                  className="py-1 px-2.5 bg-blue-500/10 text-blue-500 hover:bg-blue-500/25 border border-blue-500/20 text-xs font-bold rounded-lg transition-colors"
                >
                  Trend Following
                </button>
                <button
                  onClick={() => handleLoadPreset("reversion")}
                  className="py-1 px-2.5 bg-amber-500/10 text-amber-500 hover:bg-amber-500/25 border border-amber-500/20 text-xs font-bold rounded-lg transition-colors"
                >
                  Mean Reversion
                </button>
              </div>

              {/* Custom templates row */}
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-bold text-gray-400 whitespace-nowrap">My Templates:</span>
                {customTemplates.length === 0 && !showSaveTemplateForm && (
                  <span className="text-xs text-gray-400 italic">No saved templates yet</span>
                )}
                {customTemplates.map(tpl => (
                  <div key={tpl.id} className="flex items-center gap-1 py-1 pl-2.5 pr-1.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 text-xs font-bold rounded-lg">
                    <button
                      onClick={() => handleLoadCustomTemplate(tpl)}
                      className="hover:text-indigo-300 transition-colors"
                      title={`Load "${tpl.name}" (${tpl.rules.length} rules, saved ${tpl.createdAt})`}
                    >
                      {tpl.name}
                    </button>
                    <button
                      onClick={() => handleDeleteCustomTemplate(tpl.id)}
                      className="ml-0.5 hover:text-rose-400 transition-colors rounded p-0.5 hover:bg-rose-500/10"
                      title="Delete template"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}

                {/* Save-as-template inline form */}
                {showSaveTemplateForm ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      type="text"
                      placeholder="Template name…"
                      value={newTemplateName}
                      onChange={e => setNewTemplateName(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") handleSaveAsTemplate(); if (e.key === "Escape") { setShowSaveTemplateForm(false); setNewTemplateName(""); } }}
                      className="px-2 py-1 text-xs bg-white dark:bg-[#252d3d] border border-indigo-500/40 rounded-lg focus:outline-none focus:border-indigo-500 dark:text-white w-40"
                    />
                    <button
                      onClick={handleSaveAsTemplate}
                      className="py-1 px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => { setShowSaveTemplateForm(false); setNewTemplateName(""); }}
                      className="py-1 px-2 bg-gray-200 dark:bg-[#2d3748] hover:bg-gray-300 text-gray-600 dark:text-slate-300 text-xs font-bold rounded-lg transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowSaveTemplateForm(true)}
                    className="py-1 px-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/20 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
                    title="Save current rules as a new template"
                  >
                    <BookmarkPlus className="w-3.5 h-3.5" /> Save as Template
                  </button>
                )}
              </div>
            </div>

            {/* Add/Edit Form */}
            {showAddForm && (
              <form onSubmit={handleAddRule} className="p-6 bg-gray-50 dark:bg-[#252d3d]/30 border-b border-gray-200 dark:border-[#4a6fa5]/80 space-y-4">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                  {editingId ? "Edit Existing Rule" : "Create New Custom Rule"}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Rule title / Condition</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Price crossed 20 EMA"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-[#252d3d] border border-gray-200 dark:border-[#4a6fa5] rounded-xl focus:outline-none focus:border-indigo-500 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Weight (1 - 10)</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={newWeight}
                      onChange={(e) => setNewWeight(Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-[#252d3d] border border-gray-200 dark:border-[#4a6fa5] rounded-xl focus:outline-none focus:border-indigo-500 dark:text-white font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Detailed Description (Optional)</label>
                  <textarea
                    placeholder="Provide details about parameters or trigger conditions..."
                    rows={2}
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-[#252d3d] border border-gray-200 dark:border-[#4a6fa5] rounded-xl focus:outline-none focus:border-indigo-500 dark:text-white"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      setEditingId(null);
                    }}
                    className="py-2 px-4 bg-gray-200 dark:bg-[#2d3748] hover:bg-gray-300 dark:hover:bg-[#2d3748] text-xs font-bold rounded-xl text-gray-700 dark:text-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-xs font-bold rounded-xl text-white transition-colors"
                  >
                    {editingId ? "Save Changes" : "Save Rule"}
                  </button>
                </div>
              </form>
            )}

            {/* Checklist List */}
            {rules.length === 0 ? (
              <div className="p-12 text-center text-gray-500 dark:text-slate-400 italic">
                No rules active. Add a rule or select a preset template above to initialize your checklist!
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800/80">
                {rules.map((rule) => (
                  <div
                    key={rule.id}
                    className={`p-4 transition-all flex items-start justify-between gap-4 group ${
                      rule.checked
                        ? "bg-emerald-500/[0.02] dark:bg-emerald-500/[0.01]"
                        : "hover:bg-gray-50 dark:hover:bg-[#252d3d]/20"
                    }`}
                  >
                    <div className="flex items-start gap-3 flex-1">
                      <button
                        onClick={() => handleToggleCheck(rule.id)}
                        className={`mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center border transition-all ${
                          rule.checked
                            ? "bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-500/20"
                            : "border-gray-200 dark:border-[#4a6fa5] bg-white dark:bg-[#252d3d] text-transparent"
                        }`}
                      >
                        <Check className="w-4 h-4 stroke-[3]" />
                      </button>
                      <div className="space-y-0.5 flex-1 cursor-pointer" onClick={() => handleToggleCheck(rule.id)}>
                        <h4 className={`text-sm font-bold transition-colors ${
                          rule.checked ? "text-gray-900 dark:text-slate-200 line-through opacity-70" : "text-gray-900 dark:text-white"
                        }`}>
                          {rule.title}
                        </h4>
                        {rule.desc && (
                          <p className="text-xs text-gray-500 dark:text-slate-400">
                            {rule.desc}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      {/* Weight Badge */}
                      <span className="px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 text-[10px] font-bold tracking-wider font-mono">
                        W:{rule.weight}
                      </span>
                      {/* Actions */}
                      <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                        <button
                          onClick={() => handleEditRuleClick(rule)}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-[#2d3748] rounded-lg text-gray-500 hover:text-indigo-500 transition-colors"
                          title="Edit Rule"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-[#2d3748] rounded-lg text-gray-500 hover:text-rose-500 transition-colors"
                          title="Delete Rule"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Order Placement & Logging */}
        <div className="lg:col-span-5 space-y-6">
          {/* Order Placement Form */}
          <div className="bg-white dark:bg-[#252d3d]/40 backdrop-blur-md rounded-3xl border border-gray-200 dark:border-[#4a6fa5]/80 shadow-sm p-6 space-y-5">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-indigo-500" />
                Checlist Guarded Order
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">Pre-verified order placement parameters</p>
            </div>

            {/* Status Notifications */}
            {statusMsg && (
              <div className={`p-3 rounded-xl border text-xs font-semibold ${
                statusMsg.type === "success" 
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                  : "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400"
              }`}>
                {statusMsg.text}
              </div>
            )}

            {/* Instrument Search Autocomplete */}
            <div className="relative" ref={dropdownRef}>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Search Symbol</label>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Enter symbol e.g. NIFTY, SBIN, RELIANCE..."
                  value={searchQuery}
                  onFocus={() => setShowDropdown(true)}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowDropdown(true);
                  }}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-[#252d3d]/60 border border-gray-200 dark:border-[#4a6fa5]/80 rounded-2xl text-sm focus:outline-none focus:border-indigo-500 dark:text-white font-semibold"
                />
                {isSearching && (
                  <div className="absolute right-3.5 top-1/2 transform -translate-y-1/2">
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-indigo-500"></div>
                  </div>
                )}
              </div>

              {/* Suggestions Dropdown */}
              {showDropdown && searchOptions.length > 0 && (
                <div className="absolute z-50 w-full mt-2 bg-white dark:bg-[#1e2433] border border-gray-200 dark:border-[#4a6fa5] rounded-2xl shadow-xl overflow-hidden max-h-60 overflow-y-auto">
                  {searchOptions.map((opt) => (
                    <div
                      key={opt.instrument_key}
                      onClick={() => {
                        setSelectedInst(opt);
                        setSearchQuery(opt.trading_symbol);
                        setShowDropdown(false);
                      }}
                      className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-850 cursor-pointer flex items-center justify-between border-b border-gray-100 dark:border-[#4a6fa5]/50"
                    >
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-gray-900 dark:text-white">{opt.trading_symbol}</span>
                        <span className="text-[10px] text-gray-500">{opt.name}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-[#252d3d] text-[9px] font-bold text-gray-500">
                          {opt.instrument_type}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 text-[9px] font-bold">
                          {opt.exchange}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Symbol Display */}
            {selectedInst && (
              <div className="p-3 bg-indigo-500/[0.03] dark:bg-indigo-500/[0.01] border border-indigo-500/10 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-xs text-gray-400 block uppercase font-mono tracking-wider">Target Instrument</span>
                  <span className="font-extrabold text-gray-950 dark:text-slate-100">{selectedInst.trading_symbol}</span>
                  <span className="text-xs text-gray-500 block">{selectedInst.name}</span>
                </div>
                <button 
                  onClick={() => {
                    setSelectedInst(null);
                    setSearchQuery("");
                  }} 
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-[#252d3d] rounded-full text-gray-400 hover:text-gray-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Buy / Sell Toggle Action */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setOrderAction("BUY")}
                className={`py-2.5 rounded-2xl font-black text-sm transition-all border ${
                  orderAction === "BUY"
                    ? "bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/25"
                    : "border-gray-200 dark:border-[#4a6fa5] bg-white dark:bg-[#252d3d] hover:bg-gray-50 dark:hover:bg-[#252d3d] text-gray-600 dark:text-slate-300"
                }`}
              >
                BUY
              </button>
              <button
                type="button"
                onClick={() => setOrderAction("SELL")}
                className={`py-2.5 rounded-2xl font-black text-sm transition-all border ${
                  orderAction === "SELL"
                    ? "bg-rose-500 border-rose-500 text-white shadow-lg shadow-rose-500/25"
                    : "border-gray-200 dark:border-[#4a6fa5] bg-white dark:bg-[#252d3d] hover:bg-gray-50 dark:hover:bg-[#252d3d] text-gray-600 dark:text-slate-300"
                }`}
              >
                SELL
              </button>
            </div>

            {/* Mode: Live / Mock Toggle */}
            <div className="p-3 bg-gray-50 dark:bg-[#252d3d]/30 rounded-2xl flex items-center justify-between border border-gray-100 dark:border-[#4a6fa5]/30">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-gray-900 dark:text-white">Execution Mode</span>
                <span className="text-[10px] text-gray-500">Live Trade or Paper Simulation</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsPaper(true)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                    isPaper
                      ? "bg-purple-600 text-white shadow-md shadow-purple-600/10"
                      : "text-gray-400 dark:text-slate-400 hover:text-gray-600"
                  }`}
                >
                  PAPER
                </button>
                <button
                  type="button"
                  onClick={() => setIsPaper(false)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                    !isPaper
                      ? "bg-amber-600 text-white shadow-md shadow-amber-600/10"
                      : "text-gray-400 dark:text-slate-400 hover:text-gray-600"
                  }`}
                >
                  LIVE
                </button>
              </div>
            </div>

            {/* Form details input grid */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Order Type</label>
                <select
                  value={orderType}
                  onChange={(e: any) => setOrderType(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-[#252d3d]/60 border border-gray-200 dark:border-[#4a6fa5] rounded-xl text-sm focus:outline-none focus:border-indigo-500 dark:text-white font-bold"
                >
                  <option value="MARKET" className="dark:bg-[#252d3d]">MARKET</option>
                  <option value="LIMIT" className="dark:bg-[#252d3d]">LIMIT</option>
                  <option value="SL" className="dark:bg-[#252d3d]">SL (Limit)</option>
                  <option value="SL-M" className="dark:bg-[#252d3d]">SL-M (Market)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Product Type</label>
                <select
                  value={product}
                  onChange={(e: any) => setProduct(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-[#252d3d]/60 border border-gray-200 dark:border-[#4a6fa5] rounded-xl text-sm focus:outline-none focus:border-indigo-500 dark:text-white font-bold"
                >
                  <option value="MIS" className="dark:bg-[#252d3d]">MIS (Intraday)</option>
                  <option value="CNC" className="dark:bg-[#252d3d]">CNC (Delivery)</option>
                </select>
              </div>
            </div>

            {/* Qty & Limit Price inputs */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-[#252d3d]/60 border border-gray-200 dark:border-[#4a6fa5] rounded-xl text-sm focus:outline-none focus:border-indigo-500 dark:text-white font-mono font-bold"
                />
              </div>
              {(orderType === "LIMIT" || orderType === "SL") ? (
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Limit Price (₹)</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    value={price}
                    onChange={(e) => setPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#252d3d]/60 border border-gray-200 dark:border-[#4a6fa5] rounded-xl text-sm focus:outline-none focus:border-indigo-500 dark:text-white font-mono font-bold"
                  />
                </div>
              ) : (
                <div className="opacity-40">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Limit Price</label>
                  <input
                    type="text"
                    disabled
                    value="Market Price"
                    className="w-full px-3 py-2 bg-gray-100 dark:bg-[#252d3d] border border-gray-200 dark:border-[#4a6fa5] rounded-xl text-sm focus:outline-none dark:text-slate-400 italic"
                  />
                </div>
              )}
            </div>

            {/* Main Place Order Button */}
            <button
              type="button"
              onClick={handleOrderSubmission}
              className={`w-full py-3 px-4 text-sm font-black text-white rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 hover:scale-[1.01] ${
                isSatisfied
                  ? "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/10 hover:shadow-indigo-600/20"
                  : "bg-amber-600 hover:bg-amber-700 shadow-amber-600/10 hover:shadow-amber-600/20"
              }`}
            >
              {!isSatisfied && <AlertTriangle className="w-4 h-4 animate-bounce" />}
              {isPaper ? "Place Paper Order" : "Place Live Order"}
            </button>
          </div>

          {/* Trade Journal & History Log */}
          <div className="bg-white dark:bg-[#252d3d]/40 backdrop-blur-md rounded-3xl border border-gray-200 dark:border-[#4a6fa5]/80 shadow-sm p-6 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <History className="w-5 h-5 text-gray-500" />
                  Checklist Trade Log
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Audit log of checked rules on placement</p>
              </div>
              {journal.length > 0 && (
                <button
                  onClick={handleClearHistory}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-[#2d3748] rounded-xl text-gray-400 hover:text-rose-500 transition-colors"
                  title="Clear Log History"
                >
                  <Trash className="w-4 h-4" />
                </button>
              )}
            </div>

            {journal.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-slate-400 italic text-xs">
                No trades logged yet. Place orders from this page to generate journal records.
              </div>
            ) : (
              <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                {journal.map((entry) => {
                  const isExpanded = expandedJournalId === entry.id;
                  const isBelowThr = entry.score < entry.threshold;

                  return (
                    <div
                      key={entry.id}
                      className="border border-gray-150 dark:border-[#4a6fa5]/85 rounded-2xl overflow-hidden bg-white dark:bg-[#1e2433]/60"
                    >
                      {/* Accordion Trigger Header */}
                      <div
                        onClick={() => setExpandedJournalId(isExpanded ? null : entry.id)}
                        className="p-3.5 hover:bg-gray-50 dark:hover:bg-[#252d3d]/20 cursor-pointer flex items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black tracking-wide ${
                            entry.action === "BUY" 
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                          }`}>
                            {entry.action}
                          </span>
                          <div className="flex flex-col">
                            <span className="font-black text-sm text-gray-900 dark:text-white leading-tight">
                              {entry.symbol}
                            </span>
                            <span className="text-[9px] text-gray-400 leading-none mt-0.5">
                              {entry.qty} Qty @ {entry.price.toFixed(1)} | {entry.mode}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5">
                          {/* Score Badge */}
                          <div className={`px-2 py-0.5 rounded-lg text-[10px] font-black border ${
                            isBelowThr
                              ? "border-amber-500/30 text-amber-500 bg-amber-500/5"
                              : "border-emerald-500/30 text-emerald-500 bg-emerald-500/5"
                          }`}>
                            Score: {entry.score}%
                          </div>
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                        </div>
                      </div>

                      {/* Expandable Details */}
                      {isExpanded && (
                        <div className="p-4 bg-gray-50/50 dark:bg-[#1e2433]/90 border-t border-gray-150 dark:border-[#4a6fa5]/60 text-xs space-y-3">
                          <div className="flex justify-between items-center text-[10px] text-gray-400 font-mono">
                            <span>Placed at: {entry.timestamp}</span>
                            <span>{entry.product} | {entry.orderType}</span>
                          </div>

                          {/* Order Execution Status */}
                          <div className="flex items-center gap-1.5 font-bold">
                            <span>Status:</span>
                            {entry.status === "success" ? (
                              <span className="text-emerald-500 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Executed
                              </span>
                            ) : (
                              <span className="text-rose-500 flex flex-col">
                                <span className="flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Failed</span>
                                {entry.errorMsg && <span className="text-[10px] text-rose-500/70 font-normal">Details: {entry.errorMsg}</span>}
                              </span>
                            )}
                          </div>

                          {/* Rules auditing list */}
                          <div className="space-y-2 border-t border-gray-150 dark:border-[#4a6fa5]/50 pt-2">
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                              Rules Checklist Audit
                            </div>

                            {/* Met Rules */}
                            {entry.passedRules.length > 0 && (
                              <div className="space-y-1">
                                <div className="text-emerald-500 font-bold text-[10px] flex items-center gap-1">
                                  ✓ Met Checklist Items ({entry.passedRules.length})
                                </div>
                                <div className="pl-3.5 space-y-0.5 text-gray-600 dark:text-slate-300">
                                  {entry.passedRules.map((r, i) => (
                                    <div key={i} className="flex justify-between items-center">
                                      <span>• {r.title}</span>
                                      <span className="font-mono text-[9px] text-indigo-400">w:{r.weight}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Failed Rules */}
                            {entry.failedRules.length > 0 && (
                              <div className="space-y-1">
                                <div className="text-amber-500 font-bold text-[10px] flex items-center gap-1">
                                  ✗ Skipped/Violated Checklist Items ({entry.failedRules.length})
                                </div>
                                <div className="pl-3.5 space-y-0.5 text-gray-600 dark:text-slate-300">
                                  {entry.failedRules.map((r, i) => (
                                    <div key={i} className="flex justify-between items-center">
                                      <span>• {r.title}</span>
                                      <span className="font-mono text-[9px] text-indigo-400">w:{r.weight}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Safety Shield Confirmation Modal (For checklist rule overrides) */}
      {showGuardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/60 backdrop-blur-sm transition-opacity">
          <div className="relative w-full max-w-lg bg-white dark:bg-[#1e2433] border border-gray-200 dark:border-[#4a6fa5] rounded-3xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-start gap-4">
              <div className="p-3 bg-amber-500/10 text-amber-500 rounded-2xl flex-shrink-0">
                <AlertTriangle className="w-8 h-8 animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-950 dark:text-white leading-tight">
                  Trading Rule Checklist Violation!
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Your current score of <span className="font-black text-amber-500">{score}%</span> does not meet your minimum threshold of <span className="font-black text-indigo-500">{minThreshold}%</span>.
                </p>
              </div>
            </div>

            {/* List of failed rules */}
            <div className="bg-gray-50 dark:bg-[#252d3d]/40 border border-gray-150 dark:border-[#4a6fa5]/50 rounded-2xl p-4 max-h-48 overflow-y-auto space-y-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Unsatisfied Conditions ({rules.filter(r => !r.checked).length}):</span>
              <ul className="space-y-2.5 text-xs text-gray-700 dark:text-slate-300">
                {rules
                  .filter(r => !r.checked)
                  .map((rule) => (
                    <li key={rule.id} className="flex gap-2">
                      <span className="text-amber-500 font-extrabold flex-shrink-0">✗</span>
                      <div>
                        <span className="font-bold">{rule.title}</span>
                        <span className="px-1.5 py-0.2 ml-1 rounded bg-indigo-500/10 text-indigo-500 font-mono text-[9px] font-bold">w:{rule.weight}</span>
                      </div>
                    </li>
                  ))}
              </ul>
            </div>

            <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
              Placing this trade violates your set strategy criteria. Would you like to override your trade checks and force execution anyway, or abort?
            </p>

            {/* Footer Buttons */}
            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowGuardModal(false)}
                className="py-2.5 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-[#252d3d] dark:hover:bg-[#2d3748] text-xs font-bold rounded-2xl text-gray-700 dark:text-slate-300 transition-colors flex-1"
              >
                Abort Trade
              </button>
              <button
                type="button"
                onClick={executeOrder}
                className="py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-xs font-black rounded-2xl text-white shadow-lg shadow-amber-600/15 transition-all flex-1"
              >
                Confirm Override & Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
