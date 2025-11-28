import { useState, useEffect, useRef, useMemo } from "react";
import styles from "./TagInput.module.scss";
import TagPill from "../Pill/TagPill";
import { logger } from "../../utilities/logger";
import { getExperienceTags } from "../../utilities/experiences-api";
import { createSimpleFilter } from "../../utilities/trie";

export default function TagInput({ tags = [], onChange, placeholder = "Add tags...", maxTags = null }) {
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [allTags, setAllTags] = useState([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [isSelectingSuggestion, setIsSelectingSuggestion] = useState(false);
  const wrapperRef = useRef(null);

  // Check if max tags limit is reached
  const isAtMaxTags = maxTags !== null && tags.length >= maxTags;

  // Fetch all existing tags on mount
  useEffect(() => {
    async function fetchTags() {
      try {
        const resp = await getExperienceTags();
        // API may return { data: [...] } or an array directly. Normalize to string array.
        const items = resp && resp.data ? resp.data : resp || [];
        const normalized = Array.isArray(items)
          ? items.map(t => (typeof t === 'string' ? t : (t.name || t.label || String(t)))).filter(Boolean)
          : [];
        setAllTags(normalized);
      } catch (error) {
        logger.error('Error fetching tags', {}, error);
      }
    }
    fetchTags();
  }, []);

  // Build trie index for fast tag search - convert strings to objects for trie
  const tagTrieFilter = useMemo(() => {
    if (!allTags || allTags.length === 0) return null;
    // Convert string tags to objects for trie indexing
    const tagObjects = allTags.map(tag => ({ name: tag }));
    return createSimpleFilter(['name']).buildIndex(tagObjects);
  }, [allTags]);

  // Filter suggestions based on input using trie
  useEffect(() => {
    if (inputValue.trim()) {
      let filtered;

      if (tagTrieFilter) {
        // Use trie for O(m) filtering
        const trieResults = tagTrieFilter.filter(inputValue, { rankResults: true, limit: 10 });
        // Convert back to strings and filter out already selected tags
        filtered = trieResults
          .map(item => item.name)
          .filter(tag => !tags.includes(tag));
      } else {
        // Fallback to linear search
        const source = Array.isArray(allTags) ? allTags : [];
        filtered = source.filter(tag =>
          (typeof tag === 'string' && tag.toLowerCase().includes(inputValue.toLowerCase())) &&
          !tags.includes(tag)
        );
      }

      setSuggestions(filtered.slice(0, 5)); // Limit to 5 suggestions
      setShowSuggestions(filtered.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
    setSelectedSuggestionIndex(-1);
  }, [inputValue, allTags, tags, tagTrieFilter]);

  // Handle click outside to close suggestions
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (showSuggestions && suggestions.length > 0) {
        setSelectedSuggestionIndex(prev =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (showSuggestions && suggestions.length > 0) {
        setSelectedSuggestionIndex(prev =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
      }
    } else if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (showSuggestions && selectedSuggestionIndex >= 0) {
        addTagFromSuggestion(suggestions[selectedSuggestionIndex]);
      } else {
        addTag();
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      setSelectedSuggestionIndex(-1);
    } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      // Remove last tag on backspace if input is empty
      removeTag(tags.length - 1);
    }
  };

  const addTag = () => {
    const trimmedValue = inputValue.trim();
    if (trimmedValue && !tags.includes(trimmedValue) && !isAtMaxTags) {
      onChange([...tags, trimmedValue]);
      setInputValue("");
      setShowSuggestions(false);
    }
  };

  const addTagFromSuggestion = (tag) => {
    if (!tags.includes(tag) && !isAtMaxTags) {
      setIsSelectingSuggestion(true);
      onChange([...tags, tag]);
      setInputValue("");
      setShowSuggestions(false);
      setSelectedSuggestionIndex(-1);
      // Reset flag after a brief delay
      setTimeout(() => setIsSelectingSuggestion(false), 100);
    }
  };

  const removeTag = (indexToRemove) => {
    onChange(tags.filter((_, index) => index !== indexToRemove));
  };

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };

  const handleInputBlur = () => {
    // Delay to allow suggestion click to register
    setTimeout(() => {
      // Only add tag from input if user didn't select a suggestion
      if (!isSelectingSuggestion && inputValue.trim()) {
        addTag();
      }
      setShowSuggestions(false);
    }, 250);
  };

  return (
    <div className={styles.tagInputContainer} ref={wrapperRef}>
      <div className={styles.tagsWrapper}>
        {tags.map((tag, index) => (
          <TagPill
            key={index}
            removable
            size="sm"
            color="neutral"
            onRemove={() => removeTag(index)}
            className={styles.tag}
          >
            {tag}
          </TagPill>
        ))}
        <input
          type="text"
          className={styles.tagInput}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onBlur={handleInputBlur}
          placeholder={isAtMaxTags ? `Maximum ${maxTags} types` : (tags.length === 0 ? placeholder : "")}
          disabled={isAtMaxTags}
        />
      </div>
      {showSuggestions && suggestions.length > 0 && (
        <ul className={styles.tagSuggestions}>
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion}
              className={`${styles.tagSuggestionItem} ${index === selectedSuggestionIndex ? styles.selected : ""}`}
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent input blur
                addTagFromSuggestion(suggestion);
              }}
              onMouseEnter={() => setSelectedSuggestionIndex(index)}
            >
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
