import { createClient } from '@supabase/supabase-js';


// Initialize Supabase client1123123
// URL и ключ должны быть корректными для вашего проекта
const supabaseUrl = 'https://kenniqsxrzbioeyrzsna.supabase.co';
const supabaseKey = 'sb_publishable_DrlbhljYBIlx7QCvY5L6fQ_YozE_xtZ';

// Создаем клиент с правильными заголовками и параметрами
const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: false
    },
    global: {
        headers: {
            'apikey': supabaseKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    }
});

// Keep track of already seen matches for all the functions that need it
let processedMatches = new Set();

/**
 * Generate a random room code
 * @returns {string} - Random 6-character room code
 */
const generateRoomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
};

/**
 * Create a new room
 * @param {Object} roomData - Room data (categories, genres, etc.)
 * @returns {Promise<string>} - Promise that returns the room code
 */
export const createRoom = async (roomData) => {
    try {
        const roomCode = generateRoomCode();

        // Create room data with timestamp
        const newRoomData = {
            code: roomCode,
            host_name: roomData.hostName || roomData.name || 'Host',
            name: roomData.name || '',
            max_participants: roomData.maxParticipants || 5,
            categories: roomData.categories ?? [],
            genres: roomData.genres ?? [],
            created_at: new Date().toISOString(),
            status: 'active'
        };


        // Insert room into Supabase
        const { data, error } = await supabase
            .from('rooms')
            .insert(newRoomData)
            .select()
            .maybeSingle();

        if (error) throw error;

        return roomCode;
    } catch (error) {
        console.error('Error creating room:', error);
        throw error;
    }
};

/**
 * Join a room
 * @param {string} roomCode - Room code
 * @param {string} userId - User ID
 * @param {string} displayName - User's display name
 * @returns {Promise<Object>} - Promise that returns room data
 */
export const joinRoom = async (roomCode, userId, displayName) => {
    try {
        // Get room data
        const { data: roomData, error: roomError } = await supabase
            .from('rooms')
            .select('*')
            .eq('code', roomCode)
            .maybeSingle();

        if (roomError) {
            throw new Error(`Room with code ${roomCode} doesn't exist`);
        }

        // First check if the user already exists in the room
        const { data: existingUser, error: existingUserError } = await supabase
            .from('room_users')
            .select('*')
            .eq('room_id', roomData.id)
            .eq('user_id', userId)
            .maybeSingle();

        // Create or update user data
        const userData = {
            room_id: roomData.id,
            user_id: userId,
            display_name: displayName,
            joined_at: existingUser ? existingUser.joined_at : new Date().toISOString(),
            active: true // Set user to active in any case
        };

        // Use upsert to update the record if it exists
        const { error: userError } = await supabase
            .from('room_users')
            .upsert(userData, {
                onConflict: 'room_id,user_id' // Specify the conflict columns explicitly
            });

        if (userError) {
            console.error("Error upserting user:", userError);
            throw userError;
        }

        // Rest of your function remains the same...

        return roomData;
    } catch (error) {
        console.error('Error joining room:', error);
        throw error;
    }
};

/**
 * Get room information
 * @param {string} roomCode - Room code
 * @returns {Promise<Object>} - Promise that returns room data
 */
