/**
 * Main Application Script
 * Controls the IGC flight log viewer with 500m altitude scale
 */
document.addEventListener('DOMContentLoaded', () => {
    // Initialize classes
    const igcParser = new IGCParser();
    const altitudeDisplay = new AltitudeDisplay('altitudeChart');
    const flightDisplay = new FlightDisplay('map', 'flightInfo');
    const waypointGenerator = new WaypointGenerator('map');

    // Current flight data
    let currentFlightData = null;

    // Get DOM elements
    const igcFileInput = document.getElementById('igcFileInput');
    const igcUrlInput = document.getElementById('igcUrl');
    const loadIgcButton = document.getElementById('loadIgcBtn');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const showWaypointsSwitch = document.getElementById('showWaypointsSwitch');
    const optimizationLevel = document.getElementById('optimizationLevel');
    const generateWaypointsBtn = document.getElementById('generateWaypointsBtn');
    const waypointStatistics = document.getElementById('waypointStatistics');
    const generateQRBtn = document.getElementById('generateQRBtn');
    const formatCSV = document.getElementById('formatCSV');
    const formatGPX = document.getElementById('formatGPX');
    
    // Last successfully loaded content (for resize handling)
    let lastLoadedIgcContent = '';

    /**
     * Process IGC content
     * @param {string} igcContent - Raw IGC file content
     */
    function processIgcContent(igcContent) {
        try {
            // Parse IGC file
            const flightData = igcParser.parse(igcContent);

            // Save current flight data
            currentFlightData = flightData;

            // Display flight data
            flightDisplay.displayFlight(flightData);
            altitudeDisplay.render(flightData);

            // Reset waypoint elements
            showWaypointsSwitch.checked = false;
            waypointStatistics.innerHTML = '<p class="no-data-message">Generate waypoints to see statistics</p>';
            document.getElementById('qrCodeContainer').innerHTML = '';

            // Save IGC content for resize handling
            lastLoadedIgcContent = igcContent;

            // Hide loading indicator
            loadingIndicator.classList.add('d-none');
        } catch (error) {
            console.error('Error processing IGC file:', error);
            alert('Lỗi xử lý file IGC: ' + error.message);
            loadingIndicator.classList.add('d-none');
        }
    }

    // File input change event listener
    igcFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;
        
        // Show loading indicator
        loadingIndicator.classList.remove('d-none');
        
        // Read the file
        const reader = new FileReader();
        reader.onload = (e) => {
            const igcContent = e.target.result;
            processIgcContent(igcContent);
        };
        reader.onerror = () => {
            console.error('Error reading file');
            alert('Lỗi đọc file');
            loadingIndicator.classList.add('d-none');
        };
        reader.readAsText(file);
    });

    // Add load button event listener for URL loading
    loadIgcButton.addEventListener('click', () => {
        const url = igcUrlInput.value.trim();
        if (!url) {
            alert('Vui lòng nhập đường dẫn đến file IGC');
            return;
        }

        // Show loading indicator
        loadingIndicator.classList.remove('d-none');

        // Fetch the IGC file from the URL
        fetch(url, {
            method: 'GET',
            cache: 'no-cache',
            headers: {
                'Accept': 'text/plain'
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.text();
        })
        .then(igcContent => {
            processIgcContent(igcContent);
        })
        .catch(error => {
            console.error('Error fetching IGC file:', error);
            alert('Lỗi tải file IGC: ' + error.message);
            loadingIndicator.classList.add('d-none');
        });
    });

    // Add enter key press event for the URL input
    igcUrlInput.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
            loadIgcButton.click();
        }
    });

    // Generate waypoints button click handler
    generateWaypointsBtn.addEventListener('click', () => {
        if (!currentFlightData) {
            alert('Please load a flight first');
            return;
        }

        // Get selected optimization level
        const level = optimizationLevel.value;

        // Generate waypoints
        const waypoints = waypointGenerator.generateWaypoints(currentFlightData, level);

        // Update statistics
        updateWaypointStatistics(waypoints);

        // Show waypoints if toggled
        if (showWaypointsSwitch.checked) {
            waypointGenerator.displayWaypoints(flightDisplay.map);
        }
    });

    // Waypoint visibility toggle
    showWaypointsSwitch.addEventListener('change', () => {
        if (!currentFlightData) return;

        if (showWaypointsSwitch.checked) {
            // If no waypoints yet, generate them first
            if (waypointGenerator.waypoints.length === 0) {
                generateWaypointsBtn.click();
            } else {
                waypointGenerator.displayWaypoints(flightDisplay.map);
            }
        } else {
            waypointGenerator.clearWaypoints();
        }
    });

    // Optimization level change
    optimizationLevel.addEventListener('change', () => {
        if (waypointGenerator.waypoints.length > 0 && showWaypointsSwitch.checked) {
            // Regenerate waypoints with new level
            generateWaypointsBtn.click();
        }
    });

    // Generate QR Code button click handler
    generateQRBtn.addEventListener('click', () => {
        if (waypointGenerator.waypoints.length === 0) {
            alert('Please generate waypoints first');
            return;
        }

        // Determine format
        const format = formatGPX.checked ? 'gpx' : 'csv';

        // Generate QR code
        waypointGenerator.generateQRCode('qrCodeContainer', format);
    });

    // Update waypoint statistics display
    function updateWaypointStatistics(waypoints) {
        if (!waypoints || waypoints.length === 0) {
            waypointStatistics.innerHTML = '<p class="text-danger">No waypoints generated</p>';
            return;
        }

        const level = optimizationLevel.value;
        const flightDist = waypointGenerator.flightDistance.toFixed(1);
        
        waypointStatistics.innerHTML = `
            <table class="table table-sm">
                <tbody>
                    <tr>
                        <td><strong>Optimization:</strong></td>
                        <td>${level.charAt(0).toUpperCase() + level.slice(1)}</td>
                    </tr>
                    <tr>
                        <td><strong>Flight Distance:</strong></td>
                        <td>${flightDist} km</td>
                    </tr>
                    <tr>
                        <td><strong>Waypoints:</strong></td>
                        <td>${waypoints.length}</td>
                    </tr>
                    <tr>
                        <td><strong>Start:</strong></td>
                        <td>${waypoints[0].name}</td>
                    </tr>
                    <tr>
                        <td><strong>End:</strong></td>
                        <td>${waypoints[waypoints.length - 1].name}</td>
                    </tr>
                </tbody>
            </table>
        `;
    }

    // Handle window resize
    window.addEventListener('resize', debounce(() => {
        if (lastLoadedIgcContent) {
            try {
                // We already have the IGC content saved, no need to fetch again
                const flightData = igcParser.parse(lastLoadedIgcContent);
                altitudeDisplay.render(flightData);
                
                // Reapply waypoints if visible
                if (showWaypointsSwitch && showWaypointsSwitch.checked && 
                    waypointGenerator.waypoints.length > 0) {
                    waypointGenerator.displayWaypoints(flightDisplay.map);
                }
            } catch (error) {
                console.error('Error reloading on resize:', error);
            }
        }
    }, 250));

    /**
     * Debounce function to limit how often a function is called
     * @param {Function} func - The function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} - Debounced function
     */
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), wait);
        };
    }
});
