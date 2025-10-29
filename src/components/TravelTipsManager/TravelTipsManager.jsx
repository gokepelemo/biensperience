/**
 * TravelTipsManager Component
 * Reusable component for managing travel tips in forms
 * Supports both simple string tips and structured tips with metadata
 */

import { Form, Button, ListGroup, Badge, ButtonGroup, Row, Col } from 'react-bootstrap';
import FormTooltip from '../Tooltip/Tooltip';
import './TravelTipsManager.css';

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
  onAddStructuredTip
}) {
  const isSimpleMode = mode === 'simple';
  const canAddSimpleTip = newTip?.trim();
  const canAddStructuredTip = structuredTip?.value?.trim();

  const renderTipPreview = (tip, index) => {
    // Simple string tip
    if (typeof tip === 'string') {
      return (
        <ListGroup.Item
          key={index}
          className="d-flex justify-content-between align-items-center"
        >
          <div className="d-flex align-items-center gap-2">
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
      <ListGroup.Item key={index} className="structured-tip-preview">
        <div className="d-flex justify-content-between align-items-start">
          <div className="flex-grow-1">
            <div className="d-flex align-items-center gap-2 mb-2">
              <span>{displayIcon}</span>
              <Badge bg="primary">{category || type}</Badge>
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
        <div className="d-flex justify-content-between align-items-start mb-2">
          <div className="flex-grow-1">
            <Form.Label className="mb-1">{label}</Form.Label>
            <div className="text-muted small">
              Add helpful tips for travelers. Choose simple tips for quick notes, or structured tips with detailed information and links.
            </div>
          </div>

          {onModeChange && (
            <ButtonGroup size="sm" className="ms-3 flex-shrink-0">
              <Button
                variant={isSimpleMode ? 'primary' : 'outline-secondary'}
                onClick={() => onModeChange('simple')}
              >
                💡 Quick Tip
              </Button>
              <Button
                variant={!isSimpleMode ? 'primary' : 'outline-secondary'}
                onClick={() => onModeChange('structured')}
              >
                📋 Details
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
                <Form.Label>Type *</Form.Label>
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
                  <Form.Label>Category</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="e.g., Shopping, Nightlife"
                    value={structuredTip?.category || ''}
                    onChange={(e) => onStructuredTipFieldChange('category', e.target.value)}
                  />
                </Col>
              )}
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>Description *</Form.Label>
              <Form.Control
                type="text"
                placeholder="Main tip content (required)"
                value={structuredTip?.value || ''}
                onChange={(e) => onStructuredTipFieldChange('value', e.target.value)}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Additional Note</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                placeholder="Optional additional details or context"
                value={structuredTip?.note || ''}
                onChange={(e) => onStructuredTipFieldChange('note', e.target.value)}
              />
            </Form.Group>

            {structuredTip?.type === 'Currency' && (
              <Form.Group className="mb-3">
                <Form.Label>Exchange Rate Info</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="e.g., 1 USD = 0.85 EUR (as of Jan 2025)"
                  value={structuredTip?.exchangeRate || ''}
                  onChange={(e) => onStructuredTipFieldChange('exchangeRate', e.target.value)}
                />
              </Form.Group>
            )}

            <Form.Group className="mb-3">
              <Form.Label>Icon (Optional)</Form.Label>
              <Form.Control
                type="text"
                placeholder="Custom emoji or icon (optional)"
                value={structuredTip?.icon || ''}
                onChange={(e) => onStructuredTipFieldChange('icon', e.target.value)}
                maxLength={2}
              />
              <Form.Text className="text-muted">
                Leave blank to use default icon for this type
              </Form.Text>
            </Form.Group>

            <div className="border rounded p-3 mb-3" style={{ backgroundColor: '#f8f9fa' }}>
              <Form.Label>Call-to-Action (Optional)</Form.Label>
              <Row>
                <Col md={6}>
                  <Form.Control
                    type="text"
                    placeholder="Button text (e.g., 'Book Now')"
                    value={structuredTip?.callToAction?.label || ''}
                    onChange={(e) => onCallToActionChange('label', e.target.value)}
                    className="mb-2 mb-md-0"
                  />
                </Col>
                <Col md={6}>
                  <Form.Control
                    type="url"
                    placeholder="https://example.com"
                    value={structuredTip?.callToAction?.url || ''}
                    onChange={(e) => onCallToActionChange('url', e.target.value)}
                  />
                </Col>
              </Row>
              <Form.Text className="text-muted">
                Add a button with a link for more information
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
