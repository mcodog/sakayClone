const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

const gtfsFolder = "./gtfs"; // Folder where your GTFS CSV files are stored
const outputFolder = "./gtfs-json"; // Folder for output JSON files

if (!fs.existsSync(outputFolder)) {
  fs.mkdirSync(outputFolder);
}

// List of GTFS files to convert
const gtfsFiles = [
  "routes.txt",
  "stops.txt",
  "trips.txt",
  "stop_times.txt",
  "shapes.txt",
];

function convertCsvToJson(file) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(path.join(gtfsFolder, file))
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", () => {
        fs.writeFileSync(
          path.join(outputFolder, file.replace(".txt", ".json")),
          JSON.stringify(results, null, 2)
        );
        console.log(`Converted ${file} to JSON`);
        resolve();
      })
      .on("error", (err) => reject(err));
  });
}

async function convertAllFiles() {
  try {
    await Promise.all(gtfsFiles.map(convertCsvToJson));
    console.log("GTFS conversion completed!");
  } catch (error) {
    console.error("Error converting GTFS files:", error);
  }
}

convertAllFiles();
