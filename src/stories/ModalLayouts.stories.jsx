import React, { useState } from 'react';
import { Modal, Button, Form, Alert, ListGroup, Badge, Image } from 'react-bootstrap';
import { FaCheckCircle, FaExclamationTriangle, FaInfoCircle, FaTimes, FaTrash, FaUser, FaEnvelope, FaLock, FaUpload, FaMapMarkerAlt, FaPlane } from 'react-icons/fa';

export default {
  title: 'Design System/Modal Layouts',
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Modal layout patterns for various use cases including forms, confirmations, selections, and content display. All modals support dark mode and use design tokens.',
      },
    },
  },
};

// Basic Confirmation Modal
export const ConfirmationModal = () => {
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
        style={{
          '--bs-modal-bg': 'var(--color-bg-primary)',
        }}
      >
        <Modal.Header closeButton style={{
          borderBottom: '1px solid var(--color-border-light)',
          padding: 'var(--space-6)',
        }}>
          <Modal.Title style={{
            fontSize: 'var(--font-size-xl)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--color-text-primary)',
          }}>
            Confirm Action
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: 'var(--space-6)' }}>
          <p style={{
            fontSize: 'var(--font-size-base)',
            color: 'var(--color-text-secondary)',
            lineHeight: 'var(--line-height-relaxed)',
          }}>
            Are you sure you want to proceed with this action? This cannot be undone.
          </p>
        </Modal.Body>
        <Modal.Footer style={{
          borderTop: '1px solid var(--color-border-light)',
          padding: 'var(--space-6)',
          gap: 'var(--space-3)',
        }}>
          <Button 
            variant="outline-secondary" 
            onClick={() => setShow(false)}
            style={{
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-3) var(--space-6)',
            }}
          >
            Cancel
          </Button>
          <Button 
            variant="primary"
            onClick={() => setShow(false)}
            style={{
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-3) var(--space-6)',
            }}
          >
            Confirm
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

// Delete Confirmation Modal
export const DeleteConfirmationModal = () => {
  const [show, setShow] = useState(false);
  
  return (
    <>
      <Button variant="danger" onClick={() => setShow(true)}>
        Show Delete Modal
      </Button>
      
      <Modal 
        show={show} 
        onHide={() => setShow(false)}
        centered
      >
        <Modal.Header closeButton style={{
          borderBottom: '1px solid var(--color-border-light)',
          padding: 'var(--space-6)',
        }}>
          <Modal.Title style={{
            fontSize: 'var(--font-size-xl)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--color-danger)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}>
            <FaExclamationTriangle /> Delete Experience?
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: 'var(--space-6)' }}>
          <Alert variant="danger" style={{
            marginBottom: 'var(--space-4)',
            borderRadius: 'var(--radius-md)',
          }}>
            <FaExclamationTriangle style={{ marginRight: 'var(--space-2)' }} />
            This action cannot be undone!
          </Alert>
          <p style={{
            fontSize: 'var(--font-size-base)',
            color: 'var(--color-text-secondary)',
            lineHeight: 'var(--line-height-relaxed)',
            marginBottom: 'var(--space-4)',
          }}>
            You are about to permanently delete <strong>"Cherry Blossom Viewing in Ueno Park"</strong>.
          </p>
          <p style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-muted)',
          }}>
            This will also delete:
          </p>
          <ul style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-muted)',
            paddingLeft: 'var(--space-6)',
          }}>
            <li>All plan items</li>
            <li>Associated photos</li>
            <li>User plans (if any)</li>
          </ul>
        </Modal.Body>
        <Modal.Footer style={{
          borderTop: '1px solid var(--color-border-light)',
          padding: 'var(--space-6)',
          gap: 'var(--space-3)',
        }}>
          <Button 
            variant="outline-secondary" 
            onClick={() => setShow(false)}
            style={{
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-3) var(--space-6)',
            }}
          >
            Cancel
          </Button>
          <Button 
            variant="danger"
            onClick={() => setShow(false)}
            style={{
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-3) var(--space-6)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
            }}
          >
            <FaTrash /> Delete Permanently
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

