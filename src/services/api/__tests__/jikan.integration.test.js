// Integration tests — Jikan requires no auth key.
// Run with: npm run test:integration

import { getAnimeList, getAnimeById } from '../jikan';

jest.setTimeout(15000);

describe('Jikan API: getAnimeList', () => {
    it('returns a non-empty data array', async () => {
        const result = await getAnimeList({ limit: 3 });
        expect(result).toHaveProperty('data');
        expect(Array.isArray(result.data)).toBe(true);
        expect(result.data.length).toBeGreaterThan(0);
    });

    it('each result has the expected MAL shape', async () => {
        const result = await getAnimeList({ limit: 3 });
        const anime = result.data[0];
        expect(anime).toHaveProperty('mal_id');
        expect(anime).toHaveProperty('title');
        expect(anime).toHaveProperty('images');
        expect(anime.images).toHaveProperty('jpg');
        expect(anime).toHaveProperty('score');
        expect(anime).toHaveProperty('genres');
        expect(Array.isArray(anime.genres)).toBe(true);
    });

    it('genre filter returns results for action (MAL id=1)', async () => {
        const result = await getAnimeList({ limit: 3, genreIds: '1' });
        expect(result.data.length).toBeGreaterThan(0);
    });
});

describe('Jikan API: getAnimeById', () => {
    it('returns correct anime for Cowboy Bebop (mal_id=1)', async () => {
        const result = await getAnimeById(1);
        expect(result).toHaveProperty('data');
        expect(result.data.mal_id).toBe(1);
        expect(result.data.title).toMatch(/Cowboy Bebop/i);
    });
});
