This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.


## running the Application

### 1. Backend (FastAPI)
Open a terminal in `i:/RoboTrader/backend`:
```bash
# Activate Virtual Environment (Windows)
venv\Scripts\activate

# Run Server (Accessible on LAN)
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
*Note: We use `--host 0.0.0.0` to allow access from other devices (like your phone).*

### 2. Frontend (Next.js)
Open a terminal in `i:/RoboTrader/webapp`:
```bash
npm run dev
```
Access the app at:
- **PC**: [http://localhost:3000](http://localhost:3000)
- **Phone/LAN**: `http://192.168.1.9:3000` (Use your actual LAN IP)

### 3. Verify Connection
Ensure your phone is on the same Wi-Fi network. If you see "Network Error", check that proper IP is set in `src/services/api.ts`.
