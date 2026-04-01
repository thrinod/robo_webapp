"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUpstoxStatus, getAuthUrl, setManualToken } from "@/services/api";
import { AlertCircle, CheckCircle, ExternalLink, Key } from "lucide-react";
import { Button, TextField, Divider, Collapse, IconButton } from "@mui/material";

export default function Home() {
  const router = useRouter();
  const [status, setStatus] = useState<string>("Loading...");
  const [loading, setLoading] = useState(true);

  // Manual Token State
  const [showManual, setShowManual] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [tokenLoading, setTokenLoading] = useState(false);

  useEffect(() => {
    fetchStatus();
    // Poll every 5s
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
    setLoading(false);
  };

  const handleLogin = async () => {
    const url = await getAuthUrl();
    if (url) {
      window.location.href = url;
    }
    if (!url) {
      console.error("Failed to get login URL");
      return;
    }
  };

  const handleManualToken = async () => {
    if (!tokenInput) return;
    setTokenLoading(true);
    const res = await setManualToken(tokenInput);
    if (res.status === "success") {
      console.log("Token Connected!");
      // Show success briefly before redirecting
      setTokenInput("");
      setShowManual(false);
      router.push("/option-chain");
    } else {
      console.error("Token Error:", res.message || "Invalid Token");
      alert(res.message || "Invalid Token. Please check your credentials.");
    }
    setTokenLoading(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">RoboTrader Dashboard</h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">Advanced Nifty/BankNifty Algo Trading System</p>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-8 w-full max-w-md border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold mb-6 flex items-center justify-center text-gray-800 dark:text-gray-200">
          System Status
        </h2>

        <div className="flex items-center justify-between mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded">
          <span className="text-gray-700 dark:text-gray-300 font-medium">Upstox API</span>
          <div className="flex items-center">
            {status === "Connected" ? (
              <>
                <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                <span className="text-green-600 font-bold">Connected</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
                <span className="text-red-600 font-bold">{status}</span>
              </>
            )}
          </div>
        </div>

        {!loading && (
          <div className="space-y-4">
            {/* Login Button - Only if disconnected */}
            {status !== "Connected" && (
              <Button
                variant="contained"
                color="primary"
                fullWidth
                size="large"
                startIcon={<ExternalLink size={18} />}
                onClick={handleLogin}
                className="bg-blue-600 hover:bg-blue-700 normal-case mb-4"
              >
                Login with Upstox
              </Button>
            )}

            {/* Divider */}
            {status !== "Connected" && (
              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
                <span className="flex-shrink-0 mx-4 text-gray-400 dark:text-gray-500 text-xs uppercase">Or provide token</span>
                <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
              </div>
            )}

            {/* Manual Token Entry - Always Available (Collapsible) */}
            <Button
              variant="text"
              size="small"
              onClick={() => setShowManual(!showManual)}
              className="w-full text-gray-500 dark:text-gray-400"
            >
              {showManual ? "Hide Manual Entry" : (status === "Connected" ? "Update Access Token" : "Enter Access Token Manually")}
            </Button>

            <Collapse in={showManual}>
              <div className="space-y-2 bg-gray-50 dark:bg-gray-700 p-3 rounded border border-gray-200 dark:border-gray-600">
                <TextField
                  label="Access Token"
                  size="small"
                  fullWidth
                  type="password"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="eyJhbGciOi..."
                  InputLabelProps={{ className: "dark:text-gray-300" }}
                  InputProps={{ className: "dark:text-white" }}
                />
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={handleManualToken}
                  disabled={tokenLoading}
                  startIcon={<Key size={16} />}
                >
                  {tokenLoading ? "Verifying..." : "Set Token"}
                </Button>
              </div>
            </Collapse>
          </div>
        )}

        {status === "Connected" && !showManual && (
          <div className="text-center text-sm text-gray-500 mt-4">
            System is ready for trading.
          </div>
        )}
      </div>
    </div>
  );
}
