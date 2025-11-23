/**
 * SASS Compilation Test Story
 *
 * This story verifies that SCSS files compile correctly in Storybook.
 * Tests:
 * - SCSS module import
 * - SASS variables
 * - SASS mixins
 * - Design token usage
 */

import React from 'react';
import styles from '../styles/scss/test.module.scss';

export default {
  title: 'Development/SASS Test',
  parameters: {
    docs: {
      description: {
        component: 'Test story to verify SCSS compilation works in Storybook.',
      },
    },
  },
};

export const BasicStyles = () => (
  <div className={styles.testContainer}>
    <h2 className={styles.testHeading}>SASS Compilation Test</h2>
    <div className={styles.testFlex}>
      <div>✅ SCSS module imported</div>
      <div>✅ Class names applied</div>
      <div>✅ Styles compiled</div>
    </div>
    <p>If you can see styled content above with proper spacing and colors, SCSS compilation is working!</p>
  </div>
);

BasicStyles.parameters = {
  docs: {
    description: {
      story: 'Tests basic SCSS module import and compilation. Should show a styled card with heading and flexbox layout.',
    },
  },
};
