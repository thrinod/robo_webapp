import axios from 'axios';

// Prioritize Environment Variable for Cloud Deployment
let API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

// Fallback to hostname-based detection only if no env var is provided and we are in browser
if (!process.env.NEXT_PUBLIC_API_URL && typeof window !== 'undefined') {
    API_URL = `http://${window.location.hostname}:8000`;
}

const api = axios.create({
    baseURL: API_URL,
    timeout: 120000, // 2 minutes for bulk scanner operations
    headers: {
        'Content-Type': 'application/json',
    },
});

// Auth & Status
export const getUpstoxStatus = async () => {
    try {
        const response = await api.get('/auth/status');
        return response.data; // { access_token: ..., status: ... }
    } catch (error) {
        console.error("Auth Status Error", error);
        return { status: 'Error', access_token: null };
    }
};

export const getAuthUrl = async () => {
    try {
        const response = await api.get('/auth/login_url');
        return response.data.login_url;
    } catch (error) {
        console.error("Auth URL Error", error);
        return null;
    }
};

export const setManualToken = async (token: string) => {
    try {
        const response = await api.post('/auth/token', { token });
        return response.data; // { message, status, upstox_status }
    } catch (error) {
        console.error("Set Token Error", error);
        return { status: 'error', message: 'Failed to set token' };
    }
};

// Portfolio
export const getUserFunds = async () => {
    try {
        const response = await api.get('/user/funds');
        // Handle wrapped data structure if needed
        const d = response.data.data;
        console.log("Funds API Response:", d);
        return d && d.equity ? d.equity : d;
    } catch (error) {
        console.error("Funds Error", error);
        return null;
    }
};

export const getPositions = async () => {
    try {
        const response = await api.get('/user/positions');
        return response.data.data || [];
    } catch (error) {
        console.error("Positions Error", error);
        return [];
    }
};

export const getHoldings = async () => {
    try {
        const response = await api.get('/user/holdings');
        return response.data.data || [];
    } catch (error) {
        console.error("Holdings Error", error);
        return [];
    }
};

export const exitPosition = async (instrument_key: string) => {
    try {
        const response = await api.post('/trade/exit', { instrument_key });
        return response.data;
    } catch (error) {
        throw error;
    }
};

// Option Chain
export const getExpiryDates = async (instrument_key: string) => {
    try {
        const response = await api.get('/market/options/expiry', { params: { instrument_key } });
        return response.data.data;
    } catch (error) {
        return [];
    }
};

export const getOptionChain = async (instrument_key: string, expiry_date: string) => {
    try {
        const response = await api.get('/market/options/chain', {
            params: { instrument_key, expiry_date }
        });
        return response.data; // { data: [], spot_price: ..., totals: ... }
    } catch (error) {
        return { data: [], spot_price: 0, totals: { ce: 0, pe: 0 } };
    }
};

// Snapshots
export const saveSnapshot = async (data: any) => {
    return api.post('/analysis/snapshot', data);
};

// Baskets
export const saveBasket = async (id: number, data: any) => {
    return api.post(`/analysis/basket/${id}`, data);
};

export const getBasket = async (id: number) => {
    try {
        const res = await api.get(`/analysis/basket/${id}`);
        return res.data;
    } catch (e) {
        return null;
    }
};

export const placeOrders = async (orders: any[]) => {
    return api.post('/trade/place_orders', { orders });
};

export const cancelAllOrders = async () => {
    return api.post('/trade/cancel_all');
};

export const squareOffAll = async () => {
    return api.post('/trade/square_off');
};

// Trade Charges
export const getUserCharges = async () => {
    try {
        const response = await api.get('/user/charges');
        return response.data.data || { total: { grand_total: 0, trade_count: 0 }, trades: [] };
    } catch (error) {
        console.error("Charges Error", error);
        return { total: { grand_total: 0, trade_count: 0 }, trades: [] };
    }
};



// Scanner Results Persistence
export const getScannerResults = async () => {
    try {
        const res = await api.get('/scanner/results');
        return res.data.data || [];
    } catch (error) {
        return [];
    }
};

// DB Viewer
export const getCollections = async () => {
    try {
        const response = await api.get('/db/collections');
        return response.data.collections || [];
    } catch (error) {
        return [];
    }
};

export const getCollectionData = async (collection: string, search = '') => {
    try {
        const response = await api.get(`/db/data/${collection}`, { params: { search } });
        return response.data.data || [];
    } catch (error) {
        return [];
    }
};

// Watchlist
export const getWatchlist = async (watchlist_id = 1) => {
    try {
        const response = await api.get('/watchlist', { params: { watchlist_id } });
        return response.data.data || [];
    } catch (error) {
        return [];
    }
};

export const getQuotes = async (instrument_keys: string[]) => {
    try {
        const response = await api.post('/watchlist/quote', { instrument_keys });
        return response.data.data || {};
    } catch (error) {
        return {};
    }
};

export const refreshWatchlist = async (watchlist_id = 1) => {
    try {
        const response = await api.post('/watchlist/refresh', null, { params: { watchlist_id } });
        return response.data.data || [];
    } catch (error) {
        console.error('Error refreshing watchlist:', error);
        return [];
    }
};

export const addToWatchlist = async (instrument_key: string, watchlist_id = 1) => {
    try {
        const response = await api.post('/watchlist', { instrument_key, watchlist_id });
        return response.data;
    } catch (error) {
        return { status: "error", message: "Error adding item" };
    }
};

export const removeFromWatchlist = async (instrument_key: string, watchlist_id = 1) => {
    try {
        const response = await api.delete(`/watchlist/${instrument_key}`, { params: { watchlist_id } });
        return response.data;
    } catch (error) {
        return { status: "error", message: "Error deleting item" };
    }
};

