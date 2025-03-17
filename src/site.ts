import { SitesInfo, CompanyFinancialsAndRelations } from "./types";
import { Page } from "playwright";
import { wait } from "./lib";
import dotenv from "dotenv";

dotenv.config();

async function savePdfFromNewTab(page, name_en) {
  const [newPage] = await Promise.all([
    page.context().waitForEvent('page'), // Wait for the new tab
    page.click('#export a'), // Trigger the click to open the new tab
  ]);

  console.log('New tab opened for PDF rendering.');

  // Wait for the new tab to load
  await newPage.waitForLoadState('load');
  await wait(8000);

  // Generate a PDF from the HTML content of the new tab
  const savePath = `${process.env.PDF_PATH}/${name_en}.pdf`;

  try {
    await newPage.pdf({
      path: savePath, // Save the PDF to the local disk
      format: 'A4', // Set the page size
      printBackground: true, // Include background colors/images
    });
    console.log(`PDF downloaded and saved to ${savePath}`);
  } catch (error) {
    console.error('Error generating PDF:', error);
  }
  await newPage.close(); // Close the new tab
}


export const SITES: SitesInfo = {
  wirescreen: {
    searchURL: "https://platform.wirescreen.ai/search?q=",
    loginURL: "https://platform.wirescreen.ai/signin",
    contextFilePath: "wirescreen_context.json",
    /* Searching for a company either loads a "No results" message 
    or loads a list of company names that match the search.
    
    If "No results" are found for the company, the extractionFn returns
    and empty array.
    
    If a list of company names is loaded, this code navigates to the
    page of the first match and returns the company detail from that
    page.
    */
    extractionFn: async (
      page // Pass the Playwright Page object
    ): Promise<CompanyFinancialsAndRelations> => {

      // Initialize company data
      let companyData: CompanyFinancialsAndRelations = {
        wirescreen_name_en: '',
        last_retrieval_date: '',
        flags: [],
        government_ownership_fraction: '',
        historical_shareholders: [],
        investments: [],
        direct_shareholders: [],
        beneficial_owners: [],
        customers: [],
        suppliers: [],
        pdf_link: '',
      };

      // Wait for search results or "No results" message to load
      try {
        const searchResults = page.waitForSelector('.MuiGrid-root.MuiGrid-item', { timeout: 6000 });
        const noResults = page.waitForSelector('h2:has-text("No results")', { timeout: 6000 });

        const element = await Promise.race([searchResults, noResults]);

        // Early return if "No results" is found
        if (await page.$('h2:has-text("No results")')) {
          console.log('No search results found');
          return companyData; // Return empty results
        }
          console.log('Search results loaded');
      } catch (error) {
        console.error("Neither search results nor 'No Results' message found", error);
        return companyData; // Avoid further execution
      }

      // Helper function to extract search results
      async function fetchSearchResults(page: Page) {
        return await page.evaluate(() => {
          return Array.from(document.querySelectorAll('.MuiGrid-root.MuiGrid-item'), (el) => {
            const link = el.querySelector('a');
            const firstP = el.querySelector('p');
            return link && firstP
              ? { linkText: firstP.textContent.trim(), url: link.href }
              : null;
          }).filter(Boolean);
        });
      }

      const results = await fetchSearchResults(page);
      if (results.length === 0) {
        console.log('No search results found.');
        return companyData;
      }
      
      console.log('Scraped Search Results:', results.length);
      const firstResult = results[0];
      console.log('Navigating to first result:', firstResult);

      // Intercept network responses to capture relevant data
      page.on('response', async (response) => {
        try {
          const url = response.url();
          const contentType = response.headers()['content-type'];
          if (!contentType?.includes('application/json')) return;

          const jsonResponse = await response.json();

          if (url.includes('organization/basic')) {
            console.log('Captured Flags JSON Response');
            const entity = jsonResponse?.data?.entity;
            if (entity) {
              companyData.wirescreen_name_en = entity.name_en;
              companyData.flags = entity.flags?.map(d => d.title) || [];

              const govOwnership = companyData.flags.find(d => d.includes('Government Ownership'));
              if (govOwnership) {
                companyData.government_ownership_fraction = govOwnership.split(':').pop();
              }
            }

            const details = jsonResponse?.data?.secondary_details;
            if (details) {
              const retrieved = details.find(d => d.label === 'Latest Retrieval Date');
              companyData.last_retrieval_date = retrieved?.data || '';
            }
          }

          if (url.includes('get_historical_shareholders')) {
            console.log('Captured Historical Shareholders JSON Response');
            companyData.historical_shareholders = jsonResponse.data.entities.map((entity, index) => ({
              name: entity.name_en,
              ...Object.fromEntries(jsonResponse.data.periods.map((period, pIndex) => [period, jsonResponse.data.fractions[index][pIndex]])),
            }));
          }

          if (url.includes('owns')) {
            console.log('Captured Investments JSON Response');
            companyData.investments = jsonResponse?.data?.owned?.map(d => ({
              name: d.entity.name_en,
              fraction: d.fraction,
            })) || [];
          }

          if (url.includes('owners')) {
            console.log('Captured Direct Shareholders JSON Response');
            companyData.direct_shareholders = jsonResponse?.data?.owners?.map(d => ({
              name: d.entity.name_en,
              fraction: d.fraction,
            })) || [];
          }

          if (url.includes('get_direct_entities')) {
            console.log('Captured Beneficial Owners JSON Response');
            const entitySet = jsonResponse?.data?.entity_sets?.find(d => d.name === 'Beneficial Owners');
            if (entitySet?.related_entities) {
              companyData.beneficial_owners = entitySet.related_entities.map(d => ({
                name: d.entity.name_en,
                fraction: d.direct.ownership.fraction,
              }));
            }
          }

          if (url.includes('customer')) {
            console.log('Captured Customers JSON Response');
            companyData.customers = jsonResponse?.data?.transactions?.map(d => ({
              name: d.supplier.name_en,
              product: d.product.name_en_short,
              amount: d.amount,
              date: d.order_date,
            })) || [];
          }

          if (url.includes('supplier')) {
            console.log('Captured Suppliers JSON Response');
            companyData.suppliers = jsonResponse?.data?.transactions?.map(d => ({
              name: d.supplier.name_en,
              product: d.product.name_en_short,
              amount: d.amount,
              date: d.order_date,
            })) || [];
          }
        } catch (error) {
          console.error('Error processing JSON response:', error);
        }
      });

      await page.goto(firstResult.url, { waitUntil: 'domcontentloaded' });
      console.log('Loaded first result page');
    
      // Wait for network requests to complete
      await page.waitForTimeout(6000);
    
      // Wait for the company detail page to load
      await page.waitForSelector('#overview h1', { timeout: 8000 });
      console.log('Company detail page loaded');

      // Attempt to download PDF
      try {
        await savePdfFromNewTab(page, companyData.wirescreen_name_en);
        companyData.pdf_link = `/pdfs/${companyData.wirescreen_name_en}.pdf`;
      } catch (error) {
        console.error('Error downloading PDF:', error);
      }

      return companyData;
    },    
    loginFn: async (page: Page, loginURL: string): Promise<boolean> => {
      await page.goto(loginURL, { waitUntil: "networkidle" });
      await wait(2000);

      const loggedIn = await page.$(".fa-circle-user");
      if (loggedIn) {
        return true;
      }

      await page.fill('#name', process.env.WIRESCREEN_USERNAME);
      await page.fill('#password', process.env.PASSWORD);

      await Promise.all([
        page.click('.MuiButton-containedPrimary'),
      ]);
      await wait(2000);

      return true;
    },
  },
};

