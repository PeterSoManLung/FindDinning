import express from 'express';
import restaurantRoutes from './routes/restaurantRoutes';
import metadataRoutes from './routes/metadataRoutes';

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'restaurant-service',
    timestamp: new Date().toISOString()
  });
});

// Restaurant routes
app.use('/api/restaurants', restaurantRoutes);

// Restaurant metadata routes
app.use('/api/restaurants', metadataRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found',
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] || 'unknown'
    }
  });
});

// Error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] || 'unknown'
    }
  });
});

app.listen(PORT, () => {
  console.log(`Restaurant Service running on port ${PORT}`);
});

export default app;