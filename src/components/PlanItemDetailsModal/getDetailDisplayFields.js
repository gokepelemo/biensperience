/**
 * getDetailDisplayFields
 *
 * Extracts display fields from a plan item detail for rendering or PDF export.
 * Provides a single source of truth for field mapping across the UI (DetailItemCard)
 * and the PDF export flow.
 *
 * @param {Object} item - Detail item with type and type-specific data
 * @param {Object} [options]
 * @param {Array}  [options.collaborators] - Collaborator list for resolving cost payer names
 * @returns {Array<{label: string, value: string, className?: string}>}
 */
import { DETAIL_TYPES } from '../AddPlanItemDetailModal';
import { formatActualCost } from '../../utilities/cost-utils';

export default function getDetailDisplayFields(item, { collaborators = [] } = {}) {
  const fields = [];
  const type = item.type;

  if (type === DETAIL_TYPES.COST) {
    if (item.cost !== undefined && item.cost !== null) {
      fields.push({
        label: 'Amount',
        value: formatActualCost(item.cost, { currency: item.currency || 'USD', exact: true })
      });
    }
    if (item.category) {
      fields.push({ label: 'Category', value: item.category });
    }
    // Who paid — collaborator name or "Shared Cost"
    if (item.collaborator) {
      const collab = collaborators.find(c => {
        const id = c._id || c.user?._id;
        return id === item.collaborator || id?.toString() === item.collaborator?.toString();
      });
      fields.push({
        label: 'Paid for',
        value: collab ? (collab.name || collab.user?.name) : 'Unknown'
      });
    } else {
      fields.push({ label: 'Type', value: 'Shared Cost' });
    }

  } else if (type === DETAIL_TYPES.FLIGHT) {
    if (item.vendor) fields.push({ label: 'Vendor', value: item.vendor });
    if (item.trackingNumber) fields.push({ label: 'Reference', value: item.trackingNumber });
    if (item.departureLocation) fields.push({ label: 'From', value: item.departureLocation });
    if (item.arrivalLocation) fields.push({ label: 'To', value: item.arrivalLocation });
    if (item._displayDeparture) fields.push({ label: 'Departure', value: item._displayDeparture });
    if (item._displayArrival) fields.push({ label: 'Arrival', value: item._displayArrival });
    if (item.flight?.terminal) fields.push({ label: 'Terminal', value: item.flight.terminal });
    if (item.flight?.gate) fields.push({ label: 'Gate', value: item.flight.gate });

  } else if (type === DETAIL_TYPES.HOTEL) {
    if (item.name) fields.push({ label: 'Hotel', value: item.name });
    if (item.confirmationNumber) fields.push({ label: 'Confirmation', value: item.confirmationNumber });
    if (item.address) fields.push({ label: 'Address', value: item.address });
    if (item._displayCheckIn) fields.push({ label: 'Check-in', value: item._displayCheckIn });
    if (item._displayCheckOut) fields.push({ label: 'Check-out', value: item._displayCheckOut });
    if (item.roomType) fields.push({ label: 'Room Type', value: item.roomType });

  } else if ([DETAIL_TYPES.TRAIN, DETAIL_TYPES.BUS, DETAIL_TYPES.FERRY, DETAIL_TYPES.CRUISE].includes(type)) {
    if (item.vendor) fields.push({ label: 'Vendor', value: item.vendor });
    if (item.trackingNumber) fields.push({ label: 'Reference', value: item.trackingNumber });
    if (item.departureLocation) fields.push({ label: 'From', value: item.departureLocation });
    if (item.arrivalLocation) fields.push({ label: 'To', value: item.arrivalLocation });
    if (item._displayDeparture) fields.push({ label: 'Departure', value: item._displayDeparture });
    if (item._displayArrival) fields.push({ label: 'Arrival', value: item._displayArrival });

    if (type === DETAIL_TYPES.TRAIN) {
      if (item.train?.platform) fields.push({ label: 'Platform', value: item.train.platform });
      if (item.train?.carriageNumber) fields.push({ label: 'Carriage', value: item.train.carriageNumber });
    }
    if (type === DETAIL_TYPES.BUS) {
      if (item.bus?.stopName) fields.push({ label: 'Stop', value: item.bus.stopName });
    }
    if ([DETAIL_TYPES.CRUISE, DETAIL_TYPES.FERRY].includes(type)) {
      const ext = type === DETAIL_TYPES.CRUISE ? item.cruise : item.ferry;
      if (ext?.shipName) fields.push({ label: 'Ship', value: ext.shipName });
      if (ext?.embarkationPort) fields.push({ label: 'Embark', value: ext.embarkationPort });
      if (ext?.disembarkationPort) fields.push({ label: 'Disembark', value: ext.disembarkationPort });
      if (ext?.deck) fields.push({ label: 'Deck', value: ext.deck });
    }

  } else if (type === DETAIL_TYPES.PARKING) {
    if (item.facilityName) fields.push({ label: 'Facility', value: item.facilityName });
    if (item.address) fields.push({ label: 'Address', value: item.address });
    if (item.confirmationNumber) fields.push({ label: 'Confirmation', value: item.confirmationNumber });
    if (item._displayStart) fields.push({ label: 'Start', value: item._displayStart });
    if (item._displayEnd) fields.push({ label: 'End', value: item._displayEnd });

  } else if (type === DETAIL_TYPES.DISCOUNT) {
    if (item.code) fields.push({ label: 'Code', value: item.code, className: 'discountCode' });
    if (item.description) fields.push({ label: 'Description', value: item.description });
    if (item.discountType) fields.push({ label: 'Type', value: item.discountType });
    if (item.discountValue !== undefined && item.discountValue !== null) {
      fields.push({
        label: 'Discount',
        value: `${item.discountValue}${item.isPercentage ? '%' : ''}`
      });
    }
    if (item._displayExpires) fields.push({ label: 'Expires', value: item._displayExpires });
    if (item.source) fields.push({ label: 'Source', value: item.source });
    if (item.discountNotes) fields.push({ label: 'Notes', value: item.discountNotes });
  }

  // Notes field for any type
  if (item.notes) fields.push({ label: 'Notes', value: item.notes });

  return fields;
}
