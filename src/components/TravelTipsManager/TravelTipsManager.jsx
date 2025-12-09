/**
 * TravelTipsManager Component
 * Reusable component for managing travel tips in forms
 * Supports both simple string tips and structured tips with metadata
 */

// Note: Bootstrap imports removed - using custom styled components
import { lang } from '../../lang.constants';
import styles from './TravelTipsManager.module.scss';
import { useState } from 'react';
import { Button } from '../design-system';
import {
  FaLanguage, FaMoneyBillWave, FaBus, FaShieldAlt,
  FaCloudSun, FaHandshake, FaUtensils, FaHotel,
  FaExclamationTriangle, FaThumbtack, FaLightbulb,
  FaGripVertical, FaTrash, FaExternalLinkAlt, FaPlus, FaLink
} from 'react-icons/fa';

const TIP_TYPES = [
  { value: 'Language', icon: '🗣️', faIcon: FaLanguage, label: 'Language', color: '#667eea' },
  { value: 'Currency', icon: '💶', faIcon: FaMoneyBillWave, label: 'Currency', color: '#28a745' },
  { value: 'Transportation', icon: '🚇', faIcon: FaBus, label: 'Transport', color: '#17a2b8' },
  { value: 'Safety', icon: '🛡️', faIcon: FaShieldAlt, label: 'Safety', color: '#ffc107' },
  { value: 'Weather', icon: '🌤️', faIcon: FaCloudSun, label: 'Weather', color: '#6f42c1' },
  { value: 'Culture', icon: '🤝', faIcon: FaHandshake, label: 'Culture', color: '#e83e8c' },
  { value: 'Food', icon: '🍽️', faIcon: FaUtensils, label: 'Food', color: '#fd7e14' },
  { value: 'Accommodation', icon: '🏨', faIcon: FaHotel, label: 'Stay', color: '#20c997' },
  { value: 'Emergency', icon: '🚨', faIcon: FaExclamationTriangle, label: 'Emergency', color: '#dc3545' },
  { value: 'Custom', icon: '📌', faIcon: FaThumbtack, label: 'Custom', color: '#6c757d' }
];

