// Jikan is an unofficial MAL (MyAnimeList) REST API — no auth key required
const API_URL = 'https://api.jikan.moe/v4';

// Maps our internal genre keys (same keys used for movies/TV) to MAL genre IDs.
// MAL uses a completely separate ID system from TMDB.
const ANIME_GENRE_IDS = {
    action: 1,
    adventure: 2,
    comedy: 4,
    drama: 8,
    fantasy: 10,
    horror: 14,
    mystery: 7,
    romance: 22,
    sci_fi: 24,
    thriller: 41,
    crime: 39,
};

// Converts an array of genre keys to a comma-separated MAL ID string
// required by the Jikan `genres` query parameter
export const genreKeysToAnimeIds = (keys) =>
    keys.map(k => ANIME_GENRE_IDS[k]).filter(Boolean).join(',');

// Fetches a sorted/filtered list of anime from Jikan.
// Pass `genreIds` (from genreKeysToAnimeIds) to filter by genre.
export const getAnimeList = async (filters = {}) => {
    const params = new URLSearchParams({
        limit: filters.limit || 20,
        page: filters.page || 1,
        order_by: filters.order_by || 'score',
        sort: filters.sort || 'desc',
    });
    if (filters.genreIds) {
        params.append('genres', filters.genreIds);
    }
    const response = await fetch(`${API_URL}/anime?${params}`);
    if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json();
    return data;
}

export const getAnimeById = async (id) => {
    const response = await fetch(`${API_URL}/anime/${id}` )
    if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json()
    return data
}
export const getAnimeGenres = async () => {
    const response = await fetch(`${API_URL}/genres/anime`)
    if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json()
    return data
}

export const getRandomAnime = async () => {
    const response = await fetch(`${API_URL}/random/anime`)
    if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json()
    return data
}

export const searchAnime = async (query, filters = {}) => {

        const params = new URLSearchParams({
            q: query,
            limit: filters.limit || 20,
            page: filters.page || 1,
            ...filters
        });

        const response = await fetch(`${API_URL}/anime?${params}`);

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        return data;
};



export const getAnimeImage = async (animeId) => {
    try {
        const response = await fetch(`https://api.jikan.moe/v4/anime/${animeId}`);
        const data = await response.json();
        return data.data.images.jpg.image_url; // Повертає URL зображення
    } catch (error) {
        console.error("Помилка отримання зображення:", error);
        return null;
    }
};