// Form Modal
export const FormModal = () => {
  const [show, setShow] = useState(false);
  
  return (
    <>
      <Button variant="primary" onClick={() => setShow(true)}>
        Show Form Modal
      </Button>
      
      <Modal 
        show={show} 
        onHide={() => setShow(false)}
        size="lg"
        centered
      >
        <Modal.Header closeButton style={{
          borderBottom: '1px solid var(--color-border-light)',
          padding: 'var(--space-6)',
        }}>
          <Modal.Title style={{
            fontSize: 'var(--font-size-xl)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--color-text-primary)',
          }}>
            Create New Experience
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: 'var(--space-6)' }}>
          <Form>
            <Form.Group className="mb-4">
              <Form.Label style={{
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-medium)',
                color: 'var(--color-text-primary)',
                marginBottom: 'var(--space-2)',
              }}>
                Experience Name *
              </Form.Label>
              <Form.Control 
                type="text"
                placeholder="Enter experience name"
                style={{
                  borderRadius: 'var(--radius-md)',
                  borderColor: 'var(--color-border-medium)',
                  padding: 'var(--space-3)',
                }}
              />
            </Form.Group>
            
            <Form.Group className="mb-4">
              <Form.Label style={{
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-medium)',
                color: 'var(--color-text-primary)',
                marginBottom: 'var(--space-2)',
              }}>
                Destination *
              </Form.Label>
              <Form.Select
                style={{
                  borderRadius: 'var(--radius-md)',
                  borderColor: 'var(--color-border-medium)',
                  padding: 'var(--space-3)',
                }}
              >
                <option>Select a destination</option>
                <option>Tokyo, Japan</option>
                <option>Paris, France</option>
                <option>New York, USA</option>
              </Form.Select>
            </Form.Group>
            
            <Form.Group className="mb-4">
              <Form.Label style={{
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-medium)',
                color: 'var(--color-text-primary)',
                marginBottom: 'var(--space-2)',
              }}>
                Description
              </Form.Label>
              <Form.Control 
                as="textarea"
                rows={4}
                placeholder="Describe your experience..."
                style={{
                  borderRadius: 'var(--radius-md)',
                  borderColor: 'var(--color-border-medium)',
                  padding: 'var(--space-3)',
                }}
              />
            </Form.Group>
            
            <Form.Group className="mb-4">
              <Form.Label style={{
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-medium)',
                color: 'var(--color-text-primary)',
                marginBottom: 'var(--space-2)',
              }}>
                Estimated Cost
              </Form.Label>
              <Form.Control 
                type="number"
                placeholder="0.00"
                style={{
                  borderRadius: 'var(--radius-md)',
                  borderColor: 'var(--color-border-medium)',
                  padding: 'var(--space-3)',
                }}
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer style={{
          borderTop: '1px solid var(--color-border-light)',
          padding: 'var(--space-6)',
          gap: 'var(--space-3)',
        }}>
          <Button 
            variant="outline-secondary" 
            onClick={() => setShow(false)}
            style={{
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-3) var(--space-6)',
            }}
          >
            Cancel
          </Button>
          <Button 
            variant="primary"
            onClick={() => setShow(false)}
            style={{
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-3) var(--space-6)',
            }}
          >
            Create Experience
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

