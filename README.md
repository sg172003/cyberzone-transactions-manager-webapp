Cyberzone Transactions Manager Webapp

A lightweight Node.js web application to record and manage daily transactions for Cyberzone.

You can add transactions manually, upload receipts, filter by date range, and export data to Excel.

Live Demo
https://cyberzone-transactions-manager-webapp-production.up.railway.app

Features

Add transactions from the web UI

Upload optional receipts (PDF, DOC, DOCX)

Edit or delete existing records

Filter transactions by date range

Export filtered transactions to Excel (.xlsx)

Simple REST API support

Health check endpoint

Tech Stack

Node.js

Express.js

Multer (file uploads)

XLSX (Excel export)

Nodemon (development)

Project Structure

server.js
Main backend server and API

index.html
Frontend UI

transactions.json
Local file storage for transaction data

uploads/receipts
Stores uploaded receipt files

Local Setup

Clone the repository

git clone https://github.com/sg172003/cyberzone-transactions-manager-webapp.git

cd cyberzone-transactions-manager-webapp

Install dependencies

npm install

Start the server

npm start

Open in browser

http://localhost:3000

Environment Port

Railway uses dynamic ports.

Make sure your server includes:

const PORT = process.env.PORT || 3000;

To run on a custom port locally:

PORT=8080 npm start

API Endpoints

GET /api/transactions
Fetch all transactions or filter by range

POST /api/manual-entry
Add a new transaction with optional receipt upload

PUT /api/transactions/:id
Update a transaction

DELETE /api/transactions/:id
Delete a transaction and its receipt file

GET /api/download-excel
Download transactions as an Excel file

POST /api/clear
Clear all stored transactions

GET /api/health
Server health check

Data Storage Note

This project uses a JSON file for persistence.

Good for:

Small internal apps

Prototypes

Local deployments

For production use, switch to:

Database storage

Cloud file storage for receipts

Authentication and access control

Deployment

This project is deployed on Railway.

Live URL
https://cyberzone-transactions-manager-webapp-production.up.railway.app

Future Improvements

Add login and authentication

Replace JSON storage with a database

Add pagination and sorting

Improve validation and security

Add PDF parsing automation