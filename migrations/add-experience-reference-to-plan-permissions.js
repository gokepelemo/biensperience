/**
 * Migration: Add experience reference to plan permissions
 *
 * Purpose: Enable permission inheritance from experiences to plans
 *
 * Problem:
 * - Plans were created with only the owner's user permission
 * - No reference to the experience in the permissions array
 * - Experience collaborators couldn't be assigned to plan items
 * - Permission inheritance from experience to plan didn't work
 *
 * Solution:
 * - Add an experience permission entry to each plan's permissions array
 * - This enables resolvePermissionsWithInheritance to work correctly
 * - Experience collaborators can now be assigned to plan items
 *
 * Date: 2025-11-22
 * Issue: biensperience-6c33
 */

const mongoose = require('mongoose');
require('dotenv').config();

const Plan = require('../models/plan');
const backendLogger = require('../utilities/backend-logger');

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    backendLogger.info('Connected to MongoDB');

    // Find all plans that don't have an experience reference in permissions
    const plansWithoutExpRef = await Plan.find({
      'permissions.entity': { $ne: 'experience' }
    });

    backendLogger.info('Migration: add-experience-reference-to-plan-permissions', {
      totalPlans: plansWithoutExpRef.length
    });

    let updated = 0;
    let errors = 0;

    for (const plan of plansWithoutExpRef) {
      try {
        // Check if experience reference already exists (defensive)
        const hasExpRef = plan.permissions.some(p => p.entity === 'experience' && p._id.toString() === plan.experience.toString());

        if (hasExpRef) {
          backendLogger.debug('Plan already has experience reference, skipping', {
            planId: plan._id.toString()
          });
          continue;
        }

        // Get the owner permission to use as granted_by
        const ownerPerm = plan.permissions.find(p => p.entity === 'user' && p.type === 'owner');
        const grantedBy = ownerPerm ? ownerPerm._id : plan.user;

        // Add experience reference to permissions
        plan.permissions.push({
          _id: plan.experience,
          entity: 'experience',
          type: 'collaborator', // Inherit experience permissions
          granted_by: grantedBy,
          granted_at: new Date()
        });

        await plan.save();
        updated++;

        if (updated % 100 === 0) {
          backendLogger.info('Migration progress', { updated });
        }
      } catch (error) {
        errors++;
        backendLogger.error('Error updating plan', {
          planId: plan._id.toString(),
          error: error.message
        });
      }
    }

    backendLogger.info('Migration completed', {
      total: plansWithoutExpRef.length,
      updated,
      errors,
      skipped: plansWithoutExpRef.length - updated - errors
    });

  } catch (error) {
    backendLogger.error('Migration failed', { error: error.message, stack: error.stack });
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    backendLogger.info('MongoDB connection closed');
    process.exit(0);
  }
}

// Run migration
migrate();
