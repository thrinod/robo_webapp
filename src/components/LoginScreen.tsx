"use client";

import React, { useState } from 'react';
import api from '@/services/api';

interface LoginScreenProps {
    onLoginSuccess: () => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            // Temporarily set token to test the health endpoint
            localStorage.setItem('app_password', password);
            
            // Call any protected endpoint to verify, e.g. /health
            await api.get('/health');
            
            // If it succeeds, we are authenticated
            onLoginSuccess();
            
        } catch (err: any) {
            localStorage.removeItem('app_password');
            if (err.response && err.response.status === 401) {
                setError('Invalid App Password');
            } else {
                setError('Failed to connect to backend server');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900 bg-opacity-95 text-white backdrop-blur-md">
            <div className="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-xl shadow-2xl border border-gray-700">
                <div className="text-center">
                    <h1 className="text-3xl font-bold tracking-tight mb-2">RoboTrader</h1>
                    <p className="text-gray-400">Enter the Application Password to continue</p>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Current Password"
                            className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder-gray-500 text-white"
                            required
                            autoFocus
                        />
                    </div>
                    
                    {error && (
                        <div className="p-3 text-sm text-red-400 bg-red-900/30 border border-red-500/50 rounded-lg text-center animate-pulse">
                            {error}
                        </div>
                    )}
                    
                    <button
                        type="submit"
                        disabled={isLoading || !password}
                        className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/30"
                    >
                        {isLoading ? (
                            <span className="flex items-center justify-center gap-2">
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Authenticating...
                            </span>
                        ) : 'Access Dashboard'}
                    </button>
                    <p className="text-xs text-center text-gray-500 pt-4">
                        For personal use only. Keep your password secure.
                    </p>
                </form>
            </div>
        </div>
    );
}
