import { supabase, getRoomId } from './client';
import { transformUser } from './transforms';

// Returns the number of currently active (connected) users in the room.
// Returns 0 on error so callers don't need to handle exceptions for this non-critical stat.
export const getActiveUsersCount = async (roomCode) => {
    try {
        const roomId = await getRoomId(roomCode);
        const { data, error } = await supabase
            .from('room_users')
            .select('user_id')
            .eq('room_id', roomId)
            .eq('active', true);
        if (error) throw error;
        return data.length;
    } catch {
        return 0;
    }
};

// Subscribes to changes in the active-user count for the room.
// Calls `callback(count)` immediately with the current count,
// then again whenever any room_users row changes.
// Returns an unsubscribe function — call it on component unmount.
export const listenToUsersCount = (roomCode, callback) => {
    const start = async () => {
        try {
            const roomId = await getRoomId(roomCode);

            // Re-fetch and push the count on every room_users change
            const fetchCount = async () => {
                const { data, error } = await supabase
                    .from('room_users')
                    .select('user_id')
                    .eq('room_id', roomId)
                    .eq('active', true);
                if (!error) callback(data.length);
            };

            const subscription = supabase
                .channel(`room_users_count:${roomId}`)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'room_users', filter: `room_id=eq.${roomId}` }, fetchCount)
                .subscribe();

            await fetchCount(); // deliver initial count before any events arrive

            return () => subscription.unsubscribe();
        } catch (error) {
            console.error('Error in listenToUsersCount:', error);
            callback(0);
            return () => {};
        }
    };

    const unsub = start();
    return () => { unsub.then(fn => fn()); };
};

// Updates which card index the user is currently viewing.
// Called after each swipe so other participants can see progress in real time.
export const updateUserViewingIndex = async (roomCode, userId, index) => {
    const roomId = await getRoomId(roomCode);
    const { error } = await supabase
        .from('room_users')
        .update({ viewing_index: index })
        .eq('room_id', roomId)
        .eq('user_id', userId);
    if (error) throw error;
};

// Subscribes to changes in a single user's state (active flag, viewing index, votes).
// Listens to both room_users and votes tables so any swipe or status change
// triggers a fresh fetch and calls `callback(userData)`.
// Returns an unsubscribe function — call it on component unmount.
export const listenToUserUpdates = (roomCode, userId, callback) => {
    const start = async () => {
        try {
            const roomId = await getRoomId(roomCode);

            // Fetch user row and their votes in parallel
            const fetchUser = async () => {
                const [userRes, votesRes] = await Promise.all([
                    supabase.from('room_users').select('*').eq('room_id', roomId).eq('user_id', userId).maybeSingle(),
                    supabase.from('votes').select('*').eq('room_id', roomId).eq('user_id', userId),
                ]);
                if (userRes.error) throw userRes.error;
                if (votesRes.error) throw votesRes.error;
                return transformUser(userRes.data, votesRes.data);
            };

            const onUpdate = async () => {
                try { callback(await fetchUser()); } catch (err) { console.error('Error fetching user data:', err); }
            };

            // Subscribe to both tables — a vote change doesn't update room_users and vice versa
            const subscriptions = [
                supabase.channel(`user:${roomId}:${userId}`)
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'room_users', filter: `room_id=eq.${roomId} AND user_id=eq.${userId}` }, onUpdate)
                    .subscribe(),
                supabase.channel(`user_votes:${roomId}:${userId}`)
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'votes', filter: `room_id=eq.${roomId} AND user_id=eq.${userId}` }, onUpdate)
                    .subscribe(),
            ];

            // Deliver initial state before any real-time events arrive
            try { callback(await fetchUser()); } catch (err) { console.error('Error fetching initial user data:', err); }

            return () => subscriptions.forEach(s => s.unsubscribe());
        } catch (error) {
            console.error('Error in listenToUserUpdates:', error);
            return () => {};
        }
    };

    const unsub = start();
    return () => { unsub.then(fn => fn()); };
};
