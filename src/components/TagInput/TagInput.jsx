import { useState, useEffect, useRef } from "react";
import "./TagInput.css";
import { getExperiences } from "../../utilities/experiences-api";

export default function TagInput({ tags = [], onChange, placeholder = "Add tags..." }) {
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [allTags, setAllTags] = useState([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [isSelectingSuggestion, setIsSelectingSuggestion] = useState(false);
  const wrapperRef = useRef(null);

  // Fetch all existing tags on mount
  useEffect(() => {
    async function fetchTags() {
      try {
        const experiences = await getExperiences();
        const tagSet = new Set();

        experiences.forEach(exp => {
          if (exp.experience_type && Array.isArray(exp.experience_type)) {
            // Flatten array - handle both ["Tag1", "Tag2"] and ["Tag1, Tag2"]
            const expTags = exp.experience_type.flatMap(item =>
              typeof item === 'string' && item.includes(',')
                ? item.split(',').map(tag => tag.trim())
                : item
            );
            expTags.forEach(tag => {
              if (tag && typeof tag === 'string') {
                tagSet.add(tag.trim());
              }
            });
          }
        });

        setAllTags(Array.from(tagSet).sort());
      } catch (error) {
        console.error('Error fetching tags:', error);
      }
    }
    fetchTags();
  }, []);

  // Filter suggestions based on input
  useEffect(() => {
    if (inputValue.trim()) {
      const filtered = allTags.filter(tag =>
        tag.toLowerCase().includes(inputValue.toLowerCase()) &&
        !tags.includes(tag)
      );
      setSuggestions(filtered.slice(0, 5)); // Limit to 5 suggestions
      setShowSuggestions(filtered.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
    setSelectedSuggestionIndex(-1);
  }, [inputValue, allTags, tags]);

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
    if (trimmedValue && !tags.includes(trimmedValue)) {
      onChange([...tags, trimmedValue]);
      setInputValue("");
      setShowSuggestions(false);
    }
  };

  const addTagFromSuggestion = (tag) => {
    if (!tags.includes(tag)) {
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
    <div className="tag-input-container" ref={wrapperRef}>
      <div className="tags-wrapper">
        {tags.map((tag, index) => (
          <span key={index} className="tag">
            {tag}
            <button
              type="button"
              className="tag-remove"
              onClick={() => removeTag(index)}
              aria-label={`Remove ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          className="tag-input"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onBlur={handleInputBlur}
          placeholder={tags.length === 0 ? placeholder : ""}
        />
      </div>
      {showSuggestions && suggestions.length > 0 && (
        <ul className="tag-suggestions">
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion}
              className={`tag-suggestion-item ${index === selectedSuggestionIndex ? "selected" : ""}`}
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
