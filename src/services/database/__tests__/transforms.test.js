import { transformUser, transformContentItem, transformMatch } from '../transforms';

describe('transformUser', () => {
    const baseUser = {
        user_id: 'u1',
        display_name: 'Alice',
        joined_at: '2024-01-15T10:00:00Z',
        active: true,
        viewing_index: 3,
    };

    it('maps DB fields to app fields', () => {
        const result = transformUser(baseUser, []);
        expect(result.displayName).toBe('Alice');
        expect(result.active).toBe(true);
        expect(result.viewingIndex).toBe(3);
        expect(result.joinedAt).toBe(new Date('2024-01-15T10:00:00Z').getTime());
    });

    it('defaults viewingIndex to 0 when undefined', () => {
        const result = transformUser({ ...baseUser, viewing_index: undefined }, []);
        expect(result.viewingIndex).toBe(0);
    });

    it('builds votes object from vote rows for this user', () => {
        const votes = [
            { user_id: 'u1', content_item_id: 42, liked: true },
            { user_id: 'u1', content_item_id: 99, liked: false },
            { user_id: 'u2', content_item_id: 42, liked: true }, // different user — excluded
        ];
        const result = transformUser(baseUser, votes);
        expect(result.votes).toEqual({ 42: true, 99: false });
    });

    it('returns empty votes object when no votes provided', () => {
        expect(transformUser(baseUser, []).votes).toEqual({});
        expect(transformUser(baseUser).votes).toEqual({});
    });
});

describe('transformContentItem', () => {
    const baseItem = {
        id: 1,
        external_id: 'tmdb-550',
        content_type: 'movie',
        title: 'Fight Club',
        image_url: 'https://example.com/poster.jpg',
        description: 'An insomniac office worker...',
        year: 1999,
        score: 8.8,
        genres: [{ id: 18, name: 'Drama' }],
        added_at: '2024-01-15T10:00:00Z',
    };

    it('maps DB fields to app fields', () => {
        const result = transformContentItem(baseItem);
        expect(result.id).toBe('tmdb-550');
        expect(result.title).toBe('Fight Club');
        expect(result.image).toBe('https://example.com/poster.jpg');
        expect(result.synopsis).toBe('An insomniac office worker...');
        expect(result.year).toBe(1999);
        expect(result.score).toBe(8.8);
        expect(result.type).toBe('movie');
        expect(result.genres).toEqual([{ id: 18, name: 'Drama' }]);
    });

    it('converts added_at to milliseconds timestamp', () => {
        const result = transformContentItem(baseItem);
        expect(result.addedAt).toBe(new Date('2024-01-15T10:00:00Z').getTime());
    });
});

describe('transformMatch', () => {
    const match = {
        id: 'm1',
        content_item_id: 7,
        users: ['u1', 'u2'],
        created_at: '2024-02-01T12:00:00Z',
    };
    const contentItem = {
        id: 7,
        external_id: 'mal-1',
        title: 'Cowboy Bebop',
        image_url: 'https://example.com/cb.jpg',
        description: 'A ragtag crew...',
        score: 9.0,
    };

    it('maps match and content item fields to app fields', () => {
        const result = transformMatch(match, contentItem, new Set());
        expect(result.id).toBe('m1');
        expect(result.animeId).toBe('mal-1');
        expect(result.title).toBe('Cowboy Bebop');
        expect(result.image).toBe('https://example.com/cb.jpg');
        expect(result.synopsis).toBe('A ragtag crew...');
        expect(result.score).toBe(9.0);
        expect(result.users).toEqual(['u1', 'u2']);
    });

    it('marks match as new when id is not in processedMatchIds', () => {
        const result = transformMatch(match, contentItem, new Set());
        expect(result.isNew).toBe(true);
    });

    it('marks match as not new when id is already in processedMatchIds', () => {
        const seen = new Set(['m1']);
        const result = transformMatch(match, contentItem, seen);
        expect(result.isNew).toBe(false);
    });

    it('converts created_at to milliseconds timestamp', () => {
        const result = transformMatch(match, contentItem, new Set());
        expect(result.createdAt).toBe(new Date('2024-02-01T12:00:00Z').getTime());
    });
});
