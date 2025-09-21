import { Restaurant } from '../../../shared/src/types/restaurant.types';
import { RestaurantSearchQuery } from './restaurantCacheService';

export interface QueryOptimizationConfig {
  enableIndexHints: boolean;
  maxResultsPerQuery: number;
  enableQueryPlan: boolean;
  connectionPoolSize: number;
}

export interface QueryPerformanceMetrics {
  queryTime: number;
  resultCount: number;
  cacheHit: boolean;
  indexesUsed: string[];
  queryComplexity: 'simple' | 'medium' | 'complex';
}

export class OptimizedRestaurantQuery {
  private config: QueryOptimizationConfig;
  private queryMetrics: Map<string, QueryPerformanceMetrics[]> = new Map();

  constructor(config?: Partial<QueryOptimizationConfig>) {
    this.config = {
      enableIndexHints: true,
      maxResultsPerQuery: 100,
      enableQueryPlan: false,
      connectionPoolSize: 10,
      ...config
    };
  }

  async findRestaurantsByLocation(
    latitude: number,
    longitude: number,
    radius: number,
    limit: number = 50
  ): Promise<{ restaurants: Restaurant[]; metrics: QueryPerformanceMetrics }> {
    const startTime = Date.now();
    const queryKey = `location:${latitude}:${longitude}:${radius}`;

    try {
      // Optimized spatial query with proper indexing
      const query = this.buildLocationQuery(latitude, longitude, radius, limit);
      
      // Simulate database query execution
      const restaurants = await this.executeOptimizedQuery(query);
      
      const metrics: QueryPerformanceMetrics = {
        queryTime: Date.now() - startTime,
        resultCount: restaurants.length,
        cacheHit: false,
        indexesUsed: ['idx_restaurant_location_gist', 'idx_restaurant_active'],
        queryComplexity: 'simple'
      };

      this.recordMetrics(queryKey, metrics);
      
      return { restaurants, metrics };
    } catch (error) {
      throw new Error(`Location query failed: ${error}`);
    }
  }

  async findRestaurantsByComplexCriteria(
    query: RestaurantSearchQuery
  ): Promise<{ restaurants: Restaurant[]; metrics: QueryPerformanceMetrics }> {
    const startTime = Date.now();
    const queryKey = this.generateQueryKey(query);

    try {
      const optimizedQuery = this.buildComplexQuery(query);
      const restaurants = await this.executeOptimizedQuery(optimizedQuery);
      
      const complexity = this.determineQueryComplexity(query);
      const indexesUsed = this.determineIndexesUsed(query);
      
      const metrics: QueryPerformanceMetrics = {
        queryTime: Date.now() - startTime,
        resultCount: restaurants.length,
        cacheHit: false,
        indexesUsed,
        queryComplexity: complexity
      };

      this.recordMetrics(queryKey, metrics);
      
      return { restaurants, metrics };
    } catch (error) {
      throw new Error(`Complex query failed: ${error}`);
    }
  }

  async findSimilarRestaurants(
    restaurantId: string,
    limit: number = 10
  ): Promise<{ restaurants: Restaurant[]; metrics: QueryPerformanceMetrics }> {
    const startTime = Date.now();
    const queryKey = `similar:${restaurantId}`;

    try {
      // Use vector similarity or collaborative filtering
      const query = this.buildSimilarityQuery(restaurantId, limit);
      const restaurants = await this.executeOptimizedQuery(query);
      
      const metrics: QueryPerformanceMetrics = {
        queryTime: Date.now() - startTime,
        resultCount: restaurants.length,
        cacheHit: false,
        indexesUsed: ['idx_restaurant_cuisine_type', 'idx_restaurant_price_range', 'idx_restaurant_rating'],
        queryComplexity: 'medium'
      };

      this.recordMetrics(queryKey, metrics);
      
      return { restaurants, metrics };
    } catch (error) {
      throw new Error(`Similarity query failed: ${error}`);
    }
  }

