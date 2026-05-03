import React, {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import './css/HomePage.css';
import LanguageSwitcher from "./LanguageSwitcher";
import { useTranslation } from 'react-i18next';

function HomePage() {
    const [roomCode, setRoomCode] = useState('');
    const navigate = useNavigate();
    const { t } = useTranslation();

    const handleCreateRoom = () => {
        navigate('/create');
    };

    const handleJoinRoom = (e) => {
        e.preventDefault();
        if (roomCode.trim()) {
            navigate(`/waiting/${roomCode}`);
        }
    };

    return (
        <div className="home-container">
            <header className="header">
                <LanguageSwitcher></LanguageSwitcher>
                <div className="logo">{t('homePage.title')}</div>
                <div className="tagline">{t('homePage.subTitle')}</div>
            </header>
            <main className="main">
                <section className='hero'>
                    <h1>{t('homePage.solve')}</h1>
                    <p>{t('homePage.helps')}</p>
                </section>

                <section className="room-options">
                    <div className='option-card'>
                        <h2>{t('homePage.createRoom')}</h2>
                        <p>{t('homePage.descRoom')}</p>
                        <button className="btn" onClick={handleCreateRoom}>{t('homePage.createRoom')}</button>
                    </div>

                    <div className='option-card'>
                        <h2>{t('homePage.join')}</h2>
                        <p>{t('homePage.roomCode')}</p>
                        <form className='join-form' onSubmit={handleJoinRoom}>
                            <input
                                type="text"
                                placeholder={t('homePage.enter')}
                                value={roomCode}
                                onChange={(e) => setRoomCode(e.target.value)}
                                required
                            />
                            <button type='submit'>{t('homePage.join')}</button>
                        </form>
                    </div>
                </section>

                <section className="how-it-works">
                    <div className="steps">
                        {
                            [
                                {
                                    number: 1,
                                    title: t('homePage.createRoom'),
                                    description: t('homePage.step1')
                                },
                                {
                                    number: 2,
                                    title: t('homePage.step2Title'),
                                    description: t('homePage.step2')
                                },
                                {
                                    number: 3,
                                    title: t('homePage.step3Title'),
                                    description: t('homePage.step3')
                                },
                                {
                                    number: 4,
                                    title: t('homePage.step4Title'),
                                    description: t('homePage.step4')
                                }
                            ].map((step) => (
                                <div key={step.number} className="step">
                                    <div className='step-number'>{step.number}</div>
                                    <h3>{step.title}</h3>
                                    <p>{step.description}</p>
                                </div>
                            ))
                        }
                    </div>
                </section>
            </main>

            <footer className="footer">
                &copy; {new Date().getFullYear()} {t('homePage.service')}
            </footer>
        </div>
    );
}

export default HomePage;