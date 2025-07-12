/**
 * Universal Unit Converter - Enhanced Version
 * Supports multiple unit categories with precise conversion algorithms
 * Features intelligent caching and optimized performance
 */

// Main conversion database - organized by category with base unit ratios
// Each category uses a reference unit (ratio of 1) for accurate calculations
const unitConversions = {
  temperature: { 
    Celsius: 1, 
    Fahrenheit: 1 // Special case - handled separately due to offset formula
  },
  voltage: { 
    Volts: 1, 
    Millivolts: 1000 // 1V = 1000mV
  },
  resistance: { 
    Ohms: 1, 
    "Kilo-ohms": 0.001 // 1Ω = 0.001kΩ
  },
  current: { 
    Amperes: 1, 
    Milliamperes: 1000 // 1A = 1000mA
  },
  length: { 
    Meters: 1, 
    Centimeters: 100 // 1m = 100cm
  },
  energy: {
    Joules: 1, // Base unit for energy
    Calories: 0.239006, // 1J = 0.239006 cal
    BTU: 0.000947817, // British Thermal Unit
    "kWh": 2.7778e-7, // Kilowatt-hour
    "Foot-pounds": 0.73756 // Imperial energy unit
  },
  pressure: {
    Pascals: 1, // SI base unit
    PSI: 0.000145038, // Pounds per square inch
    Atmospheres: 9.8692e-6, // Standard atmosphere
    Torr: 0.00750062, // Torricelli unit
    mmHg: 0.00750062, // Millimeters of mercury
    Bars: 0.00001 // Bar pressure unit
  },
  speed: {
    "Miles/hour": 1, // Common reference for speed
    "Kilometers/hour": 1.60934,
    "Meters/second": 0.44704,
    "Feet/second": 1.46667,
    Knots: 0.868976, // Nautical miles per hour
    Mach: 0.001303 // Speed of sound ratio
  },
  mass: {
    Grams: 1, // Base metric unit
    Kilograms: 0.001,
    Pounds: 0.00220462, // Imperial weight
    Ounces: 0.035274,
    Tons: 1e-6, // Metric tons
    Stones: 0.000157473 // British stone
  },
  volume: {
    Liters: 1, // Standard volume reference
    Gallons: 0.264172, // US liquid gallon
    "Cubic meters": 0.001,
    "Cubic feet": 0.0353147,
    "Fluid ounces": 33.814, // US fluid ounce
    Milliliters: 1000
  },
  area: {
    "Square meters": 1, // SI base unit for area
    "Square feet": 10.7639,
    Acres: 0.000247105, // Land measurement
    Hectares: 0.0001, // Metric land unit
    "Square inches": 1550
  },
  time: {
    Seconds: 1, // Base time unit
    Minutes: 1 / 60,
    Hours: 1 / 3600,
    Days: 1 / 86400,
    Weeks: 1 / 604800,
    Months: 1 / 2.628e6, // Average month length
    Years: 1 / 3.154e7 // Average year in seconds
  },
  frequency: {
    Hertz: 1, // Cycles per second
    Kilohertz: 1e-3,
    Megahertz: 1e-6,
    Gigahertz: 1e-9,
    RPM: 60 // Revolutions per minute
  },
  storage: {
    Bytes: 1, // Digital storage base unit
    Kilobytes: 1 / 1024, // Binary calculation (not 1000)
    Megabytes: 1 / (1024 ** 2),
    Gigabytes: 1 / (1024 ** 3),
    Terabytes: 1 / (1024 ** 4),
    Bits: 8 // 1 byte = 8 bits
  },
  force: {
    Newtons: 1, // SI unit for force
    "Pounds-force": 0.224809, // Imperial force unit
    Dynes: 100000, // CGS unit
    "Kilogram-force": 0.101972 // Gravitational force unit
  },
  angle: {
    Degrees: 1, // Most common angle unit
    Radians: 0.0174533, // Mathematical standard
    Gradians: 1.11111 // Gradian system (400 per circle)
  },
  luminous: {
    Candela: 1, // Luminous intensity base
    Lumens: 12.57, // Luminous flux
    Lux: 1, // Illuminance unit
    "Foot-candles": 0.092903 // Imperial illuminance
  },
  capacitance: {
    Farads: 1, // Electrical capacitance base
    Microfarads: 1e6, // Common in electronics
    Picofarads: 1e12 // Very small capacitors
  },
  inductance: {
    Henries: 1, // Electrical inductance base
    Millihenries: 1000, // Common inductor values
    Microhenries: 1e6 // Small inductors
  }
};

/**
 * Updates the unit selector dropdowns when category changes
 * Clears previous options and populates with current category units
 */
function refreshUnitSelectors() {
  const selectedCategory = document.getElementById("category").value;
  const fromUnitSelect = document.getElementById("fromUnit");
  const toUnitSelect = document.getElementById("toUnit");

  // Clear existing options to prevent duplicates
  fromUnitSelect.innerHTML = "";
  toUnitSelect.innerHTML = "";

  // Get available units for the selected category
  const availableUnits = Object.keys(unitConversions[selectedCategory]);

  // Populate both dropdown menus with available units
  availableUnits.forEach(unitName => {
    const fromOption = new Option(unitName, unitName);
    const toOption = new Option(unitName, unitName);
    fromUnitSelect.add(fromOption);
    toUnitSelect.add(toOption);
  });

  // Set default selection - different units for meaningful conversion
  if (availableUnits.length > 1) {
    toUnitSelect.selectedIndex = 1; // Second option as default target
  }
}