export const getRoomInfo = async (roomCode) => {
    try {
        // Get basic room data
        const { data: room, error: roomError } = await supabase
            .from('rooms')
            .select('*')
            .eq('code', roomCode)
            .maybeSingle();

        if (roomError) {
            throw new Error(`Room with code ${roomCode} doesn't exist`);
        }

        // Get users
        const { data: users, error: usersError } = await supabase
            .from('room_users')
            .select('*')
            .eq('room_id', room.id);

        if (usersError) throw usersError;

        // Get content items
        const { data: contentItems, error: contentError } = await supabase
            .from('content_items')
            .select('*')
            .eq('room_id', room.id);

        if (contentError) throw contentError;

        // Get matches
        const { data: matches, error: matchesError } = await supabase
            .from('matches')
            .select('*')
            .eq('room_id', room.id);

        if (matchesError) throw matchesError;

        // Get votes
        const { data: votes, error: votesError } = await supabase
            .from('votes')
            .select('*')
            .eq('room_id', room.id);

        if (votesError) throw votesError;

        // Transform users to object with user_id as key
        const usersObject = {};
        users.forEach(user => {
            // Get user's votes
            const userVotes = {};
            votes.forEach(vote => {
                if (vote.user_id === user.user_id) {
                    userVotes[vote.content_item_id] = vote.liked;
                }
            });

            usersObject[user.user_id] = {
                displayName: user.display_name,
                joinedAt: new Date(user.joined_at).getTime(),
                active: user.active,
                viewingIndex: user.viewing_index || 0,
                votes: userVotes
            };
        });

        const contentItemsObject = {};
        contentItems.forEach(item => {
            // Skip items with "Unknown Title"
            if (item.title && item.title !== "Unknown Title" && item.synopsis && item.synopsis !== "No description available.") {
                contentItemsObject[item.id] = {
                    id: item.external_id,
                    title: item.title,
                    image: item.image_url,
                    synopsis: item.description,
                    year: item.year,
                    score: item.score,
                    genres: item.genres,
                    type: item.content_type,
                    addedAt: new Date(item.added_at).getTime()
                };
            }


            // Debug logging
            console.log(`Item ${item.id}: Title = ${item.title}, Description = ${item.description}`);
        });
        // Create a map of content items by id for easy lookup
        const contentItemsMap = {};
        contentItems.forEach(item => {
            contentItemsMap[item.id] = item;
        });

        // Transform matches to object with content_item_id as key
        const matchesObject = {};
        matches.forEach(match => {
            const contentItem = contentItemsMap[match.content_item_id];

            if (contentItem) {
                matchesObject[match.content_item_id] = {
                    id: match.id,
                    animeId: contentItem.external_id,
                    title: contentItem.title,
                    image: contentItem.image_url,
                    synopsis: contentItem.description,
                    score: contentItem.score,
                    users: match.users || [],
                    createdAt: new Date(match.created_at).getTime(),
                    isNew: !processedMatches.has(match.id)
                };
            }
        });

        // Combine everything into Firebase-like structure
        return {
            ...room,
            users: usersObject,
            contentItems: contentItemsObject,
            matches: matchesObject
        };
    } catch (error) {
        console.error('Error getting room info:', error);
        throw error;
    }
};

/**
 * Listen for room updates using Supabase realtime
 * @param {string} roomCode - Room code
 * @param {Function} callback - Function to call with updated data
 * @returns {Function} - Function to unsubscribe from the listener
 */