// Selection List Modal
export const SelectionListModal = () => {
  const [show, setShow] = useState(false);
  const [selected, setSelected] = useState(null);
  
  const destinations = [
    { id: 1, name: 'Tokyo, Japan', country: 'Japan', experiences: 89 },
    { id: 2, name: 'Paris, France', country: 'France', experiences: 124 },
    { id: 3, name: 'New York, USA', country: 'United States', experiences: 156 },
    { id: 4, name: 'London, UK', country: 'United Kingdom', experiences: 98 },
    { id: 5, name: 'Sydney, Australia', country: 'Australia', experiences: 67 },
  ];
  
  return (
    <>
      <Button variant="primary" onClick={() => setShow(true)}>
        Show Selection Modal
      </Button>
      
      <Modal 
        show={show} 
        onHide={() => setShow(false)}
        size="lg"
        centered
      >
        <Modal.Header closeButton style={{
          borderBottom: '1px solid var(--color-border-light)',
          padding: 'var(--space-6)',
        }}>
          <Modal.Title style={{
            fontSize: 'var(--font-size-xl)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--color-text-primary)',
          }}>
            Select Destination
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: 'var(--space-6)' }}>
          <Form.Control 
            type="text"
            placeholder="Search destinations..."
            style={{
              borderRadius: 'var(--radius-md)',
              borderColor: 'var(--color-border-medium)',
              padding: 'var(--space-3)',
              marginBottom: 'var(--space-4)',
            }}
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
                  <div>
                    <div style={{
                      fontWeight: 'var(--font-weight-semibold)',
                      color: 'var(--color-text-primary)',
                      marginBottom: 'var(--space-1)',
                    }}>
                      <FaMapMarkerAlt style={{ marginRight: 'var(--space-2)' }} />
                      {dest.name}
                    </div>
                    <div style={{
                      fontSize: 'var(--font-size-sm)',
                      color: 'var(--color-text-muted)',
                    }}>
                      {dest.country}
                    </div>
                  </div>
                  <Badge bg="secondary" style={{
                    borderRadius: 'var(--radius-full)',
                    padding: 'var(--space-2) var(--space-3)',
                  }}>
                    {dest.experiences} experiences
                  </Badge>
                </div>
              </ListGroup.Item>
            ))}
          </ListGroup>
        </Modal.Body>
        <Modal.Footer style={{
          borderTop: '1px solid var(--color-border-light)',
          padding: 'var(--space-6)',
          gap: 'var(--space-3)',
        }}>
          <Button 
            variant="outline-secondary" 
            onClick={() => setShow(false)}
            style={{
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-3) var(--space-6)',
            }}
          >
            Cancel
          </Button>
          <Button 
            variant="primary"
            onClick={() => setShow(false)}
            disabled={!selected}
            style={{
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-3) var(--space-6)',
            }}
          >
            Select Destination
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

// Image Upload Modal
export const ImageUploadModal = () => {
  const [show, setShow] = useState(false);
  
  return (
    <>
      <Button variant="primary" onClick={() => setShow(true)}>
        Show Upload Modal
      </Button>
      
      <Modal 
        show={show} 
        onHide={() => setShow(false)}
        size="lg"
        centered
      >
        <Modal.Header closeButton style={{
          borderBottom: '1px solid var(--color-border-light)',
          padding: 'var(--space-6)',
        }}>
          <Modal.Title style={{
            fontSize: 'var(--font-size-xl)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--color-text-primary)',
          }}>
            Upload Photo
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: 'var(--space-6)' }}>
          <div style={{
            border: '2px dashed var(--color-border-medium)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-12)',
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
            <p style={{
              fontSize: 'var(--font-size-base)',
              color: 'var(--color-text-primary)',
              marginBottom: 'var(--space-2)',
            }}>
              Drop your image here or click to browse
            </p>
            <p style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-muted)',
            }}>
              Supports: JPG, PNG, GIF (Max 5MB)
            </p>
          </div>
          
          <Form.Group className="mb-4">
            <Form.Label style={{
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-medium)',
              color: 'var(--color-text-primary)',
              marginBottom: 'var(--space-2)',
            }}>
              Caption (Optional)
            </Form.Label>
            <Form.Control 
              type="text"
              placeholder="Add a caption for your photo..."
              style={{
                borderRadius: 'var(--radius-md)',
                borderColor: 'var(--color-border-medium)',
                padding: 'var(--space-3)',
              }}
            />
          </Form.Group>
          
          <Form.Group>
            <Form.Label style={{
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-medium)',
              color: 'var(--color-text-primary)',
              marginBottom: 'var(--space-2)',
            }}>
              Alt Text (For Accessibility)
            </Form.Label>
            <Form.Control 
              type="text"
              placeholder="Describe the image..."
              style={{
                borderRadius: 'var(--radius-md)',
                borderColor: 'var(--color-border-medium)',
                padding: 'var(--space-3)',
              }}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer style={{
          borderTop: '1px solid var(--color-border-light)',
          padding: 'var(--space-6)',
          gap: 'var(--space-3)',
        }}>
          <Button 
            variant="outline-secondary" 
            onClick={() => setShow(false)}
            style={{
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-3) var(--space-6)',
            }}
          >
            Cancel
          </Button>
          <Button 
            variant="primary"
            onClick={() => setShow(false)}
            style={{
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-3) var(--space-6)',
            }}
          >
            <FaUpload style={{ marginRight: 'var(--space-2)' }} />
            Upload Photo
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