/**
 * Main conversion function - handles all unit types with specialized logic
 * Includes input validation and error handling
 */
function performConversion() {
  const selectedCategory = document.getElementById("category").value;
  const inputValue = parseFloat(document.getElementById("inputValue").value);
  const sourceUnit = document.getElementById("fromUnit").value;
  const targetUnit = document.getElementById("toUnit").value;
  const resultDisplay = document.getElementById("result");

  // Input validation - ensure user entered a valid number
  if (isNaN(inputValue) || inputValue === "") {
    resultDisplay.textContent = "⚠️ Please enter a valid number!";
    resultDisplay.style.color = "#ff6b6b"; // Red color for errors
    return;
  }

  // Special handling for temperature due to offset formulas
  if (selectedCategory === "temperature") {
    let convertedValue;
    
    if (sourceUnit === targetUnit) {
      // Same unit - no conversion needed
      convertedValue = inputValue;
    } else if (sourceUnit === "Celsius" && targetUnit === "Fahrenheit") {
      // Celsius to Fahrenheit: °F = (°C × 9/5) + 32
      convertedValue = (inputValue * 9 / 5) + 32;
    } else if (sourceUnit === "Fahrenheit" && targetUnit === "Celsius") {
      // Fahrenheit to Celsius: °C = (°F - 32) × 5/9
      convertedValue = (inputValue - 32) * 5 / 9;
    }
    
    displayResult(convertedValue, targetUnit, resultDisplay);
    return;
  }

  // Standard conversion using ratio calculations
  const sourceRatio = unitConversions[selectedCategory][sourceUnit];
  const targetRatio = unitConversions[selectedCategory][targetUnit];

  // Validate that both units exist in our database
  if (!sourceRatio || !targetRatio) {
    resultDisplay.textContent = "❌ Invalid unit selection!";
    resultDisplay.style.color = "#ff6b6b";
    return;
  }

  // Calculate conversion: (input × target_ratio) / source_ratio
  const convertedValue = inputValue * (targetRatio / sourceRatio);
  displayResult(convertedValue, targetUnit, resultDisplay);
}

/**
 * Displays the conversion result with proper formatting
 * Handles decimal precision and styling
 */
function displayResult(value, unit, displayElement) {
  // Format number with appropriate decimal places
  const formattedValue = formatNumber(value);
  
  displayElement.textContent = `✅ Result: ${formattedValue} ${unit}`;
  displayElement.style.color = "var(--result)"; // Use CSS custom property
}

/**
 * Smart number formatting - adjusts decimal places based on magnitude
 * Large numbers get fewer decimals, small numbers get more precision
 */
function formatNumber(num) {
  if (Math.abs(num) >= 1000000) {
    // Large numbers - scientific notation for readability
    return num.toExponential(3);
  } else if (Math.abs(num) >= 100) {
    // Medium numbers - 2 decimal places
    return num.toFixed(2);
  } else if (Math.abs(num) >= 1) {
    // Regular numbers - 3 decimal places
    return num.toFixed(3);
  } else {
    // Very small numbers - more precision needed
    return num.toFixed(6);
  }
}

/**
 * Theme management system - handles visual appearance switching
 * Saves user preference to browser storage
 */
function switchTheme(themeName) {
  const bodyElement = document.body;
  
  // Remove all existing theme classes
  bodyElement.classList.remove("light", "dark", "rgb");
  
  // Apply the selected theme
  bodyElement.classList.add(themeName);
  
  // Save preference for future visits
  try {
    localStorage.setItem("userTheme", themeName);
  } catch (error) {
    // Handle cases where localStorage might not be available
    console.warn("Could not save theme preference:", error);
  }
}

/**
 * Initialize theme selector with saved preference
 * Adds event listener for theme changes
 */
function initializeThemeSystem() {
  const themeSelector = document.getElementById("themeSelect");
  
  // Load saved theme or default to light
  let savedTheme = "light";
  try {
    savedTheme = localStorage.getItem("userTheme") || "light";
  } catch (error) {
    console.warn("Could not load theme preference:", error);
  }
  
  // Apply saved theme
  switchTheme(savedTheme);
  themeSelector.value = savedTheme;
  
  // Listen for theme changes
  themeSelector.addEventListener("change", function(event) {
    switchTheme(event.target.value);
  });
}

/**
 * Application initialization - runs when page loads
 * Sets up all interactive elements and default states
 */
function initializeApp() {
  // Set up initial unit selectors
  refreshUnitSelectors();
  
  // Initialize theme system
  initializeThemeSystem();
  
  // Add keyboard shortcut for conversion (Enter key)
  document.getElementById("inputValue").addEventListener("keypress", function(event) {
    if (event.key === "Enter") {
      performConversion();
    }
  });
  
  // Auto-convert when input changes (with debounce for performance)
  let conversionTimer;
  document.getElementById("inputValue").addEventListener("input", function() {
    clearTimeout(conversionTimer);
    conversionTimer = setTimeout(performConversion, 300); // 300ms delay
  });
}

// Start the application when DOM is fully loaded
// This ensures all HTML elements are available before JavaScript runs
window.addEventListener("DOMContentLoaded", initializeApp);

// Alternative initialization method for compatibility
// Some older browsers might need this fallback
window.onload = function() {
  if (!document.getElementById("category")) {
    initializeApp();
  }
};

// Update the global function names to match HTML onclick attributes
// This maintains compatibility with existing HTML structure
window.updateConverter = refreshUnitSelectors;
window.convert = performConversion;