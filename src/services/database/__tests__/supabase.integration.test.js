// Integration tests — require a real Supabase project.
// Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_KEY in .env before running.
// Run with: npm run test:integration

import { supabase } from '../client';

jest.setTimeout(10000);

describe('Supabase: connectivity', () => {
    it('connects and queries the rooms table without error', async () => {
        const { error } = await supabase.from('rooms').select('id').limit(1);
        expect(error).toBeNull();
    });
});

describe('Supabase: schema — rooms', () => {
    it('table has all expected columns', async () => {
        const { data, error } = await supabase
            .from('rooms')
            .select('id, code, host_name, name, max_participants, categories, genres, status, created_at')
            .limit(1);
        expect(error).toBeNull();
        expect(Array.isArray(data)).toBe(true);
    });
});

describe('Supabase: schema — room_users', () => {
    it('table has all expected columns', async () => {
        const { data, error } = await supabase
            .from('room_users')
            .select('id, room_id, user_id, display_name, active, viewing_index, joined_at')
            .limit(1);
        expect(error).toBeNull();
        expect(Array.isArray(data)).toBe(true);
    });
});

describe('Supabase: schema — content_items', () => {
    it('table has all expected columns', async () => {
        const { data, error } = await supabase
            .from('content_items')
            .select('id, room_id, external_id, title, description, image_url, content_type, genres, year, score, added_at')
            .limit(1);
        expect(error).toBeNull();
        expect(Array.isArray(data)).toBe(true);
    });
});

describe('Supabase: schema — votes', () => {
    it('table has all expected columns', async () => {
        const { data, error } = await supabase
            .from('votes')
            .select('id, room_id, user_id, content_item_id, liked, voted_at')
            .limit(1);
        expect(error).toBeNull();
        expect(Array.isArray(data)).toBe(true);
    });
});

describe('Supabase: schema — matches', () => {
    it('table has all expected columns', async () => {
        const { data, error } = await supabase
            .from('matches')
            .select('id, room_id, content_item_id, users, created_at')
            .limit(1);
        expect(error).toBeNull();
        expect(Array.isArray(data)).toBe(true);
    });
});