// Success Notification Modal
export const SuccessModal = () => {
  const [show, setShow] = useState(false);
  
  return (
    <>
      <Button variant="success" onClick={() => setShow(true)}>
        Show Success Modal
      </Button>
      
      <Modal 
        show={show} 
        onHide={() => setShow(false)}
        centered
      >
        <Modal.Body style={{ 
          padding: 'var(--space-8)',
          textAlign: 'center',
        }}>
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
            <FaCheckCircle style={{
              fontSize: 'var(--font-size-4xl)',
              color: 'var(--color-success)',
            }} />
          </div>
          <h2 style={{
            fontSize: 'var(--font-size-2xl)',
            fontWeight: 'var(--font-weight-bold)',
            color: 'var(--color-text-primary)',
            marginBottom: 'var(--space-3)',
          }}>
            Success!
          </h2>
          <p style={{
            fontSize: 'var(--font-size-base)',
            color: 'var(--color-text-secondary)',
            marginBottom: 'var(--space-6)',
            lineHeight: 'var(--line-height-relaxed)',
          }}>
            Your experience has been created successfully. You can now start adding plan items and invite collaborators.
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
            Continue
          </Button>
        </Modal.Body>
      </Modal>
    </>
  );
};

// Info/Details Modal
export const InfoModal = () => {
  const [show, setShow] = useState(false);
  
  return (
    <>
      <Button variant="info" onClick={() => setShow(true)}>
        Show Info Modal
      </Button>
      
      <Modal 
        show={show} 
        onHide={() => setShow(false)}
        size="lg"
        centered
      >
        <Modal.Header closeButton style={{
          borderBottom: '1px solid var(--color-border-light)',
          padding: 'var(--space-6)',
        }}>
          <Modal.Title style={{
            fontSize: 'var(--font-size-xl)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--color-text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}>
            <FaInfoCircle style={{ color: 'var(--color-info)' }} />
            Experience Details
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: 'var(--space-6)' }}>
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <img 
              src="https://images.unsplash.com/photo-1522383225653-ed111181a951?w=800"
              alt="Experience"
              style={{
                width: '100%',
                height: '250px',
                objectFit: 'cover',
                borderRadius: 'var(--radius-lg)',
                marginBottom: 'var(--space-4)',
              }}
            />
          </div>
          
          <h3 style={{
            fontSize: 'var(--font-size-xl)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--color-text-primary)',
            marginBottom: 'var(--space-3)',
          }}>
            Cherry Blossom Viewing in Ueno Park
          </h3>
          
          <div style={{
            display: 'flex',
            gap: 'var(--space-2)',
            marginBottom: 'var(--space-4)',
            flexWrap: 'wrap',
          }}>
            <Badge bg="secondary" style={{ padding: 'var(--space-2) var(--space-3)' }}>
              Nature
            </Badge>
            <Badge bg="secondary" style={{ padding: 'var(--space-2) var(--space-3)' }}>
              Culture
            </Badge>
            <Badge bg="secondary" style={{ padding: 'var(--space-2) var(--space-3)' }}>
              Photography
            </Badge>
          </div>
          
          <p style={{
            fontSize: 'var(--font-size-base)',
            color: 'var(--color-text-secondary)',
            lineHeight: 'var(--line-height-relaxed)',
            marginBottom: 'var(--space-6)',
          }}>
            Join locals for hanami (flower viewing) under the stunning cherry blossoms in one of Tokyo's most beloved parks. This seasonal experience offers breathtaking views and cultural immersion.
          </p>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 'var(--space-4)',
            padding: 'var(--space-4)',
            backgroundColor: 'var(--color-bg-secondary)',
            borderRadius: 'var(--radius-md)',
          }}>
            <div>
              <div style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-muted)',
                marginBottom: 'var(--space-1)',
              }}>
                Difficulty
              </div>
              <div style={{
                fontSize: 'var(--font-size-base)',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text-primary)',
              }}>
                Easy
              </div>
            </div>
            <div>
              <div style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-muted)',
                marginBottom: 'var(--space-1)',
              }}>
                Duration
              </div>
              <div style={{
                fontSize: 'var(--font-size-base)',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text-primary)',
              }}>
                3-4 hours
              </div>
            </div>
            <div>
              <div style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-muted)',
                marginBottom: 'var(--space-1)',
              }}>
                Cost
              </div>
              <div style={{
                fontSize: 'var(--font-size-base)',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text-primary)',
              }}>
                $50
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer style={{
          borderTop: '1px solid var(--color-border-light)',
          padding: 'var(--space-6)',
          gap: 'var(--space-3)',
          justifyContent: 'space-between',
        }}>
          <Button 
            variant="outline-secondary"
            onClick={() => setShow(false)}
            style={{
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-3) var(--space-6)',
            }}
          >
            Close
          </Button>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <Button 
              variant="outline-primary"
              style={{
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3) var(--space-6)',
              }}
            >
              View Full Details
            </Button>
            <Button 
              variant="primary"
              style={{
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3) var(--space-6)',
              }}
            >
              <FaPlane style={{ marginRight: 'var(--space-2)' }} />
              Plan This
            </Button>
          </div>
        </Modal.Footer>
      </Modal>
    </>
  );
};

