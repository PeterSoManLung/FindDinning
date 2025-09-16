import express from 'express';

const app = express();
const PORT = process.env.PORT || 3003;

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'recommendation-engine',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`Recommendation Engine running on port ${PORT}`);
});

export default app;