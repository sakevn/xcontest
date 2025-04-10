/**
 * Flight Display
 * This class handles displaying flight path on a map and flight information
 */
class FlightDisplay {
    /**
     * Create a flight display handler
     * @param {string} mapElementId - The ID of the element to render the map in
     * @param {string} infoElementId - The ID of the element to display flight info
     */
    constructor(mapElementId, infoElementId) {
        this.mapElementId = mapElementId;
        this.infoElementId = infoElementId;
        this.map = null;
        this.flightPath = null;
        this.markers = {
            start: null,
            end: null
        };
        this.initMap();
    }

    /**
     * Initialize the Leaflet map
     */
    initMap() {
        // Initialize the map
        this.map = L.map(this.mapElementId).setView([51.505, -0.09], 13);
        
        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(this.map);
    }

    /**
     * Display the flight path and information
     * @param {object} flightData - Parsed flight data from IGCParser
     */
    displayFlight(flightData) {
        if (!flightData || !flightData.fixes || flightData.fixes.length === 0) {
            return;
        }

        // Clear previous flight display
        this.clearFlight();
        
        // Get coordinates for flight path
        const coordinates = flightData.fixes.map(fix => [fix.latitude, fix.longitude]);
        
        // Create a polyline for the flight path
        this.flightPath = L.polyline(coordinates, {
            color: '#4682b4',
            weight: 3,
            opacity: 0.8
        }).addTo(this.map);
        
        // Add takeoff and landing markers
        const startPoint = coordinates[0];
        const endPoint = coordinates[coordinates.length - 1];
        
        this.markers.start = L.marker(startPoint, {
            title: 'Takeoff',
            icon: L.divIcon({
                className: 'takeoff-marker',
                html: '<div style="background-color:#4CAF50; width:12px; height:12px; border-radius:50%; border:2px solid white;"></div>',
                iconSize: [16, 16],
                iconAnchor: [8, 8]
            })
        }).addTo(this.map);
        
        this.markers.end = L.marker(endPoint, {
            title: 'Landing',
            icon: L.divIcon({
                className: 'landing-marker',
                html: '<div style="background-color:#F44336; width:12px; height:12px; border-radius:50%; border:2px solid white;"></div>',
                iconSize: [16, 16],
                iconAnchor: [8, 8]
            })
        }).addTo(this.map);
        
        // Fit the map to show the entire flight path
        this.map.fitBounds(this.flightPath.getBounds(), {
            padding: [30, 30]
        });
        
        // Display flight information
        this.displayFlightInfo(flightData);
    }

    /**
     * Clear the flight path and markers from the map
     */
    clearFlight() {
        if (this.flightPath) {
            this.map.removeLayer(this.flightPath);
            this.flightPath = null;
        }
        
        if (this.markers.start) {
            this.map.removeLayer(this.markers.start);
            this.markers.start = null;
        }
        
        if (this.markers.end) {
            this.map.removeLayer(this.markers.end);
            this.markers.end = null;
        }
    }

    /**
     * Display flight information
     * @param {object} flightData - Parsed flight data
     */
    displayFlightInfo(flightData) {
        const infoElement = document.getElementById(this.infoElementId);
        if (!infoElement) {
            console.error(`Element with ID ${this.infoElementId} not found`);
            return;
        }
        
        const header = flightData.header;
        const stats = flightData.stats;
        
        // Format duration
        const duration = this.formatDuration(stats.duration);
        
        // Format altitudes with 500m scale
        const altitudeScaleFactor = 500;
        const maxAltitudeScaled = (stats.maxAltitude / altitudeScaleFactor).toFixed(2);
        const minAltitudeScaled = (stats.minAltitude / altitudeScaleFactor).toFixed(2);
        
        // Create HTML for flight info
        const html = `
            <table class="table table-sm">
                <tbody>
                    <tr>
                        <td><strong>Date:</strong></td>
                        <td>${header.date || 'Unknown'}</td>
                    </tr>
                    <tr>
                        <td><strong>Pilot:</strong></td>
                        <td>${header.pilot}</td>
                    </tr>
                    <tr>
                        <td><strong>Glider:</strong></td>
                        <td>${header.gliderType} (${header.gliderReg})</td>
                    </tr>
                    <tr>
                        <td><strong>Duration:</strong></td>
                        <td>${duration}</td>
                    </tr>
                    <tr>
                        <td><strong>Distance:</strong></td>
                        <td>${stats.distance.toFixed(2)} km</td>
                    </tr>
                    <tr>
                        <td><strong>Max Altitude:</strong></td>
                        <td>${maxAltitudeScaled} <small class="text-muted">x 500m</small> (${stats.maxAltitude}m)</td>
                    </tr>
                    <tr>
                        <td><strong>Min Altitude:</strong></td>
                        <td>${minAltitudeScaled} <small class="text-muted">x 500m</small> (${stats.minAltitude}m)</td>
                    </tr>
                    <tr>
                        <td><strong>Max Climb:</strong></td>
                        <td>${stats.maxClimb.toFixed(1)} m/min</td>
                    </tr>
                    <tr>
                        <td><strong>Max Sink:</strong></td>
                        <td>${stats.maxSink.toFixed(1)} m/min</td>
                    </tr>
                </tbody>
            </table>
        `;
        
        infoElement.innerHTML = html;
    }

    /**
     * Format duration in seconds to HH:MM:SS
     * @param {number} seconds - Duration in seconds
     * @returns {string} - Formatted duration
     */
    formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
}
