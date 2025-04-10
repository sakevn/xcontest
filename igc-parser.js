/**
 * IGC Parser
 * A library for parsing IGC flight logs
 */
class IGCParser {
    constructor() {
        // Constants for IGC parsing
        this.METER_TO_FEET = 3.2808399;
        this.KNOTS_TO_KMH = 1.852;
    }

    /**
     * Parse an IGC file content
     * @param {string} igcContent - The raw content of the IGC file
     * @returns {object} - Parsed flight data
     */
    parse(igcContent) {
        // Split the IGC file by lines
        const lines = igcContent.split('\n');
        let flightData = {
            header: this.parseHeader(lines),
            fixes: [],
            task: null
        };

        // Process each line
        lines.forEach(line => {
            if (line.startsWith('B')) { // B records contain fix data
                const fix = this.parseBRecord(line);
                if (fix) {
                    flightData.fixes.push(fix);
                }
            } else if (line.startsWith('C')) { // C records contain task data
                // Task parsing would go here if needed
            }
        });

        // Calculate additional flight statistics
        this.calculateFlightStats(flightData);

        return flightData;
    }

    /**
     * Parse the header information from IGC file
     * @param {string[]} lines - Array of IGC file lines
     * @returns {object} - Header information
     */
    parseHeader(lines) {
        const header = {
            date: null,
            pilot: 'Unknown',
            gliderType: 'Unknown',
            gliderReg: 'Unknown',
            gpsDatum: 'WGS84',
            firmwareVersion: null,
            hardwareVersion: null,
            loggerType: 'Unknown',
            competitionId: null
        };

        lines.forEach(line => {
            if (line.startsWith('HFDTE')) {
                // Date format: HFDTEDATE:DDMMYY
                const match = line.match(/HFDTE(\d{2})(\d{2})(\d{2})/);
                if (match) {
                    const day = match[1];
                    const month = match[2];
                    const year = '20' + match[3]; // Assuming all files are post-2000
                    header.date = `${year}-${month}-${day}`;
                }
            } else if (line.match(/H[FO]PLT/)) {
                // Pilot
                const match = line.match(/H[FO]PLT.*?:(.*)/);
                if (match && match[1].trim()) {
                    header.pilot = match[1].trim();
                }
            } else if (line.match(/H[FO]GTY/)) {
                // Glider type
                const match = line.match(/H[FO]GTY.*?:(.*)/);
                if (match && match[1].trim()) {
                    header.gliderType = match[1].trim();
                }
            } else if (line.match(/H[FO]GID/)) {
                // Glider ID
                const match = line.match(/H[FO]GID.*?:(.*)/);
                if (match && match[1].trim()) {
                    header.gliderReg = match[1].trim();
                }
            } else if (line.match(/H[FO]CID/)) {
                // Competition ID
                const match = line.match(/H[FO]CID.*?:(.*)/);
                if (match && match[1].trim()) {
                    header.competitionId = match[1].trim();
                }
            } else if (line.startsWith('HFRFW')) {
                // Firmware version
                const match = line.match(/HFRFW.*?:(.*)/);
                if (match && match[1].trim()) {
                    header.firmwareVersion = match[1].trim();
                }
            } else if (line.startsWith('HFRHW')) {
                // Hardware version
                const match = line.match(/HFRHW.*?:(.*)/);
                if (match && match[1].trim()) {
                    header.hardwareVersion = match[1].trim();
                }
            }
        });

        return header;
    }

