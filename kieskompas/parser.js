/**
 * Modern JavaScript module for loading pre-parsed Kieskompas data
 */

class KieskompasParser {
  constructor(dataPath) {
    this.dataPath = dataPath;
    this.data = null;
  }

  /**
   * Load the pre-parsed JSON data
   */
  async load() {
    try {
      const response = await fetch(this.dataPath);
      this.data = await response.json();
      return this.data;
    } catch (error) {
      console.error("Error loading data:", error);
      throw error;
    }
  }

  /**
   * Get all data in a structured format
   */
  getAllData() {
    return this.data;
  }
}

// UI Controller
class UIController {
  constructor(parser) {
    this.parser = parser;
    this.partyPicker = document.getElementById("partyPicker");
    this.svgDisplay = document.getElementById("svgDisplay");
    this.selectedCount = document.getElementById("selectedCount");
    this.weightedAverageCheckbox = document.getElementById("weighted-average");
    this.searchBox = document.getElementById("searchBox");
    this.coalitionStats = document.getElementById("coalitionStats");
    this.coalitionStatsContent = document.getElementById(
      "coalitionStatsContent",
    );

    this.parties = [];
    this.selectedParties = new Set();

    this.init();
  }

  init() {
    // Auto-load on page load
    this.handleParse();

    // Add event listener for weighted average checkbox
    if (this.weightedAverageCheckbox) {
      this.weightedAverageCheckbox.addEventListener("change", () =>
        this.handlePartySelection(),
      );
    }

    // Add event listener for search box
    if (this.searchBox) {
      this.searchBox.addEventListener("input", () => this.filterParties());
    }
  }

  /**
   * Get party short names from URL query parameters
   */
  getQueryParties() {
    const params = new URLSearchParams(window.location.search);
    const partiesParam = params.get("parties");
    if (!partiesParam) return [];

    // Support both comma-separated and repeated parameters
    return partiesParam.split(",").map((p) => p.trim().toUpperCase());
  }

  async handleParse() {
    try {
      this.partyPicker.innerHTML = "<p>Loading data...</p>";

      await this.parser.load();
      const data = this.parser.getAllData();

      // Sort parties by seats (descending)
      this.parties = data.parties.sort((a, b) => {
        const seatsA = a.electionResults2025 ? a.electionResults2025.seats : 0;
        const seatsB = b.electionResults2025 ? b.electionResults2025.seats : 0;
        return seatsB - seatsA;
      });
      this.displayPartyPicker(this.parties);

      // Wait for SVG to load before pre-selecting parties
      await this.displaySVG();

      // Pre-select parties from query params
      this.preSelectFromQuery();
    } catch (error) {
      this.partyPicker.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
    }
  }

  /**
   * Pre-select parties based on query parameters
   */
  preSelectFromQuery() {
    const queryParties = this.getQueryParties();
    if (queryParties.length === 0) return;

    // Find and check matching party checkboxes
    this.parties.forEach((party, index) => {
      const shortNameUpper = party.shortName.toUpperCase();
      if (queryParties.includes(shortNameUpper)) {
        const checkbox = document.getElementById(`party-${index}`);
        if (checkbox) {
          checkbox.checked = true;
        }
      }
    });

    // Use requestAnimationFrame to ensure the SVG is fully rendered before drawing the marker
    requestAnimationFrame(() => {
      this.handlePartySelection();
    });
  }

  displayPartyPicker(parties) {
    const html = parties
      .map(
        (party, index) => `
        <div class="party-checkbox" data-party-name="${party.name.toLowerCase()}" data-party-short="${party.shortName.toLowerCase()}">
          <input 
            type="checkbox" 
            id="party-${index}" 
            data-index="${index}"
          />
          <label for="party-${index}">
            <div class="party-info">
              <div>
                <strong>${party.name}</strong> 
                <span style="color: #666; font-weight: normal;">(${party.shortName})</span>
              </div>
              <small>${
                party.politicalPosition.horizontal
                  ? `${party.politicalPosition.horizontal.value}% ${party.politicalPosition.horizontal.direction}`
                  : "N/A"
              }, ${
                party.politicalPosition.vertical
                  ? `${party.politicalPosition.vertical.value}% ${party.politicalPosition.vertical.direction}`
                  : "N/A"
              }</small>
            </div>
            ${
              party.electionResults2025
                ? `<span class="seats-badge">${party.electionResults2025.seats} ${party.electionResults2025.seats === 1 ? "zetel" : "zetels"}</span>`
                : ""
            }
          </label>
        </div>
      `,
      )
      .join("");

    this.partyPicker.innerHTML = html;

    // Add event listeners to all checkboxes
    parties.forEach((party, index) => {
      const checkbox = document.getElementById(`party-${index}`);
      checkbox.addEventListener("change", () => this.handlePartySelection());
    });
  }

