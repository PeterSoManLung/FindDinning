import express from 'express';
import { DataIntegrationFramework } from './services/DataIntegrationFramework';
import { createLogger } from './utils/logger';
import syncRoutes from './routes/syncRoutes';
import platformExtractionRoutes from './routes/platformExtractionRoutes';
import productionSyncRoutes from './routes/productionSyncRoutes';

const app = express();
const port = process.env.PORT || 3006;
const logger = createLogger('DataIntegrationService');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize data integration framework
const integrationFramework = new DataIntegrationFramework();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'data-integration-service',
    timestamp: new Date().toISOString()
  });
});

// Mount sync routes
app.use('/api/sync', syncRoutes);

// Mount platform extraction routes
app.use('/api/platform-extraction', platformExtractionRoutes);

// Mount production sync routes
app.use('/api/production-sync', productionSyncRoutes);

// Get integration statistics
app.get('/api/integration/stats', async (req, res) => {
  try {
    const stats = await integrationFramework.getIntegrationStats();
    res.json(stats);
  } catch (error) {
    logger.error('Failed to get integration stats:', error);
    res.status(500).json({ error: 'Failed to get integration stats' });
  }
});

// Check extractor health
app.get('/api/integration/health', async (req, res) => {
  try {
    const healthResults = await integrationFramework.checkExtractorHealth();
    res.json(healthResults);
  } catch (error) {
    logger.error('Failed to check extractor health:', error);
    res.status(500).json({ error: 'Failed to check extractor health' });
  }
});

// Run full integration
app.post('/api/integration/run', async (req, res) => {
  try {
    logger.info('Starting full data integration');
    const result = await integrationFramework.runFullIntegration(req.body);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    logger.error('Integration failed:', error);
    res.status(500).json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Run integration for specific sources
app.post('/api/integration/run/:sources', async (req, res) => {
  try {
    const sources = req.params.sources.split(',');
    logger.info(`Starting integration for sources: ${sources.join(', ')}`);
    
    const result = await integrationFramework.runIntegrationForSources(sources, req.body);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    logger.error('Integration failed:', error);
    res.status(500).json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get registered extractors
app.get('/api/integration/extractors', (req, res) => {
  const extractors = integrationFramework.getRegisteredExtractors();
  res.json({ extractors });
});

// Export data endpoint for backup service
app.get('/api/data/export', (req, res) => {
  // In production, this would export actual data from the database
  // For now, return simulated data structure
  res.json({
    restaurants: [],
    reviews: [],
    users: [],
    metadata: {
      exportTime: new Date().toISOString(),
      totalRecords: 0,
      version: process.env.SERVICE_VERSION || '1.0.0'
    }
  });
});

// Error handling middleware
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: error.message 
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  await integrationFramework.cleanup();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully');
  await integrationFramework.cleanup();
  process.exit(0);
});

// Start server
app.listen(port, () => {
  logger.info(`Data Integration Service listening on port ${port}`);
});

export { app, integrationFramework };