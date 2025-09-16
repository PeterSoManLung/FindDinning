import express from 'express';

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

app.listen(PORT, () => {
  console.log(`Restaurant Service running on port ${PORT}`);
});

export default app;