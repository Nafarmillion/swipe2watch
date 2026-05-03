// SwipeScreen.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import {
    joinRoom,
    listenToRoomUpdates,
    updateUserViewingIndex,
    leaveRoom,
    listenToUsersCount,
} from '../services/database/superBase';
import { useTranslation } from 'react-i18next';
import './css/SwipeScreen.css';

// Import components from the index file
import {
    LoadingScreen,
    ErrorScreen,
    EmptyContentScreen,
    NoMoreContentScreen,
    NameInputForm,
    RoomHeader,
    ContentCard,
    ContentFetcher,
    MatchListener
} from './SwipeScreen/index';

function SwipeScreen() {
    const { t } = useTranslation();
    const { roomCode } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    // URL state parameters
    const fromButton = location.state?.fromButton || false;
    const previousPath = location.state?.previousPath || "невідомо";

    // User identification
    const [userId] = useState(() => {
        const storedId = localStorage.getItem('userId');
        if (storedId) return storedId;
        const newId = uuidv4();
        localStorage.setItem('userId', newId);
        return newId;
    });
    const [userName, setUserName] = useState(() => localStorage.getItem('userName') || '');

    // Room and content state
    const [roomData, setRoomData] = useState(null);
    const [contentItems, setContentItems] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [activeUsers, setActiveUsers] = useState(0);

    // UI states
    const [isJoining, setIsJoining] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showNameInput, setShowNameInput] = useState(false);

    // Match tracking
    const [matches, setMatches] = useState({});
    const [processedMatchIds, setProcessedMatchIds] = useState(new Set());
    const [currentMatch, setCurrentMatch] = useState(null);

    // Handle room joining and initial data loading
    useEffect(() => {
        const initializeRoom = async (displayName) => {
            setIsJoining(true);
            setIsLoading(true);

            try {
                // Join the room
                const roomData = await joinRoom(roomCode, userId, displayName);
                setRoomData(roomData);

                // Check if content already exists in the room
                if (roomData.contentItems && Object.keys(roomData.contentItems).length > 0) {
                    // Content exists - transform it to an array for our component
                    const contentArray = Object.values(roomData.contentItems);
                    // Sort by addedAt to ensure same order for all users
                    contentArray.sort((a, b) => a.addedAt - b.addedAt);
                    setContentItems(contentArray);
                }

                // Set up listeners for room updates
                const unsubscribeRoom = listenToRoomUpdates(roomCode, (data) => {
                    setRoomData(data);

                    // If there's no content yet and we're the first user (or have lowest userId)
                    // then initialize content
                    const activeUsers = data.users ? Object.values(data.users).filter(u => u.active) : [];
                    const sortedUsers = activeUsers.sort((a, b) => a.joinedAt - b.joinedAt);
                    const isFirstUser = sortedUsers.length > 0 && sortedUsers[0].displayName === displayName;

                    if ((!data.contentItems || Object.keys(data.contentItems).length === 0) && isFirstUser) {
                        // Content fetching is handled by ContentFetcher component
                    }
                    else if(fromButton && previousPath ===`/match/${roomCode}`){
                        setContentItems([]); // Спочатку очищаємо масив
                        setCurrentIndex(0); // Скидаємо індекс до початку
                        setIsLoading(true); // Показуємо індикатор завантаження
                        // Content fetching is handled by ContentFetcher component
                    }
                    // If content was added by someone else, update our local state
                    else if (data.contentItems && Object.keys(data.contentItems).length > 0) {
                        const contentArray = Object.values(data.contentItems);
                        contentArray.sort((a, b) => a.addedAt - b.addedAt);
                        setContentItems(contentArray);
                    }
                });

                const unsubscribeUsers = listenToUsersCount(roomCode, (count) => {
                    setActiveUsers(count);
                });

                return () => {
                    unsubscribeRoom();
                    unsubscribeUsers();
                };
            } catch (error) {
                console.error('Error initializing room:', error);
                setError('Failed to join room. Please check your room code and try again.');
            } finally {
                setIsJoining(false);
                setIsLoading(false);
            }
        };

        if (userName) {
            initializeRoom(userName);
        } else {
            setShowNameInput(true);
            setIsJoining(false);
            setIsLoading(false);
        }
    }, [roomCode, userId, userName, fromButton, previousPath]);

    const handleNameSubmit = (e) => {
        e.preventDefault();
        if (userName.trim()) {
            localStorage.setItem('userName', userName);
            setShowNameInput(false);
            // Room will be initialized via useEffect
        }
    };

    const updateSwipeIndex = async (newIndex) => {
        try {
            // Update the user's viewing index
            await updateUserViewingIndex(roomCode, userId, newIndex);
            // Move to the next item
            setCurrentIndex(newIndex);
        } catch (error) {
            console.error('Error updating swipe index:', error);
        }
    };

    const handleLeaveRoom = async () => {
        try {
            await leaveRoom(roomCode, userId);
            navigate('/');
        } catch (error) {
            console.error('Error leaving room:', error);
        }
    };

    // Conditional rendering based on state
    if (showNameInput) {
        return <NameInputForm
            userName={userName}
            setUserName={setUserName}
            handleNameSubmit={handleNameSubmit}
            t={t}
        />;
    }

    if (isLoading || isJoining) {
        return <LoadingScreen t={t} />;
    }

    if (error) {
        return <ErrorScreen error={error} navigate={navigate} t={t} />;
    }

    if (!contentItems || contentItems.length === 0) {
        return (
            <>
                <ContentFetcher
                    roomCode={roomCode}
                    roomData={roomData}
                    userId={userId}
                    userName={userName}
                    isFirstUser={true}
                    fromButton={fromButton}
                    previousPath={previousPath}
                    setContentItems={setContentItems}
                    setIsLoading={setIsLoading}
                    setError={setError}
                />
                <EmptyContentScreen t={t} />
            </>
        );
    }

    // Get the current content item
    const currentItem = currentIndex < contentItems.length ? contentItems[currentIndex] : null;

    if (!currentItem) {
        return <NoMoreContentScreen roomCode={roomCode} navigate={navigate} t={t} />;
    }

    return (
        <div className="swipe-screen">
            <MatchListener
                roomCode={roomCode}
                setMatches={setMatches}
                setCurrentMatch={setCurrentMatch}
                processedMatchIds={processedMatchIds}
                setProcessedMatchIds={setProcessedMatchIds}
            />

            <RoomHeader
                roomData={roomData}
                roomCode={roomCode}
                activeUsers={activeUsers}
                handleLeaveRoom={handleLeaveRoom}
                t={t}
            />

            <ContentCard
                currentItem={currentItem}
                roomCode={roomCode}
                userId={userId}
                currentIndex={currentIndex}
                updateSwipeIndex={updateSwipeIndex}
                t={t}
            />
        </div>
    );
}

export default SwipeScreen;