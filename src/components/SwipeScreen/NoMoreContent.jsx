// swipe/NoMoreContentScreen.jsx
import React from 'react';

const NoMoreContentScreen = ({ roomCode, navigate, t }) => {
    return (
        <div className="swipe-screen">
            <div className="loading-container">
                <h1>{t('swipeScreen.title')}</h1>
                <button className='btn' onClick={() => navigate(`/match/${roomCode}`)}>
                    {t('swipeScreen.goMatch')}
                </button>
                <button className='btn' onClick={() => navigate('/')}>
                    {t('swipeScreen.goHome')}
                </button>
            </div>
        </div>
    );
};

export default NoMoreContentScreen;