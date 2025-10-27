# Spectrum Retail Sales Microservice Portal

This is a full-stack Next.js web application designed to function as a microservice portal. Its primary purpose is to collect daily sales data from multiple retailers (via CSV upload or manual form input) and securely submit it to an external REST API. It also saves a copy of all successful transactions to a private Firebase Firestore database for internal viewing, searching, sorting, and exporting.

## Features

### Multi-Retailer Support 
- dynamically handles multiple retailers with a single API.

### CSV Upload:

- A dedicated page for uploading .csv files of POS sales

### Manual POS Input:

- A dedicated form for submitting single transactions.

### Data Collection & View:

- A dedicated page to view all successfully submitted data.

- Displays data in a powerful shadcn/ui DataTable (using @tanstack/react-table).

- Includes global text search, column sorting (including for custom date formats), and pagination.

- Dynamic date filtering by Month and Year.

### Data Export:

- A dedicated page for exporting data to CSV.

- Fetches all data for a selected retailer.

- Provides options to export all data or filtered data based on Month and Year.

## Tech Stack

- Framework: Next.js (App Router)

- Language: TypeScript

- Styling: Tailwind CSS

- UI Components: shadcn/ui

- Database: Firebase Firestore (for data collection)

- Authentication: Firebase Authentication

- Security: Cloudflare Turnstile

- Package Manager: pnpm

- Data Handling:

  - @tanstack/react-table (Data Table)

  - @tanstack/match-sorter-utils (Fuzzy Search)

  - papaparse (CSV Parsing & Exporting)

  - date-fns & date-fns-tz (Date/Time & Timezone Management)

  - zod (Schema Validation)

  - react-hook-form (Form State Management)

## Project Setup

1. Clone the Repository

```
git clone <your-repository-url>
cd <your-project-directory>
```


2. Install Dependencies

This project uses pnpm as the package manager.

```
pnpm install
```


3. Set Up Environment Variables

Create a file named .env.local in the root of the project. Copy the contents of .env.example (or use the template below) and fill in your private keys from Firebase and Cloudflare.

Template (.env.local):

```
# Firebase Public Keys (for client-side SDK)
NEXT_PUBLIC_FIREBASE_API_KEY="YOUR_API_KEY"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="YOUR_AUTH_DOMAIN"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="YOUR_PROJECT_ID"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="YOUR_STORAGE_BUCKET"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="YOUR_SENDER_ID"
NEXT_PUBLIC_FIREBASE_APP_ID="YOUR_APP_ID"

# Turnstile Cloudflare
NEXT_PUBLIC_TURNSTILE_SITE_KEY="YOUR_TURNSTILE_SITE_KEY"
TURNSTILE_SECRET_KEY="YOUR_TURNSTILE_SECRET_KEY"

# Firebase Admin Keys (for server-side SDK)
FIREBASE_PROJECT_ID="YOUR_PROJECT_ID"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...YOUR_PRIVATE_KEY...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL="YOUR_FIREBASE_CLIENT_EMAIL"

# --- EPOS Configuration ---
# This JSON string defines the retailers, linking keys to display names and secret variable names.
RETAILERS_CONFIG='[
  { "key": "xxx", "name": "name_xxx", "mall": "difc_mall_location", "brand": "brand_xxx", "unit": "unit-assigned-difc-lcoation", "envUserVar": "xxx_USERNAME", "envPassVar": "xxx_PASSWORD" },
  { "key": "yyy", "name": "name_yyy.", "mall": "difc_mall_location", "brand": "brand_yyy.", "unit": "unit-assigned-difc-lcoation", "envUserVar": "yyy_USERNAME", "envPassVar": "yyy_PASSWORD" },
  { "key": "zzz", "name": "name_zzz", "mall": "difc_mall_location", "brand": "brand_zzz", "unit": "unit-assigned-difc-lcoation", "envUserVar": "zzz_USERNAME", "envPassVar": "zzz_PASSWORD" }
]'

# --- Retailer Secrets ---
# These variable names MUST match the envUserVar/envPassVar values above
xxx_USERNAME=""
xxx_PASSWORD=""

yyy_USERNAME=""
yyy_PASSWORD=""

zzz_USERNAME=""
zzz_PASSWORD=""

# --- External API URL ---
EXTERNAL_API_URL="[https://epos.difc.ae/...](https://epos.difc.ae/...)"
```


4. Running the Application

Development:
Run the development server (with Turbopack):

```
pnpm run dev
```


Open http://localhost:3000 to view it in the browser.

Production Build:
To create an optimized production build:

```
pnpm run build
```


## API Endpoints

This application uses the following custom API routes:

POST /api/upload-sales:

The main backend endpoint for processing both CSV and manual form data.

Receives a retailerKey to select credentials.

Contacts the external REST API.

Saves successful transactions to the corresponding Firestore collection (e.g., receiptsHos).

GET /api/get-receipts:

Securely reads from Firestore using the Admin SDK.

Requires a retailerKey query parameter.

Returns all receipts for that retailer to the client-side data table and export page.

GET /api/retailers:

Securely reads the RETAILERS_CONFIG on the server.

Returns only the safe list of retailer keys and names (e.g., [{ key: "xxx", name: "name_xxx" }]) to populate frontend dropdowns.

POST /api/verify-turnstile:

Securely verifies the user's Cloudflare Turnstile token on the server during login.