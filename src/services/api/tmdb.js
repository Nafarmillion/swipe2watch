const AUTH_TOKEN = process.env.REACT_APP_TMDB_AUTH_TOKEN;
const BASE_URL = 'https://api.themoviedb.org/3';

// Default request options — Bearer token is required for TMDB API v4
const API_OPTIONS = {
    method: 'GET',
    headers: {
        accept: 'application/json',
        Authorization: `Bearer ${AUTH_TOKEN}`,
    },
};

// Animation is excluded globally — it overlaps too heavily with anime
const EXCLUDED_GENRE_ID = 16;

// ─── Genre ID maps ────────────────────────────────────────────────────────────
// Maps our internal genre keys (stored in Supabase) to TMDB numeric IDs.
// Movies and TV series use different IDs for the same concept (e.g. sci-fi → 878 vs 10765).
const MOVIE_GENRE_IDS = {
    comedy: 35, drama: 18, action: 28, crime: 80, horror: 27,
    romance: 10749, fantasy: 14, mystery: 9648, thriller: 53,
    sci_fi: 878, adventure: 12, family: 10751, documentary: 99,
};

const TV_GENRE_IDS = {
    comedy: 35, drama: 18, action: 10759, crime: 80,
    mystery: 9648, fantasy: 10765, sci_fi: 10765,
    family: 10751, documentary: 99,
};

// Full lookup table: TMDB numeric ID → human-readable name (movies + TV combined).
// Used to render genre tags on cards without an extra API call.
const TMDB_GENRE_NAMES = {
    28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy',
    80: 'Crime', 99: 'Documentary', 18: 'Drama', 10751: 'Family',
    14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music',
    9648: 'Mystery', 10749: 'Romance', 878: 'Science Fiction',
    10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western',
    10759: 'Action & Adventure', 10762: 'Kids', 10763: 'News',
    10764: 'Reality', 10765: 'Sci-Fi & Fantasy', 10766: 'Soap',
    10767: 'Talk', 10768: 'War & Politics',
};

// Returns the display name for a TMDB genre ID; safe fallback for unknown IDs
export const genreName = (id) => TMDB_GENRE_NAMES[id] || `Genre ${id}`;

// ─── Genre key converters ─────────────────────────────────────────────────────
// Convert our internal genre keys to TMDB-compatible formats.

// Pipe-separated string for the `with_genres` query param (OR logic in TMDB)
const genreKeysToIdString = (map, keys) =>
    keys.map(k => map[k]).filter(Boolean).join('|');

// Array of IDs used for client-side filtering after the API response arrives
const genreKeysToIdArray = (map, keys) =>
    keys.map(k => map[k]).filter(Boolean);

export const genreKeysToMovieIds    = (keys) => genreKeysToIdString(MOVIE_GENRE_IDS, keys);
export const genreKeysToTvIds       = (keys) => genreKeysToIdString(TV_GENRE_IDS, keys);
export const genreKeysToMovieIdArray = (keys) => genreKeysToIdArray(MOVIE_GENRE_IDS, keys);
export const genreKeysToTvIdArray    = (keys) => genreKeysToIdArray(TV_GENRE_IDS, keys);

// ─── Fetch helpers ────────────────────────────────────────────────────────────

// Fetch multiple pages in parallel and flatten results into one array.
// 10 pages × 20 results per page = up to 200 candidates per call.
const PAGES_TO_FETCH = 10;

const fetchPages = async (pathPrefix, pages, withGenresParam) => {
    const requests = Array.from({ length: pages }, (_, i) => {
        const paramObj = {
            language: 'en-US',
            page: String(i + 1),
            without_genres: String(EXCLUDED_GENRE_ID), // always exclude animation
        };
        if (withGenresParam) paramObj.with_genres = withGenresParam;
        const params = new URLSearchParams(paramObj);
        return fetch(`${BASE_URL}${pathPrefix}?${params}`, API_OPTIONS)
            .then(r => (r.ok ? r.json() : null))
            .catch(() => null); // treat network errors as empty pages
    });
    const pages_data = await Promise.all(requests);
    return pages_data.flatMap(d => (d?.results ?? []));
};

// Movies and TV series use different JSON field names for the same concept
const titleField  = (type) => (type === 'movie' ? 'title' : 'name');
const dateField   = (type) => (type === 'movie' ? 'release_date' : 'first_air_date');
const genreMap    = (type) => (type === 'movie' ? MOVIE_GENRE_IDS : TV_GENRE_IDS);
const idArrayFn   = (type) => (type === 'movie' ? genreKeysToMovieIdArray : genreKeysToTvIdArray);