export const listenToRoomUpdates = (roomCode, callback) => {
    // Get room_id first because realtime needs primary key
    const getAndListenToRoom = async () => {
        try {
            const { data: roomData } = await supabase
                .from('rooms')
                .select('id')
                .eq('code', roomCode)
                .maybeSingle();

            if (!roomData) throw new Error('Room not found');

            const roomId = roomData.id;

            // Function to fetch and transform the data into Firebase-like structure
            const fetchAndTransformData = async () => {
                // Get room data
                const { data: room } = await supabase
                    .from('rooms')
                    .select('*')
                    .eq('id', roomId)
                    .maybeSingle();

                // Get users
                const { data: users } = await supabase
                    .from('room_users')
                    .select('*')
                    .eq('room_id', roomId);

                // Get content items
                const { data: contentItems } = await supabase
                    .from('content_items')
                    .select('*')
                    .eq('room_id', roomId);

                // Get matches
                const { data: matches } = await supabase
                    .from('matches')
                    .select('*, content_items(*)')
                    .eq('room_id', roomId);

                // Get votes by user
                const { data: votes } = await supabase
                    .from('votes')
                    .select('*')
                    .eq('room_id', roomId);

                // Transform to Firebase-like structure
                const usersObject = {};
                users.forEach(user => {
                    // Get user's votes
                    const userVotes = {};
                    votes.forEach(vote => {
                        if (vote.user_id === user.user_id) {
                            userVotes[vote.content_item_id] = vote.liked;
                        }
                    });

                    usersObject[user.user_id] = {
                        displayName: user.display_name,
                        joinedAt: new Date(user.joined_at).getTime(),
                        active: user.active,
                        viewingIndex: user.viewing_index || 0,
                        votes: userVotes
                    };
                });

                // Transform content items
                const contentItemsObject = {};
                contentItems.forEach(item => {
                    contentItemsObject[item.id] = {
                        id: item.external_id,
                        title: item.title,
                        image: item.image_url,
                        synopsis: item.description,
                        year: item.year,
                        score: item.score,
                        genres: item.genres,
                        type: item.content_type,
                        addedAt: new Date(item.added_at).getTime()
                    };
                });

                // Transform matches
                const matchesObject = {};
                matches.forEach(match => {
                    matchesObject[match.content_item_id] = {
                        id: match.id,
                        animeId: match.content_item_id,
                        users: match.users,
                        createdAt: new Date(match.created_at).getTime()
                    };
                });

                // Build final Firebase-like structure
                const transformedData = {
                    ...room,
                    users: usersObject,
                    contentItems: contentItemsObject,
                    matches: matchesObject
                };

                return transformedData;
            };

            // Subscribe to changes in the room
            const roomSubscription = supabase
                .channel(`room:${roomId}`)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'rooms',
                        filter: `id=eq.${roomId}`
                    },
                    async () => {
                        const data = await fetchAndTransformData();
                        callback(data);
                    }
                )
                .subscribe();

            // Also subscribe to changes in related tables
            const usersSubscription = supabase
                .channel(`room_users:${roomId}`)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'room_users',
                        filter: `room_id=eq.${roomId}`
                    },
                    async () => {
                        const data = await fetchAndTransformData();
                        callback(data);
                    }
                )
                .subscribe();

            const contentSubscription = supabase
                .channel(`content_items:${roomId}`)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'content_items',
                        filter: `room_id=eq.${roomId}`
                    },
                    async () => {
                        const data = await fetchAndTransformData();
                        callback(data);
                    }
                )
                .subscribe();

            const matchesSubscription = supabase
                .channel(`matches:${roomId}`)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'matches',
                        filter: `room_id=eq.${roomId}`
                    },
                    async () => {
                        const data = await fetchAndTransformData();
                        callback(data);
                    }
                )
                .subscribe();

            const votesSubscription = supabase
                .channel(`votes:${roomId}`)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'votes',
                        filter: `room_id=eq.${roomId}`
                    },
                    async () => {
                        const data = await fetchAndTransformData();
                        callback(data);
                    }
                )
                .subscribe();

            // Immediately get initial data
            const data = await fetchAndTransformData();
            callback(data);

            // Return unsubscribe function
            return () => {
                roomSubscription.unsubscribe();
                usersSubscription.unsubscribe();
                contentSubscription.unsubscribe();
                matchesSubscription.unsubscribe();
                votesSubscription.unsubscribe();
            };
        } catch (error) {
            console.error('Error in listenToRoomUpdates:', error);
            throw error;
        }
    };

    // Start listening and return the unsubscribe function
    const unsubscribePromise = getAndListenToRoom();
    return () => {
        unsubscribePromise.then(unsubscribe => unsubscribe());
    };
};

/**
 * Add a content item to the room
 * @param {string} roomCode - Room code
 * @param {Object} contentItem - Content item (movie, series, anime)
 * @returns {Promise<number>} - Promise that returns the item ID
 */
export const addContentItem = async (roomCode, contentItem) => {
    try {
        // Get room ID
        const { data: roomData, error: roomError } = await supabase
            .from('rooms')
            .select('id')
            .eq('code', roomCode)
            .maybeSingle();

        if (roomError) throw roomError;

        // Check if the content item already exists
        const { data: existingItems, error: checkError } = await supabase
            .from('content_items')
            .select('id')
            .eq('room_id', roomData.id)
            .eq('external_id', contentItem.id.toString());

        if (checkError) throw checkError;

        // If it already exists, return the existing ID
        if (existingItems && existingItems.length > 0) {
            return existingItems[0].id;
        }

        // Add content item
        const { data, error } = await supabase
            .from('content_items')
            .insert({
                room_id: roomData.id,
                content_type: contentItem.type,
                external_id: contentItem.id.toString(), // Ensure it's a string
                title: contentItem.title || 'Unknown Title',
                image_url: contentItem.image,
                description: contentItem.synopsis,
                year: contentItem.year,
                score: contentItem.score,
                genres: contentItem.genres || [],
                episodes: contentItem.episodes,
                status: contentItem.status,
                rating: contentItem.rating,
                added_at: new Date().toISOString()
            })
            .select()
            .maybeSingle();

        if (error) throw error;

        return data.id;
    } catch (error) {
        console.error('Error adding content item:', error);
        throw error;
    }
};

