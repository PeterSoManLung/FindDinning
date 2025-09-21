import { Router } from 'express';
import { EmotionController } from '../controllers/emotionController';

const router = Router();
const emotionController = new EmotionController();

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

export default router;