import Joi from 'joi';
import { ReviewCreateRequest, ReviewUpdateRequest, NegativeFeedbackCategory } from '../../../shared/src/types/review.types';
import { ReviewSource } from '../../../shared/src/types/restaurant.types';

// Joi schemas for validation
export const reviewCreateSchema = Joi.object({
  restaurantId: Joi.string().required().min(1),
  rating: Joi.number().integer().min(1).max(5).required(),
  content: Joi.string().min(10).max(2000).required(),
  photos: Joi.array().items(Joi.string().uri()).optional(),
  visitDate: Joi.date().max('now').required().messages({
    'date.max': 'Visit date cannot be in the future'
  })
});

export const reviewUpdateSchema = Joi.object({
  rating: Joi.number().integer().min(1).max(5).optional(),
  content: Joi.string().min(10).max(2000).optional(),
  photos: Joi.array().items(Joi.string().uri()).optional()
});

export const reviewAnalysisSchema = Joi.object({
  restaurantId: Joi.string().required(),
  timeframe: Joi.string().valid('week', 'month', 'quarter', 'year').optional(),
  categories: Joi.array().items(
    Joi.string().valid('service', 'food_quality', 'cleanliness', 'value', 'atmosphere', 'wait_time')
  ).optional()
});

/**
 * Validate review creation request
 */
export function validateReviewCreate(data: any): { isValid: boolean; errors: string[]; value?: ReviewCreateRequest } {
  const { error, value } = reviewCreateSchema.validate(data, { abortEarly: false });
  
  if (error) {
    return {
      isValid: false,
      errors: error.details.map(detail => detail.message)
    };
  }
  
  return {
    isValid: true,
    errors: [],
    value
  };
}

/**
 * Validate review update request
 */
export function validateReviewUpdate(data: any): { isValid: boolean; errors: string[]; value?: ReviewUpdateRequest } {
  const { error, value } = reviewUpdateSchema.validate(data, { abortEarly: false });
  
  if (error) {
    return {
      isValid: false,
      errors: error.details.map(detail => detail.message)
    };
  }
  
  return {
    isValid: true,
    errors: [],
    value
  };
}

/**
 * Detect promotional content in review text
 */
export function detectPromotionalContent(content: string): { isPromotional: boolean; indicators: string[] } {
  const promotionalPatterns = [
    // Direct promotional language
    /sponsored|advertisement|\bad\s|\bpromo/i,
    /discount\s*code|coupon|free\s*meal|complimentary/i,
    /invited|collaboration|partnership/i,
    /brand\s*ambassador|influencer|blogger/i,
    
    // Excessive positive language (potential fake reviews)
    /(amazing|incredible|perfect|outstanding|exceptional).*(amazing|incredible|perfect|outstanding|exceptional)/i,
    /best\s*(ever|in\s*hong\s*kong|restaurant|food)/i,
    
    // Generic/template language
    /highly\s*recommend.*everyone/i,
    /must\s*try.*you\s*won't\s*regret/i,
    /hidden\s*gem.*secret.*amazing/i,
    
    // Promotional URLs or contact info
    /www\.|http|\.com|\.hk/i,
    /whatsapp|wechat|instagram|facebook/i,
    
    // Excessive emoji usage (potential fake reviews)
    /(😍|🤩|😋|🔥|👍|💯){3,}/,
    
    // Repetitive superlatives
    /(very\s*very|super\s*super|really\s*really|definitely\s*definitely)/i
  ];
  
  const indicators: string[] = [];
  
  promotionalPatterns.forEach((pattern, index) => {
    if (pattern.test(content)) {
      switch (index) {
        case 0: indicators.push('Contains sponsored/advertisement language'); break;
        case 1: indicators.push('Contains promotional offers'); break;
        case 2: indicators.push('Mentions collaboration/invitation'); break;
        case 3: indicators.push('Mentions influencer/brand ambassador'); break;
        case 4: indicators.push('Excessive positive superlatives'); break;
        case 5: indicators.push('Generic "best ever" language'); break;
        case 6: indicators.push('Template recommendation language'); break;
        case 7: indicators.push('Generic "must try" template'); break;
        case 8: indicators.push('Generic "hidden gem" language'); break;
        case 9: indicators.push('Contains URLs or website references'); break;
        case 10: indicators.push('Contains social media references'); break;
        case 11: indicators.push('Excessive emoji usage'); break;
        case 12: indicators.push('Repetitive superlatives'); break;
      }
    }
  });
  
  return {
    isPromotional: indicators.length > 0,
    indicators
  };
}