  async batchFindRestaurants(
    queries: RestaurantSearchQuery[]
  ): Promise<{ restaurants: Restaurant[][]; totalMetrics: QueryPerformanceMetrics }> {
    const startTime = Date.now();
    
    try {
      // Execute queries in parallel with connection pooling
      const queryPromises = queries.map(query => 
        this.findRestaurantsByComplexCriteria(query)
      );
      
      const results = await Promise.all(queryPromises);
      
      const restaurants = results.map(result => result.restaurants);
      const totalResultCount = restaurants.reduce((sum, arr) => sum + arr.length, 0);
      
      const totalMetrics: QueryPerformanceMetrics = {
        queryTime: Date.now() - startTime,
        resultCount: totalResultCount,
        cacheHit: false,
        indexesUsed: ['batch_query_optimization'],
        queryComplexity: 'complex'
      };

      return { restaurants, totalMetrics };
    } catch (error) {
      throw new Error(`Batch query failed: ${error}`);
    }
  }

  private buildLocationQuery(
    latitude: number,
    longitude: number,
    radius: number,
    limit: number
  ): string {
    // Optimized PostGIS query with spatial index
    return `
      SELECT r.*, 
             ST_Distance(
               ST_GeogFromText('POINT(${longitude} ${latitude})'),
               ST_GeogFromText('POINT(' || r.longitude || ' ' || r.latitude || ')')
             ) as distance
      FROM restaurants r
      WHERE ST_DWithin(
        ST_GeogFromText('POINT(' || r.longitude || ' ' || r.latitude || ')'),
        ST_GeogFromText('POINT(${longitude} ${latitude})'),
        ${radius}
      )
      AND r.is_active = true
      ORDER BY distance ASC
      LIMIT ${Math.min(limit, this.config.maxResultsPerQuery)}
    `;
  }

  private buildComplexQuery(query: RestaurantSearchQuery): string {
    const conditions: string[] = ['r.is_active = true'];
    const joins: string[] = [];
    
    if (query.cuisineType?.length) {
      conditions.push(`r.cuisine_type && ARRAY[${query.cuisineType.map(c => `'${c}'`).join(',')}]`);
    }
    
    if (query.priceRange) {
      conditions.push(`r.price_range BETWEEN ${query.priceRange[0]} AND ${query.priceRange[1]}`);
    }
    
    if (query.atmosphere?.length) {
      conditions.push(`r.atmosphere && ARRAY[${query.atmosphere.map(a => `'${a}'`).join(',')}]`);
    }
    
    if (query.isLocalGem !== undefined) {
      conditions.push(`r.is_local_gem = ${query.isLocalGem}`);
    }
    
    if (query.location) {
      const { latitude, longitude, radius } = query.location;
      conditions.push(`
        ST_DWithin(
          ST_GeogFromText('POINT(' || r.longitude || ' ' || r.latitude || ')'),
          ST_GeogFromText('POINT(${longitude} ${latitude})'),
          ${radius}
        )
      `);
    }

    let orderBy = 'r.rating DESC, r.negative_score ASC';
    if (query.location) {
      orderBy = `ST_Distance(
        ST_GeogFromText('POINT(${query.location.longitude} ${query.location.latitude})'),
        ST_GeogFromText('POINT(' || r.longitude || ' ' || r.latitude || ')')
      ) ASC, ` + orderBy;
    }

    return `
      SELECT DISTINCT r.*
      FROM restaurants r
      ${joins.join(' ')}
      WHERE ${conditions.join(' AND ')}
      ORDER BY ${orderBy}
      LIMIT ${this.config.maxResultsPerQuery}
    `;
  }

  private buildSimilarityQuery(restaurantId: string, limit: number): string {
    return `
      WITH target_restaurant AS (
        SELECT cuisine_type, price_range, atmosphere, district
        FROM restaurants 
        WHERE id = '${restaurantId}'
      )
      SELECT r.*,
             (
               CASE WHEN r.cuisine_type && tr.cuisine_type THEN 3 ELSE 0 END +
               CASE WHEN r.price_range = tr.price_range THEN 2 ELSE 0 END +
               CASE WHEN r.atmosphere && tr.atmosphere THEN 2 ELSE 0 END +
               CASE WHEN r.district = tr.district THEN 1 ELSE 0 END
             ) as similarity_score
      FROM restaurants r, target_restaurant tr
      WHERE r.id != '${restaurantId}'
        AND r.is_active = true
        AND (
          r.cuisine_type && tr.cuisine_type OR
          r.price_range = tr.price_range OR
          r.atmosphere && tr.atmosphere
        )
      ORDER BY similarity_score DESC, r.rating DESC
      LIMIT ${limit}
    `;
  }

