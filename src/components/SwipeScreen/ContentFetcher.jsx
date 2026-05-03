// swipe/ContentFetcher.jsx
import React, { useEffect } from 'react';
import { addMultipleContentItems } from '../../services/database/superBase';
import { getAnimeList, getRandomAnime, genreKeysToAnimeIds } from '../../services/api/jikan';
import { getMovieList, getSeriesList, getRandomMovies, getRandomSeries, genreName } from '../../services/api/tmdb';
import { formatAnimeData, formatSingleAnime } from '../../services/utils/animeDataFormer';

const ContentFetcher = ({
                            roomCode,
                            roomData,
                            setContentItems,
                            setIsLoading,
                            setError,
                            isFirstUser,
                            fromButton,
                            previousPath
                        }) => {
    // Fetch content when needed
    useEffect(() => {
        // Only fetch content if either:
        // 1. This is the first user joining an empty room
        // 2. User is coming from the match screen via the "Continue Swiping" button
        const shouldFetchContent = (
            (roomData && isFirstUser && (!roomData.contentItems || Object.keys(roomData.contentItems).length === 0)) ||
            (fromButton && previousPath === `/match/${roomCode}`)
        );

        if (shouldFetchContent && roomData?.categories) {
            fetchAndAddContent(roomData.categories);
        }
    }, [roomCode, roomData, isFirstUser, fromButton, previousPath, setContentItems, setIsLoading, setError]);

    // Fetch content based on selected categories
    const fetchAndAddContent = async (categories) => {
        if (!categories) return;

        const genres = roomData?.genres || [];

        setIsLoading(true);

        try {
            let fetchedItems = [];

            // Calculate how many items of each type to fetch based on selected categories
            const selectedCategories = [];
            if (categories.anime) selectedCategories.push('anime');
            if (categories.movies) selectedCategories.push('movies');
            if (categories.series) selectedCategories.push('series');

            const totalItems = 5;
            let itemsPerCategory = {};

            if (selectedCategories.length === 1) {
                // If only one category, fetch all 20 items of that type
                itemsPerCategory[selectedCategories[0]] = totalItems;
            } else if (selectedCategories.length === 2) {
                // If two categories, fetch 10 items of each type
                selectedCategories.forEach(category => {
                    itemsPerCategory[category] = totalItems / 2;
                });
            } else if (selectedCategories.length === 3) {
                // If all three categories, fetch 7 films, 7 anime, 6 series
                itemsPerCategory['movies'] = 7;
                itemsPerCategory['anime'] = 7;
                itemsPerCategory['series'] = 6;
            }

            console.log('Fetching items per category:', itemsPerCategory);

            // Handle anime fetching
            if (categories.anime) {
                const animeLimit = Math.floor(itemsPerCategory['anime']);
                const animeGenreIds = genreKeysToAnimeIds(genres);

                try {
                    let animeList = [];

                    if (animeGenreIds) {
                        // Genre filter selected — use getAnimeList directly (getRandomAnime has no genre support)
                        const animeResponse = await getAnimeList({
                            limit: animeLimit,
                            order_by: 'score',
                            sort: 'desc',
                            genreIds: animeGenreIds,
                        });
                        animeList = formatAnimeData(animeResponse);
                    } else {
                        // No genre filter — use random anime
                        const fetchPromises = [];
                        for (let i = 0; i < animeLimit; i++) {
                            fetchPromises.push(getRandomAnime());
                        }
                        const results = await Promise.allSettled(fetchPromises);
                        for (const result of results) {
                            if (result.status === 'fulfilled') {
                                const formatted = formatSingleAnime(result.value);
                                if (formatted) animeList.push(formatted);
                            }
                        }

                        // Fallback to top anime if not enough
                        if (animeList.length < animeLimit) {
                            const animeResponse = await getAnimeList({
                                limit: animeLimit - animeList.length,
                                order_by: 'score',
                                sort: 'desc',
                            });
                            animeList = [...animeList, ...formatAnimeData(animeResponse)];
                        }
                    }

                    fetchedItems = [...fetchedItems, ...animeList];
                    console.log(`Fetched ${animeList.length} anime items`);
                } catch (error) {
                    console.error('Error fetching anime:', error);
                    const animeResponse = await getAnimeList({ limit: animeLimit, order_by: 'score', sort: 'desc' });
                    const formattedAnime = formatAnimeData(animeResponse);
                    fetchedItems = [...fetchedItems, ...formattedAnime];
                }
            }

            // Handle movies fetching
            if (categories.movies) {
                const moviesLimit = Math.floor(itemsPerCategory['movies']);
                try {
                    // Try to get random movies first
                    let moviesList = await getRandomMovies(genres);

                    // Limit to the calculated number
                    if (moviesList && moviesList.length > 0) {
                        moviesList = moviesList.slice(0, moviesLimit);
                    }

                    // If that doesn't work, try to get popular movies
                    if (!moviesList || moviesList.length < moviesLimit) {
                        console.log('Fetching popular movies as fallback');
                        const moviesResponse = await getMovieList({
                            limit: moviesLimit,
                            order_by: 'popularity',
                            sort: 'desc',
                            genres,
                        });

                        moviesList = moviesResponse.results || [];
                        if (moviesList.length > moviesLimit) {
                            moviesList = moviesList.slice(0, moviesLimit);
                        }
                    }

                    // getRandomMovies/getMovieList already return formatted items
                    fetchedItems = [...fetchedItems, ...moviesList];
                    console.log(`Fetched ${moviesList.length} movie items`);
                } catch (error) {
                    console.error('Error fetching movies:', error);
                }
            }

            // Handle TV series fetching - МОДИФІКОВАНИЙ КОД
            if (categories.series) {
                const seriesLimit = Math.floor(itemsPerCategory['series']);
                try {
                    console.log(`Намагаємось отримати ${seriesLimit} серіалів`);

                    // Отримуємо випадкові серіали
                    let seriesList = await getRandomSeries(genres);
                    console.log(`getRandomSeries повернув ${seriesList ? seriesList.length : 0} серіалів`);

                    // Відлагоджуємо структуру серіалів
                    if (seriesList && seriesList.length > 0) {
                        console.log("Приклад структури серіалу:", JSON.stringify(seriesList[0], null, 2));
                    }

                    // Відразу перевіримо що список не undefined
                    if (!seriesList) {
                        console.log("Серіали не отримано! Створюємо порожній масив");
                        seriesList = [];
                    }

                    // Limit to the calculated number
                    if (seriesList.length > seriesLimit) {
                        seriesList = seriesList.slice(0, seriesLimit);
                        console.log(`Обмежено до ${seriesList.length} серіалів`);
                    }

                    // Fallback для отримання популярних серіалів
                    if (seriesList.length < seriesLimit) {
                        console.log('Fetching popular series as fallback');
                        try {
                            const seriesResponse = await getSeriesList({
                                limit: seriesLimit - seriesList.length,
                                order_by: 'popularity',
                                sort: 'desc',
                                genres,
                            });

                            const additionalSeries = seriesResponse.results || [];
                            console.log(`getSeriesList повернув ${additionalSeries.length} додаткових серіалів`);

                            // Додаємо унікальні серіали (щоб уникнути дублікатів)
                            const existingIds = new Set(seriesList.map(s => s.id));
                            for (const series of additionalSeries) {
                                if (!existingIds.has(series.id)) {
                                    seriesList.push(series);
                                    existingIds.add(series.id);
                                }
                            }

                            if (seriesList.length > seriesLimit) {
                                seriesList = seriesList.slice(0, seriesLimit);
                            }
                        } catch (fallbackError) {
                            console.error('Error in series fallback:', fallbackError);
                        }
                    }

                    console.log(`Всього отримано ${seriesList.length} серіалів перед форматуванням`);

                    // Перевіримо і заповнимо відсутні поля
                    const formattedSeries = seriesList.map(series => {
                        // Друкуємо вихідний серіал для відлагодження
                        console.log(`Formatting series: id=${series.id}, name=${series.title || series.name}`);

                        return {
                            id: series.id,
                            title: series.title || series.name || `Series ${series.id}`,
                            image: series.image ||
                                (series.poster_path ? `https://image.tmdb.org/t/p/w500${series.poster_path}` : null),
                            synopsis: series.synopsis || series.overview || 'No description available.',
                            year: series.year ||
                                (series.first_air_date ? new Date(series.first_air_date).getFullYear() : null),
                            score: series.score || series.vote_average || 0,
                            genres: series.genres ||
                                (series.genre_ids ? series.genre_ids.map(id => ({ id, name: genreName(id) })) : []),
                            type: 'tv'
                        };
                    });

                    console.log(`Після форматування: ${formattedSeries.length} серіалів`);

                    // Фільтруємо тільки серіали, що мають зображення
                    const validSeries = formattedSeries.filter(series => series.image !== null);
                    console.log(`Після фільтрації зображень: ${validSeries.length} валідних серіалів`);

                    // Додаємо серіали до загального списку
                    if (validSeries.length > 0) {
                        console.log("Додаємо серіали до загального списку fetchedItems");
                        fetchedItems = [...fetchedItems, ...validSeries];
                        console.log(`Тепер у fetchedItems ${fetchedItems.length} елементів`);
                    } else {
                        console.warn("Не отримано жодного валідного серіалу!");
                    }
                } catch (error) {
                    console.error('Error fetching TV series:', error);
                }
            }

            console.log(`Total fetched items: ${fetchedItems.length}`);

            // Дебаг: перевіряємо вміст fetchedItems
            if (fetchedItems.length > 0) {
                console.log("Перший елемент fetchedItems:", fetchedItems[0]);

                // Перевіряємо, скільки елементів кожного типу
                const typeCount = {};
                fetchedItems.forEach(item => {
                    const type = item.type || 'unknown';
                    typeCount[type] = (typeCount[type] || 0) + 1;
                });
                console.log("Кількість елементів за типами:", typeCount);
            } else {
                console.warn("fetchedItems порожній!");
            }

            // Shuffle the array to mix different content types
            const shuffleArray = (array) => {
                // Fisher-Yates shuffle algorithm
                for (let i = array.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [array[i], array[j]] = [array[j], array[i]];
                }
                return array;
            };

            // Mix the content types
            const shuffledItems = shuffleArray([...fetchedItems]);
            console.log('Content has been shuffled');

            if (shuffledItems.length === 0) {
                console.error("Немає елементів для додавання в базу даних!");
                setError('Failed to load content. No valid items found.');
                setIsLoading(false);
                return;
            }

            // Додаємо елементи в state
            setContentItems(shuffledItems);

            // Add fetched items to content items state
            try {
                console.log("Додаємо елементи в базу даних...");
                await addMultipleContentItems(roomCode, shuffledItems);
                console.log("Елементи успішно додані в базу даних");
            } catch (err) {
                console.error('Error adding content to database:', err);
                // Навіть при помилці запису в БД, ми все ще можемо показати контент користувачу
            }
        } catch (error) {
            console.error('Error fetching content:', error);
            setError('Failed to load content. Please try again.');
        } finally {
            setIsLoading(false);
        }

    // This component doesn't render anything visible
    return null;
};}

export default ContentFetcher;