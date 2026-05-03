import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { listenToUsersCount, getRoomInfo, joinRoom, listenToRoomUpdates } from '../services/database/superBase';
import './css/WaitingPage.css';
import { v4 as uuidv4 } from "uuid";
import useLocalStorage from '../services/hooks/use-localstorage';
import { useTranslation } from 'react-i18next';

function WaitingPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { roomCode } = useParams();

    // State variables
    const [activeUsers, setActiveUsers] = useState(0);
    const [roomName, setRoomName] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [userName, setUserName] = useState(() => localStorage.getItem('userName') || '');
    const [showNameInput, setShowNameInput] = useState(false);
    const [isJoining, setIsJoining] = useState(false);
    const [roomData, setRoomData] = useState(null);

    // Generate or retrieve userId
    const [userId] = useState(() => {
        const storedId = localStorage.getItem('userId');
        if (storedId) return storedId;

        const newId = uuidv4();
        localStorage.setItem('userId', newId);
        return newId;
    });

    // Handle name submission
    const handleNameSubmit = (e) => {
        e.preventDefault();
        if (userName.trim()) {
            localStorage.setItem('userName', userName);
            setShowNameInput(false);
        }
    };

    // Navigation handlers
    const handleStartSwiping = () => {
        navigate(`/swipe/${roomCode}`);
    };

    const handleBackToHome = () => {
        navigate('/');
    };

    // Copy room code to clipboard
    const copyRoomCode = () => {
        navigator.clipboard.writeText(roomCode)
            .then(() => alert('Room code copied to clipboard!'))
            .catch(err => console.error('Could not copy text: ', err));
    };

    // Main effect for initializing room and setting up listeners
    useEffect(() => {
        console.log("WaitingPage useEffect running with:", { roomCode, userId, userName });

        // Skip if we're waiting for name input
        if (!userName) {
            setShowNameInput(true);
            setLoading(false);
            return;
        }

        let unsubscribeRoom = null;
        let unsubscribeUsers = null;

        // Main async function to set everything up
        const setupRoom = async () => {
            setLoading(true);
            setIsJoining(true);

            try {
                // Step 1: Join the room
                console.log("Joining room:", roomCode, "as user:", userId, "with name:", userName);
                await joinRoom(roomCode, userId, userName);

                // Step 2: Get room info
                console.log("Getting room info for:", roomCode);
                const roomInfo = await getRoomInfo(roomCode);
                setRoomName(roomInfo.name || `Room: ${roomCode}`);
                setRoomData(roomInfo);

                // Step 3: Set up room updates listener
                console.log("Setting up room updates listener");
                unsubscribeRoom = listenToRoomUpdates(roomCode, (updatedData) => {
                    console.log("Room update received:", updatedData);
                    setRoomData(updatedData);
                });

                // Step 4: Set up users count listener
                console.log("Setting up users count listener");
                unsubscribeUsers = listenToUsersCount(roomCode, (count) => {
                    console.log("Active users count update:", count);
                    setActiveUsers(count);
                });

            } catch (err) {
                console.error("Error setting up room:", err);
                setError(`Failed to join room: ${err.message || 'Unknown error'}`);
            } finally {
                setLoading(false);
                setIsJoining(false);
            }
        };

        // Run the setup
        setupRoom();

        // Cleanup function
        return () => {
            console.log("Cleaning up WaitingPage listeners");
            if (unsubscribeRoom) unsubscribeRoom();
            if (unsubscribeUsers) unsubscribeUsers();
        };
    }, [roomCode, userId, userName]);

    if (showNameInput) {
        return (
            <div className="swipe-screen">
                <div className="name-input-form">
                    <h2>{t('waitingPage.enterName')}</h2>
                    <form onSubmit={handleNameSubmit}>
                        <input
                            type="text"
                            value={userName}
                            onChange={(e) => setUserName(e.target.value)}
                            placeholder={t('waitingPage.name')}
                            required
                            className="input-field"
                        />
                        <button type="submit" className="btn" onClick={()=>navigate(`/waiting/${roomCode}`) }>{t('waitingPage.join')}</button>
                    </form>
                </div>
            </div>
        );
    }

    if (!showNameInput) {
        if (loading) {
            return (
                <div className="waiting-page">
                    <div className="loading-container">
                        <div className="loading-spinner"></div>
                        <p>{t('waitingPage.loading')}</p>
                    </div>
                </div>
            );
        }

        if (error) {
            return (
                <div className="waiting-page">
                    <div className="error-container">
                        <h2>{t('waitingPage.error')}</h2>
                        <p>{error}</p>
                        <button onClick={handleBackToHome}>{t('waitingPage.back')}</button>
                    </div>
                </div>
            );
        }

        // Main waiting screen
        return (
            <div className="waiting-page">
                <header className="room-header">
                    <h2>{roomName}</h2>
                    <div className="participants-count">
                        {activeUsers} {activeUsers === 1 ? t('waitingPage.participant') : t('waitingPage.participants')}
                    </div>
                    <button className="leave-button" onClick={handleBackToHome}>
                        {t('waitingPage.leave')}
                    </button>
                </header>

                <main className="waiting-content">
                    <div className="waiting-card">
                        <div className="waiting-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="12 6 12 12 16 14"></polyline>
                            </svg>
                        </div>

                        <h1>{t('waitingPage.waiting')}</h1>
                        <p>{t('waitingPage.share')}</p>

                        <div className="room-code-display">
                            <p>{t('waitingPage.roomCode')}</p>
                            <div className="code">{roomCode}</div>
                            <button
                                className="copy-button"
                                onClick={copyRoomCode}
                            >
                                {t('waitingPage.copy')}
                            </button>
                        </div>

                        <div className="participants-area">
                            <h2>{t('waitingPage.Participants')} ({activeUsers})</h2>
                            <div className="participants-message">
                                {activeUsers > 1
                                    ? t('waitingPage.ready')
                                    : t('waitingPage.waitingMore')}
                            </div>
                        </div>

                        <button
                            className={`start-button ${activeUsers < 2 ? 'disabled' : ''}`}
                            disabled={activeUsers < 2}
                            onClick={handleStartSwiping}
                        >
                            {activeUsers < 2 ? t('waitingPage.waitingMore') : t('waitingPage.start')}
                        </button>
                    </div>
                </main>
            </div>
        );
    }
}

export default WaitingPage;