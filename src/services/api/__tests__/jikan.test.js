import { genreKeysToAnimeIds } from '../jikan';

describe('genreKeysToAnimeIds', () => {
    it('converts genre keys to a comma-separated MAL ID string', () => {
        expect(genreKeysToAnimeIds(['action', 'comedy'])).toBe('1,4');
    });

    it('returns an empty string for an empty array', () => {
        expect(genreKeysToAnimeIds([])).toBe('');
    });

    it('silently skips unknown genre keys', () => {
        expect(genreKeysToAnimeIds(['unknown_key', 'horror'])).toBe('14');
    });

    it('handles all supported genre keys without throwing', () => {
        const allKeys = [
            'action', 'adventure', 'comedy', 'drama',
            'fantasy', 'horror', 'mystery', 'romance',
            'sci_fi', 'thriller', 'crime',
        ];
        const result = genreKeysToAnimeIds(allKeys);
        expect(result).toBeTruthy();
        expect(result.split(',').length).toBe(allKeys.length);
    });
});
