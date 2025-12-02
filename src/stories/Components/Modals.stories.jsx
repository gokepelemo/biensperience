/**
 * Modal Components - Consolidated Stories
 *
 * Combined from:
 * - src/stories/ModalLayouts.stories.jsx (9 modal patterns)
 * - src/stories/Components/Modal.stories.jsx (Basic modal component)
 *
 * Modal layout patterns for travel planning use cases.
 * All modals support dark mode and use design tokens.
 */

import React, { useState } from 'react';
import { Modal, Button, Form, Alert, ListGroup, Badge, Container } from 'react-bootstrap';
import {
  FaCheckCircle,
  FaExclamationTriangle,
  FaInfoCircle,
  FaTimes,
  FaTrash,
  FaUser,
  FaEnvelope,
  FaLock,
  FaUpload,
  FaMapMarkerAlt,
  FaPlane,
  FaCalendarAlt,
  FaUsers,
  FaHeart,
  FaSuitcase,
  FaCreditCard,
} from 'react-icons/fa';

export default {
  title: 'Components/Modals/Modal Patterns',
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
Modal patterns for the Biensperience travel planning platform.

**Modal Types:**
- 📝 Form Modals - Create/edit experiences and destinations
- ✅ Confirmation Modals - Confirm actions before proceeding
- 🗑️ Delete Modals - Destructive action warnings
- 📋 Selection Modals - Pick from lists of options
- 📷 Upload Modals - File and photo uploads
- ✨ Success Modals - Celebration and completion
- ℹ️ Info Modals - Detail views and information
- 📊 Multi-Step Modals - Wizard workflows
- 📱 Mobile Modals - Responsive mobile-first patterns

**Features:**
- 🌙 Full dark mode support
- 🎨 Design token integration
- ♿ Accessible with keyboard navigation
        `,
      },
    },
  },
};

// ============================================================
// CONFIRMATION MODALS
// ============================================================

export const Confirmation = {
  render: () => {
    const [show, setShow] = useState(false);

    return (
      <>
        <Button variant="primary" onClick={() => setShow(true)}>
          Show Confirmation Modal
        </Button>

        <Modal
          show={show}
          onHide={() => setShow(false)}
          centered
          style={{ '--bs-modal-bg': 'var(--color-bg-primary)' }}
        >
          <Modal.Header closeButton style={modalHeaderStyle}>
            <Modal.Title style={modalTitleStyle}>
              Confirm Action
            </Modal.Title>
          </Modal.Header>
          <Modal.Body style={modalBodyStyle}>
            <p style={modalTextStyle}>
              Are you sure you want to proceed with this action? This cannot be undone.
            </p>
          </Modal.Body>
          <Modal.Footer style={modalFooterStyle}>
            <Button variant="outline-secondary" onClick={() => setShow(false)} style={buttonStyle}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => setShow(false)} style={buttonStyle}>
              Confirm
            </Button>
          </Modal.Footer>
        </Modal>
      </>
    );
  },
};

export const DeleteConfirmation = {
  render: () => {
    const [show, setShow] = useState(false);

    return (
      <>
        <Button variant="danger" onClick={() => setShow(true)}>
          Show Delete Modal
        </Button>

        <Modal show={show} onHide={() => setShow(false)} centered>
          <Modal.Header closeButton style={modalHeaderStyle}>
            <Modal.Title style={{
              ...modalTitleStyle,
              color: 'var(--color-danger)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
            }}>
              <FaExclamationTriangle /> Delete Trip?
            </Modal.Title>
          </Modal.Header>
          <Modal.Body style={modalBodyStyle}>
            <Alert variant="danger" style={{ marginBottom: 'var(--space-4)', borderRadius: 'var(--radius-md)' }}>
              <FaExclamationTriangle style={{ marginRight: 'var(--space-2)' }} />
              This action cannot be undone!
            </Alert>
            <p style={modalTextStyle}>
              You are about to permanently delete <strong>"Tokyo Cherry Blossom Adventure"</strong>.
            </p>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-3)' }}>
              This will also delete:
            </p>
            <ul style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', paddingLeft: 'var(--space-6)' }}>
              <li>All plan items (12 items)</li>
              <li>Associated photos (8 photos)</li>
              <li>Collaborator access</li>
            </ul>
          </Modal.Body>
          <Modal.Footer style={modalFooterStyle}>
            <Button variant="outline-secondary" onClick={() => setShow(false)} style={buttonStyle}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => setShow(false)} style={{ ...buttonStyle, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <FaTrash /> Delete Permanently
            </Button>
          </Modal.Footer>
        </Modal>
      </>
    );
  },
};

// ============================================================
// FORM MODALS
// ============================================================

export const FormModal = {
  render: () => {
    const [show, setShow] = useState(false);

    return (
      <>
        <Button variant="primary" onClick={() => setShow(true)}>
          Show Form Modal
        </Button>

        <Modal show={show} onHide={() => setShow(false)} size="lg" centered>
          <Modal.Header closeButton style={modalHeaderStyle}>
            <Modal.Title style={modalTitleStyle}>
              Create New Experience
            </Modal.Title>
          </Modal.Header>
          <Modal.Body style={modalBodyStyle}>
            <Form>
              <Form.Group className="mb-4">
                <Form.Label style={labelStyle}>Experience Name *</Form.Label>
                <Form.Control type="text" placeholder="e.g., Cherry Blossom Festival in Kyoto" style={inputStyle} />
              </Form.Group>

              <Form.Group className="mb-4">
                <Form.Label style={labelStyle}>Destination *</Form.Label>
                <Form.Select style={inputStyle}>
                  <option>Select a destination</option>
                  <option>Tokyo, Japan</option>
                  <option>Paris, France</option>
                  <option>New York, USA</option>
                  <option>Sydney, Australia</option>
                </Form.Select>
              </Form.Group>

              <Form.Group className="mb-4">
                <Form.Label style={labelStyle}>Description</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={4}
                  placeholder="Describe this travel experience..."
                  style={inputStyle}
                />
              </Form.Group>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <Form.Group>
                  <Form.Label style={labelStyle}>Estimated Cost</Form.Label>
                  <Form.Control type="number" placeholder="$0.00" style={inputStyle} />
                </Form.Group>
                <Form.Group>
                  <Form.Label style={labelStyle}>Duration (Days)</Form.Label>
                  <Form.Control type="number" placeholder="e.g., 7" style={inputStyle} />
                </Form.Group>
              </div>
            </Form>
          </Modal.Body>
          <Modal.Footer style={modalFooterStyle}>
            <Button variant="outline-secondary" onClick={() => setShow(false)} style={buttonStyle}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => setShow(false)} style={buttonStyle}>
              Create Experience
            </Button>
          </Modal.Footer>
        </Modal>
      </>
    );
  },
};

// ============================================================
// SELECTION MODALS
// ============================================================

export const SelectionList = {
  render: () => {
    const [show, setShow] = useState(false);
    const [selected, setSelected] = useState(null);

    const destinations = [
      { id: 1, name: 'Tokyo, Japan', country: 'Japan', experiences: 89, emoji: '🗾' },
      { id: 2, name: 'Paris, France', country: 'France', experiences: 124, emoji: '🗼' },
      { id: 3, name: 'New York, USA', country: 'United States', experiences: 156, emoji: '🗽' },
      { id: 4, name: 'London, UK', country: 'United Kingdom', experiences: 98, emoji: '🎡' },
      { id: 5, name: 'Sydney, Australia', country: 'Australia', experiences: 67, emoji: '🌊' },
    ];

    return (
      <>
        <Button variant="primary" onClick={() => setShow(true)}>
          Select Destination
        </Button>

        <Modal show={show} onHide={() => setShow(false)} size="lg" centered>
          <Modal.Header closeButton style={modalHeaderStyle}>
            <Modal.Title style={modalTitleStyle}>
              <FaMapMarkerAlt style={{ marginRight: 'var(--space-2)', color: 'var(--color-primary)' }} />
              Select Destination
            </Modal.Title>
          </Modal.Header>
          <Modal.Body style={modalBodyStyle}>
            <Form.Control
              type="text"
              placeholder="Search destinations..."
              style={{ ...inputStyle, marginBottom: 'var(--space-4)' }}
            />

            <ListGroup>
              {destinations.map(dest => (
                <ListGroup.Item
                  key={dest.id}
                  action
                  active={selected === dest.id}
                  onClick={() => setSelected(dest.id)}
                  style={{
                    borderRadius: 'var(--radius-md)',
                    marginBottom: 'var(--space-2)',
                    cursor: 'pointer',
                    border: selected === dest.id
                      ? '2px solid var(--color-primary)'
                      : '1px solid var(--color-border-light)',
                    backgroundColor: selected === dest.id
                      ? 'var(--color-primary-light)'
                      : 'var(--color-bg-primary)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                      <span style={{ fontSize: 'var(--font-size-2xl)' }}>{dest.emoji}</span>
                      <div>
                        <div style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)' }}>
                          {dest.name}
                        </div>
                        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                          {dest.country}
                        </div>
                      </div>
                    </div>
                    <Badge bg="secondary" pill style={{ padding: 'var(--space-2) var(--space-3)' }}>
                      {dest.experiences} experiences
                    </Badge>
                  </div>
                </ListGroup.Item>
              ))}
            </ListGroup>
          </Modal.Body>
          <Modal.Footer style={modalFooterStyle}>
            <Button variant="outline-secondary" onClick={() => setShow(false)} style={buttonStyle}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => setShow(false)} disabled={!selected} style={buttonStyle}>
              Select Destination
            </Button>
          </Modal.Footer>
        </Modal>
      </>
    );
  },
};

// ============================================================
// UPLOAD MODALS
// ============================================================

export const PhotoUpload = {
  render: () => {
    const [show, setShow] = useState(false);

    return (
      <>
        <Button variant="primary" onClick={() => setShow(true)}>
          Upload Photo
        </Button>

        <Modal show={show} onHide={() => setShow(false)} size="lg" centered>
          <Modal.Header closeButton style={modalHeaderStyle}>
            <Modal.Title style={modalTitleStyle}>
              Upload Travel Photo
            </Modal.Title>
          </Modal.Header>
          <Modal.Body style={modalBodyStyle}>
            <div style={{
              border: '2px dashed var(--color-border-medium)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-10)',
              textAlign: 'center',
              backgroundColor: 'var(--color-bg-secondary)',
              cursor: 'pointer',
              marginBottom: 'var(--space-4)',
            }}>
              <FaUpload style={{
                fontSize: 'var(--font-size-4xl)',
                color: 'var(--color-primary)',
                marginBottom: 'var(--space-4)',
              }} />
              <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>
                Drop your travel photos here or click to browse
              </p>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                Supports: JPG, PNG, GIF (Max 5MB)
              </p>
            </div>

            <Form.Group className="mb-4">
              <Form.Label style={labelStyle}>Caption (Optional)</Form.Label>
              <Form.Control type="text" placeholder="Add a caption for your photo..." style={inputStyle} />
            </Form.Group>

            <Form.Group>
              <Form.Label style={labelStyle}>Alt Text (For Accessibility)</Form.Label>
              <Form.Control type="text" placeholder="Describe the image..." style={inputStyle} />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer style={modalFooterStyle}>
            <Button variant="outline-secondary" onClick={() => setShow(false)} style={buttonStyle}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => setShow(false)} style={buttonStyle}>
              <FaUpload style={{ marginRight: 'var(--space-2)' }} />
              Upload Photo
            </Button>
          </Modal.Footer>
        </Modal>
      </>
    );
  },
};

// ============================================================
// SUCCESS MODALS
// ============================================================

export const Success = {
  render: () => {
    const [show, setShow] = useState(false);

    return (
      <>
        <Button variant="success" onClick={() => setShow(true)}>
          Show Success Modal
        </Button>

        <Modal show={show} onHide={() => setShow(false)} centered>
          <Modal.Body style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--color-success-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto var(--space-6)',
            }}>
              <FaCheckCircle style={{ fontSize: 'var(--font-size-4xl)', color: 'var(--color-success)' }} />
            </div>
            <h2 style={{
              fontSize: 'var(--font-size-2xl)',
              fontWeight: 'var(--font-weight-bold)',
              color: 'var(--color-text-primary)',
              marginBottom: 'var(--space-3)',
            }}>
              Trip Booked!
            </h2>
            <p style={{
              fontSize: 'var(--font-size-base)',
              color: 'var(--color-text-secondary)',
              marginBottom: 'var(--space-6)',
              lineHeight: 'var(--line-height-relaxed)',
            }}>
              Your Tokyo Cherry Blossom Adventure has been booked! Check your email for confirmation and itinerary details.
            </p>
            <Button
              variant="primary"
              onClick={() => setShow(false)}
              style={{
                borderRadius: 'var(--radius-full)',
                padding: 'var(--space-3) var(--space-8)',
                fontWeight: 'var(--font-weight-semibold)',
              }}
            >
              View My Trips
            </Button>
          </Modal.Body>
        </Modal>
      </>
    );
  },
};

// ============================================================
// INFO MODALS
// ============================================================

export const ExperienceDetails = {
  render: () => {
    const [show, setShow] = useState(false);

    return (
      <>
        <Button variant="info" onClick={() => setShow(true)}>
          View Experience Details
        </Button>

        <Modal show={show} onHide={() => setShow(false)} size="lg" centered>
          <Modal.Header closeButton style={modalHeaderStyle}>
            <Modal.Title style={{ ...modalTitleStyle, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <FaInfoCircle style={{ color: 'var(--color-info)' }} />
              Experience Details
            </Modal.Title>
          </Modal.Header>
          <Modal.Body style={modalBodyStyle}>
            <div style={{
              height: '200px',
              background: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 50%, #fecfef 100%)',
              borderRadius: 'var(--radius-lg)',
              marginBottom: 'var(--space-4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 'var(--font-size-4xl)',
            }}>
              🌸
            </div>

            <h3 style={{
              fontSize: 'var(--font-size-xl)',
              fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--color-text-primary)',
              marginBottom: 'var(--space-3)',
            }}>
              Cherry Blossom Festival in Ueno Park
            </h3>

            <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
              <Badge bg="secondary" style={{ padding: 'var(--space-2) var(--space-3)' }}>Nature</Badge>
              <Badge bg="secondary" style={{ padding: 'var(--space-2) var(--space-3)' }}>Culture</Badge>
              <Badge bg="secondary" style={{ padding: 'var(--space-2) var(--space-3)' }}>Photography</Badge>
            </div>

            <p style={modalTextStyle}>
              Join locals for hanami (flower viewing) under the stunning cherry blossoms in one of Tokyo's most beloved parks. This seasonal experience offers breathtaking views and cultural immersion.
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 'var(--space-4)',
              padding: 'var(--space-4)',
              backgroundColor: 'var(--color-bg-secondary)',
              borderRadius: 'var(--radius-md)',
              marginTop: 'var(--space-4)',
            }}>
              <div>
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>Difficulty</div>
                <div style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)' }}>Easy</div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>Duration</div>
                <div style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)' }}>3-4 hours</div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>Cost</div>
                <div style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)' }}>$50</div>
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer style={{ ...modalFooterStyle, justifyContent: 'space-between' }}>
            <Button variant="outline-secondary" onClick={() => setShow(false)} style={buttonStyle}>
              Close
            </Button>
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <Button variant="outline-primary" style={buttonStyle}>
                <FaHeart style={{ marginRight: 'var(--space-2)' }} />
                Save
              </Button>
              <Button variant="primary" style={buttonStyle}>
                <FaPlane style={{ marginRight: 'var(--space-2)' }} />
                Plan This
              </Button>
            </div>
          </Modal.Footer>
        </Modal>
      </>
    );
  },
};

// ============================================================
// MULTI-STEP MODALS
// ============================================================

export const MultiStep = {
  render: () => {
    const [show, setShow] = useState(false);
    const [step, setStep] = useState(1);

    const handleNext = () => setStep(step + 1);
    const handlePrev = () => setStep(step - 1);
    const handleClose = () => { setShow(false); setStep(1); };

    return (
      <>
        <Button variant="primary" onClick={() => setShow(true)}>
          Plan New Trip (Multi-Step)
        </Button>

        <Modal show={show} onHide={handleClose} size="lg" centered>
          <Modal.Header closeButton style={modalHeaderStyle}>
            <Modal.Title style={modalTitleStyle}>
              <FaSuitcase style={{ marginRight: 'var(--space-2)', color: 'var(--color-primary)' }} />
              Plan Your Trip - Step {step} of 3
            </Modal.Title>
          </Modal.Header>

          {/* Progress Bar */}
          <div style={{ height: '4px', backgroundColor: 'var(--color-border-light)' }}>
            <div style={{
              height: '100%',
              width: `${(step / 3) * 100}%`,
              background: 'var(--gradient-primary)',
              transition: 'var(--transition-normal)',
            }} />
          </div>

          <Modal.Body style={modalBodyStyle}>
            {step === 1 && (
              <div>
                <h4 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)' }}>
                  📍 Where are you going?
                </h4>
                <Form>
                  <Form.Group className="mb-4">
                    <Form.Label style={labelStyle}>Destination</Form.Label>
                    <Form.Select style={inputStyle}>
                      <option>Select destination</option>
                      <option>Tokyo, Japan</option>
                      <option>Paris, France</option>
                      <option>Barcelona, Spain</option>
                    </Form.Select>
                  </Form.Group>
                  <Form.Group>
                    <Form.Label style={labelStyle}>Trip Name</Form.Label>
                    <Form.Control type="text" placeholder="e.g., Spring Adventure 2025" style={inputStyle} />
                  </Form.Group>
                </Form>
              </div>
            )}

            {step === 2 && (
              <div>
                <h4 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)' }}>
                  📅 When are you traveling?
                </h4>
                <Form>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                    <Form.Group>
                      <Form.Label style={labelStyle}>Start Date</Form.Label>
                      <Form.Control type="date" style={inputStyle} />
                    </Form.Group>
                    <Form.Group>
                      <Form.Label style={labelStyle}>End Date</Form.Label>
                      <Form.Control type="date" style={inputStyle} />
                    </Form.Group>
                  </div>
                </Form>
              </div>
            )}

            {step === 3 && (
              <div>
                <h4 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)' }}>
                  👥 Who's joining?
                </h4>
                <Form>
                  <Form.Group className="mb-4">
                    <Form.Label style={labelStyle}>Invite Collaborators (Email)</Form.Label>
                    <Form.Control type="email" placeholder="friend@example.com" style={inputStyle} />
                  </Form.Group>
                  <Form.Group>
                    <Form.Check type="checkbox" label="Share trip updates with collaborators" />
                    <Form.Check type="checkbox" label="Allow collaborators to edit plan" />
                  </Form.Group>
                </Form>
              </div>
            )}
          </Modal.Body>

          <Modal.Footer style={{ ...modalFooterStyle, justifyContent: 'space-between' }}>
            <Button variant="outline-secondary" onClick={step === 1 ? handleClose : handlePrev} style={buttonStyle}>
              {step === 1 ? 'Cancel' : 'Previous'}
            </Button>
            <Button variant="primary" onClick={step === 3 ? handleClose : handleNext} style={buttonStyle}>
              {step === 3 ? 'Create Trip' : 'Next'}
            </Button>
          </Modal.Footer>
        </Modal>
      </>
    );
  },
};

// ============================================================
// MOBILE-FIRST MODALS
// ============================================================

export const MobileBooking = {
  render: () => {
    const [show, setShow] = useState(false);

    return (
      <div style={{ maxWidth: '428px', margin: '0 auto' }}>
        <Button variant="primary" onClick={() => setShow(true)} style={{ width: '100%' }}>
          Book Experience (Mobile)
        </Button>

        <Modal show={show} onHide={() => setShow(false)} fullscreen="sm-down" centered>
          <Modal.Header closeButton style={{ ...modalHeaderStyle, background: 'var(--gradient-primary)', color: 'white' }}>
            <Modal.Title style={{ ...modalTitleStyle, color: 'white' }}>
              <FaCreditCard style={{ marginRight: 'var(--space-2)' }} />
              Complete Booking
            </Modal.Title>
          </Modal.Header>
          <Modal.Body style={{ padding: 'var(--space-4)' }}>
            {/* Booking Summary */}
            <div style={{
              background: 'var(--color-bg-secondary)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-4)',
              marginBottom: 'var(--space-4)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                <span style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)' }}>
                  Cherry Blossom Tour
                </span>
                <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-primary)' }}>
                  $149
                </span>
              </div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center' }}>
                <FaCalendarAlt style={{ marginRight: 'var(--space-1)' }} /> April 15, 2025
              </div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center' }}>
                <FaUsers style={{ marginRight: 'var(--space-1)' }} /> 2 travelers
              </div>
            </div>

            {/* Payment Form */}
            <Form>
              <Form.Group className="mb-3">
                <Form.Label style={{ ...labelStyle, fontSize: 'var(--font-size-sm)' }}>Card Number</Form.Label>
                <Form.Control type="text" placeholder="1234 5678 9012 3456" style={inputStyle} />
              </Form.Group>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <Form.Group>
                  <Form.Label style={{ ...labelStyle, fontSize: 'var(--font-size-sm)' }}>Expiry</Form.Label>
                  <Form.Control type="text" placeholder="MM/YY" style={inputStyle} />
                </Form.Group>
                <Form.Group>
                  <Form.Label style={{ ...labelStyle, fontSize: 'var(--font-size-sm)' }}>CVV</Form.Label>
                  <Form.Control type="text" placeholder="123" style={inputStyle} />
                </Form.Group>
              </div>
            </Form>
          </Modal.Body>
          <Modal.Footer style={{ ...modalFooterStyle, flexDirection: 'column', gap: 'var(--space-3)' }}>
            <Button
              variant="primary"
              onClick={() => setShow(false)}
              style={{ width: '100%', padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', fontWeight: 'var(--font-weight-bold)' }}
            >
              Pay $149
            </Button>
            <Button
              variant="link"
              onClick={() => setShow(false)}
              style={{ color: 'var(--color-text-muted)' }}
            >
              Cancel
            </Button>
          </Modal.Footer>
        </Modal>
      </div>
    );
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile',
    },
    docs: {
      description: {
        story: 'Mobile-optimized booking modal with full-screen display on small devices.',
      },
    },
  },
};

export const MobileQuickActions = {
  render: () => {
    const [show, setShow] = useState(false);

    return (
      <div style={{ maxWidth: '428px', margin: '0 auto' }}>
        <Button variant="outline-primary" onClick={() => setShow(true)} style={{ width: '100%' }}>
          Quick Actions (Mobile)
        </Button>

        <Modal show={show} onHide={() => setShow(false)} centered style={{ '--bs-modal-margin': '1rem' }}>
          <Modal.Body style={{ padding: 'var(--space-4)' }}>
            <h3 style={{
              fontSize: 'var(--font-size-lg)',
              fontWeight: 'var(--font-weight-bold)',
              color: 'var(--color-text-primary)',
              marginBottom: 'var(--space-4)',
              textAlign: 'center',
            }}>
              Quick Actions
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {[
                { icon: <FaPlane />, label: 'Add to Trip', color: 'var(--color-primary)' },
                { icon: <FaHeart />, label: 'Save for Later', color: 'var(--color-danger)' },
                { icon: <FaUsers />, label: 'Share with Friends', color: 'var(--color-info)' },
                { icon: <FaCalendarAlt />, label: 'Set Reminder', color: 'var(--color-warning)' },
              ].map((action, i) => (
                <button
                  key={i}
                  onClick={() => setShow(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-4)',
                    background: 'var(--color-bg-secondary)',
                    border: '1px solid var(--color-border-light)',
                    borderRadius: 'var(--radius-lg)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                    transition: 'var(--transition-fast)',
                  }}
                >
                  <span style={{ color: action.color, fontSize: 'var(--font-size-xl)' }}>{action.icon}</span>
                  <span style={{ fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>{action.label}</span>
                </button>
              ))}
            </div>

            <Button
              variant="link"
              onClick={() => setShow(false)}
              style={{ width: '100%', marginTop: 'var(--space-4)', color: 'var(--color-text-muted)' }}
            >
              Cancel
            </Button>
          </Modal.Body>
        </Modal>
      </div>
    );
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile',
    },
  },
};

// ============================================================
// FULL SCREEN MODAL
// ============================================================

export const FullScreen = {
  render: () => {
    const [show, setShow] = useState(false);

    return (
      <>
        <Button variant="primary" onClick={() => setShow(true)}>
          Show Full Screen Modal
        </Button>

        <Modal show={show} onHide={() => setShow(false)} fullscreen>
          <Modal.Header closeButton style={{ ...modalHeaderStyle, backgroundColor: 'var(--color-bg-primary)' }}>
            <Modal.Title style={modalTitleStyle}>
              Full Experience View
            </Modal.Title>
          </Modal.Header>
          <Modal.Body style={{ padding: 'var(--space-8)', backgroundColor: 'var(--color-bg-primary)', overflow: 'auto' }}>
            <Container style={{ maxWidth: '1000px' }}>
              <div style={{
                height: '400px',
                background: 'linear-gradient(135deg, #ff9a9e 0%, #fad0c4 50%, #ffecd2 100%)',
                borderRadius: 'var(--radius-xl)',
                marginBottom: 'var(--space-8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '6rem',
              }}>
                🌸
              </div>

              <h1 style={{
                fontSize: 'var(--font-size-4xl)',
                fontWeight: 'var(--font-weight-bold)',
                color: 'var(--color-text-primary)',
                marginBottom: 'var(--space-4)',
              }}>
                Cherry Blossom Festival in Tokyo
              </h1>

              <p style={{
                fontSize: 'var(--font-size-xl)',
                color: 'var(--color-text-secondary)',
                lineHeight: 'var(--line-height-relaxed)',
                marginBottom: 'var(--space-8)',
              }}>
                Experience the breathtaking beauty of cherry blossoms in full bloom at Tokyo's iconic parks and gardens. This immersive cultural experience combines natural beauty with traditional Japanese customs.
              </p>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: 'var(--space-6)',
              }}>
                {['Best Viewing Spots', 'Cultural Activities', 'Local Cuisine', 'Photography Tips'].map((title, i) => (
                  <div
                    key={i}
                    style={{
                      padding: 'var(--space-6)',
                      backgroundColor: 'var(--color-bg-secondary)',
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid var(--color-border-light)',
                    }}
                  >
                    <h4 style={{
                      fontSize: 'var(--font-size-lg)',
                      fontWeight: 'var(--font-weight-semibold)',
                      color: 'var(--color-text-primary)',
                      marginBottom: 'var(--space-3)',
                    }}>
                      {title}
                    </h4>
                    <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}>
                      Detailed content about {title.toLowerCase()} during the cherry blossom season...
                    </p>
                  </div>
                ))}
              </div>
            </Container>
          </Modal.Body>
        </Modal>
      </>
    );
  },
};

// ============================================================
// SHARED STYLES
// ============================================================

const modalHeaderStyle = {
  borderBottom: '1px solid var(--color-border-light)',
  padding: 'var(--space-6)',
};

const modalTitleStyle = {
  fontSize: 'var(--font-size-xl)',
  fontWeight: 'var(--font-weight-semibold)',
  color: 'var(--color-text-primary)',
};

const modalBodyStyle = {
  padding: 'var(--space-6)',
};

const modalFooterStyle = {
  borderTop: '1px solid var(--color-border-light)',
  padding: 'var(--space-6)',
  gap: 'var(--space-3)',
};

const modalTextStyle = {
  fontSize: 'var(--font-size-base)',
  color: 'var(--color-text-secondary)',
  lineHeight: 'var(--line-height-relaxed)',
};

const buttonStyle = {
  borderRadius: 'var(--radius-md)',
  padding: 'var(--space-3) var(--space-6)',
};

const labelStyle = {
  fontSize: 'var(--font-size-sm)',
  fontWeight: 'var(--font-weight-medium)',
  color: 'var(--color-text-primary)',
  marginBottom: 'var(--space-2)',
};

const inputStyle = {
  borderRadius: 'var(--radius-md)',
  borderColor: 'var(--color-border-medium)',
  padding: 'var(--space-3)',
};
