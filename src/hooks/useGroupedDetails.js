import { useMemo } from 'react';
import {
  DETAIL_TYPES,
  DETAIL_TYPE_CONFIG,
  DETAIL_CATEGORIES,
} from '../components/AddPlanItemDetailModal';

function formatDateTime(value) {
  if (!value) return null;
  try {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString();
  } catch (e) {
    return null;
  }
}

function ensureGroup(groups, category) {
  if (!groups[category]) {
    groups[category] = {
      ...DETAIL_CATEGORIES[category],
      items: [],
    };
  }
  return groups[category];
}

export default function useGroupedDetails(planItem, actualCosts) {
  const groupedDetails = useMemo(() => {
    if (!planItem?.details) return {};

    const groups = {};

    const transport = planItem.details?.transport;
    if (transport?.mode) {
      const type = transport.mode;
      const typeConfig =
        DETAIL_TYPE_CONFIG[type] || {
          label: 'Transport',
          icon: '🚗',
          description: 'Transport details',
          category: 'transportation',
        };
      const category = typeConfig.category || 'transportation';
      ensureGroup(groups, category).items.push({
        ...transport,
        _key: 'transport',
        _synthKey: 'transport',
        _displayTitle:
          transport.trackingNumber || transport.vendor || 'Transport',
        _displayDeparture: formatDateTime(transport.departureTime),
        _displayArrival: formatDateTime(transport.arrivalTime),
        type,
        typeConfig,
      });
    }

    const accommodation = planItem.details?.accommodation;
    if (
      accommodation &&
      (accommodation.name ||
        accommodation.confirmationNumber ||
        accommodation.checkIn ||
        accommodation.checkOut)
    ) {
      const type = DETAIL_TYPES.HOTEL;
      const typeConfig = DETAIL_TYPE_CONFIG[type];
      const category = typeConfig?.category || 'accommodation';
      ensureGroup(groups, category).items.push({
        ...accommodation,
        _key: 'accommodation',
        _synthKey: 'accommodation',
        _displayTitle:
          accommodation.name ||
          accommodation.confirmationNumber ||
          'Accommodation',
        _displayCheckIn: formatDateTime(accommodation.checkIn),
        _displayCheckOut: formatDateTime(accommodation.checkOut),
        type,
        typeConfig,
      });
    }

    const parking = planItem.details?.parking;
    if (
      parking &&
      (parking.facilityName ||
        parking.address ||
        parking.confirmationNumber ||
        parking.startTime ||
        parking.endTime)
    ) {
      const type = DETAIL_TYPES.PARKING;
      const typeConfig = DETAIL_TYPE_CONFIG[type];
      const category = typeConfig?.category || 'parking';
      ensureGroup(groups, category).items.push({
        ...parking,
        _key: 'parking',
        _synthKey: 'parking',
        _displayTitle:
          parking.facilityName || parking.confirmationNumber || 'Parking',
        _displayStart: formatDateTime(parking.startTime),
        _displayEnd: formatDateTime(parking.endTime),
        type,
        typeConfig,
      });
    }

    const discount = planItem.details?.discount;
    if (
      discount &&
      (discount.code ||
        discount.description ||
        discount.discountValue !== undefined)
    ) {
      const type = DETAIL_TYPES.DISCOUNT;
      const typeConfig = DETAIL_TYPE_CONFIG[type];
      const category = typeConfig?.category || 'discount';
      ensureGroup(groups, category).items.push({
        ...discount,
        _key: 'discount',
        _synthKey: 'discount',
        _displayTitle: discount.code || discount.description || 'Discount',
        _displayExpires: formatDateTime(discount.expiresAt),
        type,
        typeConfig,
      });
    }

    if (actualCosts && actualCosts.length > 0) {
      const category = 'expense';
      const group = ensureGroup(groups, category);
      actualCosts.forEach((cost, i) => {
        const synthKey = cost._id ? `cost-${cost._id}` : `cost-i-${i}`;
        group.items.push({
          ...cost,
          _key: synthKey,
          _synthKey: synthKey,
          type: DETAIL_TYPES.COST,
          typeConfig: DETAIL_TYPE_CONFIG[DETAIL_TYPES.COST],
        });
      });
    }

    const sortedGroups = {};
    Object.entries(groups)
      .sort((a, b) => (a[1].order || 99) - (b[1].order || 99))
      .forEach(([key, value]) => {
        sortedGroups[key] = value;
      });

    return sortedGroups;
  }, [planItem?.details, actualCosts]);

  const totalDetailsCount = useMemo(
    () =>
      Object.values(groupedDetails).reduce(
        (sum, group) => sum + group.items.length,
        0
      ),
    [groupedDetails]
  );

  return { groupedDetails, totalDetailsCount };
}
