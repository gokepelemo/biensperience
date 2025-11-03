/**
 * TravelTipsManager Component
 * Reusable component for managing travel tips in forms
 * Supports both simple string tips and structured tips with metadata
 */

import { Form, Button, ListGroup, Badge, ButtonGroup, Row, Col } from 'react-bootstrap';
import { lang } from '../../lang.constants';
import './TravelTipsManager.css';
import { useState } from 'react';

const TIP_TYPES = [
  { value: 'Language', icon: '🗣️', label: 'Language' },
  { value: 'Currency', icon: '💶', label: 'Currency' },
  { value: 'Transportation', icon: '🚇', label: 'Transportation' },
  { value: 'Safety', icon: '🛡️', label: 'Safety' },
  { value: 'Weather', icon: '🌤️', label: 'Weather' },
  { value: 'Culture', icon: '🤝', label: 'Culture' },
  { value: 'Food', icon: '🍽️', label: 'Food & Drink' },
  { value: 'Accommodation', icon: '🏨', label: 'Accommodation' },
  { value: 'Emergency', icon: '🚨', label: 'Emergency' },
  { value: 'Custom', icon: '📌', label: 'Custom' }
];

export default function TravelTipsManager({
  tips,
  newTip,
  onNewTipChange,
  onNewTipKeyPress,
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
      return;
    }

    // Reorder the tips array
    const newTips = [...tips];
    const [draggedItem] = newTips.splice(draggedIndex, 1);
    newTips.splice(dropIndex, 0, draggedItem);

    // Call the onReorder callback if provided
    if (onReorder) {
      onReorder(newTips);
    }

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const renderTipPreview = (tip, index) => {
    const isDragging = draggedIndex === index;
    const isDragOver = dragOverIndex === index;
    
    // Simple string tip
    if (typeof tip === 'string') {
      return (
        <ListGroup.Item
          key={index}
          className={`d-flex justify-content-between align-items-center ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
          draggable={!!onReorder}
          onDragStart={(e) => handleDragStart(e, index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDrop={(e) => handleDrop(e, index)}
          onDragEnd={handleDragEnd}
        >
          <div className="d-flex align-items-center gap-2">
            {onReorder && <span className="drag-handle" title="Drag to reorder travel tips">⋮⋮</span>}
            <span>💡</span>
            <span>{tip}</span>
          </div>
          <Button
            variant="outline-danger"
            size="sm"
            onClick={() => onDeleteTip(index)}
          >
            {deleteButtonText}
          </Button>
        </ListGroup.Item>
      );
    }

    // Structured tip
    const { type, category, value, note, exchangeRate, callToAction, icon } = tip;
    const tipType = TIP_TYPES.find(t => t.value === type) || TIP_TYPES[9];
    const displayIcon = icon || tipType.icon;

    return (
      <ListGroup.Item 
        key={index} 
        className={`structured-tip-preview ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
        draggable={!!onReorder}
        onDragStart={(e) => handleDragStart(e, index)}
        onDragOver={(e) => handleDragOver(e, index)}
        onDrop={(e) => handleDrop(e, index)}
        onDragEnd={handleDragEnd}
      >
        <div className="d-flex justify-content-between align-items-start">
          <div className="flex-grow-1">
            <div className="d-flex align-items-center gap-2 mb-2">
              {onReorder && <span className="drag-handle" title="Drag to reorder travel tips">⋮⋮</span>}
              <span>{displayIcon}</span>
              <Badge className="badge badge-primary">{category || type}</Badge>
            </div>
            <div className="mb-1"><strong>{value}</strong></div>
            {note && <div className="text-muted small mb-1">{note}</div>}
            {exchangeRate && type === 'Currency' && (
              <div className="text-muted small mb-1">{exchangeRate}</div>
            )}
            {callToAction?.url && (
              <div className="mt-2">
                <Button
                  href={callToAction.url}
                  target="_blank"
                  variant="outline-primary"
                  size="sm"
                >
                  {callToAction.label || 'Learn More'} →
                </Button>
              </div>
            )}
          </div>
          <Button
            variant="outline-danger"
            size="sm"
            onClick={() => onDeleteTip(index)}
          >
            {deleteButtonText}
          </Button>
        </div>
      </ListGroup.Item>
    );
  };

  return (
    <div className={className}>
      <Form.Group className="mb-3">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <div className="flex-grow-1">
            <Form.Label className="mb-1">{label}</Form.Label>
            <div className="travel-tips-helper">
              {lang.en.helper.travelTipsHelp}
            </div>
          </div>

          {onModeChange && (
            <ButtonGroup size="sm" className="ms-3 flex-shrink-0">
              <Button
                variant={isSimpleMode ? 'primary' : 'outline-secondary'}
                onClick={() => onModeChange('simple')}
              >
                {lang.en.button.quickTip}
              </Button>
              <Button
                variant={!isSimpleMode ? 'primary' : 'outline-secondary'}
                onClick={() => onModeChange('structured')}
              >
                {lang.en.button.details}
              </Button>
            </ButtonGroup>
          )}
        </div>

        {isSimpleMode ? (
          // Simple tip input
          <div className="d-flex gap-2">
            <Form.Control
              type="text"
              placeholder={placeholder}
              value={newTip}
              onChange={onNewTipChange}
              onKeyPress={onNewTipKeyPress}
            />
            <Button
              variant="outline-primary"
              onClick={onAddTip}
              disabled={!canAddSimpleTip}
            >
              {addButtonText}
            </Button>
          </div>
        ) : (
          // Structured tip form
          <div className="structured-tip-form">
            <Row className="mb-3">
              <Col md={6}>
                <Form.Label>{lang.en.label.travelTipsType} *</Form.Label>
                <Form.Select
                  value={structuredTip?.type || 'Language'}
                  onChange={(e) => onStructuredTipFieldChange('type', e.target.value)}
                >
                  {TIP_TYPES.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.icon} {type.label}
                    </option>
                  ))}
                </Form.Select>
              </Col>

              {structuredTip?.type === 'Custom' && (
                <Col md={6}>
                  <Form.Label>{lang.en.label.travelTipsCategory}</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder={lang.en.placeholder.travelTipCategory}
                    value={structuredTip?.category || ''}
                    onChange={(e) => onStructuredTipFieldChange('category', e.target.value)}
                  />
                </Col>
              )}
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>{lang.en.label.travelTipsDescription} *</Form.Label>
              <Form.Control
                type="text"
                placeholder={lang.en.placeholder.travelTipDescription}
                value={structuredTip?.value || ''}
                onChange={(e) => onStructuredTipFieldChange('value', e.target.value)}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>{lang.en.label.travelTipsAdditionalNote}</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                placeholder={lang.en.placeholder.travelTipNote}
                value={structuredTip?.note || ''}
                onChange={(e) => onStructuredTipFieldChange('note', e.target.value)}
              />
            </Form.Group>

            {structuredTip?.type === 'Currency' && (
              <Form.Group className="mb-3">
                <Form.Label>{lang.en.label.travelTipsExchangeRate}</Form.Label>
                <Form.Control
                  type="text"
                  placeholder={lang.en.placeholder.travelTipExchangeRate}
                  value={structuredTip?.exchangeRate || ''}
                  onChange={(e) => onStructuredTipFieldChange('exchangeRate', e.target.value)}
                />
              </Form.Group>
            )}

            <Form.Group className="mb-3">
              <Form.Label>{lang.en.label.travelTipsIcon}</Form.Label>
              <Form.Control
                type="text"
                placeholder={lang.en.placeholder.travelTipIcon}
                value={structuredTip?.icon || ''}
                onChange={(e) => onStructuredTipFieldChange('icon', e.target.value)}
                maxLength={2}
              />
              <Form.Text className="text-muted">
                {lang.en.helper.travelTipsIconHelp}
              </Form.Text>
            </Form.Group>

            <div className="border rounded p-3 mb-3" style={{ backgroundColor: '#f8f9fa' }}>
              <Form.Label>{lang.en.label.travelTipsCallToAction}</Form.Label>
              <Row>
                <Col md={6}>
                  <Form.Control
                    type="text"
                    placeholder={lang.en.placeholder.travelTipCtaLabel}
                    value={structuredTip?.callToAction?.label || ''}
                    onChange={(e) => onCallToActionChange('label', e.target.value)}
                    className="mb-2 mb-md-0"
                  />
                </Col>
                <Col md={6}>
                  <Form.Control
                    type="url"
                    placeholder={lang.en.placeholder.travelTipCtaUrl}
                    value={structuredTip?.callToAction?.url || ''}
                    onChange={(e) => onCallToActionChange('url', e.target.value)}
                  />
                </Col>
              </Row>
              <Form.Text className="text-muted">
                {lang.en.helper.travelTipsCtaHelp}
              </Form.Text>
            </div>

            <div className="d-flex justify-content-end">
              <Button
                variant="outline-primary"
                onClick={onAddStructuredTip}
                disabled={!canAddStructuredTip}
              >
                {addButtonText}
              </Button>
            </div>
          </div>
        )}
      </Form.Group>

      {tips && tips.length > 0 && (
        <ListGroup className="mb-3">
          {tips.map((tip, index) => renderTipPreview(tip, index))}
        </ListGroup>
      )}
    </div>
  );
}
