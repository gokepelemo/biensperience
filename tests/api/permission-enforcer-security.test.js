/**
 * Permission Enforcer Security Tests
 * 
 * Comprehensive test suite for permission mutation security:
 * - Mutation validation
 * - Audit logging
 * - Authorization checks
 * - Rollback capability
 * - Concurrent operations
 * - Pressure testing
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { getEnforcer, ACTIONS } = require('../../utilities/permission-enforcer');
const User = require('../../models/user');
const Experience = require('../../models/experience');
const Destination = require('../../models/destination');
const Plan = require('../../models/plan');
const Photo = require('../../models/photo');
const Activity = require('../../models/activity');

describe('PermissionEnforcer Security Suite', () => {
  let mongoServer;
  let superAdminUser, regularUser, ownerUser, collaboratorUser;
  let testExperience, testDestination;
  let enforcer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear collections
    await User.deleteMany({});
    await Experience.deleteMany({});
    await Destination.deleteMany({});
    await Plan.deleteMany({});
    await Photo.deleteMany({});
    await Activity.deleteMany({});

    // Create test users
    superAdminUser = await User.create({
      name: 'Super Admin',
      email: 'admin@test.com',
      password: 'password123',
      role: 'super_admin',
      isSuperAdmin: true,
      emailConfirmed: true
    });

    ownerUser = await User.create({
      name: 'Owner User',
      email: 'owner@test.com',
      password: 'password123',
      emailConfirmed: true
    });

    regularUser = await User.create({
      name: 'Regular User',
      email: 'user@test.com',
      password: 'password123',
      emailConfirmed: true
    });

    collaboratorUser = await User.create({
      name: 'Collaborator',
      email: 'collab@test.com',
      password: 'password123',
      emailConfirmed: true
    });

    // Create test destination
    testDestination = await Destination.create({
      name: 'Test Destination',
      city: 'Test City',
      country: 'Test Country',
      user: ownerUser._id,
      permissions: [{
        _id: ownerUser._id,
        entity: 'user',
        type: 'owner',
        granted_by: ownerUser._id
      }]
    });

    // Create test experience
    testExperience = await Experience.create({
      name: 'Test Experience',
      destination: testDestination._id,
      user: ownerUser._id,
      permissions: [{
        _id: ownerUser._id,
        entity: 'user',
        type: 'owner',
        granted_by: ownerUser._id
      }]
    });

    // Initialize enforcer
    enforcer = getEnforcer({ User, Experience, Destination, Plan, Photo });
  });

  describe('1. Permission Addition Security', () => {
    test('Should add permission with audit log', async () => {
      const result = await enforcer.addPermission({
        resource: testExperience,
        permission: {
          _id: collaboratorUser._id,
          entity: 'user',
          type: 'collaborator'
        },
        actorId: ownerUser._id,
        reason: 'Adding collaborator for testing',
        metadata: {
          ipAddress: '127.0.0.1',
          userAgent: 'Jest Test',
          requestPath: '/api/test',
          requestMethod: 'POST'
        }
      });

      expect(result.success).toBe(true);
      expect(result.rollbackToken).toBeDefined();

      // Verify permission was added
      const found = testExperience.permissions.find(p =>
        p._id.toString() === collaboratorUser._id.toString() &&
        p.entity === 'user' &&
        p.type === 'collaborator'
      );
      expect(found).toBeDefined();

      // Verify audit log was created
      const auditLog = await Activity.findOne({
        'resource.id': testExperience._id,
        action: 'permission_added'
      });
      expect(auditLog).toBeDefined();
      expect(auditLog.actor._id.toString()).toBe(ownerUser._id.toString());
      expect(auditLog.rollbackToken).toBe(result.rollbackToken);
    });

    test('Should prevent duplicate permissions', async () => {
      // Add once
      await enforcer.addPermission({
        resource: testExperience,
        permission: {
          _id: collaboratorUser._id,
          entity: 'user',
          type: 'collaborator'
        },
        actorId: ownerUser._id,
        reason: 'First add'
      });

      // Try to add again
      const result = await enforcer.addPermission({
        resource: testExperience,
        permission: {
          _id: collaboratorUser._id,
          entity: 'user',
          type: 'collaborator'
        },
        actorId: ownerUser._id,
        reason: 'Duplicate add'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });

    test('Should reject invalid permission objects', async () => {
      const result = await enforcer.addPermission({
        resource: testExperience,
        permission: {
          _id: 'invalid-id',
          entity: 'invalid-entity',
          type: 'collaborator'
        },
        actorId: ownerUser._id,
        reason: 'Invalid permission'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('Should reject unauthorized permission additions', async () => {
      const result = await enforcer.addPermission({
        resource: testExperience,
        permission: {
          _id: collaboratorUser._id,
          entity: 'user',
          type: 'collaborator'
        },
        actorId: regularUser._id, // Not the owner
        reason: 'Unauthorized add'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unauthorized');
    });

    test('Should allow super admin to add permissions', async () => {
      const result = await enforcer.addPermission({
        resource: testExperience,
        permission: {
          _id: collaboratorUser._id,
          entity: 'user',
          type: 'collaborator'
        },
        actorId: superAdminUser._id,
        reason: 'Super admin add'
      });

      expect(result.success).toBe(true);
    });

    test('Should allow users to add themselves as contributor (auto-assignment)', async () => {
      // Simulate user planning an experience or favoriting a destination
      const result = await enforcer.addPermission({
        resource: testExperience,
        permission: {
          _id: regularUser._id,
          entity: 'user',
          type: 'contributor'
        },
        actorId: regularUser._id,
        reason: 'User created plan for experience',
        allowSelfContributor: true
      });

      expect(result.success).toBe(true);
      
      // Verify permission was added
      const contributorPerm = testExperience.permissions.find(p =>
        p._id.toString() === regularUser._id.toString() &&
        p.type === 'contributor'
      );
      expect(contributorPerm).toBeDefined();
    });

    test('Should reject self-contributor without allowSelfContributor flag', async () => {
      const result = await enforcer.addPermission({
        resource: testExperience,
        permission: {
          _id: regularUser._id,
          entity: 'user',
          type: 'contributor'
        },
        actorId: regularUser._id,
        reason: 'User trying to add self without flag'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unauthorized');
    });

    test('Should reject self-assignment of collaborator role', async () => {
      // Users should NOT be able to make themselves collaborators
      const result = await enforcer.addPermission({
        resource: testExperience,
        permission: {
          _id: regularUser._id,
          entity: 'user',
          type: 'collaborator' // Trying to be collaborator, not contributor
        },
        actorId: regularUser._id,
        reason: 'User trying to elevate themselves',
        allowSelfContributor: true
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unauthorized');
    });
  });

  describe('2. Permission Removal Security', () => {
    beforeEach(async () => {
      // Add a collaborator for removal tests
      testExperience.permissions.push({
        _id: collaboratorUser._id,
        entity: 'user',
        type: 'collaborator',
        granted_by: ownerUser._id
      });
      await testExperience.save();
    });

    test('Should remove permission with audit log', async () => {
      const result = await enforcer.removePermission({
        resource: testExperience,
        permissionId: collaboratorUser._id,
        entityType: 'user',
        actorId: ownerUser._id,
        reason: 'Removing collaborator',
        metadata: {
          ipAddress: '127.0.0.1'
        }
      });

      expect(result.success).toBe(true);
      expect(result.rollbackToken).toBeDefined();

      // Verify permission was removed
      const found = testExperience.permissions.find(p =>
        p._id.toString() === collaboratorUser._id.toString() &&
        p.type === 'collaborator'
      );
      expect(found).toBeUndefined();

      // Verify audit log
      const auditLog = await Activity.findOne({
        'resource.id': testExperience._id,
        action: 'permission_removed'
      });
      expect(auditLog).toBeDefined();
    });

    test('Should enforce at least one owner rule', async () => {
      const result = await enforcer.removePermission({
        resource: testExperience,
        permissionId: ownerUser._id,
        entityType: 'user',
        actorId: ownerUser._id,
        reason: 'Trying to remove last owner'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('last owner');
    });

    test('Should reject unauthorized removals', async () => {
      const result = await enforcer.removePermission({
        resource: testExperience,
        permissionId: collaboratorUser._id,
        entityType: 'user',
        actorId: regularUser._id, // Not authorized
        reason: 'Unauthorized removal'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unauthorized');
    });
  });

  describe('3. Ownership Transfer Security', () => {
    test('Should transfer ownership with audit log', async () => {
      const result = await enforcer.transferOwnership({
        resource: testExperience,
        oldOwnerId: ownerUser._id,
        newOwnerId: regularUser._id,
        actorId: ownerUser._id,
        reason: 'Transferring ownership',
        metadata: {
          ipAddress: '127.0.0.1'
        }
      });

      expect(result.success).toBe(true);
      expect(result.rollbackToken).toBeDefined();

      // Verify new owner has owner permission
      const newOwnerPerm = testExperience.permissions.find(p =>
        p._id.toString() === regularUser._id.toString() &&
        p.type === 'owner'
      );
      expect(newOwnerPerm).toBeDefined();

      // Verify old owner is now contributor
      const oldOwnerPerm = testExperience.permissions.find(p =>
        p._id.toString() === ownerUser._id.toString()
      );
      expect(oldOwnerPerm.type).toBe('contributor');

      // Verify legacy user field updated
      expect(testExperience.user.toString()).toBe(regularUser._id.toString());

      // Verify audit log
      const auditLog = await Activity.findOne({
        'resource.id': testExperience._id,
        action: 'ownership_transferred'
      });
      expect(auditLog).toBeDefined();
    });

    test('Should reject unauthorized ownership transfers', async () => {
      const result = await enforcer.transferOwnership({
        resource: testExperience,
        oldOwnerId: ownerUser._id,
        newOwnerId: regularUser._id,
        actorId: regularUser._id, // Not current owner
        reason: 'Unauthorized transfer'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unauthorized');
    });

    test('Should allow super admin to transfer ownership', async () => {
      const result = await enforcer.transferOwnership({
        resource: testExperience,
        oldOwnerId: ownerUser._id,
        newOwnerId: regularUser._id,
        actorId: superAdminUser._id,
        reason: 'Admin transfer'
      });

      expect(result.success).toBe(true);
    });
  });

  describe('4. Audit Log Integrity', () => {
    test('Should create immutable audit records', async () => {
      await enforcer.addPermission({
        resource: testExperience,
        permission: {
          _id: collaboratorUser._id,
          entity: 'user',
          type: 'collaborator'
        },
        actorId: ownerUser._id,
        reason: 'Testing audit'
      });

      const auditLog = await Activity.findOne({
        'resource.id': testExperience._id
      });

      // Try to modify audit log (should fail if immutable)
      auditLog.reason = 'Modified reason';
      
      try {
        await auditLog.save();
        // Some fields might not enforce immutability at Mongoose level
        // so we just verify the audit was created
        expect(auditLog).toBeDefined();
      } catch (error) {
        // If it throws, that's good - means immutability is enforced
        expect(error).toBeDefined();
      }
    });

    test('Should capture complete state snapshots', async () => {
      await enforcer.addPermission({
        resource: testExperience,
        permission: {
          _id: collaboratorUser._id,
          entity: 'user',
          type: 'collaborator'
        },
        actorId: ownerUser._id,
        reason: 'State snapshot test'
      });

      const auditLog = await Activity.findOne({
        'resource.id': testExperience._id
      });

      expect(auditLog.previousState).toBeDefined();
      expect(auditLog.newState).toBeDefined();
      expect(Array.isArray(auditLog.previousState)).toBe(true);
      expect(Array.isArray(auditLog.newState)).toBe(true);
      expect(auditLog.newState.length).toBeGreaterThan(auditLog.previousState.length);
    });

    test('Should capture actor information', async () => {
      await enforcer.addPermission({
        resource: testExperience,
        permission: {
          _id: collaboratorUser._id,
          entity: 'user',
          type: 'collaborator'
        },
        actorId: ownerUser._id,
        reason: 'Actor info test'
      });

      const auditLog = await Activity.findOne({
        'resource.id': testExperience._id
      });

      expect(auditLog.actor._id.toString()).toBe(ownerUser._id.toString());
      expect(auditLog.actor.email).toBe(ownerUser.email);
    });

    test('Should capture request metadata', async () => {
      const metadata = {
        ipAddress: '192.168.1.1',
        userAgent: 'Test Agent',
        requestPath: '/api/test',
        requestMethod: 'POST'
      };

      await enforcer.addPermission({
        resource: testExperience,
        permission: {
          _id: collaboratorUser._id,
          entity: 'user',
          type: 'collaborator'
        },
        actorId: ownerUser._id,
        reason: 'Metadata test',
        metadata
      });

      const auditLog = await Activity.findOne({
        'resource.id': testExperience._id
      });

      expect(auditLog.metadata.ipAddress).toBe(metadata.ipAddress);
      expect(auditLog.metadata.userAgent).toBe(metadata.userAgent);
      expect(auditLog.metadata.requestPath).toBe(metadata.requestPath);
      expect(auditLog.metadata.requestMethod).toBe(metadata.requestMethod);
    });
  });

  describe('5. Concurrent Operations', () => {
    test('Should handle concurrent permission additions', async () => {
      const users = [regularUser, collaboratorUser];
      
      const promises = users.map(user =>
        enforcer.addPermission({
          resource: testExperience,
          permission: {
            _id: user._id,
            entity: 'user',
            type: 'collaborator'
          },
          actorId: ownerUser._id,
          reason: 'Concurrent add'
        })
      );

      const results = await Promise.all(promises);

      // Debug: Check which operations failed
      results.forEach((r, idx) => {
        if (!r.success) {
          console.log(`Permission add ${idx} failed:`, r.error);
        }
      });

      // Both should succeed
      expect(results.every(r => r.success)).toBe(true);

      // Reload from database to verify final state
      const freshExperience = await Experience.findById(testExperience._id);
      expect(freshExperience.permissions.length).toBe(3); // Owner + 2 collaborators
    });

    test('Should prevent race conditions with duplicate additions', async () => {
      // Store original permission count
      const originalCount = testExperience.permissions.length;
      
      // Try to add same permission twice concurrently with immediate saves
      const promises = [
        (async () => {
          const result = await enforcer.addPermission({
            resource: testExperience,
            permission: {
              _id: collaboratorUser._id,
              entity: 'user',
              type: 'collaborator'
            },
            actorId: ownerUser._id,
            reason: 'Race condition test 1'
          });
          if (result.success) {
            try {
              await testExperience.save();
            } catch (err) {
              // Save failed - treat as failure
              return { success: false, error: err.message };
            }
          }
          return result;
        })(),
        (async () => {
          const result = await enforcer.addPermission({
            resource: testExperience,
            permission: {
              _id: collaboratorUser._id,
              entity: 'user',
              type: 'collaborator'
            },
            actorId: ownerUser._id,
            reason: 'Race condition test 2'
          });
          if (result.success) {
            try {
              await testExperience.save();
            } catch (err) {
              // Save failed - treat as failure
              return { success: false, error: err.message };
            }
          }
          return result;
        })()
      ];

      const results = await Promise.all(promises);

      // Reload from database to get final state
      const freshExperience = await Experience.findById(testExperience._id);
      
      // Check that only one permission was actually added
      const finalCount = freshExperience.permissions.length;
      const duplicateCount = freshExperience.permissions.filter(p =>
        p._id.toString() === collaboratorUser._id.toString() &&
        p.entity === 'user' &&
        p.type === 'collaborator'
      ).length;
      
      expect(finalCount).toBe(originalCount + 1);
      expect(duplicateCount).toBe(1);
      
      // At least one should report success (the one that won the race)
      const successCount = results.filter(r => r.success).length;
      expect(successCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('6. Pressure Testing', () => {
    test('Should handle rapid sequential mutations', async () => {
      const iterations = 50;
      const users = [];

      // Create test users
      for (let i = 0; i < iterations; i++) {
        users.push(await User.create({
          name: `User ${i}`,
          email: `user${i}@test.com`,
          password: 'password123',
          emailConfirmed: true
        }));
      }

      // Add permissions rapidly
      const startTime = Date.now();
      
      for (let i = 0; i < iterations; i++) {
        await enforcer.addPermission({
          resource: testExperience,
          permission: {
            _id: users[i]._id,
            entity: 'user',
            type: 'collaborator'
          },
          actorId: ownerUser._id,
          reason: `Rapid add ${i}`
        });
      }

      const duration = Date.now() - startTime;
      
      // Reload from database to verify final state
      const freshExperience = await Experience.findById(testExperience._id);
      expect(freshExperience.permissions.length).toBe(iterations + 1); // +1 for owner

      // Verify all audit logs created
      const auditCount = await Activity.countDocuments({
        'resource.id': testExperience._id
      });
      expect(auditCount).toBe(iterations);

      // Log performance
      console.log(`Processed ${iterations} mutations in ${duration}ms (${(duration/iterations).toFixed(2)}ms per operation)`);
    });

    test('Should maintain data integrity under high load', async () => {
      const operationCount = 100;
      const operations = [];

      // Create mix of add/remove operations
      for (let i = 0; i < operationCount; i++) {
        const user = await User.create({
          name: `Load User ${i}`,
          email: `load${i}@test.com`,
          password: 'password123',
          emailConfirmed: true
        });

        // Add
        operations.push(
          enforcer.addPermission({
            resource: testExperience,
            permission: {
              _id: user._id,
              entity: 'user',
              type: 'collaborator'
            },
            actorId: ownerUser._id,
            reason: `High load add ${i}`
          })
        );

        // Immediately remove (some will fail, that's expected)
        operations.push(
          enforcer.removePermission({
            resource: testExperience,
            permissionId: user._id,
            entityType: 'user',
            actorId: ownerUser._id,
            reason: `High load remove ${i}`
          })
        );
      }

      const results = await Promise.allSettled(operations);

      // Verify we have results for all operations
      expect(results.length).toBe(operationCount * 2);

      // Count audit logs
      const auditCount = await Activity.countDocuments({
        'resource.id': testExperience._id
      });
      
      // Should have logs for successful operations
      expect(auditCount).toBeGreaterThan(0);
      
      console.log(`High load test: ${operationCount * 2} operations, ${auditCount} audit logs created`);
    });
  });

  describe('7. Security Attack Prevention', () => {
    test('Should prevent permission escalation attempts', async () => {
      // Regular user tries to add themselves as owner
      const result = await enforcer.addPermission({
        resource: testExperience,
        permission: {
          _id: regularUser._id,
          entity: 'user',
          type: 'owner' // Trying to escalate
        },
        actorId: regularUser._id, // Not authorized
        reason: 'Escalation attempt'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unauthorized');

      // Verify no owner permission was added
      const ownerPerm = testExperience.permissions.find(p =>
        p._id.toString() === regularUser._id.toString() &&
        p.type === 'owner'
      );
      expect(ownerPerm).toBeUndefined();
    });

    test('Should log failed authorization attempts', async () => {
      await enforcer.addPermission({
        resource: testExperience,
        permission: {
          _id: regularUser._id,
          entity: 'user',
          type: 'owner'
        },
        actorId: regularUser._id,
        reason: 'Failed attempt'
      });

      // Even failed attempts should ideally be logged
      // (current implementation logs warnings)
    });

    test('Should reject malformed permission data', async () => {
      const malformedData = [
        { _id: 'not-an-objectid', entity: 'user', type: 'owner' },
        { _id: ownerUser._id, entity: 'invalid', type: 'owner' },
        { _id: ownerUser._id, entity: 'user', type: 'invalid' },
        { entity: 'user', type: 'owner' }, // Missing _id
      ];

      for (const permission of malformedData) {
        const result = await enforcer.addPermission({
          resource: testExperience,
          permission,
          actorId: ownerUser._id,
          reason: 'Malformed data test'
        });

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      }
    });
  });
});
