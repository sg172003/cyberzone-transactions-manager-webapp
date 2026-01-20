# Cyberzone Transactions Manager Webapp

A lightweight Node.js web application to manually record and manage day-to-day transactions for "Cyberzone". The app supports manual transaction entry (with optional receipt upload), editing/deleting entries, date-range filtering, and Excel export.

Key behaviours:
- Stores transactions in a JSON file (transactions.json)
- Saves uploaded receipts to uploads/receipts
- Provides an HTML UI (index.html) and a simple REST API for automation and integration

---

## Features
- Manual transaction entry via UI or API
- Optional receipt upload (PDF / DOC / DOCX)
- Edit and delete transactions (removes associated receipt on delete)
- Filter transactions by predefined ranges or custom from/to dates
- Export filtered transactions to Excel (.xlsx) with formatted dates and amounts
- Simple health endpoint

---

## Tech stack
- Node.js (>=14)
- Express
- Multer (file uploads)
- xlsx (Excel generation)
- (Dependency listed but currently unused: pdf-parse)

Files of interest:
- server.js — main application server and API
- index.html — single-file web UI
- package.json — scripts & dependencies
- transactions.json — runtime data file (created automatically)
- uploads/receipts — uploaded receipts directory (created automatically)

---

## Quickstart

Prerequisites:
- Node.js (14+)
- npm

Install and run:
```bash
# clone the repo
git clone https://github.com/sg172003/cyberzone-transactions-manager-webapp.git
cd cyberzone-transactions-manager-webapp

# install
npm install

# start
npm start
# or for dev with automatic reload (requires devDependencies)
npm run dev
```

By default the app listens on port 3000. To change the port:
```bash
PORT=8080 npm start
```

Open the UI at:
http://localhost:3000/

---

## Storage & file layout

- transactions.json — an array that persists all transaction objects. Initialized to `[]` if missing.
- uploads/receipts — uploaded files are saved here. Receipts are served at `/receipts/<storedFileName>`.

Important: This is a file-backed store intended for small deployments or prototypes. For production use consider migrating to a database and secure object storage.

---

## API Reference

All endpoints are relative to the server root (e.g., http://localhost:3000).

Common data shape (transaction):
```json
{
  "id": "1612345678900_ab12cd",
  "date": "15/01/2026",
  "name": "John Doe",
  "transactionType": "Deposit",
  "amount": 1234.50,
  "aadharNumber": "1234 5678 1234",
  "phone": "9876543210",
  "receiptOriginalName": "receipt.pdf",
  "receiptStoredName": "1612345678900_x7y9z.pdf",
  "receiptUrl": "/receipts/1612345678900_x7y9z.pdf",
  "createdAt": "2026-01-15T10:11:12.000Z",
  "updatedAt": "2026-01-15T11:11:12.000Z"
}
```

1) GET /api/transactions
- Description: Get all transactions or filtered by date range.
- Query params:
  - range: one of `1w`, `1m`, `3m`, `6m`, `custom`
  - from, to: when `range=custom`, provide `from` and `to` in `DD/MM/YYYY`
- Examples:
```bash
# all transactions
curl -s http://localhost:3000/api/transactions | jq

# last 1 month
curl -s "http://localhost:3000/api/transactions?range=1m" | jq

# custom range
curl -s "http://localhost:3000/api/transactions?range=custom&from=01/01/2026&to=15/01/2026" | jq
```

2) POST /api/manual-entry
- Description: Add a transaction. Accepts multipart/form-data to allow an optional receipt upload.
- Required fields (form fields): `date` (DD/MM/YYYY), `name`, `transactionType` (`deposit`, `withdrawal`, `atm` — normalized), `amount`
- Optional fields: `aadharNumber` (format: `1234 5678 1234`), `phone` (10 digits), `receipt` (file)
- Example (with receipt):
```bash
curl -X POST http://localhost:3000/api/manual-entry \
  -F "date=15/01/2026" \
  -F "name=Jane Smith" \
  -F "transactionType=Deposit" \
  -F "amount=1500.75" \
  -F "aadharNumber=1234 5678 1234" \
  -F "phone=9876543210" \
  -F "receipt=@/path/to/receipt.pdf"
```
- Example (without receipt):
```bash
curl -X POST http://localhost:3000/api/manual-entry \
  -F "date=15/01/2026" \
  -F "name=Local Vendor" \
  -F "transactionType=ATM" \
  -F "amount=500"
```

