"use client";

import React, { useEffect, useState } from 'react';
import { RefreshCw, Activity, MessageSquare, Terminal } from "lucide-react";

interface AgentLog {
  timestamp: string;
  agent: string;
  action: string;
  message: string;
  data: Record<string, any>;
}

export default function AgentLogsPage() {
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // RL Form State
  const [rlSymbol, setRlSymbol] = useState("AAPL");
  const [rlAction, setRlAction] = useState("BUY");
  const [rlReward, setRlReward] = useState("5.0");
  const [rlLesson, setRlLesson] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getBaseUrl = () => {
    if (typeof window !== 'undefined') {
      return `http://${window.location.hostname}:8001`;
    }
    return "http://localhost:8001";
  };

  const submitRLFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await fetch(`${getBaseUrl()}/api/trading/rl-feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: rlSymbol,
          action_taken: rlAction,
          outcome_reward: parseFloat(rlReward) || 0,
          lesson: rlLesson,
        }),
      });
      fetchLogs();
      setRlLesson("");
    } catch (err) {
      console.error("Error submitting RL feedback:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch(`${getBaseUrl()}/api/logs`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.logs) {
          setLogs(data.logs.reverse());
        }
      }
    } catch (error) {
      // Silence the error if it's a common network failure to avoid console spam during polling
      // console.error("Agentic backend (8001) unreachable");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(fetchLogs, 3000); // poll every 3 seconds
    }
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const getAgentColor = (agent: string) => {
    if (agent.includes("Analysis")) return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    if (agent.includes("Trading")) return "bg-green-500/10 text-green-500 border-green-500/20";
    if (agent.includes("Critic")) return "bg-red-500/10 text-red-500 border-red-500/20";
    if (agent.includes("RL")) return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
    return "bg-purple-500/10 text-purple-500 border-purple-500/20";
  };

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-6xl">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
            Agentic AI Control Center
          </h1>
          <p className="text-muted-foreground mt-1 text-gray-500">
            Real-time monitoring of multi-agent communication and trading workflows.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              autoRefresh ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? "Auto-refresh On" : "Auto-refresh Off"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Column (Agents + RL Form) */}
        <div className="col-span-1 flex flex-col gap-6">
          <div className="border rounded-xl p-4 shadow-sm bg-white">
            <div className="mb-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Activity className="w-5 h-5 text-blue-600" />
                Active Agents
              </h2>
              <p className="text-sm text-gray-500">Currently registered agents in the MCP pool</p>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg border bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                  <span className="font-medium text-sm">RLAgent</span>
                </div>
                <span className="px-2 py-1 text-xs rounded border bg-white">Memory</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                  <span className="font-medium text-sm">AnalysisAgent</span>
                </div>
                <span className="px-2 py-1 text-xs rounded border bg-white">Idle</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                  <span className="font-medium text-sm">TradingAgent</span>
                </div>
                <span className="px-2 py-1 text-xs rounded border bg-white">Idle</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-red-500"></div>
                  <span className="font-medium text-sm">CriticAgent</span>
                </div>
                <span className="px-2 py-1 text-xs rounded border bg-white">Idle</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                  <span className="font-medium text-sm">MCP Client</span>
                </div>
                <span className="px-2 py-1 text-xs rounded border bg-white text-green-600 font-medium">Connected</span>
              </div>
            </div>
          </div>

          {/* Manual RL Feedback Form */}
          <div className="border rounded-xl p-4 shadow-sm bg-white">
            <div className="mb-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <MessageSquare className="w-5 h-5 text-yellow-600" />
                Manual RL Feedback
              </h2>
              <p className="text-sm text-gray-500">Train the agent with trade outcomes</p>
            </div>
            <form onSubmit={submitRLFeedback} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700">Symbol</label>
                  <input 
                    type="text" 
                    value={rlSymbol} 
                    onChange={(e) => setRlSymbol(e.target.value)}
                    className="w-full mt-1 p-2 text-sm border rounded" 
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700">Action Taken</label>
                  <select 
                    value={rlAction} 
                    onChange={(e) => setRlAction(e.target.value)}
                    className="w-full mt-1 p-2 text-sm border rounded bg-white"
                  >
                    <option value="BUY">BUY</option>
                    <option value="SELL">SELL</option>
                    <option value="HOLD">HOLD</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">Outcome Reward (+/-)</label>
                <input 
                  type="number" 
                  step="0.1"
                  value={rlReward} 
                  onChange={(e) => setRlReward(e.target.value)}
                  className="w-full mt-1 p-2 text-sm border rounded" 
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">Lesson Learned</label>
                <textarea 
                  value={rlLesson} 
                  onChange={(e) => setRlLesson(e.target.value)}
                  className="w-full mt-1 p-2 text-sm border rounded" 
                  rows={2}
                  placeholder="E.g., RSI was overbought..."
                  required
                ></textarea>
              </div>
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full py-2 bg-yellow-500 hover:bg-yellow-600 text-white font-medium rounded-md text-sm transition-colors"
              >
                {isSubmitting ? "Submitting..." : "Submit Training Data"}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column (Logs Stream) */}
        <div className="col-span-1 md:col-span-2 border rounded-xl shadow-sm bg-white flex flex-col h-[600px]">
          <div className="p-4 border-b">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Terminal className="w-5 h-5 text-blue-600" />
              Live Communication Stream
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-6 relative">
            <div className="space-y-4 pt-2">
                  {logs.length === 0 && !loading && (
                    <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                      <MessageSquare className="w-8 h-8 mb-2 opacity-20" />
                      <p>Agentic Backend (Port 8001) is not connected.</p>
                      <p className="text-sm mt-2">To use this module, please run <code>start_agents.bat</code></p>
                    </div>
                  )}
                  {logs.map((log, index) => (
                    <div
                      key={index}
                      className="relative pl-6 before:absolute before:left-2 before:top-2 before:bottom-[-20px] before:w-[2px] before:bg-gray-200 last:before:hidden transition-all"
                    >
                      <div className="absolute left-[3px] top-2 w-3 h-3 rounded-full bg-blue-600 ring-4 ring-white z-10" />
                      <div className="bg-white border rounded-lg p-4 shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded text-xs font-medium border ${getAgentColor(log.agent)}`}>
                              {log.agent}
                            </span>
                            <span className="text-sm font-semibold">{log.action}</span>
                          </div>
                          <span className="text-xs text-gray-500">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-800">{log.message}</p>
                        {log.data && Object.keys(log.data).length > 0 && (
                          <div className="mt-3 p-3 bg-gray-100 rounded-md text-xs font-mono overflow-x-auto text-gray-700">
                            <pre>{JSON.stringify(log.data, null, 2)}</pre>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
