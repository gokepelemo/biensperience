/**
 * Tooltip Stories
 * Comprehensive Storybook stories for tooltip implementations.
 * Includes dark mode compatibility testing with design tokens.
 */

import React, { useState } from 'react';
import { FaInfoCircle, FaQuestionCircle, FaExclamationTriangle, FaCheckCircle, FaCog } from 'react-icons/fa';
import Tooltip, { FormTooltip } from '../../components/Tooltip/Tooltip';
import InfoTooltip from '../../components/InfoTooltip/InfoTooltip';
import { TooltipProvider } from '../../contexts/TooltipContext';

export default {
  title: 'Components/Feedback/Tooltips',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
Tooltip components for displaying contextual information.

## Design Token Compliance
All tooltips use design tokens for dark mode compatibility:
- Background: \`var(--color-bg-primary)\` / \`var(--color-bg-secondary)\`
- Text: \`var(--color-text-primary)\` / \`var(--color-text-secondary)\`
- Border: \`var(--color-border-light)\`

## Accessibility
- WCAG 2.1 Level AA compliant
- Keyboard navigable (Tab + Enter/Space)
- Touch-friendly (44px minimum targets)
- Screen reader support with aria-describedby
        `,
      },
    },
  },
  decorators: [
    (Story) => (
      <TooltipProvider>
        <Story />
      </TooltipProvider>
    ),
  ],
};

// ============================================================
// Basic Tooltip Stories
// ============================================================

export const BasicTooltip = {
  name: 'Basic Tooltip',
  render: () => (
    <div style={{ padding: '100px', display: 'flex', flexDirection: 'column', gap: '32px', alignItems: 'center' }}>
      <h2 style={{ margin: 0, color: 'var(--color-text-primary)' }}>Bootstrap Tooltip Component</h2>
      <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
        Hover or focus on the button to see the tooltip
      </p>

      <Tooltip content="This is a helpful tooltip message">
        <button className="btn btn-primary">Hover me</button>
      </Tooltip>
    </div>
  ),
};

export const TooltipPlacements = {
  name: 'Tooltip Placements',
  render: () => (
    <div style={{ padding: '100px 50px', display: 'flex', flexDirection: 'column', gap: '48px', alignItems: 'center' }}>
      <h2 style={{ margin: 0, color: 'var(--color-text-primary)' }}>Placement Options</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', maxWidth: '400px' }}>
        <div></div>
        <Tooltip content="Tooltip on top" placement="top">
          <button className="btn btn-outline-secondary">Top</button>
        </Tooltip>
        <div></div>

        <Tooltip content="Tooltip on left" placement="left">
          <button className="btn btn-outline-secondary">Left</button>
        </Tooltip>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: 'var(--color-text-tertiary)' }}>Center</span>
        </div>
        <Tooltip content="Tooltip on right" placement="right">
          <button className="btn btn-outline-secondary">Right</button>
        </Tooltip>

        <div></div>
        <Tooltip content="Tooltip on bottom" placement="bottom">
          <button className="btn btn-outline-secondary">Bottom</button>
        </Tooltip>
        <div></div>
      </div>
    </div>
  ),
};

export const TooltipWithDelay = {
  name: 'Tooltip with Delay',
  render: () => (
    <div style={{ padding: '100px', display: 'flex', flexDirection: 'column', gap: '24px', alignItems: 'center' }}>
      <h2 style={{ margin: 0, color: 'var(--color-text-primary)' }}>Delay Options</h2>

      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Tooltip content="Instant tooltip" delay={0}>
          <button className="btn btn-outline-primary">No Delay</button>
        </Tooltip>

        <Tooltip content="Shows after 300ms" delayShow={300}>
          <button className="btn btn-outline-primary">300ms Show</button>
        </Tooltip>

        <Tooltip content="Shows after 500ms, hides after 200ms" delayShow={500} delayHide={200}>
          <button className="btn btn-outline-primary">Custom Delays</button>
        </Tooltip>
      </div>
    </div>
  ),
};