/**
 * Add multiple content items to the room
 * @param {string} roomCode - Room code
 * @param {Array<Object>} contentItems - Array of content items
 * @returns {Promise<Array<number>>} - Promise that returns array of item IDs
 */
// Виправлена функція для додавання багатьох елементів контенту
export const addMultipleContentItems = async (roomCode, contentItems) => {
    try {
        console.log('Original content items:', contentItems);

        // Отримання ID кімнати
        const { data: roomData, error: roomError } = await supabase
            .from('rooms')
            .select('id')
            .eq('code', roomCode)
            .maybeSingle();

        if (roomError) {
            console.error('Error getting room data:', roomError);
            throw roomError;
        }

        // Отримання існуючих елементів контенту для уникнення дублікатів
        const { data: existingItems, error: existingError } = await supabase
            .from('content_items')
            .select('external_id, id')
            .eq('room_id', roomData.id);

        if (existingError) {
            console.error('Error getting existing items:', existingError);
            throw existingError;
        }

        // Створення мапи існуючих елементів
        const existingItemMap = {};
        existingItems.forEach(item => {
            existingItemMap[item.external_id] = item.id;
        });

        // Фільтрація для видалення елементів, які вже існують
        const newItems = contentItems.filter(item =>
            item && item.id && !existingItemMap[item.id.toString()]
        );

        console.log(`Found ${newItems.length} new items to add`);

        // Якщо нових елементів немає, повернення існуючих ID
        if (newItems.length === 0) {
            console.log('No new items to add');
            return contentItems.map(item => {
                if (!item || !item.id) return null;
                return existingItemMap[item.id.toString()];
            }).filter(id => id !== null);
        }

        // Підготовка елементів контенту для вставки з перевіркою на undefined
        const itemsToInsert = newItems.map(item => {
            // Перевірка на null або undefined
            if (!item || !item.id) {
                console.error('Invalid item found:', item);
                return null;
            }

            // Безпечне отримання значень з перевірками на undefined
            const safeItem = {
                room_id: roomData.id,
                content_type: item.type || 'unknown',
                external_id: String(item.id), // Гарантуємо, що буде строка
                title: item.title || 'Unknown Title',
                image_url: item.image || null,
                description: item.synopsis || 'No description available.',
                year: item.year || null,
                score: item.score || null,
                genres: Array.isArray(item.genres) ? item.genres : [],
                episodes: item.episodes || null,
                status: item.status || null,
                rating: item.rating || null,
                added_at: new Date().toISOString()
            };

            console.log('Prepared item for insertion:', safeItem);
            return safeItem;
        }).filter(item => item !== null); // Видалення null елементів

        if (itemsToInsert.length === 0) {
            console.log('No valid items to insert after filtering');
            return [];
        }

        console.log(`Inserting ${itemsToInsert.length} items`);

        // Додавання всіх нових елементів контенту
        const { data: insertedItems, error: insertError } = await supabase
            .from('content_items')
            .insert(itemsToInsert)
            .select('id, external_id');

        if (insertError) {
            console.error('Error inserting items:', insertError);
            throw insertError;
        }

        console.log('Successfully inserted items:', insertedItems);

        // Створення мапи нових вставлених елементів
        const insertedItemMap = {};
        if (insertedItems) {
            insertedItems.forEach(item => {
                insertedItemMap[item.external_id] = item.id;
            });
        }

        // Повернення всіх ID (існуючих і нових вставлених)
        return contentItems.map(item => {
            if (!item || !item.id) return null;
            const externalId = item.id.toString();
            return existingItemMap[externalId] || insertedItemMap[externalId] || null;
        }).filter(id => id !== null);
    } catch (error) {
        console.error('Error in addMultipleContentItems:', error);
        throw error;
    }
};

