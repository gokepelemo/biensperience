require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/user');
const Destination = require('./models/destination');
const Experience = require('./models/experience');
const Photo = require('./models/photo');
const Plan = require('./models/plan');

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  return {
    clear: args.includes('--clear') || args.includes('-c'),
    help: args.includes('--help') || args.includes('-h')
  };
}

/**
 * Display help information
 */
function showHelp() {
  console.log(`
Biensperience Sample Data Generator

Usage: node sampleData.js [options]

Options:
  --clear, -c    Clear all existing data before generating new sample data
  --help, -h     Show this help message

Description:
  Generates comprehensive sample data for Biensperience including:
  - 1 randomized super admin user
  - 50+ regular users with varied profiles
  - 30+ destinations worldwide
  - 90+ experiences with collaborators and plan items
  - 200+ photos from Unsplash
  - 150+ user plans with varying completion levels

Examples:
  node sampleData.js              # Generate sample data (keeps existing data)
  node sampleData.js --clear      # Clear database and generate fresh sample data
  node sampleData.js --help       # Show this help message
`);
  process.exit(0);
}

/**
 * Calculate Levenshtein distance for fuzzy matching
 */
function levenshteinDistance(str1, str2) {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  const matrix = Array(s2.length + 1).fill(null).map(() =>
    Array(s1.length + 1).fill(null)
  );

  for (let i = 0; i <= s1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= s2.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= s2.length; j++) {
    for (let i = 1; i <= s1.length; i++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + cost
      );
    }
  }

  return matrix[s2.length][s1.length];
}

/**
 * Calculate similarity percentage between two strings
 */
function calculateSimilarity(str1, str2) {
  const distance = levenshteinDistance(str1, str2);
  const maxLength = Math.max(str1.length, str2.length);
  return maxLength === 0 ? 100 : ((maxLength - distance) / maxLength) * 100;
}

/**
 * Check if an item already exists with fuzzy matching
 */
async function findSimilarItem(Model, name, similarityThreshold = 85) {
  const allItems = await Model.find({}, 'name');
  for (const item of allItems) {
    const similarity = calculateSimilarity(name, item.name);
    if (similarity >= similarityThreshold) {
      return item;
    }
  }
  return null;
}

/**
 * Generate random string for super admin credentials
 */
