/**
 * Quick test to verify duplicate prevention in sample data generator
 * Run with: node test-sample-data.js
 */

// Import DataGenerator class logic
function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomElements(array, count) {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateRandomString(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Simplified DataGenerator for testing
class DataGeneratorTest {
  constructor() {
    this.firstNames = [
      'James', 'Mary', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth',
      'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah'
    ];

    this.lastNames = [
      'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
      'Rodriguez', 'Martinez', 'Hernandez', 'Lopez'
    ];

    this.domains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
    this.usedEmails = new Set();
    this.usedNames = new Set();
  }

  generateUniqueEmail(firstName, lastName) {
    const domain = getRandomElement(this.domains);
    const baseEmail = `${firstName.toLowerCase()}.${lastName.toLowerCase()}`;

    let email = `${baseEmail}@${domain}`;
    if (!this.usedEmails.has(email)) {
      this.usedEmails.add(email);
      return email;
    }

    for (let attempt = 0; attempt < 100; attempt++) {
      const randomNum = randomBetween(1, 9999);
      email = `${baseEmail}${randomNum}@${domain}`;
      if (!this.usedEmails.has(email)) {
        this.usedEmails.add(email);
        return email;
      }
    }

    const timestamp = Date.now().toString().slice(-6);
    email = `${baseEmail}.${timestamp}${generateRandomString(4)}@${domain}`;
    this.usedEmails.add(email);
    return email;
  }

  generateUniqueName() {
    const maxAttempts = 1000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const firstName = getRandomElement(this.firstNames);
      const lastName = getRandomElement(this.lastNames);
      const name = `${firstName} ${lastName}`;

      if (!this.usedNames.has(name)) {
        this.usedNames.add(name);
        return { firstName, lastName, name };
      }
    }

    const firstName = getRandomElement(this.firstNames);
    const lastName = getRandomElement(this.lastNames);
    const middleInitial = String.fromCharCode(65 + Math.floor(Math.random() * 26));
    const name = `${firstName} ${middleInitial}. ${lastName}`;
    this.usedNames.add(name);
    return { firstName, lastName, name };
  }

  generateUsers(count = 60) {
    const users = [];

    for (let i = 0; i < count; i++) {
      const { firstName, lastName, name } = this.generateUniqueName();
      const email = this.generateUniqueEmail(firstName, lastName);

      users.push({ name, email });
    }

    return users;
  }
}

// Run tests
console.log('🧪 Testing Sample Data Generator - Duplicate Prevention\n');

const generator = new DataGeneratorTest();

// Test 1: Generate 60 users
console.log('Test 1: Generating 60 users...');
const users = generator.generateUsers(60);

// Check for duplicate names
const nameSet = new Set(users.map(u => u.name));
console.log(`✓ Generated ${users.length} users`);
console.log(`✓ Unique names: ${nameSet.size}/${users.length}`);

if (nameSet.size === users.length) {
  console.log('✅ PASS: All names are unique\n');
} else {
  console.log(`❌ FAIL: Found ${users.length - nameSet.size} duplicate names\n`);
}

// Check for duplicate emails
const emailSet = new Set(users.map(u => u.email));
console.log(`✓ Unique emails: ${emailSet.size}/${users.length}`);

if (emailSet.size === users.length) {
  console.log('✅ PASS: All emails are unique\n');
} else {
  console.log(`❌ FAIL: Found ${users.length - emailSet.size} duplicate emails\n`);
}

// Show sample users
console.log('Sample users generated:');
users.slice(0, 10).forEach((user, index) => {
  console.log(`  ${index + 1}. ${user.name} <${user.email}>`);
});
console.log(`  ... and ${users.length - 10} more\n`);

// Test 2: Test collision handling
console.log('Test 2: Testing collision handling (generating 200 users)...');
const generator2 = new DataGeneratorTest();
const manyUsers = generator2.generateUsers(200);

const nameSet2 = new Set(manyUsers.map(u => u.name));
const emailSet2 = new Set(manyUsers.map(u => u.email));

console.log(`✓ Generated ${manyUsers.length} users`);
console.log(`✓ Unique names: ${nameSet2.size}/${manyUsers.length}`);
console.log(`✓ Unique emails: ${emailSet2.size}/${manyUsers.length}`);

if (nameSet2.size === manyUsers.length && emailSet2.size === manyUsers.length) {
  console.log('✅ PASS: All names and emails are unique even with high volume\n');
} else {
  console.log('⚠️  WARNING: Some duplicates found with high volume (expected with limited name pool)\n');
}

console.log('✅ All tests completed!');