export default api;

export const placeMockOrder = async (order: any) => {
    try {
        const response = await api.post('/trade/mock/place', order);
        return response.data;
    } catch (error) {
        console.error("Mock Order Error", error);
        throw error;
    }
};

export const getMockPositions = async () => {
    try {
        const response = await api.get('/trade/mock/positions');
        return response.data;
    } catch (error) {
        console.error("Mock Positions Error", error);
        return [];
    }
};

export const exitMockPosition = async (tradeId: string) => {
    try {
        const response = await api.get(`/trade/mock/exit/${tradeId}`);
        return response.data;
    } catch (error) {
        console.error("Mock Exit Error", error);
        throw error;
    }
};

export const getHistory = async (instrumentKey: string, interval: string) => {
    try {
        const response = await api.get(`/market/history`, { params: { instrument_key: instrumentKey, interval } });
        return response.data.data;
    } catch (error) {
        console.error("Error fetching history", error);
        return null;
    }
};

export const searchInstruments = async (query: string, filters?: { segment?: string, exchange?: string, instrument_type?: string, mtf_enabled?: boolean }) => {
    try {
        const params: any = { q: query };
        if (filters) {
            if (filters.segment) params.segment = filters.segment;
            if (filters.exchange) params.exchange = filters.exchange;
            if (filters.instrument_type) params.instrument_type = filters.instrument_type;
            if (filters.mtf_enabled) params.mtf_enabled = filters.mtf_enabled;
        }
        const response = await api.get(`/market/instruments/search`, { params });
        return response.data.data;
    } catch (error) {
        console.error("Error searching instruments", error);
        return [];
    }
};

export const getInstrumentTypes = async () => {
    try {
        const response = await api.get('/market/instruments/types');
        return response.data.data || [];
    } catch (error) {
        console.error("Error fetching instrument types", error);
        return [];
    }
};

export const getIntradayHistory = async (instrumentKey: string, interval: string) => {
    try {
        const response = await api.get('/market/intraday', {
            params: {
                instrument_key: instrumentKey,
                interval: interval,
                _t: Date.now()
            }
        });
        return response.data.data;
    } catch (error) {
        console.error("Error fetching intraday data:", error);
        return null;
    }
};

export const getMockHistory = async () => {
    try {
        const response = await api.get('/trade/mock/history');
        return response.data;
    } catch (error) {
        console.error("Mock History Error", error);
        return [];
    }
};
// Alice Blue
export const getAliceStatus = async () => {
    try {
        const response = await api.get('/alice/auth/status');
        return response.data;
    } catch (error) {
        return { status: 'DISCONNECTED' };
    }
};

export const getAliceOptionChain = async (instrument_key: string, expiry_date: string) => {
    try {
        const response = await api.get('/alice/market/options/chain', {
            params: { instrument_key, expiry_date }
        });
        return response.data;
    } catch (error) {
        return { chain: [], expiry_dates: [], spot_price: 0 };
    }
};
// Scanner Persistence
export const getScannerInstruments = async () => {
    try {
        const response = await api.get('/scanner/instruments');
        return response.data.data || [];
    } catch (error) {
        console.error("Error fetching scanner instruments", error);
        return [];
    }
};

export const addScannerInstruments = async (items: any[]) => {
    try {
        const response = await api.post('/scanner/instruments', items);
        return response.data;
    } catch (error) {
        console.error("Error adding scanner instruments", error);
        return { status: "error" };
    }
};

export const removeScannerInstrument = async (instrument_key: string) => {
    try {
        const response = await api.delete(`/scanner/instruments/${instrument_key}`);
        return response.data;
    } catch (error) {
        console.error("Error removing scanner instrument", error);
        return { status: "error" };
    }
};

export const clearScannerInstruments = async () => {
    try {
        const response = await api.delete('/scanner/instruments');
        return response.data;
    } catch (error) {
        return { status: "error" };
    }
};

export const populateScannerInstruments = async (index: string) => {
    try {
        const response = await api.post('/scanner/populate', null, { params: { index } });
        return response.data;
    } catch (error) {
        console.error("Error populating scanner", error);
        return { status: "error" };
    }
};

export const populateScannerFno = async () => {
    try {
        const response = await api.post('/scanner/populate_fno');
        return response.data;
    } catch (error) {
        return { status: "error", message: "API Call Failed" };
    }
};

export const fetchFnoList = async () => {
    try {
        const response = await api.post('/scanner/fetch-fno');
        return response.data;
    } catch (error) {
        console.error("Error fetching FNO list from NSE", error);
        return { status: "error", message: "Network Error" };
    }
};

export const fetchMasterInstruments = async () => {
    try {
        const response = await api.post('/scanner/fetch-master');
        return response.data;
    } catch (error) {
        console.error("Error fetching Master Instruments", error);
        return { status: "error", message: "Network Error" };
    }
};

export const getScannerData = async (instrument_keys: string[] = [], interval = "1minute", mode = "combined", force_refresh = false) => {
    try {
        // If keys provided, use them. If empty, backend fetches all from DB.
        const response = await api.post('/scanner/process', {
            instrument_keys: instrument_keys.length > 0 ? instrument_keys : [],
            interval,
            mode,
            force_refresh
        });
        if (response.data.data && response.data.data.length > 0) {
            // console.log("Scanner Data Sample:", response.data.data[0]);
        }
        return response.data.data || [];
    } catch (error) {
        console.error("Error fetching scanner data", error);
        return [];
    }
};
