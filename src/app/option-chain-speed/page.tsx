"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import {
  getExpiryDates,
  getOptionChain,
  placeOrders,
  placeMockOrder,
  placeMockOrders,
  cancelAllOrders,
  squareOffAll,
  getUserFunds,
  getPositions,
  exitPosition,
  exitMockPosition,
  getQuotes,
  getUserCharges
} from "@/services/api";
import {
  analyzeTrade,
  submitRlFeedback,
  getAgentLogs
} from "@/services/agentic-api";
import {
  Button, Select, MenuItem, FormControl, InputLabel,
  Switch, FormControlLabel, Typography, Chip, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Checkbox,
  Dialog, DialogTitle, DialogContent, DialogActions, Grid, Slider
} from "@mui/material";
import {
  RefreshCw, Zap, Trash2, Clock, AlertTriangle, ShieldAlert,
  Flame, Crosshair, ArrowUpDown, ChevronDown, Check, X, Ban, Settings, Keyboard, Brain
} from "lucide-react";
import { Tooltip } from "@mui/material";
import clsx from "clsx";

const INDICES = [
  { label: 'NIFTY', value: 'NSE_INDEX|Nifty 50' },
  { label: 'BANKNIFTY', value: 'NSE_INDEX|Nifty Bank' },
  { label: 'FINNIFTY', value: 'NSE_INDEX|Nifty Fin Service' },
  { label: 'MIDCPNIFTY', value: 'NSE_INDEX|NIFTY MID SELECT' },
  { label: 'SENSEX', value: 'BSE_INDEX|SENSEX' },
  { label: 'BANKEX', value: 'BSE_INDEX|BANKEX' },
];

