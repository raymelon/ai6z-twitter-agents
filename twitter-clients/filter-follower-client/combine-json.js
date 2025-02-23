const fs = require('fs');
const path = require('path');

const structuredDataDir = './structured-data-following'; // Directory containing individual JSON files
const combinedOutputFile = './combined-following.json';   // Output file for combined JSON

async function combineJsonFiles() {
  try {
    const files = await fs.promises.readdir(structuredDataDir);
    const jsonFiles = files.filter(file => path.extname(file).toLowerCase() === '.json');

    if (jsonFiles.length === 0) {
      console.log(`No JSON files found in directory: ${structuredDataDir}`);
      return;
    }

    const combinedData = [];

    for (const file of jsonFiles) {
      const filePath = path.join(structuredDataDir, file);
      try {
        const fileContent = await fs.promises.readFile(filePath, 'utf8');
        const jsonData = JSON.parse(fileContent);

        // Extract username from filename (remove .json extension)
        const username = path.basename(file, '.json');

        // Add username field to the profile object
        if (jsonData.profile) {
          jsonData.profile.username = username;
        } else {
          console.warn(`Warning: No 'profile' object found in ${file}. Skipping username addition.`);
        }
        combinedData.push(jsonData);

      } catch (parseError) {
        console.error(`Error parsing JSON file: ${file}`, parseError);
      }
    }

    // Write combined data to a single JSON file
    const combinedJsonString = JSON.stringify(combinedData, null, 2); // Use 2 spaces for indentation
    await fs.promises.writeFile(combinedOutputFile, combinedJsonString, 'utf8');

    console.log(`Successfully combined ${jsonFiles.length} JSON files into: ${combinedOutputFile}`);

  } catch (readDirError) {
    console.error('Error reading directory:', readDirError);
  }
}

combineJsonFiles();