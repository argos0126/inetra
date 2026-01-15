/**
 * Calculate the distance between two points using the Haversine formula
 * @returns Distance in meters
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Check if a point is within a radius of a target point
 * @returns Object with validation result and distance
 */
export function isWithinRadius(
  currentLat: number,
  currentLon: number,
  targetLat: number,
  targetLon: number,
  radiusMeters: number
): { isValid: boolean; distanceMeters: number } {
  const distance = calculateHaversineDistance(currentLat, currentLon, targetLat, targetLon);
  return {
    isValid: distance <= radiusMeters,
    distanceMeters: Math.round(distance)
  };
}

/**
 * Format distance for display
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${meters} m`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
}

/**
 * Check if any tracking point is within radius of a waypoint
 * Used to determine if vehicle has passed near a waypoint
 */
export function hasTrackingPointNearLocation(
  trackingPoints: { latitude: number; longitude: number }[],
  targetLat: number,
  targetLon: number,
  radiusMeters: number = 500
): { passed: boolean; closestDistance: number } {
  let closestDistance = Infinity;
  
  for (const point of trackingPoints) {
    const distance = calculateHaversineDistance(
      point.latitude,
      point.longitude,
      targetLat,
      targetLon
    );
    
    if (distance < closestDistance) {
      closestDistance = distance;
    }
    
    if (distance <= radiusMeters) {
      return { passed: true, closestDistance: Math.round(distance) };
    }
  }
  
  return { passed: false, closestDistance: Math.round(closestDistance) };
}
