"use client";

import React, { createContext, useState, useMemo, useEffect } from "react";
import { createTheme, ThemeProvider, CssBaseline } from "@mui/material";
import { AppRouterCacheProvider } from '@mui/material-nextjs/v14-appRouter'; // Using built-in v14 adapter if available or custom

export const ColorModeContext = createContext({ toggleColorMode: () => { } });

export default function ThemeRegistry({ children }: { children: React.ReactNode }) {
    const [mode, setMode] = useState<"light" | "dark">("light");
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        // Load preference
        const stored = localStorage.getItem("themeMode");
        if (stored === "dark" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
            setMode("dark");
            document.documentElement.classList.add("dark");
        } else {
            setMode("light");
            document.documentElement.classList.remove("dark");
        }
    }, []);

    const colorMode = useMemo(
        () => ({
            toggleColorMode: () => {
                setMode((prevMode) => {
                    const newMode = prevMode === "light" ? "dark" : "light";
                    localStorage.setItem("themeMode", newMode);
                    if (newMode === "dark") {
                        document.documentElement.classList.add("dark");
                    } else {
                        document.documentElement.classList.remove("dark");
                    }
                    return newMode;
                });
            },
        }),
        []
    );

    const theme = useMemo(
        () =>
            createTheme({
                palette: {
                    mode,
                    ...(mode === "light"
                        ? {
                            // Light mode colors
                            background: { default: "#ffffff", paper: "#ffffff" },
                            text: { primary: "#171717" }
                        }
                        : {
                            // Dark mode colors
                            background: { default: "#0a0a0a", paper: "#1f2937" }, // gray-800
                            text: { primary: "#ededed" }
                        }),
                },
            }),
        [mode]
    );

    // Prevent hydration mismatch by rendering null until mounted
    if (!mounted) {
        return <>{children}</>;
        // Optional: return <div style={{ visibility: 'hidden' }}>{children}</div> to avoid flash
        // But simply modifying valid HTML is better.
        // Actually, for ThemeProvider, we might want to render with default theme (server) 
        // but the error is specifically about HTML mismatch.
    }

    return (
        <ColorModeContext.Provider value={colorMode}>
            {/* AppRouterCacheProvider handles the critical CSS injection for SSR */}
            <AppRouterCacheProvider options={{ key: 'mui' }}>
                <ThemeProvider theme={theme}>
                    <CssBaseline />
                    {children}
                </ThemeProvider>
            </AppRouterCacheProvider>
        </ColorModeContext.Provider>
    );
}
