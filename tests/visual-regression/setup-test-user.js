/**
 * Setup Test User for Visual Regression Tests
 * Creates a test user in MongoDB and obtains JWT token
 */

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/biensperience';
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'visual-test-user@test.com';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'TestPassword123!';
const TEST_USER_NAME = process.env.TEST_USER_NAME || 'Visual Test User';

/**
 * Create test user in MongoDB
 */
async function createTestUser() {
  try {
    await mongoose.connect(MONGODB_URI);

    const userSchema = new mongoose.Schema({
      name: String,
      email: String,
      password: String,
      emailConfirmed: Boolean,
      isSuperAdmin: Boolean,
      role: String,
    });

    const User = mongoose.models.User || mongoose.model('User', userSchema);

    // Delete existing test user
    await User.deleteOne({ email: TEST_USER_EMAIL });

    // Hash password
    const hashedPassword = await bcrypt.hash(TEST_USER_PASSWORD, 10);

    // Create new test user
    const user = await User.create({
      name: TEST_USER_NAME,
      email: TEST_USER_EMAIL,
      password: hashedPassword,
      emailConfirmed: true,
      isSuperAdmin: false,
      role: 'user',
    });

    console.log('Test user created:', user._id.toString());
    return {
      userId: user._id.toString(),
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
    };
  } catch (error) {
    console.error('Error creating test user:', error.message);
    throw error;
  } finally {
    await mongoose.connection.close();
  }
}

/**
 * Get JWT token for test user
 */
async function getJWTToken(email, password) {
  const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

  try {
    const response = await fetch(`${BACKEND_URL}/api/users/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Login failed: ${error}`);
    }

    const token = await response.text();
    // Remove quotes if present
    return token.replace(/^"(.*)"$/, '$1');
  } catch (error) {
    console.error('Error getting JWT token:', error.message);
    throw error;
  }
}

/**
 * Cleanup test user
 */
async function cleanupTestUser() {
  try {
    await mongoose.connect(MONGODB_URI);

    const userSchema = new mongoose.Schema({ email: String });
    const User = mongoose.models.User || mongoose.model('User', userSchema);

    await User.deleteOne({ email: TEST_USER_EMAIL });
    console.log('Test user cleaned up');
  } catch (error) {
    console.error('Cleanup error:', error.message);
  } finally {
    await mongoose.connection.close();
  }
}

/**
 * Main setup function
 */
async function setup() {
  try {
    console.log('Setting up test user...');
    const user = await createTestUser();

    console.log('Obtaining JWT token...');
    const token = await getJWTToken(user.email, user.password);

    console.log('\nTest user setup complete!');
    console.log('Email:', user.email);
    console.log('Password:', user.password);
    console.log('JWT Token:', token);

    return {
      user,
      token,
    };
  } catch (error) {
    console.error('Setup failed:', error);
    process.exit(1);
  }
}

// Run setup if executed directly
if (require.main === module) {
  const command = process.argv[2];

  if (command === 'cleanup') {
    cleanupTestUser()
      .then(() => process.exit(0))
      .catch(err => {
        console.error(err);
        process.exit(1);
      });
  } else {
    setup()
      .then(() => process.exit(0))
      .catch(err => {
        console.error(err);
        process.exit(1);
      });
  }
}

module.exports = { createTestUser, getJWTToken, cleanupTestUser, setup };
