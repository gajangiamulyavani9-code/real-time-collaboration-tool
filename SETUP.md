# CollabDocs Setup Guide

This guide will walk you through setting up the CollabDocs application locally.

## Prerequisites

- **Node.js** 18+ (Download from [nodejs.org](https://nodejs.org/))
- **npm** or **yarn** (comes with Node.js)
- **Git** for cloning the repository
- **Supabase** account (free tier works fine)

## Quick Setup (3 Steps)

### Step 1: Install Dependencies

Open your terminal in the project root and run:

```bash
# Install all dependencies (root, server, and client)
npm run setup
```

This runs `npm install` in the root, server, and client directories.

### Step 2: Configure Environment Variables

#### Backend Configuration

1. Copy the example environment file:
```bash
cp server/.env.example server/.env
```

2. Open `server/.env` and fill in your Supabase credentials:

```env
PORT=5000
NODE_ENV=development

# Get these from your Supabase project settings
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key

# Generate a random string (at least 32 characters)
JWT_SECRET=your-super-secret-jwt-key-min-32-characters-long
JWT_EXPIRES_IN=7d

CORS_ORIGIN=http://localhost:5173
```

#### Frontend Configuration

1. Copy the example environment file:
```bash
cp client/.env.example client/.env
```

2. Open `client/.env`:

```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

### Step 3: Set Up Database

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Create a new project (or use existing)
3. Go to the **SQL Editor** in the left sidebar
4. Create a **New query**
5. Copy the contents of `supabase/migrations/001_initial_schema.sql`
6. Paste and run the SQL
7. Then run `002_add_realtime.sql` for realtime features

## Running the Application

### Development Mode (Recommended)

Run both server and client with one command:

```bash
npm run dev
```

This starts:
- **Backend**: http://localhost:5000
- **Frontend**: http://localhost:5173

### Run Separately

```bash
# Terminal 1: Backend
npm run server

# Terminal 2: Frontend
npm run client
```

### Production Build

```bash
# Build the frontend
npm run build

# Start the backend (serves the built frontend)
npm start
```

## Getting Supabase Credentials

1. Sign up/login at [supabase.com](https://supabase.com)
2. Create a new project
3. Wait for the project to be created
4. In your project dashboard:
   - **Project Settings** → **API** → Copy `URL` (for SUPABASE_URL)
   - **Project Settings** → **API** → Copy `service_role` secret (for SUPABASE_SERVICE_KEY)
   - **Project Settings** → **API** → Copy `anon` public key (for SUPABASE_ANON_KEY)

⚠️ **Important**: Keep your `service_role` key secret! Never commit it to git.

## Verifying Your Setup

After starting the application:

1. Open http://localhost:5173 in your browser
2. You should see the login page
3. Register a new account
4. Create a document
5. Open the same document in another browser/incognito window
6. Test real-time collaboration by typing in both windows

## Troubleshooting

### Port already in use
```bash
# Kill processes on port 5000
npx kill-port 5000

# Kill processes on port 5173
npx kill-port 5173
```

### Supabase connection errors
- Check your Supabase project is active (not paused)
- Verify your credentials in `server/.env`
- Ensure you ran the database migrations

### CORS errors
- Make sure `CORS_ORIGIN` in `server/.env` matches your frontend URL
- For development, it should be `http://localhost:5173`

### JWT errors
- Ensure `JWT_SECRET` is at least 32 characters long
- Restart the server after changing environment variables

## Project Structure

```
collab-docs/
├── client/          # React frontend
│   ├── src/
│   │   ├── components/  # Reusable components
│   │   ├── contexts/    # React contexts
│   │   ├── pages/       # Page components
│   │   └── services/    # API & Socket services
│   └── public/
├── server/          # Node.js backend
│   └── src/
│       ├── controllers/ # Route handlers
│       ├── middleware/  # Express middleware
│       ├── routes/      # API routes
│       └── socket/      # Socket.IO handlers
├── supabase/
│   └── migrations/      # Database SQL files
└── package.json         # Root package.json
```

## Next Steps

- 📖 Read the API documentation in the backend code comments
- 🔌 Explore WebSocket events in `server/src/socket/socket.handlers.js`
- 🎨 Customize the UI in `client/src/pages/`
- 🚀 Deploy to production (see README.md)

## Support

If you encounter issues:
1. Check the console logs for error messages
2. Verify all environment variables are set correctly
3. Ensure database migrations were run successfully
4. Try restarting both servers

Happy collaborating! 🚀
