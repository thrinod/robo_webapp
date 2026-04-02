"use client";

import React, { useState, useEffect } from 'react';
import LoginScreen from './LoginScreen';
import api from '@/services/api';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isChecking, setIsChecking] = useState(true);

    useEffect(() => {
        const checkAuth = async () => {
            const token = localStorage.getItem('app_password');
            if (token) {
                try {
                    // Optionally perform a silent check in the background
                    // For speed, we just trust the token exists. Axios interceptor will clear it if 401.
                    setIsAuthenticated(true);
                } catch (error) {
                    setIsAuthenticated(false);
                }
            } else {
                setIsAuthenticated(false);
            }
            setIsChecking(false);
        };
        
        checkAuth();
    }, []);

    if (isChecking) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-gray-950 text-white">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <LoginScreen onLoginSuccess={() => setIsAuthenticated(true)} />;
    }

    return <>{children}</>;
}
