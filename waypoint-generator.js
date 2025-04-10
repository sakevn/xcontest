/**
 * Waypoint Generator
 * Creates optimized waypoints from IGC flight data
 */
class WaypointGenerator {
    constructor(mapElementId) {
        this.map = null;
        this.mapElementId = mapElementId;
        this.waypoints = [];
        this.waypointMarkers = [];
        this.flightDistance = 0;
        this.optimizationLevels = {
            low: 0.0005, // Base threshold - Approximately every 50-100m for short flights
            medium: 0.001, // Base threshold - Approximately every 100-200m for short flights
            high: 0.003 // Base threshold - Approximately every 300-500m for short flights
        };
        this.currentOptimizationLevel = 'medium';
    }

    /**
     * Generate optimized waypoints from flight data
     * @param {object} flightData - Parsed flight data
     * @param {string} level - Optimization level (low, medium, high)
     * @returns {array} - Array of waypoint objects
     */
    generateWaypoints(flightData, level = 'medium') {
        if (!flightData || !flightData.fixes || flightData.fixes.length === 0) {
            return [];
        }

        // Set optimization level
        this.currentOptimizationLevel = level;
        
        // Calculate total flight distance to adjust waypoint density
        this.flightDistance = this.calculateTotalDistance(flightData.fixes);
        
        // Clear existing waypoints
        this.waypoints = [];
        
        // Get all fixes
        const fixes = flightData.fixes;
        
        // Get maximum number of waypoints based on flight distance and optimization level
        const maxWaypoints = this.getTargetWaypointCount(this.flightDistance, level);
        
        // Always include takeoff point
        const takeoff = fixes[0];
        this.waypoints.push({
            name: 'TAKEOFF',
            lat: takeoff.latitude,
            lng: takeoff.longitude,
            altitude: takeoff.pressureAltitude,
            time: takeoff.time
        });
        
        // Always include landing point
        const landing = fixes[fixes.length - 1];
        
        // If only 2 waypoints are needed, just include takeoff and landing
        if (maxWaypoints <= 0) {
            this.waypoints.push({
                name: 'LANDING',
                lat: landing.latitude,
                lng: landing.longitude,
                altitude: landing.pressureAltitude,
                time: landing.time
            });
            return this.waypoints;
        }
        
        // For more than 2 waypoints, use the Douglas-Peucker simplification approach
        // to find the most significant points along the route
        
        // Step 1: Sample fixes to avoid processing thousands of points
        const sampledFixes = [];
        const sampleRate = Math.max(1, Math.floor(fixes.length / 200)); // Sample at most 200 points
        
        for (let i = 0; i < fixes.length; i += sampleRate) {
            sampledFixes.push(fixes[i]);
        }
        
        // Make sure the last fix is included
        if (sampledFixes[sampledFixes.length - 1] !== fixes[fixes.length - 1]) {
            sampledFixes.push(fixes[fixes.length - 1]);
        }
        
        // Step 2: Define significant turn points and key altitude changes
        const possibleWaypoints = [];
        
        // Turn detection threshold based on optimization level
        const turnThreshold = level === 'low' ? 30 : (level === 'medium' ? 45 : 60);
        
        for (let i = 1; i < sampledFixes.length - 1; i++) {
            const prevFix = sampledFixes[i-1];
            const currentFix = sampledFixes[i];
            const nextFix = sampledFixes[i+1];
            
            // Skip points that are very close to each other
            const distToPrev = this.calculateHaversineDistance(
                prevFix.latitude, prevFix.longitude,
                currentFix.latitude, currentFix.longitude
            );
            
            if (distToPrev < 0.1) { // Skip points less than 100m apart
                continue;
            }
            
            // Calculate course change
            const courseChange = this.calculateCourseChange(
                prevFix.latitude, prevFix.longitude,
                currentFix.latitude, currentFix.longitude,
                nextFix.latitude, nextFix.longitude
            );
            
            // Add as potential waypoint if it's a significant turn
            if (courseChange > turnThreshold) {
                possibleWaypoints.push({
                    fix: currentFix,
                    importance: courseChange * 2, // Weight importance by course change
                    type: 'turn'
                });
            }
            
            // Check for significant altitude changes
            const altChangePrev = Math.abs(currentFix.pressureAltitude - prevFix.pressureAltitude);
            const altChangeNext = Math.abs(nextFix.pressureAltitude - currentFix.pressureAltitude);
            
            if (altChangePrev > 100 && altChangeNext > 100) { // 100m altitude change threshold
                possibleWaypoints.push({
                    fix: currentFix,
                    importance: (altChangePrev + altChangeNext) / 50, // Weight by altitude change
                    type: 'altitude'
                });
            }
        }
        
        // Step 3: Sort waypoints by importance
        possibleWaypoints.sort((a, b) => b.importance - a.importance);
        
        // Step 4: Take the top N most important waypoints
        const selectedWaypoints = possibleWaypoints.slice(0, maxWaypoints);
        
        // Step 5: Sort them by position in the flight path
        selectedWaypoints.sort((a, b) => {
            return fixes.indexOf(a.fix) - fixes.indexOf(b.fix);
        });
        
        // Add selected waypoints
        selectedWaypoints.forEach((waypoint, index) => {
            const namePrefix = waypoint.type === 'turn' ? 'TURN' : 'WP';
            this.waypoints.push({
                name: `${namePrefix}${this.waypoints.length}`,
                lat: waypoint.fix.latitude,
                lng: waypoint.fix.longitude,
                altitude: waypoint.fix.pressureAltitude,
                time: waypoint.fix.time
            });
        });
        
        // Always add landing point at the end
        this.waypoints.push({
            name: 'LANDING',
            lat: landing.latitude,
            lng: landing.longitude,
            altitude: landing.pressureAltitude,
            time: landing.time
        });
        
        return this.waypoints;
    }
    
