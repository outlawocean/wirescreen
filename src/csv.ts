import { parseFile, writeToPath } from "fast-csv";
import path from "path";
import { BasicCompanyInfo } from "./types";


export function loadCSV(path: string): Promise<Array<BasicCompanyInfo>> {
  return new Promise((resolve, reject) => {
    const rows: Array<BasicCompanyInfo> = [];
    parseFile(path, { headers: true })
      .on("data", (row) => {
        rows.push(row);
      })
      .on("error", (error) => {
        return reject(error);
      })
      .on("end", () => {
        return resolve(rows);
      });
  });
}

function writeCSV(path: string, data: Array<Object>): Promise<boolean> {
  return new Promise((resolve, reject) => {
    writeToPath(path, data, { headers: true })
      .on("error", (err) => reject(err))
      .on("finish", () => resolve(true));
  });
}

export function exportDataCSV(inputPath: string, data: Array<any>) {
  const outputFile = path.join('output', inputPath);
  return writeCSV(outputFile, data);
}
