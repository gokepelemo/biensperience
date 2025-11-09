import { useState, useMemo } from "react";
import Autocomplete from "../Autocomplete/Autocomplete";
import { FormGroup, FormLabel, FormControl } from "../design-system";
import "./SortFilter.css";

/**
 * SortFilter
 * Props:
 *  - visibleFields: array of field keys to show in the control. Supported keys: 'sort','show','destination','type'
 *    If omitted, defaults to ['sort','show','destination','type'] but respects showFilter/filterType for backward compatibility.
 */
export default function SortFilter({
  onSortChange,
  onFilterChange,
  onDestinationChange,
  onDestinationSearch,
  destinations = [],
  destinationDisplayValue,
  types = [],
  typeDisplayValue,
  typeSelected,
  onTypeChange,
  onTypeSearch,
  showFilter = true,
  filterType = "experiences", // "experiences" or "destinations"
  visibleFields, // optional array of keys to show; overrides showFilter
  destinationLoading = false,
  typeLoading = false,
  destinationMulti = false,
  destinationSelected = [],
}) {
  const [sortBy, setSortBy] = useState("alphabetical");
  const [filterBy, setFilterBy] = useState("all");

  const handleSortChange = (e) => {
    const value = e.target.value;
    setSortBy(value);
    if (typeof onSortChange === 'function') onSortChange(value);
  };

  const handleFilterChange = (e) => {
    const value = e.target.value;
    setFilterBy(value);
    if (typeof onFilterChange === 'function') onFilterChange(value);
  };

  const fields = useMemo(() => {
    if (Array.isArray(visibleFields) && visibleFields.length) return visibleFields;
    // default behavior respects showFilter flag
    const base = ['sort'];
    if (showFilter) base.push('show');
    if (filterType === 'experiences') {
      base.push('destination', 'type');
    }
    return base;
  }, [visibleFields, showFilter, filterType]);

  // Render a specific field by key
  const renderField = (key) => {
    switch (key) {
      case 'sort':
        return (
          <div className="sf-field" key="sort">
            <FormGroup>
              <FormLabel htmlFor="sort-select">Sort by:</FormLabel>
              <FormControl as="select" id="sort-select" value={sortBy} onChange={handleSortChange} aria-label="Sort">
                <option value="alphabetical">Alphabetical (A-Z)</option>
                <option value="alphabetical-desc">Alphabetical (Z-A)</option>
                {filterType === "experiences" && (
                  <>
                    <option value="destination">Destination (A-Z)</option>
                    <option value="destination-desc">Destination (Z-A)</option>
                  </>
                )}
                <option value="created-newest">Created (Newest First)</option>
                <option value="created-oldest">Created (Oldest First)</option>
                <option value="updated-newest">Updated (Newest First)</option>
                <option value="updated-oldest">Updated (Oldest)</option>
              </FormControl>
            </FormGroup>
          </div>
        );
      case 'show':
        return (
          <div className="sf-field" key="show">
            <FormGroup>
              <FormLabel htmlFor="filter-select">Show:</FormLabel>
              <FormControl as="select" id="filter-select" value={filterBy} onChange={handleFilterChange} aria-label={`Filter ${filterType}`}>
                <option value="all">All {filterType === "experiences" ? "Experiences" : "Destinations"}</option>
                <option value="planned">{filterType === "experiences" ? "Planned Experiences Only" : "Favorite Destinations Only"}</option>
                <option value="unplanned">{filterType === "experiences" ? "Not Planned Yet" : "Not Favorited Yet"}</option>
                {filterType === "experiences" && (
                  <option value="created">My Experiences (Created by Me)</option>
                )}
              </FormControl>
            </FormGroup>
          </div>
        );
      case 'destination':
        if (filterType !== 'experiences') return null;
        return (
          <div className="sf-field" key="destination">
            <FormGroup>
              <FormLabel htmlFor="dest-filter-autocomplete">Destination:</FormLabel>
                <Autocomplete
                placeholder="Search destinations..."
                items={destinations}
                entityType="destination"
                multi={destinationMulti}
                selected={destinationSelected}
                keepDropdownOpenOnSelect={false}
                onSelect={(item) => {
                  // Support multi-select where `item` may be an array of items
                  if (Array.isArray(item)) {
                    if (onDestinationChange) onDestinationChange(item, null);
                    return;
                  }
                  if (!item || item === 'all') {
                    if (onDestinationChange) onDestinationChange('all', null);
                  } else if (item._id) {
                    if (onDestinationChange) onDestinationChange(item._id, item);
                  }
                }}
                onSearch={(term) => {
                  if (typeof onDestinationSearch === 'function') onDestinationSearch(term);
                }}
                displayValue={destinationDisplayValue}
                disableFilter={false}
                loading={destinationLoading}
                emptyMessage="No destinations"
              />
            </FormGroup>
          </div>
        );
      case 'type':
        if (filterType !== 'experiences') return null;
        return (
          <div className="sf-field" key="type">
            <FormGroup>
              <FormLabel htmlFor="type-filter-autocomplete">Type:</FormLabel>
                <div className="sf-type-with-clear">
                      <Autocomplete
                        placeholder="Search types..."
                        items={types}
                        entityType="category"
                        multi={false}
                        selected={typeSelected}
                        value={typeDisplayValue || ''}
                        onChange={(e) => {
                          // Propagate input changes as searches to parent
                          if (typeof onTypeSearch === 'function') onTypeSearch(e.target.value);
                        }}
                        onSelect={(item) => {
                          // Single-select: item will be an object or a string
                          if (!item || item === 'all') {
                            if (onTypeChange) onTypeChange('all', null);
                            return;
                          }
                          if (typeof item === 'string') {
                            if (onTypeChange) onTypeChange(item, { name: item });
                            return;
                          }
                          // object with name
                          if (item && item.name) {
                            if (onTypeChange) onTypeChange(item.name, item);
                          }
                        }}
                        onSearch={(term) => {
                          if (typeof onTypeSearch === 'function') onTypeSearch(term);
                        }}
                        displayValue={typeDisplayValue}
                        disableFilter={false}
                        loading={typeLoading}
                        emptyMessage="No types"
                      />
                  {/* Clear button shown when there is a display value */}
                  {typeDisplayValue ? (
                    <button
                      type="button"
                      className="type-clear-btn"
                      aria-label="Clear type filter"
                      onClick={() => {
                        if (typeof onTypeChange === 'function') onTypeChange('all', null);
                        if (typeof onTypeSearch === 'function') onTypeSearch('');
                      }}
                    >
                      ×
                    </button>
                  ) : null}
                </div>
            </FormGroup>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="sort-filter-container" role="region" aria-label="Sort and filter options">
      <div className="sort-filter-grid">
        {fields.map((f) => renderField(f))}
      </div>
    </div>
  );
}