    /**
     * Parse a B record (fix) from the IGC file
     * @param {string} line - B record line
     * @returns {object|null} - Parsed fix data or null if invalid
     */
    parseBRecord(line) {
        // B record format: B,time,lat,long,validity,pressure alt,gnss alt,other optional fields
        // Example: B1101355206343N00006198WA0058700614
        if (line.length < 35) {
            return null; // Invalid B record
        }

        // Extract time
        const time = line.substr(1, 6);
        const hours = parseInt(time.substr(0, 2), 10);
        const minutes = parseInt(time.substr(2, 2), 10);
        const seconds = parseInt(time.substr(4, 2), 10);

        // Extract latitude
        const latDegrees = parseInt(line.substr(7, 2), 10);
        const latMinutes = parseInt(line.substr(9, 2), 10);
        const latDecimalMinutes = parseInt(line.substr(11, 3), 10) / 1000;
        const latDirection = line.charAt(14) === 'N' ? 1 : -1;
        const latitude = latDirection * (latDegrees + (latMinutes + latDecimalMinutes) / 60);

        // Extract longitude
        const lonDegrees = parseInt(line.substr(15, 3), 10);
        const lonMinutes = parseInt(line.substr(18, 2), 10);
        const lonDecimalMinutes = parseInt(line.substr(20, 3), 10) / 1000;
        const lonDirection = line.charAt(23) === 'E' ? 1 : -1;
        const longitude = lonDirection * (lonDegrees + (lonMinutes + lonDecimalMinutes) / 60);

        // Extract validity
        const validity = line.charAt(24);

        // Extract altitudes
        const pressureAltitude = parseInt(line.substr(25, 5), 10);
        const gnssAltitude = parseInt(line.substr(30, 5), 10);

        return {
            time: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`,
            timestamp: hours * 3600 + minutes * 60 + seconds,
            latitude,
            longitude,
            validity: validity === 'A', // 'A' is valid, 'V' is void
            pressureAltitude,
            gnssAltitude
        };
    }

    /**
     * Calculate flight statistics based on fixes
     * @param {object} flightData - Flight data with fixes
     */
    calculateFlightStats(flightData) {
        const fixes = flightData.fixes;
        if (!fixes || fixes.length === 0) {
            flightData.stats = {
                duration: 0,
                startTime: null,
                endTime: null,
                maxAltitude: 0,
                minAltitude: 0,
                takeoffAltitude: 0,
                landingAltitude: 0,
                maxClimb: 0,
                maxSink: 0,
                distance: 0
            };
            return;
        }

        // Find start and end times
        const startTime = fixes[0].time;
        const endTime = fixes[fixes.length - 1].time;
        
        // Calculate duration in seconds
        const startTimestamp = fixes[0].timestamp;
        const endTimestamp = fixes[fixes.length - 1].timestamp;
        let duration = endTimestamp - startTimestamp;
        if (duration < 0) {
            duration += 24 * 3600; // Handle flights crossing midnight
        }
        
        // Find altitude extremes
        let maxAltitude = -Infinity;
        let minAltitude = Infinity;
        
        fixes.forEach(fix => {
            maxAltitude = Math.max(maxAltitude, fix.pressureAltitude);
            minAltitude = Math.min(minAltitude, fix.pressureAltitude);
        });
        
        // Get takeoff and landing altitudes
        const takeoffAltitude = fixes[0].pressureAltitude;
        const landingAltitude = fixes[fixes.length - 1].pressureAltitude;
        
        // Calculate max climb and sink rates
        let maxClimb = 0;
        let maxSink = 0;
        
        for (let i = 1; i < fixes.length; i++) {
            const timeDiff = fixes[i].timestamp - fixes[i-1].timestamp;
            if (timeDiff > 0) {
                const altDiff = fixes[i].pressureAltitude - fixes[i-1].pressureAltitude;
                const rate = altDiff / timeDiff * 60; // Convert to meters per minute
                maxClimb = Math.max(maxClimb, rate);
                maxSink = Math.min(maxSink, rate);
            }
        }
        
        // Calculate distance flown (using Haversine formula)
        let distance = 0;
        for (let i = 1; i < fixes.length; i++) {
            distance += this.calculateDistance(
                fixes[i-1].latitude, fixes[i-1].longitude,
                fixes[i].latitude, fixes[i].longitude
            );
        }
        
        flightData.stats = {
            duration,
            startTime,
            endTime,
            maxAltitude,
            minAltitude,
            takeoffAltitude,
            landingAltitude,
            maxClimb,
            maxSink: Math.abs(maxSink),
            distance
        };
    }

    /**
     * Calculate distance between two coordinates using Haversine formula
     * @param {number} lat1 - Latitude of first point
     * @param {number} lon1 - Longitude of first point
     * @param {number} lat2 - Latitude of second point
     * @param {number} lon2 - Longitude of second point
     * @returns {number} - Distance in kilometers
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in km
        const dLat = this.toRadians(lat2 - lat1);
        const dLon = this.toRadians(lon2 - lon1);
        
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
            
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;
        
        return distance;
    }

    /**
     * Convert degrees to radians
     * @param {number} degrees - Angle in degrees
     * @returns {number} - Angle in radians
     */
    toRadians(degrees) {
        return degrees * Math.PI / 180;
    }

    /**
     * Format a duration in seconds to HH:MM:SS
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