/**
 * Vote for content
 * @param {string} roomCode - Room code
 * @param {string} userId - User ID
 * @param {string} animeId - Anime ID from the external API
 * @param {boolean} liked - Whether the user liked the anime
 * @returns {Promise<void>}
 */
export const voteForContent = async (roomCode, userId, animeId, liked) => {
    try {
        console.log(`User ${userId} voting for anime ${animeId}, liked: ${liked}`);

        // Get room ID and data
        const { data: roomData, error: roomError } = await supabase
            .from('rooms')
            .select('*')
            .eq('code', roomCode)
            .maybeSingle();

        if (roomError) throw roomError;

        // Find the content item by external_id (animeId)
        const { data: contentItems, error: contentError } = await supabase
            .from('content_items')
            .select('id, external_id')
            .eq('room_id', roomData.id)
            .eq('external_id', animeId.toString());

        if (contentError) throw contentError;

        let contentItemId;

        // If the content item doesn't exist yet, we need to handle this differently
        if (contentItems.length === 0) {
            // Log the issue for debugging
            console.log(`Content item with external_id ${animeId} not found. Creating it...`);

            // Create a minimal content item record
            const { data: newItem, error: createError } = await supabase
                .from('content_items')
                .insert({
                    room_id: roomData.id,
                    external_id: animeId.toString(),
                    title: `Anime ${animeId}`, // Placeholder
                    content_type: 'anime',
                    added_at: new Date().toISOString()
                })
                .select('id')
                .maybeSingle();

            if (createError) throw createError;
            contentItemId = newItem.id;
        } else {
            contentItemId = contentItems[0].id;
        }

        // Now save the user's vote with the correct content_item_id
        const { error: voteError } = await supabase
            .from('votes')
            .upsert({
                room_id: roomData.id,
                user_id: userId,
                content_item_id: contentItemId,
                liked: liked,
                voted_at: new Date().toISOString()
            });

        if (voteError) throw voteError;

        // If it's a dislike, finish processing
        if (!liked) return;

        // Check if there's a match (all active users liked the content)
        // First get all active users
        const { data: activeUsers, error: usersError } = await supabase
            .from('room_users')
            .select('user_id')
            .eq('room_id', roomData.id)
            .eq('active', true);

        if (usersError) throw usersError;

        // Then check if all active users liked this content
        const activeUserIds = activeUsers.map(user => user.user_id);

        console.log(`Active users: ${JSON.stringify(activeUserIds)}`);

        const { data: votes, error: likesError } = await supabase
            .from('votes')
            .select('user_id')
            .eq('room_id', roomData.id)
            .eq('content_item_id', contentItemId)
            .eq('liked', true);

        if (likesError) throw likesError;

        const usersThatLiked = votes.map(vote => vote.user_id);

        console.log(`Users that liked: ${JSON.stringify(usersThatLiked)}`);

        // Check if all active users liked this content
        const isMatch = activeUserIds.length > 0 &&
            activeUserIds.every(userId => usersThatLiked.includes(userId)) &&
            activeUserIds.length === usersThatLiked.length;

        console.log(`Is match: ${isMatch}`);

        // If there's a match, check if the match already exists
        if (isMatch) {
            const { data: existingMatch, error: matchCheckError } = await supabase
                .from('matches')
                .select('id')
                .eq('room_id', roomData.id)
                .eq('content_item_id', contentItemId);

            if (matchCheckError) throw matchCheckError;

            // Only insert if there's no existing match
            if (!existingMatch || existingMatch.length === 0) {
                console.log(`Creating new match for content item ${contentItemId}`);

                const { data: newMatch, error: matchError } = await supabase
                    .from('matches')
                    .insert({
                        room_id: roomData.id,
                        content_item_id: contentItemId,
                        users: usersThatLiked,
                        created_at: new Date().toISOString()
                    })
                    .select()
                    .maybeSingle();

                if (matchError) {
                    console.error('Error creating match:', matchError);
                    throw matchError;
                }

                console.log(`Match created successfully`);
            } else {
                console.log(`Match already exists`);
            }
        }
    } catch (error) {
        console.error('Error voting for content:', error);
        throw error;
    }
};

