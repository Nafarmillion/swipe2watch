// swipe/LoadingScreen.jsx
import React from 'react';

const LoadingScreen = ({ t }) => {
    return (
        <div className="swipe-screen">
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>{t('swipeScreen.loading')}</p>
            </div>
        </div>
    );
};

export default LoadingScreen;