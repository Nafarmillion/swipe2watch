const AUTH_TOKEN = process.env.REACT_APP_TMDB_AUTH_TOKEN;
const BASE_URL = 'https://api.themoviedb.org/3';

const API_OPTIONS = {
    method: 'GET',
    headers: {
        accept: 'application/json',
        Authorization: `Bearer ${AUTH_TOKEN}`,
    },
};

const EXCLUDED_GENRE_ID = 16; // Animation

// Genre key → TMDB ID maps
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

// Full TMDB ID → genre name lookup (movies + TV combined)
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

export const genreName = (id) => TMDB_GENRE_NAMES[id] || `Genre ${id}`;

const genreKeysToIdString = (map, keys) =>
    keys.map(k => map[k]).filter(Boolean).join('|');

const genreKeysToIdArray = (map, keys) =>
    keys.map(k => map[k]).filter(Boolean);

export const genreKeysToMovieIds    = (keys) => genreKeysToIdString(MOVIE_GENRE_IDS, keys);
export const genreKeysToTvIds       = (keys) => genreKeysToIdString(TV_GENRE_IDS, keys);
export const genreKeysToMovieIdArray = (keys) => genreKeysToIdArray(MOVIE_GENRE_IDS, keys);
export const genreKeysToTvIdArray    = (keys) => genreKeysToIdArray(TV_GENRE_IDS, keys);

// ─── helpers ─────────────────────────────────────────────────────────────────

const PAGES_TO_FETCH = 10; // parallel requests; 10 pages × 20 results = 200 items

const fetchPages = async (pathPrefix, pages, withGenresParam) => {
    const requests = Array.from({ length: pages }, (_, i) => {
        const paramObj = {
            language: 'en-US',
            page: String(i + 1),
            without_genres: String(EXCLUDED_GENRE_ID),
        };
        if (withGenresParam) paramObj.with_genres = withGenresParam;
        const params = new URLSearchParams(paramObj);
        return fetch(`${BASE_URL}${pathPrefix}?${params}`, API_OPTIONS)
            .then(r => (r.ok ? r.json() : null))
            .catch(() => null);
    });
    const pages_data = await Promise.all(requests);
    return pages_data.flatMap(d => (d?.results ?? []));
};

const titleField  = (type) => (type === 'movie' ? 'title' : 'name');
const dateField   = (type) => (type === 'movie' ? 'release_date' : 'first_air_date');
const genreMap    = (type) => (type === 'movie' ? MOVIE_GENRE_IDS : TV_GENRE_IDS);
const idArrayFn   = (type) => (type === 'movie' ? genreKeysToMovieIdArray : genreKeysToTvIdArray);

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

const applyFilters = (items, genreIds, minRating, minVotes, type) =>
    items.filter(item => {
        const title = item[titleField(type)];
        if (!title) return false;
        if (item.vote_average < minRating) return false;
        if (item.vote_count < minVotes) return false;
        if (item.genre_ids?.includes(EXCLUDED_GENRE_ID)) return false;
        if (genreIds.length > 0 && !item.genre_ids?.some(id => genreIds.includes(id))) return false;
        return true;
    });

// ─── public API ──────────────────────────────────────────────────────────────

const getContentList = async (type, filters = {}) => {
    const { limit = 20, genres = [] } = filters;
    const withGenresParam = genreKeysToIdString(genreMap(type), genres);
    const genreIds = genreKeysToIdArray(genreMap(type), genres);

    if (type === 'tv' && genres.length > 0 && genreIds.length === 0) {
        return { results: [] };
    }

    const prefix = type === 'movie' ? '/movie' : '/tv';
    const allItems = await fetchPages(`${prefix}/top_rated`, PAGES_TO_FETCH, withGenresParam);

    const strict  = applyFilters(allItems, genreIds, 6.5, 1000, type);
    const loose   = strict.length >= 5 ? strict : applyFilters(allItems, genreIds, 6.0, 500, type);
    const minimal = loose.length  >= 5 ? loose  : applyFilters(allItems, genreIds, 0, 0, type);

    return { results: minimal.slice(0, limit).map(item => formatItem(item, type)) };
};

const getRandomContent = async (type, genres = []) => {
    const withGenresParam = genreKeysToIdString(genreMap(type), genres);
    const genreIds = genreKeysToIdArray(genreMap(type), genres);

    if (type === 'tv' && genres.length > 0 && genreIds.length === 0) return [];

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
