# CollabDocs - Real-Time Collaboration Tool

A full-stack real-time document collaboration platform built with React, Node.js, Express, Socket.IO, and Supabase. Features live editing, cursor tracking, real-time chat, and user presence.

## Features

- **User Authentication**: JWT-based signup, login, and logout
- **Document Management**: Create, edit, delete documents with unique shareable IDs
- **Real-Time Collaboration**: Multiple users editing simultaneously via WebSockets
- **Live Cursor Tracking**: See other users' cursor positions in real-time
- **Real-Time Chat**: Document-specific chat with message persistence
- **Auto Save**: Debounced auto-save to prevent excessive database writes
- **Presence System**: See active users and their status
- **Role-Based Access**: Viewer and editor permissions
- **Version History**: Document snapshots for recovery

## Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, React Router
- **Backend**: Node.js, Express.js, Socket.IO
- **Database**: Supabase (PostgreSQL)
- **Authentication**: JWT-based with bcrypt
- **Real-Time**: WebSockets via Socket.IO

## Project Structure

```
collab-docs/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── contexts/       # React context providers
│   │   ├── hooks/          # Custom React hooks
│   │   ├── pages/          # Page components
│   │   ├── services/       # API and Socket.IO services
│   │   └── utils/          # Utility functions
│   └── public/
├── server/                 # Node.js backend
│   ├── src/
│   │   ├── config/         # Configuration files
│   │   ├── controllers/    # Route controllers
│   │   ├── middleware/     # Express middleware
│   │   ├── models/         # Database models/queries
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   ├── socket/         # Socket.IO handlers
│   │   └── utils/          # Utility functions
│   └── tests/
└── supabase/               # Database migrations and setup
    └── migrations/
```

## Quick Start

### Prerequisites

- Node.js 18+ installed
- Supabase account (free tier works)
- Git

### Setup

1. **Clone and install dependencies**:
```bash
cd collab-docs
npm run setup
```

2. **Configure environment variables**:
   - Copy `server/.env.example` to `server/.env` and fill in your Supabase credentials
   - Copy `client/.env.example` to `client/.env` and configure the API URL

3. **Set up Supabase database**:
   - Run the SQL migrations in `supabase/migrations/` in your Supabase SQL editor
   - Or use the Supabase CLI if configured

4. **Start development servers**:
```bash
npm run dev
```

This starts:
- Frontend: http://localhost:5173
- Backend: http://localhost:5000
- Socket.IO: ws://localhost:5000

## Environment Variables

### Server (.env)
```
PORT=5000
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key
JWT_SECRET=your_jwt_secret_min_32_chars
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:5173
```

### Client (.env)
```
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

## API Documentation

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### Documents
- `GET /api/documents` - List user documents
- `POST /api/documents` - Create document
- `GET /api/documents/:id` - Get single document
- `PUT /api/documents/:id` - Update document
- `DELETE /api/documents/:id` - Delete document
- `POST /api/documents/:id/share` - Share document

### Collaborators
- `GET /api/documents/:id/collaborators` - List collaborators
- `POST /api/documents/:id/collaborators` - Add collaborator
- `DELETE /api/documents/:id/collaborators/:userId` - Remove collaborator

## WebSocket Events

### Client to Server
- `join-document` - Join a document room
- `leave-document` - Leave a document room
- `document-change` - Send document content changes
- `cursor-move` - Send cursor position updates
- `send-message` - Send chat message

### Server to Client
- `user-joined` - User joined notification
- `user-left` - User left notification
- `document-updated` - Document content updated
- `cursor-update` - Cursor position update
- `new-message` - New chat message
- `active-users` - List of active users

## Production Deployment

1. **Build frontend**:
```bash
npm run build
```

2. **Set production environment variables**

3. **Deploy server** to platform of choice (Railway, Render, etc.)

4. **Deploy client** to static hosting (Vercel, Netlify, etc.)

## License

MIT License - feel free to use for personal or commercial projects.
