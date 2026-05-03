import { supabase, getRoomId } from './client';
import { transformMatch } from './transforms';

// Module-level Set that tracks which match IDs have already been shown to the user.
// Shared with rooms.js (via import) so that getRoomInfo can set the `isNew` flag correctly.
export const processedMatches = new Set();

// Fetches all matches for the room, resolves their content items, and transforms them.
// `onlyNew` = true returns early with empty object if nothing new was found —
// used to suppress callbacks when a DB event fires but isn't actually a new match.
const fetchAndTransformMatches = async (roomId, onlyNew = false) => {
    const { data: matches, error } = await supabase
        .from('matches')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false });

    if (error) throw error;

    if (!matches || matches.length === 0) return { matches: {}, hasNewMatches: false };

    // Check each match against the seen-set and register any new ones
    let hasNewMatches = false;
    matches.forEach(match => {
        if (!processedMatches.has(match.id)) {
            hasNewMatches = true;
            processedMatches.add(match.id);
        }
    });

    if (onlyNew && !hasNewMatches) return { matches: {}, hasNewMatches: false };

    // Fetch the content_items rows for all matched IDs in one query
    const matchContentIds = matches.map(m => m.content_item_id);
    const { data: contentItems, error: contentError } = await supabase
        .from('content_items')
        .select('*')
        .in('id', matchContentIds);

    if (contentError) throw contentError;

    // Build a lookup map for O(1) access inside the forEach below
    const contentMap = {};
    contentItems.forEach(item => { contentMap[item.id] = item; });

    // Transform each match into the shape the UI expects
    const matchesObject = {};
    matches.forEach(match => {
        const contentItem = contentMap[match.content_item_id];
        if (contentItem) {
            matchesObject[match.content_item_id] = transformMatch(match, contentItem, processedMatches);
        }
    });

    return { matches: matchesObject, hasNewMatches };
};

// Subscribes to new match inserts for the room.
// Calls `callback(matches, isNew)` immediately with the initial state,
// then again whenever a new match row is inserted.
// Returns an unsubscribe function — call it on component unmount.
export const listenToMatches = (roomCode, callback) => {
    const start = async () => {
        try {
            const roomId = await getRoomId(roomCode);

            const subscription = supabase
                .channel(`matches:${roomId}`)
                // Listen only for INSERT (updates/deletes to matches don't happen in this app)
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'matches', filter: `room_id=eq.${roomId}` },
                    async (payload) => {
                        // Pre-register the new ID so fetchAndTransformMatches sees it as new
                        if (payload.new?.id) processedMatches.add(payload.new.id);
                        const { matches, hasNewMatches } = await fetchAndTransformMatches(roomId, false);
                        if (hasNewMatches || Object.keys(matches).length > 0) {
                            callback(matches, true); // second arg signals a new match occurred
                        }
                    }
                )
                .subscribe();

            // Deliver initial state immediately (second arg = false → not a "new" match)
            const { matches } = await fetchAndTransformMatches(roomId, false);
            callback(matches, false);

            return () => subscription.unsubscribe();
        } catch (error) {
            console.error('Error in listenToMatches:', error);
            callback({}, false);
            return () => {};
        }
    };

    const unsub = start();
    return () => { unsub.then(fn => fn()); };
};