export const TooltipWithRichContent = {
  name: 'Tooltip with Rich Content',
  render: () => (
    <div style={{ padding: '100px', display: 'flex', flexDirection: 'column', gap: '24px', alignItems: 'center' }}>
      <h2 style={{ margin: 0, color: 'var(--color-text-primary)' }}>Rich Content Tooltips</h2>

      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Tooltip
          content={
            <div>
              <strong>Bold Title</strong>
              <br />
              Regular description text with <em>emphasis</em>.
            </div>
          }
        >
          <button className="btn btn-secondary">HTML Content</button>
        </Tooltip>

        <Tooltip
          content={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FaCheckCircle style={{ color: 'var(--color-success)' }} />
              <span>Verified content</span>
            </div>
          }
        >
          <button className="btn btn-secondary">With Icon</button>
        </Tooltip>

        <Tooltip
          content={
            <ul style={{ margin: 0, paddingLeft: '16px', textAlign: 'left' }}>
              <li>First item</li>
              <li>Second item</li>
              <li>Third item</li>
            </ul>
          }
        >
          <button className="btn btn-secondary">List Content</button>
        </Tooltip>
      </div>
    </div>
  ),
};

// ============================================================
// FormTooltip Stories
// ============================================================

export const FormTooltipBasic = {
  name: 'Form Tooltip - Basic',
  render: () => (
    <div style={{ padding: '50px', maxWidth: '400px', margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 24px', color: 'var(--color-text-primary)' }}>Form Field Tooltips</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            marginBottom: '8px'
          }}>
            Email Address
            <FormTooltip content="We'll never share your email with anyone." />
          </label>
          <input
            type="email"
            className="form-control"
            placeholder="Enter your email"
          />
        </div>

        <div>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            marginBottom: '8px'
          }}>
            Password
            <FormTooltip content="Must be at least 8 characters with one uppercase letter and one number." />
          </label>
          <input
            type="password"
            className="form-control"
            placeholder="Enter your password"
          />
        </div>

        <div>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            marginBottom: '8px'
          }}>
            Cost Estimate
            <FormTooltip content="Enter an estimated cost in USD. This helps others budget for the experience." />
          </label>
          <div className="input-group">
            <span className="input-group-text">$</span>
            <input
              type="number"
              className="form-control"
              placeholder="0.00"
            />
          </div>
        </div>
      </div>
    </div>
  ),
};

export const FormTooltipCustomIcons = {
  name: 'Form Tooltip - Custom Icons',
  render: () => (
    <div style={{ padding: '50px', maxWidth: '400px', margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 24px', color: 'var(--color-text-primary)' }}>Custom Icon Variants</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            marginBottom: '8px'
          }}>
            Default Icon
            <FormTooltip content="Default info icon tooltip" />
          </label>
          <input type="text" className="form-control" placeholder="Field with default icon" />
        </div>

        <div>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            marginBottom: '8px'
          }}>
            Question Icon
            <FormTooltip content="Help information" icon="❓" />
          </label>
          <input type="text" className="form-control" placeholder="Field with question icon" />
        </div>

        <div>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            marginBottom: '8px'
          }}>
            Warning Icon
            <FormTooltip
              content="This field is required"
              icon="⚠️"
              iconClass="text-warning ms-2"
            />
          </label>
          <input type="text" className="form-control" placeholder="Required field" />
        </div>
      </div>
    </div>
  ),
};

// ============================================================
// InfoTooltip Stories (Portal-based)
// ============================================================

export const InfoTooltipBasic = {
  name: 'InfoTooltip - Basic',
  render: () => (
    <div style={{ padding: '100px', display: 'flex', flexDirection: 'column', gap: '24px', alignItems: 'center' }}>
      <h2 style={{ margin: 0, color: 'var(--color-text-primary)' }}>Portal-Based InfoTooltip</h2>
      <p style={{ margin: 0, color: 'var(--color-text-secondary)', textAlign: 'center' }}>
        Click the info icon to toggle the tooltip.<br />
        Uses React Portal to escape container overflow.
      </p>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '16px 24px',
        background: 'var(--color-bg-secondary)',
        borderRadius: '8px'
      }}>
        <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>Total Cost:</span>
        <span style={{ color: 'var(--color-text-primary)' }}>$1,234</span>
        <InfoTooltip
          id="cost-tooltip"
          content={
            <div style={{ textAlign: 'left' }}>
              <strong>Cost Breakdown:</strong>
              <ul style={{ margin: '8px 0 0', paddingLeft: '16px' }}>
                <li>Accommodation: $600</li>
                <li>Transportation: $300</li>
                <li>Activities: $234</li>
                <li>Food: $100</li>
              </ul>
            </div>
          }
        />
      </div>
    </div>
  ),
};

