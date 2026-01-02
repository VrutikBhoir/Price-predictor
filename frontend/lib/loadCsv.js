import fs from "fs";
import path from "path";
import csv from "csv-parser";

export async function loadPredictionsCSV() {
  const filePath = path.join(process.cwd(), "data", "prediction_vs_reality.csv");

  const results = [];
  return new Promise((resolve) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row) => results.push(row))
      .on("end", () => resolve(results));
  });
}
