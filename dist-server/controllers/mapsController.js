import { UnitSystem } from '@googlemaps/google-maps-services-js';
import { DEFAULT_MAPS_TIMEOUT_MS, getEnvNumber } from '../config/constants.js';
import { respondWithError } from '../utils/http.js';
const getTimeout = (config) => {
    if (Number.isFinite(config?.mapsTimeout)) {
        return config.mapsTimeout;
    }
    const envTimeout = getEnvNumber('MAPS_TIMEOUT', DEFAULT_MAPS_TIMEOUT_MS);
    return envTimeout || DEFAULT_MAPS_TIMEOUT_MS;
};
export const createMapsController = ({ googleMapsClient, config = {}, logger }) => {
    const scopedLogger = logger?.child ? logger.child({ scope: 'controller:maps' }) : logger;
    const emit = (level, message, meta) => scopedLogger?.[level]?.(message, meta);
    const ensureClient = (res) => {
        if (!googleMapsClient) {
            respondWithError(res, {
                status: 503,
                error: 'MapsClientUnavailable',
                message: 'Google Maps service is not configured',
                logger: scopedLogger,
                level: 'warn',
            });
            return false;
        }
        return true;
    };
    const handleDistance = async (req, res) => {
        if (!ensureClient(res))
            return;
        const { origin, destination, mode = 'driving' } = req.body;
        const timeoutMs = getTimeout(config);
        emit('info', 'maps.distanceMatrix', { origin, destination, mode, timeoutMs });
        try {
            const response = await googleMapsClient.distancematrix({
                params: {
                    origins: [origin],
                    destinations: [destination],
                    mode,
                    units: UnitSystem.metric,
                    key: process.env.GOOGLE_MAPS_API_KEY,
                },
                timeout: timeoutMs,
            });
            const data = response.data;
            const element = data?.rows?.[0]?.elements?.[0];
            if (!element) {
                return respondWithError(res, {
                    status: 502,
                    error: 'MapsResponseMalformed',
                    message: 'Distance matrix response missing data',
                    logger: scopedLogger,
                    level: 'warn',
                    details: { origin, destination, mode },
                });
            }
            if (element.status !== 'OK') {
                return respondWithError(res, {
                    status: 422,
                    error: element.status,
                    message: element.error_message || 'Failed to calculate distance', // error_message might not be in generic types
                    logger: scopedLogger,
                    level: 'warn',
                    details: { origin, destination, mode, elementStatus: element.status },
                });
            }
            const result = {
                distance: element.distance,
                duration: element.duration,
                origin: data.origin_addresses?.[0] ?? origin,
                destination: data.destination_addresses?.[0] ?? destination,
                mode,
            };
            if (mode === 'driving') {
                const totals = data.rows
                    .flatMap((row) => row.elements)
                    .reduce((acc, curr) => {
                    if (curr.status === 'OK') {
                        if (curr.distance?.value)
                            acc.totalDistance += curr.distance.value;
                        if (curr.duration?.value)
                            acc.totalDuration += curr.duration.value;
                    }
                    return acc;
                }, { totalDistance: 0, totalDuration: 0 });
                result.totalDistance = totals.totalDistance;
                result.totalDuration = totals.totalDuration;
            }
            res.json(result);
        }
        catch (error) {
            if (error?.response?.status === 403) {
                return respondWithError(res, {
                    status: 403,
                    error: 'Forbidden',
                    message: 'Ensure the Google Maps API key has Distance Matrix API enabled.',
                    logger: scopedLogger,
                    level: 'warn',
                    cause: error,
                    details: { origin, destination, mode },
                });
            }
            return respondWithError(res, {
                status: error?.response?.status || 500,
                error: 'FailedToCalculateDistance',
                message: error?.message || 'Failed to calculate distance',
                logger: scopedLogger,
                cause: error,
                details: { origin, destination, mode },
            });
        }
    };
    const handleAutocomplete = async (req, res) => {
        if (!ensureClient(res))
            return;
        const { input, sessiontoken, components } = req.query;
        if (!input) {
            return respondWithError(res, {
                status: 400,
                error: 'MissingInput',
                message: 'Input parameter is required',
                logger: scopedLogger,
                level: 'warn',
            });
        }
        emit('info', 'maps.autocomplete', { input, hasSessionToken: Boolean(sessiontoken) });
        try {
            const params = {
                input: input,
                key: process.env.GOOGLE_MAPS_API_KEY,
            };
            if (sessiontoken) {
                params.sessiontoken = sessiontoken;
            }
            if (components) {
                params.components = components;
            }
            const response = await googleMapsClient.placeAutocomplete({
                params,
                timeout: getTimeout(config),
            });
            res.json(response.data);
        }
        catch (error) {
            if (error?.response?.status === 403) {
                return respondWithError(res, {
                    status: 403,
                    error: 'Forbidden',
                    message: 'Ensure the Google Maps API key has Places API enabled.',
                    logger: scopedLogger,
                    level: 'warn',
                    cause: error,
                    details: { input },
                });
            }
            return respondWithError(res, {
                status: error?.response?.status || 500,
                error: 'AutocompleteFailed',
                message: error?.message || 'Failed to fetch autocomplete predictions',
                logger: scopedLogger,
                cause: error,
                details: { input },
            });
        }
    };
    const handlePlaceDetails = async (req, res) => {
        if (!ensureClient(res))
            return;
        const { place_id: placeId, sessiontoken } = req.query;
        if (!placeId) {
            return respondWithError(res, {
                status: 400,
                error: 'MissingPlaceId',
                message: 'place_id parameter is required',
                logger: scopedLogger,
                level: 'warn',
            });
        }
        emit('info', 'maps.placeDetails', { placeId });
        try {
            const params = {
                place_id: placeId,
                key: process.env.GOOGLE_MAPS_API_KEY,
            };
            if (sessiontoken) {
                params.sessiontoken = sessiontoken;
            }
            const response = await googleMapsClient.placeDetails({
                params,
                timeout: getTimeout(config),
            });
            res.json(response.data);
        }
        catch (error) {
            if (error?.response?.status === 403) {
                return respondWithError(res, {
                    status: 403,
                    error: 'Forbidden',
                    message: 'Ensure the Google Maps API key has Places API enabled.',
                    logger: scopedLogger,
                    level: 'warn',
                    cause: error,
                    details: { placeId },
                });
            }
            return respondWithError(res, {
                status: error?.response?.status || 500,
                error: 'PlaceDetailsFailed',
                message: error?.message || 'Failed to fetch place details',
                logger: scopedLogger,
                cause: error,
                details: { placeId },
            });
        }
    };
    return {
        handleDistance,
        handleAutocomplete,
        handlePlaceDetails,
    };
};
//# sourceMappingURL=mapsController.js.map