export const InfoTooltipPositioning = {
  name: 'InfoTooltip - Auto Positioning',
  render: () => (
    <div style={{ padding: '50px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <h2 style={{ margin: 0, color: 'var(--color-text-primary)' }}>Auto-Positioning Demo</h2>
      <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
        Tooltips automatically flip above/below based on available viewport space.
      </p>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: '16px',
        flexWrap: 'wrap'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 16px',
          background: 'var(--color-bg-secondary)',
          borderRadius: '8px'
        }}>
          <span style={{ color: 'var(--color-text-primary)' }}>Left edge</span>
          <InfoTooltip
            id="left-tooltip"
            content="This tooltip appears near the left edge and should position correctly."
          />
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 16px',
          background: 'var(--color-bg-secondary)',
          borderRadius: '8px'
        }}>
          <span style={{ color: 'var(--color-text-primary)' }}>Center</span>
          <InfoTooltip
            id="center-tooltip"
            content="This tooltip is centered in the viewport."
          />
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 16px',
          background: 'var(--color-bg-secondary)',
          borderRadius: '8px'
        }}>
          <span style={{ color: 'var(--color-text-primary)' }}>Right edge</span>
          <InfoTooltip
            id="right-tooltip"
            content="This tooltip appears near the right edge and should position correctly."
          />
        </div>
      </div>

      {/* Bottom positioned tooltips */}
      <div style={{ marginTop: 'auto', paddingTop: '200px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 16px',
          background: 'var(--color-bg-secondary)',
          borderRadius: '8px',
          width: 'fit-content'
        }}>
          <span style={{ color: 'var(--color-text-primary)' }}>Near bottom</span>
          <InfoTooltip
            id="bottom-tooltip"
            content="This tooltip should flip above the trigger when near viewport bottom."
          />
        </div>
      </div>
    </div>
  ),
};

export const InfoTooltipInOverflow = {
  name: 'InfoTooltip - Overflow Container',
  render: () => (
    <div style={{ padding: '50px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <h2 style={{ margin: 0, color: 'var(--color-text-primary)' }}>Overflow Container Demo</h2>
      <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
        InfoTooltip uses Portal to render outside containers with overflow: hidden.
      </p>

      <div style={{
        padding: '24px',
        background: 'var(--color-bg-secondary)',
        borderRadius: '12px',
        overflow: 'hidden', // This would clip regular tooltips!
        border: '2px dashed var(--color-border-medium)'
      }}>
        <p style={{ margin: '0 0 16px', color: 'var(--color-text-tertiary)', fontSize: '0.875rem' }}>
          Container has <code>overflow: hidden</code>
        </p>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span style={{ color: 'var(--color-text-primary)' }}>Click for tooltip</span>
          <InfoTooltip
            id="overflow-tooltip"
            content="This tooltip renders via Portal, so it escapes the overflow: hidden container and displays correctly above the trigger element."
          />
        </div>
      </div>
    </div>
  ),
};

// ============================================================
// Dark Mode Testing
// ============================================================

export const DarkModeCompatibility = {
  name: 'Dark Mode Compatibility',
  parameters: {
    backgrounds: { default: 'dark' },
  },
  render: () => (
    <div style={{ padding: '50px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div>
        <h2 style={{ margin: '0 0 8px', color: 'var(--color-text-primary)' }}>
          Dark Mode Tooltip Testing
        </h2>
        <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
          All text and backgrounds use design tokens for automatic dark mode support.
        </p>
      </div>

      <div style={{
        padding: '24px',
        background: 'var(--color-bg-secondary)',
        borderRadius: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }}>
        <h3 style={{ margin: 0, color: 'var(--color-text-primary)' }}>Test Area</h3>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <Tooltip content="Primary text color: var(--color-text-primary)">
            <button className="btn btn-primary">Primary Button</button>
          </Tooltip>

          <Tooltip content="Secondary styling with design tokens">
            <button className="btn btn-secondary">Secondary Button</button>
          </Tooltip>

          <Tooltip content="Outline button maintains contrast">
            <button className="btn btn-outline-primary">Outline Button</button>
          </Tooltip>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '16px',
          background: 'var(--color-bg-tertiary)',
          borderRadius: '8px'
        }}>
          <span style={{ color: 'var(--color-text-primary)' }}>InfoTooltip in dark mode</span>
          <InfoTooltip
            id="dark-mode-test"
            content={
              <div>
                <strong>Token Usage:</strong>
                <ul style={{ margin: '8px 0 0', paddingLeft: '16px' }}>
                  <li>Background: var(--color-bg-primary)</li>
                  <li>Text: var(--color-text-primary)</li>
                  <li>Border: var(--color-border-light)</li>
                </ul>
              </div>
            }
          />
        </div>
      </div>

      <div style={{
        padding: '24px',
        background: 'var(--color-bg-primary)',
        borderRadius: '12px',
        border: '1px solid var(--color-border-light)'
      }}>
        <h3 style={{ margin: '0 0 16px', color: 'var(--color-text-primary)' }}>Form Field Example</h3>

        <div>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            marginBottom: '8px'
          }}>
            Experience Title
            <FormTooltip content="Give your experience a descriptive, memorable title." />
          </label>
          <input
            type="text"
            className="form-control"
            placeholder="e.g., Tokyo Food Adventure"
          />
        </div>
      </div>
    </div>
  ),
};

