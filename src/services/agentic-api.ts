import axios from 'axios';

let AGENT_API_URL = 'http://127.0.0.1:8001';

if (typeof window !== 'undefined') {
    AGENT_API_URL = `http://${window.location.hostname}:8001`;
}

const agentApi = axios.create({
    baseURL: AGENT_API_URL,
    timeout: 60000,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const analyzeTrade = async (symbol: string, action: string, context: string) => {
    try {
        const response = await agentApi.post('/api/trading/analyze', { symbol, action, context });
        return response.data;
    } catch (error) {
        console.error("Agentic Analyze Error:", error);
        return null;
    }
};

export const submitRlFeedback = async (symbol: string, actionTaken: string, outcomeReward: number, lesson: string = "") => {
    try {
        const response = await agentApi.post('/api/trading/rl-feedback', {
            symbol,
            action_taken: actionTaken,
            outcome_reward: outcomeReward,
            lesson
        });
        return response.data;
    } catch (error) {
        console.error("RL Feedback Error:", error);
        return null;
    }
};

export const getAgentLogs = async () => {
    try {
        const response = await agentApi.get('/api/logs');
        return response.data.logs || [];
    } catch (error) {
        console.error("Get Agent Logs Error:", error);
        return [];
    }
};
