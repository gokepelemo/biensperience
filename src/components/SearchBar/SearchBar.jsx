import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchAll } from '../../utilities/search-api';
import { logger } from '../../utilities/logger';
import { lang } from '../../lang.constants';
import './SearchBar.css';

/**
 * SearchBar Component
 * Global search component that searches across all MongoDB collections
 * Extensible architecture ready for Algolia or other search integrations
 */
export default function SearchBar({ placeholder = 'Search destinations, experiences, plans...', className = '' }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchRef = useRef(null);
  const navigate = useNavigate();

  /**
   * Perform search
   */
  const performSearch = useCallback(async (searchQuery) => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setLoading(true);
    try {
      const searchResults = await searchAll(searchQuery.trim());
      setResults(searchResults);
      setShowResults(true);
      setSelectedIndex(-1);
    } catch (error) {
      logger.error('Search error', { error: error.message });
      setResults([]);
      setShowResults(false);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Handle input change with debouncing
   */
  const handleInputChange = useCallback((e) => {
    const value = e.target.value;
    setQuery(value);

    // Simple debounce - wait 300ms after user stops typing
    if (value.trim().length >= 2) {
      const timeoutId = setTimeout(() => {
        performSearch(value);
      }, 300);

      return () => clearTimeout(timeoutId);
    } else {
      setResults([]);
      setShowResults(false);
    }
  }, [performSearch]);

  /**
   * Handle result selection
   */
  const handleResultClick = useCallback((result) => {
    const { type, _id } = result;

    // Navigate to the appropriate page based on result type
    switch (type) {
      case 'destination':
        navigate(`/destinations/${_id}`);
        break;
      case 'experience':
        navigate(`/experiences/${_id}`);
        break;
      case 'plan':
        // Navigate to the experience page for the plan
        navigate(`/experiences/${result.experience?._id || result.experience}`);
        break;
      case 'user':
        navigate(`/profile/${_id}`);
        break;
      default:
        logger.warn('Unknown result type', { type });
    }

    // Clear search
    setQuery('');
    setResults([]);
    setShowResults(false);
  }, [navigate]);

  /**
   * Handle keyboard navigation
   */
  const handleKeyDown = useCallback((e) => {
    if (!showResults || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < results.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleResultClick(results[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowResults(false);
        setQuery('');
        break;
      default:
        break;
    }
  }, [showResults, results, selectedIndex, handleResultClick]);

  /**
   * Close results when clicking outside
   */
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /**
   * Get icon for result type
   */
  const getResultIcon = (type) => {
    switch (type) {
      case 'destination':
        return '📍';
      case 'experience':
        return '🎯';
      case 'plan':
        return '📋';
      case 'user':
        return '👤';
      default:
        return '🔍';
    }
  };

  /**
   * Format result title
   */
  const getResultTitle = (result) => {
    switch (result.type) {
      case 'destination':
        return result.name;
      case 'experience':
        return result.name;
      case 'plan':
        return result.experience?.name || 'Plan';
      case 'user':
        return result.name;
      default:
        return 'Unknown';
    }
  };

  /**
   * Format result subtitle
   */
  const getResultSubtitle = (result) => {
    switch (result.type) {
      case 'destination':
        return result.country || '';
      case 'experience':
        return result.destination?.name || '';
      case 'plan':
        return `${result.items?.length || 0} items`;
      case 'user':
        return result.email || '';
      default:
        return '';
    }
  };

  return (
    <div ref={searchRef} className={`search-bar ${className}`}>
      <div className="search-input-wrapper">
        <input
          type="search"
          className="form-control search-input"
          placeholder={placeholder}
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 2 && setShowResults(true)}
          role="combobox"
          aria-label={lang.en.aria.globalSearch}
          aria-autocomplete="list"
          aria-controls="search-results"
          aria-expanded={showResults}
        />
        {loading && (
          <div className="search-spinner">
            <div className="spinner-border spinner-border-sm" role="status">
              <span className="visually-hidden">Searching...</span>
            </div>
          </div>
        )}
      </div>

      {showResults && (
        <div
          id="search-results"
          className="search-results"
          role="listbox"
          aria-label={lang.en.aria.searchResults}
        >
          {results.length === 0 ? (
            <div className="search-result-item no-results">
              No results found for "{query}"
            </div>
          ) : (
            results.map((result, index) => (
              <div
                key={`${result.type}-${result._id}`}
                className={`search-result-item ${selectedIndex === index ? 'selected' : ''}`}
                onClick={() => handleResultClick(result)}
                onMouseEnter={() => setSelectedIndex(index)}
                role="option"
                aria-selected={selectedIndex === index}
              >
                <span className="result-icon">{getResultIcon(result.type)}</span>
                <div className="result-content">
                  <div className="result-title">{getResultTitle(result)}</div>
                  {getResultSubtitle(result) && (
                    <div className="result-subtitle">{getResultSubtitle(result)}</div>
                  )}
                </div>
                <span className="result-type-badge">{result.type}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
