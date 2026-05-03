import {
    genreName,
    genreKeysToMovieIds,
    genreKeysToTvIds,
    genreKeysToMovieIdArray,
    genreKeysToTvIdArray,
} from '../tmdb';

describe('genreName', () => {
    it('returns a known genre name by TMDB ID', () => {
        expect(genreName(28)).toBe('Action');
        expect(genreName(35)).toBe('Comedy');
        expect(genreName(27)).toBe('Horror');
        expect(genreName(878)).toBe('Science Fiction');
        expect(genreName(99)).toBe('Documentary');
    });

    it('falls back to "Genre <id>" for unknown IDs', () => {
        expect(genreName(9999)).toBe('Genre 9999');
        expect(genreName(0)).toBe('Genre 0');
    });
});

describe('genreKeysToMovieIds', () => {
    it('converts genre keys to a pipe-separated TMDB ID string', () => {
        expect(genreKeysToMovieIds(['comedy', 'horror'])).toBe('35|27');
    });

    it('returns an empty string for an empty array', () => {
        expect(genreKeysToMovieIds([])).toBe('');
    });

    it('silently skips unknown genre keys', () => {
        expect(genreKeysToMovieIds(['unknown_genre', 'comedy'])).toBe('35');
    });

    it('returns a single ID with no pipe for one key', () => {
        expect(genreKeysToMovieIds(['drama'])).toBe('18');
    });
});

describe('genreKeysToTvIds', () => {
    it('converts TV genre keys to a pipe-separated string', () => {
        expect(genreKeysToTvIds(['comedy', 'drama'])).toBe('35|18');
    });

    it('returns empty string when no TV mapping exists for given keys', () => {
        // 'horror' has no TV genre mapping
        expect(genreKeysToTvIds(['horror'])).toBe('');
    });

    it('returns empty string for empty input', () => {
        expect(genreKeysToTvIds([])).toBe('');
    });
});

describe('genreKeysToMovieIdArray', () => {
    it('returns an array of numeric TMDB IDs', () => {
        expect(genreKeysToMovieIdArray(['action', 'comedy'])).toEqual([28, 35]);
    });

    it('returns an empty array for empty input', () => {
        expect(genreKeysToMovieIdArray([])).toEqual([]);
    });

    it('filters out keys with no mapping', () => {
        expect(genreKeysToMovieIdArray(['no_such_genre', 'thriller'])).toEqual([53]);
    });
});

describe('genreKeysToTvIdArray', () => {
    it('returns an empty array for horror (no TV mapping)', () => {
        expect(genreKeysToTvIdArray(['horror'])).toEqual([]);
    });

    it('returns IDs for genres that do map to TV', () => {
        const result = genreKeysToTvIdArray(['comedy', 'crime']);
        expect(result).toContain(35);
        expect(result).toContain(80);
    });
});
