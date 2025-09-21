"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const emotionController_1 = require("../controllers/emotionController");
const router = (0, express_1.Router)();
const emotionController = new emotionController_1.EmotionController();
// Emotion analysis endpoints
router.post('/analyze', emotionController.analyzeEmotion);
router.get('/mood-mapping', emotionController.getMoodMapping);
router.post('/context', emotionController.processEmotionContext);
// Mood-based recommendation endpoints
router.post('/mood-recommendations', emotionController.generateMoodRecommendations);
router.post('/comfort-food', emotionController.identifyComfortFood);
router.post('/celebratory-dining', emotionController.suggestCelebratoryDining);
router.post('/neutral-recommendations', emotionController.handleNeutralState);
// Mood mapping endpoints
router.get('/mappings', emotionController.getAllMoodMappings);
router.get('/contextual-recommendations/:context', emotionController.getContextualRecommendations);
// Health check
router.get('/health', emotionController.healthCheck);
exports.default = router;
//# sourceMappingURL=emotionRoutes.js.map