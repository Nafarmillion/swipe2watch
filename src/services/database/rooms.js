import { supabase, getRoomId } from './client';
import { processedMatches } from './matches';
import { transformUser, transformContentItem, transformMatch } from './transforms';

// Generates a random 6-character alphanumeric code shown to users for sharing
const generateRoomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
};

// Fetches the full room state in one round-trip using 5 parallel queries.
// Returns a Firebase-like object that merges room metadata with users,
// content items, matches, and votes so the UI can work from a single snapshot.
const fetchRoomSnapshot = async (roomId) => {
    const [roomRes, usersRes, contentRes, matchesRes, votesRes] = await Promise.all([
        supabase.from('rooms').select('*').eq('id', roomId).maybeSingle(),
        supabase.from('room_users').select('*').eq('room_id', roomId),
        supabase.from('content_items').select('*').eq('room_id', roomId),
        supabase.from('matches').select('*, content_items(*)').eq('room_id', roomId),
        supabase.from('votes').select('*').eq('room_id', roomId),
    ]);

    const room = roomRes.data;
    const users = usersRes.data ?? [];
    const contentItems = contentRes.data ?? [];
    const matches = matchesRes.data ?? [];
    const votes = votesRes.data ?? [];

    const usersObject = {};
    users.forEach(user => {
        usersObject[user.user_id] = transformUser(user, votes);
    });

    const contentItemsObject = {};
    contentItems.forEach(item => {
        contentItemsObject[item.id] = transformContentItem(item);
    });

    const matchesObject = {};
    matches.forEach(match => {
        matchesObject[match.content_item_id] = {
            id: match.id,
            animeId: match.content_item_id,
            users: match.users,
            createdAt: new Date(match.created_at).getTime(),
        };
    });

    return { ...room, users: usersObject, contentItems: contentItemsObject, matches: matchesObject };
};

export const createRoom = async (roomData) => {
    const { data, error } = await supabase
        .from('rooms')
        .insert({
            code: generateRoomCode(),
            host_name: roomData.hostName || roomData.name || 'Host',
            name: roomData.name || '',
            max_participants: roomData.maxParticipants || 5,
            categories: roomData.categories ?? [],
            genres: roomData.genres ?? [],
            created_at: new Date().toISOString(),
            status: 'active',
        })
        .select()
        .maybeSingle();

    if (error) throw error;
    return data.code;
};

export const joinRoom = async (roomCode, userId, displayName) => {
    const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', roomCode)
        .maybeSingle();

    if (roomError) throw new Error(`Room with code ${roomCode} doesn't exist`);

    // Preserve the original joined_at timestamp if the user is rejoining
    // (e.g. after a page refresh) — only set it to now for brand-new joins
    const { data: existingUser } = await supabase
        .from('room_users')
        .select('joined_at')
        .eq('room_id', roomData.id)
        .eq('user_id', userId)
        .maybeSingle();

    // Upsert handles both first-time joins and reconnects in one query
    const { error: userError } = await supabase
        .from('room_users')
        .upsert({
            room_id: roomData.id,
            user_id: userId,
            display_name: displayName,
            joined_at: existingUser ? existingUser.joined_at : new Date().toISOString(),
            active: true, // mark user as connected
        }, { onConflict: 'room_id,user_id' });

    if (userError) throw userError;

    return roomData;
};

export const getRoomInfo = async (roomCode) => {
    const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', roomCode)
        .maybeSingle();

    if (roomError) throw new Error(`Room with code ${roomCode} doesn't exist`);

    const [usersRes, contentRes, matchesRes, votesRes] = await Promise.all([
        supabase.from('room_users').select('*').eq('room_id', room.id),
        supabase.from('content_items').select('*').eq('room_id', room.id),
        supabase.from('matches').select('*').eq('room_id', room.id),
        supabase.from('votes').select('*').eq('room_id', room.id),
    ]);

    if (usersRes.error) throw usersRes.error;
    if (contentRes.error) throw contentRes.error;
    if (matchesRes.error) throw matchesRes.error;
    if (votesRes.error) throw votesRes.error;

    const users = usersRes.data ?? [];
    const contentItems = contentRes.data ?? [];
    const matches = matchesRes.data ?? [];
    const votes = votesRes.data ?? [];

    const usersObject = {};
    users.forEach(user => { usersObject[user.user_id] = transformUser(user, votes); });

    const contentItemsObject = {};
    const contentMap = {};
    contentItems.forEach(item => {
        contentMap[item.id] = item; // needed by match transform below
        // Skip placeholder rows created when a user voted before content was fully written
        if (item.title && item.title !== 'Unknown Title' && item.synopsis && item.synopsis !== 'No description available.') {
            contentItemsObject[item.id] = transformContentItem(item);
        }
    });

    const matchesObject = {};
    matches.forEach(match => {
        const contentItem = contentMap[match.content_item_id];
        if (contentItem) {
            matchesObject[match.content_item_id] = transformMatch(match, contentItem, processedMatches);
        }
    });

    return { ...room, users: usersObject, contentItems: contentItemsObject, matches: matchesObject };
};

// Marks the user as inactive (soft delete) and closes the room if no one is left
export const leaveRoom = async (roomCode, userId) => {
    const roomId = await getRoomId(roomCode);

    // Soft-delete: set active = false rather than deleting the row,
    // so vote history and the user's display name are preserved in match records
    const { error } = await supabase
        .from('room_users')
        .update({ active: false })
        .eq('room_id', roomId)
        .eq('user_id', userId);

    if (error) throw error;

    // If this was the last active user, close the room
    const { data: remaining, error: countError } = await supabase
        .from('room_users')
        .select('user_id')
        .eq('room_id', roomId)
        .eq('active', true);

    if (countError) throw countError;

    if (remaining.length === 0) {
        const { error: updateError } = await supabase
            .from('rooms')
            .update({ status: 'inactive' })
            .eq('id', roomId);
        if (updateError) throw updateError;
    }
};

// Subscribes to all real-time changes in a room and delivers a fresh snapshot
// on every change. One channel per table so Supabase can filter server-side.
// Calls `callback(snapshot)` immediately with the current state, then on each update.
// Returns an unsubscribe function — call it on component unmount to avoid memory leaks.
export const listenToRoomUpdates = (roomCode, callback) => {
    const start = async () => {
        try {
            const roomId = await getRoomId(roomCode);

            // Any change in any of the five tables re-fetches the full snapshot.
            // This is simpler than granular merging and correct for this app's scale.
            const onUpdate = async () => {
                const data = await fetchRoomSnapshot(roomId);
                callback(data);
            };

            const tables = ['rooms', 'room_users', 'content_items', 'matches', 'votes'];
            const filters = {
                rooms: `id=eq.${roomId}`,
                room_users: `room_id=eq.${roomId}`,
                content_items: `room_id=eq.${roomId}`,
                matches: `room_id=eq.${roomId}`,
                votes: `room_id=eq.${roomId}`,
            };

            // Create one Supabase channel per table (required by the Supabase Realtime API)
            const subscriptions = tables.map(table =>
                supabase
                    .channel(`${table}:${roomId}`)
                    .on('postgres_changes', { event: '*', schema: 'public', table, filter: filters[table] }, onUpdate)
                    .subscribe()
            );

            // Deliver initial state before any real-time events arrive
            const data = await fetchRoomSnapshot(roomId);
            callback(data);

            return () => subscriptions.forEach(s => s.unsubscribe());
        } catch (error) {
            console.error('Error in listenToRoomUpdates:', error);
            throw error;
        }
    };

    const unsub = start();
    return () => { unsub.then(fn => fn()); };
};
