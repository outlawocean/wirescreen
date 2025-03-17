import fs from "fs";
import { exportDataCSV } from "./csv";
import {
    getSearchData
} from "./sqlite";

// Convert json object to summary for exporting to csv
function summarizeHistoricalShareholders(jsonData) {
  return jsonData
    .map(entry => {
      // Extract the name property (fallback to "Unknown" if not found)
      const name = entry.name || "Unknown";

      // Extract and format all other key-value pairs
      const otherProperties = Object.entries(entry)
        .filter(([key, value]) => key !== "name" && value !== null) // Exclude the name and null values
        .map(([key, value]) => `${key}: ${value}`) // Format as key: value
        .join(", "); // Join all properties with a comma

      // Combine the name and other properties into the final string
      return `"${name}" (${otherProperties})`;
    })
    .join("; "); // Add a semicolon between entries
}

// Function to summarize JSON data
function summarizeJson(key, value) {
    if (!value) return ''; // Handle null/empty values
    
    try {
        const parsed = JSON.parse(value);

        if (key ==='flags' && Array.isArray(parsed)) {
            return parsed.join('; ');
        } else if (key === 'historical_shareholders' && Array.isArray(parsed)) {
            return summarizeHistoricalShareholders(parsed);
        } else {
            // Convert array into a comma-separated list
            return parsed.map(item => {
                if (typeof item === 'object' && item !== null) {
                    return Object.values(item).join(':'); // Flatten objects inside arrays
                }
                return item; // Return primitive values as-is
            }).join('; ');            
        }
    } catch (error) {
        return value; // Return original value if parsing fails (not valid JSON)
    }
}

(async () => {
    const data = await getSearchData();
    
    // Process and summarize JSON columns in each row
    const processedData = data.map(row => {
        return Object.fromEntries(
            Object.entries(row).map(([key, value]) => [key, summarizeJson(key, value)])
        );
    });

    // Get today's date, format as YYYY-MM-DD
    // Generate outputfile name
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0];
    const outfileName = `search_results-${formattedDate}.csv`;

    // Export processed data to CSV
    exportDataCSV(outfileName, processedData);
})();
