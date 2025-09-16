export interface Coordinates {
  latitude: number;
  longitude: number;
}

export class DistanceUtils {
  /**
   * Calculate the distance between two coordinates using the Haversine formula
   * @param coord1 First coordinate
   * @param coord2 Second coordinate
   * @returns Distance in kilometers
   */
  static calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(coord2.latitude - coord1.latitude);
    const dLon = this.toRadians(coord2.longitude - coord1.longitude);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(coord1.latitude)) * Math.cos(this.toRadians(coord2.latitude)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return Math.round(distance * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Check if a coordinate is within a certain radius of another coordinate
   * @param center Center coordinate
   * @param point Point to check
   * @param radiusKm Radius in kilometers
   * @returns True if point is within radius
   */
  static isWithinRadius(center: Coordinates, point: Coordinates, radiusKm: number): boolean {
    const distance = this.calculateDistance(center, point);
    return distance <= radiusKm;
  }

  /**
   * Filter an array of locations by distance from a center point
   * @param center Center coordinate
   * @param locations Array of locations with coordinates
   * @param radiusKm Maximum radius in kilometers
   * @returns Filtered array of locations within radius
   */
  static filterByDistance<T extends { location: Coordinates }>(
    center: Coordinates,
    locations: T[],
    radiusKm: number
  ): (T & { distance: number })[] {
    return locations
      .map(location => ({
        ...location,
        distance: this.calculateDistance(center, location.location)
      }))
      .filter(location => location.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance);
  }

  /**
   * Get the bounding box coordinates for a given center and radius
   * @param center Center coordinate
   * @param radiusKm Radius in kilometers
   * @returns Bounding box coordinates
   */
  static getBoundingBox(center: Coordinates, radiusKm: number): {
    north: number;
    south: number;
    east: number;
    west: number;
  } {
    const latDelta = radiusKm / 111; // Approximate km per degree latitude
    const lonDelta = radiusKm / (111 * Math.cos(this.toRadians(center.latitude)));

    return {
      north: center.latitude + latDelta,
      south: center.latitude - latDelta,
      east: center.longitude + lonDelta,
      west: center.longitude - lonDelta
    };
  }

  private static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}