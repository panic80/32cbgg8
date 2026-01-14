import axios from 'axios';
import { DEFAULT_INGEST_TIMEOUT_MS, DEFAULT_MAX_RETRIES, DEFAULT_RETRY_DELAY_MS, RAG_SERVICE_URL, } from '../config/constants.js';
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export const createRagService = ({ httpClient = axios, getRagAuthHeaders, config = {}, logger, }) => {
    const ragServiceUrl = config.ragServiceUrl || RAG_SERVICE_URL;
    const ingestTimeout = config.ingestTimeout ?? DEFAULT_INGEST_TIMEOUT_MS;
    const maxRetries = config.ingestMaxRetries ?? config.maxRetries ?? DEFAULT_MAX_RETRIES;
    const retryDelayMs = config.ingestRetryDelay ?? config.retryDelay ?? DEFAULT_RETRY_DELAY_MS;
    const scopedLogger = logger?.child ? logger.child({ scope: 'service:rag' }) : logger;
    const emit = (level, message, meta) => {
        const loggerFunc = scopedLogger[level];
        if (typeof loggerFunc === 'function') {
            loggerFunc(message, meta);
        }
    };
    const normalizeHttpClient = () => {
        if (httpClient && (typeof httpClient.post === 'function' && typeof httpClient.get === 'function')) {
            return httpClient;
        }
        return axios;
    };
    const client = normalizeHttpClient();
    const prepareHeaders = () => ({
        'Content-Type': 'application/json',
        ...(typeof getRagAuthHeaders === 'function' ? getRagAuthHeaders() : {}),
    });
    const postWithRetry = async (endpoint, payload) => {
        let lastError;
        for (let attempt = 1; attempt <= Math.max(1, maxRetries); attempt += 1) {
            try {
                const response = await client.post(endpoint, payload, {
                    timeout: ingestTimeout || DEFAULT_INGEST_TIMEOUT_MS,
                    headers: prepareHeaders(),
                });
                return response;
            }
            catch (error) {
                const err = error;
                lastError = err;
                const status = err?.response?.status;
                emit('warn', 'rag_service.postFailed', {
                    endpoint,
                    attempt,
                    status,
                    error: err?.message,
                });
                if (status && status < 500) {
                    break;
                }
                if (attempt < Math.max(1, maxRetries)) {
                    await wait(retryDelayMs * attempt);
                }
            }
        }
        throw lastError;
    };
    const ingest = async ({ url, content, type, metadata, forceRefresh }) => {
        return postWithRetry(`${ragServiceUrl}/api/v1/ingest`, {
            url,
            content,
            type,
            metadata: metadata || {},
            force_refresh: Boolean(forceRefresh),
        });
    };
    const ingestCanadaCa = async () => {
        return postWithRetry(`${ragServiceUrl}/api/v1/ingest/canada-ca`, {});
    };
    const getProgressStream = async (url) => {
        return client.get(`${ragServiceUrl}/api/v1/ingest/progress`, {
            params: { url },
            responseType: 'stream',
            headers: {
                Accept: 'text/event-stream',
                'Cache-Control': 'no-cache',
                ...prepareHeaders(),
            },
            timeout: ingestTimeout || DEFAULT_INGEST_TIMEOUT_MS,
        });
    };
    return {
        ingest,
        ingestCanadaCa,
        getProgressStream,
    };
};
//# sourceMappingURL=RagService.js.map