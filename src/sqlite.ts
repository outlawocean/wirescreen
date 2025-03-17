import { BasicCompanyInfo, CompanyFinancialsAndRelations, CompleteCompanyProfile } from "./types";
import Database from "better-sqlite3";
const db = new Database("database.db");

// Ensure json object stored in the database is stringified
function formatJson(val) {
  if (typeof val === "object") {
    // Return blank string if there is no data in the JSON obejct
    if (val.length === 0) {
      return '';
    }
    return JSON.stringify(val)
  } else {
    return val;
  }
}


export function initDB() {
  db.exec(`
      CREATE TABLE IF NOT EXISTS company (
        original_chinese_name TEXT NOT NULL,
        translated_name TEXT NOT NULL,
        location_eng TEXT,
        wirescreen_name_en TEXT,
        last_retrieval_date TEXT,
        flags JSON,
        government_ownership_fraction TEXT,
        historical_shareholders JSON,
        investments JSON,
        direct_shareholders JSON,
        beneficial_owners JSON,
        customers JSON,
        suppliers JSON,
        pdf_link TEXT
      );
    `);
}

export function getCompanyByName(
  name: string,
): CompleteCompanyProfile {
  const statement = db.prepare(`
  SELECT * FROM company
  WHERE translated_name = ?
  `);
  return statement.get(name) as CompleteCompanyProfile | null;
}

export async function insertSearchResult(
  info: BasicCompanyInfo,
  result: CompanyFinancialsAndRelations
) {

  const statement = db.prepare(`
    INSERT INTO company (
        original_chinese_name,
        translated_name,
        location_eng,
        wirescreen_name_en,
        last_retrieval_date,
        flags,
        government_ownership_fraction,
        historical_shareholders,
        investments,
        direct_shareholders,
        beneficial_owners,
        customers,
        suppliers,
        pdf_link
    ) 
    VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    );
  `);

  const { lastInsertRowid } = statement.run(
    info.original_chinese_name,
    info.translated_name,
    info.location_eng,
    result.wirescreen_name_en,
    result.last_retrieval_date,
    formatJson(result.flags),
    result.government_ownership_fraction,
    formatJson(result.historical_shareholders),
    formatJson(result.investments),
    formatJson(result.direct_shareholders),
    formatJson(result.beneficial_owners),
    formatJson(result.customers),
    formatJson(result.suppliers),
    result.pdf_link,
  );
  return lastInsertRowid;
}

export async function updateSearchResult(
  info: BasicCompanyInfo,
  result: CompanyFinancialsAndRelations
) {
  const statement = db.prepare(`
    UPDATE company 
    SET
      wirescreen_name_en = ?, 
      last_retrieval_date = ?, 
      flags = ?, 
      government_ownership_fraction = ?, 
      historical_shareholders = ?, 
      investments = ?, 
      direct_shareholders = ?, 
      beneficial_owners = ?, 
      customers = ?, 
      suppliers = ?, 
      pdf_link = ?
    WHERE translated_name = ?
  `);

  const { lastInsertRowid } = statement.run(
    result.wirescreen_name_en,
    result.last_retrieval_date,
    formatJson(result.flags),
    result.government_ownership_fraction,
    formatJson(result.historical_shareholders),
    formatJson(result.investments),
    formatJson(result.direct_shareholders),
    formatJson(result.beneficial_owners),
    formatJson(result.customers),
    formatJson(result.suppliers),
    result.pdf_link,
    info.translated_name,
  );
  return lastInsertRowid;
}

export function getSearchData(
): CompleteCompanyProfile[] {
  const statement = db.prepare(`
    SELECT * FROM company;
  `);
  return statement.all() as CompleteCompanyProfile[];
}
