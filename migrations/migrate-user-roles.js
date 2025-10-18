/**
 * Migration script to add role field to existing users based on isSuperAdmin status
 * Run this script once to migrate existing user data
 */

const mongoose = require('mongoose');
const User = require('../models/User');
const { USER_ROLES } = require('../utilities/user-roles');
require('dotenv').config();

async function migrateUserRoles() {
  try {
    // Connect to database
    await mongoose.connect(process.env.DATABASE_URL || process.env.MONGODB_URI);
    console.log('Connected to database');

    // Update all users to have role field based on isSuperAdmin
    const result = await User.updateMany(
      { role: { $exists: false } }, // Only update users that don't have role field yet
      [
        {
          $set: {
            role: {
              $cond: {
                if: { $eq: ["$isSuperAdmin", true] },
                then: USER_ROLES.SUPER_ADMIN,
                else: USER_ROLES.REGULAR_USER
              }
            }
          }
        }
      ]
    );

    console.log(`Migration completed. Updated ${result.modifiedCount} users.`);

    // Verify the migration
    const superAdmins = await User.countDocuments({ role: USER_ROLES.SUPER_ADMIN });
    const regularUsers = await User.countDocuments({ role: USER_ROLES.REGULAR_USER });

    console.log(`Super Admins: ${superAdmins}`);
    console.log(`Regular Users: ${regularUsers}`);

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from database');
  }
}

// Run migration if this script is executed directly
if (require.main === module) {
  migrateUserRoles();
}

module.exports = { migrateUserRoles };