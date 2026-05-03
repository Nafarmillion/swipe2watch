import { supabase } from './client';

// Records a swipe vote and creates a match row if all active users liked the item.
// `animeId` is the external ID from TMDB or MAL (the field name is a legacy artefact).
export const voteForContent = async (roomCode, userId, animeId, liked) => {
    // Fetch full room row — we need room.id for all subsequent queries
    const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', roomCode)
        .maybeSingle();

    if (roomError) throw roomError;

    // Look up the content_items row by its external ID
    const { data: contentItems, error: contentError } = await supabase
        .from('content_items')
        .select('id, external_id')
        .eq('room_id', roomData.id)
        .eq('external_id', animeId.toString());

    if (contentError) throw contentError;

    let contentItemId;

    if (contentItems.length === 0) {
        // Edge case: user voted before ContentFetcher finished writing the item.
        // Create a minimal placeholder so the vote is not lost.
        const { data: newItem, error: createError } = await supabase
            .from('content_items')
            .insert({
                room_id: roomData.id,
                external_id: animeId.toString(),
                title: `Anime ${animeId}`,
                content_type: 'anime',
                added_at: new Date().toISOString(),
            })
            .select('id')
            .maybeSingle();

        if (createError) throw createError;
        contentItemId = newItem.id;
    } else {
        contentItemId = contentItems[0].id;
    }

    // Upsert the vote — using upsert so re-voting (e.g. after reconnect) is idempotent
    const { error: voteError } = await supabase
        .from('votes')
        .upsert({
            room_id: roomData.id,
            user_id: userId,
            content_item_id: contentItemId,
            liked,
            voted_at: new Date().toISOString(),
        });

    if (voteError) throw voteError;

    // Dislikes never trigger a match — short-circuit here
    if (!liked) return;

    // ─── Match detection ──────────────────────────────────────────────────────
    // A match occurs when every active room participant has liked the same item.
    // Fetch active users and likes in parallel to minimise latency.
    const [activeUsersRes, likesRes] = await Promise.all([
        supabase.from('room_users').select('user_id').eq('room_id', roomData.id).eq('active', true),
        supabase.from('votes').select('user_id').eq('room_id', roomData.id).eq('content_item_id', contentItemId).eq('liked', true),
    ]);

    if (activeUsersRes.error) throw activeUsersRes.error;
    if (likesRes.error) throw likesRes.error;

    const activeUserIds = activeUsersRes.data.map(u => u.user_id);
    const usersThatLiked = likesRes.data.map(v => v.user_id);

    // All active users must have liked the item (exact set equality)
    const isMatch =
        activeUserIds.length > 0 &&
        activeUserIds.length === usersThatLiked.length &&
        activeUserIds.every(id => usersThatLiked.includes(id));

    if (!isMatch) return;

    // Guard against duplicate match rows (two users voting simultaneously)
    const { data: existingMatch, error: matchCheckError } = await supabase
        .from('matches')
        .select('id')
        .eq('room_id', roomData.id)
        .eq('content_item_id', contentItemId);

    if (matchCheckError) throw matchCheckError;
    if (existingMatch?.length > 0) return; // match already recorded

    // Insert the match row — this triggers the real-time listener in matches.js
    const { error: matchError } = await supabase
        .from('matches')
        .insert({
            room_id: roomData.id,
            content_item_id: contentItemId,
            users: usersThatLiked,
            created_at: new Date().toISOString(),
        });

    if (matchError) throw matchError;
};
