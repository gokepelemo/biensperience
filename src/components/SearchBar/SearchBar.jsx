import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchAll } from '../../utilities/search-api';
import { logger } from '../../utilities/logger';
import Autocomplete from '../Autocomplete/Autocomplete';
import styles from './SearchBar.module.scss';

/**
 * SearchBar Component
 * Global search component using the unified Autocomplete component
 * Searches across destinations, experiences, users, and plans
 */
export default function SearchBar({ 
  placeholder = 'Search destinations, experiences, users...', 
  className = '',
  size = 'md'
}) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debounceTimerRef = useRef(null);
  const navigate = useNavigate();

  /**
   * Perform search with debouncing
   */
  const performSearch = useCallback(async (query) => {
    if (!query || query.trim().length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const trimmed = query.trim();
      const searchResults = await searchAll(trimmed);
      
      // Transform results to match Autocomplete component format
      // Group by type to maintain visual separation
      
      // First, collect destination experienceCounts for use in experiences
      const destinationCounts = {};
      // Prefer backend-provided order; if no score, we'll compute a simple fallback below
      const rawResults = Array.isArray(searchResults.results) ? [...searchResults.results] : [];

      // If backend didn't already sort by score, sort locally by basic relevance as fallback
      if (rawResults.length > 0 && rawResults.every(r => typeof r.score !== 'number')) {
        const norm = (s) => (s || '').toString().trim().toLowerCase();
        const q = norm(trimmed);
        const textOf = (r) => [
          r.name,
          r.username,
          r.email,
          r.country,
          r.city,
          r.destination?.name || r.destinationName,
          r.experience?.name || r.experience?.title,
          r.title,
          r.description
        ].filter(Boolean).join(' ').toLowerCase();
        rawResults.sort((a, b) => {
          const ta = textOf(a);
          const tb = textOf(b);
          const sa = ta === q ? 3 : ta.startsWith(q) ? 2 : ta.includes(q) ? 1 : 0;
          const sb = tb === q ? 3 : tb.startsWith(q) ? 2 : tb.includes(q) ? 1 : 0;
          if (sa !== sb) return sb - sa;
          // tie-breaker: shorter text slightly higher
          return ta.length - tb.length;
        });
      }

      rawResults.forEach(result => {
        if (result.type === 'destination' && result.experienceCount) {
          destinationCounts[result._id] = result.experienceCount;
        }
      });
      
      const transformedResults = rawResults.map(result => {
        const base = {
          id: result._id,
          type: result.type,
          _id: result._id,
          score: typeof result.score === 'number' ? result.score : undefined
        };

        logger.debug('SearchBar result transformation', {
          type: result.type,
          name: result.name,
          hasType: !!result.type
        });

        switch (result.type) {
          case 'destination':
            return {
              ...base,
              name: result.name,
              country: result.country,
              flag: result.flag || getCountryFlag(result.country),
              experienceCount: result.experienceCount || result.experiences?.length || 0
            };
          
          case 'experience':
            // Get the destination ID to look up experienceCount
            const destId = typeof result.destination === 'object' ? result.destination?._id : null;
            const experienceCount = destId ? destinationCounts[destId] : null;
            
            return {
              ...base,
              name: result.name,
              destination: typeof result.destination === 'object' 
                ? result.destination?.name 
                : result.destinationName || '',
              rating: result.rating || 0,
              category: result.experience_type?.[0] || result.category || 'Experience',
              experienceCount: experienceCount
            };
          
          case 'user':
            return {
              ...base,
              name: result.name,
              username: result.username,
              email: result.email,
              avatar: result.avatar || result.profilePhoto,
              isOnline: result.isOnline || false,
              role: result.role
            };
          
          case 'plan':
            return {
              ...base,
              name: result.experience?.name || result.experience?.title || 'Unnamed Plan',
              destination: `${result.items?.length || 0} items`,
              rating: 0,
              category: 'Plan',
              experienceId: result.experience?._id || result.experience
            };
          
          default:
            return base;
        }
      });

      setResults(transformedResults);
    } catch (error) {
      logger.error('Search error', { error: error.message });
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Get country flag emoji from country name
   */
  const getCountryFlag = (countryName) => {
    const flagMap = {
      'Japan': '🇯🇵',
      'United States': '🇺🇸',
      'USA': '🇺🇸',
      'France': '🇫🇷',
      'United Kingdom': '🇬🇧',
      'UK': '🇬🇧',
      'Spain': '🇪🇸',
      'Italy': '🇮🇹',
      'Germany': '🇩🇪',
      'Australia': '🇦🇺',
      'Canada': '🇨🇦',
      'China': '🇨🇳',
      'Brazil': '🇧🇷',
    };
    return flagMap[countryName] || '🌍';
  };

  /**
   * Handle search input with debouncing
   */
  const handleSearch = useCallback((query) => {
    setSearchQuery(query);

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer
    if (query.trim().length >= 2) {
      debounceTimerRef.current = setTimeout(() => {
        performSearch(query);
      }, 300);
    } else {
      setResults([]);
    }
  }, [performSearch]);

  /**
   * Handle result selection
   */
  const handleSelect = useCallback((result) => {
    const { type, _id, experienceId } = result;

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
        navigate(`/experiences/${experienceId}`);
        break;
      case 'user':
        navigate(`/profile/${_id}`);
        break;
      default:
        logger.warn('Unknown result type', { type });
    }

    // Clear search
    setSearchQuery('');
    setResults([]);
  }, [navigate]);

  /**
   * Cleanup debounce timer on unmount
   */
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return (
    <div className={`${styles.searchBarWrapper} ${className}`}>
      <Autocomplete
        placeholder={placeholder}
        items={results}
        entityType="experience" // Use experience as base, but item.type will auto-detect
        onSelect={handleSelect}
        onSearch={handleSearch}
        loading={loading}
        value={searchQuery}
        emptyMessage={searchQuery.length >= 2 ? `No results found for "${searchQuery}"` : 'Type at least 2 characters to search'}
        showMeta={true}
        showAvatar={true}
        showStatus={true}
        size={size}
        disableFilter={true} // API handles filtering, don't filter client-side
      />
    </div>
  );
}
