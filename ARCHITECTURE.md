# CollabDocs Architecture

## System Overview

CollabDocs is a full-stack real-time document collaboration platform built with modern technologies.

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (React)                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  Auth Pages │  │  Dashboard  │  │   Document Editor       │  │
│  │  - Login    │  │  - List     │  │   - Real-time editing   │  │
│  │  - Register │  │  - Create   │  │   - Live cursors        │  │
│  └─────────────┘  └─────────────┘  │   - Chat sidebar        │  │
│                                      └─────────────────────────┘  │
│                           │                                      │
│              ┌────────────┴────────────┐                       │
│              │      Socket.IO Client     │                       │
│              └────────────┬────────────┘                       │
└───────────────────────────┼──────────────────────────────────────┘
                            │
                            │ WebSocket
                            │ HTTP/REST
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SERVER (Node.js)                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │    Auth     │  │  Documents  │  │      Socket.IO          │  │
│  │  Controller │  │  Controller │  │      Handlers           │  │
│  │    JWT      │  │    CRUD     │  │  - Join/Leave Doc       │  │
│  │   bcrypt    │  │   Share ID  │  │  - Content Changes      │  │
│  └─────────────┘  └─────────────┘  │  - Cursor Tracking      │  │
│                                      │  - Chat Messages        │  │
│  ┌─────────────┐  ┌─────────────┐    │  - Presence System      │  │
│  │   Chat      │  │Collaborators│    └─────────────────────────┘  │
│  │ Controller  │  │ Controller  │                               │
│  └─────────────┘  └─────────────┘                               │
└───────────────────────────┬───────────────────────────────────────┘
                            │
                            │ SQL / PostgREST
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     DATABASE (Supabase)                         │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │    Users    │  │  Documents  │  │  Document Versions    │  │
│  │  - id (PK)  │  │  - id (PK)  │  │  - id (PK)              │  │
│  │  - name     │  │  - title    │  │  - document_id (FK)     │  │
│  │  - email    │  │  - content  │  │  - content              │  │
│  │  - password │  │  - owner_id │  │  - user_id (FK)         │  │
│  │  - created  │  │  - share_id │  │  - created_at           │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────┐  ┌─────────────────────────────┐ │
│  │   Document Collaborators │  │         Messages            │ │
│  │  - document_id (FK)     │  │  - id (PK)                  │ │
│  │  - user_id (FK)         │  │  - document_id (FK)         │ │
│  │  - role                 │  │  - sender_id (FK)           │ │
│  └─────────────────────────┘  │  - content                  │ │
│                                │  - created_at               │ │
│                                └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Real-Time Editing Flow

```
1. User A types in editor
   ↓
2. Client emits 'document-change' via Socket.IO
   ↓
3. Server receives event and broadcasts to room
   ↓
4. User B receives 'content-changed' event
   ↓
5. User B's editor updates (if not current user)
   ↓
6. Debounced auto-save to database (2s delay)
```

### Cursor Tracking Flow

```
1. User moves cursor in editor
   ↓
2. Client emits 'cursor-move' with position
   ↓
3. Server broadcasts 'cursor-update' to room
   ↓
4. Other clients render cursor indicator at position
   ↓
5. Cursor has timeout for stale positions
```

### Chat Message Flow

```
1. User sends message
   ↓
2. Client emits 'send-message' via Socket.IO
   ↓
3. Server saves message to database
   ↓
4. Server broadcasts 'new-message' to room
   ↓
5. All connected clients receive and display message
```

## Key Components

### Authentication System

- **JWT-based**: Stateless authentication using JSON Web Tokens
- **Token Storage**: Stored in localStorage (client) and verified on each request
- **Socket.IO Auth**: Token passed during handshake for WebSocket authentication

### Real-Time Architecture

- **Socket.IO Rooms**: Each document has its own room (`doc:${documentId}`)
- **Broadcasting**: Changes sent to room, excluding sender
- **Debouncing**: Database writes debounced to prevent excessive queries
- **Presence Tracking**: In-memory maps track active users per document

### Database Design

**Row Level Security (RLS)**: All tables have RLS policies for security

**Key Indexes**:
- `users.email` - Fast login lookups
- `documents.owner_id` - Owner document queries
- `documents.share_id` - Share link lookups
- `messages.document_id` - Chat history queries

### State Management

**Client Side**:
- **Zustand**: Not used (React Context instead for simplicity)
- **Auth Context**: Global auth state
- **Socket Context**: Real-time connection state
- **Local State**: Component-level state for UI

