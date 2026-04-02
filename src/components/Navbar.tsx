"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Briefcase, TrendingUp, LineChart, Database, Activity, ClipboardList, Settings, ChevronDown } from "lucide-react";
import clsx from "clsx";
import { useState, useContext, MouseEvent } from "react";
import { ColorModeContext } from "@/components/ThemeRegistry";
import { useTheme, Menu, MenuItem, Button as MuiButton } from "@mui/material"; // Alias Button to avoid conflict if needed, though mostly using divs/links
import { Sun, Moon } from "lucide-react";

const navItems = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Portfolio", href: "/portfolio", icon: Briefcase },
    { name: "Positions", href: "/positions", icon: Activity },
    { name: "Option Chain", href: "/option-chain", icon: TrendingUp },
    { name: "Chart", href: "/charts", icon: LineChart },
    { name: "Analysis", href: "/analysis", icon: Activity },
    { name: "Scanner", href: "/scanner", icon: Activity },
    { name: "Indicators", href: "/indicators", icon: Activity },
    { name: "Watchlist", href: "/watchlist", icon: Briefcase },
    {
        name: "Tools",
        icon: Settings,
        children: [
            { name: "Data Viewer", href: "/data-viewer", icon: Database },
            { name: "Paper Trading", href: "/paper-trading", icon: ClipboardList },
        ]
    }
];

export default function Navbar() {
    const pathname = usePathname();
    const colorMode = useContext(ColorModeContext);
    const theme = useTheme();

    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);

    const handleClick = (event: MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    return (
        <nav className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-50 transition-colors duration-200">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="flex h-16 justify-between">
                    <div className="flex">
                        <div className="flex flex-shrink-0 items-center">
                            <span className="text-xl font-bold text-blue-600 dark:text-blue-400">RoboTrader</span>
                        </div>
                        <div className="hidden sm:ml-6 sm:flex sm:space-x-8 items-center">
                            {navItems.map((item) => {
                                if (item.children) {
                                    const isActive = item.children.some(child => child.href === pathname);
                                    return (
                                        <div key={item.name} className="relative">
                                            <button
                                                onClick={handleClick}
                                                className={clsx(
                                                    "inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors duration-200 h-full",
                                                    isActive
                                                        ? "border-blue-500 text-gray-900 dark:text-gray-100"
                                                        : "border-transparent text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 hover:text-gray-700 dark:hover:text-gray-200"
                                                )}
                                            >
                                                <item.icon className="w-4 h-4 mr-2" />
                                                {item.name}
                                                <ChevronDown className="w-4 h-4 ml-1" />
                                            </button>
                                            <Menu
                                                anchorEl={anchorEl}
                                                open={open}
                                                onClose={handleClose}
                                                MenuListProps={{
                                                    'aria-labelledby': 'basic-button',
                                                }}
                                            >
                                                {item.children.map((child) => (
                                                    <MenuItem key={child.name} onClick={handleClose} component={Link} href={child.href}>
                                                        <child.icon className="w-4 h-4 mr-2 text-gray-500" />
                                                        {child.name}
                                                    </MenuItem>
                                                ))}
                                            </Menu>
                                        </div>
                                    );
                                }

                                const isActive = pathname === item.href;
                                return (
                                    <Link
                                        key={item.name}
                                        href={item.href}
                                        className={clsx(
                                            "inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors duration-200 h-full",
                                            isActive
                                                ? "border-blue-500 text-gray-900 dark:text-gray-100"
                                                : "border-transparent text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 hover:text-gray-700 dark:hover:text-gray-200"
                                        )}
                                    >
                                        <item.icon className="w-4 h-4 mr-2" />
                                        {item.name}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                    <div className="hidden sm:ml-6 sm:flex sm:items-center gap-4">
                        <button
                            onClick={colorMode.toggleColorMode}
                            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                            {theme.palette.mode === 'dark' ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5 text-gray-600" />}
                        </button>
                        <div className="text-sm text-gray-500 dark:text-gray-400">v1.0.0</div>
                    </div>
                </div>
            </div>

            {/* Mobile Menu (Simplified) */}
            <div className="sm:hidden flex justify-around border-t py-2 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                {navItems.map((item) => {
                    if (item.children) {
                        return item.children.map(child => (
                            <Link key={child.name} href={child.href} className="p-2 text-gray-600 dark:text-gray-400">
                                <child.icon className="w-6 h-6" />
                            </Link>
                        ));
                    }
                    return (
                        <Link key={item.name} href={item.href} className="p-2 text-gray-600 dark:text-gray-400">
                            <item.icon className="w-6 h-6" />
                        </Link>
                    )
                })}
            </div>
        </nav>
    );
}
