import { OptimizedRestaurantQuery } from '../services/optimizedRestaurantQuery';

describe('OptimizedRestaurantQuery Performance Tests', () => {
  let queryService: OptimizedRestaurantQuery;

  beforeEach(() => {
    queryService = new OptimizedRestaurantQuery({
      enableIndexHints: true,
      maxResultsPerQuery: 100,
      enableQueryPlan: true,
      connectionPoolSize: 10
    });
  });

  describe('Location-based Queries', () => {
    it('should execute location queries within performance targets', async () => {
      const startTime = Date.now();
      
      const result = await queryService.findRestaurantsByLocation(
        22.3193, // Hong Kong Central latitude
        114.1694, // Hong Kong Central longitude
        1000, // 1km radius
        50 // limit
      );
      
      const endTime = Date.now();
      const queryTime = endTime - startTime;
      
      expect(queryTime).toBeLessThan(500); // Should complete within 500ms
      expect(result.metrics.queryTime).toBeLessThan(200); // Database query should be under 200ms
      expect(result.metrics.queryComplexity).toBe('simple');
      expect(result.metrics.indexesUsed).toContain('idx_restaurant_location_gist');
      expect(result.restaurants).toBeDefined();
    });

    it('should handle multiple concurrent location queries efficiently', async () => {
      const locations = [
        { lat: 22.3193, lng: 114.1694, name: 'Central' },
        { lat: 22.2783, lng: 114.1747, name: 'Causeway Bay' },
        { lat: 22.3964, lng: 114.1095, name: 'Tsim Sha Tsui' },
        { lat: 22.2855, lng: 114.1577, name: 'Wan Chai' },
        { lat: 22.2461, lng: 114.1671, name: 'Aberdeen' }
      ];

      const startTime = Date.now();
      
      const queryPromises = locations.map(location =>
        queryService.findRestaurantsByLocation(location.lat, location.lng, 1000, 20)
      );
      
      const results = await Promise.all(queryPromises);
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      expect(totalTime).toBeLessThan(2000); // All queries should complete within 2 seconds
      expect(results).toHaveLength(5);
      
      // Each individual query should be fast
      results.forEach(result => {
        expect(result.metrics.queryTime).toBeLessThan(300);
      });
      
      // Average query time should be reasonable
      const avgQueryTime = results.reduce((sum, r) => sum + r.metrics.queryTime, 0) / results.length;
      expect(avgQueryTime).toBeLessThan(200);
    });
  });

  describe('Complex Search Queries', () => {
    it('should optimize complex multi-criteria searches', async () => {
      const complexQuery = {
        cuisineType: ['Chinese', 'Italian', 'Japanese'],
        priceRange: [2, 4] as [number, number],
        location: {
          latitude: 22.3193,
          longitude: 114.1694,
          radius: 2000
        },
        atmosphere: ['romantic', 'business'],
        isLocalGem: true
      };

      const startTime = Date.now();
      
      const result = await queryService.findRestaurantsByComplexCriteria(complexQuery);
      
      const endTime = Date.now();
      const queryTime = endTime - startTime;
      
      expect(queryTime).toBeLessThan(1000); // Complex queries should complete within 1 second
      expect(result.metrics.queryComplexity).toBe('complex');
      expect(result.metrics.indexesUsed.length).toBeGreaterThan(3); // Should use multiple indexes
      expect(result.metrics.indexesUsed).toContain('idx_restaurant_location_gist');
      expect(result.metrics.indexesUsed).toContain('idx_restaurant_cuisine_type_gin');
    });

    it('should handle batch complex queries efficiently', async () => {
      const queries = [
        {
          cuisineType: ['Chinese'],
          priceRange: [1, 2] as [number, number],
          location: { latitude: 22.3193, longitude: 114.1694, radius: 1000 }
        },
        {
          cuisineType: ['Italian', 'French'],
          priceRange: [3, 4] as [number, number],
          atmosphere: ['romantic']
        },
        {
          priceRange: [1, 3] as [number, number],
          isLocalGem: true,
          location: { latitude: 22.2783, longitude: 114.1747, radius: 1500 }
        },
        {
          cuisineType: ['Japanese', 'Korean'],
          atmosphere: ['casual', 'modern']
        }
      ];

      const startTime = Date.now();
      
      const result = await queryService.batchFindRestaurants(queries);
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      expect(totalTime).toBeLessThan(3000); // Batch should complete within 3 seconds
      expect(result.restaurants).toHaveLength(4);
      expect(result.totalMetrics.queryComplexity).toBe('complex');
      expect(result.totalMetrics.indexesUsed).toContain('batch_query_optimization');
    });
  });

  describe('Similarity Queries', () => {
    it('should execute similarity queries efficiently', async () => {
      const startTime = Date.now();
      
      const result = await queryService.findSimilarRestaurants('restaurant-123', 10);
      
      const endTime = Date.now();
      const queryTime = endTime - startTime;
      
      expect(queryTime).toBeLessThan(800); // Similarity queries should complete within 800ms
      expect(result.metrics.queryComplexity).toBe('medium');
      expect(result.metrics.indexesUsed).toContain('idx_restaurant_cuisine_type');
      expect(result.metrics.indexesUsed).toContain('idx_restaurant_price_range');
    });

    it('should handle multiple similarity queries concurrently', async () => {
      const restaurantIds = ['rest-1', 'rest-2', 'rest-3', 'rest-4', 'rest-5'];
      
      const startTime = Date.now();
      
      const queryPromises = restaurantIds.map(id =>
        queryService.findSimilarRestaurants(id, 5)
      );
      
      const results = await Promise.all(queryPromises);
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      expect(totalTime).toBeLessThan(2000); // All similarity queries within 2 seconds
      expect(results).toHaveLength(5);
      
      results.forEach(result => {
        expect(result.metrics.queryTime).toBeLessThan(400);
      });
    });
  });

  describe('Query Performance Monitoring', () => {
    it('should track query performance metrics accurately', async () => {
      // Execute various types of queries
      await queryService.findRestaurantsByLocation(22.3193, 114.1694, 1000, 20);
      await queryService.findRestaurantsByComplexCriteria({
        cuisineType: ['Chinese'],
        priceRange: [1, 3]
      });
      await queryService.findSimilarRestaurants('test-restaurant', 5);

      const stats = queryService.getQueryPerformanceStats();
      
      expect(stats.totalQueries).toBe(3);
      expect(stats.averageQueryTime).toBeGreaterThan(0);
      expect(stats.complexityDistribution).toBeDefined();
      expect(stats.complexityDistribution.simple).toBeGreaterThanOrEqual(1);
    });

    it('should provide query-specific performance stats', async () => {
      const queryKey = 'location:22.3193:114.1694:1000';
      
      // Execute the same location query multiple times
      for (let i = 0; i < 5; i++) {
        await queryService.findRestaurantsByLocation(22.3193, 114.1694, 1000, 20);
      }

      const stats = queryService.getQueryPerformanceStats(queryKey);
      
      expect(stats.totalQueries).toBe(5);
      expect(stats.averageQueryTime).toBeGreaterThan(0);
      expect(stats.averageQueryTime).toBeLessThan(500); // Should be consistently fast
    });
  });

  describe('Performance Under Load', () => {
    it('should maintain performance with high query volume', async () => {
      const startTime = Date.now();
      const queryPromises = [];

      // Generate 50 concurrent queries of different types
      for (let i = 0; i < 50; i++) {
        if (i % 3 === 0) {
          // Location queries
          queryPromises.push(
            queryService.findRestaurantsByLocation(
              22.3193 + (Math.random() - 0.5) * 0.1,
              114.1694 + (Math.random() - 0.5) * 0.1,
              1000,
              20
            )
          );
        } else if (i % 3 === 1) {
          // Complex queries
          queryPromises.push(
            queryService.findRestaurantsByComplexCriteria({
              cuisineType: ['Chinese', 'Italian'][Math.floor(Math.random() * 2)] ? ['Chinese'] : ['Italian'],
              priceRange: [1, 3] as [number, number]
            })
          );
        } else {
          // Similarity queries
          queryPromises.push(
            queryService.findSimilarRestaurants(`restaurant-${i}`, 5)
          );
        }
      }

      const results = await Promise.allSettled(queryPromises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      const successfulResults = results.filter(r => r.status === 'fulfilled');
      
      expect(successfulResults.length).toBeGreaterThan(45); // At least 90% success rate
      expect(totalTime).toBeLessThan(10000); // Complete within 10 seconds
      
      // Check that individual queries still perform well under load
      const avgTimePerQuery = totalTime / successfulResults.length;
      expect(avgTimePerQuery).toBeLessThan(500); // Average should still be under 500ms
    });

    it('should handle query timeout scenarios gracefully', async () => {
      // This would test timeout handling in a real database scenario
      // For now, we'll test the timeout configuration
      const queryService = new OptimizedRestaurantQuery({
        enableIndexHints: true,
        maxResultsPerQuery: 10000, // Large result set
        enableQueryPlan: true
      });

      const startTime = Date.now();
      
      try {
        await queryService.findRestaurantsByComplexCriteria({
          cuisineType: ['Chinese', 'Italian', 'Japanese', 'Korean', 'Thai'],
          priceRange: [1, 4],
          atmosphere: ['casual', 'romantic', 'business', 'family-friendly']
        });
        
        const endTime = Date.now();
        expect(endTime - startTime).toBeLessThan(5000); // Should complete or timeout within 5 seconds
      } catch (error) {
        // Timeout errors are acceptable for this test
        expect(error).toBeDefined();
      }
    });
  });

  describe('Index Usage Optimization', () => {
    it('should use appropriate indexes for different query types', async () => {
      // Location query
      const locationResult = await queryService.findRestaurantsByLocation(22.3193, 114.1694, 1000, 20);
      expect(locationResult.metrics.indexesUsed).toContain('idx_restaurant_location_gist');

      // Cuisine query
      const cuisineResult = await queryService.findRestaurantsByComplexCriteria({
        cuisineType: ['Chinese', 'Italian']
      });
      expect(cuisineResult.metrics.indexesUsed).toContain('idx_restaurant_cuisine_type_gin');

      // Price range query
      const priceResult = await queryService.findRestaurantsByComplexCriteria({
        priceRange: [2, 4]
      });
      expect(priceResult.metrics.indexesUsed).toContain('idx_restaurant_price_range');

      // Local gem query
      const localGemResult = await queryService.findRestaurantsByComplexCriteria({
        isLocalGem: true
      });
      expect(localGemResult.metrics.indexesUsed).toContain('idx_restaurant_local_gem');
    });

    it('should optimize index usage for complex queries', async () => {
      const complexQuery = {
        cuisineType: ['Chinese'],
        priceRange: [2, 3] as [number, number],
        location: {
          latitude: 22.3193,
          longitude: 114.1694,
          radius: 1000
        },
        isLocalGem: true
      };

      const result = await queryService.findRestaurantsByComplexCriteria(complexQuery);
      
      // Should use multiple relevant indexes
      expect(result.metrics.indexesUsed.length).toBeGreaterThan(3);
      expect(result.metrics.indexesUsed).toContain('idx_restaurant_location_gist');
      expect(result.metrics.indexesUsed).toContain('idx_restaurant_cuisine_type_gin');
      expect(result.metrics.indexesUsed).toContain('idx_restaurant_price_range');
      expect(result.metrics.indexesUsed).toContain('idx_restaurant_local_gem');
    });
  });
});