import performanceService from '../services/performanceService.js';

export const createPerformanceHandler = ({ service = performanceService } = {}) => {
  return async (req, res) => {
    console.log('Handling /api/admin/performance request');
    try {
      const forceRefresh =
        typeof req.query.forceRefresh === 'string'
          ? req.query.forceRefresh.toLowerCase() === 'true'
          : false;

      const metrics = await service.fetchMetrics({ forceRefresh });
      res.json(metrics);
    } catch (error) {
      console.error('Failed to retrieve performance metrics', error.message);
      res.status(502).json({
        error: 'MetricsUnavailable',
        message: 'Unable to retrieve RAG performance metrics at this time.',
      });
    }
  };
};

export default createPerformanceHandler;
