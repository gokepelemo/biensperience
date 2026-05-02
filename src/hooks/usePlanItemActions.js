import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { updatePlanItem } from '../utilities/plans-api';
import { logger } from '../utilities/logger';

const COPY_RESET_MS = 2000;

export default function usePlanItemActions(plan, planItem) {
  const [addressCopied, setAddressCopied] = useState(false);
  const addressCopyTimerRef = useRef(null);

  useEffect(
    () => () => {
      if (addressCopyTimerRef.current) clearTimeout(addressCopyTimerRef.current);
    },
    []
  );

  const saveLocation = useCallback(
    async (locationData) => {
      if (!plan?._id || !planItem?._id) {
        throw new Error('Missing plan or plan item ID');
      }
      try {
        await updatePlanItem(plan._id, planItem._id, { location: locationData });
        logger.info('[usePlanItemActions] Location saved', {
          planId: plan._id,
          itemId: planItem._id,
          location: locationData.address,
        });
      } catch (err) {
        logger.error('[usePlanItemActions] Failed to save location', {
          error: err.message,
        });
        throw err;
      }
    },
    [plan?._id, planItem?._id]
  );

  const saveDate = useCallback(
    async (dateData) => {
      if (!plan?._id || !planItem?._id) {
        throw new Error('Missing plan or plan item ID');
      }
      try {
        await updatePlanItem(plan._id, planItem._id, {
          scheduled_date: dateData.scheduled_date,
          scheduled_time: dateData.scheduled_time,
        });
        logger.info('[usePlanItemActions] Date saved', {
          planId: plan._id,
          itemId: planItem._id,
        });
      } catch (err) {
        logger.error('[usePlanItemActions] Failed to save date', {
          error: err.message,
        });
        throw err;
      }
    },
    [plan?._id, planItem?._id]
  );

  const locationForMap = useMemo(() => {
    const location = planItem?.location;
    if (!location) return null;
    if (location.geo?.coordinates?.length === 2) {
      const [lng, lat] = location.geo.coordinates;
      return `${lat},${lng}`;
    }
    return location.address || null;
  }, [planItem?.location]);

  const fullCopyableAddress = useMemo(() => {
    const location = planItem?.location;
    if (!location?.address) return '';
    const parts = [location.address];
    const locParts = [location.city, location.state, location.country].filter(Boolean);
    if (locParts.length > 0) parts.push(locParts.join(', '));
    if (location.postalCode) parts.push(location.postalCode);
    return parts.join(', ');
  }, [planItem?.location]);

  const flagCopied = useCallback(() => {
    setAddressCopied(true);
    if (addressCopyTimerRef.current) clearTimeout(addressCopyTimerRef.current);
    addressCopyTimerRef.current = setTimeout(
      () => setAddressCopied(false),
      COPY_RESET_MS
    );
  }, []);

  const copyAddress = useCallback(async () => {
    if (!fullCopyableAddress) return;
    try {
      await navigator.clipboard.writeText(fullCopyableAddress);
      flagCopied();
      logger.debug('[usePlanItemActions] Address copied', {
        address: fullCopyableAddress,
      });
    } catch (err) {
      logger.error('[usePlanItemActions] Clipboard API failed, falling back', {
        error: err.message,
      });
      const textArea = document.createElement('textarea');
      textArea.value = fullCopyableAddress;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        flagCopied();
      } catch (fallbackErr) {
        logger.error('[usePlanItemActions] Fallback copy failed', {
          error: fallbackErr.message,
        });
      }
      document.body.removeChild(textArea);
    }
  }, [fullCopyableAddress, flagCopied]);

  return {
    saveLocation,
    saveDate,
    locationForMap,
    fullCopyableAddress,
    copyAddress,
    addressCopied,
  };
}
