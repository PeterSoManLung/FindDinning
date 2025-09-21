"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextualMoodProcessingService = void 0;
class ContextualMoodProcessingService {
    constructor() {
        this.contextKeywords = new Map([
            ['work_stress', ['work', 'office', 'meeting', 'deadline', 'boss', 'project', 'overtime', 'presentation']],
            ['relationship', ['boyfriend', 'girlfriend', 'partner', 'date', 'anniversary', 'breakup', 'fight', 'love']],
            ['family', ['family', 'parents', 'mom', 'dad', 'siblings', 'kids', 'children', 'relatives']],
            ['health', ['sick', 'tired', 'headache', 'pain', 'doctor', 'medicine', 'recovery', 'wellness']],
            ['weather', ['rain', 'sunny', 'cold', 'hot', 'storm', 'cloudy', 'humid', 'weather']],
            ['social', ['friends', 'party', 'celebration', 'gathering', 'social', 'group', 'crowd']],
            ['achievement', ['promotion', 'success', 'win', 'achievement', 'accomplished', 'proud', 'victory']],
            ['loss', ['loss', 'death', 'goodbye', 'ended', 'finished', 'over', 'failed', 'disappointed']],
            ['travel', ['travel', 'trip', 'vacation', 'airport', 'hotel', 'tourist', 'exploring', 'sightseeing']],
            ['financial', ['money', 'expensive', 'cheap', 'budget', 'salary', 'pay', 'cost', 'afford']]
        ]);
        this.timeContexts = new Map([
            ['morning', [
                    { factor: 'energy_boost', adjustment: 'increase', weight: 0.3, reasoning: 'Morning dining should provide energy for the day' },
                    { factor: 'light_options', adjustment: 'increase', weight: 0.2, reasoning: 'Lighter options preferred in morning' }
                ]],
            ['lunch', [
                    { factor: 'quick_service', adjustment: 'increase', weight: 0.4, reasoning: 'Lunch often requires quick service for busy schedules' },
                    { factor: 'balanced_nutrition', adjustment: 'increase', weight: 0.3, reasoning: 'Midday meal should be nutritionally balanced' }
                ]],
            ['afternoon', [
                    { factor: 'light_snacks', adjustment: 'increase', weight: 0.3, reasoning: 'Afternoon dining often involves lighter options' },
                    { factor: 'social_atmosphere', adjustment: 'increase', weight: 0.2, reasoning: 'Afternoon dining can be more social' }
                ]],
            ['dinner', [
                    { factor: 'substantial_meal', adjustment: 'increase', weight: 0.4, reasoning: 'Dinner is typically the main meal of the day' },
                    { factor: 'relaxed_atmosphere', adjustment: 'increase', weight: 0.3, reasoning: 'Evening dining allows for more relaxed experience' }
                ]],
            ['late_night', [
                    { factor: 'comfort_food', adjustment: 'increase', weight: 0.4, reasoning: 'Late night dining often seeks comfort and satisfaction' },
                    { factor: 'casual_atmosphere', adjustment: 'increase', weight: 0.3, reasoning: 'Late night dining is typically more casual' }
                ]]
        ]);
    }
    /**
     * Processes contextual information to enhance emotion analysis
     */
    processEmotionContext(request) {
        const detectedEmotions = this.extractEmotionsFromText(request.textInput);
        const contextualFactors = this.identifyContextualFactors(request);
        const recommendationAdjustments = this.generateRecommendationAdjustments(detectedEmotions, contextualFactors, request.additionalContext);
        const confidence = this.calculateContextualConfidence(detectedEmotions, contextualFactors);
        return {
            detectedEmotions,
            contextualFactors,
            recommendationAdjustments,
            confidence
        };
    }
    /**
     * Extracts emotions from text input using natural language processing
     */
    extractEmotionsFromText(textInput) {
        const emotions = [];
        const input = textInput.toLowerCase();
        // Emotion detection patterns
        const emotionPatterns = {
            'excited': { keywords: ['excited', 'thrilled', 'pumped', 'can\'t wait', 'amazing'], intensity: 4 },
            'happy': { keywords: ['happy', 'good', 'great', 'wonderful', 'fantastic', 'awesome'], intensity: 3 },
            'sad': { keywords: ['sad', 'down', 'depressed', 'upset', 'disappointed', 'blue'], intensity: 3 },
            'angry': { keywords: ['angry', 'mad', 'furious', 'annoyed', 'frustrated', 'pissed'], intensity: 4 },
            'stressed': { keywords: ['stressed', 'overwhelmed', 'pressure', 'anxious', 'worried'], intensity: 3 },
            'tired': { keywords: ['tired', 'exhausted', 'drained', 'weary', 'sleepy'], intensity: 3 },
            'lonely': { keywords: ['lonely', 'alone', 'isolated', 'missing', 'empty'], intensity: 3 },
            'confused': { keywords: ['confused', 'lost', 'uncertain', 'don\'t know', 'unsure'], intensity: 2 },
            'grateful': { keywords: ['grateful', 'thankful', 'blessed', 'appreciate'], intensity: 3 },
            'nostalgic': { keywords: ['remember', 'miss', 'used to', 'back then', 'childhood'], intensity: 2 }
        };
        for (const [emotion, pattern] of Object.entries(emotionPatterns)) {
            const matchedKeywords = pattern.keywords.filter(keyword => input.includes(keyword));
            if (matchedKeywords.length > 0) {
                emotions.push({
                    emotion,
                    confidence: Math.min(0.9, matchedKeywords.length * 0.3 + 0.3),
                    triggers: matchedKeywords
                });
            }
        }
        // Detect emotional intensity modifiers
        const intensityModifiers = ['very', 'extremely', 'really', 'super', 'incredibly'];
        const hasIntensityModifier = intensityModifiers.some(modifier => input.includes(modifier));
        if (hasIntensityModifier) {
            emotions.forEach(emotion => {
                emotion.confidence = Math.min(1, emotion.confidence + 0.2);
            });
        }
        return emotions.sort((a, b) => b.confidence - a.confidence);
    }
    /**
     * Identifies contextual factors from the input and additional context
     */
    identifyContextualFactors(request) {
        const factors = [];
        const input = request.textInput.toLowerCase();
        // Check for contextual keywords
        for (const [context, keywords] of this.contextKeywords) {
            if (keywords.some(keyword => input.includes(keyword))) {
                factors.push(context);
            }
        }
        // Add time-based context
        if (request.additionalContext?.timeOfDay) {
            factors.push(`time_${request.additionalContext.timeOfDay}`);
        }
        // Add location-based context
        if (request.additionalContext?.location) {
            factors.push(`location_${request.additionalContext.location.toLowerCase()}`);
        }
        // Add recent events context
        if (request.additionalContext?.recentEvents) {
            request.additionalContext.recentEvents.forEach(event => {
                const eventLower = event.toLowerCase();
                for (const [context, keywords] of this.contextKeywords) {
                    if (keywords.some(keyword => eventLower.includes(keyword))) {
                        factors.push(`recent_${context}`);
                    }
                }
            });
        }
        return [...new Set(factors)]; // Remove duplicates
    }
    /**
     * Generates recommendation adjustments based on emotions and context
     */
    generateRecommendationAdjustments(emotions, contextualFactors, additionalContext) {
        const adjustments = [];
        // Emotion-based adjustments
        emotions.forEach(emotion => {
            switch (emotion.emotion) {
                case 'stressed':
                    adjustments.push({
                        factor: 'calm_atmosphere',
                        adjustment: 'increase',
                        weight: emotion.confidence * 0.8,
                        reasoning: 'Stressed state requires calming dining environment'
                    });
                    adjustments.push({
                        factor: 'spicy_food',
                        adjustment: 'decrease',
                        weight: emotion.confidence * 0.6,
                        reasoning: 'Avoid overstimulating spicy foods when stressed'
                    });
                    break;
                case 'sad':
                    adjustments.push({
                        factor: 'comfort_food',
                        adjustment: 'increase',
                        weight: emotion.confidence * 0.9,
                        reasoning: 'Comfort food provides emotional support when sad'
                    });
                    adjustments.push({
                        factor: 'cozy_atmosphere',
                        adjustment: 'increase',
                        weight: emotion.confidence * 0.7,
                        reasoning: 'Cozy environment helps when feeling down'
                    });
                    break;
                case 'excited':
                    adjustments.push({
                        factor: 'adventurous_cuisine',
                        adjustment: 'increase',
                        weight: emotion.confidence * 0.8,
                        reasoning: 'Excitement pairs well with adventurous dining experiences'
                    });
                    adjustments.push({
                        factor: 'social_atmosphere',
                        adjustment: 'increase',
                        weight: emotion.confidence * 0.7,
                        reasoning: 'Excited mood benefits from social dining environments'
                    });
                    break;
                case 'tired':
                    adjustments.push({
                        factor: 'simple_food',
                        adjustment: 'increase',
                        weight: emotion.confidence * 0.8,
                        reasoning: 'Simple, easy-to-eat food when tired'
                    });
                    adjustments.push({
                        factor: 'quick_service',
                        adjustment: 'increase',
                        weight: emotion.confidence * 0.6,
                        reasoning: 'Quick service preferred when energy is low'
                    });
                    break;
                case 'lonely':
                    adjustments.push({
                        factor: 'social_atmosphere',
                        adjustment: 'increase',
                        weight: emotion.confidence * 0.8,
                        reasoning: 'Social environments help combat loneliness'
                    });
                    adjustments.push({
                        factor: 'comfort_food',
                        adjustment: 'increase',
                        weight: emotion.confidence * 0.6,
                        reasoning: 'Comfort food provides emotional warmth when lonely'
                    });
                    break;
            }
        });
        // Context-based adjustments
        contextualFactors.forEach(factor => {
            if (factor.startsWith('time_')) {
                const timeOfDay = factor.replace('time_', '');
                const timeAdjustments = this.timeContexts.get(timeOfDay);
                if (timeAdjustments) {
                    adjustments.push(...timeAdjustments);
                }
            }
            switch (factor) {
                case 'work_stress':
                    adjustments.push({
                        factor: 'quick_service',
                        adjustment: 'increase',
                        weight: 0.7,
                        reasoning: 'Work stress requires efficient dining experience'
                    });
                    adjustments.push({
                        factor: 'healthy_options',
                        adjustment: 'increase',
                        weight: 0.5,
                        reasoning: 'Healthy food helps manage work stress'
                    });
                    break;
                case 'relationship':
                    adjustments.push({
                        factor: 'romantic_atmosphere',
                        adjustment: 'increase',
                        weight: 0.8,
                        reasoning: 'Relationship context suggests romantic dining preference'
                    });
                    break;
                case 'family':
                    adjustments.push({
                        factor: 'family_friendly',
                        adjustment: 'increase',
                        weight: 0.9,
                        reasoning: 'Family context requires family-friendly environment'
                    });
                    adjustments.push({
                        factor: 'sharing_dishes',
                        adjustment: 'increase',
                        weight: 0.6,
                        reasoning: 'Family dining often involves sharing'
                    });
                    break;
                case 'weather':
                    // Weather-specific adjustments would be added here
                    // This is a placeholder for weather-based logic
                    break;
                case 'financial':
                    adjustments.push({
                        factor: 'budget_friendly',
                        adjustment: 'increase',
                        weight: 0.8,
                        reasoning: 'Financial concerns suggest budget-conscious dining'
                    });
                    break;
            }
        });
        return adjustments;
    }
    /**
     * Calculates confidence in contextual analysis
     */
    calculateContextualConfidence(emotions, contextualFactors) {
        let confidence = 0.5; // Base confidence
        // Boost confidence based on number of detected emotions
        if (emotions.length > 0) {
            confidence += emotions[0].confidence * 0.3;
            if (emotions.length > 1) {
                confidence += 0.1;
            }
        }
        // Boost confidence based on contextual factors
        confidence += Math.min(0.3, contextualFactors.length * 0.1);
        // Reduce confidence if emotions are conflicting
        if (emotions.length > 1) {
            const conflictingEmotions = this.hasConflictingEmotions(emotions);
            if (conflictingEmotions) {
                confidence -= 0.2;
            }
        }
        return Math.max(0.1, Math.min(1, confidence));
    }
    /**
     * Checks if detected emotions are conflicting
     */
    hasConflictingEmotions(emotions) {
        const conflictingPairs = [
            ['happy', 'sad'],
            ['excited', 'tired'],
            ['calm', 'stressed'],
            ['angry', 'grateful']
        ];
        const emotionNames = emotions.map(e => e.emotion);
        return conflictingPairs.some(([emotion1, emotion2]) => emotionNames.includes(emotion1) && emotionNames.includes(emotion2));
    }
    /**
     * Gets contextual recommendations for specific situations
     */
    getContextualRecommendations(context) {
        const contextRecommendations = {
            'first_date': [
                { factor: 'quiet_atmosphere', adjustment: 'increase', weight: 0.9, reasoning: 'First dates benefit from quiet environments for conversation' },
                { factor: 'moderate_pricing', adjustment: 'increase', weight: 0.7, reasoning: 'Moderate pricing appropriate for first dates' },
                { factor: 'familiar_cuisine', adjustment: 'increase', weight: 0.6, reasoning: 'Familiar cuisine reduces risk on first dates' }
            ],
            'business_lunch': [
                { factor: 'professional_atmosphere', adjustment: 'increase', weight: 0.9, reasoning: 'Business context requires professional environment' },
                { factor: 'quick_service', adjustment: 'increase', weight: 0.8, reasoning: 'Business lunches often have time constraints' },
                { factor: 'quiet_atmosphere', adjustment: 'increase', weight: 0.7, reasoning: 'Need quiet environment for business discussions' }
            ],
            'celebration': [
                { factor: 'festive_atmosphere', adjustment: 'increase', weight: 0.9, reasoning: 'Celebrations call for festive environments' },
                { factor: 'special_cuisine', adjustment: 'increase', weight: 0.8, reasoning: 'Special occasions warrant special cuisine' },
                { factor: 'higher_price_range', adjustment: 'increase', weight: 0.6, reasoning: 'Willing to spend more for celebrations' }
            ],
            'comfort_seeking': [
                { factor: 'comfort_food', adjustment: 'increase', weight: 0.9, reasoning: 'Comfort seeking requires familiar, soothing food' },
                { factor: 'cozy_atmosphere', adjustment: 'increase', weight: 0.8, reasoning: 'Cozy environment provides emotional comfort' },
                { factor: 'affordable_pricing', adjustment: 'increase', weight: 0.6, reasoning: 'Comfort food often associated with affordable options' }
            ]
        };
        return contextRecommendations[context] || [];
    }
}
exports.ContextualMoodProcessingService = ContextualMoodProcessingService;
//# sourceMappingURL=contextualMoodProcessing.js.map