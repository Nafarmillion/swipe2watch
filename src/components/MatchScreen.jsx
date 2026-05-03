import React, { useState, useEffect, useRef } from 'react';
import { getAnimeById } from '../services/api/jikan';
import { formatSingleAnime } from '../services/utils/animeDataFormer';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
    getRoomInfo,
    listenToMatches,
    listenToUsersCount
} from '../services/database/superBase';
import { fetchRecommendations } from '../services/api/recommendations';
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

    // Recommendations — fetched once after the first batch of matches arrives
    const [recommendations, setRecommendations] = useState([]);
    const [recsLoading, setRecsLoading] = useState(false);
    // Guard flag so the fetch is triggered at most once per session
    const recsFetchedRef = useRef(false);

    const location = useLocation();

    // ── Fetch initial room data ────────────────────────────────────────────────
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

    // ── Listen for matches ─────────────────────────────────────────────────────
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

        const unsubscribeMatches = listenToMatches(roomCode, handleMatchesUpdate);
        const unsubscribeUsers   = listenToUsersCount(roomCode, (count) => {
            setActiveUsers(count);
        });

        return () => {
            unsubscribeMatches();
            unsubscribeUsers();
        };
    }, [roomCode]);

    // ── Fetch recommendations ──────────────────────────────────────────────────
    // Runs once when we have both matches and room content loaded.
    // Uses a ref guard so re-renders and match updates don't trigger extra API calls.
    useEffect(() => {
        if (recsFetchedRef.current) return;
        if (matches.length === 0 || Object.keys(contentItems).length === 0) return;

        recsFetchedRef.current = true;
        setRecsLoading(true);

        fetchRecommendations(matches, contentItems)
            .then(items => setRecommendations(items))
            .catch(err => {
                console.error('Failed to fetch recommendations:', err);
                recsFetchedRef.current = false; // allow one retry on error
            })
            .finally(() => setRecsLoading(false));
    }, [matches, contentItems]);

    // ── Fetch missing anime details ────────────────────────────────────────────
    useEffect(() => {
        const fetchMissingAnimeDetails = async () => {
            // Only fetch for matches with missing data
            const matchesNeedingDetails = matches.filter(match =>
                !match.image || (match.title && match.title.startsWith('Anime '))
            );

            for (const match of matchesNeedingDetails) {
                try {
                    if (animeDetails[match.animeId]) continue;

                    console.log(`Fetching details for anime ${match.animeId}`);
                    const response    = await getAnimeById(match.animeId);
                    const formattedAnime = formatSingleAnime(response);

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

    // ── Navigation handlers ───────────────────────────────────────────────────
    const handleBackToSwipe = () => navigate(`/swipe/${roomCode}`);
    const handleNewContent  = () =>
        navigate(`/swipe/${roomCode}`, { state: { fromButton: true, previousPath: location.pathname } });
    const handleBackToHome  = () => navigate('/');

    // ── Loading / error states ─────────────────────────────────────────────────
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

    // ── Main render ───────────────────────────────────────────────────────────
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
                    <button className="swipe-button"> не клікай {/*onClick={handleNewContent}*/}
                        {t('matchScreen.continue')}
                    </button>
                </div>

                {matches.length === 0 ? (
                    /* ── Empty state ──────────────────────────────────────── */
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
                    <>
                        {/* ── Matches grid ──────────────────────────────────── */}
                        <div className="matches-grid">
                            {matches.map((match) => {
                                // Priority: freshly-fetched anime detail > room contentItem > match snapshot
                                const animeDetail = animeDetails[match.animeId];
                                const contentItem = contentItems[match.contentId] || {};
                                const contentType = contentItem.type || match.type || 'anime';

                                const title = animeDetail?.title || contentItem.title || match.title || (
                                    contentType === 'movie' ? `Movie ${match.animeId}` :
                                    contentType === 'tv'    ? `TV Series ${match.animeId}` :
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

                        {/* ── Recommendations section ────────────────────────── */}
                        <section className="recommendations-section">
                            <div className="recommendations-heading">
                                <h2>{t('matchScreen.recommendations')}</h2>
                                <p>{t('matchScreen.recsSubtitle')}</p>
                            </div>

                            {recsLoading ? (
                                <div className="recs-loading">
                                    <div className="loading-spinner"></div>
                                    <span>{t('matchScreen.recsLoading')}</span>
                                </div>
                            ) : recommendations.length > 0 ? (
                                <div className="recommendations-grid">
                                    {recommendations.map((item) => (
                                        <div className="rec-card" key={`rec-${item.id}`}>
                                            <div className="rec-image">
                                                <img
                                                    src={item.image || '/default-poster.png'}
                                                    alt={item.title}
                                                    onError={(e) => {
                                                        e.target.onerror = null;
                                                        e.target.src = '/default-poster.png';
                                                    }}
                                                />
                                                <span className="rec-badge">
                                                    {t('matchScreen.recsBadge')}
                                                </span>
                                            </div>
                                            <div className="rec-info">
                                                <h4>{item.title}</h4>
                                                {item.year && (
                                                    <p className="rec-meta">{item.year} · {item.type}</p>
                                                )}
                                                {item.score > 0 && (
                                                    <p className="rec-score">
                                                        ⭐ {Number(item.score).toFixed(1)}
                                                    </p>
                                                )}
                                                {item.genres?.length > 0 && (
                                                    <p className="rec-meta">
                                                        {item.genres.slice(0, 2).map(g => g.name).join(' · ')}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : null}
                        </section>
                    </>
                )}
            </main>
        </div>
    );
}

export default MatchScreen;
