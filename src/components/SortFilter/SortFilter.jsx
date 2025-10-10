import { useState } from "react";
import "./SortFilter.css";

export default function SortFilter({
  onSortChange,
  onFilterChange,
  showFilter = true,
  filterType = "experiences" // "experiences" or "destinations"
}) {
  const [sortBy, setSortBy] = useState("alphabetical");
  const [filterBy, setFilterBy] = useState("all");

  const handleSortChange = (e) => {
    const value = e.target.value;
    setSortBy(value);
    onSortChange(value);
  };

  const handleFilterChange = (e) => {
    const value = e.target.value;
    setFilterBy(value);
    onFilterChange(value);
  };

  return (
    <div className="sort-filter-container" role="region" aria-label="Sort and filter options">
      <div className="sort-filter-controls">
        <div className="sort-control">
          <label htmlFor="sort-select" className="form-label fw-semibold">
            Sort by:
          </label>
          <select
            id="sort-select"
            className="form-select"
            value={sortBy}
            onChange={handleSortChange}
            aria-label="Sort experiences"
          >
            <option value="alphabetical">Alphabetical (A-Z)</option>
            <option value="alphabetical-desc">Alphabetical (Z-A)</option>
            <option value="created-newest">Created (Newest First)</option>
            <option value="created-oldest">Created (Oldest First)</option>
            <option value="updated-newest">Updated (Newest First)</option>
            <option value="updated-oldest">Updated (Oldest First)</option>
          </select>
        </div>

        {showFilter && (
          <div className="filter-control">
            <label htmlFor="filter-select" className="form-label fw-semibold">
              Show:
            </label>
            <select
              id="filter-select"
              className="form-select"
              value={filterBy}
              onChange={handleFilterChange}
              aria-label={`Filter ${filterType}`}
            >
              <option value="all">All {filterType === "experiences" ? "Experiences" : "Destinations"}</option>
              <option value="planned">
                {filterType === "experiences" ? "Planned Experiences Only" : "Favorite Destinations Only"}
              </option>
              <option value="unplanned">
                {filterType === "experiences" ? "Not Planned Yet" : "Not Favorited Yet"}
              </option>
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
