import styles from "./Experiences.module.scss";
import { useMemo, useState, useEffect, useRef } from "react";
import { useUser } from "../../contexts/UserContext";
import { useLocation, useNavigate } from 'react-router-dom';
import { useData } from "../../contexts/DataContext";
import ExperienceCard from "../../components/ExperienceCard/ExperienceCard";
import SortFilter from "../../components/SortFilter/SortFilter";
import PageOpenGraph from "../../components/OpenGraph/PageOpenGraph";
import PageWrapper from "../../components/PageWrapper/PageWrapper";
import Loading from "../../components/Loading/Loading";
import { Container, Mobile, Desktop, FadeIn, EmptyState } from "../../components/design-system";
import SkeletonLoader from '../../components/SkeletonLoader/SkeletonLoader';
import { deduplicateById, deduplicateFuzzy } from "../../utilities/deduplication";
import { getDestinations, showDestination } from '../../utilities/destinations-api';
import { getExperienceTags, getExperiences } from '../../utilities/experiences-api';
import { sortItems, filterExperiences } from "../../utilities/sort-filter";
import { createUrlSlug } from '../../utilities/url-utils';
import { logger } from '../../utilities/logger';
import { lang } from '../../lang.constants';

export default function Experiences() {
  const { user } = useUser();
  const { experiences, plans, loading, fetchMoreExperiences, experiencesMeta, destinations, applyExperiencesFilter, experiencesFilters, immediateExperiences } = useData();
  const location = useLocation();
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState("alphabetical");
  const [filterBy, setFilterBy] = useState("all");
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef(null);
  const [selectedDestinationId, setSelectedDestinationId] = useState(experiencesFilters?.destination || 'all');
  const [selectedDestinationItems, setSelectedDestinationItems] = useState([]);
  const [destAutocompleteItems, setDestAutocompleteItems] = useState(destinations || []);
  const [destDisplayValue, setDestDisplayValue] = useState('');
  const [pendingDestTokens, setPendingDestTokens] = useState([]);
  const [destLoading, setDestLoading] = useState(false);
  const destSearchDebounceRef = useRef(null);
  const [directFilterExperiences, setDirectFilterExperiences] = useState(null);
  // Keep the original destination-scoped results so we can apply additional
  // AND filters (like experience_type) on the client without another API call.
  const [directFilterBase, setDirectFilterBase] = useState(null);
  const [directFilterLoading, setDirectFilterLoading] = useState(false);

  const [typeAutocompleteItems, setTypeAutocompleteItems] = useState([]);
  const [typeDisplayValue, setTypeDisplayValue] = useState('');
  // Support single-select for types: store selected type as an object so Autocomplete can render name
  const [selectedType, setSelectedType] = useState(null);
  const [typeLoading, setTypeLoading] = useState(false);
  const urlApplyDebounceRef = useRef(null);
  const initialUrlRef = useRef(location.search);
  const lastAppliedFiltersRef = useRef(null);
  const typeSearchDebounceRef = useRef(null);

  // Helper to update URL query params (replace state)
  function updateUrlFromFilters(filters = {}) {
    try {
      const params = new URLSearchParams();
      ['destination', 'experience_type', 'sort_by', 'sort_order', 'page', 'limit'].forEach(k => {
        if (filters[k] !== undefined && filters[k] !== null && String(filters[k]).length) {
          params.set(k, String(filters[k]));
        }
      });
      const qs = params.toString();
      // Preserve the current pathname (don't navigate to root when clearing filters)
      const base = location?.pathname || '/experiences';
      navigate(`${base}${qs ? `?${qs}` : ''}`, { replace: true });
    } catch (err) {
      console.warn('Failed to update URL from filters', err?.message || err);
    }
  }

  // IntersectionObserver to auto-load more when sentinel comes into view
  useEffect(() => {
    if (!fetchMoreExperiences || !experiencesMeta?.hasMore || loadingMore) return;
    const el = sentinelRef.current;
    if (!el) return;

    let isLoadingRef = false; // Prevent race conditions from async callbacks

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !isLoadingRef) {
          isLoadingRef = true;
          setLoadingMore(true);

          // Use async IIFE to properly handle promise
          (async () => {
            try {
              logger.debug('Infinite scroll: Fetching more experiences');
              const newExperiences = await fetchMoreExperiences();

              if (newExperiences && newExperiences.length > 0) {
                // Wait longer for React to fully render and for images to start loading
                // This ensures smooth transition without glitches
                logger.debug('Infinite scroll: Waiting for DOM to settle', { count: newExperiences.length });
                await new Promise(resolve => setTimeout(resolve, 300));
              }
            } catch (err) {
              logger.error('Failed to fetch more experiences in infinite scroll', { error: err.message });
            } finally {
              isLoadingRef = false;
              setLoadingMore(false);
            }
          })();
        }
      });
    }, { rootMargin: '100px', threshold: 0 });

    io.observe(el);
    return () => {
      io.disconnect();
      isLoadingRef = false;
    };
  }, [fetchMoreExperiences, experiencesMeta?.hasMore, loadingMore]);

  // Keep autocomplete items in sync with DataContext's destinations (initial load)
  useEffect(() => {
    setDestAutocompleteItems(destinations || []);
  }, [destinations]);

  // Resolve destination tokens (ids/slugs/names) into full destination objects
  async function resolveDestinationTokens(tokens = []) {
    if (!tokens || !tokens.length) return [];
    const resolved = [];
    for (const token of tokens) {
      // try local autocomplete items first
      const local = (destAutocompleteItems || []).find(d => d && (String(d._id) === String(token) || d.slug === token || (d.name && d.name.toLowerCase() === token.toLowerCase())));
      if (local) {
        resolved.push(local);
        continue;
      }

      // If token looks like an ObjectId, try fetching by id
      if (/^[a-fA-F0-9]{24}$/.test(token)) {
        try {
          const resp = await showDestination(token);
          const dest = resp && resp.data ? resp.data : resp;
          if (dest && dest._id) {
            resolved.push(dest);
            continue;
          }
        } catch (err) {
          // ignore and fallthrough to search by name
        }
      }

      // Fall back to search by name/slug via API
      try {
        const results = await getDestinations({ q: token, limit: 5 });
        const items = results && results.data ? results.data : results;
        if (Array.isArray(items) && items.length) {
          // pick the first reasonable match
          resolved.push(items[0]);
          continue;
        }
      } catch (err) {
        // ignore search failures
      }
    }

    if (resolved.length) {
      setSelectedDestinationItems(resolved);
      // build destination param string (slugs preferred)
      const tokens = resolved.map(d => d && (d.slug ? d.slug : (d._id || d.id) ? (d._id || d.id) : d.name)).filter(Boolean);
      const destParam = tokens.join(',');
      setSelectedDestinationId(destParam || 'all');
      setPendingDestTokens([]);
    }

    return resolved;
  }

  // If we have pending destination tokens (from URL) and destinations load later,
  // attempt to resolve them into selected items so chips can be shown.
  useEffect(() => {
    if (!pendingDestTokens || !pendingDestTokens.length) return;
    // attempt to resolve using current autocomplete items
    const tokens = pendingDestTokens.slice();
    resolveDestinationTokens(tokens);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destAutocompleteItems]);

  // Fetch initial experience types (tags) so the Type Autocomplete has items on focus
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setTypeLoading(true);
        const res = await getExperienceTags();
        const items = res.data || res;
        if (!mounted) return;
        if (Array.isArray(items)) setTypeAutocompleteItems(items.map((t) => (typeof t === 'string' ? { name: t } : t)));
        setTypeLoading(false);
      } catch (err) {
        // ignore errors silently
        console.warn('Failed to load experience types', err?.message || err);
        setTypeLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Fetch direct experiences for immediate DOM display. Accepts a filters
  // object so we can fetch destination-scoped results combined with other
  // filters (e.g., experience_type) for correct AND semantics when the
  // user applies multiple filters sequentially.
  async function fetchDirectExperiences(filters) {
    if (!filters || !filters.destination) {
      setDirectFilterExperiences(null);
      setDirectFilterBase(null);
      return;
    }
    try {
      setDirectFilterLoading(true);
        let resp;
        if (typeof filters === 'object') {
          // Merge default paging with provided filters
          const fetchFilters = { page: 1, limit: 50, ...filters };
          resp = await getExperiences(fetchFilters);
        } else {
          // assume it's a destination token
          resp = await getExperiences({ destination: filters, page: 1, limit: 50 });
        }
      const items = resp && resp.data ? resp.data : (Array.isArray(resp) ? resp : []);
      // If this was a destination-only fetch, preserve the base set so
      // additional filters (like experience_type) can be applied locally.
      const isDestinationOnly = typeof filters === 'string' || (typeof filters === 'object' && !filters.experience_type);
      if (isDestinationOnly) {
        setDirectFilterBase(items || []);
        setDirectFilterExperiences(items || []);
      } else {
        setDirectFilterExperiences(items || []);
      }
    } catch (err) {
      console.warn('Failed to fetch direct experiences for filters', err?.message || err);
      setDirectFilterExperiences([]);
    } finally {
      setDirectFilterLoading(false);
    }
    }
  
    // Fetch direct experiences for immediate DOM display. Accepts either a destination string
    // or a full filters object (preferred) so we can fetch destination+type combos instantly.
    async function fetchDirectExperiencesForDestination(filtersOrDest) {
      if (!filtersOrDest) {
          setDirectFilterExperiences(null);
          setDirectFilterBase(null);
        return;
      }
      try {
        setDirectFilterLoading(true);
        let resp;
        if (typeof filtersOrDest === 'object') {
          // Merge default paging with provided filters
          const fetchFilters = { page: 1, limit: 50, ...filtersOrDest };
          resp = await getExperiences(fetchFilters);
        } else {
          // assume it's a destination token
          resp = await getExperiences({ destination: filtersOrDest, page: 1, limit: 50 });
        }
        const items = resp && resp.data ? resp.data : (Array.isArray(resp) ? resp : []);
          const isDestinationOnlyFetch = typeof filtersOrDest === 'string' || (typeof filtersOrDest === 'object' && !filtersOrDest.experience_type);
          if (isDestinationOnlyFetch) {
            setDirectFilterBase(items || []);
            setDirectFilterExperiences(items || []);
          } else {
            setDirectFilterExperiences(items || []);
          }
      } catch (err) {
        console.warn('Failed to fetch direct experiences for destination', err?.message || err);
        setDirectFilterExperiences([]);
      } finally {
        setDirectFilterLoading(false);
      }
    }

  function handleDestinationSearch(term) {
    // Debounce destination search by 250ms
    if (destSearchDebounceRef.current) clearTimeout(destSearchDebounceRef.current);
    destSearchDebounceRef.current = setTimeout(async () => {
      try {
        setDestLoading(true);
        if (!term || term.trim() === '') {
          // Reset to known destinations (first page)
          setDestAutocompleteItems(destinations || []);
          setDestLoading(false);
          return;
        }
        const results = await getDestinations({ q: term, limit: 10 });
        const items = results.data || results;
        if (Array.isArray(items)) setDestAutocompleteItems(items);
        setDestLoading(false);
      } catch (err) {
        // ignore search errors silently
        console.warn('Destination search failed', err.message);
        setDestAutocompleteItems([]);
        setDestLoading(false);
      }
    }, 250);
  }

  function handleTypeSearch(term) {
    // Update the display value immediately so the Autocomplete (controlled) shows typed characters
    setTypeDisplayValue(term || '');
    // Debounce type search by 250ms
    if (typeSearchDebounceRef.current) clearTimeout(typeSearchDebounceRef.current);
    typeSearchDebounceRef.current = setTimeout(async () => {
      try {
        setTypeLoading(true);
        if (!term || term.trim() === '') {
          setTypeAutocompleteItems([]);
          setTypeLoading(false);
          return;
        }
        const res = await getExperienceTags({ q: term });
        const items = res.data || res;
        // tags may be strings
        if (Array.isArray(items)) setTypeAutocompleteItems(items.map((t) => (typeof t === 'string' ? { name: t } : t)));
        setTypeLoading(false);
      } catch (err) {
        // ignore
        console.warn('Type search failed', err?.message || err);
        setTypeAutocompleteItems([]);
        setTypeLoading(false);
      }
    }, 250);
  }

  // Deduplicate, filter, and sort experiences
  const processedExperiences = useMemo(() => {
    if (!experiences) return [];
    // First deduplicate by ID
    const uniqueById = deduplicateById(experiences);
    // Then apply fuzzy deduplication to catch similar names
    const uniqueFuzzy = deduplicateFuzzy(uniqueById, 'title', 90);
    const filtered = filterExperiences(uniqueFuzzy, filterBy, user?._id);
    return sortItems(filtered, sortBy);
  }, [experiences, sortBy, filterBy, user?._id]);
  
  // Ensure this view always requests a fresh, complete experiences list
  // when mounted so it doesn't accidentally show a subset loaded by other views.
  // Also respect URL-driven params: page, limit, destination, experience_type, sort_by, sort_order
  const [initialLoading, setInitialLoading] = useState(false);
  useEffect(() => {
    let mounted = true;
    (async () => {
      setInitialLoading(true);
      try {
        const params = new URLSearchParams(window.location.search || '');
        const urlFilters = {};
        ['destination', 'experience_type', 'sort_by', 'sort_order', 'page', 'limit'].forEach(k => {
          if (params.has(k)) urlFilters[k] = params.get(k);
        });

        // Determine filters to use:
        // - If URL has filters, use those (explicit filter request)
        // - If URL has NO filters, use empty {} (show all experiences)
        // This ensures /experiences always shows all, /experiences?destination=123 shows filtered
        const hasUrlFilters = Object.keys(urlFilters).length > 0;
        const filters = hasUrlFilters ? urlFilters : {};

        // Check if we're clearing previous filters
        const hasViewSpecificData = experiencesFilters && experiencesFilters.__viewSpecific;
        const hasPreviousFilters = experiencesFilters && Object.keys(experiencesFilters).length > 0;

        // CRITICAL: Clear directFilterExperiences IMMEDIATELY when no URL filters
        // This prevents stale filtered data from previous views from displaying
        if (!hasUrlFilters) {
          logger.info('Experiences view: No URL filters, clearing directFilterExperiences immediately', {
            previousFilters: experiencesFilters,
            urlFilters,
            hasViewSpecificData,
            hasPreviousFilters,
            directFilterExperiences: directFilterExperiences ? `${directFilterExperiences.length} items` : 'null'
          });
          setDirectFilterExperiences(null);
        }

        if (!hasUrlFilters && (hasViewSpecificData || hasPreviousFilters)) {
          logger.info('Experiences view: Clearing previous context filters and fetching all', {
            previousFilters: experiencesFilters,
            hasViewSpecificData,
            hasPreviousFilters
          });
        }

        // Prefill UI state from URL params when available
        if (urlFilters.sort_by) setSortBy(urlFilters.sort_by);
        if (urlFilters.sort_order) {
          // sort_order currently not separately modeled; could be used to influence server call
        }
        if (params.has('show')) setFilterBy(params.get('show'));
        if (urlFilters.experience_type) {
          // support comma-separated experience_type param but only take the first token for single-select
          const tokens = String(urlFilters.experience_type).split(',').map(t => t.trim()).filter(Boolean);
          const first = tokens.length ? tokens[0] : null;
          setSelectedType(first ? { name: first } : null);
          setTypeDisplayValue(first || '');
        }

        // If destination param exists, attempt to resolve into selected items/chips
        if (urlFilters.destination) {
          const tokens = String(urlFilters.destination).split(',').map(t => t.trim()).filter(Boolean);
          if (tokens.length) {
            // try resolving immediately using current autocomplete items; if not possible,
            // mark as pending so the other effect can resolve when destinations load
            setPendingDestTokens(tokens);
            // try immediate resolution (may fetch from API)
            await resolveDestinationTokens(tokens);
            // also fetch direct experiences for this destination param so the DOM shows
            // only those experiences while DataContext syncs; use filters so other
            // future filters (like type) can be combined correctly.
            try { await fetchDirectExperiences({ destination: tokens.join(',') }); } catch (_) { /* ignore */ }
          }
        }

        // If we were provided an immediateExperiences marker for the same
        // filters, prefer to rely on its refresh promise instead of calling
        // applyExperiencesFilter immediately. This provides deterministic
        // ordering: the background refresh started by setExperiencesImmediate
        // will update canonical state and resolve the promise when done.
        // We attach a fallback so that if the refresh hangs the view still
        // recovers by calling applyExperiencesFilter after a timeout.
        //
        // EXCEPTION: If no URL filters (fetching all), always ignore the immediate
        // marker and fetch fresh data to ensure we show all experiences.
        let handledByImmediate = false;
        try {
          if (immediateExperiences && immediateExperiences.filters && hasUrlFilters) {
            const aStr = JSON.stringify(immediateExperiences.filters || {});
            const bStr = JSON.stringify(filters || {});
            logger.debug('Experiences view: Checking immediate marker', {
              immediateFilters: immediateExperiences.filters,
              currentFilters: filters,
              hasUrlFilters,
              filtersMatch: aStr === bStr
            });
            if (aStr === bStr && immediateExperiences.promise) {
              handledByImmediate = true;
              // Attach to the promise so we can detect completion. We don't
              // await it here to avoid blocking render/navigation, but we
              // set up a fallback to call applyExperiencesFilter if it stalls.
              let resolved = false;
              immediateExperiences.promise.then(() => { resolved = true; }).catch(() => { resolved = true; });
              // When the background refresh completes, attempt to update the
              // destination-scoped display from the canonical experiences we
              // just fetched (avoids making an extra API call with URL params).
              immediateExperiences.promise.then(() => {
                // allow React state updates to flush
                setTimeout(() => {
                  try {
                    if (filters && filters.destination) {
                      const tokens = String(filters.destination).split(',').map(t => t.trim()).filter(Boolean);
                      // Use context experiences to derive destination-scoped list
                      const filtered = (experiences || []).filter((exp) => {
                        const destRef = exp?.destination;
                        const destId = typeof destRef === 'object' && destRef !== null ? String(destRef._id) : String(destRef);
                        return tokens.includes(destId) || tokens.includes(exp?.destination?.slug || '');
                      });
                      if (filtered.length) {
                        setDirectFilterExperiences(filtered);
                      } else {
                        // if no matches in canonical list, clear direct results to allow processedExperiences to show
                        setDirectFilterExperiences(null);
                      }
                    }
                  } catch (err) {
                    // ignore errors here
                  }
                }, 50);
              }).catch(() => {});
              // Fallback: if refresh doesn't finish within 8s, call apply
              const fallback = setTimeout(() => {
                if (!resolved) {
                  applyExperiencesFilter(filters).catch(() => {});
                }
              }, 8000);
              // Ensure fallback cleared on unmount
              if (mounted) {
                // store fallback on local variable scope; cleanup below clears it
                // nothing else to do here
                // eslint-disable-next-line no-unused-vars
                const _fallbackCleanup = () => clearTimeout(fallback);
              }
            }
          }
        } catch (err) {
          // If anything goes wrong inspecting the immediate marker, fall back to normal behavior
          handledByImmediate = false;
        }

        if (!handledByImmediate) {
          // Apply filters to fetch the first page of experiences for this view
          logger.info('Experiences view: Applying filters via applyExperiencesFilter', {
            filters,
            hasUrlFilters,
            handledByImmediate,
            currentExperiencesCount: experiences?.length || 0
          });
          await applyExperiencesFilter(filters);
          logger.debug('Experiences view: applyExperiencesFilter completed', {
            filters,
            experiencesCount: experiences?.length || 0
          });
        } else {
          logger.info('Experiences view: Handled by immediate, skipping applyExperiencesFilter', {
            filters,
            hasUrlFilters,
            immediateFilters: immediateExperiences?.filters
          });
        }
        // If the filters include a destination, fetch direct results for immediate DOM display
        if (filters && filters.destination) {
          logger.debug('Experiences view: Fetching direct experiences for destination filter', { filters });
          fetchDirectExperiences(filters).catch(() => {});
        } else {
          // Redundant but explicit: clear direct filter experiences if no destination filter
          logger.debug('Experiences view: No destination filter, clearing directFilterExperiences (redundant safety)');
          setDirectFilterExperiences(null);
        }
      } catch (err) {
        // swallow errors here; sendRequest already logs
        console.warn('applyExperiencesFilter failed on Experiences mount', err?.message || err);
      } finally {
        if (mounted) setInitialLoading(false);
      }
    })();
    return () => { mounted = false; };
    // We only want to run this once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Prefer to display directFilterExperiences when present (non-null) so the
  // Experiences view shows only destination-scoped experiences immediately when
  // a destination filter was applied or when navigating from SingleDestination.
  const displayedExperiences = directFilterExperiences !== null ? directFilterExperiences : processedExperiences;

  // Debug logging for render data source
  useEffect(() => {
    logger.debug('Experiences view: Render data source', {
      usingDirectFilter: directFilterExperiences !== null,
      directFilterCount: directFilterExperiences?.length || 0,
      processedCount: processedExperiences?.length || 0,
      displayedCount: displayedExperiences?.length || 0,
      experiencesFilters,
      urlParams: window.location.search
    });
  }, [displayedExperiences, directFilterExperiences, processedExperiences, experiencesFilters]);

  return (
    <PageWrapper title="Experiences">
      <PageOpenGraph
        title="All Experiences"
        description="Browse our curated collection of travel experiences from around the world. Discover unique adventures, plan your trips, and create unforgettable memories."
        keywords="travel experiences, adventures, trip planning, travel activities, tourism, bucket list, world travel"
        ogTitle="Discover Amazing Travel Experiences"
  ogDescription={`Explore ${displayedExperiences?.length || 'hundreds of'} curated travel experiences worldwide. Start planning your next adventure today.`}
      />

      <Container className={styles.experiencesHeader}>
        <Mobile>
          <div style={{ textAlign: 'center' }}>
            <h1 className="my-4">Experiences</h1>
          </div>
        </Mobile>
        <Desktop>
          <div style={{ textAlign: 'start' }}>
            <h1 className="my-4">Experiences</h1>
          </div>
        </Desktop>
      </Container>

      <SortFilter
        onSortChange={(val) => {
          setSortBy(val);
          // propagate sort to server-side via DataContext
          const filters = { ...(experiencesFilters || {}) };
          filters.sort_by = val;
          applyExperiencesFilter(filters);
          // Keep URL in sync with server-side filters
          try { updateUrlFromFilters(filters); } catch (e) { /* ignore */ }
        }}
        onFilterChange={(val) => {
          setFilterBy(val);
          // keep existing filter behavior client-side; could be extended to server-side
        }}
        onDestinationChange={(val, item) => {
          // Support multi-select: if val is an array, it's an array of selected items
          if (Array.isArray(val)) {
            const items = val;
            setSelectedDestinationItems(items || []);
            // build comma-separated id list when possible
            // prefer slugs for destination params (backend expects slugs)
            const slugs = items.map(it => it && it.slug ? it.slug : null).filter(Boolean);
            const ids = items.map(it => it && (it._id || it.id) ? (it._id || it.id) : null).filter(Boolean);
            const destParam = slugs.length ? slugs.join(',') : (ids.length ? ids.join(',') : items.map(it => it && it.name ? it.name : '').filter(Boolean).join(','));
            setSelectedDestinationId(destParam || 'all');
            const filters = { ...(experiencesFilters || {}) };
            if (destParam && destParam !== 'all') filters.destination = destParam; else delete filters.destination;
            if (sortBy) filters.sort_by = sortBy;
            applyExperiencesFilter(filters);
            // Update URL to reflect multi-select destination filter
            try { updateUrlFromFilters(filters); } catch (e) { /* ignore */ }
            // update display value to blank when multi
            setDestDisplayValue('');
            // fetch direct results for immediate DOM display when multi-select destination applied
            // Pass full filters object so type filters are included in the direct fetch
            if (filters.destination) fetchDirectExperiencesForDestination(filters).catch(() => {});
            return;
          }

          // Single-select / legacy behavior
          let valId = null;
          // Prefer slug if available
          if (item && item.slug) {
            valId = item.slug;
          } else if (item && item._id) {
            valId = item._id;
          } else if (val && typeof val === 'string') {
            // If the value looks like an ObjectId, use it as fallback
            if (/^[a-fA-F0-9]{24}$/.test(val)) {
              valId = val;
            } else {
              const found = (destAutocompleteItems || []).find(d => d && (d.slug === val || d._id === val || (d.name && d.name.toLowerCase() === val.toLowerCase())));
              if (found) valId = found.slug || found._id || found.id || val;
              else valId = val; // leave as-is; server may resolve by slug/name
            }
          }

          setSelectedDestinationId(valId || 'all');
          const filters = { ...(experiencesFilters || {}) };
          if (valId && valId !== 'all') {
            filters.destination = valId;
          } else {
            delete filters.destination;
          }
          // preserve sort if set
          if (sortBy) filters.sort_by = sortBy;
          applyExperiencesFilter(filters);
          // fetch direct results for immediate DOM display when single-select destination applied
          // Pass full filters object so type filters are included in the direct fetch
          if (filters.destination) fetchDirectExperiences(filters).catch(() => {});
          // Update URL for single-select destination change
          try { updateUrlFromFilters(filters); } catch (e) { /* ignore */ }
          // set display label when provided
          if (item && item.name) setDestDisplayValue(item.name);
          else if (!valId || valId === 'all') setDestDisplayValue('');
        }}
    destinations={destAutocompleteItems}
        onDestinationSearch={handleDestinationSearch}
        destinationValue={selectedDestinationId}
  destinationDisplayValue={destDisplayValue || undefined}
  typeDisplayValue={typeDisplayValue || undefined}
        types={typeAutocompleteItems}
        onTypeSearch={handleTypeSearch}
    destinationLoading={destLoading}
    typeLoading={typeLoading}
  destinationMulti={true}
  destinationSelected={selectedDestinationItems}
  onTypeChange={(val, item) => {
            const filters = { ...(experiencesFilters || {}) };
            // Expect single-select value: either a string or an object
            let token = null;
            if (!val || val === 'all') {
              token = null;
            } else if (typeof val === 'string') {
              token = val;
            } else if (val && typeof val === 'object') {
              // prefer slug for backend queries, fallback to name/id
              token = val.slug || val.name || val._id || val.id || null;
            }

            if (!token) {
              setSelectedType(null);
              setTypeDisplayValue('');
              delete filters.experience_type;
            } else {
              setSelectedType({ name: token });
              setTypeDisplayValue(token);
              filters.experience_type = token;
            }

            if (sortBy) filters.sort_by = sortBy;
            applyExperiencesFilter(filters);
            // Keep URL in sync with experience type filter
            try { updateUrlFromFilters(filters); } catch (e) { /* ignore */ }

            // If a destination filter is active, prefer client-side refinement
            // when possible: if we already have the destination-scoped base
            // results (directFilterBase), apply the new type filter locally.
            // Otherwise fall back to fetching from the server for the
            // destination+type combination.
            if (filters.destination) {
              if (!token) {
                // cleared type -> revert to base destination results when available
                if (directFilterBase) {
                  setDirectFilterExperiences(directFilterBase);
                } else {
                  // no base cached; clear direct results so processedExperiences (global)
                  // are used until a fresh destination-only fetch occurs
                  setDirectFilterExperiences(null);
                }
              } else {
                // token present: try client-side filter when we have base
                if (directFilterBase && Array.isArray(directFilterBase)) {
                  const tokenSlug = createUrlSlug(token);
                  const filtered = directFilterBase.filter(exp => {
                    if (!exp.experience_type) return false;
                    let tags = [];
                    if (Array.isArray(exp.experience_type)) {
                      tags = exp.experience_type.flatMap(item =>
                        typeof item === 'string' && item.includes(',')
                          ? item.split(',').map(t => t.trim())
                          : (typeof item === 'string' ? [item] : [])
                      );
                    } else if (typeof exp.experience_type === 'string') {
                      tags = exp.experience_type.split(',').map(t => t.trim());
                    } else {
                      return false;
                    }
                    return tags.some(tag => createUrlSlug(tag) === tokenSlug);
                  });
                  setDirectFilterExperiences(filtered);
                } else {
                  // no cached base -> fetch combined filters from server
                  fetchDirectExperiencesForDestination(filters).catch(() => {});
                }
              }
            } else {
              // no destination scope -> clear direct results (fall back to processed)
              setDirectFilterExperiences(null);
            }
  }}
    typeSelected={selectedType}
        showFilter={true}
        filterType="experiences"
      />

      {initialLoading || loading || directFilterLoading ? (
        <Loading
          variant="centered"
          size="lg"
          animation="engine"
          message={lang.current.alert.loadingExperiences}
        />
      ) : (
        <FadeIn>
          <div className={styles.experiencesList}>
            {displayedExperiences.length > 0 ? (
              displayedExperiences.map((experience, index) => (
                <FadeIn key={experience?._id || `exp-${index}`} delay={index * 0.1}>
                  {experience ? (
                    <ExperienceCard
                      experience={experience}
                      userPlans={plans}
                      forcePreload={true}
                    />
                  ) : (
                    <div key={`placeholder-${index}`} style={{ width: '12rem', height: '8rem', display: 'inline-block', margin: '0.5rem' }}>
                      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                        <SkeletonLoader variant="rectangle" width="100%" height="100%" />
                      </div>
                    </div>
                  )}
                </FadeIn>
              ))
            ) : (
              <EmptyState
                variant="search"
                title="No Experiences Found"
                description="No experiences match your current filters. Try adjusting your search criteria or browse all experiences."
                size="md"
              />
            )}
            {experiencesMeta?.hasMore && !loadingMore && (
              <div style={{ textAlign: 'center', width: '100%', marginTop: 24 }}>
                <div ref={sentinelRef} style={{ height: 1 }} />
              </div>
            )}
            {loadingMore && (
              <div style={{
                textAlign: 'center',
                width: '100%',
                marginTop: 40,
                marginBottom: 40,
                minHeight: '200px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Loading size="md" variant="overlay" animation="engine" message={lang.current.alert.loadingMoreExperiences} />
              </div>
            )}
          </div>
        </FadeIn>
      )}
    </PageWrapper>
  );
}
