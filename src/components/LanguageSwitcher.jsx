// LanguageSwitcher.jsx
import { useTranslation } from 'react-i18next';
import useLocalStorage from '../services/hooks/use-localstorage';
import i18n from "../i18n.js";
import './css/LanguageSwitcher.css'; // Import the CSS file

export function LanguageSwitcher() {
    const { i18n } = useTranslation();
    const [language, setLanguage] = useLocalStorage('language', 'en');

    const switchLanguage = (lang) => {
        i18n.changeLanguage(lang);
        setLanguage(lang);
    };

    return (
        <div className="language-switcher">
            <button
                className={language === 'en' ? 'active' : ''}
                onClick={() => switchLanguage('en')}
            >
                <span className="flag-icon flag-icon-en"></span>
                English
            </button>
            <button
                className={language === 'ua' ? 'active' : ''}
                onClick={() => switchLanguage('ua')}
            >
                <span className="flag-icon flag-icon-ua"></span>
                Українська
            </button>
        </div>
    );
}
export default LanguageSwitcher;