// Pure functions that convert raw Supabase rows into the shape the UI expects.
// No side effects, no DB calls — easy to unit-test in isolation.

// Converts a room_users row into a user object.
// Aggregates votes from the shared votes array so we avoid an extra DB query.
export const transformUser = (user, votes = []) => {
    // Build a map of { content_item_id → liked } for this specific user
    const votesObject = {};
    votes.forEach(vote => {
        if (vote.user_id === user.user_id) {
            votesObject[vote.content_item_id] = vote.liked;
        }
    });
    return {
        displayName: user.display_name,
        joinedAt: new Date(user.joined_at).getTime(), // ms timestamp for easy comparison
        active: user.active,
        viewingIndex: user.viewing_index || 0, // which card index the user is on
        votes: votesObject,
    };
};

// Converts a content_items row into the unified content object used across the app.
// The `id` field is set to external_id (TMDB/MAL ID) because that is what
// votes and UI references use — the Supabase internal ID stays internal.
export const transformContentItem = (item) => ({
    id: item.external_id,
    title: item.title,
    image: item.image_url,
    synopsis: item.description,
    year: item.year,
    score: item.score,
    genres: item.genres,
    type: item.content_type,
    addedAt: new Date(item.added_at).getTime(),
});

// Converts a matches row + its related content_items row into a match object.
// `processedMatchIds` is the module-level Set in matches.js that tracks which
// matches have already been shown to the user — used to set the `isNew` flag.
export const transformMatch = (match, contentItem, processedMatchIds) => ({
    id: match.id,
    animeId: contentItem.external_id, // legacy field name kept for backwards compat
    title: contentItem.title,
    image: contentItem.image_url,
    synopsis: contentItem.description,
    score: contentItem.score,
    users: match.users || [],
    createdAt: new Date(match.created_at).getTime(),
    isNew: !processedMatchIds.has(match.id), // true the first time this match is seen
});
