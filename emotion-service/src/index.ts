import express from 'express';

const app = express();
const PORT = process.env.PORT || 3005;

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'emotion-service',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`Emotion Service running on port ${PORT}`);
});

export default app;