// Multi-Step Modal (Wizard)
export const MultiStepModal = () => {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(1);
  
  const handleNext = () => setStep(step + 1);
  const handlePrev = () => setStep(step - 1);
  const handleClose = () => {
    setShow(false);
    setStep(1);
  };
  
  return (
    <>
      <Button variant="primary" onClick={() => setShow(true)}>
        Show Multi-Step Modal
      </Button>
      
      <Modal 
        show={show} 
        onHide={handleClose}
        size="lg"
        centered
      >
        <Modal.Header closeButton style={{
          borderBottom: '1px solid var(--color-border-light)',
          padding: 'var(--space-6)',
        }}>
          <Modal.Title style={{
            fontSize: 'var(--font-size-xl)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--color-text-primary)',
          }}>
            Create Your Account - Step {step} of 3
          </Modal.Title>
        </Modal.Header>
        
        {/* Progress Bar */}
        <div style={{
          height: '4px',
          backgroundColor: 'var(--color-border-light)',
        }}>
          <div style={{
            height: '100%',
            width: `${(step / 3) * 100}%`,
            backgroundColor: 'var(--color-primary)',
            transition: 'var(--transition-normal)',
          }} />
        </div>
        
        <Modal.Body style={{ padding: 'var(--space-6)' }}>
          {step === 1 && (
            <div>
              <h4 style={{
                fontSize: 'var(--font-size-lg)',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text-primary)',
                marginBottom: 'var(--space-4)',
              }}>
                Personal Information
              </h4>
              <Form>
                <Form.Group className="mb-4">
                  <Form.Label>Full Name *</Form.Label>
                  <Form.Control type="text" placeholder="Enter your name" />
                </Form.Group>
                <Form.Group className="mb-4">
                  <Form.Label>Email *</Form.Label>
                  <Form.Control type="email" placeholder="your@email.com" />
                </Form.Group>
              </Form>
            </div>
          )}
          
          {step === 2 && (
            <div>
              <h4 style={{
                fontSize: 'var(--font-size-lg)',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text-primary)',
                marginBottom: 'var(--space-4)',
              }}>
                Account Security
              </h4>
              <Form>
                <Form.Group className="mb-4">
                  <Form.Label>Password *</Form.Label>
                  <Form.Control type="password" placeholder="Create a password" />
                </Form.Group>
                <Form.Group className="mb-4">
                  <Form.Label>Confirm Password *</Form.Label>
                  <Form.Control type="password" placeholder="Confirm your password" />
                </Form.Group>
              </Form>
            </div>
          )}
          
          {step === 3 && (
            <div>
              <h4 style={{
                fontSize: 'var(--font-size-lg)',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text-primary)',
                marginBottom: 'var(--space-4)',
              }}>
                Preferences
              </h4>
              <Form>
                <Form.Group className="mb-4">
                  <Form.Label>Location (Optional)</Form.Label>
                  <Form.Control type="text" placeholder="City, Country" />
                </Form.Group>
                <Form.Group className="mb-4">
                  <Form.Check 
                    type="checkbox"
                    label="Send me travel inspiration and tips"
                  />
                </Form.Group>
                <Form.Group className="mb-4">
                  <Form.Check 
                    type="checkbox"
                    label="Notify me about new experiences in my favorite destinations"
                  />
                </Form.Group>
              </Form>
            </div>
          )}
        </Modal.Body>
        
        <Modal.Footer style={{
          borderTop: '1px solid var(--color-border-light)',
          padding: 'var(--space-6)',
          justifyContent: 'space-between',
        }}>
          <Button 
            variant="outline-secondary" 
            onClick={step === 1 ? handleClose : handlePrev}
            style={{
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-3) var(--space-6)',
            }}
          >
            {step === 1 ? 'Cancel' : 'Previous'}
          </Button>
          <Button 
            variant="primary"
            onClick={step === 3 ? handleClose : handleNext}
            style={{
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-3) var(--space-6)',
            }}
          >
            {step === 3 ? 'Complete' : 'Next'}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

