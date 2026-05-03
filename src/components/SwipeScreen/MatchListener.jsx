// swipe/MatchListener.jsx
import React, { useEffect } from 'react';
import { listenToMatches } from '../../services/database/superBase';

const MatchListener = ({
    roomCode,
    setMatches,
    setCurrentMatch,
    processedMatchIds,
    setProcessedMatchIds
}) => {
    // Listen for matches
    useEffect(() => {
        if (roomCode) {
            const handleMatchUpdate = (matchesData, isNewMatch) => {
                console.log('Received matches:', matchesData, 'Is new match:', isNewMatch);
                setMatches(matchesData);

                if (Object.keys(matchesData).length > 0) {
                    // Find most recent match
                    let newestMatch = null;
                    let newestTimestamp = 0;
                    let newestContentId = null;

                    for (const contentId in matchesData) {
                        const match = matchesData[contentId];
                        if (match.createdAt > newestTimestamp) {
                            newestTimestamp = match.createdAt;
                            newestMatch = match;
                            newestContentId = contentId;
                        }
                    }

                    // Check if it's a new match we haven't shown yet
                    if (newestMatch && newestMatch.id && !processedMatchIds.has(newestMatch.id)) {
                        console.log('New match found:', newestMatch);

                        // Update processed matches
                        setProcessedMatchIds(prev => {
                            const updated = new Set(prev);
                            updated.add(newestMatch.id);
                            return updated;
                        });

                        // Prepare match data for dialog
                        setCurrentMatch({
                            animeId: newestContentId,
                            ...newestMatch
                        });
                    }
                }
            };

            // Set up listener
            const unsubscribe = listenToMatches(roomCode, handleMatchUpdate);
            return unsubscribe;
        }
    }, [roomCode, processedMatchIds, setMatches, setCurrentMatch, setProcessedMatchIds]);

    // This component doesn't render anything
    return null;
};

export default MatchListener;