    /**
     * Calculate the approximate target number of waypoints based on flight distance
     * @param {number} distance - Flight distance in km
     * @param {string} level - Optimization level
     * @returns {number} - Target number of waypoints
     */
    getTargetWaypointCount(distance, level) {
        // Maximum number of waypoints (including TAKEOFF and LANDING)
        const MAX_WAYPOINTS = 15;
        
        // Base number of waypoints for whole flight
        let baseCount;
        
        switch(level) {
            case 'low':
                baseCount = Math.min(12, Math.ceil(distance / 15)); // Approximate 1 point per 15km
                break;
            case 'medium':
                baseCount = Math.min(8, Math.ceil(distance / 25)); // Approximate 1 point per 25km
                break;
            case 'high':
                baseCount = Math.min(5, Math.ceil(distance / 40)); // Approximate 1 point per 40km
                break;
            default:
                baseCount = Math.min(8, Math.ceil(distance / 25));
        }
        
        // Add points for longer flights but cap at maximum
        let finalCount;
        if (distance <= 20) {
            // Short flights: fewer points
            finalCount = Math.max(2, baseCount);
        } else if (distance <= 100) {
            // Medium flights: linear scale with diminishing returns
            finalCount = Math.max(3, Math.min(MAX_WAYPOINTS - 2, baseCount + 1));
        } else if (distance <= 300) {
            // Longer flights: logarithmic scale
            finalCount = Math.max(4, Math.min(MAX_WAYPOINTS - 2, baseCount + 2));
        } else {
            // Very long flights: logarithmic scale capped at maximum
            finalCount = Math.max(5, Math.min(MAX_WAYPOINTS - 2, baseCount + 3));
        }
        
        // Return a value that will keep total waypoints under MAX_WAYPOINTS (including takeoff and landing)
        return Math.min(MAX_WAYPOINTS - 2, finalCount);
    }
    
    /**
     * Calculate the total distance of a flight
     * @param {array} fixes - Array of fix objects
     * @returns {number} - Total distance in kilometers
     */
    calculateTotalDistance(fixes) {
        if (!fixes || fixes.length < 2) return 0;
        
        let totalDistance = 0;
        
        for (let i = 1; i < fixes.length; i++) {
            totalDistance += this.calculateHaversineDistance(
                fixes[i-1].latitude, fixes[i-1].longitude,
                fixes[i].latitude, fixes[i].longitude
            );
        }
        
        return totalDistance;
    }
    
    /**
     * Calculate course change at a point (angle in degrees)
     * @param {number} lat1 - Latitude of first point
     * @param {number} lon1 - Longitude of first point
     * @param {number} lat2 - Latitude of middle point
     * @param {number} lon2 - Longitude of middle point
     * @param {number} lat3 - Latitude of third point
     * @param {number} lon3 - Longitude of third point
     * @returns {number} - Course change in degrees
     */
    calculateCourseChange(lat1, lon1, lat2, lon2, lat3, lon3) {
        // Calculate bearings
        const bearing1 = this.calculateBearing(lat1, lon1, lat2, lon2);
        const bearing2 = this.calculateBearing(lat2, lon2, lat3, lon3);
        
        // Calculate absolute difference in bearing
        let diff = Math.abs(bearing1 - bearing2);
        
        // Normalize to 0-180 degrees
        if (diff > 180) {
            diff = 360 - diff;
        }
        
        return diff;
    }
    
