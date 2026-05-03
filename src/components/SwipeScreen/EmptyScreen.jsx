// swipe/EmptyContentScreen.jsx
import React from 'react';

const EmptyContentScreen = ({ t }) => {
    return (
        <div className="swipe-screen">
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>{t('swipeScreen.loading')}</p>
            </div>
        </div>
    );
};

export default EmptyContentScreen;