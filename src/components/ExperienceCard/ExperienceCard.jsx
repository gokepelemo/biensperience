import styles from "./ExperienceCard.module.scss";
import { Link } from "react-router-dom";
import { useState, useCallback, useMemo, memo, useEffect, useRef } from "react";
import { FaEdit, FaTimes, FaPlus, FaMinus, FaCheck, FaUsers, FaStar } from "react-icons/fa";
import SkeletonLoader from "../SkeletonLoader/SkeletonLoader";
import TagPill from '../Pill/TagPill';
import { lang } from "../../lang.constants";
import TransferOwnershipModal from "../TransferOwnershipModal/TransferOwnershipModal";
import { checkUserPlanForExperience, createPlan, deletePlan } from "../../utilities/plans-api";
import { handleError } from "../../utilities/error-handler";
import { isOwner } from "../../utilities/permissions";
import { logger } from "../../utilities/logger";
import { eventBus } from '../../utilities/event-bus';
import { useData } from "../../contexts/DataContext";
import { useToast } from "../../contexts/ToastContext";
import { useUser } from "../../contexts/UserContext";
import { getCachedPlanState, setCachedPlanState } from "../../utilities/plan-cache";
import EntitySchema from "../OpenGraph/EntitySchema";
import imagePreloader from '../../utilities/image-preloader';
import { Badge } from "react-bootstrap";

// In-memory cache of URLs we've already successfully loaded during this session.
// This prevents skeleton re-appearing and redundant preload work on remounts.
const loadedImageUrls = new Set();

