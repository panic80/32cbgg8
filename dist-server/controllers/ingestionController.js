import { respondWithError } from '../utils/http.js';
export const createIngestionController = ({ validateIngestionUrl, buildSseCorsHeaders, setSseHeaders, ragService, logger, }) => {
    const scopedLogger = logger?.child ? logger.child({ scope: 'controller:ingestion' }) : logger;
    const emit = (level, message, meta) => {
        const loggerFunc = scopedLogger[level];
        if (typeof loggerFunc === 'function') {
            loggerFunc(message, meta);
        }
    };
    const sanitizeUrl = async (rawUrl, _contextMessage) => {
        if (!rawUrl)
            return null;
        if (!validateIngestionUrl)
            return rawUrl;
        try {
            const sanitized = await validateIngestionUrl(rawUrl);
            emit('debug', 'ingestion.urlValidated', { rawUrl, sanitized });
            return sanitized;
        }
        catch (error) {
            const err = error;
            emit('warn', 'ingestion.urlRejected', { rawUrl, error: err.message });
            throw error;
        }
    };
    const handleIngest = async (req, res) => {
        const { url, content, type = 'web', metadata = {}, forceRefresh = false } = req.body ?? {};
        if (!url && !content) {
            return respondWithError(res, {
                status: 400,
                error: 'InvalidIngestionRequest',
                message: 'Either URL or content must be provided.',
                logger: scopedLogger,
                level: 'warn',
            });
        }
        let sanitizedUrl = null;
        if (url) {
            try {
                sanitizedUrl = await sanitizeUrl(url, 'ingest');
            }
            catch (validationError) {
                const err = validationError;
                return respondWithError(res, {
                    status: err.statusCode || 400,
                    error: 'InvalidIngestionUrl',
                    message: err.message,
                    logger: scopedLogger,
                    level: 'warn',
                });
            }
        }
        try {
            const response = await ragService.ingest({
                url: sanitizedUrl,
                content,
                type,
                metadata,
                forceRefresh,
            });
            emit('info', 'ingestion.forwardSuccess', {
                hasUrl: Boolean(sanitizedUrl),
                hasContent: Boolean(content),
                type,
            });
            return res.json(response.data);
        }
        catch (error) {
            const err = error;
            emit('error', 'ingestion.forwardFailed', {
                error: err.message,
                status: err.response?.status,
            });
            if (err.response) {
                return res.status(err.response.status).json(err.response.data);
            }
            return respondWithError(res, {
                status: 500,
                error: 'IngestionUpstreamFailure',
                message: 'Failed to ingest document.',
                logger: scopedLogger,
                cause: err,
            });
        }
    };
    const handleCanadaCaIngest = async (_req, res) => {
        try {
            const response = await ragService.ingestCanadaCa();
            emit('info', 'ingestion.canadaCaSuccess');
            return res.json(response.data);
        }
        catch (error) {
            const err = error;
            emit('error', 'ingestion.canadaCaFailed', {
                error: err.message,
                status: err.response?.status,
            });
            if (err.response) {
                return res.status(err.response.status).json(err.response.data);
            }
            return respondWithError(res, {
                status: 500,
                error: 'CanadaCaIngestionFailure',
                message: 'Failed to ingest Canada.ca content.',
                logger: scopedLogger,
                cause: err,
            });
        }
    };
    const handleProgress = async (req, res) => {
        const { url } = req.query;
        const targetUrl = Array.isArray(url) ? url[0] : url;
        if (!targetUrl) {
            return respondWithError(res, {
                status: 400,
                error: 'MissingUrlParameter',
                message: 'URL parameter required',
                logger: scopedLogger,
                level: 'warn',
            });
        }
        let sanitizedTargetUrl;
        try {
            sanitizedTargetUrl = await sanitizeUrl(targetUrl, 'progress');
        }
        catch (validationError) {
            const err = validationError;
            return respondWithError(res, {
                status: err.statusCode || 400,
                error: 'InvalidIngestionUrl',
                message: err.message,
                logger: scopedLogger,
                level: 'warn',
            });
        }
        try {
            // sanitizedTargetUrl is guaranteed string here due to sanitizeUrl logic on valid input
            const response = await ragService.getProgressStream(sanitizedTargetUrl);
            const corsHeaders = buildSseCorsHeaders?.(req.headers.origin) || {};
            setSseHeaders?.(res, {
                ...corsHeaders,
                'X-Accel-Buffering': 'no',
            });
            emit('info', 'ingestion.progressProxy', { url: sanitizedTargetUrl });
            response.data.pipe(res);
            req.on('close', () => {
                response.data.destroy();
            });
        }
        catch (error) {
            const err = error;
            emit('error', 'ingestion.progressFailed', {
                error: err.message,
                status: err.response?.status,
            });
            return respondWithError(res, {
                status: 500,
                error: 'ProgressStreamError',
                message: 'Failed to connect to progress stream',
                logger: scopedLogger,
                cause: err,
            });
        }
    };
    return {
        handleIngest,
        handleCanadaCaIngest,
        handleProgress,
    };
};
//# sourceMappingURL=ingestionController.js.map