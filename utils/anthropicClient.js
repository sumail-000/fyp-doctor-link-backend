const Anthropic = require('@anthropic-ai/sdk').default || require('@anthropic-ai/sdk');

let client = null;

const getAnthropic = () => {
    if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY is not configured');
    }
    if (!client) {
        client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    }
    return client;
};

module.exports = { getAnthropic };