/**
 * Calculate review authenticity score based on multiple factors
 */
export function calculateAuthenticityScore(
  content: string,
  rating: number,
  photos: string[],
  isVerified: boolean,
  userReviewHistory?: number
): number {
  let score = 0;
  
  // Content quality factors
  const contentLength = content.length;
  if (contentLength >= 50) score += 10;
  if (contentLength >= 150) score += 15;
  if (contentLength >= 300) score += 10;
  
  // Detailed content analysis
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length >= 3) score += 10;
  
  // Specific details (mentions of specific dishes, prices, etc.)
  const specificityPatterns = [
    /\$\d+|\d+\s*dollars?/i, // Price mentions
    /ordered?|tried?|had/i, // Specific actions
    /waiter|waitress|staff|service/i, // Service details
    /spicy|sweet|sour|salty|bitter/i, // Taste descriptions
    /atmosphere|ambiance|decor|music/i // Environment details
  ];
  
  const specificityScore = specificityPatterns.reduce((acc, pattern) => {
    return acc + (pattern.test(content) ? 5 : 0);
  }, 0);
  score += Math.min(specificityScore, 20);
  
  // Photo evidence
  if (photos.length > 0) score += 15;
  if (photos.length > 2) score += 10;
  
  // Verified user bonus
  if (isVerified) score += 20;
  
  // Balanced rating (not extremely positive or negative)
  if (rating >= 2 && rating <= 4) score += 10;
  
  // User review history (if available)
  if (userReviewHistory !== undefined) {
    if (userReviewHistory >= 5) score += 10;
    if (userReviewHistory >= 20) score += 5;
  }
  
  // Check for promotional content (penalty)
  const promotionalCheck = detectPromotionalContent(content);
  if (promotionalCheck.isPromotional) {
    score -= promotionalCheck.indicators.length * 10;
  }
  
  // Ensure score is between 0 and 100
  return Math.max(0, Math.min(100, score));
}

/**
 * Analyze negative feedback categories from review content
 */
