# TechSphere - IET DDUGU Community App

A modern, mobile-first responsive web application for the Technical Community "TechSphere" of the Institute of Engineering & Technology, Deen Dayal Upadhyay Gorakhpur University.

## Features

- **Mobile-First Design**: Optimized for Android/iOS with a bottom navigation bar and a desktop-friendly sidebar.
- **Authentication**: Email/Password and Google Sign-in via Supabase with custom OTP verification.
- **Profile Management**: Capture Name, Branch, Roll Number, Semester, and Social accounts.
- **Event Management**:
  - **Users**: Browse and register for events, view event-specific passes with QR codes.
  - **Admins**: Create/edit events, track registrations, manage user roles, and reset credentials.
- **Challenges & Leaderboard**: Gamified experience for community members.

## Tech Stack

- **Frontend**: React 19, Vite, TypeScript, Tailwind CSS v4, Framer Motion, Lucide Icons.
- **Backend**: Local Node.js API Server (Mock Vercel Serverless Functions) for development, Vercel for production.
- **Database & Auth**: Supabase (PostgreSQL) with Prisma ORM.

## Getting Started

### Prerequisites

- Node.js (v18 or higher process with `--env-file` support, v20.6+ recommended)
- npm or yarn
- A Supabase project

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd techsphere
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   - Copy `.env.example` to `.env`.
   - Fill in your Supabase credentials, database URL, and Google OAuth details.

### Database Setup (Automated)

The project includes a fully automated database setup script. You no longer need to copy-paste SQL manually!

Make sure you have added your `DATABASE_URL` to your `.env` file (found in Supabase > Project Settings > Database > URI). Then run:

```bash
npm run setup
```

This command will:
1. Connect to your database.
2. Automatically create all necessary tables (Profiles, Events, Registrations, OTPs).
3. Configure Row Level Security (RLS) policies.
4. Establish database triggers.
5. Create your default Admin user.

### Running Locally (Full-Stack)

To run both the Vite frontend and local Node.js API server simultaneously, use the full-stack command:

```bash
npm run fullstack
```

1. The API server will start on `http://127.0.0.1:3000`
2. The Vite React app will start on `http://localhost:5173`
3. Open [http://localhost:5173](http://localhost:5173) in your browser.

> Note: The Vite dev server is configured to proxy all `/api` requests automatically to the local API server.

### Deployment

The project is configured for deployment on Vercel.

1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel` to deploy.
3. Ensure all environment variables from `.env` are added to your Vercel project settings.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Your Supabase Project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase Public Anon Key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase Service Role Key (Keep secret!) |
| `DATABASE_URL` | Direct Postgres Connection string for automated setup |
| `ADMIN_EMAIL` | Email for the default admin account created by setup |
| `ADMIN_PASSWORD` | Password for the default admin account created by setup |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth Client ID |
| `DEV_MODE` | Set to "true" to log OTPs in development mode |