function ExperienceCard({ experience, updateData, userPlans, includeSchema = false, forcePreload = false, onOptimisticDelete, fluid = false, showSharedIcon = false, planId }) {
  const { user } = useUser();
  const { fetchPlans, plans: globalPlans } = useData();
  const { error: showError } = useToast();
  // Stable seed for placeholder images so they don't change on remount.
  const placeholderSeed = useMemo(() => {
    const id = experience?._id ? String(experience._id) : '';
    const name = experience?.name ? String(experience.name) : '';
    return encodeURIComponent(id || name || 'experience');
  }, [experience?._id, experience?.name]);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef(null);
  const prevImageSrcRef = useRef(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Initialize local plan state based on userPlans if available, or sessionStorage
  // STRATEGY: Use sessionStorage for instant rendering, verify with async query
  const [localPlanState, setLocalPlanState] = useState(() => {
    // Priority 1: Use userPlans prop if available (most reliable)
    if (Array.isArray(userPlans) && userPlans.length > 0) {
      return userPlans.some(plan =>
        plan.experience?._id === experience._id ||
        plan.experience === experience._id
      );
    }

    // Priority 2: Use global plans from DataContext (single fetch per session)
    if (globalPlans && globalPlans.length > 0) {
      return globalPlans.some(plan =>
        plan.experience?._id === experience._id ||
        plan.experience === experience._id
      );
    }

    // Priority 3: Use sessionStorage for instant rendering (may be stale)
    if (user?._id) {
      try {
        const cached = getCachedPlanState({ userId: user._id, experienceId: experience._id });
        if (cached !== null) return cached;
      } catch (err) {
        // ignore cache errors
      }
    }

    // Unknown yet
    return null;
  });

  // Track if we're currently verifying state from database
  const [isVerifying, setIsVerifying] = useState(false);

  // Custom setter that also updates sessionStorage
  // CRITICAL: Use user-specific key to prevent cross-user contamination
  const setLocalPlanStateWithCache = useCallback((value) => {
    setLocalPlanState(value);
    
    if (!user?._id) return; // No caching without user
    
    try {
      setCachedPlanState({
        userId: user._id,
        experienceId: experience._id,
        value
      });
    } catch (err) {
      // Silently fail if sessionStorage is not available
    }
  }, [experience._id, user?._id]);

  const userIsOwner = isOwner(user, experience);

  // Check if user has a plan for this experience
  // Use local state if available, otherwise check userPlans prop
  const experienceAdded = useMemo(() => {
    if (!experience?._id || !user?._id) return false;
    
    // Always use localPlanState - it's kept in sync with database
    return localPlanState;
  }, [experience?._id, user?._id, localPlanState]);

  // Reset local state when user changes (logout/login)
  useEffect(() => {
    if (!user?._id) {
      // User logged out - clear local state
      setLocalPlanState(false);
    }
  }, [user?._id]);

  // LAZY FETCH: Only query server if absolutely necessary
  // Conditions: user logged in, parent didn't pass plans, global plans not fetched, and local state unknown
  useEffect(() => {
    if (!user?._id || !experience?._id) return;
    if (userPlans !== undefined) return; // Parent passed plans, use them
    if (globalPlans !== null) return; // Global plans have been fetched, use them
    if (localPlanState !== null) return; // We already have local state

    let isMounted = true;
    setIsVerifying(true);
    checkUserPlanForExperience(experience._id)
      .then((result) => {
        if (!isMounted) return;
        setLocalPlanStateWithCache(!!result?.hasPlan);
      })
      .catch((err) => {
        logger.warn('[ExperienceCard] Lazy plan check failed', { error: err?.message });
      })
      .finally(() => {
        if (isMounted) setIsVerifying(false);
      });

    return () => {
      isMounted = false;
    };
  }, [user?._id, experience?._id, userPlans, globalPlans, localPlanState, setLocalPlanStateWithCache]);

  // Sync with parent-provided plans or global plans
  useEffect(() => {
    const propHasPlan = userPlans ? userPlans.some(plan =>
      plan.experience?._id === experience._id ||
      plan.experience === experience._id
    ) : false;
    const globalHasPlan = (globalPlans || []).some(plan =>
      plan.experience?._id === experience._id ||
      plan.experience === experience._id
    );

    // Priority: userPlans > globalPlans > local state
    const hasPlan = userPlans !== undefined ? propHasPlan : globalHasPlan;

    if (hasPlan !== localPlanState && hasPlan !== null) {
      setLocalPlanStateWithCache(hasPlan);
    }
  }, [userPlans, globalPlans, experience._id, localPlanState, setLocalPlanStateWithCache]);

  // Listen for global plan events so this card updates immediately
  // Handles events from: local API calls, cross-tab localStorage, and WebSocket broadcasts
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Helper to extract experienceId from various event payload formats
    // Event bus spreads payload into event, but also adds event.detail for CustomEvent compat
    const extractExperienceId = (event) => {
      // Try direct properties first (event bus format)
      let rawExp = event?.experienceId || event?.data?.experience?._id || event?.data?.experience;
      // Fallback to detail (CustomEvent format / legacy)
      if (!rawExp && event?.detail) {
        rawExp = event.detail.experienceId || event.detail.data?.experience?._id || event.detail.data?.experience;
      }
      // Also check plan property
      if (!rawExp) {
        const plan = event?.data || event?.plan || event?.detail?.data || event?.detail?.plan;
        rawExp = plan?.experience?._id || plan?.experience;
      }
      // Also check payload property (WebSocket events)
      if (!rawExp && event?.payload) {
        rawExp = event.payload.experienceId || event.payload.experience?._id || event.payload.experience;
      }
      return rawExp && rawExp.toString ? rawExp.toString() : rawExp;
    };

    // Helper to extract userId from event (for checking if event is from current user)
    const extractUserId = (event) => {
      return event?.userId || event?.detail?.userId || event?.data?.user?._id ||
             event?.detail?.data?.user?._id || event?.payload?.userId;
    };

    const onPlanCreated = (event) => {
      try {
        const expId = extractExperienceId(event);
        if (!expId) return;
        if (expId !== experience._id?.toString()) return;

        // Check if this event is from the current user
        const eventUserId = extractUserId(event);
        const isOwnEvent = eventUserId && user?._id && eventUserId.toString() === user._id.toString();

        // Mark as planned for this user (cache + state)
        // For own events, always update. For other users' events, still useful to know a plan exists
        if (isOwnEvent) {
          setLocalPlanStateWithCache(true);
          logger.debug('[ExperienceCard] Own plan:created event received', { experienceId: expId });
        } else {
          // Another user created a plan - this doesn't affect our local state
          // but we log it for debugging cross-user WebSocket events
          logger.debug('[ExperienceCard] Other user plan:created event received', { experienceId: expId, eventUserId });
        }
      } catch (err) {
        logger.warn('[ExperienceCard] plan:created handler failed', { error: err?.message });
      }
    };

    const onPlanDeleted = (event) => {
      try {
        const expId = extractExperienceId(event);
        if (!expId) return;
        if (expId !== experience._id?.toString()) return;

        // Check if this event is from the current user
        const eventUserId = extractUserId(event);
        const isOwnEvent = eventUserId && user?._id && eventUserId.toString() === user._id.toString();

        if (isOwnEvent) {
          // Mark as not planned
          setLocalPlanStateWithCache(false);
          logger.debug('[ExperienceCard] Own plan:deleted event received', { experienceId: expId });
        } else {
          // Another user deleted their plan - may not affect our state
          logger.debug('[ExperienceCard] Other user plan:deleted event received', { experienceId: expId, eventUserId });
        }
      } catch (err) {
        logger.warn('[ExperienceCard] plan:deleted handler failed', { error: err?.message });
      }
    };

    const onPlanUpdated = (event) => {
      try {
        const expId = extractExperienceId(event);
        if (!expId) return;
        if (expId !== experience._id?.toString()) return;

        // Check if this event is from the current user
        const eventUserId = extractUserId(event);
        const isOwnEvent = eventUserId && user?._id && eventUserId.toString() === user._id.toString();

        if (isOwnEvent) {
          // If a plan for this experience was updated, ensure local state shows a plan exists
          setLocalPlanStateWithCache(true);
          logger.debug('[ExperienceCard] Own plan:updated event received', { experienceId: expId });
        }
      } catch (err) {
        logger.warn('[ExperienceCard] plan:updated handler failed', { error: err?.message });
      }
    };

    // Subscribe to standardized events via event bus
    // These events come from: local API calls, cross-tab localStorage sync, and WebSocket broadcasts
    const unsubscribeCreated = eventBus.subscribe('plan:created', onPlanCreated);
    const unsubscribeDeleted = eventBus.subscribe('plan:deleted', onPlanDeleted);
    const unsubscribeUpdated = eventBus.subscribe('plan:updated', onPlanUpdated);

    return () => {
      unsubscribeCreated();
      unsubscribeDeleted();
      unsubscribeUpdated();
    };
  }, [experience._id, setLocalPlanStateWithCache, user?._id]);

  // Get the default photo URL (raw) and backgroundImage string
  const { imageSrc, backgroundImage } = useMemo(() => {
    if (!experience) {
      const src = `https://picsum.photos/seed/${placeholderSeed}/800/480`;
      return { imageSrc: src, backgroundImage: `url(${src})` };
    }

    const photos = Array.isArray(experience.photos) ? experience.photos.filter(Boolean) : [];

    if (photos.length > 0) {
      let defaultPhoto;
      if (experience.default_photo_id) {
        const defaultPhotoId = experience.default_photo_id?._id || experience.default_photo_id;
        defaultPhoto = photos.find(photo => photo?._id === defaultPhotoId);
      }
      if (!defaultPhoto) defaultPhoto = photos[0];
      const src = defaultPhoto?.url || `https://picsum.photos/seed/${placeholderSeed}/800/480`;
      return { imageSrc: src, backgroundImage: `url(${src})` };
    }

    const src = `https://picsum.photos/seed/${placeholderSeed}/800/480`;
    return { imageSrc: src, backgroundImage: `url(${src})` };
  }, [experience, placeholderSeed]);

  // Check if image is already cached in browser to avoid skeleton flash on re-renders.
  // This runs synchronously during render to set correct initial state.
  const isImageCached = useMemo(() => {
    if (!imageSrc) return true;
    if (loadedImageUrls.has(imageSrc)) return true;
    const img = new Image();
    img.src = imageSrc;
    return img.complete && img.naturalHeight > 0;
  }, [imageSrc]);

  // Initialize from cache state so we don't render "no skeleton" and then flip it on.
  const [imageLoaded, setImageLoaded] = useState(() => isImageCached);

  // Use shared image preloader utility to ensure skeleton overlay exists and load image
  // Only reset imageLoaded when the actual URL changes, not on every render
  useEffect(() => {
    // Only reset if image source actually changed to a different URL
    const urlChanged = prevImageSrcRef.current !== imageSrc;
    if (urlChanged) {
      prevImageSrcRef.current = imageSrc;
    }

    if (!imageSrc) {
      setImageLoaded(true);
      return;
    }

    // If we've already loaded this URL in this session, don't re-run preload.
    if (loadedImageUrls.has(imageSrc)) {
      setImageLoaded(true);
      return;
    }

    // Check cache status
    const img = new Image();
    img.src = imageSrc;
    const isCached = img.complete && img.naturalHeight > 0;

    if (isCached) {
      // Image is already cached, no loading needed
      setImageLoaded(true);
      return;
    }

    // Not cached: show skeleton immediately and fade out on load.
    setImageLoaded(false);
    let cancelled = false;

    const cleanup = imagePreloader(containerRef, imageSrc, (err) => {
      cancelled = true;
      if (!err) loadedImageUrls.add(imageSrc);
      // Small delay to ensure smooth transition
      setTimeout(() => setImageLoaded(true), 30);
    }, { forcePreload: forcePreload, rootMargin: '400px' });

    return () => {
      cancelled = true;
      try { cleanup && cleanup(); } catch (e) {}
    };
  }, [imageSrc, forcePreload]);

  const handleExperienceAction = useCallback(async () => {
    if (isLoading) return;
    
    // Log user authentication status
    logger.debug('[ExperienceCard] Plan action triggered', {
      experienceId: experience._id,
      experienceName: experience.name,
      hasUser: !!user,
      userId: user?._id,
      isAuthenticated: !!user?._id,
      experienceAdded,
      isRemoving: experienceAdded
    });

    if (!user || !user._id) {
      logger.error('[ExperienceCard] User not authenticated', {
        hasUser: !!user,
        hasUserId: !!(user?._id)
      });
      const errorMsg = handleError(new Error('You must be logged in to plan experiences'), { 
        context: 'Plan experience' 
      });
      showError(errorMsg);
      return;
    }
    
    const isRemoving = experienceAdded;
    
    // OPTIMISTIC UPDATE: Update UI immediately for instant feedback
    // This will be verified by the async effect above
    setLocalPlanStateWithCache(!isRemoving);
    setIsLoading(true);

    try {
      if (isRemoving) {
        // REMOVE PLAN: Find and delete the user's plan
        let userPlan = userPlans?.find(plan => 
          plan.experience?._id === experience._id || 
          plan.experience === experience._id
        );
        
        // If not in userPlans prop, query database
        if (!userPlan) {
          const result = await checkUserPlanForExperience(experience._id);
          if (result.hasPlan) {
            // Prefer deleting the user's own plan if multiple are present
            const own = result.ownPlanId || result.plans?.find?.(p => p.isOwn)?._id;
            userPlan = { _id: own || result.planId };
          }
        }
        
        if (!userPlan) {
          throw new Error('Plan not found in database');
        }

        // Execute deletion
        await deletePlan(userPlan._id);
        
        logger.info('[ExperienceCard] Plan deleted', {
          planId: userPlan._id,
          experienceId: experience._id
        });

      } else {
        // CREATE PLAN: Add new plan
        logger.info('[ExperienceCard] Creating plan', {
          experienceId: experience._id,
          experienceName: experience.name,
          userId: user?._id
        });
        
        const newPlan = await createPlan(experience._id, null);
        
        logger.info('[ExperienceCard] Plan created', {
          planId: newPlan?._id,
          experienceId: experience._id
        });
      }

      // DATABASE OPERATION COMPLETE
      // The async verification effect will confirm the new state
      
      // Refresh parent component data if provided
      if (updateData) {
        updateData().catch(err => {
          logger.warn('Parent data refresh failed', { error: err.message });
        });
      }

      // Refresh global plans state (non-blocking)
      fetchPlans().catch(err => {
        logger.warn('Global plans refresh failed', { error: err.message });
      });

      // VERIFICATION: Immediately check actual database state
      // This ensures our optimistic update matches reality
      try {
        const verification = await checkUserPlanForExperience(experience._id);
        const actualState = verification.hasPlan;
        
        if (actualState !== !isRemoving) {
          // State mismatch - correct it
          logger.warn('[ExperienceCard] State mismatch after operation', {
            experienceId: experience._id,
            expected: !isRemoving,
            actual: actualState,
            operation: isRemoving ? 'delete' : 'create'
          });
          
          setLocalPlanStateWithCache(actualState);
        }
      } catch (verifyErr) {
        logger.warn('[ExperienceCard] Post-operation verification failed', {
          experienceId: experience._id,
          error: verifyErr.message
        });
      }

    } catch (err) {
      logger.error('[ExperienceCard] Plan action failed', {
        action: isRemoving ? 'remove' : 'create',
        experienceId: experience._id,
        error: err.message,
        errorStack: err.stack
      }, err);
      
      const errorMsg = handleError(err, { context: isRemoving ? 'Remove plan' : 'Create plan' });
      showError(errorMsg);
      
      // REVERT OPTIMISTIC UPDATE on error
      setLocalPlanStateWithCache(isRemoving);
      
      // Query database to get actual state
      try {
        const actualState = await checkUserPlanForExperience(experience._id);
        setLocalPlanStateWithCache(actualState.hasPlan);
      } catch (verifyErr) {
        // If verification also fails, keep reverted state
        logger.warn('[ExperienceCard] Error state verification failed', {
          error: verifyErr.message
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, experienceAdded, experience._id, experience.name, updateData, userPlans, user, setLocalPlanStateWithCache, fetchPlans, showError]);

  // Toggle expansion on mobile (tap to expand/collapse)
  const handleCardClick = useCallback((e) => {
    // Only handle on mobile
    if (!isMobile) return;

    // Don't toggle if clicking buttons or links
    if (e.target.closest('button') || e.target.closest('a')) {
      return;
    }

    setIsExpanded(prev => !prev);
  }, [isMobile]);

  // Build card class names based on props
  const cardClasses = `${styles.experienceCard} ${fluid ? styles.experienceCardFluid : ''} d-flex flex-column align-items-center justify-content-between p-3 position-relative overflow-hidden ${isMobile ? 'mobile' : ''} ${isExpanded ? 'expanded' : ''}`;

  return (
    <div className={fluid ? '' : 'd-block m-2'} style={fluid ? undefined : { width: '20rem', verticalAlign: 'top' }}>
      {experience && !isDeleted ? (
        <div
          ref={containerRef}
          className={cardClasses}
          style={{ backgroundImage: backgroundImage, minHeight: '12rem', ...(fluid ? {} : { width: '20rem' }) }}
          onClick={handleCardClick}
        >
          <div
            aria-hidden="true"
            className="position-absolute w-100 h-100 start-0 top-0"
            style={{
              zIndex: 5,
              pointerEvents: 'none',
              transition: 'opacity 260ms ease',
              opacity: imageLoaded ? 0 : 1
            }}
          >
            <SkeletonLoader variant="rectangle" width="100%" height="100%" />
          </div>
          {/* Shared/Collaborative Plan Badge - shown in top-right corner */}
          {showSharedIcon && (
            <div
              className={styles.sharedBadge}
              title={lang.current.label?.sharedPlan || 'Shared Plan'}
              aria-label={lang.current.label?.sharedPlan || 'Shared Plan'}
            >
              <FaUsers className={styles.sharedIcon} />
            </div>
          )}
          {/* Curated Experience Badge - shown in top-left corner */}
          {experience.isCurated && (
            <div
              className={styles.curatedBadge}
              title="Curated Experience"
              aria-label="Curated Experience"
            >
              <Badge
                bg="secondary"
                className={styles.tag}
                style={{
                  background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary, #6366f1) 100%)',
                  color: 'white',
                  fontSize: '0.75rem',
                  padding: '0.25rem 0.5rem'
                }}
              >
                <FaStar size={10} />
              </Badge>
            </div>
          )}
          <Link to={planId ? `/experiences/${experience._id}#plan-${planId}` : `/experiences/${experience._id}`} className={`${styles.experienceCardLink} flex-grow-1 d-flex align-items-center justify-content-center w-100`} style={{ textDecoration: 'none' }}>
            <span className={`h4 fw-bold ${styles.experienceCardTitle} d-flex align-items-center justify-content-center p-3 w-100`} style={{ textAlign: 'center' }}>
              {experience.name}
            </span>
          </Link>
          {/* tags intentionally omitted for ExperienceCard per design */}
          <div className={`${styles.experienceCardActions} d-flex gap-2 flex-shrink-0`}>
            <button
              className={`btn btn-icon ${experienceAdded ? 'btn-card-remove' : 'btn-card-add'} ${isLoading ? 'loading' : ''}`}
              type="button"
              onClick={handleExperienceAction}
              disabled={isLoading}
              aria-label={experienceAdded ? lang.current.button.removeFromPlan : lang.current.button.addToPlan}
              title={experienceAdded ? lang.current.button.removeFromPlan : lang.current.button.addToPlan}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              {experienceAdded ? (isHovered ? <FaMinus /> : <FaCheck />) : <FaPlus />}
            </button>
            {userIsOwner && (
              <>
                <Link
                  to={`/experiences/${experience._id}/update`}
                  className="btn btn-light btn-icon ms-2"
                  aria-label={lang.current.button.updateExperience}
                  title={lang.current.button.updateExperience}
                >
                  <FaEdit />
                </Link>
                <button
                  className="btn btn-light btn-icon ms-2"
                  onClick={() => setShowDeleteModal(true)}
                  aria-label={lang.current.button.delete}
                  title={lang.current.button.delete}
                >
                  <FaTimes />
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
      {includeSchema && experience && (
        <EntitySchema entity={experience} entityType="experience" />
      )}
      <TransferOwnershipModal
        show={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        experience={experience}
        onSuccess={() => {
          setIsDeleted(true);
          if (typeof onOptimisticDelete === 'function') {
            onOptimisticDelete(experience?._id);
          }
          if (updateData) {
            Promise.resolve(updateData()).catch((err) =>
              logger.warn('[ExperienceCard] Parent refresh failed', { error: err?.message })
            );
          }
        }}
      />
    </div>
  );
}

export default memo(ExperienceCard);
