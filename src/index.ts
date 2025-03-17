import { BrowserContext, Page } from "playwright";
import fs from "fs";
import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { loadCSV } from "./csv";
import {
  BasicCompanyInfo,
  SiteInfo,
  CompanyFinancialsAndRelations,
  CompleteCompanyProfile,
} from "./types";
import { SITES } from "./site";
import { wait } from "./lib";
import {
  initDB,
  insertSearchResult,
  getCompanyByName,
  updateSearchResult,
} from "./sqlite";

const databasePath = './database.db';

chromium.use(StealthPlugin());

async function saveContext(contextFilePath: string, context: BrowserContext) {
  const storage = await context.storageState();
  fs.writeFileSync(contextFilePath, JSON.stringify(storage));
}

async function loadContext(contextFilePath: string, browser: any) {
  if (fs.existsSync(contextFilePath)) {
    const storage = JSON.parse(fs.readFileSync(contextFilePath, "utf-8"));
    return await browser.newContext({ 
      storageState: storage,
      acceptDownloads: true, // Enable downloads
     });
  } else {
    return await browser.newContext({
      acceptDownloads: true, // Enable downloads
    });
  }
}

function url(site: SiteInfo, searchTerm: string) {
  console.log('search term', searchTerm);
  return typeof site.searchURL === "string"
    ? `${site.searchURL}"${searchTerm}"`
    : site.searchURL(searchTerm);
}

function writeResults(
  row: BasicCompanyInfo,
  data: CompanyFinancialsAndRelations,
) {
  // Check if there is an existing record in the database
  const recordExists = getCompanyByName(row.translated_name) ? true: false;

  if (recordExists) {
    console.log('updating result for ', row.translated_name);
    updateSearchResult( 
      row,
      data,
    );
  } else {
    console.log('inserting result for ', row.translated_name);
    insertSearchResult(
      row,
      data,
    );
  }
  console.log(`************************************`);
}

async function getSearchResults(
  page: Page,
  site: SiteInfo,
  row: BasicCompanyInfo,
): Promise<CompanyFinancialsAndRelations> {
  console.log('************************************');
  await page.goto(url(site, row.translated_name), {
    waitUntil: "domcontentloaded",
  });
  const searchResult = await site.extractionFn(page);
  return searchResult;
}

(async () => {
  initDB();

  let data;

  if (process.argv[2]) {
    data = await loadCSV(process.argv[2]);
  } else {
    console.log("Please provide a path to a csv file.");
    process.exit(0);
  }

  const browser = await chromium.launch({ headless: false });

  for (const siteKey of Object.keys(SITES)) {
    const site = SITES[siteKey];

    let context = await loadContext(site.contextFilePath, browser);
    const page = await context.newPage();

    let isLoggedIn =
      site.loginFn && site.loginURL
        ? await site.loginFn(page, site.loginURL)
        : true;

    await wait(2000);

    if (isLoggedIn) {
      await saveContext(site.contextFilePath, context);
    } else {
      console.log(isLoggedIn, siteKey);
    }

    // Search the first 200 rows
    for (const row of data.slice(0, 200)) {
      const result = await getSearchResults(page, site, row);
      writeResults(row, result);
      await wait(5000);
    }
  }

  await browser.close();
})();