function generateRandomString(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Get random element from array
 */
function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Get random elements from array
 */
function getRandomElements(array, count) {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

/**
 * Generate random number between min and max
 */
function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate random date within next year
 */
function randomFutureDate() {
  const now = new Date();
  const oneYearFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  return new Date(now.getTime() + Math.random() * (oneYearFromNow.getTime() - now.getTime()));
}
/**
 * Data generators for comprehensive sample data
 */
class DataGenerator {
  constructor() {
    this.firstNames = [
      'Alice', 'Bob', 'Carol', 'David', 'Emma', 'Frank', 'Grace', 'Henry', 'Ivy', 'Jack',
      'Kate', 'Liam', 'Maya', 'Noah', 'Olivia', 'Peter', 'Quinn', 'Ryan', 'Sara', 'Tom',
      'Uma', 'Victor', 'Wendy', 'Xavier', 'Yara', 'Zane', 'Anna', 'Ben', 'Cora', 'Dean',
      'Eva', 'Felix', 'Gina', 'Hugo', 'Iris', 'Jake', 'Luna', 'Max', 'Nina', 'Owen'
    ];

    this.lastNames = [
      'Johnson', 'Smith', 'Davis', 'Wilson', 'Brown', 'Miller', 'Lee', 'Taylor', 'Chen', 'Rodriguez',
      'Garcia', 'Martinez', 'Anderson', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin', 'Thompson', 'Robinson',
      'Clark', 'Lewis', 'Walker', 'Hall', 'Allen', 'Young', 'King', 'Wright', 'Lopez', 'Hill'
    ];

    this.domains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com'];

    this.destinations = [
      // Major Cities
      { name: 'Paris', country: 'France', state: 'Île-de-France', map_location: '48.8566,2.3522' },
      { name: 'Tokyo', country: 'Japan', map_location: '35.6762,139.6503' },
      { name: 'New York City', country: 'United States', state: 'New York', map_location: '40.7128,-74.0060' },
      { name: 'Barcelona', country: 'Spain', map_location: '41.3851,2.1734' },
      { name: 'London', country: 'United Kingdom', map_location: '51.5074,-0.1278' },
      { name: 'Rome', country: 'Italy', map_location: '41.9028,12.4964' },
      { name: 'Amsterdam', country: 'Netherlands', map_location: '52.3676,4.9041' },
      { name: 'Berlin', country: 'Germany', map_location: '52.5200,13.4050' },
      { name: 'Vienna', country: 'Austria', map_location: '48.2082,16.3738' },
      { name: 'Prague', country: 'Czech Republic', map_location: '50.0755,14.4378' },

      // Beach Destinations
      { name: 'Bali', country: 'Indonesia', map_location: '-8.3405,115.0920' },
      { name: 'Cancun', country: 'Mexico', map_location: '21.1619,-86.8515' },
      { name: 'Miami', country: 'United States', state: 'Florida', map_location: '25.7617,-80.1918' },
      { name: 'Rio de Janeiro', country: 'Brazil', map_location: '-22.9068,-43.1729' },
      { name: 'Sydney', country: 'Australia', state: 'New South Wales', map_location: '-33.8688,151.2093' },
      { name: 'Honolulu', country: 'United States', state: 'Hawaii', map_location: '21.3069,-157.8583' },
      { name: 'Phuket', country: 'Thailand', map_location: '7.8804,98.3923' },
      { name: 'Dubai', country: 'United Arab Emirates', map_location: '25.2048,55.2708' },

      // Mountain Destinations
      { name: 'Zurich', country: 'Switzerland', map_location: '47.3769,8.5417' },
      { name: 'Vancouver', country: 'Canada', state: 'British Columbia', map_location: '49.2827,-123.1207' },
      { name: 'Queenstown', country: 'New Zealand', map_location: '-45.0312,168.6626' },
      { name: 'Innsbruck', country: 'Austria', map_location: '47.2692,11.4041' },
      { name: 'Banff', country: 'Canada', state: 'Alberta', map_location: '51.1784,-115.5708' },

      // Cultural/Historical
      { name: 'Athens', country: 'Greece', map_location: '37.9838,23.7275' },
      { name: 'Cairo', country: 'Egypt', map_location: '30.0444,31.2357' },
      { name: 'Istanbul', country: 'Turkey', map_location: '41.0082,28.9784' },
      { name: 'Jerusalem', country: 'Israel', map_location: '31.7683,35.2137' },
      { name: 'Machu Picchu', country: 'Peru', map_location: '-13.1631,-72.5450' },

      // Adventure/Outdoor
      { name: 'Cape Town', country: 'South Africa', map_location: '-33.9249,18.4241' },
      { name: 'Reykjavik', country: 'Iceland', map_location: '64.1466,-21.9426' },
      { name: 'Cusco', country: 'Peru', map_location: '-13.5319,-71.9675' },
      { name: 'Queenstown', country: 'New Zealand', map_location: '-45.0312,168.6626' },
      { name: 'Patagonia', country: 'Chile', map_location: '-53.1638,-70.9171' },

      // Food & Wine
      { name: 'Florence', country: 'Italy', map_location: '43.7696,11.2558' },
      { name: 'Bordeaux', country: 'France', map_location: '44.8378,-0.5792' },
      { name: 'San Francisco', country: 'United States', state: 'California', map_location: '37.7749,-122.4194' },
      { name: 'Lisbon', country: 'Portugal', map_location: '38.7223,-9.1393' },
      { name: 'Buenos Aires', country: 'Argentina', map_location: '-34.6118,-58.3966' }
    ];

    this.experienceTypes = [
      'Romantic', 'Cultural', 'Adventure', 'Food & Wine', 'Beach', 'Urban', 'Nature',
      'Historical', 'Shopping', 'Nightlife', 'Family', 'Luxury', 'Budget', 'Solo Travel',
      'Group Travel', 'Photography', 'Wellness', 'Business', 'Education', 'Volunteering'
    ];

    this.unsplashUrls = [
      'https://images.unsplash.com/photo-1431274172761-fca41d930114?w=800',
      'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800',
      'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=800',
      'https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=800',
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
      'https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=800',
      'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=800',
      'https://images.unsplash.com/photo-1531572753322-ad063cecc140?w=800',
      'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=800',
      'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800',
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
      'https://images.unsplash.com/photo-1527631746610-bca00a040d60?w=800',
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800',
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
      'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800',
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800',
      'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800',
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
      'https://images.unsplash.com/photo-1527631746610-bca00a040d60?w=800'
    ];

    this.planItemTemplates = [
      { text: 'Book accommodation', cost_range: [50, 500], days_range: [1, 7] },
      { text: 'Purchase transportation tickets', cost_range: [20, 300], days_range: [1, 3] },
      { text: 'Reserve restaurant table', cost_range: [30, 200], days_range: [1, 2] },
      { text: 'Book guided tour', cost_range: [15, 150], days_range: [1, 2] },
      { text: 'Purchase museum tickets', cost_range: [10, 50], days_range: [1, 1] },
      { text: 'Arrange activity booking', cost_range: [25, 100], days_range: [1, 3] },
      { text: 'Book spa treatment', cost_range: [40, 250], days_range: [1, 2] },
      { text: 'Purchase local transportation pass', cost_range: [5, 80], days_range: [1, 1] },
      { text: 'Reserve cooking class', cost_range: [35, 120], days_range: [1, 2] },
      { text: 'Book adventure activity', cost_range: [50, 300], days_range: [1, 5] },
      { text: 'Purchase event tickets', cost_range: [20, 200], days_range: [1, 3] },
      { text: 'Arrange private transfer', cost_range: [15, 100], days_range: [1, 1] },
      { text: 'Book photography session', cost_range: [50, 200], days_range: [1, 2] },
      { text: 'Reserve wine tasting', cost_range: [25, 150], days_range: [1, 2] },
      { text: 'Purchase local market experience', cost_range: [10, 80], days_range: [1, 1] }
    ];
  }

  /**
   * Generate users with varied profiles
   */
  generateUsers(count = 60) {
    const users = [];

    // Create super admin first
    const superAdminName = `SuperAdmin_${generateRandomString(6)}`;
    const superAdminEmail = `superadmin_${generateRandomString(8).toLowerCase()}@biensperience.demo`;
    const superAdminPassword = generateRandomString(12);

    const superAdmin = {
      name: superAdminName,
      email: superAdminEmail,
      password: superAdminPassword,
      role: 'super_admin',
      isSuperAdmin: true,
      credentials: { name: superAdminName, email: superAdminEmail, password: superAdminPassword }
    };
    users.push(superAdmin);

    // Generate regular users
    for (let i = 0; i < count - 1; i++) {
      const firstName = getRandomElement(this.firstNames);
      const lastName = getRandomElement(this.lastNames);
      const name = `${firstName} ${lastName}`;
      const domain = getRandomElement(this.domains);
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${randomBetween(1, 999)}@${domain}`;

      users.push({
        name,
        email,
        password: 'demo123',
        role: 'regular_user'
      });
    }

    return users;
  }

  /**
   * Generate destinations
   */
  generateDestinations(count = 30) {
    const selectedDestinations = getRandomElements(this.destinations, count);

    return selectedDestinations.map((dest, index) => ({
      name: dest.name,
      country: dest.country,
      state: dest.state,
      map_location: dest.map_location,
      travel_tips: this.generateTravelTips(dest.name),
      user: null, // Will be set after users are created
      permissions: [], // Will be set after users are created
      photo: null // Will be set after photos are created
    }));
  }

  /**
   * Generate travel tips for a destination
   */
  generateTravelTips(destinationName) {
    const tips = [
      `Visit the main attractions in ${destinationName} early to avoid crowds`,
      'Try authentic local cuisine at family-run restaurants',
      'Learn basic local phrases to enhance your experience',
      'Use public transportation for efficient exploration',
      'Respect local customs and traditions',
      'Book popular activities in advance during peak season',
      'Explore neighborhoods beyond the tourist areas',
      'Try street food for an authentic culinary experience'
    ];

    return getRandomElements(tips, randomBetween(3, 6));
  }

  /**
   * Generate photos
   */
  generatePhotos(count = 200) {
    const photos = [];

    for (let i = 0; i < count; i++) {
      photos.push({
        url: getRandomElement(this.unsplashUrls),
        photo_credit: 'Unsplash',
        photo_credit_url: 'https://unsplash.com',
        user: null, // Will be set after users are created
        permissions: [] // Will be set after users are created
      });
    }

    return photos;
  }

  /**
   * Generate experiences
   */
  generateExperiences(count = 90, users = [], destinations = [], photos = []) {
    const experiences = [];

    for (let i = 0; i < count; i++) {
      const destination = getRandomElement(destinations);
      const owner = getRandomElement(users.filter(u => !u.isSuperAdmin)); // Exclude super admin from ownership
      const experienceTypes = getRandomElements(this.experienceTypes, randomBetween(1, 4));

      // Generate plan items
      const planItemCount = randomBetween(3, 8);
      const planItems = [];
      for (let j = 0; j < planItemCount; j++) {
        const template = getRandomElement(this.planItemTemplates);
        planItems.push({
          text: template.text,
          cost_estimate: randomBetween(template.cost_range[0], template.cost_range[1]),
          planning_days: randomBetween(template.days_range[0], template.days_range[1])
        });
      }

      // Generate collaborators (0-3 collaborators)
      const collaboratorCount = randomBetween(0, 3);
      const availableCollaborators = users.filter(u => u._id !== owner._id && !u.isSuperAdmin);
      const collaborators = getRandomElements(availableCollaborators, collaboratorCount);

      // Generate contributors (0-2 contributors)
      const contributorCount = randomBetween(0, 2);
      const availableContributors = users.filter(u =>
        u._id !== owner._id &&
        !u.isSuperAdmin &&
        !collaborators.some(c => c._id === u._id)
      );
      const contributors = getRandomElements(availableContributors, contributorCount);

      // Build permissions array
      const permissions = [
        { _id: owner._id, entity: 'user', type: 'owner' }
      ];

      collaborators.forEach(collaborator => {
        permissions.push({ _id: collaborator._id, entity: 'user', type: 'collaborator' });
      });

      contributors.forEach(contributor => {
        permissions.push({ _id: contributor._id, entity: 'user', type: 'contributor' });
      });

      experiences.push({
        name: this.generateExperienceName(destination.name, experienceTypes),
        destination: destination._id,
        experience_type: experienceTypes,
        user: owner._id,
        permissions,
        photo: getRandomElement(photos)._id,
        plan_items: planItems
      });
    }

    return experiences;
  }

  /**
   * Generate experience name
   */
  generateExperienceName(destinationName, types) {
    const prefixes = [
      'Ultimate', 'Hidden Gems of', 'Cultural Exploration in', 'Adventure in',
      'Romantic Escape to', 'Family Adventure in', 'Solo Traveler\'s Guide to',
      'Food Lover\'s Journey through', 'Luxury Experience in', 'Budget Explorer\'s',
      'Photography Tour of', 'Wellness Retreat in', 'Historical Journey through'
    ];

    const prefix = getRandomElement(prefixes);
    const typeStr = types.length > 0 ? ` ${getRandomElement(types)}` : '';

    return `${prefix} ${destinationName}${typeStr}`;
  }

  /**
   * Generate plans
   */
  generatePlans(count = 150, experiences = [], users = []) {
    const plans = [];

    for (let i = 0; i < count; i++) {
      const experience = getRandomElement(experiences);
      const user = getRandomElement(users.filter(u => !u.isSuperAdmin)); // Exclude super admin

      // Check if user already has a plan for this experience
      const existingPlan = plans.find(p =>
        p.experience === experience._id && p.user === user._id
      );
      if (existingPlan) continue;

      // Generate plan items with completion status
      const planItems = experience.plan_items.map(item => ({
        plan_item_id: item._id,
        complete: Math.random() < 0.4, // 40% chance of completion
        cost: item.cost_estimate + randomBetween(-10, 20), // Slight variation
        planning_days: item.planning_days,
        text: item.text,
        url: item.url || null
      }));

      plans.push({
        experience: experience._id,
        user: user._id,
        planned_date: Math.random() < 0.7 ? randomFutureDate() : null, // 70% have planned dates
        plan: planItems,
        permissions: [{ _id: user._id, entity: 'user', type: 'owner' }]
      });
    }

    return plans;
  }
}

/**
 * Clear all existing data
 */
async function clearDatabase() {
  console.log('🧹 Clearing all existing data...');
  await Promise.all([
    User.deleteMany({}),
    Destination.deleteMany({}),
    Experience.deleteMany({}),
    Photo.deleteMany({}),
    Plan.deleteMany({})
  ]);
  console.log('✅ Database cleared');
}

/**
 * Create comprehensive demo data for Biensperience
 */
async function createSampleData() {
  const args = parseArgs();
  if (args.help) {
    showHelp();
  }

  try {
    // Check for required environment variables
    if (!process.env.DATABASE_URL) {
      console.error('❌ ERROR: DATABASE_URL environment variable is not set!');
      console.error('Please ensure your .env file contains:');
      console.error('DATABASE_URL=mongodb+srv://username:password@cluster.mongodb.net/database');
      process.exit(1);
    }

    if (!process.env.SECRET) {
      console.error('❌ ERROR: SECRET environment variable is not set!');
      console.error('Please ensure your .env file contains:');
      console.error('SECRET=your-secret-key-here');
      process.exit(1);
    }

    console.log('🔌 Connecting to database...');
    await mongoose.connect(process.env.DATABASE_URL);
    console.log('✅ Connected to database successfully');

    // Clear database if requested
    if (args.clear) {
      await clearDatabase();
    } else {
      console.log('ℹ️  Keeping existing data. Use --clear to remove all data first.');
    }

    const generator = new DataGenerator();

    // Generate and create users
    console.log('👥 Generating users...');
    const userData = generator.generateUsers(60);
    const createdUsers = [];

    for (const userInfo of userData) {
      const user = new User({
        name: userInfo.name,
        email: userInfo.email,
        password: userInfo.password,
        role: userInfo.role,
        isSuperAdmin: userInfo.isSuperAdmin || false
      });
      await user.save();
      createdUsers.push({ ...user.toObject(), credentials: userInfo.credentials });
    }
    console.log(`✅ Created ${createdUsers.length} users (${createdUsers.filter(u => u.isSuperAdmin).length} super admin, ${createdUsers.filter(u => !u.isSuperAdmin).length} regular users)`);

    // Generate and create destinations
    console.log('📍 Generating destinations...');
    const destinationData = generator.generateDestinations(30);
    const createdDestinations = [];

    for (let i = 0; i < destinationData.length; i++) {
      const dest = destinationData[i];
      const owner = getRandomElement(createdUsers.filter(u => !u.isSuperAdmin));

      dest.user = owner._id;
      dest.permissions = [{ _id: owner._id, entity: 'user', type: 'owner' }];

      const destination = new Destination(dest);
      await destination.save();
      createdDestinations.push(destination);
    }
    console.log(`✅ Created ${createdDestinations.length} destinations`);

    // Generate and create photos
    console.log('📸 Generating photos...');
    const photoData = generator.generatePhotos(200);
    const createdPhotos = [];

    for (const photoInfo of photoData) {
      const owner = getRandomElement(createdUsers.filter(u => !u.isSuperAdmin));
      photoInfo.user = owner._id;
      photoInfo.permissions = [{ _id: owner._id, entity: 'user', type: 'owner' }];

      const photo = new Photo(photoInfo);
      await photo.save();
      createdPhotos.push(photo);
    }
    console.log(`✅ Created ${createdPhotos.length} photos`);

    // Assign photos to destinations
    console.log('🔗 Assigning photos to destinations...');
    for (const destination of createdDestinations) {
      const randomPhoto = getRandomElement(createdPhotos);
      destination.photo = randomPhoto._id;
      await destination.save();
    }

    // Generate and create experiences
    console.log('🎯 Generating experiences...');
    const experienceData = generator.generateExperiences(90, createdUsers, createdDestinations, createdPhotos);
    const createdExperiences = [];

    for (const expData of experienceData) {
      const experience = new Experience(expData);
      await experience.save();
      createdExperiences.push(experience);
    }
    console.log(`✅ Created ${createdExperiences.length} experiences with varied collaborators and plan items`);

    // Generate and create plans
    console.log('📋 Generating user plans...');
    const planData = generator.generatePlans(150, createdExperiences, createdUsers);
    const createdPlans = [];

    for (const planInfo of planData) {
      const plan = new Plan(planInfo);
      await plan.save();
      createdPlans.push(plan);
    }
    console.log(`✅ Created ${createdPlans.length} user plans with varying completion levels`);

    // Display super admin credentials
    const superAdmin = createdUsers.find(u => u.isSuperAdmin);
    if (superAdmin && superAdmin.credentials) {
      console.log('\n🔐 SUPER ADMIN CREDENTIALS:');
      console.log('=====================================');
      console.log(`Name:     ${superAdmin.credentials.name}`);
      console.log(`Email:    ${superAdmin.credentials.email}`);
      console.log(`Password: ${superAdmin.credentials.password}`);
      console.log('=====================================');
      console.log('⚠️  SAVE THESE CREDENTIALS - They will not be shown again!');
      console.log('The super admin has full access to all features and can manage everything.');
    }

    console.log('\n🎉 Sample data generation complete!');
    console.log('📊 Summary:');
    console.log(`   👑 Super Admin: 1 user (randomized credentials)`);
    console.log(`   👥 Regular Users: ${createdUsers.length - 1} users`);
    console.log(`   📍 Destinations: ${createdDestinations.length}`);
    console.log(`   🎯 Experiences: ${createdExperiences.length} (with varied collaborators and plan items)`);
    console.log(`   📸 Photos: ${createdPhotos.length}`);
    console.log(`   📋 Plans: ${createdPlans.length} (with completion tracking)`);

    console.log('\n👥 DEMO USER ACCOUNTS:');
    console.log('All regular users have password: demo123');
    createdUsers.filter(u => !u.isSuperAdmin).slice(0, 10).forEach(user => {
      console.log(`   ${user.name} - ${user.email}`);
    });
    if (createdUsers.filter(u => !u.isSuperAdmin).length > 10) {
      console.log(`   ... and ${createdUsers.filter(u => !u.isSuperAdmin).length - 10} more users`);
    }

    console.log('\n🔍 SAMPLE SCENARIOS TO EXPLORE:');
    console.log('   • Experiences with multiple collaborators and contributors');
    console.log('   • Plans with different completion percentages');
    console.log('   • Destinations with varied travel tips');
    console.log('   • Super admin access to all resources');
    console.log('   • User plans with realistic cost variations');

  } catch (error) {
    console.error('❌ Error creating sample data:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
}

// Run the function
createSampleData().catch(console.error);