export default function TravelTipsManager({
  tips,
  newTip,
  onNewTipChange,
  // onNewTipKeyPress - deprecated, using onKeyDown instead
  onAddTip,
  onDeleteTip,
  label = "Travel Tips",
  placeholder = "Add a helpful tip...",
  addButtonText = "Add Tip",
  deleteButtonText = "Delete",
  className = "",
  // Enhanced props for structured tips
  mode = 'simple',
  onModeChange,
  structuredTip,
  onStructuredTipFieldChange,
  onCallToActionChange,
  onAddStructuredTip,
  // New prop for reordering
  onReorder
}) {
  const isSimpleMode = mode === 'simple';
  const canAddSimpleTip = newTip?.trim();
  const canAddStructuredTip = structuredTip?.value?.trim();

  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Drag and drop handlers
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();

    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    // Reorder the tips array
    const newTips = [...tips];
    const [draggedItem] = newTips.splice(draggedIndex, 1);
    newTips.splice(dropIndex, 0, draggedItem);

    // Clear drag state first to prevent stale renders
    setDraggedIndex(null);
    setDragOverIndex(null);

    // Call the onReorder callback if provided
    if (onReorder) {
      onReorder(newTips);
    }
  };

  // Generate a stable key for a tip
  const getTipKey = (tip, index) => {
    if (typeof tip === 'string') {
      return `simple-${index}-${tip.substring(0, 20)}`;
    }
    return `structured-${index}-${tip.type}-${(tip.value || '').substring(0, 20)}`;
  };

  const renderTipPreview = (tip, index) => {
    const isDragging = draggedIndex === index;
    const isDragOver = dragOverIndex === index;
    const tipKey = getTipKey(tip, index);

    // Simple string tip
    if (typeof tip === 'string') {
      return (
        <div
          key={tipKey}
          className={`${styles.tipCard} ${styles.tipCardSimple} ${isDragging ? styles.dragging : ''} ${isDragOver ? styles.dragOver : ''}`}
          draggable={!!onReorder}
          onDragStart={(e) => handleDragStart(e, index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDrop={(e) => handleDrop(e, index)}
          onDragEnd={handleDragEnd}
        >
          <div className={styles.tipCardContent}>
            {onReorder && (
              <span className={styles.dragHandle} title="Drag to reorder">
                <FaGripVertical />
              </span>
            )}
            <div className={styles.tipIconSimple}>
              <FaLightbulb />
            </div>
            <span className={styles.tipText}>{tip}</span>
          </div>
          <button
            type="button"
            className={styles.tipDeleteBtn}
            onClick={() => onDeleteTip(index)}
            aria-label={deleteButtonText}
          >
            <FaTrash />
          </button>
        </div>
      );
    }

    // Structured tip
    const { type, category, value, note, exchangeRate, callToAction, icon } = tip;
    const tipType = TIP_TYPES.find(t => t.value === type) || TIP_TYPES[9];
    const displayIcon = icon || tipType.icon;
    const FAIcon = tipType.faIcon;

    return (
      <div
        key={tipKey}
        className={`${styles.tipCard} ${styles.tipCardStructured} ${isDragging ? styles.dragging : ''} ${isDragOver ? styles.dragOver : ''}`}
        draggable={!!onReorder}
        onDragStart={(e) => handleDragStart(e, index)}
        onDragOver={(e) => handleDragOver(e, index)}
        onDrop={(e) => handleDrop(e, index)}
        onDragEnd={handleDragEnd}
        style={{ '--tip-color': tipType.color }}
      >
        <div className={styles.tipCardHeader}>
          {onReorder && (
            <span className={styles.dragHandle} title="Drag to reorder">
              <FaGripVertical />
            </span>
          )}
          <div className={styles.tipIconWrapper} style={{ background: tipType.color }}>
            <span className={styles.tipEmoji}>{displayIcon}</span>
          </div>
          <span className={styles.tipBadge} style={{ background: `${tipType.color}20`, color: tipType.color }}>
            <FAIcon size="0.75em" style={{ marginRight: '4px' }} />
            {category || type}
          </span>
          <button
            type="button"
            className={styles.tipDeleteBtn}
            onClick={() => onDeleteTip(index)}
            aria-label={deleteButtonText}
          >
            <FaTrash />
          </button>
        </div>
        <div className={styles.tipCardBody}>
          <p className={styles.tipValue}>{value}</p>
          {note && <p className={styles.tipNote}>{note}</p>}
          {exchangeRate && type === 'Currency' && (
            <p className={styles.tipExchangeRate}>
              <FaMoneyBillWave size="0.85em" style={{ marginRight: '4px' }} />
              {exchangeRate}
            </p>
          )}
          {callToAction?.url && (
            <a
              href={callToAction.url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.tipCtaLink}
            >
              <FaExternalLinkAlt size="0.75em" />
              {callToAction.label || 'Learn More'}
            </a>
          )}
        </div>
      </div>
    );
  };

  // Get selected type for visual feedback
  const selectedType = TIP_TYPES.find(t => t.value === structuredTip?.type) || TIP_TYPES[0];

  return (
    <div className={`${styles.travelTipsManager} ${className}`}>
      {/* Header with title and mode toggle */}
      <div className={styles.header}>
        <div className={styles.headerText}>
          <h3 className={styles.title}>{label}</h3>
          <p className={styles.subtitle}>{lang.current.helper.travelTipsHelp}</p>
        </div>

        {onModeChange && (
          <div className={styles.modeToggle}>
            <button
              type="button"
              className={`${styles.modeBtn} ${isSimpleMode ? styles.modeBtnActive : ''}`}
              onClick={() => onModeChange('simple')}
            >
              {lang.current.button.quickTip}
            </button>
            <button
              type="button"
              className={`${styles.modeBtn} ${!isSimpleMode ? styles.modeBtnActive : ''}`}
              onClick={() => onModeChange('structured')}
            >
              {lang.current.button.details}
            </button>
          </div>
        )}
      </div>

      {/* Form Container */}
      <div className={styles.formContainer}>
        {isSimpleMode ? (
          // Simple tip input - Clean single-line design
          <div className={styles.simpleForm}>
            <div className={styles.simpleInputWrapper}>
              <FaLightbulb className={styles.inputIcon} />
              <input
                type="text"
                className={styles.simpleInput}
                placeholder={placeholder}
                value={newTip}
                onChange={onNewTipChange}
                onKeyDown={(e) => e.key === 'Enter' && canAddSimpleTip && onAddTip()}
              />
            </div>
            <Button
              variant="gradient"
              size="sm"
              onClick={onAddTip}
              disabled={!canAddSimpleTip}
              className={styles.addBtn}
            >
              <FaPlus size="0.85em" />
              {addButtonText}
            </Button>
          </div>
        ) : (
          // Structured tip form - Modern card-based layout
          <div className={styles.structuredForm}>
            {/* Type Selection Grid */}
            <div className={styles.formSection}>
              <label className={styles.formLabel}>
                {lang.current.label.travelTipsType} <span className={styles.required}>*</span>
              </label>
              <div className={styles.typeGrid}>
                {TIP_TYPES.map(type => {
                  const isSelected = structuredTip?.type === type.value;
                  return (
                    <button
                      key={type.value}
                      type="button"
                      className={`${styles.typeBtn} ${isSelected ? styles.typeBtnSelected : ''}`}
                      onClick={() => onStructuredTipFieldChange('type', type.value)}
                      style={{
                        '--type-color': type.color,
                        '--type-bg': `${type.color}15`
                      }}
                    >
                      <span className={styles.typeIcon}>{type.icon}</span>
                      <span className={styles.typeLabel}>{type.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Category (only for Custom type) */}
            {structuredTip?.type === 'Custom' && (
              <div className={styles.formSection}>
                <label className={styles.formLabel}>{lang.current.label.travelTipsCategory}</label>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder={lang.current.placeholder.travelTipCategory}
                  value={structuredTip?.category || ''}
                  onChange={(e) => onStructuredTipFieldChange('category', e.target.value)}
                />
              </div>
            )}

            {/* Main Content */}
            <div className={styles.formSection}>
              <label className={styles.formLabel}>
                {lang.current.label.travelTipsDescription} <span className={styles.required}>*</span>
              </label>
              <input
                type="text"
                className={styles.formInput}
                placeholder={lang.current.placeholder.travelTipDescription}
                value={structuredTip?.value || ''}
                onChange={(e) => onStructuredTipFieldChange('value', e.target.value)}
              />
            </div>

            {/* Additional Notes */}
            <div className={styles.formSection}>
              <label className={styles.formLabel}>{lang.current.label.travelTipsAdditionalNote}</label>
              <textarea
                className={styles.formTextarea}
                rows={2}
                placeholder={lang.current.placeholder.travelTipNote}
                value={structuredTip?.note || ''}
                onChange={(e) => onStructuredTipFieldChange('note', e.target.value)}
              />
            </div>

            {/* Exchange Rate (Currency only) */}
            {structuredTip?.type === 'Currency' && (
              <div className={styles.formSection}>
                <label className={styles.formLabel}>
                  <FaMoneyBillWave size="0.85em" style={{ marginRight: '6px' }} />
                  {lang.current.label.travelTipsExchangeRate}
                </label>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder={lang.current.placeholder.travelTipExchangeRate}
                  value={structuredTip?.exchangeRate || ''}
                  onChange={(e) => onStructuredTipFieldChange('exchangeRate', e.target.value)}
                />
              </div>
            )}

            {/* Custom Icon */}
            <div className={styles.formSection}>
              <label className={styles.formLabel}>{lang.current.label.travelTipsIcon}</label>
              <div className={styles.iconInputWrapper}>
                <input
                  type="text"
                  className={styles.formInputSmall}
                  placeholder={lang.current.placeholder.travelTipIcon}
                  value={structuredTip?.icon || ''}
                  onChange={(e) => onStructuredTipFieldChange('icon', e.target.value)}
                  maxLength={2}
                />
                <span className={styles.iconPreview}>
                  {structuredTip?.icon || selectedType.icon}
                </span>
              </div>
              <span className={styles.formHelper}>{lang.current.helper.travelTipsIconHelp}</span>
            </div>

            {/* Call to Action */}
            <div className={styles.ctaSection}>
              <label className={styles.formLabel}>
                <FaLink size="0.85em" style={{ marginRight: '6px' }} />
                {lang.current.label.travelTipsCallToAction}
              </label>
              <div className={styles.ctaInputs}>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder={lang.current.placeholder.travelTipCtaLabel}
                  value={structuredTip?.callToAction?.label || ''}
                  onChange={(e) => onCallToActionChange('label', e.target.value)}
                />
                <input
                  type="url"
                  className={styles.formInput}
                  placeholder={lang.current.placeholder.travelTipCtaUrl}
                  value={structuredTip?.callToAction?.url || ''}
                  onChange={(e) => onCallToActionChange('url', e.target.value)}
                />
              </div>
              <span className={styles.formHelper}>{lang.current.helper.travelTipsCtaHelp}</span>
            </div>

            {/* Add Button */}
            <div className={styles.formActions}>
              <Button
                variant="gradient"
                size="sm"
                onClick={onAddStructuredTip}
                disabled={!canAddStructuredTip}
                className={styles.addBtn}
              >
                <FaPlus size="0.85em" />
                {addButtonText}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Tips List */}
      {tips && tips.length > 0 && (
        <div className={styles.tipsList}>
          {tips.map((tip, index) => renderTipPreview(tip, index))}
        </div>
      )}
    </div>
  );
}
