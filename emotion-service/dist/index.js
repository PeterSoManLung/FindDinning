"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const emotionRoutes_1 = __importDefault(require("./routes/emotionRoutes"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3005;
app.use(express_1.default.json());
// Routes
app.use('/api/emotion', emotionRoutes_1.default);
// Global health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'emotion-service',
        timestamp: new Date().toISOString()
    });
});
// Error handling middleware
app.use((err, req, res, next) => {
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
exports.default = app;
//# sourceMappingURL=index.js.map