  filterParties() {
    const searchTerm = this.searchBox.value.toLowerCase();
    const partyElements = this.partyPicker.querySelectorAll(".party-checkbox");

    partyElements.forEach((element) => {
      const partyName = element.dataset.partyName;
      const partyShort = element.dataset.partyShort;

      if (partyName.includes(searchTerm) || partyShort.includes(searchTerm)) {
        element.style.display = "";
      } else {
        element.style.display = "none";
      }
    });
  }

  handlePartySelection() {
    // Update selected parties set
    this.selectedParties.clear();
    const checkboxes = this.partyPicker.querySelectorAll(
      'input[type="checkbox"]',
    );

    checkboxes.forEach((checkbox) => {
      if (checkbox.checked) {
        const index = parseInt(checkbox.dataset.index);
        this.selectedParties.add(index);
      }
    });

    // Update selected count with short names and total seats
    const count = this.selectedParties.size;
    let selectedShortNamesArray = [];

    if (count === 0) {
      this.selectedCount.textContent = "Geselecteerd: geen";
      this.coalitionStats.style.display = "none";
    } else {
      selectedShortNamesArray = Array.from(this.selectedParties).map(
        (index) => this.parties[index].shortName,
      );

      const selectedShortNames = selectedShortNamesArray.join(", ");

      // Calculate total seats
      const totalSeats = Array.from(this.selectedParties).reduce(
        (sum, index) => {
          const party = this.parties[index];
          const seats = party.electionResults2025
            ? party.electionResults2025.seats
            : 0;
          return sum + seats;
        },
        0,
      );

      this.selectedCount.textContent = `Geselecteerd: ${selectedShortNames}`;

      // Update coalition statistics
      this.updateCoalitionStats(totalSeats);
    }

    // Update URL query parameters
    this.updateQueryParams(selectedShortNamesArray);

    // Update the compass visualization
    this.updateCompassMarker();
  }

  updateQueryParams(selectedShortNames) {
    const url = new URL(window.location);

    if (selectedShortNames.length === 0) {
      // Remove the parties parameter if no parties are selected
      url.searchParams.delete("parties");
    } else {
      // Set the parties parameter with comma-separated short names
      url.searchParams.set("parties", selectedShortNames.join(","));
    }

    // Update the URL without reloading the page
    window.history.replaceState({}, "", url);
  }

  updateCoalitionStats(totalSeats) {
    if (this.selectedParties.size === 0) {
      this.coalitionStats.style.display = "none";
      return;
    }

    // Calculate weighted or simple average of political positions
    const useWeighted =
      this.weightedAverageCheckbox && this.weightedAverageCheckbox.checked;

    let sumHorizontal = 0;
    let sumVertical = 0;
    let totalWeight = 0;

    this.selectedParties.forEach((index) => {
      const party = this.parties[index];
      const weight =
        useWeighted && party.electionResults2025
          ? party.electionResults2025.seats
          : 1;

      // Use the politicalPosition values directly
      const horizontalValue = party.politicalPosition.horizontal
        ? party.politicalPosition.horizontal.value
        : 0;
      const verticalValue = party.politicalPosition.vertical
        ? party.politicalPosition.vertical.value
        : 0;

      // Track direction (left is negative, right is positive)
      const horizontalSigned =
        party.politicalPosition.horizontal?.direction === "rechts"
          ? horizontalValue
          : -horizontalValue;
      const verticalSigned =
        party.politicalPosition.vertical?.direction === "conservatief"
          ? verticalValue
          : -verticalValue;

      sumHorizontal += horizontalSigned * weight;
      sumVertical += verticalSigned * weight;
      totalWeight += weight;
    });

    const avgHorizontal = sumHorizontal / totalWeight;
    const avgVertical = sumVertical / totalWeight;

    // Determine direction and absolute value
    const horizontalLabel = avgHorizontal >= 0 ? "rechts" : "links";
    const verticalLabel = avgVertical >= 0 ? "conservatief" : "progressief";
    const horizontalValue = Math.abs(avgHorizontal);
    const verticalValue = Math.abs(avgVertical);

    const html = `
      <span class="coalition-stats-item">${totalSeats} zetels</span>
      <span class="coalition-stats-item">${horizontalValue.toFixed(1)}% ${horizontalLabel}</span>
      <span class="coalition-stats-item">${verticalValue.toFixed(1)}% ${verticalLabel}</span>
    `;

    this.coalitionStatsContent.innerHTML = html;
    this.coalitionStats.style.display = "inline-block";
  }

