// Utility to cluster consecutive tracking points by proximity

export interface TrackingPointInput {
  id: string;
  latitude: number;
  longitude: number;
  sequence_number: number;
  event_time: string;
  detailed_address?: string | null;
}

export interface TrackingCluster {
  id: string;
  points: TrackingPointInput[];
  center: { lat: number; lng: number };
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  address?: string | null;
  isStoppage: boolean; // true if dwell time >= stoppage threshold
}

// Calculate distance between two points in meters using Haversine formula
function calculateDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Cluster consecutive tracking points that are within proximity of each other
 * @param points - Array of tracking points sorted by sequence_number
 * @param proximityMeters - Distance threshold to consider points as same location (default: 100m)
 * @param stoppageThresholdMinutes - Minimum dwell time to mark as stoppage (default: 30 min)
 */
export function clusterTrackingPoints(
  points: TrackingPointInput[],
  proximityMeters: number = 100,
  stoppageThresholdMinutes: number = 30
): { clusters: TrackingCluster[]; movingPoints: TrackingPointInput[] } {
  if (points.length === 0) {
    return { clusters: [], movingPoints: [] };
  }

  // Sort by sequence number
  const sortedPoints = [...points].sort((a, b) => a.sequence_number - b.sequence_number);
  
  const clusters: TrackingCluster[] = [];
  const movingPoints: TrackingPointInput[] = [];
  
  let currentClusterPoints: TrackingPointInput[] = [sortedPoints[0]];
  let clusterCenter = { lat: sortedPoints[0].latitude, lng: sortedPoints[0].longitude };
  
  for (let i = 1; i < sortedPoints.length; i++) {
    const point = sortedPoints[i];
    const distance = calculateDistanceMeters(
      clusterCenter.lat,
      clusterCenter.lng,
      point.latitude,
      point.longitude
    );
    
    if (distance <= proximityMeters) {
      // Point is within proximity, add to current cluster
      currentClusterPoints.push(point);
      // Update cluster center (average)
      clusterCenter = {
        lat: currentClusterPoints.reduce((sum, p) => sum + p.latitude, 0) / currentClusterPoints.length,
        lng: currentClusterPoints.reduce((sum, p) => sum + p.longitude, 0) / currentClusterPoints.length,
      };
    } else {
      // Point is outside proximity, finalize current cluster
      if (currentClusterPoints.length >= 2) {
        // It's a stationary cluster (multiple points at same location)
        const startTime = new Date(currentClusterPoints[0].event_time);
        const endTime = new Date(currentClusterPoints[currentClusterPoints.length - 1].event_time);
        const durationMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
        
        clusters.push({
          id: `cluster-${currentClusterPoints[0].id}`,
          points: [...currentClusterPoints],
          center: { ...clusterCenter },
          startTime,
          endTime,
          durationMinutes,
          address: currentClusterPoints[0].detailed_address || currentClusterPoints[currentClusterPoints.length - 1].detailed_address,
          isStoppage: durationMinutes >= stoppageThresholdMinutes,
        });
      } else {
        // Single point, add to moving points
        movingPoints.push(currentClusterPoints[0]);
      }
      
      // Start new cluster with current point
      currentClusterPoints = [point];
      clusterCenter = { lat: point.latitude, lng: point.longitude };
    }
  }
  
  // Finalize last cluster/point
  if (currentClusterPoints.length >= 2) {
    const startTime = new Date(currentClusterPoints[0].event_time);
    const endTime = new Date(currentClusterPoints[currentClusterPoints.length - 1].event_time);
    const durationMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
    
    clusters.push({
      id: `cluster-${currentClusterPoints[0].id}`,
      points: [...currentClusterPoints],
      center: { ...clusterCenter },
      startTime,
      endTime,
      durationMinutes,
      address: currentClusterPoints[0].detailed_address || currentClusterPoints[currentClusterPoints.length - 1].detailed_address,
      isStoppage: durationMinutes >= stoppageThresholdMinutes,
    });
  } else if (currentClusterPoints.length === 1) {
    movingPoints.push(currentClusterPoints[0]);
  }
  
  return { clusters, movingPoints };
}

/**
 * Format duration for display
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