export function analyzeNegativeFeedbackCategories(content: string, rating: number): NegativeFeedbackCategory[] {
  const categories: NegativeFeedbackCategory[] = [];
  
  // Only analyze for negative reviews (rating <= 3)
  if (rating > 3) return categories;
  
  const categoryPatterns = {
    service: {
      patterns: [
        /rude|unfriendly|slow\s*service|poor\s*service|bad\s*service/i,
        /waiter|waitress|staff.*bad|staff.*rude|staff.*slow/i,
        /ignored|waiting.*long|took.*forever/i,
        /attitude|unprofessional|impolite/i
      ],
      keywords: ['service', 'staff', 'waiter', 'waitress', 'rude', 'slow', 'unfriendly']
    },
    food_quality: {
      patterns: [
        /food.*bad|food.*terrible|food.*awful|food.*disgusting/i,
        /taste.*bad|taste.*terrible|bland|flavorless/i,
        /cold.*food|food.*cold|overcooked|undercooked/i,
        /stale|expired|spoiled|rotten/i,
        /quality.*poor|quality.*bad/i
      ],
      keywords: ['food', 'taste', 'quality', 'cold', 'overcooked', 'bland', 'spoiled']
    },
    cleanliness: {
      patterns: [
        /dirty|filthy|unclean|unhygienic/i,
        /table.*dirty|floor.*dirty|bathroom.*dirty/i,
        /cockroach|insect|bug|fly/i,
        /smell.*bad|stink|odor/i
      ],
      keywords: ['dirty', 'clean', 'hygiene', 'smell', 'cockroach', 'insect']
    },
    value: {
      patterns: [
        /expensive|overpriced|too.*much|not.*worth/i,
        /small.*portion|tiny.*portion|portion.*small/i,
        /price.*high|cost.*too.*much/i,
        /rip.*off|waste.*money/i
      ],
      keywords: ['expensive', 'price', 'portion', 'value', 'money', 'cost']
    },
    atmosphere: {
      patterns: [
        /noisy|loud|crowded|cramped/i,
        /atmosphere.*bad|ambiance.*poor/i,
        /uncomfortable|stuffy|hot|cold/i,
        /decor.*old|decor.*ugly|outdated/i
      ],
      keywords: ['noisy', 'loud', 'atmosphere', 'crowded', 'uncomfortable', 'decor']
    },
    wait_time: {
      patterns: [
        /wait.*long|waiting.*forever|took.*hour/i,
        /slow.*kitchen|slow.*food|delay/i,
        /queue.*long|line.*long/i,
        /reservation.*problem|booking.*issue/i
      ],
      keywords: ['wait', 'slow', 'delay', 'queue', 'reservation', 'booking']
    }
  };
  
  Object.entries(categoryPatterns).forEach(([categoryName, { patterns, keywords }]) => {
    let severity = 0;
    let confidence = 0;
    
    // Check patterns
    const patternMatches = patterns.filter(pattern => pattern.test(content)).length;
    if (patternMatches > 0) {
      severity += patternMatches * 1.5;
      confidence += patternMatches * 20;
    }
    
    // Check keywords
    const keywordMatches = keywords.filter(keyword => 
      content.toLowerCase().includes(keyword.toLowerCase())
    ).length;
    if (keywordMatches > 0) {
      severity += keywordMatches * 0.5;
      confidence += keywordMatches * 10;
    }
    
    // Adjust severity based on rating
    if (rating === 1) severity *= 1.5;
    else if (rating === 2) severity *= 1.2;
    
    // Only include if there's sufficient evidence
    if (confidence >= 20) {
      categories.push({
        category: categoryName as NegativeFeedbackCategory['category'],
        severity: Math.min(5, Math.max(1, Math.round(severity))),
        confidence: Math.min(100, confidence)
      });
    }
  });
  
  return categories;
}

/**
 * Verify review authenticity using multiple signals
 */
export function verifyReviewAuthenticity(
  content: string,
  rating: number,
  photos: string[],
  userHistory?: { reviewCount: number; averageRating: number; isVerified: boolean }
): { isAuthentic: boolean; confidence: number; reasons: string[] } {
  const reasons: string[] = [];
  let confidence = 50; // Start with neutral confidence
  
  // Content analysis
  const promotionalCheck = detectPromotionalContent(content);
  if (promotionalCheck.isPromotional) {
    confidence -= 30;
    reasons.push(`Promotional content detected: ${promotionalCheck.indicators.join(', ')}`);
  }
  
  // Length analysis
  if (content.length < 20) {
    confidence -= 20;
    reasons.push('Review too short for meaningful analysis');
  } else if (content.length > 100) {
    confidence += 15;
    reasons.push('Detailed review content');
  }
  
  // Photo evidence
  if (photos.length > 0) {
    confidence += 20;
    reasons.push('Photo evidence provided');
  }
  
  // User history analysis
  if (userHistory) {
    if (userHistory.isVerified) {
      confidence += 15;
      reasons.push('Verified user account');
    }
    
    if (userHistory.reviewCount >= 5) {
      confidence += 10;
      reasons.push('Established reviewer');
    }
    
    // Check for suspicious rating patterns
    const ratingDifference = Math.abs(rating - userHistory.averageRating);
    if (ratingDifference > 2) {
      confidence -= 10;
      reasons.push('Rating significantly different from user average');
    }
  }
  
  // Extreme ratings analysis
  if (rating === 1 || rating === 5) {
    const hasSpecificDetails = analyzeNegativeFeedbackCategories(content, rating).length > 0 ||
                              content.length > 150;
    if (!hasSpecificDetails) {
      confidence -= 15;
      reasons.push('Extreme rating without sufficient detail');
    }
  }
  
  // Ensure confidence is within bounds
  confidence = Math.max(0, Math.min(100, confidence));
  
  return {
    isAuthentic: confidence >= 60,
    confidence,
    reasons
  };
}