3) PUT /api/transactions/:id
- Description: Update an existing transaction by id. Request format is the same as POST (multipart/form-data for receipt replacement).
- Example:
```bash
curl -X PUT http://localhost:3000/api/transactions/1612345678900_ab12cd \
  -F "date=16/01/2026" \
  -F "name=Jane Smith" \
  -F "transactionType=Withdrawal" \
  -F "amount=1200.00" \
  -F "phone=9876543210"
```

4) DELETE /api/transactions/:id
- Description: Delete a transaction. Any stored receipt file associated will be removed.
- Example:
```bash
curl -X DELETE http://localhost:3000/api/transactions/1612345678900_ab12cd
```

5) GET /api/download-excel
- Description: Generate and download an .xlsx file for the filtered data (same range/from/to params as /api/transactions).
- Example:
```bash
# download all
curl -J -O http://localhost:3000/api/download-excel

# download last 1 week
curl -J -O "http://localhost:3000/api/download-excel?range=1w"

# save as a specific filename (client-side)
curl -o transactions_1week.xlsx "http://localhost:3000/api/download-excel?range=1w"
```
The generated Excel includes columns:
Date | Name | Transaction Type | Amount | Aadhar Number | Phone Number
- Dates are written as Excel dates (format dd/mm/yyyy)
- Amounts are numeric with currency-like formatting (#,##0.00)
- Auto-filter is enabled for the header row

6) POST /api/clear
- Description: Remove all transactions (resets transactions.json to empty array). Use with caution.
- Example:
```bash
curl -X POST http://localhost:3000/api/clear
```

7) GET /api/health
- Example:
```bash
curl http://localhost:3000/api/health
# => {"status":"OK","time":"..."}
```

---

## Validation & file limits

- Required fields for create/update: `date`, `name`, `transactionType`, `amount`.
- Aadhar number (optional): must match /^\d{4}\s\d{4}\s\d{4}$/ if provided (example: `1234 5678 1234`). If omitted, stored as `N/A`.
- Phone (optional): digits only, exactly 10 digits if provided (example: `9876543210`). If omitted, stored as `N/A`.
- Receipt uploads: allowed MIME types — `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`. Max file size 15 MB.

---

## Development notes & tips

- The app serves index.html at the root — the single-page UI is bundled in the repository.
- transactions.json and uploads/receipts are created automatically on first run.
- The project lists `pdf-parse` as a dependency in package.json but the current server implementation doesn't automatically parse PDFs — it accepts receipts as file uploads. PDF parsing/extraction is a candidate improvement.
- There is a `dev` script (`nodemon`) for faster development.
- The `test` script references test.js in package.json, but no test.js is included. Add tests or remove the script as needed.

---

## Security & limitations

- No authentication or authorization — the API is open to anyone who can reach the server. Do not deploy to an untrusted network without adding access controls.
- Data is persisted to a local JSON file. This is simple and convenient, but:
  - Not safe for concurrent writes at scale.
  - No built-in backups — back up transactions.json and uploads if data is important.
  - Consider switching to a proper database (Postgres, MySQL, SQLite, or MongoDB) and object storage for receipts for production.
- Uploaded files are stored on disk. Validate and sanitize uploads if exposing to the public.
- Input validation exists but is minimal — further validation and stricter sanitization is recommended.

---

## Suggested improvements / Next steps
- Add authentication (JWT, API keys, or session-based)
- Replace file-based storage with a database
- Implement server-side PDF parsing (using pdf-parse) to auto-extract transaction details
- Add unit/integration tests and CI
- Add pagination and sorting to the API
- Add rate limiting and input sanitization for security

---

