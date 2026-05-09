"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUpstoxStatus } from "@/services/api";
import { CheckCircle, ExternalLink, Key, Sparkles, Activity } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const [status, setStatus] = useState<string>("Loading...");

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchStatus = async () => {
    const data = await getUpstoxStatus();
    if (data?.upstox === "connected") {
      setStatus("Connected");
    } else {
      setStatus("Disconnected");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-12 p-4">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center p-3 bg-indigo-500/10 rounded-2xl mb-4">
          <Sparkles className="w-8 h-8 text-indigo-500" />
        </div>
        <h1 className="text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-6xl">
          RoboTrader <span className="text-indigo-600">Pro</span>
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Your command center for high-performance algorithmic trading. 
          Monitor positions, analyze option chains, and automate your strategy with precision.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-7xl">
        <div 
          onClick={() => router.push('/option-chain')}
          className="group p-8 bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-xl hover:border-indigo-500/50 transition-all cursor-pointer"
        >
          <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <ExternalLink className="w-6 h-6 text-indigo-500" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Option Chain</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Analyze Greeks and execute multi-leg strategies in real-time.</p>
        </div>

        <div 
          onClick={() => router.push('/positions')}
          className="group p-8 bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-xl hover:border-indigo-500/50 transition-all cursor-pointer"
        >
          <div className="w-12 h-12 bg-green-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <CheckCircle className="w-6 h-6 text-green-500" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Live Positions</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Monitor your P&L and automate exits with precision SL/Targets.</p>
        </div>

        <div 
          onClick={() => router.push('/mock-positions')}
          className="group p-8 bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-xl hover:border-indigo-500/50 transition-all cursor-pointer"
        >
          <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <Activity className="w-6 h-6 text-blue-500" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Mock Trades</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Track simulated positions and view historical performance.</p>
        </div>

        <div 
          onClick={() => router.push('/settings')}
          className="group p-8 bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-xl hover:border-indigo-500/50 transition-all cursor-pointer"
        >
          <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <Key className="w-6 h-6 text-amber-500" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">API Settings</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Manage Upstox, Mirae Asset, and Telegram integrations.</p>
        </div>
      </div>

      <div className="flex items-center gap-2 p-4 bg-gray-100 dark:bg-gray-800/50 rounded-2xl border border-gray-200 dark:border-gray-700">
        <div className={`w-2 h-2 rounded-full ${status === 'Connected' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Upstox Status: {status}
        </span>
      </div>
    </div>
  );
}

