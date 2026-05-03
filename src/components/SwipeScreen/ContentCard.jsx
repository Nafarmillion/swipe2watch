// swipe/ContentCard.jsx
import React, { useState, useRef } from 'react';
import { voteForContent } from '../../services/database/superBase';

const ContentCard = ({
                         currentItem,
                         roomCode,
                         userId,
                         currentIndex,
                         updateSwipeIndex,
                         t
                     }) => {
    const cardRef = useRef(null);

    // Swipe animation states
    const [swipeDirection, setSwipeDirection] = useState(null);
    const [startX, setStartX] = useState(0);
    const [offsetX, setOffsetX] = useState(0);
    const [isSwiping, setIsSwiping] = useState(false);
    const [isButtonSwiping, setIsButtonSwiping] = useState(false);
    const [buttonSwipeDirection, setButtonSwipeDirection] = useState(null);

    // Swipe thresholds
    const SWIPE_THRESHOLD = 20; // Minimum pixels of movement before card reacts
    const SWIPE_ACTION_THRESHOLD = 120; // Minimum pixels before triggering like/dislike

    // Handle button swipe
    const handleSwipe = async (liked) => {
        // Start the animation for button press
        setIsButtonSwiping(true);
        setButtonSwipeDirection(liked ? 'right' : 'left');

        // Also set the visual direction indicator for overlay (LIKE/DISLIKE)
        setSwipeDirection(liked ? 'right' : 'left');

        // Shorter delay for Tinder-like quick feedback
        setTimeout(async () => {
            try {
                // Record the vote in Supabase
                await voteForContent(roomCode, userId, currentItem.id, liked);

                // Update the index
                await updateSwipeIndex(currentIndex + 1);
            } catch (error) {
                console.error('Error recording vote:', error);
            } finally {
                // Reset all animation states
                setIsButtonSwiping(false);
                setButtonSwipeDirection(null);
                setSwipeDirection(null);
            }
        }, 300); // Shorter animation for quicker feedback
    };

    // Touch handlers for swipe gestures
    const handleTouchStart = (e) => {
        setStartX(e.touches[0].clientX);
        setIsSwiping(true);
    };

    const handleTouchMove = (e) => {
        if (!isSwiping) return;

        const currentX = e.touches[0].clientX;
        const diff = currentX - startX;

        // Only apply movement if the swipe exceeds the threshold
        if (Math.abs(diff) > SWIPE_THRESHOLD) {
            // Apply the movement, but subtract the threshold to make it start from a smaller offset
            const adjustedDiff = diff > 0 ? diff - SWIPE_THRESHOLD : diff + SWIPE_THRESHOLD;
            setOffsetX(adjustedDiff);

            // Determine swipe direction for visual feedback
            if (diff > 50) {
                setSwipeDirection('right');
            } else if (diff < -50) {
                setSwipeDirection('left');
            } else {
                setSwipeDirection(null);
            }
        } else {
            // Reset offset if movement is too small
            setOffsetX(0);
            setSwipeDirection(null);
        }
    };

    const handleTouchEnd = () => {
        if (!isSwiping) return;

        // Only count as a swipe if movement exceeds a larger threshold
        if (offsetX > SWIPE_ACTION_THRESHOLD) {
            // Swipe right - like
            completeSwipeAnimation('right');
        } else if (offsetX < -SWIPE_ACTION_THRESHOLD) {
            // Swipe left - dislike
            completeSwipeAnimation('left');
        } else {
            // Reset position if not enough movement
            resetSwipeState();
        }
    };

    const completeSwipeAnimation = (direction) => {
        // Set a dramatic offset for the exit animation
        const exitOffset = direction === 'right' ? window.innerWidth : -window.innerWidth;
        setOffsetX(exitOffset);

        // Process the swipe after animation
        setTimeout(() => {
            handleSwipe(direction === 'right'); // true for right/like, false for left/dislike
            resetSwipeState();
        }, 300);
    };

    const resetSwipeState = () => {
        setIsSwiping(false);
        setOffsetX(0);
        setSwipeDirection(null);
    };

    // Card style based on current swipe state
    const getCardStyle = () => {
        // For button-initiated swipes
        if (isButtonSwiping) {
            const direction = buttonSwipeDirection === 'right' ? 1 : -1;
            // Use a more subtle translation (120px) with a slight rotation for Tinder-like effect
            return {
                transform: `translateX(${direction * 120}px) rotate(${direction * 15}deg)`,
                transition: 'transform 0.3s ease',
                opacity: 1
            };
        }

        // For touch-initiated swipes
        if (isSwiping) {
            const rotate = offsetX * 0.1; // Rotation proportional to swipe distance
            const opacity = Math.max(1 - Math.abs(offsetX) / 400, 0.8); // Less fade out

            return {
                transform: `translateX(${offsetX}px) rotate(${rotate}deg)`,
                opacity: opacity,
                transition: isSwiping ? 'none' : 'transform 0.3s ease, opacity 0.3s ease'
            };
        }

        return {};
    };

    // Show swipe instruction for mobile
    const showSwipeInstructions = window.matchMedia('(max-width: 768px)').matches;

    return (
        <>
            {showSwipeInstructions && (
                <div className="swipe-instructions">
                    <div className="swipe-instruction-text">
                        <span>{t('swipeScreen.swipeMobile')}</span>
                    </div>
                </div>
            )}

            <div
                className={`content-card ${swipeDirection === 'left' ? 'swiping-left' : ''} ${swipeDirection === 'right' ? 'swiping-right' : ''}`}
                ref={cardRef}
                style={getCardStyle()}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {/* Overlay indicators that appear during swipe */}
                <div className="swipe-overlay left">
                    <div className="swipe-indicator dislike">
                        <span>DISLIKE</span>
                    </div>
                </div>
                <div className="swipe-overlay right">
                    <div className="swipe-indicator like">
                        <span>LIKE</span>
                    </div>
                </div>

                <div className="content-image">
                    <img
                        src={currentItem?.image || '/default-poster.png'}
                        alt={currentItem?.title || 'Loading...'}
                    />
                </div>
                <div className="content-info">
                    <h3>{currentItem?.title || 'Loading...'}</h3>
                    <div className="content-meta">
                        {currentItem?.year && <span className="year">{currentItem.year}</span>}
                        {currentItem?.type && <span className="type">{currentItem.type}</span>}
                        {currentItem?.score && <span className="score">{currentItem.score}/10</span>}
                    </div>
                    <div className="content-synopsis">
                        {currentItem?.synopsis || t('swipeScreen.noDesc')}
                    </div>
                    {currentItem?.genres && currentItem.genres.length > 0 && (
                        <div className="content-genres">
                            {currentItem.genres.map(genre => (
                                <span key={genre.id} className="genre-tag">{genre.name}</span>
                            ))}
                        </div>
                    )}
                </div>

                {/* Swipe actions - buttons for accessibility and non-touch devices */}
                <div className="swipe-actions">
                    <button className="dislike-button" onClick={() => handleSwipe(false)}>
                        Dislike
                    </button>
                    <button className="like-button" onClick={() => handleSwipe(true)}>
                        Like
                    </button>
                </div>
            </div>
        </>
    );
};

export default ContentCard;