// Normalise a raw TMDB item into the unified shape the rest of the app expects.
// Callers must NOT reformat the result — it is already ready to display.
const formatItem = (item, type) => ({
    id:       item.id,
    title:    item[titleField(type)] || item.title || item.name,
    image:    item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : '/default-poster.png',
    synopsis: item.overview || 'No description available.',
    year:     item[dateField(type)] ? new Date(item[dateField(type)]).getFullYear() : null,
    score:    item.vote_average || 0,
    genres:   (item.genre_ids ?? []).map(id => ({ id, name: genreName(id) })),
    type,
});

// Client-side genre filter — applied after the API response arrives.
// The API's `with_genres` uses OR logic, so it can return items that only
// partially match; this filter ensures at least one selected genre is present.
// minRating / minVotes thresholds are passed in so the caller can progressively
// relax quality requirements when results are scarce.
const applyFilters = (items, genreIds, minRating, minVotes, type) =>
    items.filter(item => {
        const title = item[titleField(type)];
        if (!title) return false;
        if (item.vote_average < minRating) return false;
        if (item.vote_count < minVotes) return false;
        if (item.genre_ids?.includes(EXCLUDED_GENRE_ID)) return false;
        // If genres were selected, at least one must match
        if (genreIds.length > 0 && !item.genre_ids?.some(id => genreIds.includes(id))) return false;
        return true;
    });

// ─── Public API ───────────────────────────────────────────────────────────────

// Fetches a curated list of top-rated content for the given type and filters.
// Uses three quality tiers: strict → loose → minimal, so niche genre combos
// always return something rather than an empty list.
const getContentList = async (type, filters = {}) => {
    const { limit = 20, genres = [] } = filters;
    const withGenresParam = genreKeysToIdString(genreMap(type), genres);
    const genreIds = genreKeysToIdArray(genreMap(type), genres);

    // If the user selected genres that have no TV mapping (e.g. horror), bail early
    // to avoid returning completely unrelated TV shows
    if (type === 'tv' && genres.length > 0 && genreIds.length === 0) {
        return { results: [] };
    }

    const prefix = type === 'movie' ? '/movie' : '/tv';
    const allItems = await fetchPages(`${prefix}/top_rated`, PAGES_TO_FETCH, withGenresParam);

    // Progressive quality fallback: strict (6.5★, 1000 votes) → loose → minimal
    const strict  = applyFilters(allItems, genreIds, 6.5, 1000, type);
    const loose   = strict.length >= 5 ? strict : applyFilters(allItems, genreIds, 6.0, 500, type);
    const minimal = loose.length  >= 5 ? loose  : applyFilters(allItems, genreIds, 0, 0, type);

    return { results: minimal.slice(0, limit).map(item => formatItem(item, type)) };
};

// Fetches content from a random page of "popular" titles for variety between sessions.
// Returns already-formatted items — callers must NOT reformat them.
const getRandomContent = async (type, genres = []) => {
    const withGenresParam = genreKeysToIdString(genreMap(type), genres);
    const genreIds = genreKeysToIdArray(genreMap(type), genres);

    if (type === 'tv' && genres.length > 0 && genreIds.length === 0) return [];

    // Pick a random page (1–5) so different sessions surface different titles
    const randomPage = Math.floor(Math.random() * 5) + 1;
    const prefix = type === 'movie' ? '/movie' : '/tv';

    const paramObj = {
        language: 'en-US',
        page: String(randomPage),
        without_genres: String(EXCLUDED_GENRE_ID),
    };
    if (withGenresParam) paramObj.with_genres = withGenresParam;
    const params = new URLSearchParams(paramObj);

    const response = await fetch(`${BASE_URL}${prefix}/popular?${params}`, API_OPTIONS);
    if (!response.ok) return [];
    const data = await response.json();
    const allItems = data.results ?? [];

    const filtered = applyFilters(allItems, genreIds, 6.5, 500, type);
    const result   = filtered.length >= 5 ? filtered : applyFilters(allItems, genreIds, 6.0, 200, type);

    return result.map(item => formatItem(item, type));
};

export const getMovieList    = (filters) => getContentList('movie', filters);
export const getSeriesList   = (filters) => getContentList('tv', filters);
export const getRandomMovies = (genres)  => getRandomContent('movie', genres);
export const getRandomSeries = (genres)  => getRandomContent('tv', genres);