// Full Screen Modal
export const FullScreenModal = () => {
  const [show, setShow] = useState(false);
  
  return (
    <>
      <Button variant="primary" onClick={() => setShow(true)}>
        Show Full Screen Modal
      </Button>
      
      <Modal 
        show={show} 
        onHide={() => setShow(false)}
        fullscreen={true}
      >
        <Modal.Header closeButton style={{
          borderBottom: '1px solid var(--color-border-light)',
          padding: 'var(--space-6)',
          backgroundColor: 'var(--color-bg-primary)',
        }}>
          <Modal.Title style={{
            fontSize: 'var(--font-size-xl)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--color-text-primary)',
          }}>
            Full Experience View
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{
          padding: 'var(--space-8)',
          backgroundColor: 'var(--color-bg-primary)',
          overflow: 'auto',
        }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <img 
              src="https://images.unsplash.com/photo-1522383225653-ed111181a951?w=1200"
              alt="Experience"
              style={{
                width: '100%',
                height: '500px',
                objectFit: 'cover',
                borderRadius: 'var(--radius-xl)',
                marginBottom: 'var(--space-8)',
              }}
            />
            
            <h1 style={{
              fontSize: 'var(--font-size-4xl)',
              fontWeight: 'var(--font-weight-bold)',
              color: 'var(--color-text-primary)',
              marginBottom: 'var(--space-4)',
            }}>
              Cherry Blossom Viewing in Ueno Park
            </h1>
            
            <p style={{
              fontSize: 'var(--font-size-xl)',
              color: 'var(--color-text-secondary)',
              lineHeight: 'var(--line-height-relaxed)',
              marginBottom: 'var(--space-8)',
            }}>
              Experience the breathtaking beauty of cherry blossoms in full bloom at one of Tokyo's most iconic parks. This immersive cultural experience combines natural beauty with traditional Japanese customs.
            </p>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: 'var(--space-6)',
            }}>
              {[1, 2, 3, 4].map(i => (
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
                    Section {i}
                  </h4>
                  <p style={{
                    fontSize: 'var(--font-size-base)',
                    color: 'var(--color-text-secondary)',
                    lineHeight: 'var(--line-height-relaxed)',
                  }}>
                    Detailed content about this aspect of the experience goes here...
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Modal.Body>
      </Modal>
    </>
  );
};
