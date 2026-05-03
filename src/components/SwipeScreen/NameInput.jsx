// swipe/NameInputForm.jsx
import React from 'react';

const NameInputForm = ({ userName, setUserName, handleNameSubmit, t }) => {
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
                    <button type="submit" className="btn">
                        {t('waitingPage.join')}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default NameInputForm;