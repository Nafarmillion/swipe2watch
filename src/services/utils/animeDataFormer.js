import { genreName } from '../api/tmdb';

// Виправлена функція форматування даних для фільмів та серіалів з TMDb
export const formatTMDBContent = (tmdbData, contentType = 'movie') => {
    // Перевірка на null або undefined
    if (!tmdbData) {
        console.error('Received null or undefined data from TMDb API');
        return null;
    }

    console.log(`Formatting TMDb data for ${contentType}:`, tmdbData);

    // Створення базової структури об'єкта з перевірками на undefined
    const formattedContent = {
        id: tmdbData.id || null,
        // Вибір відповідного поля залежно від типу контенту
        title: contentType === 'movie' ? (tmdbData.title || 'Unknown Movie') : (tmdbData.name || 'Unknown Series'),
        titleEnglish: contentType === 'movie' ? (tmdbData.title || tmdbData.original_title || '') : (tmdbData.name || tmdbData.original_name || ''),
        // Перевірка на наявність постера та правильне форматування URL
        image: tmdbData.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbData.poster_path}` : null,
        backdrop: tmdbData.backdrop_path ? `https://image.tmdb.org/t/p/w1280${tmdbData.backdrop_path}` : null,
        synopsis: tmdbData.overview || 'No description available.',
        // Отримання року з дати з перевірками
        year: (() => {
            try {
                if (contentType === 'movie' && tmdbData.release_date) {
                    return new Date(tmdbData.release_date).getFullYear();
                } else if (contentType === 'tv' && tmdbData.first_air_date) {
                    return new Date(tmdbData.first_air_date).getFullYear();
                }
                return null;
            } catch (e) {
                console.error('Error parsing date:', e);
                return null;
            }
        })(),
        score: tmdbData.vote_average || 0,
        // Форматування жанрів з перевіркою
        genres: (() => {
            if (tmdbData.genres && Array.isArray(tmdbData.genres)) {
                return tmdbData.genres.map(genre => ({
                    id: genre.id || 0,
                    name: genre.name || 'Unknown Genre'
                }));
            } else if (tmdbData.genre_ids && Array.isArray(tmdbData.genre_ids)) {
                return tmdbData.genre_ids.map(id => ({
                    id: id,
                    name: genreName(id)
                }));
            }
            return [];
        })(),
        type: contentType, // 'movie' або 'tv'
        // Додаткова інформація для фільмів
        runtime: tmdbData.runtime || null,
        // Додаткова інформація для серіалів
        seasons: tmdbData.number_of_seasons || null,
        episodes: tmdbData.number_of_episodes || null
    };

    console.log('Formatted content:', formattedContent);
    return formattedContent;
};

// Виправлена функція форматування даних для аніме
export const formatAnimeData = (animeData) => {
    // Перевірка на null або undefined
    if (!animeData || !animeData.data) {
        console.error('Received null or undefined data from Jikan API');
        return [];
    }

    console.log('Formatting anime data, received items:', animeData.data.length);

    return animeData.data.map(anime => {
        try {
            // Створення об'єкта з перевірками на undefined
            const formattedAnime = {
                id: anime.mal_id || null,
                title: anime.title || 'Unknown Anime',
                titleEnglish: anime.title_english || '',
                // Перевірка існування об'єкта images перед доступом до його властивостей
                image: anime.images && anime.images.jpg ?
                    (anime.images.jpg.large_image_url || anime.images.jpg.image_url || null) : null,
                synopsis: anime.synopsis || 'No description available.',
                // Перевірка рік із різних джерел
                year: anime.year || (anime.aired && anime.aired.from ? new Date(anime.aired.from).getFullYear() : null),
                score: anime.score || 0,
                // Перевірка існування масиву genres
                genres: anime.genres ? anime.genres.map(genre => ({
                    id: genre.mal_id || 0,
                    name: genre.name || 'Unknown Genre'
                })) : [],
                episodes: anime.episodes || null,
                status: anime.status || null,
                rating: anime.rating || null,
                type: anime.type || 'anime' // TV, Movie, OVA тощо
            };

            return formattedAnime;
        } catch (e) {
            console.error('Error formatting anime item:', e, anime);
            // Повертаємо базовий об'єкт з ID якщо можливо
            return {
                id: anime.mal_id || null,
                title: anime.title || 'Unknown Anime',
                image: null,
                synopsis: 'No description available.',
                year: null,
                score: 0,
                genres: [],
                type: 'anime'
            };
        }
    }).filter(item => item.id !== null); // Фільтруємо елементи без ID
};

// Виправлена версія formatSingleAnime функції
export const formatSingleAnime = (animeData) => {
    // Перевірка на null або undefined
    if (!animeData || !animeData.data) {
        console.error('Received null or undefined data for single anime');
        return null;
    }

    try {
        const data = animeData.data;

        // Створення об'єкта з перевірками на undefined
        return {
            id: data.mal_id || null,
            title: data.title || 'Unknown Anime',
            titleEnglish: data.title_english || '',
            // Перевірка існування об'єкта images
            image: data.images && data.images.jpg ?
                (data.images.jpg.large_image_url || data.images.jpg.image_url || null) : null,
            synopsis: data.synopsis || 'No description available.',
            // Перевірка aired перед доступом до from
            year: data.year || (data.aired && data.aired.from ? new Date(data.aired.from).getFullYear() : null),
            score: data.score || 0,
            // Перевірка існування масиву genres
            genres: data.genres ? data.genres.map(genre => ({
                id: genre.mal_id || 0,
                name: genre.name || 'Unknown Genre'
            })) : [],
            episodes: data.episodes || null,
            status: data.status || null,
            rating: data.rating || null,
            type: data.type || 'anime',
            duration: data.duration || null,
            source: data.source || null,
            // Перевірка існування trailer перед доступом до url
            trailer: data.trailer && data.trailer.url ? data.trailer.url : null,
            // Перевірка існування studios масиву
            studios: data.studios ? data.studios.map(studio => studio.name || 'Unknown Studio') : []
        };
    } catch (e) {
        console.error('Error formatting single anime:', e);
        return null;
    }
};