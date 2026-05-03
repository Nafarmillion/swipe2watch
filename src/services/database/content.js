import { supabase, getRoomId } from './client';

// Inserts a single content item into the room.
// Returns the existing Supabase row ID if the item was already added
// (identified by external_id) to avoid duplicate entries.
export const addContentItem = async (roomCode, contentItem) => {
    const roomId = await getRoomId(roomCode);

    // Check for an existing record before inserting
    const { data: existing, error: checkError } = await supabase
        .from('content_items')
        .select('id')
        .eq('room_id', roomId)
        .eq('external_id', contentItem.id.toString());

    if (checkError) throw checkError;
    if (existing?.length > 0) return existing[0].id; // already in DB — return its ID

    const { data, error } = await supabase
        .from('content_items')
        .insert({
            room_id: roomId,
            content_type: contentItem.type,
            external_id: contentItem.id.toString(),
            title: contentItem.title || 'Unknown Title',
            image_url: contentItem.image,
            description: contentItem.synopsis,
            year: contentItem.year,
            score: contentItem.score,
            genres: contentItem.genres || [],
            episodes: contentItem.episodes,
            status: contentItem.status,
            rating: contentItem.rating,
            added_at: new Date().toISOString(),
        })
        .select()
        .maybeSingle();

    if (error) throw error;
    return data.id;
};

// Inserts multiple content items in a single batch, skipping duplicates.
// Returns an array of Supabase row IDs in the same order as the input array.
export const addMultipleContentItems = async (roomCode, contentItems) => {
    const roomId = await getRoomId(roomCode);

    // Fetch all already-existing external IDs for this room in one query
    const { data: existingItems, error: existingError } = await supabase
        .from('content_items')
        .select('external_id, id')
        .eq('room_id', roomId);

    if (existingError) throw existingError;

    // Build a map for O(1) duplicate lookup: external_id → supabase row id
    const existingMap = {};
    existingItems.forEach(item => { existingMap[item.external_id] = item.id; });

    // Only process items that are not already in the DB
    const newItems = contentItems.filter(item => item?.id && !existingMap[item.id.toString()]);

    // All items already exist — return their IDs without any DB writes
    if (newItems.length === 0) {
        return contentItems.map(item => item?.id ? existingMap[item.id.toString()] : null).filter(Boolean);
    }

    // Map app-side item shape → DB column names
    const itemsToInsert = newItems
        .filter(item => item?.id)
        .map(item => ({
            room_id: roomId,
            content_type: item.type || 'unknown',
            external_id: String(item.id),
            title: item.title || 'Unknown Title',
            image_url: item.image || null,
            description: item.synopsis || 'No description available.',
            year: item.year || null,
            score: item.score || null,
            genres: Array.isArray(item.genres) ? item.genres : [],
            episodes: item.episodes || null,
            status: item.status || null,
            rating: item.rating || null,
            added_at: new Date().toISOString(),
        }));

    if (itemsToInsert.length === 0) return [];

    const { data: insertedItems, error: insertError } = await supabase
        .from('content_items')
        .insert(itemsToInsert)
        .select('id, external_id');

    if (insertError) throw insertError;

    // Map newly inserted rows for the final ID lookup
    const insertedMap = {};
    insertedItems?.forEach(item => { insertedMap[item.external_id] = item.id; });

    // Return IDs in the original input order, merging existing and new inserts
    return contentItems
        .map(item => {
            if (!item?.id) return null;
            const ext = item.id.toString();
            return existingMap[ext] || insertedMap[ext] || null;
        })
        .filter(Boolean);
};
