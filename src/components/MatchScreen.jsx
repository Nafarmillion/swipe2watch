import React, { useState, useEffect } from 'react';
import { getAnimeById } from '../services/api/jikan';
import { formatSingleAnime } from '../services/utils/animeDataFormer';
import {useParams, useNavigate, useLocation} from 'react-router-dom';
import {
    getRoomInfo,
    listenToMatches,
    listenToUsersCount
} from '../services/database/superBase';
import './css/MatchScreen.css';
import { useTranslation } from 'react-i18next';

function MatchScreen() {
    const { t } = useTranslation();
    const [animeDetails, setAnimeDetails] = useState({});
    const { roomCode } = useParams();
    const navigate = useNavigate();

    const [matches, setMatches] = useState([]);
    const [contentItems, setContentItems] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [roomName, setRoomName] = useState('');
    const [activeUsers, setActiveUsers] = useState(0);

    const location = useLocation();

    // Fetch initial room data and set up listeners
    useEffect(() => {
        const fetchRoomData = async () => {
            try {
                const roomData = await getRoomInfo(roomCode);
                setRoomName(roomData.name || `${t('matchScreen.room')}: ${roomCode}`);
                setContentItems(roomData.contentItems || {});
            } catch (err) {
                console.error('Error fetching room data:', err);
                setError('Failed to load room data. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        fetchRoomData();
    }, [roomCode]);

    // Listen for matches
    useEffect(() => {
        const handleMatchesUpdate = (matchesData) => {
            if (matchesData) {
                // Convert matches object to sorted array
                const matchesArray = Object.entries(matchesData).map(([contentId, match]) => ({
                    contentId,
                    ...match
                }));

                // Sort by creation time (newest first)
                matchesArray.sort((a, b) => b.createdAt - a.createdAt);

                setMatches(matchesArray);
            } else {
                setMatches([]);
            }
        };

        // Set up listener for matches
        const unsubscribeMatches = listenToMatches(roomCode, handleMatchesUpdate);

        // Set up listener for active users count
        const unsubscribeUsers = listenToUsersCount(roomCode, (count) => {
            setActiveUsers(count);
        });

        return () => {
            unsubscribeMatches();
            unsubscribeUsers();
        };
    }, [roomCode]);

    // Fetch missing anime details
    useEffect(() => {
        const fetchMissingAnimeDetails = async () => {
            // Only fetch for matches with missing data
            const matchesNeedingDetails = matches.filter(match =>
                !match.image || (match.title && match.title.startsWith('Anime '))
            );

            // Process each match
            for (const match of matchesNeedingDetails) {
                try {
                    // Check if we already have this anime's details cached
                    if (animeDetails[match.animeId]) continue;

                    console.log(`Fetching details for anime ${match.animeId}`);

                    // Fetch anime details from API
                    const response = await getAnimeById(match.animeId);
                    const formattedAnime = formatSingleAnime(response);

                    console.log('Received anime details:', formattedAnime);

                    // Cache the details
                    setAnimeDetails(prev => ({
                        ...prev,
                        [match.animeId]: formattedAnime
                    }));
                } catch (error) {
                    console.error(`Error fetching details for anime ${match.animeId}:`, error);
                }
            }
        };

        if (matches.length > 0) {
            fetchMissingAnimeDetails();
        }
    }, [matches, animeDetails]);

    const handleBackToSwipe = () => {
        navigate(`/swipe/${roomCode}`);
    };
    const handleNewContent = () => {
        navigate(`/swipe/${roomCode}`, { state: { fromButton: true, previousPath: location.pathname } });
    };

    const handleBackToHome = () => {
        navigate('/');
    };

    if (loading) {
        return (
            <div className="matches-screen">
                <div className="loading-container">
                    <div className="loading-spinner"></div>
                    <p>{t('matchScreen.loading')}</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="matches-screen">
                <div className="error-container">
                    <h2>{t('matchScreen.error')}</h2>
                    <p>{error}</p>
                    <button onClick={handleBackToHome}>{t('matchScreen.back')}</button>
                </div>
            </div>
        );
    }

    return (
        <div className="matches-screen">
            <header className="room-header">
                <h2>{roomName}</h2>
                <div className="participants-count">
                    {activeUsers} {activeUsers === 1 ? t('matchScreen.participant') : t('matchScreen.participants')} {t('matchScreen.online')}
                </div>
                <button className="leave-button" onClick={handleBackToHome}>
                    {t('matchScreen.leave')}
                </button>
            </header>

            <main className="matches-main">
                <div className="matches-heading">
                    <h1>{t('matchScreen.matches')}</h1>
                    <button className="swipe-button" > не клікай {/*onClick={handleNewContent}*/}
                        {t('matchScreen.continue')}
                    </button>
                </div>

                {matches.length === 0 ? (
                    <div className="no-matches">
                        <div className="no-matches-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path>
                            </svg>
                        </div>
                        <h2>{t('matchScreen.noMatches')}</h2>
                        <p>{t('matchScreen.keep')}</p>
                        <button className="swipe-button-large" onClick={handleBackToSwipe}>
                            {t('matchScreen.start')}
                        </button>
                    </div>
                ) : (
                    <div className="matches-grid">
                        {matches.map((match) => {
                            // First check if we have fetched details for this anime
                            const animeDetail = animeDetails[match.animeId];
                            // Then check if there's content in the contentItems
                            const contentItem = contentItems[match.contentId] || {};

                            const contentType = contentItem.type || match.type || 'anime';

                            // Choose the best available data, prioritizing fetched details
                            const title = animeDetail?.title || contentItem.title || match.title || (
                                contentType === 'movie' ? `Movie ${match.animeId}` :
                                    contentType === 'tv' ? `TV Series ${match.animeId}` :
                                        `Anime ${match.animeId}`
                            );
                            const imageUrl = animeDetail?.image || contentItem.image || match.image || '/default-poster.png';

                            return (
                                <div className="match-card" key={match.contentId || match.animeId}>
                                    <div className="match-image">
                                        <img
                                            src={imageUrl}
                                            alt={title}
                                            onError={(e) => {
                                                e.target.onerror = null;
                                                e.target.src = '/default-poster.png';
                                            }}
                                        />
                                    </div>
                                    <div className="match-info">
                                        <h3>{title}</h3>
                                        {(animeDetail?.year || contentItem.year) &&
                                            <p className="match-year">Year: {animeDetail?.year || contentItem.year}</p>
                                        }
                                        {(animeDetail?.type || contentItem.type || match.type) &&
                                            <p className="match-type">Type: {animeDetail?.type || contentItem.type || match.type}</p>
                                        }
                                        {(animeDetail?.score || contentItem.score || match.score) &&
                                            <p className="match-score">Score: {animeDetail?.score || contentItem.score || match.score}/10</p>
                                        }
                                        {match.users && (
                                            <p className="match-users">
                                                Liked by {match.users.length} {match.users.length === 1 ? 'person' : 'people'}
                                            </p>
                                        )}
                                        <p className="match-date">
                                            Matched on {new Date(match.createdAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
}

export default MatchScreen;