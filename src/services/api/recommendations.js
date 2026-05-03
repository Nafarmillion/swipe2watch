// recommendations.js
// Generates a set of content suggestions tailored to a room's match profile.
// Looks at genres and content types across all matched items, then calls the
// same TMDB / Jikan endpoints used by ContentFetcher so formatting is consistent.

import { getMovieList, getSeriesList } from './tmdb';
import { getAnimeList, genreKeysToAnimeIds } from './jikan';
import { formatAnimeData } from '../utils/animeDataFormer';

// ─── Genre name → internal key ────────────────────────────────────────────────
// Both TMDB and Jikan (MAL) use the same English genre names for common genres,
// so mapping by name works for both without needing two separate lookup tables.
const GENRE_NAME_TO_KEY = {
    'Action':             'action',
    'Action & Adventure': 'action',
    'Adventure':          'action',
    'Comedy':             'comedy',
    'Drama':              'drama',
    'Crime':              'crime',
    'Horror':             'horror',
    'Romance':            'romance',
    'Fantasy':            'fantasy',
    'Supernatural':       'fantasy',
    'Sci-Fi & Fantasy':   'sci_fi',
    'Science Fiction':    'sci_fi',
    'Mystery':            'mystery',
    'Thriller':           'thriller',
    'Psychological':      'thriller',
    'Mecha':              'sci_fi',
    'Slice of Life':      'drama',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Classifies a content_type string into one of our three fetch buckets.
 *
 * TMDB items are stored with exact lowercase values ('movie', 'tv').
 * Jikan items carry whatever MAL returns ('TV', 'Movie', 'OVA', 'Special', …).
 * The `else → anime` fallback captures every MAL type that isn't a TMDB key.
 */
const classifyType = (type) => {
    if (type === 'movie') return 'movie';
    if (type === 'tv')    return 'tv';
    return 'anime'; // covers Jikan 'TV', 'Movie', 'OVA', 'ONA', 'Special', etc.
};

/**
 * Counts genre frequency and content-type distribution across all matched items.
 *
 * @param {Array}  matches      — match objects, each with a `contentId` (Supabase UUID)
 * @param {Object} contentItems — map of Supabase UUID → content item (type, genres)
 * @returns {{ topGenreKeys: string[], typeCount: { anime, movie, tv } }}
 */
const analyzeMatches = (matches, contentItems) => {
    const genreFreq   = {};
    const typeCount   = { anime: 0, movie: 0, tv: 0 };

    for (const match of matches) {
        const item = contentItems[match.contentId];
        if (!item) continue;

        // Tally content type
        const bucket = classifyType(item.type);
        typeCount[bucket]++;

        // Tally genres — only keys we know how to filter on
        for (const genre of (item.genres || [])) {
            const key = GENRE_NAME_TO_KEY[genre.name];
            if (key) genreFreq[key] = (genreFreq[key] || 0) + 1;
        }
    }

    // Top 3 genres by frequency
    const topGenreKeys = Object.entries(genreFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([key]) => key);

    return { topGenreKeys, typeCount };
};

/**
 * Distributes `total` slots across content types proportionally to how many
 * matches each type contributed, guaranteeing at least 1 slot per present type.
 *
 * @param {{ anime, movie, tv }} typeCount
 * @param {number} total — target number of recommendations (default 5)
 * @returns {{ anime: number, movie: number, tv: number }}
 */
const distributeSlots = (typeCount, total = 5) => {
    const present = Object.entries(typeCount).filter(([, n]) => n > 0);
    if (present.length === 0) return { anime: total, movie: 0, tv: 0 };

    const sum    = present.reduce((acc, [, n]) => acc + n, 0);
    const slots  = { anime: 0, movie: 0, tv: 0 };
    let assigned = 0;

    // Proportional allocation, minimum 1 per present type
    for (const [type, count] of present) {
        const share    = Math.max(1, Math.round((count / sum) * total));
        slots[type]    = share;
        assigned      += share;
    }

    // Trim excess from the largest bucket (keeping it ≥ 1)
    while (assigned > total) {
        const [largest] = [...present].sort((a, b) => slots[b[0]] - slots[a[0]]);
        if (slots[largest[0]] > 1) { slots[largest[0]]--; assigned--; }
        else break;
    }

    // Fill any shortage into the most common type
    while (assigned < total) {
        const [dominant] = [...present].sort((a, b) => b[1] - a[1]);
        slots[dominant[0]]++;
        assigned++;
    }

    return slots;
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetches 5 content recommendations tailored to a room's match profile.
 *
 * Strategy:
 *   1. Count the genres and content types in the matched items.
 *   2. Distribute 5 recommendation slots proportionally across types.
 *   3. Fetch each type using genre filters derived from the match profile.
 *   4. Exclude any items whose IDs already appear in the room's contentItems.
 *
 * @param {Array}  matches      — current room matches (from MatchScreen state)
 * @param {Object} contentItems — all content already in the room (Supabase UUID → item)
 * @returns {Promise<Array>}    — up to 5 formatted recommendation items
 */
export const fetchRecommendations = async (matches, contentItems) => {
    if (!matches?.length) return [];

    const { topGenreKeys, typeCount } = analyzeMatches(matches, contentItems);
    const slots = distributeSlots(typeCount, 5);

    // Build an exclusion set from every item already visible in the room.
    // contentItem.id = external_id (TMDB/MAL numeric ID stored as string),
    // which matches item.id returned by the API formatters.
    const excludeIds = new Set(
        Object.values(contentItems).map(item => String(item.id))
    );

    const results = [];

    // ── Anime ──────────────────────────────────────────────────────────────────
    if (slots.anime > 0) {
        try {
            const genreIds = genreKeysToAnimeIds(topGenreKeys);
            const response = await getAnimeList({
                // Fetch extra items so the exclude filter doesn't leave us short
                limit:    slots.anime + 10,
                order_by: 'score',
                sort:     'desc',
                ...(genreIds ? { genreIds } : {}),
            });
            const formatted = formatAnimeData(response);
            const recs = formatted
                .filter(item => item.image && !excludeIds.has(String(item.id)))
                .slice(0, slots.anime)
                .map(item => ({ ...item, type: 'anime' })); // normalise type label
            results.push(...recs);
        } catch (err) {
            console.error('[recommendations] anime fetch failed:', err);
        }
    }

    // ── Movies ─────────────────────────────────────────────────────────────────
    if (slots.movie > 0) {
        try {
            const { results: movies = [] } = await getMovieList({
                limit:  slots.movie + 10,
                genres: topGenreKeys,
            });
            const recs = movies
                .filter(item => !excludeIds.has(String(item.id)))
                .slice(0, slots.movie);
            results.push(...recs);
        } catch (err) {
            console.error('[recommendations] movies fetch failed:', err);
        }
    }

    // ── TV Series ──────────────────────────────────────────────────────────────
    if (slots.tv > 0) {
        try {
            const { results: series = [] } = await getSeriesList({
                limit:  slots.tv + 10,
                genres: topGenreKeys,
            });
            const recs = series
                .filter(item => !excludeIds.has(String(item.id)))
                .slice(0, slots.tv);
            results.push(...recs);
        } catch (err) {
            console.error('[recommendations] series fetch failed:', err);
        }
    }

    return results.slice(0, 5);
};
