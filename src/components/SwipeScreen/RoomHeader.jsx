// swipe/RoomHeader.jsx
import React from 'react';

const RoomHeader = ({ roomData, roomCode, activeUsers, handleLeaveRoom, t }) => {
    return (
        <div className="room-header">
            <h2>{roomData?.name || `${t('swipeScreen.room')}: ${roomCode}`}</h2>
            <div className="participants-count">
                {activeUsers} {activeUsers === 1
                    ? t('swipeScreen.participant')
                    : t('swipeScreen.participants')} {t('swipeScreen.online')}
            </div>
            <button className="leave-button" onClick={handleLeaveRoom}>
                {t('swipeScreen.leave')}
            </button>
        </div>
    );
};

export default RoomHeader;