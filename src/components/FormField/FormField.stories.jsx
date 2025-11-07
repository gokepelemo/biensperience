import { useState } from 'react';
import FormField from './FormField';
import { Form } from 'react-bootstrap';

export default {
  title: 'Components/FormField',
  component: FormField,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Unified form field component with label, validation, tooltips, and input groups. Supports all Bootstrap form types and custom styling.',
      },
    },
  },
  tags: [],
  argTypes: {
    type: {
      control: 'select',
      options: ['text', 'email', 'password', 'number', 'tel', 'url', 'date', 'textarea'],
      description: 'Input type',
    },
    size: {
      control: 'select',
      options: ['sm', 'lg'],
      description: 'Input size',
    },
  },
};

// Basic text input
export const BasicTextInput = {
  render: () => {
    const [value, setValue] = useState('');
    return (
      <FormField
        name="username"
        label="Username"
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Enter your username"
      />
    );
  },
};

// Required field
export const RequiredField = {
  render: () => {
    const [value, setValue] = useState('');
    return (
      <FormField
        name="email"
        label="Email Address"
        type="email"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="your.email@example.com"
        required
        helpText="We'll never share your email with anyone else."
      />
    );
  },
};

// With tooltip
export const WithTooltip = {
  render: () => {
    const [value, setValue] = useState('');
    return (
      <FormField
        name="password"
        label="Password"
        type="password"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Enter a strong password"
        required
        tooltip="Password must be at least 8 characters with uppercase, lowercase, and numbers"
        tooltipPlacement="right"
      />
    );
  },
};

// With validation
export const WithValidation = {
  render: () => {
    const [email, setEmail] = useState('');
    const [isValid, setIsValid] = useState(false);
    const [isInvalid, setIsInvalid] = useState(false);

    const validateEmail = (value) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!value) {
        setIsValid(false);
        setIsInvalid(false);
      } else if (emailRegex.test(value)) {
        setIsValid(true);
        setIsInvalid(false);
      } else {
        setIsValid(false);
        setIsInvalid(true);
      }
    };

    return (
      <FormField
        name="email"
        label="Email Address"
        type="email"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          validateEmail(e.target.value);
        }}
        placeholder="your.email@example.com"
        required
        isValid={isValid}
        isInvalid={isInvalid}
        validFeedback="Looks good!"
        invalidFeedback="Please enter a valid email address."
      />
    );
  },
};

// With prepend/append
export const WithInputGroup = {
  render: () => {
    const [amount, setAmount] = useState('');
    const [website, setWebsite] = useState('');

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <FormField
          name="amount"
          label="Price"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          prepend="$"
        />
        
        <FormField
          name="website"
          label="Website URL"
          type="url"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder="example.com"
          prepend="https://"
          helpText="Enter your website without the protocol"
        />
      </div>
    );
  },
};

// Textarea
export const TextareaField = {
  render: () => {
    const [value, setValue] = useState('');
    return (
      <FormField
        name="description"
        label="Description"
        as="textarea"
        rows={4}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Enter a detailed description..."
        helpText={`${value.length}/500 characters`}
      />
    );
  },
};

// Select dropdown
export const SelectField = {
  render: () => {
    const [value, setValue] = useState('');
    return (
      <FormField
        name="country"
        label="Country"
        as="select"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        required
      >
        <option value="">Select a country...</option>
        <option value="us">United States</option>
        <option value="ca">Canada</option>
        <option value="uk">United Kingdom</option>
        <option value="fr">France</option>
        <option value="de">Germany</option>
      </FormField>
    );
  },
};

// Size variants
export const Sizes = {
  render: () => {
    const [small, setSmall] = useState('');
    const [normal, setNormal] = useState('');
    const [large, setLarge] = useState('');

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <FormField
          name="small"
          label="Small Input"
          type="text"
          value={small}
          onChange={(e) => setSmall(e.target.value)}
          placeholder="Small size"
          size="sm"
        />
        
        <FormField
          name="normal"
          label="Normal Input"
          type="text"
          value={normal}
          onChange={(e) => setNormal(e.target.value)}
          placeholder="Default size"
        />
        
        <FormField
          name="large"
          label="Large Input"
          type="text"
          value={large}
          onChange={(e) => setLarge(e.target.value)}
          placeholder="Large size"
          size="lg"
        />
      </div>
    );
  },
};

// Complete form example
export const CompleteFormExample = {
  render: () => {
    const [formData, setFormData] = useState({
      name: '',
      email: '',
      budget: '',
      date: '',
      description: '',
      category: '',
    });

    const handleChange = (e) => {
      setFormData({
        ...formData,
        [e.target.name]: e.target.value,
      });
    };

    return (
      <Form style={{ maxWidth: '600px' }} className="form-unified">
        <h4 className="mb-4">Create New Experience</h4>
        
        <FormField
          name="name"
          label="Experience Name"
          type="text"
          value={formData.name}
          onChange={handleChange}
          placeholder="e.g., Weekend in Paris"
          required
          tooltip="Choose a memorable name for your experience"
        />

        <FormField
          name="category"
          label="Category"
          as="select"
          value={formData.category}
          onChange={handleChange}
          required
        >
          <option value="">Select a category...</option>
          <option value="adventure">Adventure</option>
          <option value="cultural">Cultural</option>
          <option value="relaxation">Relaxation</option>
          <option value="culinary">Culinary</option>
        </FormField>

        <FormField
          name="budget"
          label="Estimated Budget"
          type="number"
          value={formData.budget}
          onChange={handleChange}
          placeholder="0.00"
          prepend="$"
          helpText="Approximate cost per person"
        />

        <FormField
          name="date"
          label="Planned Date"
          type="date"
          value={formData.date}
          onChange={handleChange}
        />

        <FormField
          name="email"
          label="Contact Email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="your.email@example.com"
          required
        />

        <FormField
          name="description"
          label="Description"
          as="textarea"
          rows={4}
          value={formData.description}
          onChange={handleChange}
          placeholder="Describe your experience..."
          helpText="Share details that will help others plan their trip"
        />

        <div className="d-flex gap-2">
          <button type="submit" className="btn btn-gradient">
            Create Experience
          </button>
          <button type="button" className="btn btn-outline-custom">
            Cancel
          </button>
        </div>
      </Form>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Complete form example with all FormField features combined.',
      },
    },
  },
};
