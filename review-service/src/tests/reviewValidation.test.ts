import {
  validateReviewCreate,
  validateReviewUpdate,
  detectPromotionalContent,
  calculateAuthenticityScore,
  analyzeNegativeFeedbackCategories,
  verifyReviewAuthenticity
} from '../validation/reviewValidation';

describe('Review Validation', () => {
  describe('validateReviewCreate', () => {
    const validReviewData = {
      restaurantId: 'restaurant123',
      rating: 4,
      content: 'Great food and excellent service',
      visitDate: new Date('2024-01-15')
    };

    it('should validate correct review data', () => {
      const result = validateReviewCreate(validReviewData);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.value).toBeDefined();
    });

    it('should reject missing required fields', () => {
      const invalidData = {
        rating: 4,
        content: 'Good food'
      };
      
      const result = validateReviewCreate(invalidData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject invalid rating', () => {
      const invalidData = {
        ...validReviewData,
        rating: 6
      };
      
      const result = validateReviewCreate(invalidData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('rating'))).toBe(true);
    });

    it('should reject short content', () => {
      const invalidData = {
        ...validReviewData,
        content: 'Good'
      };
      
      const result = validateReviewCreate(invalidData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('10'))).toBe(true);
    });

    it('should reject future visit dates', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      
      const invalidData = {
        ...validReviewData,
        visitDate: futureDate
      };
      
      const result = validateReviewCreate(invalidData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('date'))).toBe(true);
    });
  });

  describe('validateReviewUpdate', () => {
    it('should validate partial update data', () => {
      const updateData = {
        rating: 3,
        content: 'Updated review content'
      };
      
      const result = validateReviewUpdate(updateData);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should allow empty update data', () => {
      const result = validateReviewUpdate({});
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid rating in update', () => {
      const invalidData = {
        rating: 0
      };
      
      const result = validateReviewUpdate(invalidData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('rating'))).toBe(true);
    });
  });

  describe('detectPromotionalContent', () => {
    it('should detect sponsored content', () => {
      const content = 'This is a sponsored review for this amazing restaurant';
      const result = detectPromotionalContent(content);
      
      expect(result.isPromotional).toBe(true);
      expect(result.indicators).toContain('Contains sponsored/advertisement language');
    });

    it('should detect promotional offers', () => {
      const content = 'Great food! Use discount code SAVE20 for a free meal';
      const result = detectPromotionalContent(content);
      
      expect(result.isPromotional).toBe(true);
      expect(result.indicators).toContain('Contains promotional offers');
    });

    it('should detect influencer content', () => {
      const content = 'As a food blogger and brand ambassador, I highly recommend this place';
      const result = detectPromotionalContent(content);
      
      expect(result.isPromotional).toBe(true);
      expect(result.indicators).toContain('Mentions influencer/brand ambassador');
    });

    it('should detect excessive positive language', () => {
      const content = 'This is the most amazing incredible perfect outstanding restaurant ever';
      const result = detectPromotionalContent(content);
      
      expect(result.isPromotional).toBe(true);
      expect(result.indicators).toContain('Excessive positive superlatives');
    });

    it('should detect template language', () => {
      const content = 'Highly recommend to everyone, you must try this place you won\'t regret it';
      const result = detectPromotionalContent(content);
      
      expect(result.isPromotional).toBe(true);
      expect(result.indicators.length).toBeGreaterThan(0);
    });

    it('should detect excessive emoji usage', () => {
      const content = 'Great food 😍😍😍🤩🤩🤩😋😋😋';
      const result = detectPromotionalContent(content);
      
      expect(result.isPromotional).toBe(true);
      expect(result.indicators).toContain('Excessive emoji usage');
    });

    it('should not flag genuine reviews', () => {
      const content = 'Had a wonderful dinner here. The pasta was perfectly cooked and the service was friendly. Would come back again.';
      const result = detectPromotionalContent(content);
      
      expect(result.isPromotional).toBe(false);
      expect(result.indicators).toHaveLength(0);
    });
  });

  describe('calculateAuthenticityScore', () => {
    it('should give higher score for detailed content', () => {
      const detailedContent = 'We ordered the seafood pasta and the grilled salmon. The pasta was perfectly al dente with a rich tomato sauce, and the salmon was cooked to perfection. The service was attentive and the atmosphere was cozy. Prices were reasonable at around $25 per dish.';
      
      const score = calculateAuthenticityScore(detailedContent, 4, ['photo1.jpg'], true, 10);
      
      expect(score).toBeGreaterThan(70);
    });

    it('should give lower score for short content', () => {
      const shortContent = 'Good food';
      
      const score = calculateAuthenticityScore(shortContent, 5, [], false);
      
      expect(score).toBeLessThan(40);
    });

    it('should give bonus for photos', () => {
      const content = 'Great restaurant with excellent food and service';
      
      const scoreWithPhotos = calculateAuthenticityScore(content, 4, ['photo1.jpg', 'photo2.jpg'], false);
      const scoreWithoutPhotos = calculateAuthenticityScore(content, 4, [], false);
      
      expect(scoreWithPhotos).toBeGreaterThan(scoreWithoutPhotos);
    });

    it('should give bonus for verified users', () => {
      const content = 'Great restaurant with excellent food and service';
      
      const verifiedScore = calculateAuthenticityScore(content, 4, [], true);
      const unverifiedScore = calculateAuthenticityScore(content, 4, [], false);
      
      expect(verifiedScore).toBeGreaterThan(unverifiedScore);
    });

    it('should penalize promotional content', () => {
      const promotionalContent = 'This sponsored review is for the most amazing restaurant ever! Use discount code SAVE20!';
      const genuineContent = 'Had a nice meal here. The food was good and service was friendly.';
      
      const promotionalScore = calculateAuthenticityScore(promotionalContent, 5, [], false);
      const genuineScore = calculateAuthenticityScore(genuineContent, 4, [], false);
      
      expect(genuineScore).toBeGreaterThan(promotionalScore);
    });

    it('should give bonus for balanced ratings', () => {
      const content = 'Decent restaurant with good food and okay service';
      
      const balancedScore = calculateAuthenticityScore(content, 3, [], false);
      const extremeScore = calculateAuthenticityScore(content, 5, [], false);
      
      expect(balancedScore).toBeGreaterThanOrEqual(extremeScore);
    });
  });

  describe('analyzeNegativeFeedbackCategories', () => {
    it('should identify service issues', () => {
      const content = 'The waiter was very rude and the service was extremely slow. We waited 45 minutes for our food.';
      const categories = analyzeNegativeFeedbackCategories(content, 2);
      
      const serviceCategory = categories.find(c => c.category === 'service');
      expect(serviceCategory).toBeDefined();
      expect(serviceCategory?.severity).toBeGreaterThan(2);
      expect(serviceCategory?.confidence).toBeGreaterThan(50);
    });

    it('should identify food quality issues', () => {
      const content = 'The food was terrible and cold. The pasta was overcooked and the sauce was bland.';
      const categories = analyzeNegativeFeedbackCategories(content, 1);
      
      const foodCategory = categories.find(c => c.category === 'food_quality');
      expect(foodCategory).toBeDefined();
      expect(foodCategory?.severity).toBeGreaterThan(2);
    });

    it('should identify cleanliness issues', () => {
      const content = 'The restaurant was dirty and unhygienic. There were cockroaches on the floor and the table was filthy.';
      const categories = analyzeNegativeFeedbackCategories(content, 1);
      
      const cleanlinessCategory = categories.find(c => c.category === 'cleanliness');
      expect(cleanlinessCategory).toBeDefined();
      expect(cleanlinessCategory?.severity).toBeGreaterThan(3);
    });

    it('should identify value issues', () => {
      const content = 'Way too expensive for tiny portions. Not worth the money at all, complete rip off.';
      const categories = analyzeNegativeFeedbackCategories(content, 2);
      
      const valueCategory = categories.find(c => c.category === 'value');
      expect(valueCategory).toBeDefined();
      expect(valueCategory?.severity).toBeGreaterThan(2);
    });

    it('should identify atmosphere issues', () => {
      const content = 'The restaurant was extremely noisy and crowded. Very uncomfortable atmosphere.';
      const categories = analyzeNegativeFeedbackCategories(content, 2);
      
      const atmosphereCategory = categories.find(c => c.category === 'atmosphere');
      expect(atmosphereCategory).toBeDefined();
    });

    it('should identify wait time issues', () => {
      const content = 'We waited forever for our food. The kitchen was incredibly slow and there were delays.';
      const categories = analyzeNegativeFeedbackCategories(content, 2);
      
      const waitTimeCategory = categories.find(c => c.category === 'wait_time');
      expect(waitTimeCategory).toBeDefined();
    });

    it('should not analyze positive reviews', () => {
      const content = 'Excellent food and great service. Highly recommend!';
      const categories = analyzeNegativeFeedbackCategories(content, 5);
      
      expect(categories).toHaveLength(0);
    });

    it('should adjust severity based on rating', () => {
      const content = 'The service was slow and the food was cold';
      
      const categories1 = analyzeNegativeFeedbackCategories(content, 1);
      const categories2 = analyzeNegativeFeedbackCategories(content, 2);
      
      const service1 = categories1.find(c => c.category === 'service');
      const service2 = categories2.find(c => c.category === 'service');
      
      if (service1 && service2) {
        expect(service1.severity).toBeGreaterThan(service2.severity);
      }
    });
  });

  describe('verifyReviewAuthenticity', () => {
    it('should verify authentic detailed reviews', () => {
      const content = 'We had dinner here last week and ordered the seafood pasta and grilled chicken. The pasta was perfectly cooked with fresh seafood, and the chicken was tender and well-seasoned. Service was attentive and the atmosphere was cozy. Prices were reasonable at around $30 per person.';
      const photos = ['food1.jpg', 'restaurant.jpg'];
      const userHistory = { reviewCount: 15, averageRating: 3.8, isVerified: true };
      
      const result = verifyReviewAuthenticity(content, 4, photos, userHistory);
      
      expect(result.isAuthentic).toBe(true);
      expect(result.confidence).toBeGreaterThan(70);
    });

    it('should flag promotional content as inauthentic', () => {
      const content = 'This sponsored review is for the most amazing restaurant ever! Use discount code SAVE20!';
      const result = verifyReviewAuthenticity(content, 5, []);
      
      expect(result.isAuthentic).toBe(false);
      expect(result.confidence).toBeLessThan(60);
      expect(result.reasons.some(reason => reason.includes('Promotional'))).toBe(true);
    });

    it('should flag very short reviews as less authentic', () => {
      const content = 'Good food';
      const result = verifyReviewAuthenticity(content, 5, []);
      
      expect(result.confidence).toBeLessThan(60);
      expect(result.reasons).toContain('Review too short for meaningful analysis');
    });

    it('should give bonus for photo evidence', () => {
      const content = 'Had a great meal here. The food was delicious and service was good.';
      
      const resultWithPhotos = verifyReviewAuthenticity(content, 4, ['photo1.jpg']);
      const resultWithoutPhotos = verifyReviewAuthenticity(content, 4, []);
      
      expect(resultWithPhotos.confidence).toBeGreaterThan(resultWithoutPhotos.confidence);
      expect(resultWithPhotos.reasons).toContain('Photo evidence provided');
    });

    it('should give bonus for verified users', () => {
      const content = 'Had a great meal here. The food was delicious and service was good.';
      const verifiedUser = { reviewCount: 10, averageRating: 3.5, isVerified: true };
      const unverifiedUser = { reviewCount: 10, averageRating: 3.5, isVerified: false };
      
      const verifiedResult = verifyReviewAuthenticity(content, 4, [], verifiedUser);
      const unverifiedResult = verifyReviewAuthenticity(content, 4, [], unverifiedUser);
      
      expect(verifiedResult.confidence).toBeGreaterThan(unverifiedResult.confidence);
      expect(verifiedResult.reasons).toContain('Verified user account');
    });

    it('should flag suspicious rating patterns', () => {
      const content = 'This place is okay I guess';
      const userHistory = { reviewCount: 20, averageRating: 4.8, isVerified: true };
      
      const result = verifyReviewAuthenticity(content, 1, [], userHistory);
      
      expect(result.reasons.some(reason => reason.includes('Rating significantly different'))).toBe(true);
    });

    it('should flag extreme ratings without detail', () => {
      const content = 'Best ever!';
      const result = verifyReviewAuthenticity(content, 5, []);
      
      expect(result.confidence).toBeLessThan(60);
      expect(result.reasons.some(reason => reason.includes('Extreme rating without sufficient detail'))).toBe(true);
    });

    it('should accept extreme ratings with sufficient detail', () => {
      const content = 'This was absolutely the worst dining experience I\'ve ever had. The food was cold and tasteless, the service was incredibly rude and slow, and the restaurant was dirty. We waited over an hour for our food and when it finally arrived, it was inedible. The waiter was dismissive when we complained and refused to remove the items from our bill. I would never recommend this place to anyone.';
      
      const result = verifyReviewAuthenticity(content, 1, ['evidence.jpg']);
      
      expect(result.confidence).toBeGreaterThan(60);
    });
  });
});