/**
 * Listen for matches
 * @param {string} roomCode - Room code
 * @param {Function} callback - Function to call with updated matches
 * @returns {Function} - Function to unsubscribe from the listener
 */
export const listenToMatches = (roomCode, callback) => {
    const getAndListenToMatches = async () => {
        try {
            // Get room ID
            const { data: roomData, error: roomError } = await supabase
                .from('rooms')
                .select('id')
                .eq('code', roomCode)
                .maybeSingle();

            if (roomError) throw roomError;

            // Function to fetch and transform matches
            const fetchAndTransformMatches = async (onlyNew = false) => {
                // Get matches
                const { data: matches, error: matchesError } = await supabase
                    .from('matches')
                    .select('*')
                    .eq('room_id', roomData.id)
                    .order('created_at', { ascending: false });

                if (matchesError) throw matchesError;

                if (!matches || matches.length === 0) {
                    return { matches: {}, hasNewMatches: false };
                }

                // Check if there are any new matches
                let hasNewMatches = false;
                const currentMatchIds = new Set();

                matches.forEach(match => {
                    currentMatchIds.add(match.id);
                    if (!processedMatches.has(match.id)) {
                        hasNewMatches = true;
                        processedMatches.add(match.id);
                    }
                });

                // If we only want new matches and there aren't any, return empty
                if (onlyNew && !hasNewMatches) {
                    return { matches: {}, hasNewMatches: false };
                }

                // Get content items related to the matches
                const matchContentIds = matches.map(match => match.content_item_id);

                const { data: contentItems, error: contentError } = await supabase
                    .from('content_items')
                    .select('*')
                    .in('id', matchContentIds);

                if (contentError) throw contentError;

                // Create a map of content items by id for easy lookup
                const contentItemsMap = {};
                contentItems.forEach(item => {
                    contentItemsMap[item.id] = item;
                });

                // Transform to Firebase-like structure
                const matchesObject = {};
                matches.forEach(match => {
                    const contentItem = contentItemsMap[match.content_item_id];

                    if (contentItem) {
                        matchesObject[match.content_item_id] = {
                            id: match.id, // Add the actual match id for tracking
                            animeId: contentItem.external_id,
                            title: contentItem.title,
                            image: contentItem.image_url,
                            synopsis: contentItem.description,
                            score: contentItem.score,
                            users: match.users || [],
                            createdAt: new Date(match.created_at).getTime(),
                            // Flag to indicate if this is a new match (not seen before)
                            isNew: !processedMatches.has(match.id) || processedMatches.size === 1
                        };
                    }
                });

                console.log("Transformed matches:", matchesObject, "Has new matches:", hasNewMatches);
                return { matches: matchesObject, hasNewMatches };
            };

            // Subscribe to changes in matches
            const matchesSubscription = supabase
                .channel(`matches:${roomData.id}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'matches',
                        filter: `room_id=eq.${roomData.id}`
                    },
                    async (payload) => {
                        try {
                            // A new match was created
                            console.log("New match detected:", payload);

                            // Mark this match as new
                            if (payload.new && payload.new.id) {
                                processedMatches.add(payload.new.id);
                            }

                            const { matches, hasNewMatches } = await fetchAndTransformMatches(false);

                            // Only notify if there's actually a new match
                            if (hasNewMatches || Object.keys(matches).length > 0) {
                                callback(matches, true); // Second parameter indicates new matches
                            }
                        } catch (err) {
                            console.error('Error fetching matches after INSERT:', err);
                        }
                    }
                )
                .subscribe();

            // Get initial matches
            try {
                const { matches, hasNewMatches } = await fetchAndTransformMatches(false);
                callback(matches, false); // Not treating initial load as "new" matches
            } catch (err) {
                console.error('Error fetching initial matches:', err);
                callback({}, false);
            }

            // Return unsubscribe function
            return () => {
                matchesSubscription.unsubscribe();
            };
        } catch (error) {
            console.error('Error in listenToMatches:', error);
            callback({}, false);
            return () => {}; // Return empty function if there's an error
        }
    };

    const unsubscribePromise = getAndListenToMatches();
    return () => {
        unsubscribePromise.then(unsubscribe => unsubscribe());
    };
};

/**
 * Listen for user updates
 * @param {string} roomCode - Room code
 * @param {string} userId - User ID
 * @param {Function} callback - Function to call with updated user data
 * @returns {Function} - Function to unsubscribe from the listener
 */
export const listenToUserUpdates = (roomCode, userId, callback) => {
    const getAndListenToUser = async () => {
        try {
            // Get room ID
            const { data: roomData, error: roomError } = await supabase
                .from('rooms')
                .select('id')
                .eq('code', roomCode)
                .maybeSingle();

            if (roomError) throw roomError;

            // Function to fetch and transform user data
            const fetchAndTransformUserData = async () => {
                // Get user data
                const { data: userData, error: userError } = await supabase
                    .from('room_users')
                    .select('*')
                    .eq('room_id', roomData.id)
                    .eq('user_id', userId)
                    .maybeSingle();

                if (userError) throw userError;

                // Get user votes
                const { data: userVotes, error: votesError } = await supabase
                    .from('votes')
                    .select('*')
                    .eq('room_id', roomData.id)
                    .eq('user_id', userId);

                if (votesError) throw votesError;

                // Transform votes to object with content_item_id as key
                const votesObject = {};
                userVotes.forEach(vote => {
                    votesObject[vote.content_item_id] = vote.liked;
                });

                // Transform to Firebase-like structure
                return {
                    displayName: userData.display_name,
                    joinedAt: new Date(userData.joined_at).getTime(),
                    active: userData.active,
                    viewingIndex: userData.viewing_index || 0,
                    votes: votesObject
                };
            };

            // Subscribe to changes in user data
            const userSubscription = supabase
                .channel(`user:${roomData.id}:${userId}`)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'room_users',
                        filter: `room_id=eq.${roomData.id} AND user_id=eq.${userId}`
                    },
                    async () => {
                        try {
                            const userData = await fetchAndTransformUserData();
                            callback(userData);
                        } catch (err) {
                            console.error('Error fetching user data:', err);
                        }
                    }
                )
                .subscribe();

            // Subscribe to changes in user votes
            const votesSubscription = supabase
                .channel(`user_votes:${roomData.id}:${userId}`)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'votes',
                        filter: `room_id=eq.${roomData.id} AND user_id=eq.${userId}`
                    },
                    async () => {
                        try {
                            const userData = await fetchAndTransformUserData();
                            callback(userData);
                        } catch (err) {
                            console.error('Error fetching user data:', err);
                        }
                    }
                )
                .subscribe();

            // Get initial user data
            try {
                const userData = await fetchAndTransformUserData();
                callback(userData);
            } catch (err) {
                console.error('Error fetching initial user data:', err);
            }

            // Return unsubscribe function
            return () => {
                userSubscription.unsubscribe();
                votesSubscription.unsubscribe();
            };
        } catch (error) {
            console.error('Error in listenToUserUpdates:', error);
            return () => {}; // Return empty function if there's an error
        }
    };

    const unsubscribePromise = getAndListenToUser();
    return () => {
        unsubscribePromise.then(unsubscribe => unsubscribe());
    };
};

/**
 * Get active users count
 * @param {string} roomCode - Room code
 * @returns {Promise<number>} - Promise that returns number of active users
 */
export const getActiveUsersCount = async (roomCode) => {
    try {
        // Get room ID
        const { data: roomData, error: roomError } = await supabase
            .from('rooms')
            .select('id')
            .eq('code', roomCode)
            .maybeSingle();

        if (roomError) throw roomError;

        // Count active users
        const { data, error } = await supabase
            .from('room_users')
            .select('user_id', { count: 'exact' })
            .eq('room_id', roomData.id)
            .eq('active', true);

        if (error) throw error;

        return data.length;
    } catch (error) {
        console.error('Error getting active users count:', error);
        return 0;
    }
};

/**
 * Listen for changes in active users count
 * @param {string} roomCode - Room code
 * @param {Function} callback - Function to call with updated count
 * @returns {Function} - Function to unsubscribe from the listener
 */
export const listenToUsersCount = (roomCode, callback) => {
    const getAndListenToUsersCount = async () => {
        try {
            // Get room ID
            const { data: roomData, error: roomError } = await supabase
                .from('rooms')
                .select('id')
                .eq('code', roomCode)
                .maybeSingle();

            if (roomError) throw roomError;

            // Subscribe to changes in room users
            const subscription = supabase
                .channel(`room_users:${roomData.id}`)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'room_users',
                        filter: `room_id=eq.${roomData.id}`
                    },
                    async () => {
                        // Get updated count
                        const { data, error } = await supabase
                            .from('room_users')
                            .select('user_id', { count: 'exact' })
                            .eq('room_id', roomData.id)
                            .eq('active', true);

                        if (!error) {
                            callback(data.length);
                        }
                    }
                )
                .subscribe();

            // Get initial count
            const { data, error } = await supabase
                .from('room_users')
                .select('user_id', { count: 'exact' })
                .eq('room_id', roomData.id)
                .eq('active', true);

            if (!error) {
                callback(data.length);
            }

            // Return unsubscribe function
            return () => {
                subscription.unsubscribe();
            };
        } catch (error) {
            console.error('Error in listenToUsersCount:', error);
            callback(0);
            return () => {}; // Return empty function if there's an error
        }
    };

    const unsubscribePromise = getAndListenToUsersCount();
    return () => {
        unsubscribePromise.then(unsubscribe => unsubscribe());
    };
};

/**
 * Update user viewing index
 * @param {string} roomCode - Room code
 * @param {string} userId - User ID
 * @param {number} index - Current viewing index
 * @returns {Promise<void>}
 */
export const updateUserViewingIndex = async (roomCode, userId, index) => {
    try {
        // Get room ID
        const { data: roomData, error: roomError } = await supabase
            .from('rooms')
            .select('id')
            .eq('code', roomCode)
            .maybeSingle();

        if (roomError) throw roomError;

        // Update user viewing index
        const { error } = await supabase
            .from('room_users')
            .update({ viewing_index: index })
            .eq('room_id', roomData.id)
            .eq('user_id', userId);

        if (error) throw error;
    } catch (error) {
        console.error('Error updating viewing index:', error);
        throw error;
    }
};

/**
 * Leave room
 * @param {string} roomCode - Room code
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
export const leaveRoom = async (roomCode, userId) => {
    try {
        // Get room ID
        const { data: roomData, error: roomError } = await supabase
            .from('rooms')
            .select('id')
            .eq('code', roomCode)
            .maybeSingle();

        if (roomError) throw roomError;

        // Update user active status to false instead of deleting
        const { error } = await supabase
            .from('room_users')
            .update({ active: false })
            .eq('room_id', roomData.id)
            .eq('user_id', userId);

        if (error) throw error;

        // Check if there are any active users left in the room
        const { data: remainingUsers, error: countError } = await supabase
            .from('room_users')
            .select('user_id', { count: 'exact' })
            .eq('room_id', roomData.id)
            .eq('active', true);

        if (countError) throw countError;

        // If no active users, mark the room as inactive
        if (remainingUsers.length === 0) {
            const { error: updateError } = await supabase
                .from('rooms')
                .update({ status: 'inactive' })
                .eq('id', roomData.id);

            if (updateError) throw updateError;
        }
    } catch (error) {
        console.error('Error leaving room:', error);
        throw error;
    }
};

export default {
    createRoom,
    joinRoom,
    getRoomInfo,
    listenToRoomUpdates,
    addContentItem,
    addMultipleContentItems,
    voteForContent,
    listenToMatches,
    leaveRoom,
    updateUserViewingIndex,
    listenToUserUpdates,
    getActiveUsersCount,
    listenToUsersCount
};