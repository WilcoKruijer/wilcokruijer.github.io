#!/usr/bin/env node
/**
 * Offline script to parse the Kieskompas SVG and generate a JSON file
 * Run with: node generate-data.js
 */

const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

class OfflineKieskompasParser {
  constructor(svgPath, outputPath) {
    this.svgPath = svgPath;
    this.outputPath = outputPath;
    this.svgDoc = null;
  }

  /**
   * Load and parse the SVG file from filesystem
   */
  load() {
    try {
      console.log(`Reading SVG from: ${this.svgPath}`);
      const svgText = fs.readFileSync(this.svgPath, "utf-8");

      // Parse the SVG XML using JSDOM
      const dom = new JSDOM(svgText, { contentType: "image/svg+xml" });
      this.svgDoc = dom.window.document;

      console.log("✓ SVG loaded and parsed successfully");
      return this.svgDoc;
    } catch (error) {
      console.error("Error loading SVG:", error);
      throw error;
    }
  }

  /**
   * Get the axis labels from the compass
   */
  getAxisLabels() {
    if (!this.svgDoc) return null;

    const textElements = this.svgDoc.querySelectorAll("svg > text");
    const labels = {};

    textElements.forEach((text) => {
      const content = text.textContent.trim();
      const y = parseFloat(text.getAttribute("y"));

      if (y < 100) labels.top = content;
      else if (y > 600) labels.bottom = content;
      else {
        const transform = text.getAttribute("transform");
        if (transform && transform.includes("-90")) {
          labels.left = content;
        } else if (transform && transform.includes("90")) {
          labels.right = content;
        }
      }
    });

    return labels;
  }

  /**
   * Get short name for a party
   */
  getShortName(fullName) {
    const shortNames = {
      "Volkspartij voor Vrijheid en Democratie": "VVD",
      "Partij Voor de Vrijheid": "PVV",
      DENK: "DENK",
      "Partij van de Arbeid/GroenLinks": "PvdA-GL",
      "Socialistische Partij": "SP",
      BoerBurgerBeweging: "BBB",
      "Democraten 66": "D66",
      "Christen-Democratisch Appèl": "CDA",
      "Partij voor de Dieren": "PvdD",
      "Forum voor Democratie": "FvD",
      "Staatkundig Gereformeerde Partij": "SGP",
      JA21: "JA21",
      "50PLUS": "50PLUS",
      "Nieuw Sociaal Contract": "NSC",
      ChristenUnie: "CU",
      Volt: "Volt",
    };
    return shortNames[fullName] || fullName;
  }

  /**
   * Get 2025 election results (hardcoded data)
   */
  getElectionResults2025() {
    return {
      D66: { seats: 26 },
      PVV: { seats: 26 },
      VVD: { seats: 22 },
      "PvdA-GL": { seats: 20 },
      CDA: { seats: 18 },
      JA21: { seats: 9 },
      FvD: { seats: 7 },
      BBB: { seats: 4 },
      DENK: { seats: 3 },
      CU: { seats: 3 },
      SP: { seats: 3 },
      SGP: { seats: 3 },
      PvdD: { seats: 3 },
      "50PLUS": { seats: 2 },
      Volt: { seats: 1 },
      NSC: { seats: 0 },
    };
  }

  /**
   * Extract all political parties and their positions
   */
  getParties() {
    if (!this.svgDoc) return [];

    const parties = [];
    const partyGroups = this.svgDoc.querySelectorAll(".CompassParty");
    const electionResults = this.getElectionResults2025();

    console.log(`Found ${partyGroups.length} parties`);

    partyGroups.forEach((group) => {
      const svg = group.querySelector(".CompassParty__icon");
      if (!svg) return;

      const title = svg.querySelector("title");
      if (!title) return;

      const titleText = title.textContent;
      const name = svg.getAttribute("aria-label");
      const x = parseFloat(svg.getAttribute("x"));
      const y = parseFloat(svg.getAttribute("y"));

      // Extract position information from title
      const positionMatch = titleText.match(/(\d+)%\s+(\w+),\s+(\d+)%\s+(\w+)/);

      let position = { horizontal: null, vertical: null };
      if (positionMatch) {
        position = {
          horizontal: {
            value: parseInt(positionMatch[1]),
            direction: positionMatch[2],
          },
          vertical: {
            value: parseInt(positionMatch[3]),
            direction: positionMatch[4],
          },
        };
      }

      // Extract image data if present
      const image = svg.querySelector("image");
      const imageHref = image ? image.getAttribute("href") : null;

      const shortName = this.getShortName(name);
      const electionData = electionResults[shortName] || null;

      parties.push({
        name,
        shortName,
        title: titleText,
        position: { x, y },
        politicalPosition: position,
        imageHref: imageHref ? imageHref.substring(0, 50) + "..." : null,
        electionResults2025: electionData,
      });
    });

    return parties;
  }

  /**
   * Get SVG dimensions and viewBox
   */
  getSVGDimensions() {
    if (!this.svgDoc) return null;

    const svg = this.svgDoc.querySelector("svg");
    return {
      width: svg.getAttribute("width"),
      height: svg.getAttribute("height"),
      viewBox: svg.getAttribute("viewBox"),
      class: svg.getAttribute("class"),
    };
  }

  /**
   * Get all data in a structured format
   */
  getAllData() {
    const parties = this.getParties();
    return {
      dimensions: this.getSVGDimensions(),
      axisLabels: this.getAxisLabels(),
      parties: parties,
      partyCount: parties.length,
      electionResults2025: this.getElectionResults2025(),
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Generate the JSON file
   */
  generate() {
    try {
      this.load();
      const data = this.getAllData();

      console.log(`Writing data to: ${this.outputPath}`);
      fs.writeFileSync(this.outputPath, JSON.stringify(data, null, 2), "utf-8");

      console.log("✓ JSON file generated successfully");
      console.log(`✓ Found ${data.partyCount} parties`);
      console.log(`✓ Output: ${this.outputPath}`);

      return data;
    } catch (error) {
      console.error("Error generating data:", error);
      throw error;
    }
  }
}

// Main execution
if (require.main === module) {
  const svgPath = path.join(__dirname, "kompas.svg");
  const outputPath = path.join(__dirname, "parties-data.json");

  const parser = new OfflineKieskompasParser(svgPath, outputPath);
  parser.generate();
}

module.exports = OfflineKieskompasParser;