    /**
     * Calculate bearing between two points (in degrees)
     * @param {number} lat1 - Latitude of first point
     * @param {number} lon1 - Longitude of first point
     * @param {number} lat2 - Latitude of second point
     * @param {number} lon2 - Longitude of second point
     * @returns {number} - Bearing in degrees
     */
    calculateBearing(lat1, lon1, lat2, lon2) {
        const lat1Rad = lat1 * Math.PI / 180;
        const lat2Rad = lat2 * Math.PI / 180;
        const lonDiffRad = (lon2 - lon1) * Math.PI / 180;
        
        const y = Math.sin(lonDiffRad) * Math.cos(lat2Rad);
        const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
                 Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(lonDiffRad);
        
        let bearing = Math.atan2(y, x);
        bearing = bearing * 180 / Math.PI;
        bearing = (bearing + 360) % 360; // Normalize to 0-360
        
        return bearing;
    }
    
    /**
     * Convert radians to degrees
     * @param {number} radians - Angle in radians
     * @returns {number} - Angle in degrees
     */
    toDegrees(radians) {
        return radians * 180 / Math.PI;
    }
    
    /**
     * Calculate Haversine distance between two points (accurate for Earth)
     * @param {number} lat1 - Latitude of first point
     * @param {number} lon1 - Longitude of first point
     * @param {number} lat2 - Latitude of second point
     * @param {number} lon2 - Longitude of second point
     * @returns {number} - Distance in kilometers
     */
    calculateHaversineDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Radius of Earth in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
            
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;
        