  calculateAverage() {
    if (this.selectedParties.size === 0) return null;

    const useWeighted =
      this.weightedAverageCheckbox && this.weightedAverageCheckbox.checked;

    if (useWeighted) {
      // Weighted average by number of seats
      let sumX = 0;
      let sumY = 0;
      let totalSeats = 0;

      this.selectedParties.forEach((index) => {
        const party = this.parties[index];
        const seats = party.electionResults2025
          ? party.electionResults2025.seats
          : 1;
        sumX += party.position.x * seats;
        sumY += party.position.y * seats;
        totalSeats += seats;
      });

      return {
        x:
          totalSeats > 0 ? sumX / totalSeats : sumX / this.selectedParties.size,
        y:
          totalSeats > 0 ? sumY / totalSeats : sumY / this.selectedParties.size,
      };
    } else {
      // Simple average
      let sumX = 0;
      let sumY = 0;

      this.selectedParties.forEach((index) => {
        const party = this.parties[index];
        sumX += party.position.x;
        sumY += party.position.y;
      });

      return {
        x: sumX / this.selectedParties.size,
        y: sumY / this.selectedParties.size,
      };
    }
  }

  updateCompassMarker() {
    const svg = this.svgDisplay.querySelector("svg");
    if (!svg) return;

    // Remove existing marker
    const existingMarker = svg.querySelector("#averageMarker");
    if (existingMarker) {
      existingMarker.remove();
    }

    const average = this.calculateAverage();
    if (!average) return;

    // Get the compass SVG element (the inner one with the parties)
    const compassSvg = svg.querySelector(".Compass__compass");
    if (!compassSvg) return;

    // Party icons are 10% x 10%, so we need to offset by 5% to center the marker
    // The x,y coordinates in the data represent the top-left corner of the icon
    const iconOffset = 5; // Half of 10% icon size
    const markerX = average.x + iconOffset;
    const markerY = average.y + iconOffset;

    // Create marker group
    const markerGroup = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "g",
    );
    markerGroup.setAttribute("id", "averageMarker");

    // Create outer circle (white border)
    const outerCircle = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle",
    );
    outerCircle.setAttribute("cx", `${markerX}%`);
    outerCircle.setAttribute("cy", `${markerY}%`);
    outerCircle.setAttribute("r", "12");
    outerCircle.setAttribute("fill", "#ff0000");
    outerCircle.setAttribute("stroke", "#ffffff");
    outerCircle.setAttribute("stroke-width", "3");

    // Create inner circle
    const innerCircle = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle",
    );
    innerCircle.setAttribute("cx", `${markerX}%`);
    innerCircle.setAttribute("cy", `${markerY}%`);
    innerCircle.setAttribute("r", "4");
    innerCircle.setAttribute("fill", "#ffffff");

    markerGroup.appendChild(outerCircle);
    markerGroup.appendChild(innerCircle);

    // Add to compass
    compassSvg.appendChild(markerGroup);
  }

  async displaySVG() {
    // Load and display the actual SVG
    try {
      const response = await fetch("kompas.svg");
      const svgText = await response.text();
      this.svgDisplay.innerHTML = svgText;

      // Scale the SVG to fit
      const svg = this.svgDisplay.querySelector("svg");
      if (svg) {
        svg.style.width = "100%";
        svg.style.height = "auto";
      }
    } catch (error) {
      console.error("Error displaying SVG:", error);
      throw error;
    }
  }
}

// Initialize the application
const parser = new KieskompasParser("parties-data.json");
const _ui = new UIController(parser);

// Export for use in other modules if needed
export { KieskompasParser };
