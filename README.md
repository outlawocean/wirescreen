To setup the project run:

`npm install`

This code takes a list of company names and searches Wirescreen for financial and relationship details on the company.

Update credentials and other details in the `.env` file.

To run the code:

`npm run start ./input_sheets/XJ_Farms.csv`

The results are saved in a SQLite database (`database.db`). This database file is created if it does not exist. To export results from the database run:

`npm run export`


Notes:
- A context file `wirescreen_context.json` is created when you run the code and the `loginFn` is used for the first time. On other runs this context is used by the script and code does not log in each time. So if you want to start a fresh session delete this file.