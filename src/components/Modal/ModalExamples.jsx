import { useState } from 'react';
import Modal from './Modal';

/**
 * Example component demonstrating Modal usage
 * This file shows various ways to use the Modal component
 */
export default function ModalExamples() {
  const [showBasic, setShowBasic] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showDanger, setShowDanger] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '' });

  const handleFormSubmit = () => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      console.log('Form submitted:', formData);
      setLoading(false);
      setShowForm(false);
      setFormData({ name: '', email: '' });
    }, 1500);
  };

  const handleDangerAction = () => {
    console.log('Danger action confirmed');
    setShowDanger(false);
  };

  return (
    <div className="container my-5">
      <h1 className="mb-4">Modal Component Examples</h1>
      
      <div className="row g-3">
        <div className="col-md-4">
          <button 
            className="btn btn-primary w-100" 
            onClick={() => setShowBasic(true)}
          >
            Basic Modal
          </button>
        </div>
        
        <div className="col-md-4">
          <button 
            className="btn btn-primary w-100" 
            onClick={() => setShowForm(true)}
          >
            Form Modal
          </button>
        </div>
        
        <div className="col-md-4">
          <button 
            className="btn btn-primary w-100" 
            onClick={() => setShowCustom(true)}
          >
            Custom Footer Modal
          </button>
        </div>
        
        <div className="col-md-4">
          <button 
            className="btn btn-info w-100" 
            onClick={() => setShowInfo(true)}
          >
            Info Modal (No Submit)
          </button>
        </div>
        
        <div className="col-md-4">
          <button 
            className="btn btn-danger w-100" 
            onClick={() => setShowDanger(true)}
          >
            Danger Modal
          </button>
        </div>
      </div>

      {/* Basic Modal */}
      <Modal
        show={showBasic}
        onClose={() => setShowBasic(false)}
        onSubmit={() => {
          console.log('Basic modal submitted');
          setShowBasic(false);
        }}
        title="Basic Modal"
        submitText="Confirm"
      >
        <p>This is a basic modal with default settings.</p>
        <p>It has a submit and cancel button.</p>
      </Modal>

      {/* Form Modal with Loading */}
      <Modal
        show={showForm}
        onClose={() => setShowForm(false)}
        onSubmit={handleFormSubmit}
        title="Edit Profile"
        submitText="Save Changes"
        loading={loading}
        disableSubmit={!formData.name || !formData.email}
      >
        <div className="mb-3">
          <label className="form-label">Name</label>
          <input
            type="text"
            className="form-control"
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            placeholder="Enter your name"
          />
        </div>
        <div className="mb-3">
          <label className="form-label">Email</label>
          <input
            type="email"
            className="form-control"
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
            placeholder="Enter your email"
          />
        </div>
        <small className="text-muted">Fill both fields to enable submit button</small>
      </Modal>

      {/* Custom Footer Modal */}
      <Modal
        show={showCustom}
        onClose={() => setShowCustom(false)}
        title="Custom Footer Actions"
        footer={
          <div className="d-flex gap-2 w-100 justify-content-center">
            <button 
              className="btn btn-warning" 
              onClick={() => {
                console.log('Option 1 selected');
                setShowCustom(false);
              }}
            >
              Option 1
            </button>
            <button 
              className="btn btn-info" 
              onClick={() => {
                console.log('Option 2 selected');
                setShowCustom(false);
              }}
            >
              Option 2
            </button>
            <button 
              className="btn btn-success" 
              onClick={() => {
                console.log('Option 3 selected');
                setShowCustom(false);
              }}
            >
              Option 3
            </button>
          </div>
        }
      >
        <p>This modal has a custom footer with three action buttons.</p>
        <p>You can customize the footer to show any buttons or content you need.</p>
      </Modal>

      {/* Info Modal (No Submit) */}
      <Modal
        show={showInfo}
        onClose={() => setShowInfo(false)}
        title="Information"
        showSubmitButton={false}
        cancelText="Got it"
      >
        <div className="alert alert-info">
          <strong>Did you know?</strong>
        </div>
        <p>This modal only has a close button, no submit action.</p>
        <ul>
          <li>Perfect for displaying information</li>
          <li>Terms and conditions</li>
          <li>Help content</li>
          <li>Announcements</li>
        </ul>
      </Modal>

      {/* Danger Modal */}
      <Modal
        show={showDanger}
        onClose={() => setShowDanger(false)}
        onSubmit={handleDangerAction}
        title="Confirm Deletion"
        submitText="Delete"
        submitVariant="danger"
        size="sm"
      >
        <p>Are you sure you want to delete this item?</p>
        <div className="alert alert-danger">
          <strong>Warning:</strong> This action cannot be undone.
        </div>
      </Modal>
    </div>
  );
}
