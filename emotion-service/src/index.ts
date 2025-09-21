import express from 'express';
import emotionRoutes from './routes/emotionRoutes';

const app = express();
const PORT = process.env.PORT || 3005;

app.use(express.json());

// Routes
app.use('/api/emotion', emotionRoutes);

// Global health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'emotion-service',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      timestamp: new Date().toISOString()
    }
  });
});

app.listen(PORT, () => {
  console.log(`Emotion Service running on port ${PORT}`);
});

export default app;