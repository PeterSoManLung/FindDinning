import app from './app';
import { API_GATEWAY_CONFIG } from './config/services';

const PORT = API_GATEWAY_CONFIG.port;

const server = app.listen(PORT, () => {
  console.log(`🚀 API Gateway running on port ${PORT}`);
  console.log(`📊 Health check available at http://localhost:${PORT}/health`);
  console.log(`🔗 API endpoints available at http://localhost:${PORT}/api`);
  console.log(`🛡️  Rate limiting: ${API_GATEWAY_CONFIG.rateLimitMax} requests per ${API_GATEWAY_CONFIG.rateLimitWindowMs / 1000 / 60} minutes`);
  console.log(`🌐 CORS origins: ${API_GATEWAY_CONFIG.corsOrigins.join(', ')}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Process terminated');
    process.exit(0);
  });
});

export default server;