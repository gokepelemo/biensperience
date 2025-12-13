import { useState, useMemo } from "react";
import Autocomplete from "../Autocomplete/Autocomplete";
import { FormGroup, FormLabel, FormControl } from "../design-system";
import { lang } from "../../lang.constants";
import styles from "./SortFilter.module.scss";

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
          <div className={styles.sfField} key="sort">
            <FormGroup>
              <FormLabel htmlFor="sort-select">{lang.current.sortFilter.sortBy}</FormLabel>
              <FormControl as="select" id="sort-select" value={sortBy} onChange={handleSortChange} aria-label={lang.current.sortFilter.sortAriaLabel}>
                <option value="alphabetical">{lang.current.sortFilter.alphabetical}</option>
                <option value="alphabetical-desc">{lang.current.sortFilter.alphabeticalDesc}</option>
                {filterType === "experiences" && (
                  <>
                    <option value="destination">{lang.current.sortFilter.destinationAZ}</option>
                    <option value="destination-desc">{lang.current.sortFilter.destinationZA}</option>
                  </>
                )}
                <option value="created-newest">{lang.current.sortFilter.createdNewest}</option>
                <option value="created-oldest">{lang.current.sortFilter.createdOldest}</option>
                <option value="updated-newest">{lang.current.sortFilter.updatedNewest}</option>
                <option value="updated-oldest">{lang.current.sortFilter.updatedOldest}</option>
              </FormControl>
            </FormGroup>
          </div>
        );
      case 'show':
        return (
          <div className={styles.sfField} key="show">
            <FormGroup>
              <FormLabel htmlFor="filter-select">{lang.current.sortFilter.show}</FormLabel>
              <FormControl as="select" id="filter-select" value={filterBy} onChange={handleFilterChange} aria-label={filterType === "experiences" ? lang.current.sortFilter.filterExperiences : lang.current.sortFilter.filterDestinations}>
                <option value="all">{filterType === "experiences" ? lang.current.sortFilter.allExperiences : lang.current.sortFilter.allDestinations}</option>
                <option value="planned">{filterType === "experiences" ? lang.current.sortFilter.plannedExperiencesOnly : lang.current.sortFilter.favoriteDestinationsOnly}</option>
                <option value="unplanned">{filterType === "experiences" ? lang.current.sortFilter.notPlannedYet : lang.current.sortFilter.notFavoritedYet}</option>
                {filterType === "experiences" && (
                  <option value="created">{lang.current.sortFilter.myExperiences}</option>
                )}
              </FormControl>
            </FormGroup>
          </div>
        );
      case 'destination':
        if (filterType !== 'experiences') return null;
        return (
          <div className={styles.sfField} key="destination">
            <FormGroup>
              <FormLabel htmlFor="dest-filter-autocomplete">{lang.current.sortFilter.destination}</FormLabel>
                <Autocomplete
                placeholder={lang.current.sortFilter.searchDestinations}
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
                emptyMessage={lang.current.sortFilter.noDestinations}
              />
            </FormGroup>
          </div>
        );
      case 'type':
        if (filterType !== 'experiences') return null;
        return (
          <div className={styles.sfField} key="type">
            <FormGroup>
              <FormLabel htmlFor="type-filter-autocomplete">{lang.current.sortFilter.type}</FormLabel>
                <div className={styles.sfTypeWithClear}>
                      <Autocomplete
                        placeholder={lang.current.sortFilter.searchTypes}
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
                        emptyMessage={lang.current.sortFilter.noTypes}
                      />
                  {/* Clear button shown when there is a display value */}
                  {typeDisplayValue ? (
                    <button
                      type="button"
                      className="type-clear-btn"
                      aria-label={lang.current.sortFilter.clearTypeFilter}
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
    <div className={styles.sortFilterContainer} role="region" aria-label={lang.current.sortFilter.sortAndFilterOptions}>
      <div className={styles.sortFilterGrid}>
        {fields.map((f) => renderField(f))}
      </div>
    </div>
  );
}
