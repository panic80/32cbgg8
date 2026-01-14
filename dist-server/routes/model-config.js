import express from 'express';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { getLogger } from '../services/logger.js';
import { respondWithError } from '../utils/http.js';
const logger = getLogger('routes:model-config');
// Default configuration path - can be overridden via env var
const getConfigPath = () => {
    const customPath = process.env.MODEL_CONFIG_PATH;
    if (customPath)
        return customPath;
    // Default to data directory in project
    // In production (Docker), we use 'dist-server/data'
    // In development, we use 'server/data'
    let dataDir = path.join(process.cwd(), 'server', 'data');
    const distDataDir = path.join(process.cwd(), 'dist-server', 'data');
    if (process.env.NODE_ENV === 'production' && existsSync(path.join(process.cwd(), 'dist-server'))) {
        dataDir = distDataDir;
    }
    if (!existsSync(dataDir)) {
        try {
            mkdirSync(dataDir, { recursive: true });
        }
        catch (error) {
            // If we can't create it (e.g. permission error in Docker root), fall back to dist-server if it exists
            if (dataDir !== distDataDir && existsSync(distDataDir)) {
                dataDir = distDataDir;
            }
            else {
                throw error;
            }
        }
    }
    return path.join(dataDir, 'model-config.json');
};
// Default model configuration
const DEFAULT_CONFIG = {
    fastModel: { provider: 'openai', model: 'gpt-4.1-mini' },
    smartModel: { provider: 'openai', model: 'gpt-5-mini' },
    operationModels: {
        responseGeneration: 'smart',
        hydeExpansion: 'fast',
        queryRewriting: 'fast',
        followUpGeneration: 'fast',
    },
};
/**
 * Read model config from file or return defaults
 */
const readModelConfig = () => {
    const configPath = getConfigPath();
    try {
        if (existsSync(configPath)) {
            const content = readFileSync(configPath, 'utf8');
            const config = JSON.parse(content);
            // Merge with defaults to ensure all fields exist
            return {
                ...DEFAULT_CONFIG,
                ...config,
                operationModels: {
                    ...DEFAULT_CONFIG.operationModels,
                    ...(config.operationModels || {}),
                },
            };
        }
    }
    catch (error) {
        logger.warn('Failed to read model config, using defaults', error);
    }
    return DEFAULT_CONFIG;
};
/**
 * Write model config to file
 */
const writeModelConfig = (config) => {
    const configPath = getConfigPath();
    const fullConfig = {
        ...config,
        updatedAt: new Date().toISOString(),
    };
    writeFileSync(configPath, JSON.stringify(fullConfig, null, 2));
    logger.info('Model configuration saved', { path: configPath });
    return fullConfig;
};
export function createModelConfigRoutes({ rateLimiter, requireAdminAuth, }) {
    const router = express.Router();
    const adminMiddleware = typeof requireAdminAuth === 'function'
        ? requireAdminAuth
        : (req, res, next) => next();
    logger.info('Registering model config routes');
    // Get current model configuration
    router.get('/api/admin/model-config', rateLimiter, (req, res) => {
        logger.debug('Handling GET /api/admin/model-config');
        try {
            const config = readModelConfig();
            return res.json(config);
        }
        catch (error) {
            return respondWithError(res, {
                status: 500,
                error: 'ModelConfigReadError',
                message: 'Failed to read model configuration',
                logger,
                cause: error,
            });
        }
    });
    // Update model configuration (requires admin auth)
    router.post('/api/admin/model-config', adminMiddleware, rateLimiter, (req, res) => {
        logger.debug('Handling POST /api/admin/model-config');
        try {
            const { fastModel, smartModel, operationModels } = req.body;
            // Validate required fields
            if (!fastModel || !fastModel.provider || !fastModel.model) {
                return respondWithError(res, {
                    status: 400,
                    error: 'ValidationError',
                    message: 'fastModel with provider and model is required',
                    logger,
                });
            }
            if (!smartModel || !smartModel.provider || !smartModel.model) {
                return respondWithError(res, {
                    status: 400,
                    error: 'ValidationError',
                    message: 'smartModel with provider and model is required',
                    logger,
                });
            }
            // Validate providers
            const validProviders = ['openai', 'google', 'anthropic', 'openrouter'];
            if (!validProviders.includes(fastModel.provider)) {
                return respondWithError(res, {
                    status: 400,
                    error: 'ValidationError',
                    message: `Invalid fast model provider: ${fastModel.provider}`,
                    logger,
                });
            }
            if (!validProviders.includes(smartModel.provider)) {
                return respondWithError(res, {
                    status: 400,
                    error: 'ValidationError',
                    message: `Invalid smart model provider: ${smartModel.provider}`,
                    logger,
                });
            }
            // Validate operation models
            const validDesignations = ['fast', 'smart'];
            if (operationModels) {
                for (const [op, designation] of Object.entries(operationModels)) {
                    if (!validDesignations.includes(designation)) {
                        return respondWithError(res, {
                            status: 400,
                            error: 'ValidationError',
                            message: `Invalid designation for ${op}: ${designation}`,
                            logger,
                        });
                    }
                }
            }
            const config = writeModelConfig({
                fastModel,
                smartModel,
                operationModels: operationModels || DEFAULT_CONFIG.operationModels,
            });
            logger.info('Model configuration updated', {
                fastModel: `${fastModel.provider}/${fastModel.model}`,
                smartModel: `${smartModel.provider}/${smartModel.model}`,
            });
            return res.json({ success: true, config });
        }
        catch (error) {
            return respondWithError(res, {
                status: 500,
                error: 'ModelConfigWriteError',
                message: 'Failed to save model configuration',
                logger,
                cause: error,
            });
        }
    });
    // Reset to default configuration
    router.delete('/api/admin/model-config', adminMiddleware, rateLimiter, (req, res) => {
        logger.debug('Handling DELETE /api/admin/model-config');
        try {
            const config = writeModelConfig(DEFAULT_CONFIG);
            logger.info('Model configuration reset to defaults');
            return res.json({ success: true, config });
        }
        catch (error) {
            return respondWithError(res, {
                status: 500,
                error: 'ModelConfigResetError',
                message: 'Failed to reset model configuration',
                logger,
                cause: error,
            });
        }
    });
    return router;
}
export default createModelConfigRoutes;
//# sourceMappingURL=model-config.js.map