**Server Side**:
- **In-Memory Maps**: Active users, cursors, typing indicators
- **Stateless**: No session state stored server-side

## Security Considerations

### Implemented

1. **Password Hashing**: bcrypt with salt rounds 12
2. **JWT Tokens**: Signed with secret, 7-day expiration
3. **CORS**: Configurable origin restrictions
4. **Input Validation**: Express Validator on all inputs
5. **SQL Injection**: Prevented via Supabase client
6. **Row Level Security**: Database-level access control

### Best Practices

- Environment variables for secrets
- HTTPS in production
- Token refresh mechanism (can be added)
- Rate limiting (configured but not enforced)

## Performance Optimizations

1. **Debounced Saves**: 2-second delay before database write
2. **Throttled Cursor Updates**: Cursor position updates limited
3. **Selective Broadcasting**: Only send to relevant document room
4. **Efficient Queries**: Database indexes on frequently queried columns
5. **Lazy Loading**: Chat messages loaded on demand

## Scalability Considerations

### Current Limitations

- Socket.IO in single process (no horizontal scaling)
- In-memory presence tracking
- Single database instance

### Scaling Options

1. **Redis Adapter**: Enable Socket.IO multi-server support
2. **Redis Presence**: Store online status in Redis
3. **Read Replicas**: Supabase supports read replicas
4. **CDN**: Static assets served via CDN

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### Documents
- `GET /api/documents` - List user documents
- `POST /api/documents` - Create document
- `GET /api/documents/:id` - Get document
- `PUT /api/documents/:id` - Update document
- `DELETE /api/documents/:id` - Delete document

### Collaborators
- `GET /api/documents/:id/collaborators` - List collaborators
- `POST /api/documents/:id/collaborators` - Add collaborator
- `DELETE /api/documents/:id/collaborators/:userId` - Remove

### Messages
- `GET /api/messages/:documentId` - Get messages
- `POST /api/messages` - Send message

## WebSocket Events

### Client → Server
- `join-document` - Join document room
- `leave-document` - Leave document room
- `document-change` - Content update
- `cursor-move` - Cursor position
- `send-message` - Chat message
- `typing` - Typing indicator

### Server → Client
- `user-joined` - User entered document
- `user-left` - User left document
- `active-users` - Current active users list
- `content-changed` - Document content updated
- `cursor-update` - Cursor position update
- `new-message` - New chat message
- `user-typing` - Typing status

## File Structure

```
collab-docs/
├── client/
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── contexts/       # React contexts
│   │   ├── pages/          # Page components
│   │   ├── services/       # API & Socket services
│   │   ├── App.jsx         # Main app component
│   │   └── main.jsx        # Entry point
│   ├── public/
│   └── index.html
├── server/
│   └── src/
│       ├── config/         # Configuration
│       ├── controllers/    # Route handlers
│       ├── middleware/     # Express middleware
│       ├── models/         # (using db helpers instead)
│       ├── routes/         # API routes
│       ├── socket/         # Socket.IO handlers
│       ├── utils/          # Utilities
│       └── index.js        # Entry point
├── supabase/
│   └── migrations/         # SQL migrations
└── package.json            # Root package.json
```

## Technology Choices

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | React + Vite | Fast development, modern tooling |
| Styling | Tailwind CSS | Utility-first, rapid development |
| Backend | Node.js + Express | Mature ecosystem, flexible |
| Real-Time | Socket.IO | Reliable fallbacks, room support |
| Database | Supabase (PostgreSQL) | Managed, auth, real-time |
| Icons | Lucide | Clean, consistent icon set |
| State | React Context | Simpler than Redux for this scale |

## Deployment Considerations

### Environment Variables

**Server (.env)**:
- `SUPABASE_URL` - Database connection
- `SUPABASE_SERVICE_KEY` - Admin database access
- `JWT_SECRET` - Token signing (32+ chars)
- `CORS_ORIGIN` - Allowed frontend origin

**Client (.env)`:
- `VITE_API_URL` - Backend API URL
- `VITE_SOCKET_URL` - WebSocket server URL

### Recommended Hosting

- **Frontend**: Vercel, Netlify, or Cloudflare Pages
- **Backend**: Railway, Render, or Fly.io
- **Database**: Supabase (already used)

### Monitoring

- Add logging service (e.g., Sentry, LogRocket)
- Monitor Socket.IO connection health
- Track document save frequency

---

*This architecture supports real-time collaboration with minimal latency and good user experience.*
