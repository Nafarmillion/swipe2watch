# Swipe2Watch

A Tinder-style app for choosing what to watch together. Users join a shared room, swipe through movies, TV series, and anime, and when everyone in the room swipes right on the same title — it's a match.

## Features

- Create or join a room with a 6-character code
- Filter content by category (Movies / Series / Anime) and genre
- Real-time sync across all room participants via Supabase
- Match notification when all users like the same title
- UI available in English and Ukrainian

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, React Router 6 |
| Real-time DB | Supabase (PostgreSQL + Realtime) |
| Content APIs | TMDB (movies & TV), Jikan/MAL (anime) |
| i18n | i18next, react-i18next |
| Routing | react-router-dom |

## Getting started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- A [TMDB](https://developer.themoviedb.org) account (free)

### Setup

```bash
git clone <repo-url>
cd swipe2watch
npm install
cp .env.example .env
```

Fill in `.env` with your credentials (see [Environment variables](#environment-variables)).

## 🗄️ Database Setup

The project uses [Supabase](https://supabase.com) as its backend.  
A ready-to-use migration file is located at:
migrationsSQL/initial_schema.sql

It creates all five tables (`rooms`, `room_users`, `content_items`, `votes`, `matches`),
indexes, and enables Realtime for all tables.
### Option 1 — Supabase Dashboard (recommended)
1. Open your project in [Supabase Dashboard](https://app.supabase.com)
2. Go to **SQL Editor**
3. Click **New query**
4. Paste the contents of the migration file
5. Click **Run**

### Option 2 — Supabase CLI
```bash
# Install CLI (if not already installed)
npm install -g supabase
# Link to your project
supabase link --project-ref <your-project-ref>
# Apply the migration
supabase db push
```


## Environment variables

Copy `.env.example` to `.env` and set each value:

```env
REACT_APP_TMDB_API_KEY=        # TMDB v3 API key
REACT_APP_TMDB_AUTH_TOKEN=     # TMDB v4 Bearer token
REACT_APP_SUPABASE_URL=        # https://<project>.supabase.co
REACT_APP_SUPABASE_KEY=        # Supabase publishable (anon) key
```


## Project structure

```
src/
├── components/
│   ├── CreateRoom.jsx        # Room creation form (categories, genres)
│   ├── HomePage.jsx          # Landing page
│   ├── WaitingPage.jsx       # Lobby while waiting for participants
│   ├── SwipeScreen.jsx       # Main swipe view
│   ├── MatchScreen.jsx       # Match celebration screen
│   └── SwipeScreen/
│       ├── ContentCard.jsx   # Single swipeable card
│       ├── ContentFetcher.jsx# Fetches and queues content
│       └── ...               # Supporting sub-components
├── services/
│   ├── api/
│   │   ├── tmdb.js           # TMDB movie & TV fetching + genre maps
│   │   └── jikan.js          # Jikan (MAL) anime fetching
│   │   └── recommendations.js# added recommendations to match screen
│   └── database/
│       ├── client.js         # Supabase client instance
│       ├── transforms.js     # Pure DB row → app object converters
│       ├── rooms.js          # Room CRUD + real-time listener
│       ├── content.js        # Content item insertion
│       ├── votes.js          # Voting + match detection
│       ├── matches.js        # Match listener
│       ├── users.js          # User state + viewer index
│       └── superBase.js      # Re-exports (backwards-compat entry point)
├── trans/
│   ├── en.json               # English translations
│   └── ua.json               # Ukrainian translations
└── services/hooks/
    └── use-localstorage.js   # Persistent local state hook
```

## Database schema (Supabase)

| Table | Key columns |
|-------|------------|
| `rooms` | `id`, `code`, `categories`, `genres`, `status` |
| `room_users` | `room_id`, `user_id`, `display_name`, `active`, `viewing_index` |
| `content_items` | `room_id`, `external_id`, `content_type`, `title`, `image_url`, `score` |
| `votes` | `room_id`, `user_id`, `content_item_id`, `liked` |
| `matches` | `room_id`, `content_item_id`, `users` |

## Scripts

App runs at `http://localhost:3000`.
```bash
npm start     # development server
npm test      # run tests in watch mode
npm run test:integration #run integrations test
npm run build # production build
```
