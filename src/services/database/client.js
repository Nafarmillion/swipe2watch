import { createClient } from '@supabase/supabase-js';

const supabaseKey = process.env.REACT_APP_SUPABASE_KEY;

// Shared Supabase client instance used by all database modules.
// Sessions are not persisted — users are identified by a UUID stored in localStorage.
export const supabase = createClient(
    process.env.REACT_APP_SUPABASE_URL,
    supabaseKey,
    {
        auth: { persistSession: false },
        global: {
            headers: {
                'apikey': supabaseKey,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
        },
    }
);

// Shared helper: resolves a 6-char room code to its internal Supabase UUID.
// Throws if the room doesn't exist so callers never have to handle a null ID.
export const getRoomId = async (roomCode) => {
    const { data, error } = await supabase
        .from('rooms')
        .select('id')
        .eq('code', roomCode)
        .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error(`Room ${roomCode} not found`);
    return data.id;
};