        return distance;
    }

    /**
     * Display waypoints on the map
     * @param {Object} map - Leaflet map instance
     */
    displayWaypoints(map) {
        this.map = map;
        
        // Clear existing markers
        this.clearWaypoints();
        
        // Add waypoint markers
        this.waypoints.forEach((waypoint, index) => {
            const isEndpoint = index === 0 || index === this.waypoints.length - 1;
            
            // Create marker icon with different colors for takeoff/landing
            const iconColor = isEndpoint ? 
                (index === 0 ? '#4CAF50' : '#F44336') : // Green for takeoff, red for landing
                '#FF9800'; // Orange for waypoints
            
            const marker = L.marker([waypoint.lat, waypoint.lng], {
                title: waypoint.name,
                icon: L.divIcon({
                    className: 'waypoint-marker',
                    html: `<div style="background-color:${iconColor}; width:10px; height:10px; border-radius:50%; border:2px solid white;">
                           <span class="waypoint-label" style="position:absolute; white-space:nowrap; font-size:12px; font-weight:bold; color:${iconColor}; text-shadow:1px 1px 1px white, -1px -1px 1px white, 1px -1px 1px white, -1px 1px 1px white; transform:translate(15px, -5px);">
                           ${waypoint.name}
                           </span>
                           </div>`,
                    iconSize: [14, 14],
                    iconAnchor: [7, 7]
                })
            });
            
            // Add popup with waypoint info
            marker.bindPopup(`
                <strong>${waypoint.name}</strong><br>
                Lat: ${waypoint.lat.toFixed(6)}<br>
                Lng: ${waypoint.lng.toFixed(6)}<br>
                Alt: ${waypoint.altitude}m<br>
                Time: ${waypoint.time}
            `);
            
            marker.addTo(map);
            this.waypointMarkers.push(marker);
        });
        
        // Add waypoint path
        if (this.waypoints.length > 1) {
            const waypointCoords = this.waypoints.map(wp => [wp.lat, wp.lng]);
            const waypointPath = L.polyline(waypointCoords, {
                color: '#FF9800',
                weight: 3,
                opacity: 0.8,
                dashArray: '5, 10'
            }).addTo(map);
            this.waypointMarkers.push(waypointPath);
        }
    }

    /**
     * Clear waypoint markers from map
     */
    clearWaypoints() {
        if (this.map) {
            this.waypointMarkers.forEach(marker => {
                this.map.removeLayer(marker);
            });
            this.waypointMarkers = [];
        }
    }

    /**
     * Generate waypoint data in GPX format
     * @returns {string} - GPX format string
     */
    generateGPX() {
        if (!this.waypoints || this.waypoints.length === 0) {
            return null;
        }
        
        // Create GPX header
        let gpx = '<?xml version="1.0" encoding="UTF-8"?>\n';
        gpx += '<gpx version="1.1" creator="IGC Flight Log Viewer" xmlns="http://www.topografix.com/GPX/1/1">\n';
        
        // Add metadata
        gpx += '  <metadata>\n';
        gpx += `    <name>Optimized Flight Waypoints (${this.currentOptimizationLevel})</name>\n`;
        gpx += `    <time>${new Date().toISOString()}</time>\n`;
        gpx += '  </metadata>\n';
        
        // Add waypoints
        this.waypoints.forEach(waypoint => {
            gpx += '  <wpt lat="' + waypoint.lat.toFixed(6) + '" lon="' + waypoint.lng.toFixed(6) + '">\n';
            gpx += '    <ele>' + waypoint.altitude + '</ele>\n';
            gpx += '    <name>' + waypoint.name + '</name>\n';
            gpx += '  </wpt>\n';
        });
        
        // Add track
        gpx += '  <trk>\n';
        gpx += `    <name>Optimized Flight Path (${this.currentOptimizationLevel})</name>\n`;
        gpx += '    <trkseg>\n';
        
        this.waypoints.forEach(waypoint => {
            gpx += '      <trkpt lat="' + waypoint.lat.toFixed(6) + '" lon="' + waypoint.lng.toFixed(6) + '">\n';
            gpx += '        <ele>' + waypoint.altitude + '</ele>\n';
            gpx += '      </trkpt>\n';
        });
        
        gpx += '    </trkseg>\n';
        gpx += '  </trk>\n';
        
        // Close GPX
        gpx += '</gpx>';
        
        return gpx;
    }

    /**
     * Generate waypoint data in simple CSV format
     * @returns {string} - CSV format string
     */
    generateCSV() {
        if (!this.waypoints || this.waypoints.length === 0) {
            return null;
        }
        
        let csv = 'name,latitude,longitude,altitude\n';
        
        this.waypoints.forEach(waypoint => {
            csv += `${waypoint.name},${waypoint.lat.toFixed(6)},${waypoint.lng.toFixed(6)},${waypoint.altitude}\n`;
        });
        
        return csv;
    }

    /**
     * Generate QR code with waypoint data
     * @param {string} elementId - ID of element to display QR code
     * @param {string} format - Format of data (gpx, csv)
     */
    generateQRCode(elementId, format = 'csv') {
        const qrElement = document.getElementById(elementId);
        if (!qrElement) return;
        
        // Clear previous QR code
        qrElement.innerHTML = '';
        
        // Get data based on format
        let data;
        if (format === 'gpx') {
            data = this.generateGPX();
        } else {
            data = this.generateCSV();
        }
        
        if (!data) {
            qrElement.innerHTML = '<p class="text-danger">No waypoint data available</p>';
            return;
        }
        
        // Check if data is too large for a QR code
        if (data.length > 1500) {
            // Limit data to waypoint coordinates only to reduce size
            data = this.generateCompactCSV();
            
            if (data.length > 1500) {
                qrElement.innerHTML = '<p class="text-danger">Too many waypoints for QR code</p>';
                return;
            }
        }
        
        // Generate QR code
        try {
            // Create a new canvas element
            const canvas = document.createElement('canvas');
            qrElement.appendChild(canvas);
            
            // Generate QR code on the canvas
            QRCode.toCanvas(canvas, data, {
                width: 200,
                margin: 1,
                errorCorrectionLevel: 'M',
                color: {
                    dark: '#000000',
                    light: '#ffffff'
                }
            }, function(error) {
                if (error) {
                    console.error('Error generating QR code:', error);
                    qrElement.innerHTML = '<p class="text-danger">Error generating QR code</p>';
                }
            });
        } catch (error) {
            console.error('QR code generation error:', error);
            qrElement.innerHTML = '<p class="text-danger">Error generating QR code</p>';
        }
    }
    
    /**
     * Generate compact CSV with just essential waypoint data
     * @returns {string} - Compact CSV string
     */
    generateCompactCSV() {
        if (!this.waypoints || this.waypoints.length === 0) {
            return null;
        }
        
        let csv = '';
        
        this.waypoints.forEach(waypoint => {
            csv += `${waypoint.name},${waypoint.lat.toFixed(5)},${waypoint.lng.toFixed(5)}\n`;
        });
        
        return csv;
    }

    /**
     * Calculate distance between two points
     * @param {number} lat1 - Latitude of first point
     * @param {number} lon1 - Longitude of first point
     * @param {number} lat2 - Latitude of second point
     * @param {number} lon2 - Longitude of second point
     * @returns {number} - Distance in degrees (approx)
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        // Simple Euclidean distance for optimization purpose
        // For real distance calculation, use Haversine formula
        const dx = lat2 - lat1;
        const dy = lon2 - lon1;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    /**
     * Convert degrees to radians
     * @param {number} degrees - Angle in degrees
     * @returns {number} - Angle in radians
     */
    toRadians(degrees) {
        return degrees * Math.PI / 180;
    }
}