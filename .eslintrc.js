/**
 * ESLint Configuration
 * 
 * Extends react-app preset and adds custom rules to enforce
 * secure permission handling patterns.
 */

module.exports = {
  extends: [
    'react-app',
    'react-app/jest',
    'plugin:storybook/recommended'
  ],
  
  rules: {
    /**
     * Prevent direct mutations of .permissions arrays
     * 
     * All permission changes MUST go through the permission enforcer
     * to ensure:
     * - Audit trail creation (Activity model)
     * - Atomic operations (race condition prevention)
     * - Validation (circular dependency checks)
     * - Authorization (only owners can modify permissions)
     * 
     * ❌ BAD:  resource.permissions.push(newPerm)
     * ✅ GOOD: enforcer.addPermission(resource, userId, 'collaborator')
     * 
     * ❌ BAD:  resource.permissions.splice(index, 1)
     * ✅ GOOD: enforcer.removePermission(resource, userId)
     * 
     * Note: Read-only operations (.filter(), .map() for queries) are allowed
     * when not used for assignment back to .permissions
     */
    'no-restricted-syntax': [
      'error',
      {
        selector: 'CallExpression[callee.object.property.name="permissions"][callee.property.name="push"]',
        message: '🚫 Direct .permissions.push() is forbidden. Use enforcer.addPermission() to ensure audit trail and atomic operations.'
      },
      {
        selector: 'CallExpression[callee.object.property.name="permissions"][callee.property.name="splice"]',
        message: '🚫 Direct .permissions.splice() is forbidden. Use enforcer.removePermission() to ensure audit trail and atomic operations.'
      },
      {
        selector: 'CallExpression[callee.object.property.name="permissions"][callee.property.name="unshift"]',
        message: '🚫 Direct .permissions.unshift() is forbidden. Use enforcer.addPermission() to ensure audit trail and atomic operations.'
      },
      {
        selector: 'CallExpression[callee.object.property.name="permissions"][callee.property.name="shift"]',
        message: '🚫 Direct .permissions.shift() is forbidden. Use enforcer.removePermission() to ensure audit trail and atomic operations.'
      },
      {
        selector: 'CallExpression[callee.object.property.name="permissions"][callee.property.name="pop"]',
        message: '🚫 Direct .permissions.pop() is forbidden. Use enforcer.removePermission() to ensure audit trail and atomic operations.'
      },
      {
        // Block assignment of filtered/mapped results back to .permissions
        selector: 'AssignmentExpression[left.property.name="permissions"][right.type="CallExpression"]',
        message: '🚫 Direct .permissions reassignment is forbidden. Use enforcer methods to ensure audit trail and atomic operations.'
      }
    ],

    /**
     * Prevent direct use of deprecated permissions functions
     * 
     * These functions were removed from utilities/permissions.js
     * Use permission-enforcer.js methods instead.
     */
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: '../../utilities/permissions',
            importNames: ['addPermission', 'removePermission', 'updatePermissionType'],
            message: '🚫 These functions are deprecated. Use PermissionEnforcer from utilities/permission-enforcer.js'
          },
          {
            name: '../utilities/permissions',
            importNames: ['addPermission', 'removePermission', 'updatePermissionType'],
            message: '🚫 These functions are deprecated. Use PermissionEnforcer from utilities/permission-enforcer.js'
          }
        ]
      }
    ]
  },

  /**
   * Override rules for specific files where direct access is legitimate
   */
  overrides: [
    {
      // Permission enforcer itself can access .permissions directly
      files: ['utilities/permission-enforcer.js', 'utilities/permissions.js'],
      rules: {
        'no-restricted-syntax': 'off'
      }
    },
    {
      // Model definitions need to define permissions schema
      files: ['models/*.js'],
      rules: {
        'no-restricted-syntax': 'off'
      }
    },
    {
      // Controllers need to initialize permissions for NEW resources
      // Pattern: req.body.permissions = [{...owner...}]
      // Also allow read-only operations (.filter(), .map()) for queries
      files: ['controllers/**/*.js'],
      rules: {
        'no-restricted-syntax': [
          'error',
          // Only block actual mutation methods
          {
            selector: 'CallExpression[callee.object.property.name="permissions"][callee.property.name="push"]',
            message: '🚫 Direct .permissions.push() is forbidden. Use enforcer.addPermission() to ensure audit trail and atomic operations.'
          },
          {
            selector: 'CallExpression[callee.object.property.name="permissions"][callee.property.name="splice"]',
            message: '🚫 Direct .permissions.splice() is forbidden. Use enforcer.removePermission() to ensure audit trail and atomic operations.'
          },
          {
            selector: 'CallExpression[callee.object.property.name="permissions"][callee.property.name="unshift"]',
            message: '🚫 Direct .permissions.unshift() is forbidden. Use enforcer.addPermission() to ensure audit trail and atomic operations.'
          },
          {
            selector: 'CallExpression[callee.object.property.name="permissions"][callee.property.name="shift"]',
            message: '🚫 Direct .permissions.shift() is forbidden. Use enforcer.removePermission() to ensure audit trail and atomic operations.'
          },
          {
            selector: 'CallExpression[callee.object.property.name="permissions"][callee.property.name="pop"]',
            message: '🚫 Direct .permissions.pop() is forbidden. Use enforcer.removePermission() to ensure audit trail and atomic operations.'
          }
          // Note: .filter() and .map() are allowed for read-only queries
          // Assignment back to .permissions is caught by parent rule
        ]
      }
    },
    {
      // Tests may need to inspect permissions directly for assertions
      files: ['tests/**/*.js', '**/*.test.js', '**/*.spec.js'],
      rules: {
        'no-restricted-syntax': 'warn' // Warn but don't error in tests
      }
    },
    {
      // Migration scripts and data scripts need direct access
      files: ['sampleData.js', 'addData.js', 'getData.js', 'migrations/*.js', 'scripts/*.js'],
      rules: {
        'no-restricted-syntax': 'off'
      }
    }
  ]
};
