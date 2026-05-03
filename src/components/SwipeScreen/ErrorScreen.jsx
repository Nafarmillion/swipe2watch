// swipe/ErrorScreen.jsx
import React from 'react';

const ErrorScreen = ({ error, navigate, t }) => {
    return (
        <div className="swipe-screen">
            <div className="error-container">
                <h2>{t('swipeScreen.error')}</h2>
                <p>{error}</p>
                <button onClick={() => navigate('/')}>{t('swipeScreen.back')}</button>
            </div>
        </div>
    );
};

export default ErrorScreen;