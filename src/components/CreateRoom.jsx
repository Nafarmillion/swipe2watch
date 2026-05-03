import React, {useState, useMemo} from 'react';
import {useNavigate} from 'react-router-dom';
import { createRoom } from '../services/database/superBase';
import './css/CreateRoom.css';
import { useTranslation } from 'react-i18next';

// Defines which genre keys are available for each content category.
// TV series has fewer genres because TMDB's TV taxonomy is more limited
// (e.g. horror has no dedicated TV genre ID on TMDB).
const GENRE_KEYS_BY_CATEGORY = {
    movies: ['comedy', 'drama', 'action', 'crime', 'horror', 'romance', 'fantasy', 'mystery', 'thriller', 'sci_fi'],
    series: ['comedy', 'drama', 'action', 'crime', 'fantasy', 'mystery', 'sci_fi'],
    anime:  ['comedy', 'drama', 'action', 'crime', 'horror', 'romance', 'fantasy', 'mystery', 'thriller', 'sci_fi'],
};

function CreateRoom() {
    const navigate = useNavigate();
    const { t } = useTranslation();

    const [formData, setFormData] = useState({
        roomName: '',
        maxParticipants: 5
    });

    const [categories, setCategories] = useState({
        movies: false,
        series: false,
        anime: false
    });

    const [genres, setGenres] = useState([]);

    // Compute the intersection of genre keys across all selected categories.
    // Only genres supported by EVERY selected category are shown,
    // so the user can never pick a genre that would silently filter out one category.
    // Falls back to the full movies list when no category is selected yet.
    const availableGenreKeys = useMemo(() => {
        const selected = Object.entries(categories).filter(([, v]) => v).map(([k]) => k);
        if (selected.length === 0) return Object.keys(GENRE_KEYS_BY_CATEGORY.movies);
        return selected.reduce((acc, cat) => {
            const catSet = new Set(GENRE_KEYS_BY_CATEGORY[cat]);
            return acc.filter(k => catSet.has(k));
        }, GENRE_KEYS_BY_CATEGORY[selected[0]]);
    }, [categories]);

    const [roomCreated, setRoomCreated] = useState(false);

    const [roomCode, setRoomCode] = useState('');

    const handleInputChange = (e) => {
        const {name, value, type} = e.target;

        const processedValue = type === 'number' ? parseInt(value, 10) || 0 : value;

        setFormData(prev => ({
            ...prev,
            [name]: processedValue
        }));
    };

    const handleCategoryToggle = (category) => {
        setCategories(prev => {
            const next = { ...prev, [category]: !prev[category] };
            // After toggling, recompute available genres for the new selection
            // and remove any selected genres that are no longer valid
            const selected = Object.entries(next).filter(([, v]) => v).map(([k]) => k);
            if (selected.length > 0) {
                const available = selected.reduce((acc, cat) => {
                    const catSet = new Set(GENRE_KEYS_BY_CATEGORY[cat]);
                    return acc.filter(k => catSet.has(k));
                }, GENRE_KEYS_BY_CATEGORY[selected[0]]);
                setGenres(g => g.filter(k => available.includes(k)));
            }
            return next;
        });
    };

    const handleGenreToggle = (genre) => {
        setGenres(prev => {
            if (prev.includes(genre)) {
                return prev.filter(g => g !== genre);
            } else {
                return [...prev, genre];
            }
        });
    };

    const handleCreateRoom = async () => {
        const isCategorySelected = Object.values(categories).some(val => val);

        if (!isCategorySelected) {
            alert('Please select at least one content category');
            return;
        }

        const roomData = {
            name: formData.roomName,
            maxParticipants: formData.maxParticipants,
            categories: categories,
            genres: genres
        };

        const roomCode = await createRoom(roomData);

        setRoomCode(roomCode);
        setRoomCreated(true);
    };

    const goToSwipeScreen = () => {
        navigate(`/waiting/${roomCode}`);
    };

    const copyRoomCode = () => {
        navigator.clipboard.writeText(roomCode)
            .then(() => {
                alert('The code is copied to the clipboard');
            })
            .catch(err => {
                console.error('Error', err);
            });
    };

    return (
        <div className="create-room-container">
            <h1>{t('createRoom.creating')}</h1>

            {!roomCreated ? (
                <form className="create-room-form">
                    <div className="form-group">
                        <h2>{t('createRoom.settings')}</h2>
                        <p>{t('createRoom.name')}</p>

                        <input
                            type="text"
                            name="roomName"
                            value={formData.roomName}
                            onChange={handleInputChange}
                            className="input-field"
                            placeholder={t('createRoom.roomName')}
                        />

                        <input
                            type="number"
                            name="maxParticipants"
                            value={formData.maxParticipants}
                            onChange={handleInputChange}
                            className="input-field"
                            min="2"
                            max="10"
                            placeholder={t('createRoom.maxNumber')}
                        />
                    </div>

                    <div className="form-group">
                        <h2>{t('createRoom.contentCategories')}</h2>
                        <p>{t('createRoom.selectCategories')}</p>

                        <div className="categories-container">
                            <div
                                className={`category-item ${categories.movies ? 'active' : ''}`}
                                onClick={() => handleCategoryToggle('movies')}
                            >
                                {t('createRoom.movies')}
                            </div>

                            <div
                                className={`category-item ${categories.series ? 'active' : ''}`}
                                onClick={() => handleCategoryToggle('series')}
                            >
                                {t('createRoom.series')}
                            </div>

                            <div
                                className={`category-item ${categories.anime ? 'active' : ''}`}
                                onClick={() => handleCategoryToggle('anime')}
                            >
                                {t('createRoom.anime')}
                            </div>
                        </div>
                    </div>

                    <div className="form-group">
                        <h2>{t('createRoom.genresTitle')}</h2>
                        <p>{t('createRoom.genresTitle')}</p>

                        <div className="genres-container">
                            {t('createRoom.genres', { returnObjects: true })
                                .filter(genre => availableGenreKeys.includes(genre.key))
                                .map(genre => (
                                <div
                                    key={genre.key}
                                    className={`genre-tag ${genres.includes(genre.key) ? 'active' : ''}`}
                                    onClick={() => handleGenreToggle(genre.key)}
                                >
                                    {genre.name}
                                </div>
                            ))}
                        </div>
                    </div>

                    <button
                        type="button"
                        className="create-button"
                        onClick={handleCreateRoom}
                    >
                        {t('createRoom.create')}
                    </button>
                </form>
            ) : (
                <div className="room-created">
                    <h2>{t('createRoom.created')}</h2>

                    <div className="room-code">
                        <p>{t('createRoom.roomCode')}</p>
                        <div className="code-display">{roomCode}</div>
                        <button type="button" onClick={copyRoomCode}>{t('createRoom.copy')}</button>
                    </div>

                    <p>{t('createRoom.share')}</p>

                    <button type="button" className="start-button" onClick={goToSwipeScreen}>
                        {t('createRoom.startSelecting')}
                    </button>
                </div>
            )}
        </div>
    );
}

export default CreateRoom;