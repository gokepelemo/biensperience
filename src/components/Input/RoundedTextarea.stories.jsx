import React, { useState } from 'react';
import RoundedTextarea from './RoundedTextarea';

export default {
  title: 'Components/RoundedTextarea',
  component: RoundedTextarea,
  parameters: {
    docs: { description: { component: 'Rounded textarea built as a FormField variation. Shows helper text and counter.' } }
  }
};

export const Default = {
  render: () => {
    const [value, setValue] = useState('');
    return (
      <div style={{ width: 600 }}>
        <RoundedTextarea
          name="notes"
          label="Label"
          helper="This is an input helper text."
          placeholder="Enter your main text here..."
          maxLength={300}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rounded
        />
      </div>
    );
  }
};

export const WithVariant = {
  render: () => {
    const [value, setValue] = useState('Some existing text');
    return (
      <div style={{ width: 600 }}>
        <RoundedTextarea
          name="notes2"
          label="Label"
          helper="This is an input helper text."
          placeholder="Enter your main text here..."
          maxLength={300}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rounded
          variant="accent"
        />
      </div>
    );
  }
};
