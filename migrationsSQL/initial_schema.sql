-- Swipe2Watch — initial database schema
-- Apply via Supabase CLI:  supabase db push
-- Or paste into:           Supabase Dashboard → SQL Editor → Run

-- ─── rooms ───────────────────────────────────────────────────────────────────
-- One row per viewing session. `code` is the 6-char invite code shown to users.
create table if not exists rooms (
    id               uuid primary key default gen_random_uuid(),
    code             varchar(6)  not null unique,
    host_name        text,
    name             text,
    max_participants integer     not null default 5,
    categories       jsonb       not null default '[]',
    genres           jsonb       not null default '[]',
    status           varchar(20) not null default 'active',
    created_at       timestamptz not null default now()
);

-- ─── room_users ───────────────────────────────────────────────────────────────
-- One row per user per room. Unique on (room_id, user_id) so UPSERT is safe
-- when a user refreshes or reconnects — the row is updated, not duplicated.
-- `active = false` is a soft-delete: history and display_name are preserved.
create table if not exists room_users (
    id            uuid primary key default gen_random_uuid(),
    room_id       uuid        not null references rooms(id) on delete cascade,
    user_id       varchar     not null,
    display_name  text,
    joined_at     timestamptz not null default now(),
    active        boolean     not null default true,
    viewing_index integer     not null default 0,
    unique (room_id, user_id)
);

-- ─── content_items ────────────────────────────────────────────────────────────
-- Stores every card that was loaded into a room's swipe session.
-- `external_id` is the TMDB or MAL numeric ID (stored as text for uniformity).
-- `content_type` is one of: 'anime' | 'movie' | 'tv'
create table if not exists content_items (
    id           uuid primary key default gen_random_uuid(),
    room_id      uuid         not null references rooms(id) on delete cascade,
    external_id  varchar      not null,
    title        text         not null default 'Unknown Title',
    description  text,
    image_url    text,
    content_type varchar(20),
    genres       jsonb        not null default '[]',
    year         integer,
    score        float,
    episodes     integer,
    status       varchar,
    rating       varchar,
    added_at     timestamptz  not null default now()
);

-- ─── votes ────────────────────────────────────────────────────────────────────
-- Records every swipe. Unique on (room_id, user_id, content_item_id) so
-- UPSERT is idempotent — re-voting after a reconnect updates, not duplicates.
create table if not exists votes (
    id              uuid primary key default gen_random_uuid(),
    room_id         uuid        not null references rooms(id) on delete cascade,
    user_id         varchar     not null,
    content_item_id uuid        not null references content_items(id) on delete cascade,
    liked           boolean     not null,
    voted_at        timestamptz not null default now(),
    unique (room_id, user_id, content_item_id)
);

-- ─── matches ─────────────────────────────────────────────────────────────────
-- Inserted once when every active participant likes the same content item.
-- `users` is a JSON array of user_id strings for quick display without a join.
create table if not exists matches (
    id              uuid primary key default gen_random_uuid(),
    room_id         uuid        not null references rooms(id) on delete cascade,
    content_item_id uuid        not null references content_items(id) on delete cascade,
    users           jsonb       not null default '[]',
    created_at      timestamptz not null default now()
);

-- ─── indexes ─────────────────────────────────────────────────────────────────
-- All foreign-key columns that appear in WHERE clauses get an index.
create index if not exists idx_room_users_room_id       on room_users(room_id);
create index if not exists idx_content_items_room_id    on content_items(room_id);
create index if not exists idx_votes_room_id            on votes(room_id);
create index if not exists idx_votes_content_item_id    on votes(content_item_id);
create index if not exists idx_matches_room_id          on matches(room_id);

-- ─── realtime ────────────────────────────────────────────────────────────────
-- All five tables must be in the realtime publication so that
-- listenToRoomUpdates() receives INSERT/UPDATE/DELETE events via WebSocket.
alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table room_users;
alter publication supabase_realtime add table content_items;
alter publication supabase_realtime add table votes;
alter publication supabase_realtime add table matches;