export default function SpeedOptionChain() {
  const [mounted, setMounted] = useState(false);
  const [index, setIndex] = useState(INDICES[0].value);
  const [expiryDates, setExpiryDates] = useState<string[]>([]);
  const [expiry, setExpiry] = useState("");
  const [chain, setChain] = useState<any[]>([]);
  const [spot, setSpot] = useState(0);
  const [totals, setTotals] = useState({ ce: 0, pe: 0 });
  const [stats, setStats] = useState({ pcr: 0, itmCallOi: 0, itmPutOi: 0 });

  const [loading, setLoading] = useState(false);
  const [isPaper, setIsPaper] = useState(false); // Paper Trading Mode by default for Speed page
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [chainRefreshInterval, setChainRefreshInterval] = useState(5); // Default 5s

  const [selectedItems, setSelectedItems] = useState<Record<string, any>>({});
  const [lots, setLots] = useState(1); // Fallback lot count if capital engine is disabled

  // Identify ATM strike row
  const speedStrikes = useMemo(() => {
    if (chain.length === 0 || !spot) return { itm2: null, itm1: null, atm: null, otm1: null, otm2: null };

    // Find closest strike
    let closestIdx = 0;
    let minDiff = 999999;
    chain.forEach((row, idx) => {
      const diff = Math.abs(row.strike - spot);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = idx;
      }
    });

    return {
      itm2: closestIdx > 1 ? chain[closestIdx - 2] : null,
      itm1: closestIdx > 0 ? chain[closestIdx - 1] : null,
      atm: chain[closestIdx],
      otm1: closestIdx < chain.length - 1 ? chain[closestIdx + 1] : null,
      otm2: closestIdx < chain.length - 2 ? chain[closestIdx + 2] : null,
    };
  }, [chain, spot]);

  // Capital Allocation states
  const [capital, setCapital] = useState<number>(50000);
  const [useCapitalEngine, setUseCapitalEngine] = useState<boolean>(true);

  // Exits & Risk Guard states
  const [maxSessionLoss, setMaxSessionLoss] = useState<number>(0); // 0 = disabled
  const [maxSessionProfit, setMaxSessionProfit] = useState<number>(0); // 0 = disabled
  const [exitOffsetPct, setExitOffsetPct] = useState<number>(2.0); // Exit limit order slippage offset %
  const [isRiskHalted, setIsRiskHalted] = useState<boolean>(false);
  const [haltReason, setHaltReason] = useState<string>("");
  const [enableShield, setEnableShield] = useState<boolean>(true);

  // Position-level stop loss & target presets
  const [globalOptionSlPct, setGlobalOptionSlPct] = useState<number>(0); // 0 = disabled
  const [globalOptionTargetPct, setGlobalOptionTargetPct] = useState<number>(0); // 0 = disabled
  const [globalTrailingSlPct, setGlobalTrailingSlPct] = useState<number>(0); // 0 = disabled
  const [globalIndexSlDiff, setGlobalIndexSlDiff] = useState<number>(0); // index points
  const [globalIndexTargetDiff, setGlobalIndexTargetDiff] = useState<number>(0);
  const [enableAutoExits, setEnableAutoExits] = useState<boolean>(true);

  // Temporary global presets states for safety-gated updates
  const [tempGlobalOptionSlPct, setTempGlobalOptionSlPct] = useState<string>("0");
  const [tempGlobalOptionTargetPct, setTempGlobalOptionTargetPct] = useState<string>("0");
  const [tempGlobalTrailingSlPct, setTempGlobalTrailingSlPct] = useState<string>("0");
  const [tempGlobalIndexSlDiff, setTempGlobalIndexSlDiff] = useState<string>("0");
  const [tempGlobalIndexTargetDiff, setTempGlobalIndexTargetDiff] = useState<string>("0");

  // Temporary states for other settings
  const [tempCapital, setTempCapital] = useState<string>("50000");
  const [tempMaxSessionLoss, setTempMaxSessionLoss] = useState<string>("0");
  const [tempMaxSessionProfit, setTempMaxSessionProfit] = useState<string>("0");
  const [tempExitOffsetPct, setTempExitOffsetPct] = useState<string>("2.0");

  const hasUnsavedPresets =
    tempGlobalOptionSlPct !== globalOptionSlPct.toString() ||
    tempGlobalOptionTargetPct !== globalOptionTargetPct.toString() ||
    tempGlobalTrailingSlPct !== globalTrailingSlPct.toString() ||
    tempGlobalIndexSlDiff !== globalIndexSlDiff.toString() ||
    tempGlobalIndexTargetDiff !== globalIndexTargetDiff.toString();

  const hasUnsavedCapital = tempCapital !== capital.toString();
  const hasUnsavedShield =
    tempMaxSessionLoss !== maxSessionLoss.toString() ||
    tempMaxSessionProfit !== maxSessionProfit.toString() ||
    tempExitOffsetPct !== exitOffsetPct.toString();

  const handleSavePresets = () => {
    const sl = parseFloat(tempGlobalOptionSlPct) || 0;
    const target = parseFloat(tempGlobalOptionTargetPct) || 0;
    const trailing = parseFloat(tempGlobalTrailingSlPct) || 0;
    const indexSl = parseFloat(tempGlobalIndexSlDiff) || 0;
    const indexTarget = parseFloat(tempGlobalIndexTargetDiff) || 0;

    setGlobalOptionSlPct(sl);
    setGlobalOptionTargetPct(target);
    setGlobalTrailingSlPct(trailing);
    setGlobalIndexSlDiff(indexSl);
    setGlobalIndexTargetDiff(indexTarget);
  };

  const handleResetPresets = () => {
    setTempGlobalOptionSlPct(globalOptionSlPct.toString());
    setTempGlobalOptionTargetPct(globalOptionTargetPct.toString());
    setTempGlobalTrailingSlPct(globalTrailingSlPct.toString());
    setTempGlobalIndexSlDiff(globalIndexSlDiff.toString());
    setTempGlobalIndexTargetDiff(globalIndexTargetDiff.toString());
  };

  const handleSaveCapital = () => {
    const val = parseFloat(tempCapital);
    const parsed = isNaN(val) ? 0 : val;
    const finalVal = parsed < 1000 && parsed !== 0 ? 1000 : parsed;
    setCapital(finalVal);
    setTempCapital(finalVal.toString());
  };

  const handleResetCapital = () => {
    setTempCapital(capital.toString());
  };

  const handleSaveShield = () => {
    const loss = Math.max(0, parseFloat(tempMaxSessionLoss) || 0);
    const profit = Math.max(0, parseFloat(tempMaxSessionProfit) || 0);
    const offset = Math.min(10, Math.max(0.1, parseFloat(tempExitOffsetPct) || 2.0));

    setMaxSessionLoss(loss);
    setMaxSessionProfit(profit);
    setExitOffsetPct(offset);

    setTempMaxSessionLoss(loss.toString());
    setTempMaxSessionProfit(profit.toString());
    setTempExitOffsetPct(offset.toString());
  };

  const handleResetShield = () => {
    setTempMaxSessionLoss(maxSessionLoss.toString());
    setTempMaxSessionProfit(maxSessionProfit.toString());
    setTempExitOffsetPct(exitOffsetPct.toString());
  };

  // Live overrides for target/SL per position
  // Key: instrument_key. Value: rules details
  const [positionRules, setPositionRules] = useState<Record<string, {
    slLtp?: number;
    targetLtp?: number;
    slSpot?: number;
    targetSpot?: number;
    entrySpot?: number;
    entryLtp?: number;
    type?: "CE" | "PE";
    trailingSlPct?: number;
    highestPrice?: number;
    lowestPrice?: number;
  }>>({});

  const [funds, setFunds] = useState<any>(null);
  const [positions, setPositions] = useState<any[]>([]);
  const [autoRefreshPositions, setAutoRefreshPositions] = useState(true);
  const [posRefreshInterval, setPosRefreshInterval] = useState(5); // Default 5s
  const [showClosedPositions, setShowClosedPositions] = useState(false);

  // Agentic AI states
  const [enableAgentic, setEnableAgentic] = useState<boolean>(false);
  const [enableAutoPilot, setEnableAutoPilot] = useState<boolean>(false);
  const [copilotOpen, setCopilotOpen] = useState<boolean>(true);
  const [copilotAnalysis, setCopilotAnalysis] = useState<any>(null);
  const [copilotLoading, setCopilotLoading] = useState<boolean>(false);
  const [agentLogs, setAgentLogs] = useState<string[]>([]);
  const [tempRules, setTempRules] = useState<Record<string, { slLtp?: string; targetLtp?: string; trailingSlPct?: string; slSpot?: string; targetSpot?: string }>>({});

  const getRuleVal = (key: string, field: 'slLtp' | 'targetLtp' | 'trailingSlPct' | 'slSpot' | 'targetSpot') => {
    if (tempRules[key] && tempRules[key][field] !== undefined) {
      return tempRules[key][field]!;
    }
    const val = positionRules[key]?.[field];
    return val !== undefined ? val.toString() : "";
  };

  const handleTempRuleChange = (key: string, field: 'slLtp' | 'targetLtp' | 'trailingSlPct' | 'slSpot' | 'targetSpot', val: string) => {
    setTempRules(prev => ({
      ...prev,
      [key]: {
        ...(prev[key] || {}),
        [field]: val
      }
    }));
  };

  const hasUnsavedRules = (key: string) => {
    const temp = tempRules[key];
    if (!temp) return false;
    return Object.keys(temp).length > 0;
  };

  const handleSaveRules = (p: any) => {
    const key = isPaper ? p.trade_id : (p.instrument_key || p.instrument_token);
    if (!key) return;
    const temp = tempRules[key];
    if (!temp) return;

    setPositionRules(prev => {
      const prevRule = prev[key] || {};
      const newRule = { ...prevRule };

      if (temp.slLtp !== undefined) {
        newRule.slLtp = temp.slLtp.trim() === "" ? undefined : parseFloat(temp.slLtp) || undefined;
      }
      if (temp.targetLtp !== undefined) {
        newRule.targetLtp = temp.targetLtp.trim() === "" ? undefined : parseFloat(temp.targetLtp) || undefined;
      }
      if (temp.trailingSlPct !== undefined) {
        const val = temp.trailingSlPct.trim() === "" ? undefined : parseFloat(temp.trailingSlPct) || undefined;
        newRule.trailingSlPct = val;
        if (val && val > 0) {
          if (p.quantity > 0) {
            const highest = prevRule.highestPrice || p.last_price || p.average_price || 0;
            newRule.highestPrice = highest;
            newRule.slLtp = highest * (1 - val / 100);
          } else {
            const lowest = prevRule.lowestPrice || p.last_price || p.average_price || 0;
            newRule.lowestPrice = lowest;
            newRule.slLtp = lowest * (1 + val / 100);
          }
        }
      }
      if (temp.slSpot !== undefined) {
        newRule.slSpot = temp.slSpot.trim() === "" ? undefined : parseFloat(temp.slSpot) || undefined;
      }
      if (temp.targetSpot !== undefined) {
        newRule.targetSpot = temp.targetSpot.trim() === "" ? undefined : parseFloat(temp.targetSpot) || undefined;
      }

      return {
        ...prev,
        [key]: newRule
      };
    });

    // Clear temp state
    setTempRules(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleCancelRules = (key: string) => {
    setTempRules(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // Keyboard Shortcuts settings
  const [enableHotkeys, setEnableHotkeys] = useState<boolean>(false);

  const roundToTick = (val: number) => {
    return Math.round(val * 20) / 20;
  };

  // Charges State
  const [charges, setCharges] = useState<any>(null);
  const [showTradeBook, setShowTradeBook] = useState(false);

  // Limit Exit State
  const [limitExitOpen, setLimitExitOpen] = useState(false);
  const [limitExitPosition, setLimitExitPosition] = useState<any>(null);
  const [limitPrice, setLimitPrice] = useState("");

  // Spot Polling for Auto Exit
  const [spotLtp, setSpotLtp] = useState<number>(0);
  const [spotChange, setSpotChange] = useState<number>(0);
  const [spotPchange, setSpotPchange] = useState<number>(0);
  const [monitorInterval, setMonitorInterval] = useState<number>(1); // Default 1s
  const [isSpotPolling, setIsSpotPolling] = useState(false); // Toggle for Spot Polling
  // Refs for keeping polling callback closures fresh
  const fetchPositionsRef = useRef<any>(null);
  const fetchChainRef = useRef<any>(null);
  const hotkeysRef = useRef<any>({});
  // SSR Protection and loading settings
  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      const storedCapital = localStorage.getItem("speed_capital");
      if (storedCapital) {
        setCapital(parseFloat(storedCapital));
        setTempCapital(storedCapital);
      }

      const storedUseCapital = localStorage.getItem("speed_use_capital");
      if (storedUseCapital) setUseCapitalEngine(storedUseCapital === "true");

      const storedMaxLoss = localStorage.getItem("speed_max_loss");
      if (storedMaxLoss) {
        setMaxSessionLoss(parseFloat(storedMaxLoss));
        setTempMaxSessionLoss(storedMaxLoss);
      }

      const storedMaxProfit = localStorage.getItem("speed_max_profit");
      if (storedMaxProfit) {
        setMaxSessionProfit(parseFloat(storedMaxProfit));
        setTempMaxSessionProfit(storedMaxProfit);
      }

      const storedSlPct = localStorage.getItem("speed_sl_pct");
      if (storedSlPct) {
        setGlobalOptionSlPct(parseFloat(storedSlPct));
        setTempGlobalOptionSlPct(storedSlPct);
      }

      const storedTargetPct = localStorage.getItem("speed_target_pct");
      if (storedTargetPct) {
        setGlobalOptionTargetPct(parseFloat(storedTargetPct));
        setTempGlobalOptionTargetPct(storedTargetPct);
      }

      const storedTrailingSlPct = localStorage.getItem("speed_trailing_sl_pct");
      if (storedTrailingSlPct) {
        setGlobalTrailingSlPct(parseFloat(storedTrailingSlPct));
        setTempGlobalTrailingSlPct(storedTrailingSlPct);
      }

      const storedIndexSlDiff = localStorage.getItem("speed_index_sl_diff");
      if (storedIndexSlDiff) {
        setGlobalIndexSlDiff(parseFloat(storedIndexSlDiff));
        setTempGlobalIndexSlDiff(storedIndexSlDiff);
      }

      const storedIndexTargetDiff = localStorage.getItem("speed_index_target_diff");
      if (storedIndexTargetDiff) {
        setGlobalIndexTargetDiff(parseFloat(storedIndexTargetDiff));
        setTempGlobalIndexTargetDiff(storedIndexTargetDiff);
      }

      const storedEnableShield = localStorage.getItem("speed_enable_shield");
      if (storedEnableShield) setEnableShield(storedEnableShield === "true");

      const storedEnableAutoExits = localStorage.getItem("speed_enable_auto_exits");
      if (storedEnableAutoExits) setEnableAutoExits(storedEnableAutoExits === "true");

      const storedEnableAutoPilot = localStorage.getItem("speed_enable_auto_pilot");
      if (storedEnableAutoPilot) setEnableAutoPilot(storedEnableAutoPilot === "true");

      const storedEnableAgentic = localStorage.getItem("global_enable_agentic") || localStorage.getItem("speed_enable_agentic");
      if (storedEnableAgentic) setEnableAgentic(storedEnableAgentic === "true");

      const storedRules = localStorage.getItem("speed_position_rules");
      if (storedRules) setPositionRules(JSON.parse(storedRules));

      const storedHotkeys = localStorage.getItem("speed_enable_hotkeys");
      if (storedHotkeys) setEnableHotkeys(storedHotkeys === "true");

      const storedExitOffset = localStorage.getItem("speed_exit_offset");
      if (storedExitOffset) {
        setExitOffsetPct(parseFloat(storedExitOffset));
        setTempExitOffsetPct(storedExitOffset);
      }
    }
  }, []);

  // Save changes to localStorage
  useEffect(() => {
    if (mounted) {
      localStorage.setItem("speed_capital", capital.toString());
      localStorage.setItem("speed_use_capital", useCapitalEngine.toString());
      localStorage.setItem("speed_max_loss", maxSessionLoss.toString());
      localStorage.setItem("speed_max_profit", maxSessionProfit.toString());
      localStorage.setItem("speed_sl_pct", globalOptionSlPct.toString());
      localStorage.setItem("speed_target_pct", globalOptionTargetPct.toString());
      localStorage.setItem("speed_trailing_sl_pct", globalTrailingSlPct.toString());
      localStorage.setItem("speed_index_sl_diff", globalIndexSlDiff.toString());
      localStorage.setItem("speed_index_target_diff", globalIndexTargetDiff.toString());
      localStorage.setItem("speed_enable_shield", enableShield.toString());
      localStorage.setItem("speed_enable_auto_exits", enableAutoExits.toString());
      localStorage.setItem("speed_enable_auto_pilot", enableAutoPilot.toString());
      localStorage.setItem("speed_enable_agentic", enableAgentic.toString());
      localStorage.setItem("global_enable_agentic", enableAgentic.toString());
      localStorage.setItem("speed_enable_hotkeys", enableHotkeys.toString());
      localStorage.setItem("speed_exit_offset", exitOffsetPct.toString());
    }
  }, [capital, useCapitalEngine, maxSessionLoss, maxSessionProfit, globalOptionSlPct, globalOptionTargetPct, globalTrailingSlPct, globalIndexSlDiff, globalIndexTargetDiff, enableShield, enableAutoExits, enableAutoPilot, enableAgentic, enableHotkeys, exitOffsetPct, mounted]);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem("speed_position_rules", JSON.stringify(positionRules));
    }
  }, [positionRules, mounted]);

  useEffect(() => {
    loadExpiries();
    fetchFunds();
    fetchPositions();
    fetchCharges();
  }, [index]);

  useEffect(() => {
    fetchPositions();
  }, [isPaper]);

  useEffect(() => {
    if (expiry) fetchChain();
  }, [expiry]);

  useEffect(() => {
    let interval: any;
    if (autoRefresh && expiry) {
      interval = setInterval(() => {
        if (fetchChainRef.current) {
          fetchChainRef.current(true);
        }
      }, Math.max(1000, chainRefreshInterval * 1000));
    }
    return () => clearInterval(interval);
  }, [autoRefresh, expiry, chainRefreshInterval]);

  // Synchronize hotkey references on every render to ensure key listeners capture the latest closures
  useEffect(() => {
    hotkeysRef.current = {
      handlePanicExit,
      handleCancelAllOrders,
      handleExitAllLiveOnly,
      handleExitAllMockOnly,
      speedStrikes,
      handleQuickBuy
    };
  });

  // Keyboard Shortcuts Hook
  useEffect(() => {
    if (!enableHotkeys) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore inputs, textarea
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      const {
        handlePanicExit,
        handleCancelAllOrders,
        handleExitAllLiveOnly,
        handleExitAllMockOnly,
        speedStrikes: latestStrikes,
        handleQuickBuy
      } = hotkeysRef.current;

      const code = e.code;
      const key = e.key.toLowerCase();

      if (code === "Space") {
        e.preventDefault();
        handlePanicExit?.();
      } else if (key === "c") {
        e.preventDefault();
        handleCancelAllOrders?.();
      } else if (key === "x") {
        e.preventDefault();
        handleExitAllLiveOnly?.();
      } else if (key === "z") {
        e.preventDefault();
        handleExitAllMockOnly?.();
      } else if (key === "q") {
        e.preventDefault();
        if (latestStrikes?.atm?.ce) {
          handleQuickBuy?.(latestStrikes.atm.ce);
        }
      } else if (key === "w") {
        e.preventDefault();
        if (latestStrikes?.otm1?.ce) {
          handleQuickBuy?.(latestStrikes.otm1.ce);
        }
      } else if (key === "e") {
        e.preventDefault();
        if (latestStrikes?.otm2?.ce) {
          handleQuickBuy?.(latestStrikes.otm2.ce);
        }
      } else if (key === "p") {
        e.preventDefault();
        if (latestStrikes?.atm?.pe) {
          handleQuickBuy?.(latestStrikes.atm.pe);
        }
      } else if (key === "o") {
        e.preventDefault();
        if (latestStrikes?.itm1?.pe) {
          handleQuickBuy?.(latestStrikes.itm1.pe);
        }
      } else if (key === "i") {
        e.preventDefault();
        if (latestStrikes?.itm2?.pe) {
          handleQuickBuy?.(latestStrikes.itm2.pe);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enableHotkeys]);

  // Expiry Loader
  const loadExpiries = async () => {
    const dates = await getExpiryDates(index);
    setExpiryDates(dates);
    if (dates.length > 0) {
      setExpiry(dates[0]);
    } else {
      setExpiry("");
      setChain([]);
    }
  };

  // Funds Fetcher
  const fetchFunds = async () => {
    try {
      const data = await getUserFunds();
      setFunds(data);
    } catch (e) { console.error(e); }
  };

  // Charges Fetcher
  const fetchCharges = async () => {
    try {
      const data = await getUserCharges();
      setCharges(data);
    } catch (e) { console.error(e); }
  };

  const fetchPositions = async (silent = false) => {
    try {
      let p = [];
      if (isPaper) {
        const mockPositions = await import("@/services/api").then(m => m.getMockPositions());
        p = Array.isArray(mockPositions) ? mockPositions : [];
      } else {
        const livePos = await getPositions();
        p = Array.isArray(livePos) ? livePos : [];
      }
      setPositions(p);

      // Auto Initialize Rule Exits for NEW active positions if they don't have rules yet
      p.forEach((pos: any) => {
        const posKey = isPaper ? pos.trade_id : (pos.instrument_key || pos.instrument_token);
        if (pos.quantity !== 0 && posKey && !positionRules[posKey]) {
          const isCe = pos.trading_symbol?.includes("CE") || false;
          const isPe = pos.trading_symbol?.includes("PE") || false;
          const type = isCe ? "CE" : (isPe ? "PE" : undefined);

          const newRule: any = {
            entrySpot: spotLtp || spot,
            entryLtp: pos.average_price,
            type
          };

          if (enableAutoExits) {
            if (globalOptionSlPct > 0) {
              newRule.slLtp = pos.average_price * (1 - globalOptionSlPct / 100);
            }
            if (globalOptionTargetPct > 0) {
              newRule.targetLtp = pos.average_price * (1 + globalOptionTargetPct / 100);
            }
            if (globalTrailingSlPct > 0) {
              newRule.trailingSlPct = globalTrailingSlPct;
              if (pos.quantity > 0) {
                newRule.highestPrice = pos.last_price || pos.average_price;
                newRule.slLtp = newRule.highestPrice * (1 - globalTrailingSlPct / 100);
              } else {
                newRule.lowestPrice = pos.last_price || pos.average_price;
                newRule.slLtp = newRule.lowestPrice * (1 + globalTrailingSlPct / 100);
              }
            }
            if (globalIndexSlDiff > 0 && spotLtp > 0) {
              newRule.slSpot = isCe ? spotLtp - globalIndexSlDiff : spotLtp + globalIndexSlDiff;
            }
            if (globalIndexTargetDiff > 0 && spotLtp > 0) {
              newRule.targetSpot = isCe ? spotLtp + globalIndexTargetDiff : spotLtp - globalIndexTargetDiff;
            }
          }

          setPositionRules(prev => ({
            ...prev,
            [posKey]: newRule
          }));
        }
      });

      // Clean up rules for positions that are no longer active
      const activeKeys = p.filter((pos: any) => pos.quantity !== 0).map((pos: any) => isPaper ? pos.trade_id : (pos.instrument_key || pos.instrument_token));
      
      setPositionRules(prev => {
        const next = { ...prev };
        let changed = false;
        Object.keys(next).forEach(key => {
          if (!activeKeys.includes(key)) {
            delete next[key];
            changed = true;
          }
        });
        return changed ? next : prev;
      });

      setTempRules(prev => {
        const next = { ...prev };
        let changed = false;
        Object.keys(next).forEach(key => {
          if (!activeKeys.includes(key)) {
            delete next[key];
            changed = true;
          }
        });
        return changed ? next : prev;
      });

    } catch (e) { console.error(e); }
  };

  // Chain Fetcher
  const fetchChain = async (silent = false) => {
    if (!silent) setLoading(true);
    const data = await getOptionChain(index, expiry);

    const raw = data.data || [];
    const spotPrice = data.spot_price || 0;
    setSpot(spotPrice);
    if (spotPrice > 0) {
      setSpotLtp(spotPrice);
    }
    if (data.spot_change !== undefined) {
      setSpotChange(data.spot_change);
    }
    if (data.spot_pchange !== undefined) {
      setSpotPchange(data.spot_pchange);
    }
    const t = data.totals || {};
    setTotals({ ce: t.ce || 0, pe: t.pe || 0 });

    const strikes: any = {};
    raw.forEach((item: any) => {
      if (!strikes[item.strike_price]) strikes[item.strike_price] = { strike: item.strike_price };
      if (item.instrument_type === 'CE') strikes[item.strike_price].ce = item;
      if (item.instrument_type === 'PE') strikes[item.strike_price].pe = item;
    });

    let sorted = Object.values(strikes).sort((a: any, b: any) => a.strike - b.strike);
    const pcr = data.totals && data.totals.ce > 0 ? (data.totals.pe / data.totals.ce) : 0;

    let itmCallOi = 0;
    let itmPutOi = 0;

    if (spotPrice > 0) {
      const validStrikes = sorted.filter((s: any) => s.ce && s.pe);
      const atmIdx = validStrikes.findIndex((s: any) => s.strike >= spotPrice);

      if (atmIdx !== -1) {
        const startCall = Math.max(0, atmIdx - 5);
        validStrikes.slice(startCall, atmIdx).forEach((s: any) => {
          itmCallOi += (s.ce?.open_interest || 0);
        });

        validStrikes.slice(atmIdx, atmIdx + 5).forEach((s: any) => {
          itmPutOi += (s.pe?.open_interest || 0);
        });
      }
    }

    setStats({ pcr, itmCallOi, itmPutOi });

    if (spotPrice > 0 && sorted.length > 0) {
      const atmIdx = sorted.findIndex((row: any) => row.strike >= spotPrice);
      if (atmIdx !== -1) {
        const start = Math.max(0, atmIdx - 10);
        const end = Math.min(sorted.length, atmIdx + 10);
        sorted = sorted.slice(start, end);
      }
    }
    setChain(sorted);
    if (!silent) setLoading(false);
  };

  fetchPositionsRef.current = fetchPositions;
  fetchChainRef.current = fetchChain;

  const getPositionByInstrumentKey = useCallback((key: string) => {
    if (!positions || !key) return null;
    return positions.find(p => p.instrument_token === key || p.instrument_key === key);
  }, [positions]);

  const getLotSize = (idx: string) => {
    if (idx.includes('Nifty 50') || idx.includes('NIFTY 50')) return 65;
    if (idx.includes('Nifty Bank') || idx.includes('BANKNIFTY')) return 30;
    if (idx.includes('Fin Service') || idx.includes('FINNIFTY')) return 65;
    if (idx.includes('MID') || idx.includes('MIDCPNIFTY')) return 120;
    if (idx.includes('SENSEX')) return 20;
    if (idx.includes('BANKEX')) return 30;
    if (idx.toLowerCase().includes('banknifty')) return 30;
    if (idx.toLowerCase().includes('nifty')) return 65;
    return 50;
  };

  const getFreezeLimit = (idx: string) => {
    if (idx.toLowerCase().includes('nifty') && !idx.toLowerCase().includes('bank') && !idx.toLowerCase().includes('fin')) return 1755;
    if (idx.toLowerCase().includes('banknifty') || idx.toLowerCase().includes('nifty bank')) return 1000;
    return 1800;
  };

  // Capital Qty calculations
  const getCalculatedQty = useCallback((itemKey: string, transactionType: string, ltp: number) => {
    const lotSize = selectedItems[itemKey]?.lot_size || getLotSize(index);

    if (!useCapitalEngine || transactionType !== 'BUY') {
      // Fallback to manual lots selector
      return Math.max(1, lots) * lotSize;
    }

    // Filter checked BUY items
    const buyKeys = Object.keys(selectedItems).filter(k => k.endsWith('_BUY'));
    const count = buyKeys.length > 0 ? buyKeys.length : 1;

    const allocatedCapital = capital / count;
    if (ltp <= 0) return lotSize;

    const maxQty = Math.floor(allocatedCapital / ltp);
    const calculatedLots = Math.floor(maxQty / lotSize);

    return Math.max(1, calculatedLots) * lotSize; // Min 1 lot
  }, [selectedItems, capital, useCapitalEngine, lots, index]);

  // Selected Option Items Toggle checkbox
  const toggleSelection = (item: any, side: string, type: 'BUY' | 'SELL') => {
    if (!item) return;
    const key = `${item.instrument_key}_${type}`;

    setSelectedItems(prev => {
      const next = { ...prev };
      if (next[key]) {
        delete next[key];
      } else {
        const lotSize = item.lot_size || getLotSize(index);
        next[key] = {
          ...item,
          transaction_type: type,
          lot_size: lotSize,
          limit_price: item.last_price?.toString() || ""
        };
      }
      return next;
    });
  };

  // Speed Deck Quick Action placement
  const handleQuickBuy = async (item: any) => {
    if (!item) return;
    if (isRiskHalted) {
      alert("Halted! Order blocked due to risk controls breach.");
      return;
    }
    const lotSize = item.lot_size || getLotSize(index);
    const calculatedQty = getCalculatedQty(`${item.instrument_key}_BUY`, 'BUY', item.last_price);

    const order = {
      instrument_key: item.instrument_key,
      transaction_type: "BUY",
      order_type: "MARKET",
      price: 0,
      trading_symbol: item.name || item.trading_symbol,
      quantity: calculatedQty
    };

    try {
      if (isPaper) {
        await placeMockOrders([order]);
      } else {
        await placeOrders([order]);
      }
      fetchPositions();
    } catch (err) {
      console.error(err);
    }
  };

  // Main order placing handler
  const handlePlaceOrder = async () => {
    if (isRiskHalted) {
      alert("Trading is HALTED due to risk limit breach.");
      return;
    }
    const freezeLimit = getFreezeLimit(index);
    const orders: any[] = [];

    Object.entries(selectedItems).forEach(([key, item]: [string, any]) => {
      const calculatedQty = getCalculatedQty(key, item.transaction_type, item.last_price || 0);
      const isLimit = !!item.limit_price && parseFloat(item.limit_price) > 0;
      const commonOrder = {
        instrument_key: item.instrument_key,
        transaction_type: item.transaction_type,
        order_type: isLimit ? 'LIMIT' : 'MARKET',
        price: isLimit ? parseFloat(item.limit_price) : 0,
        trading_symbol: item.name
      };

      if (calculatedQty > freezeLimit) {
        let remaining = calculatedQty;
        while (remaining > 0) {
          const chunk = Math.min(remaining, freezeLimit);
          orders.push({ ...commonOrder, quantity: chunk });
          remaining -= chunk;
        }
      } else {
        orders.push({ ...commonOrder, quantity: calculatedQty });
      }
    });

    if (orders.length === 0) return;

    try {
      if (isPaper) {
        await placeMockOrders(orders);
        setSelectedItems({});
        fetchPositions();
      } else {
        const response = await placeOrders(orders);
        const results = response.data?.results || [];
        const errors = results.filter((r: any) => r.result?.status === 'error');

        if (errors.length > 0) {
          const msg = errors.map((e: any) => `${e.key}: ${e.result?.message}`).join('\n');
          alert(`Some orders failed:\n${msg}`);
        } else {
          setSelectedItems({});
          fetchPositions();
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Reversal Position Handler (Scalper Flip)
  const handleReversePosition = async (pos: any) => {
    if (pos.quantity === 0) return;
    if (isRiskHalted) {
      alert("Halted! Reversal blocked.");
      return;
    }

    try {
      // 1. Exit current position
      await handleExit(isPaper ? pos.trade_id : (pos.instrument_key || pos.instrument_token));

      // 2. Find opposite CE/PE key for the same strike
      let oppositeKey = "";
      let oppositeName = "";

      const currentIsCe = pos.trading_symbol?.includes("CE");
      const strikeExtract = pos.trading_symbol?.match(/\s(\d+(?:\.\d+)?)\s(?:CE|PE)/);
      const strikePrice = strikeExtract ? parseFloat(strikeExtract[1]) : 0;

      if (strikePrice > 0) {
        const targetRow = chain.find(c => c.strike === strikePrice);
        if (targetRow) {
          const oppositeItem = currentIsCe ? targetRow.pe : targetRow.ce;
          if (oppositeItem) {
            oppositeKey = oppositeItem.instrument_key;
            oppositeName = oppositeItem.name || oppositeItem.trading_symbol;
          }
        }
      }

      if (!oppositeKey) {
        alert("Could not locate opposite option contract in the active strike chain.");
        return;
      }

      // 3. Place opposite trade
      const reversePayload = {
        instrument_key: oppositeKey,
        transaction_type: pos.quantity > 0 ? "BUY" : "BUY", // Reversing long CE is buying PE, which is also a BUY transaction!
        order_type: "MARKET",
        price: 0,
        trading_symbol: oppositeName,
        quantity: Math.abs(pos.quantity)
      };

      if (isPaper) {
        await placeMockOrder(reversePayload);
      } else {
        await placeOrders([reversePayload]);
      }
      fetchPositions();
    } catch (err) {
      console.error("Reversal Error:", err);
    }
  };

  // Slippage-guarded exit order handler using Limit offset
  const handleExit = async (key: string) => {
    try {
      const pos = positions.find(p => p.trade_id === key || p.instrument_key === key || p.instrument_token === key);

      if (pos && pos.quantity !== 0) {
        // Send Reinforcement Learning feedback on exit
        if (enableAgentic) {
          const reward = pos.pnl || 0;
          const symbol = pos.trading_symbol || "";
          const action = pos.quantity > 0 ? "LONG_BUY" : "SHORT_SELL";
          submitRlFeedback(symbol, action, reward, `Exited position via manual close or auto-exit rule. Final P&L: ₹${reward}`);
        }

        const txType = pos.quantity > 0 ? "SELL" : "BUY";
        const ltp = pos.last_price || pos.average_price || 0;

        if (ltp > 0) {
          const offsetMultiplier = pos.quantity > 0 ? (1 - exitOffsetPct / 100) : (1 + exitOffsetPct / 100);
          const limitPriceVal = roundToTick(ltp * offsetMultiplier);

          if (isPaper) {
            await exitMockPosition(pos.trade_id || key);
            console.log(`[Paper Close] Closed mock position ${pos.trading_symbol} simulating limit price at ₹${limitPriceVal} (LTP: ₹${ltp})`);
          } else {
            const closeOrder = {
              instrument_key: pos.instrument_key || pos.instrument_token,
              quantity: Math.abs(pos.quantity),
              transaction_type: txType,
              order_type: "LIMIT",
              price: limitPriceVal,
              product: pos.product || "MIS",
              trading_symbol: pos.trading_symbol
            };
            await placeOrders([closeOrder]);
            console.log(`[Live Close] Placed LIMIT exit order for ${pos.trading_symbol} at ₹${limitPriceVal} (LTP: ₹${ltp})`);
          }
        } else {
          // Fallback if no LTP loaded
          if (isPaper) {
            await exitMockPosition(pos.trade_id || key);
          } else {
            await exitPosition(pos.instrument_key || key);
          }
        }
      } else {
        // Fallback
        if (isPaper) {
          await exitMockPosition(key);
        } else {
          await exitPosition(key);
        }
      }

      // Remove rule associated with exited position
      setPositionRules(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      fetchPositions();
    } catch (e) {
      console.error("Exit failed:", e);
    }
  };

  // Cancel all pending orders
  const handleCancelAllOrders = async () => {
    try {
      await cancelAllOrders();
      alert("All pending orders cancelled successfully.");
    } catch (e: any) {
      console.error("Cancel all orders failed:", e);
      alert("Failed to cancel orders: " + (e?.message || e?.toString()));
    }
  };

  // Exit only live positions using slippage limit orders
  const handleExitAllLiveOnly = async () => {
    try {
      await cancelAllOrders();
      let livePositions = [];
      try {
        livePositions = await getPositions();
      } catch (e) {
        console.error(e);
      }

      const liveExitOrders: any[] = [];
      livePositions.forEach((pos: any) => {
        if (pos.quantity === 0) return;
        const txType = pos.quantity > 0 ? "SELL" : "BUY";
        const ltp = pos.last_price || pos.average_price || 0;

        if (ltp > 0) {
          const offsetMultiplier = pos.quantity > 0 ? (1 - exitOffsetPct / 100) : (1 + exitOffsetPct / 100);
          const limitPriceVal = roundToTick(ltp * offsetMultiplier);
          liveExitOrders.push({
            instrument_key: pos.instrument_key || pos.instrument_token,
            quantity: Math.abs(pos.quantity),
            transaction_type: txType,
            order_type: "LIMIT",
            price: limitPriceVal,
            product: pos.product || "MIS",
            trading_symbol: pos.trading_symbol
          });
        } else {
          liveExitOrders.push({
            instrument_key: pos.instrument_key || pos.instrument_token,
            quantity: Math.abs(pos.quantity),
            transaction_type: txType,
            order_type: "MARKET",
            price: 0,
            product: pos.product || "MIS",
            trading_symbol: pos.trading_symbol
          });
        }
      });

      if (liveExitOrders.length > 0) {
        await placeOrders(liveExitOrders);
      }

      // Clean position rules for live contracts
      setPositionRules(prev => {
        const next = { ...prev };
        livePositions.forEach((pos: any) => {
          delete next[pos.instrument_key];
        });
        return next;
      });

      fetchPositions();
      alert(`LIVE LIQUIDATION: Cancelled live orders and exited all open live positions with a ${exitOffsetPct}% limit offset!`);
    } catch (err) {
      console.error(err);
    }
  };

  // Exit only mock positions
  const handleExitAllMockOnly = async () => {
    try {
      let mockPositions = [];
      try {
        const mockPositionsData = await import("@/services/api").then(m => m.getMockPositions());
        mockPositions = mockPositionsData || [];
      } catch (e) {
        console.error(e);
      }

      const openMocks = mockPositions.filter((pos: any) => pos.quantity !== 0);
      for (const pos of openMocks) {
        await exitMockPosition(pos.trade_id);
      }

      // Clean position rules for mock contracts
      setPositionRules(prev => {
        const next = { ...prev };
        openMocks.forEach((pos: any) => {
          delete next[pos.instrument_key];
        });
        return next;
      });

      fetchPositions();
      alert("MOCK LIQUIDATION: Exited all open mock positions successfully!");
    } catch (err) {
      console.error(err);
    }
  };

  // Panic Exit All (Both Live & Mock Positions Simultaneously)
  const handlePanicExit = async () => {
    try {
      // 1. Cancel live orders
      await cancelAllOrders();

      // 2. Fetch positions for both live and mock
      let livePositions = [];
      try {
        livePositions = await getPositions();
      } catch (e) { }

      let mockPositions = [];
      try {
        const mockPositionsData = await import("@/services/api").then(m => m.getMockPositions());
        mockPositions = mockPositionsData || [];
      } catch (e) { }

      // 3. Build live exit limit orders with slippage offset
      const liveExitOrders: any[] = [];
      livePositions.forEach((pos: any) => {
        if (pos.quantity === 0) return;
        const txType = pos.quantity > 0 ? "SELL" : "BUY";
        const ltp = pos.last_price || pos.average_price || 0;

        if (ltp > 0) {
          const offsetMultiplier = pos.quantity > 0 ? (1 - exitOffsetPct / 100) : (1 + exitOffsetPct / 100);
          const limitPriceVal = roundToTick(ltp * offsetMultiplier);
          liveExitOrders.push({
            instrument_key: pos.instrument_key || pos.instrument_token,
            quantity: Math.abs(pos.quantity),
            transaction_type: txType,
            order_type: "LIMIT",
            price: limitPriceVal,
            product: pos.product || "MIS",
            trading_symbol: pos.trading_symbol
          });
        } else {
          liveExitOrders.push({
            instrument_key: pos.instrument_key || pos.instrument_token,
            quantity: Math.abs(pos.quantity),
            transaction_type: txType,
            order_type: "MARKET",
            price: 0,
            product: pos.product || "MIS",
            trading_symbol: pos.trading_symbol
          });
        }
      });

      // 4. Place live exit orders
      if (liveExitOrders.length > 0) {
        await placeOrders(liveExitOrders);
      }

      // 5. Place mock exit orders
      const openMocks = mockPositions.filter((pos: any) => pos.quantity !== 0);
      for (const pos of openMocks) {
        await exitMockPosition(pos.trade_id);
      }

      // 6. Clear rules & refresh positions
      setPositionRules({});
      fetchPositions();
      alert(`PANIC ACTION COMPLETED: Cancelled live orders, and closed all open Live and Mock positions with ${exitOffsetPct}% limit slippage guard!`);
    } catch (err) {
      console.error("Panic Exit All failed:", err);
    }
  };

  // Polling logic for Spot Price and Trigger checks
  const fetchSpot = useCallback(async () => {
    try {
      const q = await getQuotes([index]);
      if (!q) return;

      const val = q[index];
      if (val) {
        if (val.ltp) setSpotLtp(val.ltp);
        if (val.change !== undefined) setSpotChange(val.change);
        if (val.change_percent !== undefined) setSpotPchange(val.change_percent);
      }
    } catch (e) {
      console.error("Spot Fetch Error", e);
    }
  }, [index]);

  useEffect(() => {
    fetchSpot();
  }, [fetchSpot]);

  useEffect(() => {
    if (!isSpotPolling) return;
    const interval = setInterval(fetchSpot, Math.max(1000, monitorInterval * 1000));
    return () => clearInterval(interval);
  }, [monitorInterval, isSpotPolling, fetchSpot]);

  // Positions auto-refresh
  useEffect(() => {
    let interval: any;
    if (autoRefreshPositions) {
      interval = setInterval(() => {
        if (fetchPositionsRef.current) {
          fetchPositionsRef.current(true);
        }
      }, Math.max(1000, posRefreshInterval * 1000));
    }
    return () => clearInterval(interval);
  }, [autoRefreshPositions, posRefreshInterval, isPaper]);

  // Agent Logs Loop
  useEffect(() => {
    if (!enableAgentic) return;
    let interval: any;
    const fetchLogs = async () => {
      try {
        const logs = await getAgentLogs();
        setAgentLogs(logs);
      } catch (e) { }
    };
    fetchLogs();
    interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [enableAgentic]);

  // Copilot Analysis Loop
  useEffect(() => {
    if (!enableAgentic || chain.length === 0) return;
    let interval: any;

    const runAnalysis = async () => {
      setCopilotLoading(true);
      try {
        const indexLabel = INDICES.find(i => i.value === index)?.label || "Index";
        const totalPnLVal = positions.reduce((acc, p) => acc + (p.pnl || 0), 0);
        const contextData = `Spot: ${spotLtp}, PCR: ${stats.pcr.toFixed(2)}, Call-OI: ${totals.ce}, Put-OI: ${totals.pe}, PnL: ${totalPnLVal.toFixed(1)}, PaperMode: ${isPaper}`;

        const res = await analyzeTrade(indexLabel, "SCALPING_CHECK", contextData);
        if (res && res.status === "success") {
          setCopilotAnalysis(res);

          // Auto-Pilot Execution Logic!
          if (enableAutoPilot && res.approved_by_critic && res.final_decision) {
            const decision = res.final_decision.toUpperCase();
            if (decision.includes("BUY") || decision.includes("LONG")) {
              const atmRow = speedStrikes.atm;
              if (atmRow) {
                const currentIsCe = decision.includes("CE") || decision.includes("CALL");
                const contractToBuy = currentIsCe ? atmRow.ce : atmRow.pe;
                if (contractToBuy) {
                  console.log(`[Auto-Pilot Triggered] Buying ATM Option: ${contractToBuy.trading_symbol}`);
                  await handleQuickBuy(contractToBuy);
                }
              }
            }
          }
        }
      } catch (e) {
        console.error("Copilot Analysis Error:", e);
      } finally {
        setCopilotLoading(false);
      }
    };

    runAnalysis();
    interval = setInterval(runAnalysis, 20000); // Analyze every 20 seconds
    return () => clearInterval(interval);
  }, [chain, spotLtp, stats, totals, index, positions, isPaper, enableAutoPilot, speedStrikes, enableAgentic]);

  // overall profit/loss protection and individual triggers loop
  useEffect(() => {
    if (positions.length === 0 || isRiskHalted) return;

    // A. Check overall Daily P&L triggers
    if (enableShield) {
      const totalPnL = positions.reduce((acc, p) => acc + (p.pnl || 0), 0);

      if (maxSessionLoss > 0 && totalPnL <= -maxSessionLoss) {
        setIsRiskHalted(true);
        setHaltReason(`Max Session Loss limit of ₹${maxSessionLoss} breached. (Current: ₹${totalPnL.toFixed(1)})`);
        handlePanicExit();
        return;
      }

      if (maxSessionProfit > 0 && totalPnL >= maxSessionProfit) {
        setIsRiskHalted(true);
        setHaltReason(`Max Session Profit target of ₹${maxSessionProfit} reached. (Current: ₹${totalPnL.toFixed(1)})`);
        handlePanicExit();
        return;
      }
    }

    // B. Check position-level Target & SL triggers
    positions.forEach(async (p) => {
      if (p.quantity === 0) return;

      const posKey = isPaper ? p.trade_id : (p.instrument_key || p.instrument_token);
      if (!posKey) return;

      // If user is editing rules for this position (unsaved changes in tempRules), bypass trigger checks to prevent premature exits
      if (tempRules[posKey] && Object.keys(tempRules[posKey]).length > 0) {
        return;
      }

      const rules = positionRules[posKey];
      if (!rules) return;

      // 0. Update trailing stop loss if enabled
      if (rules.trailingSlPct && rules.trailingSlPct > 0) {
        if (p.quantity > 0) {
          const currentHighest = rules.highestPrice || p.average_price || 0;
          if (p.last_price > currentHighest) {
            rules.highestPrice = p.last_price;
            rules.slLtp = p.last_price * (1 - rules.trailingSlPct / 100);
            setPositionRules(prev => ({
              ...prev,
              [posKey]: {
                ...prev[posKey],
                highestPrice: p.last_price,
                slLtp: p.last_price * (1 - (rules.trailingSlPct || 0) / 100)
              }
            }));
          }
        } else {
          const currentLowest = rules.lowestPrice || p.average_price || 0;
          if (p.last_price > 0 && p.last_price < currentLowest) {
            rules.lowestPrice = p.last_price;
            rules.slLtp = p.last_price * (1 + rules.trailingSlPct / 100);
            setPositionRules(prev => ({
              ...prev,
              [posKey]: {
                ...prev[posKey],
                lowestPrice: p.last_price,
                slLtp: p.last_price * (1 + (rules.trailingSlPct || 0) / 100)
              }
            }));
          }
        }
      }

      let triggerHit = false;
      let hitMsg = "";

      // 1. Check Option Price SL/Target
      if (p.quantity > 0) { // Long option position
        if (rules.slLtp && p.last_price <= rules.slLtp) {
          triggerHit = true;
          hitMsg = `${p.trading_symbol} Stop Loss LTP Hit (Target: ₹${rules.slLtp.toFixed(2)}, LTP: ₹${p.last_price})`;
        } else if (rules.targetLtp && p.last_price >= rules.targetLtp) {
          triggerHit = true;
          hitMsg = `${p.trading_symbol} Target LTP Hit (Target: ₹${rules.targetLtp.toFixed(2)}, LTP: ₹${p.last_price})`;
        }
      } else { // Short option position
        if (rules.slLtp && p.last_price >= rules.slLtp) {
          triggerHit = true;
          hitMsg = `${p.trading_symbol} Stop Loss LTP Hit (Target: ₹${rules.slLtp.toFixed(2)}, LTP: ₹${p.last_price})`;
        } else if (rules.targetLtp && p.last_price <= rules.targetLtp) {
          triggerHit = true;
          hitMsg = `${p.trading_symbol} Target LTP Hit (Target: ₹${rules.targetLtp.toFixed(2)}, LTP: ₹${p.last_price})`;
        }
      }

      // 2. Check Index Spot Target/SL
      if (!triggerHit && spotLtp > 0 && rules.entrySpot) {
        const isCe = rules.type === "CE";

        if (p.quantity > 0) { // Long
          if (isCe) {
            if (rules.slSpot && spotLtp <= rules.slSpot) {
              triggerHit = true;
              hitMsg = `${p.trading_symbol} Spot SL Hit (Spot SL: ${rules.slSpot}, Spot: ${spotLtp})`;
            } else if (rules.targetSpot && spotLtp >= rules.targetSpot) {
              triggerHit = true;
              hitMsg = `${p.trading_symbol} Spot Target Hit (Spot Target: ${rules.targetSpot}, Spot: ${spotLtp})`;
            }
          } else { // PE Long
            if (rules.slSpot && spotLtp >= rules.slSpot) {
              triggerHit = true;
              hitMsg = `${p.trading_symbol} Spot SL Hit (Spot SL: ${rules.slSpot}, Spot: ${spotLtp})`;
            } else if (rules.targetSpot && spotLtp <= rules.targetSpot) {
              triggerHit = true;
              hitMsg = `${p.trading_symbol} Spot Target Hit (Spot Target: ${rules.targetSpot}, Spot: ${spotLtp})`;
            }
          }
        } else { // Short
          if (isCe) {
            if (rules.slSpot && spotLtp >= rules.slSpot) {
              triggerHit = true;
              hitMsg = `${p.trading_symbol} Spot SL Hit (Spot SL: ${rules.slSpot}, Spot: ${spotLtp})`;
            } else if (rules.targetSpot && spotLtp <= rules.targetSpot) {
              triggerHit = true;
              hitMsg = `${p.trading_symbol} Spot Target Hit (Spot Target: ${rules.targetSpot}, Spot: ${spotLtp})`;
            }
          } else { // PE Short
            if (rules.slSpot && spotLtp <= rules.slSpot) {
              triggerHit = true;
              hitMsg = `${p.trading_symbol} Spot SL Hit (Spot SL: ${rules.slSpot}, Spot: ${spotLtp})`;
            } else if (rules.targetSpot && spotLtp >= rules.targetSpot) {
              triggerHit = true;
              hitMsg = `${p.trading_symbol} Spot Target Hit (Spot Target: ${rules.targetSpot}, Spot: ${spotLtp})`;
            }
          }
        }
      }

      if (triggerHit) {
        console.log(`Auto Exit Triggered: ${hitMsg}`);
        await handleExit(isPaper ? p.trade_id : (p.instrument_key || p.instrument_token));
      }
    });

  }, [positions, spotLtp, positionRules, maxSessionLoss, maxSessionProfit, isRiskHalted, enableShield, enableAutoExits]);

  // Exit Limit Code
  const handleLimitExitCode = async () => {
    if (!limitExitPosition || !limitPrice) return;
    try {
      const priceVal = parseFloat(limitPrice);
      if (isNaN(priceVal) || priceVal <= 0) return;

      const txType = limitExitPosition.quantity > 0 ? "SELL" : "BUY";
      const order = {
        instrument_key: isPaper ? limitExitPosition.trade_id : (limitExitPosition.instrument_key || limitExitPosition.instrument_token),
        quantity: Math.abs(limitExitPosition.quantity),
        transaction_type: txType,
        order_type: "LIMIT",
        price: priceVal,
        product: "MIS",
        trading_symbol: limitExitPosition.trading_symbol
      };

      if (isPaper) {
        alert("Limit Exits are only supported in LIVE mode.");
        return;
      }

      const res = await placeOrders([order]);
      if (res.data && res.data.status === 'completed') {
        setLimitExitOpen(false);
        setLimitPrice("");
        setLimitExitPosition(null);
        fetchPositions();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const openLimitExit = (p: any) => {
    setLimitExitPosition(p);
    setLimitPrice(p.last_price?.toString() || "");
    setLimitExitOpen(true);
  };

  const formatOI = (val: number | undefined | null) => {
    if (val === undefined || val === null) return '-';
    return val.toLocaleString('en-IN');
  };

  const formatCr = (val: number) => {
    if (!val) return '-';
    return (val / 10000000).toFixed(2) + ' Cr';
  };

  const totalPnL = positions.reduce((acc, p) => acc + (p.pnl || 0), 0);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#1a202c] -m-4 p-0">
      <div className="p-4 max-w-7xl mx-auto space-y-4 pb-20">

        {/* Title block */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-200 dark:border-[#364f6b] pb-4 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
              <Zap className="w-8 h-8 text-indigo-500 animate-pulse" />
              Upstox Speed Option Trader
            </h1>
            <p className="text-sm text-gray-500 mt-1">High-speed scalping deck with capital allocation engines, automated price barriers, and hotkey liquidations.</p>
          </div>
          <div className="flex gap-4 items-center flex-wrap">
            <FormControlLabel
              control={<Switch checked={enableAutoPilot} disabled={!enableAgentic} onChange={(e) => setEnableAutoPilot(e.target.checked)} color="secondary" />}
              label={
                <span className={clsx("text-sm font-bold flex items-center gap-1", !enableAgentic ? "text-gray-400 dark:text-slate-500" : "dark:text-slate-200")}>
                  <Brain className="w-4 h-4 text-purple-500" /> Auto-Pilot {enableAutoPilot ? "(ON)" : "(OFF)"}
                </span>
              }
            />
            <FormControlLabel
              control={<Switch checked={enableHotkeys} onChange={(e) => setEnableHotkeys(e.target.checked)} color="primary" />}
              label={
                <span className="text-sm font-bold dark:text-slate-200 flex items-center gap-1">
                  <Keyboard className="w-4 h-4" /> Keyboard Hotkeys {enableHotkeys ? "(ON)" : "(OFF)"}
                </span>
              }
            />
          </div>
        </div>



        {/* Risk Halt Notification */}
        {isRiskHalted && (
          <div className="p-4 bg-red-500 text-white rounded-3xl flex items-center justify-between shadow-lg shadow-red-500/20 animate-pulse">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-6 h-6 shrink-0" />
              <div>
                <div className="font-extrabold text-sm uppercase">Trading Halted by Risk Engine</div>
                <div className="text-sm opacity-90">{haltReason}</div>
              </div>
            </div>
            <button
              onClick={() => {
                setIsRiskHalted(false);
                setHaltReason("");
              }}
              className="py-1 px-3 bg-white text-red-600 hover:bg-gray-100 rounded-xl text-sm font-bold transition-colors"
            >
              Reset Guard
            </button>
          </div>
        )}

        {/* Control Bar */}
        <Paper className="p-4 grid grid-cols-1 md:grid-cols-12 gap-4 items-center shadow-sm bg-white dark:bg-[#1e2433] dark:border-[#4a6fa5]">
          <FormControl size="small" className="md:col-span-2" fullWidth>
            <InputLabel className="dark:text-slate-400">Index</InputLabel>
            <Select value={index} label="Index" onChange={(e) => setIndex(e.target.value)} className="dark:text-white">
              {INDICES.map(idx => <MenuItem key={idx.value} value={idx.value}>{idx.label}</MenuItem>)}
            </Select>
          </FormControl>

          <FormControl size="small" className="md:col-span-2" fullWidth>
            <InputLabel className="dark:text-slate-400">Expiry</InputLabel>
            <Select value={expiry} label="Expiry" onChange={(e) => setExpiry(e.target.value)} className="dark:text-white">
              {expiryDates.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
            </Select>
          </FormControl>

          <div className="flex items-center space-x-2 md:col-span-3">
            <Button variant="contained" size="small" onClick={() => fetchChain()} disabled={loading} startIcon={<RefreshCw className={loading ? "animate-spin" : ""} />}>
              Fetch
            </Button>
            <FormControlLabel
              control={<Switch size="small" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />}
              label={<span className="text-sm dark:text-slate-200">Auto</span>}
            />
            {autoRefresh && (
              <TextField
                size="small"
                type="number"
                label="Sec"
                value={chainRefreshInterval}
                onChange={(e) => setChainRefreshInterval(Math.max(1, parseInt(e.target.value) || 1))}
                InputProps={{ inputProps: { min: 1, style: { width: '40px' } } }}
                className="dark:bg-[#252d3d] rounded"
                variant="outlined"
              />
            )}
          </div>

          <div className="md:col-span-5 flex justify-end gap-1.5 items-center flex-wrap">
            <FormControlLabel
              control={<Switch size="small" color="secondary" checked={isPaper} onChange={e => setIsPaper(e.target.checked)} />}
              label={<span className={clsx("text-sm font-black tracking-widest mr-2", isPaper ? "text-purple-500 animate-pulse" : "text-gray-500")}>PAPER</span>}
            />
            <Tooltip title="Guarded emergency liquidation of ALL open Live & Mock positions and cancel all live pending orders">
              <Button size="small" startIcon={<ShieldAlert />} color="error" variant="contained" onClick={handlePanicExit} className="font-extrabold text-sm bg-red-600 hover:bg-red-700">
                PANIC ALL
              </Button>
            </Tooltip>

            <Tooltip title="Cancel pending orders and close all Live positions using limit offset">
              <Button size="small" startIcon={<Ban />} color="warning" variant="outlined" onClick={handleExitAllLiveOnly} className="font-bold text-sm">
                Exit Live
              </Button>
            </Tooltip>

            <Tooltip title="Close all open Mock positions">
              <Button size="small" startIcon={<Ban />} color="secondary" variant="outlined" onClick={handleExitAllMockOnly} className="font-bold text-sm">
                Exit Mock
              </Button>
            </Tooltip>

            <Tooltip title="Cancel all open pending orders on the broker">
              <Button size="small" startIcon={<Ban />} color="error" variant="outlined" onClick={handleCancelAllOrders} className="font-bold text-sm">
                Cancel Orders
              </Button>
            </Tooltip>
          </div>
        </Paper>

        {/* Capital & Session Risk Dashboard */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

          {/* Memory Capital Allocation Block */}
          <div className="bg-white dark:bg-amber-950/40 border-2 border-amber-100 dark:border-amber-700/50 rounded-3xl p-5 space-y-4 col-span-1">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <span className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-orange-500" /> Capital Allocator
              </span>
              <div className="flex items-center gap-3">
                {hasUnsavedCapital && (
                  <div className="flex gap-1.5">
                    <Button size="small" variant="contained" color="success" onClick={handleSaveCapital} className="font-extrabold text-xs">
                      Save
                    </Button>
                    <Button size="small" variant="outlined" color="error" onClick={handleResetCapital} className="font-bold text-xs">
                      Reset
                    </Button>
                  </div>
                )}
                <FormControlLabel
                  control={<Switch size="small" checked={useCapitalEngine} onChange={(e) => setUseCapitalEngine(e.target.checked)} />}
                  label={<span className="text-sm font-bold">Auto</span>}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-500 font-bold mb-1">TOTAL SCALPING CAPITAL (₹)</label>
                <input
                  type="number"
                  disabled={!useCapitalEngine}
                  value={tempCapital}
                  onChange={(e) => setTempCapital(e.target.value)}
                  onBlur={() => {
                    const parsed = parseFloat(tempCapital);
                    if (!isNaN(parsed) && parsed < 1000 && parsed !== 0) {
                      setTempCapital("1000");
                    }
                  }}
                  className="w-full px-3 py-1.5 bg-gray-50 dark:bg-[#0f1419] border-2 border-gray-300 dark:border-[#4a6fa5] rounded-xl text-sm focus:outline-none dark:text-white font-mono font-bold"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-500 font-bold mb-1">SELECTED LEGS COUNT</label>
                <div className="w-full px-3 py-1.5 bg-gray-50 dark:bg-[#0f1419] border-2 border-gray-300 dark:border-[#4a6fa5] rounded-xl text-sm font-mono font-bold text-indigo-500">
                  {Object.keys(selectedItems).filter(k => k.endsWith('_BUY')).length} buy legs
                </div>
              </div>
            </div>
            {useCapitalEngine && (
              <div className="text-sm text-gray-400">
                Allocating <span className="font-bold text-gray-900 dark:text-white font-mono">₹{(capital / (Object.keys(selectedItems).filter(k => k.endsWith('_BUY')).length || 1)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span> per selected BUY contract.
              </div>
            )}
          </div>

          {/* Global Stop Loss and Target Presets */}
          <div className="bg-white dark:bg-indigo-950/40 border-2 border-indigo-100 dark:border-indigo-700/50 rounded-3xl p-5 space-y-4 col-span-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                <Crosshair className="w-4 h-4 text-indigo-500" /> Auto-Exits Presets (Met on order entry)
              </span>
              <div className="flex items-center gap-3">
                {hasUnsavedPresets && (
                  <div className="flex gap-1.5">
                    <Button size="small" variant="contained" color="success" onClick={handleSavePresets} className="font-extrabold text-xs">
                      Save Presets
                    </Button>
                    <Button size="small" variant="outlined" color="error" onClick={handleResetPresets} className="font-bold text-xs">
                      Reset
                    </Button>
                  </div>
                )}
                <FormControlLabel
                  control={<Switch size="small" checked={enableAutoExits} onChange={(e) => setEnableAutoExits(e.target.checked)} color="primary" />}
                  label={<span className="text-sm font-bold dark:text-slate-200">{enableAutoExits ? "ENABLED" : "DISABLED"}</span>}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm text-gray-500 font-bold mb-1">OPTION SL (%)</label>
                <input
                  type="number"
                  disabled={!enableAutoExits}
                  value={tempGlobalOptionSlPct}
                  onChange={(e) => setTempGlobalOptionSlPct(e.target.value)}
                  className="w-full px-3 py-1 bg-gray-50 dark:bg-[#0f1419] border-2 border-gray-300 dark:border-[#4a6fa5] rounded-lg text-sm font-mono dark:text-white disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-500 font-bold mb-1">OPTION TARGET (%)</label>
                <input
                  type="number"
                  disabled={!enableAutoExits}
                  value={tempGlobalOptionTargetPct}
                  onChange={(e) => setTempGlobalOptionTargetPct(e.target.value)}
                  className="w-full px-3 py-1 bg-gray-50 dark:bg-[#0f1419] border-2 border-gray-300 dark:border-[#4a6fa5] rounded-lg text-sm font-mono dark:text-white disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-500 font-bold mb-1">TRAILING SL (%)</label>
                <input
                  type="number"
                  disabled={!enableAutoExits}
                  value={tempGlobalTrailingSlPct}
                  onChange={(e) => setTempGlobalTrailingSlPct(e.target.value)}
                  className="w-full px-3 py-1 bg-gray-50 dark:bg-[#0f1419] border-2 border-gray-300 dark:border-[#4a6fa5] rounded-lg text-sm font-mono dark:text-white disabled:opacity-50"
                  placeholder="0 = Off"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-500 font-bold mb-1">SPOT INDEX SL (PTS)</label>
                <input
                  type="number"
                  disabled={!enableAutoExits}
                  value={tempGlobalIndexSlDiff}
                  onChange={(e) => setTempGlobalIndexSlDiff(e.target.value)}
                  className="w-full px-3 py-1 bg-gray-50 dark:bg-[#0f1419] border-2 border-gray-300 dark:border-[#4a6fa5] rounded-lg text-sm font-mono dark:text-white disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-500 font-bold mb-1">SPOT INDEX TARGET (PTS)</label>
                <input
                  type="number"
                  disabled={!enableAutoExits}
                  value={tempGlobalIndexTargetDiff}
                  onChange={(e) => setTempGlobalIndexTargetDiff(e.target.value)}
                  className="w-full px-3 py-1 bg-gray-50 dark:bg-[#0f1419] border-2 border-gray-300 dark:border-[#4a6fa5] rounded-lg text-sm font-mono dark:text-white disabled:opacity-50"
                />
              </div>
            </div>
          </div>

          {/* AI Trading Copilot Block */}
          <div className={clsx(
            "border-2 rounded-3xl p-5 space-y-4 col-span-1 flex flex-col justify-between transition-all duration-200",
            enableAgentic
              ? "bg-white dark:bg-purple-950/30 border-purple-100 dark:border-purple-800/40"
              : "bg-gray-100/50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-800/40 opacity-50"
          )}>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className={clsx(
                  "text-sm font-black uppercase tracking-widest flex items-center gap-1.5",
                  enableAgentic ? "text-purple-700 dark:text-purple-300" : "text-gray-400 dark:text-slate-500"
                )}>
                  <Brain className={clsx("w-4 h-4", enableAgentic ? "text-purple-500 animate-pulse" : "text-gray-400")} /> AI Copilot
                </span>
                {enableAgentic && copilotLoading && <RefreshCw className="w-4 h-4 animate-spin text-purple-500" />}
              </div>

              {!enableAgentic ? (
                <div className="text-xs text-gray-400 italic py-4 text-center">
                  Agentic AI is disabled. Turn it on in the header to start analysis.
                </div>
              ) : copilotAnalysis ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Proposed:</span>
                    <span className={clsx(
                      "font-extrabold px-1.5 py-0.5 rounded text-xs",
                      copilotAnalysis.proposed_decision?.includes("BUY") || copilotAnalysis.proposed_decision?.includes("LONG") ? "bg-green-500/10 text-green-600" :
                        copilotAnalysis.proposed_decision?.includes("SELL") || copilotAnalysis.proposed_decision?.includes("SHORT") ? "bg-red-500/10 text-red-600" : "bg-gray-500/10 text-gray-500"
                    )}>
                      {copilotAnalysis.proposed_decision || "HOLD"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Critic:</span>
                    <span className={clsx("font-bold text-xs", copilotAnalysis.approved_by_critic ? "text-green-500" : "text-red-500")}>
                      {copilotAnalysis.approved_by_critic ? "APPROVED" : "REJECTED"}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 dark:text-slate-400 max-h-[80px] overflow-y-auto italic">
                    "{copilotAnalysis.agent_analysis || "Evaluating option chain context..."}"
                  </div>
                </div>
              ) : (
                <div className="text-xs text-gray-450 dark:text-slate-400 italic py-4 text-center">
                  Waiting for next copilot tick...
                </div>
              )}
            </div>

            <div className="border-t border-purple-100 dark:border-purple-900/60 pt-2 space-y-1">
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Agent Log Monitor</span>
              <div className="bg-black/50 p-2 rounded-lg text-[9px] font-mono h-20 overflow-y-auto text-green-400 space-y-1 scrollbar-thin">
                {!enableAgentic ? (
                  <div className="text-gray-600 italic">Agent system offline...</div>
                ) : agentLogs.length === 0 ? (
                  <div className="text-gray-600 italic">Agent system inactive...</div>
                ) : (
                  agentLogs.slice(-15).map((log: any, i) => {
                    if (typeof log === 'object' && log !== null) {
                      const timeStr = log.timestamp && log.timestamp.includes('T')
                        ? log.timestamp.split('T')[1].split('.')[0]
                        : log.timestamp || '';
                      return (
                        <div key={i} className="leading-tight text-[8px] truncate">
                          <span className="text-gray-500 font-mono">[{timeStr}]</span>{' '}
                          <span className="text-purple-400 font-bold">{log.agent}</span>:{' '}
                          <span>{log.message}</span>
                        </div>
                      );
                    }
                    return <div key={i} className="leading-tight text-[8px]">{String(log)}</div>;
                  })
                )}
              </div>
            </div>
          </div>

        </div>

        {/* Account Session P&L Guard */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 bg-white dark:bg-rose-950/30 p-5 rounded-3xl border-2 border-rose-100 dark:border-rose-800/50 shadow-sm">
          <div className="flex flex-col justify-center">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
              <span className="text-sm font-black text-gray-400 uppercase tracking-widest">Account Protection Guard</span>
              {hasUnsavedShield && (
                <div className="flex gap-1.5">
                  <Button size="small" variant="contained" color="success" onClick={handleSaveShield} className="font-extrabold text-xs">
                    Save
                  </Button>
                  <Button size="small" variant="outlined" color="error" onClick={handleResetShield} className="font-bold text-xs">
                    Reset
                  </Button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <h3 className="text-sm font-extrabold text-gray-900 dark:text-white">Overall P&L Auto-Liquidation</h3>
              <FormControlLabel
                control={<Switch size="small" checked={enableShield} onChange={(e) => setEnableShield(e.target.checked)} color="primary" />}
                label=""
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-red-500 font-extrabold mb-1">MAX DAILY LOSS CAP (₹ AMOUNT)</label>
            <input
              type="number"
              disabled={!enableShield}
              value={tempMaxSessionLoss}
              onChange={(e) => setTempMaxSessionLoss(e.target.value)}
              className="w-full px-3 py-1.5 bg-red-500/5 dark:bg-red-500/10 border border-red-500/20 rounded-xl text-sm focus:outline-none dark:text-red-300 font-mono font-bold disabled:opacity-50"
              placeholder="0 = Disabled"
            />
          </div>
          <div>
            <label className="block text-sm text-green-500 font-extrabold mb-1">MAX DAILY PROFIT CAP (₹ AMOUNT)</label>
            <input
              type="number"
              disabled={!enableShield}
              value={tempMaxSessionProfit}
              onChange={(e) => setTempMaxSessionProfit(e.target.value)}
              className="w-full px-3 py-1.5 bg-green-500/5 dark:bg-green-500/10 border border-green-500/20 rounded-xl text-sm focus:outline-none dark:text-green-300 font-mono font-bold disabled:opacity-50"
              placeholder="0 = Disabled"
            />
          </div>
          <div>
            <label className="block text-sm text-indigo-500 font-extrabold mb-1">EXIT SLIPPAGE OFFSET (%)</label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              max="10"
              disabled={!enableShield}
              value={tempExitOffsetPct}
              onChange={(e) => setTempExitOffsetPct(e.target.value)}
              className="w-full px-3 py-1.5 bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-sm focus:outline-none dark:text-indigo-300 font-mono font-bold disabled:opacity-50"
            />
          </div>
          <div className="flex flex-col justify-center items-end">
            <span className="text-sm text-gray-400">Current Protection Status</span>
            <Chip
              label={isRiskHalted ? "HALTED" : ((enableShield && (maxSessionLoss > 0 || maxSessionProfit > 0)) ? "SHIELD ACTIVE" : "SHIELD INACTIVE")}
              color={isRiskHalted ? "error" : ((enableShield && (maxSessionLoss > 0 || maxSessionProfit > 0)) ? "success" : "default")}
              size="small"
              className="font-bold text-sm mt-1"
            />
          </div>
        </div>

        {/* Speed Deck - At the money & near strikes quick cards */}
        <div className="bg-emerald-50 dark:bg-emerald-950/20 border-2 border-emerald-200 dark:border-emerald-800/60 rounded-3xl p-5 space-y-3">
          <h3 className="text-sm font-black text-emerald-700 dark:text-emerald-300 uppercase tracking-widest flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-emerald-500 dark:text-emerald-400" /> Speed Scalping Deck (1-Click Placement)
          </h3>

          {chain.length === 0 ? (
            <div className="text-center text-sm text-emerald-500 dark:text-emerald-600 py-6 italic">Fetch option chain data to render Scalping Deck</div>
          ) : (() => {
            const strikes = [
              { key: 'itm2', data: speedStrikes.itm2, label: 'ITM-2', isAtm: false },
              { key: 'itm1', data: speedStrikes.itm1, label: 'ITM-1', isAtm: false },
              { key: 'atm', data: speedStrikes.atm, label: 'ATM', isAtm: true },
              { key: 'otm1', data: speedStrikes.otm1, label: 'OTM+1', isAtm: false },
              { key: 'otm2', data: speedStrikes.otm2, label: 'OTM+2', isAtm: false },
            ];
            return (
              <div className="space-y-2">
                {/* Strike headers row */}
                <div className="grid grid-cols-5 gap-2">
                  {strikes.map(({ key, data, label, isAtm }) => (
                    <div
                      key={key + '_header'}
                      className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-center ${isAtm
                        ? 'bg-emerald-600 dark:bg-emerald-700 border-2 border-emerald-400 dark:border-emerald-500 shadow-lg shadow-emerald-500/30'
                        : 'bg-white dark:bg-[#1e2433] border-2 border-emerald-200 dark:border-emerald-800/70'
                        }`}
                    >
                      <span className={`text-[9px] font-black uppercase tracking-widest ${isAtm ? 'text-emerald-100' : 'text-emerald-600 dark:text-emerald-400'}`}>{label}</span>
                      <span className={`font-black font-mono text-sm ${isAtm ? 'text-white' : 'text-gray-900 dark:text-emerald-100'}`}>
                        {data?.strike ?? '—'}
                      </span>
                    </div>
                  ))}
                </div>

                {/* CALL Row */}
                <div className="grid grid-cols-5 gap-2">
                  {strikes.map(({ key, data, label, isAtm }) => (
                    <div
                      key={key + '_ce'}
                      className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border ${isAtm
                          ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800/80'
                          : 'bg-white/60 dark:bg-[#1e2433]/60 border-emerald-200 dark:border-emerald-900'
                        }`}
                    >
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-wide">CALL</span>
                        <span className="font-bold font-mono text-sm text-emerald-700 dark:text-emerald-400">
                          {data?.ce ? `₹${data.ce.last_price}` : <span className="text-gray-300 dark:text-zinc-600">—</span>}
                        </span>
                      </div>
                      <button
                        disabled={!data?.ce}
                        onClick={() => data?.ce && handleQuickBuy(data.ce)}
                        className={`w-full py-1 rounded-md text-sm font-semibold transition-all active:scale-95 ${data?.ce
                            ? isAtm
                              ? 'bg-emerald-700/90 hover:bg-emerald-700 dark:bg-emerald-800/80 dark:hover:bg-emerald-700/90 text-emerald-50'
                              : 'bg-emerald-800/70 hover:bg-emerald-800/90 dark:bg-emerald-900/60 dark:hover:bg-emerald-800/70 text-emerald-100'
                            : 'bg-gray-100 dark:bg-[#1e2433] text-gray-300 dark:text-zinc-600 cursor-not-allowed'
                          }`}
                      >
                        BUY
                      </button>
                    </div>
                  ))}
                </div>

                {/* PUT Row */}
                <div className="grid grid-cols-5 gap-2">
                  {strikes.map(({ key, data, label, isAtm }) => (
                    <div
                      key={key + '_pe'}
                      className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border ${isAtm
                          ? 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800/80'
                          : 'bg-white/60 dark:bg-[#1e2433]/60 border-rose-200 dark:border-rose-900'
                        }`}
                    >
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] font-bold text-rose-600 dark:text-rose-500 uppercase tracking-wide">PUT</span>
                        <span className="font-bold font-mono text-sm text-rose-700 dark:text-rose-400">
                          {data?.pe ? `₹${data.pe.last_price}` : <span className="text-gray-300 dark:text-zinc-600">—</span>}
                        </span>
                      </div>
                      <button
                        disabled={!data?.pe}
                        onClick={() => data?.pe && handleQuickBuy(data.pe)}
                        className={`w-full py-1 rounded-md text-sm font-semibold transition-all active:scale-95 ${data?.pe
                            ? isAtm
                              ? 'bg-rose-700/90 hover:bg-rose-700 dark:bg-rose-800/80 dark:hover:bg-rose-700/90 text-rose-50'
                              : 'bg-rose-800/70 hover:bg-rose-800/90 dark:bg-rose-900/60 dark:hover:bg-rose-800/70 text-rose-100'
                            : 'bg-gray-100 dark:bg-[#1e2433] text-gray-300 dark:text-zinc-600 cursor-not-allowed'
                          }`}
                      >
                        BUY
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Spot Price details */}
        <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
          <Paper className="p-2 bg-gray-50 dark:bg-[#1e2433] dark:border-[#4a6fa5] flex flex-col justify-center items-center">
            <Typography variant="caption" color="textSecondary" className="dark:text-slate-400">Funds</Typography>
            <Typography variant="subtitle2" className="font-bold text-gray-800 dark:text-slate-200">
              ₹{(funds?.available_margin || funds?._available_margin || funds?.net || 0).toLocaleString()}
            </Typography>
          </Paper>

          <Paper className="p-2 bg-blue-50 border border-blue-100 dark:bg-blue-900/20 dark:border-blue-800 flex flex-col justify-center items-center">
            <Typography variant="caption" className="text-blue-800 dark:text-blue-300">PCR</Typography>
            <Typography variant="subtitle2" className="font-bold text-blue-700 dark:text-blue-200">
              {stats.pcr.toFixed(2)}
            </Typography>
          </Paper>

          <Paper className="p-2 bg-green-50 border border-green-100 dark:bg-green-900/20 dark:border-green-800 flex flex-col justify-center items-center">
            <Typography variant="caption" className="text-green-800 dark:text-green-300">Total Call OI</Typography>
            <Typography variant="subtitle2" className="font-bold text-green-700 dark:text-green-200">
              {totals.ce.toLocaleString('en-IN')}
            </Typography>
          </Paper>
          <Paper className="p-2 bg-red-50 border border-red-100 dark:bg-red-900/20 dark:border-red-800 flex flex-col justify-center items-center">
            <Typography variant="caption" className="text-red-800 dark:text-red-300">Total Put OI</Typography>
            <Typography variant="subtitle2" className="font-bold text-red-700 dark:text-red-200">
              {totals.pe.toLocaleString('en-IN')}
            </Typography>
          </Paper>

          <Paper className="p-2 bg-green-100 border border-green-200 dark:bg-green-800/40 dark:border-green-700 flex flex-col justify-center items-center">
            <Typography variant="caption" className="text-green-900 dark:text-green-100 font-bold">ITM Call OI (5)</Typography>
            <Typography variant="subtitle2" className="font-bold text-green-800 dark:text-green-50">
              {stats.itmCallOi.toLocaleString('en-IN')}
            </Typography>
          </Paper>
          <Paper className="p-2 bg-red-100 border border-red-200 dark:bg-red-800/40 dark:border-red-700 flex flex-col justify-center items-center">
            <Typography variant="caption" className="text-red-900 dark:text-red-100 font-bold">ITM Put OI (5)</Typography>
            <Typography variant="subtitle2" className="font-bold text-red-800 dark:text-red-50">
              {stats.itmPutOi.toLocaleString('en-IN')}
            </Typography>
          </Paper>

          <Paper
            className="p-2 bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 flex flex-col justify-center items-center"
          >
            <Typography variant="caption" className="text-amber-800 dark:text-amber-300 font-bold">Charges</Typography>
            <Tooltip title={charges?.total ? `Brokerage: ₹${charges.total.brokerage} | STT: ₹${charges.total.stt} | TX: ₹${charges.total.tx_charges} | GST: ₹${charges.total.gst} | ${charges.total.trade_count} trades` : 'Click View to load'}>
              <Typography variant="subtitle2" className="font-bold text-amber-700 dark:text-amber-200">
                ₹{(charges?.total?.grand_total || 0).toFixed(2)}
              </Typography>
            </Tooltip>
            <Button
              size="small"
              variant="text"
              onClick={() => { fetchCharges(); setShowTradeBook(true); }}
              style={{ fontSize: '0.65rem', minWidth: 'auto', padding: '0px 8px', marginTop: '2px', textTransform: 'none' }}
              className="text-amber-700 dark:text-amber-300"
            >
              View Details
            </Button>
          </Paper>
        </div>

        {/* Positions Grid & Rules Display */}
        <Paper className={clsx("p-4 border", isPaper ? "border-purple-200 bg-purple-50 dark:bg-purple-900/20 dark:border-purple-800" : "border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800")}>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-4">
              <Typography variant="subtitle1" fontWeight="bold" className={clsx("dark:text-slate-100", isPaper && "text-purple-700 dark:text-purple-300")}>
                {isPaper ? "Mock Positions" : "Open Positions"} ({positions.length})
              </Typography>
              <Typography variant="subtitle2" className={clsx("font-bold", totalPnL >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
                P&L: ₹{totalPnL.toFixed(2)}
              </Typography>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-white/50 dark:bg-[#1e2433]/50 px-2 py-1 rounded border dark:border-[#4a6fa5]">
                <Clock size={14} className="text-gray-500" />
                <input
                  type="number"
                  className="w-10 bg-transparent text-sm outline-none dark:text-slate-200"
                  value={posRefreshInterval}
                  min={1}
                  onChange={(e) => setPosRefreshInterval(parseInt(e.target.value) || 1)}
                />
              </div>
              <FormControlLabel
                control={<Switch size="small" checked={autoRefreshPositions} onChange={e => setAutoRefreshPositions(e.target.checked)} />}
                label={<span className="text-sm dark:text-slate-200">Auto</span>}
              />
              <Button size="small" onClick={() => fetchPositions()}>Refresh</Button>
            </div>
          </div>

          {/* Spot Polling status */}
          <div className="flex items-center gap-4 mb-3 border-b border-gray-200 dark:border-[#4a6fa5] pb-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-700 dark:text-slate-300">
                {INDICES.find(i => i.value === index)?.label || "Index"}:
              </span>
              <span className="font-extrabold text-xl text-blue-600 dark:text-blue-400">
                {spotLtp ? spotLtp.toFixed(2) : 'Loading...'}
              </span>
              {spotLtp > 0 && spotPchange !== undefined && (
                <span className={clsx("text-sm font-bold ml-1.5",
                  spotPchange > 0 ? "text-green-600 dark:text-green-400" :
                  spotPchange < 0 ? "text-red-600 dark:text-red-400" : "text-gray-500"
                )}>
                  {spotChange > 0 ? '+' : ''}{spotChange.toFixed(2)} ({spotPchange > 0 ? '+' : ''}{spotPchange.toFixed(2)}%)
                </span>
              )}
            </div>
            <TextField
              size="small"
              label="Spot Poll (s)"
              type="number"
              value={monitorInterval}
              onChange={(e) => setMonitorInterval(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-24 bg-white dark:bg-[#1e2433]"
              InputProps={{ className: "text-sm dark:text-white" }}
              inputProps={{ min: 1 }}
            />
            <FormControlLabel
              control={<Switch size="small" checked={isSpotPolling} onChange={e => setIsSpotPolling(e.target.checked)} />}
              label={<span className="text-sm dark:text-slate-300">Poll Spot</span>}
            />
          </div>

          {positions.length === 0 ? (
            <Typography variant="body2" className="text-gray-500 dark:text-slate-400 italic text-center py-4">No open positions</Typography>
          ) : (
            <div className="space-y-4">
              {positions
                .filter(p => showClosedPositions || p.quantity !== 0)
                .map((p: any, idx) => {
                  const posKey = isPaper ? p.trade_id : (p.instrument_key || p.instrument_token);
                  if (!posKey) return null;
                  const rules = positionRules[posKey] || {};
                  return (
                    <div key={posKey} className="bg-white dark:bg-[#0f1419] border-2 border-gray-300 dark:border-[#4a6fa5] rounded-2xl p-4 flex flex-col md:flex-row justify-between gap-4 text-sm">

                      {/* Position info */}
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm dark:text-white">{p.trading_symbol}</span>
                          <span className={clsx("font-bold px-1.5 py-0.2 rounded text-sm", p.quantity > 0 ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600")}>
                            {p.quantity > 0 ? "LONG" : "SHORT"}
                          </span>
                          <span className="font-mono text-gray-500">{Math.abs(p.quantity)} Qty</span>
                        </div>
                        <div className="flex gap-4 text-gray-500">
                          <span>Avg: ₹{p.average_price?.toFixed(2)}</span>
                          <span>LTP: ₹{p.last_price?.toFixed(2)}</span>
                          <span className={clsx("font-extrabold", p.pnl >= 0 ? "text-green-600" : "text-red-600")}>
                            P&L: ₹{p.pnl?.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Exits parameters triggers controls */}
                      <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-2 border-t md:border-t-0 md:border-l border-gray-100 dark:border-[#364f6b]/80 pt-3 md:pt-0 md:pl-4">
                        <div>
                          <label className="block text-[9px] text-gray-400 font-bold mb-0.5">SL PRICE (LTP)</label>
                          <input
                            type="number"
                            step="0.05"
                            value={getRuleVal(posKey, 'slLtp')}
                            placeholder="SL LTP Price"
                            onChange={(e) => handleTempRuleChange(posKey, 'slLtp', e.target.value)}
                            className="w-full px-2 py-1 bg-gray-50 dark:bg-[#1e2433] border border-gray-200 dark:border-[#4a6fa5] rounded-lg font-mono text-sm dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] text-gray-400 font-bold mb-0.5">TARGET PRICE (LTP)</label>
                          <input
                            type="number"
                            step="0.05"
                            value={getRuleVal(posKey, 'targetLtp')}
                            placeholder="Target LTP Price"
                            onChange={(e) => handleTempRuleChange(posKey, 'targetLtp', e.target.value)}
                            className="w-full px-2 py-1 bg-gray-50 dark:bg-[#1e2433] border border-gray-200 dark:border-[#4a6fa5] rounded-lg font-mono text-sm dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] text-gray-400 font-bold mb-0.5">TRAILING SL (%)</label>
                          <input
                            type="number"
                            value={getRuleVal(posKey, 'trailingSlPct')}
                            placeholder="Trailing SL %"
                            onChange={(e) => handleTempRuleChange(posKey, 'trailingSlPct', e.target.value)}
                            className="w-full px-2 py-1 bg-gray-50 dark:bg-[#1e2433] border border-gray-200 dark:border-[#4a6fa5] rounded-lg font-mono text-sm dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] text-gray-400 font-bold mb-0.5">INDEX SL (SPOT)</label>
                          <input
                            type="number"
                            value={getRuleVal(posKey, 'slSpot')}
                            placeholder="SL Index Spot"
                            onChange={(e) => handleTempRuleChange(posKey, 'slSpot', e.target.value)}
                            className="w-full px-2 py-1 bg-gray-50 dark:bg-[#1e2433] border border-gray-200 dark:border-[#4a6fa5] rounded-lg font-mono text-sm dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] text-gray-400 font-bold mb-0.5">INDEX TARGET (SPOT)</label>
                          <input
                            type="number"
                            value={getRuleVal(posKey, 'targetSpot')}
                            placeholder="Target Index Spot"
                            onChange={(e) => handleTempRuleChange(posKey, 'targetSpot', e.target.value)}
                            className="w-full px-2 py-1 bg-gray-50 dark:bg-[#1e2433] border border-gray-200 dark:border-[#4a6fa5] rounded-lg font-mono text-sm dark:text-white"
                          />
                        </div>
                      </div>

                      {/* Exits trigger action buttons */}
                      <div className="flex items-center gap-2 shrink-0 md:pl-4">
                        {hasUnsavedRules(posKey) && (
                          <>
                            <Button
                              size="small"
                              variant="contained"
                              color="success"
                              onClick={() => handleSaveRules(p)}
                              className="font-extrabold text-sm"
                            >
                              SAVE
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              onClick={() => handleCancelRules(posKey)}
                              className="font-bold text-sm"
                            >
                              RESET
                            </Button>
                          </>
                        )}
                        <Button
                          size="small"
                          variant="contained"
                          color="error"
                          onClick={() => handleExit(posKey)}
                          className="font-extrabold text-sm"
                        >
                          EXIT
                        </Button>
                        <Button
                          size="small"
                          variant="contained"
                          color="warning"
                          onClick={() => openLimitExit(p)}
                          className="font-extrabold text-sm"
                        >
                          LIMIT
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          color="secondary"
                          onClick={() => handleReversePosition(p)}
                          className="font-extrabold text-sm flex items-center gap-0.5"
                          title="Instant Scalping Reversal"
                          startIcon={<ArrowUpDown className="w-3 h-3" />}
                        >
                          REV
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          color="info"
                          onClick={() => {
                            setPositionRules(prev => ({
                              ...prev,
                              [posKey]: {
                                ...prev[posKey],
                                slLtp: p.average_price
                              }
                            }));
                            setTempRules(prev => {
                              if (prev[posKey]) {
                                return {
                                  ...prev,
                                  [posKey]: {
                                    ...prev[posKey],
                                    slLtp: p.average_price?.toString()
                                  }
                                };
                              }
                              return prev;
                            });
                            alert(`Set SL for ${p.trading_symbol} to entry price of ₹${p.average_price?.toFixed(2)}`);
                          }}
                          className="font-extrabold text-sm flex items-center gap-0.5"
                          title="Instant Break-Even (Set SL to Entry)"
                        >
                          BE
                        </Button>
                      </div>

                    </div>
                  )
                })}
            </div>
          )}
        </Paper>

        {/* Action execution bar */}
        <div className="sticky top-20 z-40 space-y-2">
          <Paper className={clsx("p-3 border flex justify-between items-center", isPaper ? "bg-purple-100 border-purple-300 dark:bg-purple-900 dark:border-purple-700" : "bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800")}>
            <div className="flex items-center gap-4">
              <Typography variant="subtitle1" fontWeight="bold" className="dark:text-slate-100">
                {Object.keys(selectedItems).length} Legs Selected {isPaper && "(Paper)"}
              </Typography>
              {!useCapitalEngine && (
                <div className="flex items-center gap-2">
                  <TextField
                    size="small"
                    label="Lots"
                    type="number"
                    value={lots}
                    onChange={(e) => setLots(parseInt(e.target.value) || 1)}
                    className="w-16 bg-white dark:bg-[#1e2433]"
                    inputProps={{ min: 1 }}
                  />
                  <div className="flex gap-1 flex-wrap">
                    {[1, 2, 5, 10, 20, 50].map(l => (
                      <Button
                        key={l}
                        size="small"
                        variant={lots === l ? "contained" : "outlined"}
                        onClick={() => setLots(l)}
                        style={{ minWidth: '32px', height: '32px', padding: '0 4px', fontSize: '0.75rem' }}
                        className="font-bold border-[#4a6fa5]"
                      >
                        {l}L
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <Button
              variant="contained"
              color={isPaper ? "secondary" : "warning"}
              startIcon={<Zap />}
              onClick={handlePlaceOrder}
              disabled={Object.keys(selectedItems).length === 0}
            >
              {isPaper ? "Paper Bulk Scalp" : "Execute Speed Scalp"}
            </Button>
          </Paper>

          {Object.keys(selectedItems).length > 0 && (
            <Paper className="p-3 bg-gray-50 dark:bg-[#0f1419] border-2 border-gray-300 dark:border-[#4a6fa5] text-sm rounded-xl space-y-1.5 max-h-[150px] overflow-y-auto">
              <div className="font-extrabold text-gray-500 dark:text-slate-400 uppercase tracking-widest text-[9px] mb-1">Calculated Order Quantities</div>
              {Object.entries(selectedItems).map(([key, item]: [string, any]) => {
                const calculatedQty = getCalculatedQty(key, item.transaction_type, item.last_price || 0);
                const lotSize = item.lot_size || getLotSize(index);
                const calculatedLots = calculatedQty / lotSize;
                return (
                  <div key={key} className="flex justify-between items-center text-[9px] font-mono border-b border-gray-100 dark:border-[#364f6b] pb-1">
                    <span className="font-bold dark:text-slate-200">{item.name || item.trading_symbol} ({item.transaction_type})</span>
                    <span className="font-black text-indigo-600 dark:text-indigo-400">
                      Qty: {calculatedQty} ({calculatedLots} Lots) @ LTP: ₹{item.last_price || 0}
                    </span>
                  </div>
                );
              })}
            </Paper>
          )}
        </div>

        {/* Chain Table Grid */}
        <TableContainer component={Paper} className="max-h-[70vh] bg-white dark:bg-[#1e2433] border-2 border-gray-300 dark:border-[#4a6fa5] rounded-xl overflow-hidden">
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell align="center" colSpan={7} className="bg-green-50 dark:bg-green-900/30 border-b-2 border-green-200 dark:border-green-800 dark:text-green-200">CALLS (OI: {totals.ce.toLocaleString('en-IN')})</TableCell>
                <TableCell className="bg-gray-800 text-white w-24 text-center">STRIKE</TableCell>
                <TableCell align="center" colSpan={7} className="bg-red-50 dark:bg-red-900/30 border-b-2 border-red-200 dark:border-red-800 dark:text-red-200">PUTS (OI: {totals.pe.toLocaleString('en-IN')})</TableCell>
              </TableRow>
              <TableRow className="bg-gray-100 dark:bg-[#0f1419]">
                <TableCell align="right" className="dark:text-slate-300">Delta</TableCell>
                <TableCell align="right" className="font-bold text-gray-700 dark:text-slate-300">OI Val</TableCell>
                <TableCell align="right" className="dark:text-slate-300">OI</TableCell>
                <TableCell align="right" className="dark:text-slate-300">Limit</TableCell>
                <TableCell align="right" className="dark:text-slate-300">LTP</TableCell>
                <TableCell align="center" className="dark:text-slate-300">Buy</TableCell>
                <TableCell align="center" className="dark:text-slate-300">Sell</TableCell>
                <TableCell align="center" className="bg-gray-200 dark:bg-[#1e2433] font-bold dark:text-white">Price</TableCell>
                <TableCell align="center" className="dark:text-slate-300">Buy</TableCell>
                <TableCell align="center" className="dark:text-slate-300">Sell</TableCell>
                <TableCell align="right" className="dark:text-slate-300">LTP</TableCell>
                <TableCell align="right" className="dark:text-slate-300">Limit</TableCell>
                <TableCell align="right" className="dark:text-slate-300">OI</TableCell>
                <TableCell align="right" className="font-bold text-gray-700 dark:text-slate-300">OI Val</TableCell>
                <TableCell align="right" className="dark:text-slate-300">Delta</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {chain.map((row: any) => {
                const isAtm = Math.abs(row.strike - spot) < 50;
                const cePos = row.ce ? getPositionByInstrumentKey(row.ce.instrument_key) : null;
                const pePos = row.pe ? getPositionByInstrumentKey(row.pe.instrument_key) : null;

                return (
                  <TableRow key={row.strike} className={clsx(isAtm && "bg-yellow-100 dark:bg-yellow-900/30", "dark:border-[#4a6fa5] hover:bg-gray-50 dark:hover:bg-[#1e2433]")}>
                    {/* CE */}
                    <TableCell align="right" className="dark:text-slate-200">{row.ce ? row.ce.delta?.toFixed(2) : '-'}</TableCell>
                    <TableCell align="right" className="text-gray-600 dark:text-slate-400 text-sm">{row.ce ? formatCr(row.ce.oi_value) : ''}</TableCell>
                    <TableCell align="right" className="dark:text-slate-200">{row.ce ? formatOI(row.ce.open_interest) : '-'}</TableCell>
                    <TableCell align="right">
                      {row.ce && (
                        <input
                          type="number"
                          className="w-16 bg-transparent border border-gray-300 dark:border-[#4a6fa5] rounded px-1 text-right text-sm dark:text-white"
                          value={selectedItems[`${row.ce.instrument_key}_BUY`]?.limit_price || selectedItems[`${row.ce.instrument_key}_SELL`]?.limit_price || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSelectedItems(prev => {
                              const next = { ...prev };
                              const buyKey = `${row.ce.instrument_key}_BUY`;
                              const sellKey = `${row.ce.instrument_key}_SELL`;
                              if (next[buyKey]) next[buyKey] = { ...next[buyKey], limit_price: val };
                              if (next[sellKey]) next[sellKey] = { ...next[sellKey], limit_price: val };
                              return next;
                            });
                          }}
                        />
                      )}
                    </TableCell>
                    <TableCell align="right" className="font-bold text-green-700 dark:text-green-400">
                      <div>{row.ce ? row.ce.last_price : '-'}</div>
                      {row.ce && row.ce.pchange !== undefined && (
                        <span className={clsx("text-[10px] font-bold block mt-0.5",
                          row.ce.pchange > 0 ? "text-green-600 dark:text-green-400" :
                          row.ce.pchange < 0 ? "text-red-600 dark:text-red-400" : "text-gray-500"
                        )}>
                          {row.ce.pchange > 0 ? '+' : ''}{row.ce.pchange.toFixed(2)}%
                        </span>
                      )}
                      {cePos && cePos.quantity > 0 && (
                        <div className="flex flex-col text-sm mt-1">
                          <span className="font-bold text-blue-600">Qty: {cePos.quantity}</span>
                        </div>
                      )}
                      {row.ce && selectedItems[`${row.ce.instrument_key}_BUY`] && (
                        <div className="text-[9px] text-indigo-500 font-black mt-0.5">
                          Order: {getCalculatedQty(`${row.ce.instrument_key}_BUY`, 'BUY', row.ce.last_price)} ({getCalculatedQty(`${row.ce.instrument_key}_BUY`, 'BUY', row.ce.last_price) / (row.ce.lot_size || getLotSize(index))} L)
                        </div>
                      )}
                      {row.ce && selectedItems[`${row.ce.instrument_key}_SELL`] && (
                        <div className="text-[9px] text-amber-500 font-black mt-0.5">
                          Order: {getCalculatedQty(`${row.ce.instrument_key}_SELL`, 'SELL', row.ce.last_price)} ({getCalculatedQty(`${row.ce.instrument_key}_SELL`, 'SELL', row.ce.last_price) / (row.ce.lot_size || getLotSize(index))} L)
                        </div>
                      )}
                    </TableCell>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={!!selectedItems[`${row.ce?.instrument_key}_BUY`]}
                        onChange={() => row.ce && toggleSelection(row.ce, 'CE', 'BUY')}
                        color="success"
                        disabled={!row.ce}
                      />
                    </TableCell>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={!!selectedItems[`${row.ce?.instrument_key}_SELL`]}
                        onChange={() => row.ce && toggleSelection(row.ce, 'CE', 'SELL')}
                        color="error"
                        disabled={!row.ce}
                      />
                    </TableCell>

                    {/* Strike */}
                    <TableCell align="center" className="bg-gray-100 dark:bg-[#0f1419] font-bold border-x dark:border-[#4a6fa5] dark:text-white">{row.strike}</TableCell>

                    {/* PE */}
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={!!selectedItems[`${row.pe?.instrument_key}_BUY`]}
                        onChange={() => row.pe && toggleSelection(row.pe, 'PE', 'BUY')}
                        color="success"
                        disabled={!row.pe}
                      />
                    </TableCell>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={!!selectedItems[`${row.pe?.instrument_key}_SELL`]}
                        onChange={() => row.pe && toggleSelection(row.pe, 'PE', 'SELL')}
                        color="error"
                        disabled={!row.pe}
                      />
                    </TableCell>
                    <TableCell align="right" className="font-bold text-red-700 dark:text-red-400">
                      <div>{row.pe ? row.pe.last_price : '-'}</div>
                      {row.pe && row.pe.pchange !== undefined && (
                        <span className={clsx("text-[10px] font-bold block mt-0.5",
                          row.pe.pchange > 0 ? "text-green-600 dark:text-green-400" :
                          row.pe.pchange < 0 ? "text-red-600 dark:text-red-400" : "text-gray-500"
                        )}>
                          {row.pe.pchange > 0 ? '+' : ''}{row.pe.pchange.toFixed(2)}%
                        </span>
                      )}
                      {pePos && pePos.quantity > 0 && (
                        <div className="flex flex-col text-sm mt-1">
                          <span className="font-bold text-blue-600">Qty: {pePos.quantity}</span>
                        </div>
                      )}
                      {row.pe && selectedItems[`${row.pe.instrument_key}_BUY`] && (
                        <div className="text-[9px] text-indigo-500 font-black mt-0.5">
                          Order: {getCalculatedQty(`${row.pe.instrument_key}_BUY`, 'BUY', row.pe.last_price)} ({getCalculatedQty(`${row.pe.instrument_key}_BUY`, 'BUY', row.pe.last_price) / (row.pe.lot_size || getLotSize(index))} L)
                        </div>
                      )}
                      {row.pe && selectedItems[`${row.pe.instrument_key}_SELL`] && (
                        <div className="text-[9px] text-amber-500 font-black mt-0.5">
                          Order: {getCalculatedQty(`${row.pe.instrument_key}_SELL`, 'SELL', row.pe.last_price)} ({getCalculatedQty(`${row.pe.instrument_key}_SELL`, 'SELL', row.pe.last_price) / (row.pe.lot_size || getLotSize(index))} L)
                        </div>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {row.pe && (
                        <input
                          type="number"
                          className="w-16 bg-transparent border border-gray-300 dark:border-[#4a6fa5] rounded px-1 text-right text-sm dark:text-white"
                          value={selectedItems[`${row.pe.instrument_key}_BUY`]?.limit_price || selectedItems[`${row.pe.instrument_key}_SELL`]?.limit_price || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSelectedItems(prev => {
                              const next = { ...prev };
                              const buyKey = `${row.pe.instrument_key}_BUY`;
                              const sellKey = `${row.pe.instrument_key}_SELL`;
                              if (next[buyKey]) next[buyKey] = { ...next[buyKey], limit_price: val };
                              if (next[sellKey]) next[sellKey] = { ...next[sellKey], limit_price: val };
                              return next;
                            });
                          }}
                        />
                      )}
                    </TableCell>
                    <TableCell align="right" className="dark:text-slate-200">{row.pe ? formatOI(row.pe.open_interest) : '-'}</TableCell>
                    <TableCell align="right" className="text-gray-600 dark:text-slate-400 text-sm">{row.pe ? formatCr(row.pe.oi_value) : ''}</TableCell>
                    <TableCell align="right" className="dark:text-slate-200">{row.pe ? row.pe.delta?.toFixed(2) : '-'}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Limit Exit Dialog */}
        <Dialog open={limitExitOpen} onClose={() => setLimitExitOpen(false)}>
          <DialogTitle>Limit Exit: {limitExitPosition?.trading_symbol}</DialogTitle>
          <DialogContent className="pt-2">
            <Typography variant="body2" gutterBottom>
              Current Qty: {limitExitPosition?.quantity} | LTP: {limitExitPosition?.last_price}
            </Typography>
            <TextField
              autoFocus
              margin="dense"
              id="limit-price"
              label="Limit Price"
              type="number"
              fullWidth
              variant="outlined"
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value)}
              inputProps={{ step: "0.05" }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setLimitExitOpen(false)} color="inherit">Cancel</Button>
            <Button onClick={handleLimitExitCode} variant="contained" color="primary">
              Confirm Exit
            </Button>
          </DialogActions>
        </Dialog>

        {/* Charges details dialog */}
        <Dialog open={showTradeBook} onClose={() => setShowTradeBook(false)} maxWidth="lg" fullWidth>
          <DialogTitle className="flex justify-between items-center">
            <span>Today's Trades & Charges</span>
            <span className="font-bold text-lg text-amber-700 dark:text-amber-400">
              Total: ₹{(charges?.total?.grand_total || 0).toFixed(2)}
            </span>
          </DialogTitle>
          <DialogContent>
            {charges?.total && (
              <div className="grid grid-cols-3 md:grid-cols-7 gap-2 mb-4">
                <div className="bg-gray-50 dark:bg-[#1e2433] p-2 rounded text-center">
                  <div className="text-sm text-gray-500">Brokerage</div>
                  <div className="font-bold text-sm">₹{charges.total.brokerage}</div>
                </div>
                <div className="bg-gray-50 dark:bg-[#1e2433] p-2 rounded text-center">
                  <div className="text-sm text-gray-500">STT</div>
                  <div className="font-bold text-sm">₹{charges.total.stt}</div>
                </div>
                <div className="bg-gray-50 dark:bg-[#1e2433] p-2 rounded text-center">
                  <div className="text-sm text-gray-500">TX Charges</div>
                  <div className="font-bold text-sm">₹{charges.total.tx_charges}</div>
                </div>
                <div className="bg-gray-50 dark:bg-[#1e2433] p-2 rounded text-center">
                  <div className="text-sm text-gray-500">GST</div>
                  <div className="font-bold text-sm">₹{charges.total.gst}</div>
                </div>
                <div className="bg-gray-50 dark:bg-[#1e2433] p-2 rounded text-center">
                  <div className="text-sm text-gray-500">SEBI</div>
                  <div className="font-bold text-sm">₹{charges.total.sebi}</div>
                </div>
                <div className="bg-gray-50 dark:bg-[#1e2433] p-2 rounded text-center">
                  <div className="text-sm text-gray-500">Stamp Duty</div>
                  <div className="font-bold text-sm">₹{charges.total.stamp_duty}</div>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/30 p-2 rounded text-center border border-amber-200 dark:border-amber-800">
                  <div className="text-sm text-amber-700 dark:text-amber-300">Trades count</div>
                  <div className="font-bold text-sm text-amber-800 dark:text-amber-200">{charges.total.trade_count}</div>
                </div>
              </div>
            )}

            <TableContainer component={Paper} className="max-h-[60vh]">
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell className="font-bold">Symbol</TableCell>
                    <TableCell className="font-bold" align="center">Type</TableCell>
                    <TableCell className="font-bold" align="right">Qty</TableCell>
                    <TableCell className="font-bold" align="right">Price</TableCell>
                    <TableCell className="font-bold" align="right">Turnover</TableCell>
                    <TableCell className="font-bold" align="right">Brokerage</TableCell>
                    <TableCell className="font-bold" align="right">STT</TableCell>
                    <TableCell className="font-bold" align="right">TX</TableCell>
                    <TableCell className="font-bold" align="right">GST</TableCell>
                    <TableCell className="font-bold" align="right">Total</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(charges?.orders || []).map((t: any, i: number) => (
                    <TableRow key={i} className="hover:bg-gray-50 dark:hover:bg-[#1e2433]">
                      <TableCell className="text-xs">{t.trading_symbol}</TableCell>
                      <TableCell align="center">
                        <span className={clsx("text-sm font-bold px-1 py-0.5 rounded", t.transaction_type === 'BUY' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>{t.transaction_type}</span>
                      </TableCell>
                      <TableCell align="right" className="text-xs">{t.quantity}</TableCell>
                      <TableCell align="right" className="text-xs">₹{t.average_price}</TableCell>
                      <TableCell align="right" className="text-xs">₹{t.turnover?.toLocaleString('en-IN')}</TableCell>
                      <TableCell align="right" className="text-xs">₹{t.brokerage}</TableCell>
                      <TableCell align="right" className="text-xs">₹{t.stt}</TableCell>
                      <TableCell align="right" className="text-xs">₹{t.tx_charges}</TableCell>
                      <TableCell align="right" className="text-xs">₹{t.gst}</TableCell>
                      <TableCell align="right" className="text-sm font-bold">₹{t.total}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowTradeBook(false)} color="inherit">Close</Button>
            <Button onClick={fetchCharges} variant="contained" size="small">Refresh</Button>
          </DialogActions>
        </Dialog>

        {/* Hotkeys Cheat Sheet at the bottom */}
        {enableHotkeys && (
          <div className="bg-indigo-50/80 dark:bg-indigo-950/20 border-2 border-indigo-100 dark:border-indigo-900/40 rounded-3xl p-4 flex flex-wrap gap-x-6 gap-y-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300 items-center mt-6">
            <span className="font-extrabold uppercase tracking-widest text-[10px] text-indigo-500 w-full mb-1 flex items-center gap-1">
              <Keyboard className="w-3.5 h-3.5" /> Hotkey Quick Guide (Active globally when text input fields are not focused)
            </span>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded shadow font-extrabold text-[10px] text-slate-800 dark:text-slate-200">Space</kbd> Panic Exit All</span>
              <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded shadow font-extrabold text-[10px] text-slate-800 dark:text-slate-200">Q</kbd> Buy ATM CALL</span>
              <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded shadow font-extrabold text-[10px] text-slate-800 dark:text-slate-200">W</kbd> Buy ATM+1 CALL</span>
              <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded shadow font-extrabold text-[10px] text-slate-800 dark:text-slate-200">E</kbd> Buy ATM+2 CALL</span>
              <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded shadow font-extrabold text-[10px] text-slate-800 dark:text-slate-200">P</kbd> Buy ATM PUT</span>
              <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded shadow font-extrabold text-[10px] text-slate-800 dark:text-slate-200">O</kbd> Buy ATM-1 PUT</span>
              <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded shadow font-extrabold text-[10px] text-slate-800 dark:text-slate-200">I</kbd> Buy ATM-2 PUT</span>
              <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded shadow font-extrabold text-[10px] text-slate-800 dark:text-slate-200">Z</kbd> Exit Mock</span>
              <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded shadow font-extrabold text-[10px] text-slate-800 dark:text-slate-200">X</kbd> Exit Live</span>
              <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded shadow font-extrabold text-[10px] text-slate-800 dark:text-slate-200">C</kbd> Cancel Orders</span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
