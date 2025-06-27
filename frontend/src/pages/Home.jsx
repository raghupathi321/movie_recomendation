import React, { useEffect, useState, useMemo } from 'react';
import API from '../api';

const Home = () => {
    const [movies, setMovies] = useState([]);
    const [recommended, setRecommended] = useState([]);
    const [selectedMovieId, setSelectedMovieId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [recLoading, setRecLoading] = useState(false);
    const [error, setError] = useState(null);
    const [recommendationError, setRecommendationError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedGenre, setSelectedGenre] = useState('All');
    const [sortBy, setSortBy] = useState('rating');
    const [viewMode, setViewMode] = useState('grid');
    const [recType, setRecType] = useState('content');
    const [favorites, setFavorites] = useState(() => {
        const saved = localStorage.getItem('movieFavorites');
        return saved ? JSON.parse(saved) : [];
    });

    useEffect(() => {
        const fetchMovies = async () => {
            try {
                setLoading(true);
                const response = await API.get('movies/');
                console.log('Fetched movies:', response.data);
                setMovies(Array.isArray(response.data) ? response.data : []);
                setError(null);
            } catch (err) {
                const errorMsg = err.response?.data?.error || err.response?.data?.detail || 'Failed to load movies. Please try again later.';
                setError(errorMsg);
                console.error('Error fetching movies:', {
                    message: err.message,
                    status: err.response?.status,
                    data: err.response?.data,
                });
            } finally {
                setLoading(false);
            }
        };
        fetchMovies();
    }, []);

    useEffect(() => {
        localStorage.setItem('movieFavorites', JSON.stringify(favorites));
    }, [favorites]);

    const fetchRecommended = async (movieId) => {
        if (!movieId || isNaN(movieId)) {
            console.error('Invalid movieId:', movieId);
            setRecommendationError('Please select a valid movie.');
            return;
        }
        try {
            setRecLoading(true);
            setRecommendationError(null);
            setRecommended([]);
            let endpoint = recType === 'collaborative' ? 'collaborative_recommended/' : 'recommended/';
            console.log(`Fetching ${recType} recommendations for movie ID: ${movieId} at ${endpoint}`);
            const response = await API.get(`${endpoint}?id=${movieId}${recType !== 'collaborative' ? `&type=${recType}` : ''}`);
            console.log('Recommendation response:', response.data);
            setRecommended(Array.isArray(response.data) ? response.data : []);
            setSelectedMovieId(movieId);
        } catch (err) {
            let errorMsg = err.response?.data?.error || err.response?.data?.detail || 'Failed to load recommendations. Please try again.';
            if (recType === 'collaborative') {
                if (errorMsg.toLowerCase().includes('tmdb')) {
                    errorMsg = `${errorMsg} Collaborative recommendations rely on TMDb data.`;
                } else if (errorMsg.toLowerCase().includes('no local movies match')) {
                    errorMsg = `${errorMsg}`;
                }
            }
            setRecommendationError(errorMsg);
            console.error('Error fetching recommendations:', {
                message: err.message,
                status: err.response?.status,
                data: err.response?.data,
            });
            setRecommended([]);
        } finally {
            setRecLoading(false);
        }
    };

    const genres = useMemo(() => {
        const uniqueGenres = [...new Set(movies.map(movie => movie.genre).filter(Boolean))];
        return ['All', ...uniqueGenres.sort()];
    }, [movies]);

    const filteredAndSortedMovies = useMemo(() => {
        let filtered = movies.filter(movie => {
            const matchesSearch = movie.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (movie.description && movie.description.toLowerCase().includes(searchTerm.toLowerCase()));
            const matchesGenre = selectedGenre === 'All' || movie.genre === selectedGenre;
            return matchesSearch && matchesGenre;
        });

        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'title': return a.title.localeCompare(b.title);
                case 'rating': return (b.rating || 0) - (a.rating || 0);
                case 'year': return (b.year || 0) - (a.year || 0);
                default: return 0;
            }
        });

        return filtered;
    }, [movies, searchTerm, selectedGenre, sortBy]);

    const toggleFavorite = (movieId) => {
        setFavorites(prev =>
            prev.includes(movieId)
                ? prev.filter(id => id !== movieId)
                : [...prev, movieId]
        );
    };

    const handleRefresh = () => {
        setLoading(true);
        setError(null);
        setRecommendationError(null);
        setRecommended([]);
        API.get('movies/?refresh=true')
            .then(res => {
                console.log('Refresh response:', res.data);
                setMovies(Array.isArray(res.data) ? res.data : []);
                setError(null);
            })
            .catch(err => {
                const errorMsg = err.response?.data?.error || err.response?.data?.detail || 'Failed to refresh movies.';
                setError(errorMsg);
                console.error('Refresh error:', {
                    message: err.message,
                    status: err.response?.status,
                    data: err.response?.data,
                });
            })
            .finally(() => setLoading(false));
    };

    // Updated functions for redirection to Google search
    const handleWatchNow = (movieTitle) => {
        const searchQuery = encodeURIComponent(movieTitle);
        window.open(`https://www.google.com/search?q=${searchQuery}`, '_blank');
    };

    const handleMoreInfo = (movieTitle) => {
        const searchQuery = encodeURIComponent(movieTitle);
        window.open(`https://www.google.com/search?q=${searchQuery}`, '_blank');
    };

    if (loading) {
        return (
            <div className="app-container">
                <div className="loading-container">
                    <div className="loading-spinner"></div>
                    <p>Loading movies...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="app-container">
                <div className="error-container glass-panel">
                    <h2>Error</h2>
                    <p>{error}</p>
                    <button onClick={handleRefresh} className="btn btn-primary">
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="app-container">
            <div className="container">
                <header className="page-header">
                    <h1>🎬 Movie Explorer</h1>
                    <p>Find your next favorite movie</p>
                </header>

                <div className="controls-section glass-panel">
                    <div className="search-container">
                        <input
                            type="text"
                            placeholder="Search movies..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="search-input glass-input"
                        />
                        <span className="search-icon">🔍</span>
                    </div>

                    <div className="filters-container">
                        <select
                            value={selectedGenre}
                            onChange={(e) => setSelectedGenre(e.target.value)}
                            className="filter-select glass-input"
                        >
                            {genres.map(genre => (
                                <option key={genre} value={genre}>{genre}</option>
                            ))}
                        </select>

                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="filter-select glass-input"
                        >
                            <option value="rating">Sort by Rating</option>
                            <option value="title">Sort by Title</option>
                            <option value="year">Sort by Year</option>
                        </select>

                        <select
                            value={recType}
                            onChange={(e) => setRecType(e.target.value)}
                            className="filter-select glass-input"
                            title="Select recommendation type"
                        >
                            <option value="content">Content-Based</option>
                            <option value="collaborative">Collaborative (TMDb)</option>
                        </select>

                        <div className="view-toggle glass-input">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                                title="Grid View"
                            >
                                ⊞
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
                                title="List View"
                            >
                                ☰
                            </button>
                        </div>
                    </div>

                    <button onClick={handleRefresh} className="refresh-btn glass-input" title="Refresh Movies">
                        🔄
                    </button>
                </div>

                <div className="results-info">
                    <p>
                        Showing {filteredAndSortedMovies.length} of {movies.length} movies
                        {searchTerm && ` for "${searchTerm}"`}
                        {selectedGenre !== 'All' && ` in ${selectedGenre}`}
                    </p>
                </div>

                {filteredAndSortedMovies.length === 0 ? (
                    <div className="no-results glass-panel">
                        <h3>No movies found</h3>
                        <p>Try adjusting your search or filters</p>
                    </div>
                ) : (
                    <div className={`movies-container ${viewMode}`}>
                        {filteredAndSortedMovies.map(movie => (
                            <div key={movie.id} className="movie-card glass-panel">
                                <div className="movie-poster">
                                    <img
                                        src={movie.poster_url || '/no-image.png'}
                                        alt={movie.title}
                                    />
                                    <button
                                        onClick={() => toggleFavorite(movie.id)}
                                        className={`favorite-btn ${favorites.includes(movie.id) ? 'favorited' : ''}`}
                                        title={favorites.includes(movie.id) ? 'Remove from favorites' : 'Add to favorites'}
                                    >
                                        {favorites.includes(movie.id) ? '❤️' : '🤍'}
                                    </button>
                                </div>

                                <div className="movie-info">
                                    <h3 className="movie-title">{movie.title}</h3>
                                    <div className="movie-meta">
                                        {movie.genre && (
                                            <span className="genre-tag">{movie.genre}</span>
                                        )}
                                        <div className="rating">
                                            <span className="stars">
                                                {'⭐'.repeat(Math.floor(movie.rating || 0))}
                                                {(movie.rating || 0) % 1 !== 0 && '✨'}
                                            </span>
                                            <span className="rating-number">{movie.rating || 'N/A'}</span>
                                        </div>
                                        {movie.year && <span className="year">({movie.year})</span>}
                                    </div>
                                    <p className="movie-description">{movie.description || 'No description available.'}</p>
                                    <div className="movie-actions">
                                        <button
                                            className="btn btn-primary"
                                            onClick={() => handleWatchNow(movie.title)}
                                        >
                                            Watch Now
                                        </button>
                                        <button
                                            className="btn btn-secondary"
                                            onClick={() => handleMoreInfo(movie.title)}
                                        >
                                            More Info
                                        </button>
                                        <button
                                            className="btn btn-outline"
                                            onClick={() => fetchRecommended(movie.id)}
                                            disabled={!movie.id || isNaN(movie.id)}
                                        >
                                            Get Similar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {recLoading && (
                    <div className="loading-container glass-panel">
                        <div className="loading-spinner"></div>
                        <p>Fetching {recType === 'collaborative' ? 'collaborative (TMDb)' : 'content-based'} recommendations...</p>
                    </div>
                )}

                {recommendationError && !recLoading && (
                    <div className="error-container glass-panel">
                        <h3>Recommendation Error</h3>
                        <p>{recommendationError}</p>
                        {selectedMovieId && (
                            <button
                                onClick={() => fetchRecommended(selectedMovieId)}
                                className="btn btn-primary"
                            >
                                Retry
                            </button>
                        )}
                        {recType === 'collaborative' && (
                            <>
                                <button
                                    onClick={() => {
                                        setRecType('content');
                                        fetchRecommended(selectedMovieId);
                                    }}
                                    className="btn btn-secondary"
                                >
                                    Try Content-Based
                                </button>
                                {recommendationError.toLowerCase().includes('no local movies match') && (
                                    <button
                                        onClick={handleRefresh}
                                        className="btn btn-secondary"
                                    >
                                        Refresh Database
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                )}

                {!recLoading && !recommendationError && recommended.length === 0 && selectedMovieId && (
                    <div className="no-results glass-panel">
                        <h3>No {recType === 'collaborative' ? 'collaborative' : 'content-based'} recommendations found</h3>
                        <p>Try a different recommendation type or refresh the movie database.</p>
                        <button
                            onClick={() => handleRefresh()}
                            className="btn btn-primary"
                        >
                            Refresh Movies
                        </button>
                    </div>
                )}

                {recommended.length > 0 && !recommendationError && !recLoading && (
                    <div className="recommended-section">
                        <h2 className="recommended-title">
                            🎯 {recType === 'collaborative' ? 'Collaborative (TMDb)' : 'Content-Based'} Recommendations for: {movies.find(m => m.id === selectedMovieId)?.title || 'Selected Movie'}
                        </h2>
                        <div className={`movies-container ${viewMode}`}>
                            {recommended.map(movie => (
                                <div key={movie.id} className="movie-card glass-panel">
                                    <div className="movie-poster">
                                        <img
                                            src={movie.poster_url || '/no-image.png'}
                                            alt={movie.title}
                                        />
                                    </div>
                                    <div className="movie-info">
                                        <h3 className="movie-title">{movie.title}</h3>
                                        <div className="movie-meta">
                                            {movie.genre && (
                                                <span className="genre-tag">{movie.genre}</span>
                                            )}
                                            <div className="rating">
                                                <span className="stars">
                                                    {'⭐'.repeat(Math.floor(movie.rating || 0))}
                                                    {(movie.rating || 0) % 1 !== 0 && '✨'}
                                                </span>
                                                <span className="rating-number">{movie.rating || 'N/A'}</span>
                                            </div>
                                            {movie.recommendation_type && (
                                                <span className="rec-type">
                                                    {movie.recommendation_type.charAt(0).toUpperCase() + movie.recommendation_type.slice(1)}
                                                </span>
                                            )}
                                            {movie.confidence_score && (
                                                <span className="confidence-score">
                                                    Match: {movie.confidence_score}%
                                                </span>
                                            )}
                                        </div>
                                        <p className="movie-description">{movie.description || 'No description available.'}</p>
                                        <div className="movie-actions">
                                            <button
                                                className="btn btn-primary"
                                                onClick={() => handleWatchNow(movie.title)}
                                            >
                                                Watch Now
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <style jsx>{`
                * {
                    box-sizing: border-box;
                }

                .app-container {
                    min-height: 100vh;
                    background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%);
                    background-attachment: fixed;
                    position: relative;
                    overflow-x: hidden;
                }

                .app-container::before {
                    content: '';
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: 
                        radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.3) 0%, transparent 50%),
                        radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.15) 0%, transparent 50%),
                        radial-gradient(circle at 40% 40%, rgba(120, 200, 255, 0.1) 0%, transparent 50%);
                    pointer-events: none;
                    z-index: 0;
                }

                .container {
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 20px;
                    font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
                    position: relative;
                    z-index: 1;
                }

                .glass-panel {
                    background: rgba(255, 255, 255, 0.05);
                    backdrop-filter: blur(20px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 16px;
                    box-shadow: 
                        0 8px 32px rgba(0, 0, 0, 0.3),
                        inset 0 1px 0 rgba(255, 255, 255, 0.1);
                }

                .glass-input {
                    background: rgba(255, 255, 255, 0.08);
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    border-radius: 12px;
                    color: #ffffff;
                }

                .glass-input::placeholder {
                    color: rgba(255, 255, 255, 0.6);
                }

                .glass-input:focus {
                    outline: none;
                    border-color: rgba(120, 119, 198, 0.6);
                    box-shadow: 0 0 0 3px rgba(120, 119, 198, 0.2);
                }

                .page-header {
                    text-align: center;
                    margin-bottom: 40px;
                    color: #ffffff;
                }

                .page-header h1 {
                    font-size: 3.5rem;
                    margin: 0;
                    background: linear-gradient(135deg, #ffffff 0%, #a855f7 50%, #3b82f6 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                    text-shadow: 0 0 30px rgba(168, 85, 247, 0.3);
                    font-weight: 800;
                    letter-spacing: -0.02em;
                }

                .page-header p {
                    color: rgba(255, 255, 255, 0.8);
                    font-size: 1.2rem;
                    margin: 15px 0 0 0;
                    font-weight: 300;
                }

                .controls-section {
                    display: flex;
                    gap: 20px;
                    align-items: center;
                    flex-wrap: wrap;
                    margin-bottom: 30px;
                    padding: 25px;
                }

                .search-container {
                    position: relative;
                    flex: 1;
                    min-width: 250px;
                }

                .search-input {
                    width: 100%;
                    padding: 14px 45px 14px 18px;
                    font-size: 16px;
                    transition: all 0.3s ease;
                }

                .search-icon {
                    position: absolute;
                    right: 15px;
                    top: 50%;
                    transform: translateY(-50%);
                    pointer-events: none;
                    font-size: 18px;
                }

                .filters-container {
                    display: flex;
                    gap: 12px;
                    align-items: center;
                }

                .filter-select {
                    padding: 14px 18px;
                    font-size: 14px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    min-width: 140px;
                }

                .filter-select option {
                    background: #1e293b;
                    color: #ffffff;
                }

                .view-toggle {
                    display: flex;
                    overflow: hidden;
                    padding: 2px;
                }

                .view-btn {
                    padding: 12px 16px;
                    border: none;
                    background: transparent;
                    cursor: pointer;
                    font-size: 16px;
                    transition: all 0.3s ease;
                    color: rgba(255, 255, 255, 0.7);
                    border-radius: 8px;
                }

                .view-btn:hover {
                    background: rgba(255, 255, 255, 0.1);
                    color: #ffffff;
                }

                .view-btn.active {
                    background: rgba(120, 119, 198, 0.3);
                    color: #ffffff;
                    box-shadow: 0 2px 8px rgba(120, 119, 198, 0.3);
                }

                .refresh-btn {
                    padding: 14px 16px;
                    font-size: 18px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    color: rgba(255, 255, 255, 0.8);
                }

                .refresh-btn:hover {
                    color: #ffffff;
                    transform: rotate(180deg);
                    background: rgba(34, 197, 94, 0.2);
                    border-color: rgba(34, 197, 94, 0.4);
                }

                .results-info {
                    margin-bottom: 25px;
                    color: rgba(255, 255, 255, 0.7);
                    font-size: 14px;
                    text-align: center;
                }

                .loading-container,
                .error-container,
                .no-results {
                    text-align: center;
                    padding: 60px 20px;
                    color: #ffffff;
                    margin: 50px 0;
                }

                .loading-spinner {
                    width: 60px;
                    height: 60px;
                    border: 4px solid rgba(255, 255, 255, 0.1);
                    border-top: 4px solid #a855f7;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin: 0 auto 20px;
                }

                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                .movies-container.grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
                    gap: 30px;
                }

                .movies-container.list {
                    display: flex;
                    flex-direction: column;
                    gap: 25px;
                }

                .movie-card {
                    overflow: hidden;
                    transition: all 0.4s ease;
                    position: relative;
                    color: #ffffff;
                }

                .movies-container.grid .movie-card {
                    display: flex;
                    flex-direction: column;
                }

                .movies-container.list .movie-card {
                    display: flex;
                    flex-direction: row;
                    align-items: stretch;
                }

                .movie-card:hover {
                    transform: translateY(-8px) scale(1.02);
                    box-shadow: 
                        0 20px 40px rgba(0, 0, 0, 0.4),
                        0 0 20px rgba(168, 85, 247, 0.2),
                        inset 0 1px 0 rgba(255, 255, 255, 0.2);
                }

                .movie-poster {
                    position: relative;
                    overflow: hidden;
                    border-radius: 12px;
                }

                .movies-container.grid .movie-poster {
                    width: 100%;
                    height: 450px;
                }

                .movies-container.list .movie-poster {
                    width: 220px;
                    flex-shrink: 0;
                }

                .movie-poster img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    transition: transform 0.4s ease;
                }

                .movie-card:hover .movie-poster img {
                    transform: scale(1.1);
                }

                .favorite-btn {
                    position: absolute;
                    top: 12px;
                    right: 12px;
                    background: rgba(0, 0, 0, 0.7);
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    border-radius: 50%;
                    width: 45px;
                    height: 45px;
                    font-size: 22px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .favorite-btn:hover {
                    background: rgba(255, 255, 255, 0.9);
                    transform: scale(1.15);
                }

                .movie-info {
                    padding: 25px;
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                }

                .movie-title {
                    font-size: 1.4rem;
                    font-weight: 700;
                    margin: 0 0 18px 0;
                    color: #ffffff;
                    line-height: 1.3;
                }

                .movie-meta {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 18px;
                    flex-wrap: wrap;
                }

                .genre-tag {
                    background: linear-gradient(135deg, #3b82f6, #a855f7);
                    color: white;
                    padding: 6px 14px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
                }

                .rating {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: rgba(255, 255, 255, 0.1);
                    padding: 4px 12px;
                    border-radius: 16px;
                    backdrop-filter: blur(10px);
                }

                .rating-number {
                    font-weight: 700;
                    color: #fbbf24;
                    font-size: 14px;
                }

                .year {
                    color: rgba(255, 255, 255, 0.7);
                    font-weight: 600;
                    background: rgba(255, 255, 255, 0.1);
                    padding: 4px 10px;
                    border-radius: 12px;
                    font-size: 13px;
                }

                .movie-description {
                    color: rgba(255, 255, 255, 0.8);
                    line-height: 1.6;
                    margin-bottom: 25px;
                    flex: 1;
                    display: -webkit-box;
                    -webkit-line-clamp: 3;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }

                .movies-container.list .movie-description {
                    -webkit-line-clamp: 2;
                }

                .movie-actions {
                    display: flex;
                    gap: 12px;
                    margin-top: auto;
                    flex-wrap: wrap;
                }

                .btn {
                    padding: 12px 20px;
                    border: none;
                    border-radius: 10px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    text-decoration: none;
                    display: inline-block;
                    text-align: center;
                    position: relative;
                    overflow: hidden;
                }

                .btn::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: -100%;
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
                    transition: left 0.5s;
                }

                .btn:hover::before {
                    left: 100%;
                }

                .btn-primary {
                    background: linear-gradient(135deg, #3b82f6, #1d4ed8);
                    color: white;
                    box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
                }

                .btn-primary:hover {
                    background: linear-gradient(135deg, #1d4ed8, #1e40af);
                    transform: translateY(-2px);
                    box-shadow: 0 8px 25px rgba(59, 130, 246, 0.4);
                }

                .btn-secondary {
                    background: linear-gradient(135deg, #6b7280, #4b5563);
                    color: white;
                    box-shadow: 0 4px 15px rgba(107, 114, 128, 0.3);
                }

                .btn-secondary:hover {
                    background: linear-gradient(135deg, #4b5563, #374151);
                    transform: translateY(-2px);
                    box-shadow: 0 8px 25px rgba(107, 114, 128, 0.4);
                }

                .btn-outline {
                    background: transparent;
                    color: #ffffff;
                    border: 2px solid rgba(255, 255, 255, 0.3);
                    backdrop-filter: blur(10px);
                }

                .btn-outline:hover {
                    background: rgba(255, 255, 255, 0.1);
                    border-color: rgba(255, 255, 255, 0.5);
                    transform: translateY(-2px);
                    box-shadow: 0 8px 25px rgba(255, 255, 255, 0.1);
                }

                .recommended-section {
                    margin-top: 60px;
                }

                .recommended-title {
                    color: #ffffff;
                    text-align: center;
                    margin-bottom: 30px;
                    font-size: 1.8rem;
                    font-weight: 700;
                    background: linear-gradient(135deg, #ffffff 0%, #a855f7 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }

                @media (max-width: 768px) {
                    .page-header h1 {
                        font-size: 2.5rem;
                    }

                    .controls-section {
                        flex-direction: column;
                        align-items: stretch;
                        padding: 20px;
                    }

                    .filters-container {
                        justify-content: space-between;
                        gap: 8px;
                    }

                    .filter-select {
                        min-width: auto;
                        flex: 1;
                    }

                    .movies-container.grid {
                        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                        gap: 20px;
                    }

                    .movies-container.list .movie-card {
                        flex-direction: column;
                    }

                    .movies-container.list .movie-poster {
                        width: 100%;
                        height: 300px;
                    }

                    .movie-actions {
                        gap: 8px;
                    }

                    .btn {
                        padding: 10px 16px;
                        font-size: 13px;
                        flex: 1;
                    }
                }

                @media (max-width: 480px) {
                    .container {
                        padding: 15px;
                    }

                    .page-header h1 {
                        font-size: 2rem;
                    }

                    .movies-container.grid {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
            </div>
        </div>
    );
};

export default Home;