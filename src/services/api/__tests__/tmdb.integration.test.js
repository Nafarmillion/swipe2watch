// Integration tests — require a real TMDB Bearer token.
// Set REACT_APP_TMDB_AUTH_TOKEN in .env before running.
// Run with: npm run test:integration

import { getMovieList, getSeriesList } from '../tmdb';

jest.setTimeout(15000);

describe('TMDB API: getMovieList', () => {
    it('returns a non-empty results array', async () => {
        const result = await getMovieList({ limit: 3 });
        expect(result).toHaveProperty('results');
        expect(result.results.length).toBeGreaterThan(0);
    });

    it('each result has the expected unified shape', async () => {
        const result = await getMovieList({ limit: 3 });
        const movie = result.results[0];
        expect(movie).toHaveProperty('id');
        expect(movie).toHaveProperty('title');
        expect(movie).toHaveProperty('type', 'movie');
        expect(movie).toHaveProperty('image');
        expect(movie).toHaveProperty('synopsis');
        expect(movie).toHaveProperty('score');
        expect(movie).toHaveProperty('genres');
        expect(Array.isArray(movie.genres)).toBe(true);
    });

    it('genre filter returns results', async () => {
        const result = await getMovieList({ limit: 3, genres: ['action'] });
        expect(result.results.length).toBeGreaterThan(0);
    });
});

describe('TMDB API: getSeriesList', () => {
    it('returns a non-empty results array', async () => {
        const result = await getSeriesList({ limit: 3 });
        expect(result).toHaveProperty('results');
        expect(result.results.length).toBeGreaterThan(0);
    });

    it('each result has the expected unified shape', async () => {
        const result = await getSeriesList({ limit: 3 });
        const series = result.results[0];
        expect(series).toHaveProperty('id');
        expect(series).toHaveProperty('title');
        expect(series).toHaveProperty('type', 'tv');
        expect(series).toHaveProperty('image');
        expect(series).toHaveProperty('score');
    });

    it('returns empty results for a genre with no TV mapping (horror)', async () => {
        const result = await getSeriesList({ limit: 3, genres: ['horror'] });
        expect(result.results.length).toBe(0);
    });
});