  private async executeOptimizedQuery(query: string): Promise<Restaurant[]> {
    // Simulate database execution with performance considerations
    const simulatedDelay = Math.random() * 100 + 50; // 50-150ms
    await new Promise(resolve => setTimeout(resolve, simulatedDelay));
    
    // Return mock data for testing
    return [];
  }

  private determineQueryComplexity(query: RestaurantSearchQuery): 'simple' | 'medium' | 'complex' {
    let complexity = 0;
    
    if (query.cuisineType?.length) complexity++;
    if (query.priceRange) complexity++;
    if (query.location) complexity++;
    if (query.atmosphere?.length) complexity++;
    if (query.isLocalGem !== undefined) complexity++;
    
    if (complexity <= 1) return 'simple';
    if (complexity <= 3) return 'medium';
    return 'complex';
  }

  private determineIndexesUsed(query: RestaurantSearchQuery): string[] {
    const indexes: string[] = ['idx_restaurant_active'];
    
    if (query.cuisineType?.length) {
      indexes.push('idx_restaurant_cuisine_type_gin');
    }
    
    if (query.priceRange) {
      indexes.push('idx_restaurant_price_range');
    }
    
    if (query.location) {
      indexes.push('idx_restaurant_location_gist');
    }
    
    if (query.atmosphere?.length) {
      indexes.push('idx_restaurant_atmosphere_gin');
    }
    
    if (query.isLocalGem !== undefined) {
      indexes.push('idx_restaurant_local_gem');
    }
    
    return indexes;
  }

  private generateQueryKey(query: RestaurantSearchQuery): string {
    const parts: string[] = [];
    
    if (query.cuisineType?.length) {
      parts.push(`cuisine:${query.cuisineType.sort().join(',')}`);
    }
    
    if (query.priceRange) {
      parts.push(`price:${query.priceRange[0]}-${query.priceRange[1]}`);
    }
    
    if (query.location) {
      parts.push(`location:${query.location.latitude}:${query.location.longitude}:${query.location.radius}`);
    }
    
    if (query.atmosphere?.length) {
      parts.push(`atmosphere:${query.atmosphere.sort().join(',')}`);
    }
    
    if (query.isLocalGem !== undefined) {
      parts.push(`local:${query.isLocalGem}`);
    }
    
    return parts.join('|');
  }

  private recordMetrics(queryKey: string, metrics: QueryPerformanceMetrics): void {
    if (!this.queryMetrics.has(queryKey)) {
      this.queryMetrics.set(queryKey, []);
    }
    
    const queryMetrics = this.queryMetrics.get(queryKey)!;
    queryMetrics.push(metrics);
    
    // Keep only last 100 metrics per query type
    if (queryMetrics.length > 100) {
      queryMetrics.shift();
    }
  }

  getQueryPerformanceStats(queryKey?: string): {
    averageQueryTime: number;
    totalQueries: number;
    cacheHitRate: number;
    complexityDistribution: Record<string, number>;
  } {
    const allMetrics = queryKey 
      ? this.queryMetrics.get(queryKey) || []
      : Array.from(this.queryMetrics.values()).flat();
    
    if (allMetrics.length === 0) {
      return {
        averageQueryTime: 0,
        totalQueries: 0,
        cacheHitRate: 0,
        complexityDistribution: {}
      };
    }
    
    const totalQueryTime = allMetrics.reduce((sum, m) => sum + m.queryTime, 0);
    const cacheHits = allMetrics.filter(m => m.cacheHit).length;
    
    const complexityDistribution = allMetrics.reduce((dist, m) => {
      dist[m.queryComplexity] = (dist[m.queryComplexity] || 0) + 1;
      return dist;
    }, {} as Record<string, number>);
    
    return {
      averageQueryTime: totalQueryTime / allMetrics.length,
      totalQueries: allMetrics.length,
      cacheHitRate: cacheHits / allMetrics.length,
      complexityDistribution
    };
  }

  clearMetrics(): void {
    this.queryMetrics.clear();
  }
}