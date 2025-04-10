/**
 * Altitude Display
 * This class handles displaying altitude data with a 500m scale
 */
class AltitudeDisplay {
    /**
     * Create an altitude display handler
     * @param {string} elementId - The ID of the element to render the altitude chart in
     */
    constructor(elementId) {
        this.elementId = elementId;
        this.chart = null;
        this.tooltip = null;
        
        // Scale factor for altitude (500m)
        this.altitudeScaleFactor = 500;
        
        // Initialize tooltip
        this.tooltip = d3.select("body")
            .append("div")
            .attr("class", "tooltip")
            .style("opacity", 0);
    }

    /**
     * Render the altitude chart with the given flight data
     * @param {object} flightData - Parsed flight data from IGCParser
     */
    render(flightData) {
        if (!flightData || !flightData.fixes || flightData.fixes.length === 0) {
            return;
        }

        const element = document.getElementById(this.elementId);
        if (!element) {
            console.error(`Element with ID ${this.elementId} not found`);
            return;
        }

        // Clear previous chart
        element.innerHTML = '';

        // Get dimensions
        const margin = {top: 20, right: 30, bottom: 30, left: 60};
        const width = element.clientWidth - margin.left - margin.right;
        const height = element.clientHeight - margin.top - margin.bottom;

        // Create SVG
        const svg = d3.select(element)
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // Extract data
        const fixes = flightData.fixes;
        const timeData = fixes.map(fix => fix.timestamp - fixes[0].timestamp);
        const altitudeData = fixes.map(fix => fix.pressureAltitude);

        // Scales
        const xScale = d3.scaleLinear()
            .domain([0, d3.max(timeData)])
            .range([0, width]);

        // Determine altitude range with adjusted scale
        // Key change: we divide by 500 to implement the 500m scale
        const minAltitude = Math.floor(d3.min(altitudeData) / this.altitudeScaleFactor) * this.altitudeScaleFactor;
        const maxAltitude = Math.ceil(d3.max(altitudeData) / this.altitudeScaleFactor) * this.altitudeScaleFactor;

        const yScale = d3.scaleLinear()
            .domain([minAltitude, maxAltitude])
            .range([height, 0])
            .nice();

        // Axes
        const xAxis = d3.axisBottom(xScale)
            .tickFormat(d => this.formatTime(d));

        const yAxis = d3.axisLeft(yScale)
            .tickFormat(d => {
                // Show altitude with 500m scale
                return `${(d / this.altitudeScaleFactor).toFixed(1)}`;
            });

        // Add X axis
        svg.append("g")
            .attr("class", "altitude-axis")
            .attr("transform", `translate(0,${height})`)
            .call(xAxis)
            .append("text")
            .attr("fill", "#000")
            .attr("x", width / 2)
            .attr("y", margin.bottom)
            .attr("text-anchor", "middle")
            .text("Time (hh:mm)");

        // Add Y axis
        svg.append("g")
            .attr("class", "altitude-axis")
            .call(yAxis)
            .append("text")
            .attr("fill", "#000")
            .attr("transform", "rotate(-90)")
            .attr("y", -margin.left + 15)
            .attr("x", -height / 2)
            .attr("text-anchor", "middle")
            .text("Altitude (x500m)");

        // Add Y-axis grid lines
        svg.append("g")
            .attr("class", "altitude-grid")
            .call(yAxis
                .tickSize(-width)
                .tickFormat("")
            );

        // Create line generator
        const line = d3.line()
            .x((d, i) => xScale(timeData[i]))
            .y(d => yScale(d))
            .curve(d3.curveMonotoneX);

        // Create area generator
        const area = d3.area()
            .x((d, i) => xScale(timeData[i]))
            .y0(height)
            .y1(d => yScale(d))
            .curve(d3.curveMonotoneX);

        // Add the area
        svg.append("path")
            .datum(altitudeData)
            .attr("class", "altitude-area")
            .attr("d", area);

        // Add the line path
        svg.append("path")
            .datum(altitudeData)
            .attr("class", "altitude-path")
            .attr("d", line);

        // Add dots for data points with tooltips
        const dots = svg.selectAll(".dot")
            .data(altitudeData)
            .enter()
            .append("circle")
            .attr("class", "altitude-dot")
            .attr("cx", (d, i) => xScale(timeData[i]))
            .attr("cy", d => yScale(d))
            .attr("r", 0) // Set to 0 initially to make them invisible
            .style("fill", "#4682b4")
            .style("opacity", 0.7);

        // Add invisible larger areas for mouseover
        svg.selectAll(".hover-area")
            .data(altitudeData)
            .enter()
            .append("circle")
            .attr("class", "hover-area")
            .attr("cx", (d, i) => xScale(timeData[i]))
            .attr("cy", d => yScale(d))
            .attr("r", 8)
            .style("fill", "transparent")
            .style("opacity", 0)
            .on("mouseover", (event, d, i) => {
                const index = altitudeData.indexOf(d);
                const time = this.formatTime(timeData[index]);
                const scaledAltitude = (d / this.altitudeScaleFactor).toFixed(2);
                
                this.tooltip.transition()
                    .duration(200)
                    .style("opacity", .9);
                    
                this.tooltip.html(`
                    <strong>Time:</strong> ${time}<br>
                    <strong>Altitude:</strong> ${scaledAltitude} x 500m<br>
                    <strong>Actual:</strong> ${d}m
                `)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", () => {
                this.tooltip.transition()
                    .duration(500)
                    .style("opacity", 0);
            });

        // Add title
        svg.append("text")
            .attr("x", width / 2)
            .attr("y", 0 - (margin.top / 2))
            .attr("text-anchor", "middle")
            .style("font-size", "16px")
            .style("font-weight", "bold")
            .text("Flight Altitude Profile (500m Scale)");

        // Add scale note
        svg.append("text")
            .attr("x", width - 150)
            .attr("y", 0)
            .attr("text-anchor", "start")
            .style("font-size", "12px")
            .style("fill", "#666")
            .text("Scale: 1 unit = 500m");
    }

    /**
     * Format seconds into HH:MM
     * @param {number} seconds - Time in seconds
     * @returns {string} - Formatted time
     */
    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
}
