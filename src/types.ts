import { Page } from "playwright";

export interface BasicCompanyInfo {
  "original_chinese_name": string;
  "translated_name": string;
  "location_eng": string;
}

export interface SiteInfo {
  loginURL?: string;
  searchURL: string | ((searchTerm: string) => string);
  setupURL?: string;
  contextFilePath: string;
  extractionFn: (page: Page) => Promise<CompanyFinancialsAndRelations>;
  loginFn?: (page: Page, loginURL: string) => Promise<boolean>;
}

export interface SitesInfo {
  [key: string]: SiteInfo;
}

export interface CompanyFinancialsAndRelations {
  wirescreen_name_en: string;
  last_retrieval_date: string;
  flags: Array<string> | []; // Array, or empty array
  government_ownership_fraction: string;
  historical_shareholders: Record<string, unknown> | [];// JSON object, or empty array
  investments: Record<string, unknown> | [];
  direct_shareholders: Record<string, unknown> | [];
  beneficial_owners: Record<string, unknown> | [];
  customers: Record<string, unknown> | [];
  suppliers: Record<string, unknown> | [];
  pdf_link: string;
}

export type CompleteCompanyProfile = BasicCompanyInfo & CompanyFinancialsAndRelations;
