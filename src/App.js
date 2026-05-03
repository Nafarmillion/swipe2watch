import React from 'react';
import {BrowserRouter as Router, Routes, Route} from 'react-router-dom';
import HomePage from './components/HomePage';
import CreateRoom from './components/CreateRoom';
import SwipeScreen from './components/SwipeScreen';
import MatchScreen from './components/MatchScreen';
import WaitingPage from './components/WaitingPage';

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<HomePage/>}/>
                {<Route path="/create" element={<CreateRoom/>}/>}
                <Route path="/swipe/:roomCode" element={<SwipeScreen />} />
                <Route path="/match/:roomCode" element={<MatchScreen />} />
                <Route path="/waiting/:roomCode" element={<WaitingPage />} />
            </Routes>
        </Router>

    );
}

export default App;