// ============================================================
// Accessibility Testing
// ============================================================

export const AccessibilityDemo = {
  name: 'Accessibility Features',
  render: () => (
    <div style={{ padding: '50px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div>
        <h2 style={{ margin: '0 0 8px', color: 'var(--color-text-primary)' }}>
          Accessibility Features
        </h2>
        <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
          All tooltips meet WCAG 2.1 Level AA requirements.
        </p>
      </div>

      <div style={{
        padding: '24px',
        background: 'var(--color-bg-secondary)',
        borderRadius: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }}>
        <div>
          <h3 style={{ margin: '0 0 8px', color: 'var(--color-text-primary)' }}>
            Keyboard Navigation
          </h3>
          <p style={{ margin: '0 0 16px', color: 'var(--color-text-tertiary)', fontSize: '0.875rem' }}>
            Use Tab to focus, Enter/Space to activate (InfoTooltip)
          </p>

          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <Tooltip content="Tab + hover/focus to show">
              <button className="btn btn-outline-primary">Tooltip (Tab + Focus)</button>
            </Tooltip>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: 'var(--color-text-primary)' }}>InfoTooltip</span>
              <InfoTooltip
                id="keyboard-test"
                content="Press Tab to focus, Enter to toggle"
                ariaLabel="Show cost information"
              />
            </div>
          </div>
        </div>

        <div>
          <h3 style={{ margin: '0 0 8px', color: 'var(--color-text-primary)' }}>
            Touch Targets (44x44px minimum)
          </h3>
          <p style={{ margin: '0 0 16px', color: 'var(--color-text-tertiary)', fontSize: '0.875rem' }}>
            All interactive elements meet WCAG touch target requirements
          </p>

          <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
            <InfoTooltip
              id="touch-test-1"
              content="This button is 44x44px minimum"
            />
            <InfoTooltip
              id="touch-test-2"
              content="Accessible on mobile devices"
            >
              <FaQuestionCircle style={{ fontSize: '24px', color: 'var(--color-primary)' }} />
            </InfoTooltip>
            <InfoTooltip
              id="touch-test-3"
              content="Touch-friendly target size"
            >
              <FaCog style={{ fontSize: '24px', color: 'var(--color-text-secondary)' }} />
            </InfoTooltip>
          </div>
        </div>

        <div>
          <h3 style={{ margin: '0 0 8px', color: 'var(--color-text-primary)' }}>
            Screen Reader Support
          </h3>
          <p style={{ margin: '0 0 16px', color: 'var(--color-text-tertiary)', fontSize: '0.875rem' }}>
            Uses aria-describedby to associate tooltip content with trigger
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--color-text-primary)' }}>Estimated cost: $1,200</span>
            <InfoTooltip
              id="sr-test"
              content="Based on average prices for similar experiences in this region"
              ariaLabel="Information about cost estimate"
            />
          </div>
        </div>
      </div>
    </div>
  ),
};
