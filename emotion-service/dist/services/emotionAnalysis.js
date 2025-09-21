"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmotionAnalysisService = void 0;
class EmotionAnalysisService {
    constructor() {
        this.emotionKeywords = new Map([
            ['happy', ['happy', 'joy', 'excited', 'cheerful', 'delighted', 'elated', 'celebrating', 'celebration']],
            ['sad', ['sad', 'down', 'depressed', 'blue', 'melancholy', 'upset', 'disappointed', 'heartbroken']],
            ['stressed', ['stressed', 'anxious', 'overwhelmed', 'pressure', 'tense', 'worried', 'frantic', 'busy']],
            ['angry', ['angry', 'mad', 'furious', 'irritated', 'annoyed', 'frustrated', 'rage', 'pissed']],
            ['tired', ['tired', 'exhausted', 'drained', 'weary', 'fatigued', 'sleepy', 'worn out']],
            ['lonely', ['lonely', 'alone', 'isolated', 'solitary', 'missing', 'longing', 'homesick']],
            ['romantic', ['romantic', 'love', 'date', 'intimate', 'valentine', 'anniversary', 'special someone']],
            ['nostalgic', ['nostalgic', 'memories', 'childhood', 'reminiscing', 'old times', 'traditional']],
            ['adventurous', ['adventurous', 'explore', 'try new', 'experiment', 'bold', 'daring', 'curious']],
            ['comfort', ['comfort', 'cozy', 'warm', 'safe', 'familiar', 'home', 'soothing']]
        ]);
        this.emotionIntensityWords = new Map([
            ['extremely', 5], ['very', 4], ['really', 4], ['quite', 3], ['somewhat', 2], ['slightly', 1],
            ['incredibly', 5], ['super', 4], ['pretty', 3], ['a bit', 2], ['mildly', 1]
        ]);
    }
    /**
     * Analyzes user input to determine emotional state
     */
    analyzeEmotion(request) {
        const detectedEmotions = this.detectEmotionsFromInput(request);
        const primaryEmotion = this.determinePrimaryEmotion(detectedEmotions);
        const intensity = this.calculateEmotionIntensity(request.textInput || '', detectedEmotions);
        const confidence = this.calculateConfidence(detectedEmotions, request);
        const cuisineRecommendations = this.mapEmotionToCuisines(primaryEmotion, intensity);
        const atmosphereRecommendations = this.mapEmotionToAtmosphere(primaryEmotion, request.context);
        return {
            primaryEmotion,
            secondaryEmotions: detectedEmotions.slice(1, 3).map(e => e.emotion),
            intensity,
            confidence,
            recommendedCuisines: cuisineRecommendations,
            recommendedAtmosphere: atmosphereRecommendations,
            reasoning: this.generateReasoning(primaryEmotion, intensity, request.context),
            analysisDate: new Date()
        };
    }
    /**
     * Detects emotions from text input and explicit emotional state
     */
    detectEmotionsFromInput(request) {
        const detectedEmotions = [];
        const input = (request.textInput || '').toLowerCase();
        // Check explicit emotional state first
        if (request.emotionalState) {
            const explicitEmotion = this.normalizeEmotionState(request.emotionalState);
            detectedEmotions.push({
                emotion: explicitEmotion,
                confidence: 0.9,
                triggers: ['explicit_input']
            });
        }
        // Analyze text input for emotional keywords
        for (const [emotion, keywords] of this.emotionKeywords) {
            const matchedKeywords = keywords.filter(keyword => input.includes(keyword));
            if (matchedKeywords.length > 0) {
                const confidence = Math.min(0.8, matchedKeywords.length * 0.3);
                detectedEmotions.push({
                    emotion,
                    confidence,
                    triggers: matchedKeywords
                });
            }
        }
        // Sort by confidence and remove duplicates
        return detectedEmotions
            .sort((a, b) => b.confidence - a.confidence)
            .filter((emotion, index, arr) => arr.findIndex(e => e.emotion === emotion.emotion) === index);
    }
    /**
     * Determines the primary emotion from detected emotions
     */
    determinePrimaryEmotion(detectedEmotions) {
        if (detectedEmotions.length === 0) {
            return 'neutral';
        }
        return detectedEmotions[0].emotion;
    }
    /**
     * Calculates emotion intensity based on text analysis
     */
    calculateEmotionIntensity(textInput, detectedEmotions) {
        if (!textInput)
            return 3; // Default moderate intensity
        const input = textInput.toLowerCase();
        let intensityScore = 3; // Base intensity
        // Check for intensity modifiers
        for (const [word, modifier] of this.emotionIntensityWords) {
            if (input.includes(word)) {
                intensityScore = Math.max(intensityScore, modifier);
            }
        }
        // Adjust based on punctuation and caps
        if (input.includes('!!!') || input.includes('!!!'))
            intensityScore = Math.min(5, intensityScore + 1);
        if (input.includes('!!'))
            intensityScore = Math.min(5, intensityScore + 0.5);
        if (textInput !== textInput.toLowerCase())
            intensityScore = Math.min(5, intensityScore + 0.5);
        // Consider number of detected emotions (more emotions = higher intensity)
        if (detectedEmotions.length > 2) {
            intensityScore = Math.min(5, intensityScore + 0.5);
        }
        return Math.round(intensityScore);
    }
    /**
     * Calculates confidence in emotion analysis
     */
    calculateConfidence(detectedEmotions, request) {
        if (detectedEmotions.length === 0)
            return 0.3; // Low confidence for neutral
        let confidence = detectedEmotions[0].confidence;
        // Boost confidence if we have explicit emotional state
        if (request.emotionalState) {
            confidence = Math.min(0.95, confidence + 0.2);
        }
        // Boost confidence if we have contextual information
        if (request.context && Object.keys(request.context).length > 0) {
            confidence = Math.min(0.95, confidence + 0.1);
        }
        // Reduce confidence if emotions are conflicting
        if (detectedEmotions.length > 1 && this.hasConflictingEmotions(detectedEmotions)) {
            confidence = Math.max(0.2, confidence - 0.2);
        }
        return Math.round(confidence * 100) / 100;
    }
    /**
     * Maps emotions to appropriate cuisines
     */
    mapEmotionToCuisines(emotion, intensity) {
        const cuisineMap = {
            'happy': ['Italian', 'Japanese', 'Mediterranean', 'Thai', 'Mexican'],
            'sad': ['Chinese', 'Comfort Food', 'Italian', 'Japanese', 'Korean'],
            'stressed': ['Japanese', 'Vietnamese', 'Healthy', 'Light Asian', 'Tea House'],
            'angry': ['Spicy Sichuan', 'Korean BBQ', 'Indian', 'Thai', 'Mexican'],
            'tired': ['Comfort Food', 'Chinese', 'Noodles', 'Congee', 'Simple Asian'],
            'lonely': ['Comfort Food', 'Familiar Cuisines', 'Chinese', 'Western', 'Cafe'],
            'romantic': ['French', 'Italian', 'Fine Dining', 'Japanese', 'Wine Bar'],
            'nostalgic': ['Traditional Chinese', 'Cantonese', 'Local Hong Kong', 'Cha Chaan Teng', 'Dim Sum'],
            'adventurous': ['Fusion', 'Exotic', 'Street Food', 'International', 'Experimental'],
            'comfort': ['Comfort Food', 'Chinese', 'Cantonese', 'Congee', 'Noodles'],
            'neutral': ['Chinese', 'Japanese', 'Italian', 'Casual Dining', 'Asian']
        };
        const baseCuisines = cuisineMap[emotion] || cuisineMap['neutral'];
        // Adjust recommendations based on intensity
        if (intensity >= 4) {
            // High intensity - more specific/extreme recommendations
            return baseCuisines.slice(0, 3);
        }
        else if (intensity <= 2) {
            // Low intensity - broader, safer recommendations
            return [...baseCuisines, ...cuisineMap['neutral']].slice(0, 5);
        }
        return baseCuisines;
    }
    /**
     * Maps emotions to appropriate dining atmosphere
     */
    mapEmotionToAtmosphere(emotion, context) {
        const atmosphereMap = {
            'happy': ['lively', 'social', 'bright', 'energetic', 'festive'],
            'sad': ['quiet', 'cozy', 'intimate', 'comforting', 'private'],
            'stressed': ['calm', 'peaceful', 'quiet', 'relaxing', 'zen'],
            'angry': ['private', 'quiet', 'spacious', 'minimal', 'calm'],
            'tired': ['comfortable', 'casual', 'relaxed', 'easy-going', 'low-key'],
            'lonely': ['welcoming', 'friendly', 'community', 'social', 'warm'],
            'romantic': ['intimate', 'romantic', 'dim lighting', 'private', 'elegant'],
            'nostalgic': ['traditional', 'authentic', 'family-style', 'heritage', 'classic'],
            'adventurous': ['unique', 'trendy', 'experimental', 'vibrant', 'eclectic'],
            'comfort': ['cozy', 'homey', 'familiar', 'warm', 'welcoming'],
            'neutral': ['casual', 'comfortable', 'friendly', 'relaxed', 'versatile']
        };
        let atmosphere = atmosphereMap[emotion] || atmosphereMap['neutral'];
        // Adjust based on social context
        if (context?.socialSetting) {
            switch (context.socialSetting) {
                case 'date':
                    atmosphere = ['romantic', 'intimate', 'quiet', 'elegant'];
                    break;
                case 'business':
                    atmosphere = ['professional', 'quiet', 'upscale', 'private'];
                    break;
                case 'family':
                    atmosphere = ['family-friendly', 'spacious', 'casual', 'welcoming'];
                    break;
                case 'friends':
                    atmosphere = ['social', 'lively', 'fun', 'energetic'];
                    break;
            }
        }
        return atmosphere;
    }
    /**
     * Generates human-readable reasoning for the emotion analysis
     */
    generateReasoning(emotion, intensity, context) {
        const intensityText = intensity >= 4 ? 'strongly' : intensity <= 2 ? 'mildly' : 'moderately';
        let reasoning = `You appear to be ${intensityText} feeling ${emotion}.`;
        if (context?.socialSetting) {
            reasoning += ` Since you're dining ${context.socialSetting === 'alone' ? 'alone' : `with ${context.socialSetting}`},`;
        }
        switch (emotion) {
            case 'happy':
                reasoning += ' I recommend vibrant cuisines and lively atmospheres to match your positive mood.';
                break;
            case 'sad':
                reasoning += ' I suggest comforting cuisines and cozy atmospheres to provide emotional support.';
                break;
            case 'stressed':
                reasoning += ' I recommend calming cuisines and peaceful atmospheres to help you relax.';
                break;
            case 'tired':
                reasoning += ' I suggest familiar, easy-to-enjoy cuisines in comfortable settings.';
                break;
            case 'romantic':
                reasoning += ' I recommend elegant cuisines and intimate atmospheres for your special occasion.';
                break;
            default:
                reasoning += ' I\'ve selected cuisines and atmospheres that complement your current state.';
        }
        return reasoning;
    }
    /**
     * Normalizes emotional state input to standard emotion categories
     */
    normalizeEmotionState(emotionalState) {
        const normalized = emotionalState.toLowerCase().trim();
        const emotionMappings = {
            'feeling down': 'sad',
            'feeling blue': 'sad',
            'celebrating': 'happy',
            'excited': 'happy',
            'overwhelmed': 'stressed',
            'anxious': 'stressed',
            'frustrated': 'angry',
            'mad': 'angry',
            'exhausted': 'tired',
            'drained': 'tired',
            'missing someone': 'lonely',
            'homesick': 'lonely',
            'in love': 'romantic',
            'date night': 'romantic',
            'remembering': 'nostalgic',
            'want to try something new': 'adventurous',
            'need comfort': 'comfort'
        };
        return emotionMappings[normalized] || normalized;
    }
    /**
     * Checks if detected emotions are conflicting
     */
    hasConflictingEmotions(emotions) {
        const conflictingPairs = [
            ['happy', 'sad'],
            ['excited', 'tired'],
            ['calm', 'stressed'],
            ['angry', 'happy']
        ];
        const emotionNames = emotions.map(e => e.emotion);
        return conflictingPairs.some(([emotion1, emotion2]) => emotionNames.includes(emotion1) && emotionNames.includes(emotion2));
    }
}
exports.EmotionAnalysisService = EmotionAnalysisService;
//# sourceMappingURL=emotionAnalysis.js.map