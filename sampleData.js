require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/user');
const Destination = require('./models/destination');
const Experience = require('./models/experience');
const Photo = require('./models/photo');
const Plan = require('./models/plan');

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
 * Create comprehensive demo data for Biensperience
 */
async function createSampleData() {
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

    // Clear existing data to avoid duplicates
    console.log('🧹 Clearing existing sample data...');
    await Promise.all([
      User.deleteMany({ email: { $regex: /sample[0-9]*@|demo[0-9]*@/ } }),
      Photo.deleteMany({ s3_key: { $regex: /^sample-/ } }),
      Destination.deleteMany({ name: { $regex: /^Sample|^Test|^Demo/ } }),
      Experience.deleteMany({ name: { $regex: /^Sample|^Test|^Demo/ } }),
      Plan.deleteMany({})
    ]);
    console.log('✅ Cleared existing sample data');

    // Generate super admin credentials
    const superAdminName = `SuperAdmin_${generateRandomString(6)}`;
    const superAdminEmail = `superadmin_${generateRandomString(8).toLowerCase()}@biensperience.demo`;
    const superAdminPassword = generateRandomString(12);

    console.log('👑 Creating super admin user...');
    console.log(`   Name: ${superAdminName}`);
    console.log(`   Email: ${superAdminEmail}`);
    console.log(`   Password: ${superAdminPassword}`);
    console.log('   ⚠️  SAVE THESE CREDENTIALS - They will only be shown once!');

    const superAdmin = new User({
      name: superAdminName,
      email: superAdminEmail,
      password: superAdminPassword,
      isSuperAdmin: true
    });
    await superAdmin.save();
    console.log('✅ Created super admin user');

    // Create demo users with different roles
    console.log('👥 Creating demo users...');
    const users = [
      // Regular users
      { name: 'Alice Johnson', email: 'alice@demo.com', password: 'demo123', role: 'traveler' },
      { name: 'Bob Smith', email: 'bob@demo.com', password: 'demo123', role: 'planner' },
      { name: 'Carol Davis', email: 'carol@demo.com', password: 'demo123', role: 'contributor' },
      { name: 'David Wilson', email: 'david@demo.com', password: 'demo123', role: 'explorer' },
      { name: 'Emma Brown', email: 'emma@demo.com', password: 'demo123', role: 'photographer' },

      // Additional users for collaboration scenarios
      { name: 'Frank Miller', email: 'frank@demo.com', password: 'demo123', role: 'collaborator' },
      { name: 'Grace Lee', email: 'grace@demo.com', password: 'demo123', role: 'collaborator' },
      { name: 'Henry Taylor', email: 'henry@demo.com', password: 'demo123', role: 'contributor' },
      { name: 'Ivy Chen', email: 'ivy@demo.com', password: 'demo123', role: 'traveler' },
      { name: 'Jack Rodriguez', email: 'jack@demo.com', password: 'demo123', role: 'planner' }
    ];

    const createdUsers = [superAdmin]; // Include super admin first
    for (const userData of users) {
      const user = new User(userData);
      await user.save();
      createdUsers.push(user);
      console.log(`✅ Created user: ${user.email} (${userData.role})`);
    }

    // Create sample photos
    console.log('📸 Creating sample photos...');
    const photos = [
      // Paris photos
      { url: 'https://images.unsplash.com/photo-1431274172761-fca41d930114?w=800', photo_credit: 'Unsplash', photo_credit_url: 'https://unsplash.com', user: createdUsers[1]._id, permissions: [{ _id: createdUsers[1]._id, entity: 'user', type: 'owner' }] },
      { url: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800', photo_credit: 'Unsplash', photo_credit_url: 'https://unsplash.com', user: createdUsers[2]._id, permissions: [{ _id: createdUsers[2]._id, entity: 'user', type: 'owner' }] },

      // Tokyo photos
      { url: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=800', photo_credit: 'Unsplash', photo_credit_url: 'https://unsplash.com', user: createdUsers[3]._id, permissions: [{ _id: createdUsers[3]._id, entity: 'user', type: 'owner' }] },
      { url: 'https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=800', photo_credit: 'Unsplash', photo_credit_url: 'https://unsplash.com', user: createdUsers[4]._id, permissions: [{ _id: createdUsers[4]._id, entity: 'user', type: 'owner' }] },

      // New York photos
      { url: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=800', photo_credit: 'Unsplash', photo_credit_url: 'https://unsplash.com', user: createdUsers[5]._id, permissions: [{ _id: createdUsers[5]._id, entity: 'user', type: 'owner' }] },
      { url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800', photo_credit: 'Unsplash', photo_credit_url: 'https://unsplash.com', user: createdUsers[6]._id, permissions: [{ _id: createdUsers[6]._id, entity: 'user', type: 'owner' }] },

      // Additional photos for experiences
      { url: 'https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=800', photo_credit: 'Unsplash', photo_credit_url: 'https://unsplash.com', user: createdUsers[7]._id, permissions: [{ _id: createdUsers[7]._id, entity: 'user', type: 'owner' }] },
      { url: 'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=800', photo_credit: 'Unsplash', photo_credit_url: 'https://unsplash.com', user: createdUsers[8]._id, permissions: [{ _id: createdUsers[8]._id, entity: 'user', type: 'owner' }] },
      { url: 'https://images.unsplash.com/photo-1531572753322-ad063cecc140?w=800', photo_credit: 'Unsplash', photo_credit_url: 'https://unsplash.com', user: createdUsers[9]._id, permissions: [{ _id: createdUsers[9]._id, entity: 'user', type: 'owner' }] },
      { url: 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=800', photo_credit: 'Unsplash', photo_credit_url: 'https://unsplash.com', user: createdUsers[10]._id, permissions: [{ _id: createdUsers[10]._id, entity: 'user', type: 'owner' }] }
    ];

    const createdPhotos = [];
    for (const photoData of photos) {
      const photo = new Photo(photoData);
      await photo.save();
      createdPhotos.push(photo);
      console.log(`✅ Created photo: ${photo._id}`);
    }

    // Create destinations
    console.log('📍 Creating demo destinations...');
    const destinations = [
      {
        name: 'Paris',
        country: 'France',
        state: 'Île-de-France',
        map_location: '48.8566,2.3522',
        user: createdUsers[1]._id,
        permissions: [{
          _id: createdUsers[1]._id,
          entity: 'user',
          type: 'owner'
        }],
        photo: createdPhotos[0]._id,
        travel_tips: [
          'Visit the Eiffel Tower at sunset for the best views',
          'Try authentic French pastries at local boulangeries',
          'Learn basic French phrases to enhance your experience',
          'Use the Metro for efficient transportation around the city'
        ]
      },
      {
        name: 'Tokyo',
        country: 'Japan',
        map_location: '35.6762,139.6503',
        user: createdUsers[2]._id,
        permissions: [{
          _id: createdUsers[2]._id,
          entity: 'user',
          type: 'owner'
        }],
        photo: createdPhotos[2]._id,
        travel_tips: [
          'Experience Shibuya Crossing during peak hours',
          'Visit Senso-ji Temple in Asakusa for traditional culture',
          'Try street food at Tsukiji Outer Market',
          'Respect bowing customs when greeting locals'
        ]
      },
      {
        name: 'New York City',
        country: 'United States',
        state: 'New York',
        map_location: '40.7128,-74.0060',
        user: createdUsers[3]._id,
        permissions: [{
          _id: createdUsers[3]._id,
          entity: 'user',
          type: 'owner'
        }],
        photo: createdPhotos[4]._id,
        travel_tips: [
          'Get a MetroCard for unlimited subway rides',
          'Visit Central Park for a relaxing escape',
          'Explore diverse neighborhoods like Chinatown and Little Italy',
          'Book Broadway shows in advance for best seats'
        ]
      },
      {
        name: 'Barcelona',
        country: 'Spain',
        map_location: '41.3851,2.1734',
        user: createdUsers[4]._id,
        permissions: [{
          _id: createdUsers[4]._id,
          entity: 'user',
          type: 'owner'
        }],
        photo: createdPhotos[6]._id,
        travel_tips: [
          'Visit Sagrada Familia and Park Güell',
          'Walk along La Rambla',
          'Explore Gothic Quarter',
          'Relax on Barceloneta Beach'
        ]
      }
    ];

    const createdDestinations = [];
    for (const destData of destinations) {
      const destination = new Destination(destData);
      await destination.save();
      createdDestinations.push(destination);
      console.log(`✅ Created destination: ${destination.name}`);
    }

    // Create experiences with collaborators
    console.log('🎯 Creating demo experiences with collaborators...');
    const experiences = [
      {
        name: 'Romantic Paris Getaway',
        destination: createdDestinations[0]._id,
        experience_type: ['Romantic', 'Cultural', 'Food & Wine'],
        user: createdUsers[1]._id, // Alice owns this
        permissions: [
          { _id: createdUsers[1]._id, entity: 'user', type: 'owner' }, // Alice - owner
          { _id: createdUsers[6]._id, entity: 'user', type: 'collaborator' }, // Frank - collaborator
          { _id: createdUsers[8]._id, entity: 'user', type: 'contributor' } // Henry - contributor
        ],
        photo: createdPhotos[0]._id,
        plan_items: [
          {
            text: 'Book Eiffel Tower tickets in advance',
            url: 'https://www.toureiffel.paris/en',
            cost_estimate: 20,
            planning_days: 1
          },
          {
            text: 'Reserve table at a Michelin-starred restaurant',
            url: 'https://www.relaischateaubriand.fr/',
            cost_estimate: 300,
            planning_days: 2
          },
          {
            text: 'Arrange Seine River dinner cruise',
            url: 'https://www.bateauxparisiens.com/',
            cost_estimate: 150,
            planning_days: 1
          },
          {
            text: 'Purchase Louvre Museum tickets',
            url: 'https://www.louvre.fr/en',
            cost_estimate: 17,
            planning_days: 1
          },
          {
            text: 'Book hotel in Le Marais district',
            cost_estimate: 250,
            planning_days: 3
          }
        ]
      },
      {
        name: 'Tokyo Cultural Immersion',
        destination: createdDestinations[1]._id,
        experience_type: ['Cultural', 'Adventure', 'Food & Wine'],
        user: createdUsers[2]._id, // Bob owns this
        permissions: [
          { _id: createdUsers[2]._id, entity: 'user', type: 'owner' }, // Bob - owner
          { _id: createdUsers[7]._id, entity: 'user', type: 'collaborator' }, // Grace - collaborator
          { _id: createdUsers[9]._id, entity: 'user', type: 'contributor' } // Ivy - contributor
        ],
        photo: createdPhotos[2]._id,
        plan_items: [
          {
            text: 'Visit Senso-ji Temple in Asakusa',
            url: 'https://www.senso-ji.jp/',
            cost_estimate: 0,
            planning_days: 1
          },
          {
            text: 'Experience Tsukiji Outer Market',
            url: 'https://www.tsukiji.or.jp/english/',
            cost_estimate: 50,
            planning_days: 1
          },
          {
            text: 'Book traditional ryokan accommodation',
            cost_estimate: 200,
            planning_days: 2
          },
          {
            text: 'Arrange tea ceremony experience',
            cost_estimate: 80,
            planning_days: 1
          },
          {
            text: 'Purchase JR Pass for transportation',
            url: 'https://www.japanrailpass.net/',
            cost_estimate: 300,
            planning_days: 1
          }
        ]
      },
      {
        name: 'New York City Explorer',
        destination: createdDestinations[2]._id,
        experience_type: ['Adventure', 'Cultural', 'Urban'],
        user: createdUsers[3]._id, // Carol owns this
        permissions: [
          { _id: createdUsers[3]._id, entity: 'user', type: 'owner' }, // Carol - owner
          { _id: createdUsers[10]._id, entity: 'user', type: 'collaborator' } // Jack - collaborator
        ],
        photo: createdPhotos[4]._id,
        plan_items: [
          {
            text: 'Book tickets for Broadway show',
            url: 'https://www.broadway.com/',
            cost_estimate: 150,
            planning_days: 2
          },
          {
            text: 'Reserve rooftop bar with city views',
            cost_estimate: 80,
            planning_days: 1
          },
          {
            text: 'Purchase Museum of Modern Art tickets',
            url: 'https://www.moma.org/',
            cost_estimate: 25,
            planning_days: 1
          },
          {
            text: 'Book food tour of diverse neighborhoods',
            url: 'https://www.foodtoursofny.com/',
            cost_estimate: 75,
            planning_days: 1
          },
          {
            text: 'Arrange Central Park carriage ride',
            cost_estimate: 50,
            planning_days: 1
          }
        ]
      },
      {
        name: 'Barcelona Gaudi Adventure',
        destination: createdDestinations[3]._id,
        experience_type: ['Cultural', 'Architecture', 'Beach'],
        user: createdUsers[4]._id, // David owns this
        permissions: [
          { _id: createdUsers[4]._id, entity: 'user', type: 'owner' }, // David - owner
          { _id: createdUsers[5]._id, entity: 'user', type: 'collaborator' } // Emma - collaborator
        ],
        photo: createdPhotos[6]._id,
        plan_items: [
          {
            text: 'Book Sagrada Familia guided tour',
            url: 'https://sagradafamilia.org/',
            cost_estimate: 35,
            planning_days: 2
          },
          {
            text: 'Purchase Park Güell tickets',
            url: 'https://parkguell.barcelona/',
            cost_estimate: 15,
            planning_days: 1
          },
          {
            text: 'Arrange cooking class for paella',
            cost_estimate: 65,
            planning_days: 1
          },
          {
            text: 'Book flamenco show tickets',
            url: 'https://www.flamencobcn.com/',
            cost_estimate: 40,
            planning_days: 1
          },
          {
            text: 'Reserve beachfront hotel',
            cost_estimate: 180,
            planning_days: 3
          }
        ]
      }
    ];

    const createdExperiences = [];
    for (const expData of experiences) {
      const experience = new Experience(expData);
      await experience.save();
      createdExperiences.push(experience);
      console.log(`✅ Created experience: ${experience.name}`);
    }

    // Create plans with some completed items
    console.log('📋 Creating demo plans with completed items...');

    // Plan 1: Alice's Paris trip (some items completed)
    const plan1 = new Plan({
      experience: createdExperiences[0]._id,
      user: createdUsers[1]._id, // Alice
      planned_date: new Date('2024-06-15'),
      plan: [
        {
          plan_item_id: createdExperiences[0].plan_items[0]._id,
          complete: true,
          cost: 20,
          planning_days: 1,
          text: 'Book Eiffel Tower tickets in advance',
          url: 'https://www.toureiffel.paris/en'
        },
        {
          plan_item_id: createdExperiences[0].plan_items[1]._id,
          complete: false,
          cost: 300,
          planning_days: 2,
          text: 'Reserve table at a Michelin-starred restaurant',
          url: 'https://www.relaischateaubriand.fr/'
        },
        {
          plan_item_id: createdExperiences[0].plan_items[2]._id,
          complete: true,
          cost: 150,
          planning_days: 1,
          text: 'Arrange Seine River dinner cruise',
          url: 'https://www.bateauxparisiens.com/'
        },
        {
          plan_item_id: createdExperiences[0].plan_items[3]._id,
          complete: false,
          cost: 17,
          planning_days: 1,
          text: 'Purchase Louvre Museum tickets',
          url: 'https://www.louvre.fr/en'
        },
        {
          plan_item_id: createdExperiences[0].plan_items[4]._id,
          complete: true,
          cost: 250,
          planning_days: 3,
          text: 'Book hotel in Le Marais district'
        }
      ],
      permissions: [
        { _id: createdUsers[1]._id, entity: 'user', type: 'owner' }
      ]
    });
    await plan1.save();
    console.log(`✅ Created plan for Alice: Paris Getaway (${plan1.completion_percentage}% complete)`);

    // Plan 2: Frank's collaborative plan on Alice's Paris experience
    const plan2 = new Plan({
      experience: createdExperiences[0]._id,
      user: createdUsers[6]._id, // Frank
      planned_date: new Date('2024-07-20'),
      plan: [
        {
          plan_item_id: createdExperiences[0].plan_items[0]._id,
          complete: false,
          cost: 20,
          planning_days: 1,
          text: 'Book Eiffel Tower tickets in advance',
          url: 'https://www.toureiffel.paris/en'
        },
        {
          plan_item_id: createdExperiences[0].plan_items[1]._id,
          complete: true,
          cost: 350,
          planning_days: 2,
          text: 'Reserve table at a Michelin-starred restaurant',
          url: 'https://www.relaischateaubriand.fr/'
        },
        {
          plan_item_id: createdExperiences[0].plan_items[2]._id,
          complete: false,
          cost: 150,
          planning_days: 1,
          text: 'Arrange Seine River dinner cruise',
          url: 'https://www.bateauxparisiens.com/'
        },
        {
          plan_item_id: createdExperiences[0].plan_items[3]._id,
          complete: true,
          cost: 17,
          planning_days: 1,
          text: 'Purchase Louvre Museum tickets',
          url: 'https://www.louvre.fr/en'
        },
        {
          plan_item_id: createdExperiences[0].plan_items[4]._id,
          complete: false,
          cost: 280,
          planning_days: 3,
          text: 'Book hotel in Le Marais district'
        }
      ],
      permissions: [
        { _id: createdUsers[6]._id, entity: 'user', type: 'owner' }
      ]
    });
    await plan2.save();
    console.log(`✅ Created collaborative plan for Frank: Paris Getaway (${plan2.completion_percentage}% complete)`);

    // Plan 3: Bob's Tokyo trip (fully planned, some completed)
    const plan3 = new Plan({
      experience: createdExperiences[1]._id,
      user: createdUsers[2]._id, // Bob
      planned_date: new Date('2024-09-10'),
      plan: [
        {
          plan_item_id: createdExperiences[1].plan_items[0]._id,
          complete: true,
          cost: 0,
          planning_days: 1,
          text: 'Visit Senso-ji Temple in Asakusa',
          url: 'https://www.senso-ji.jp/'
        },
        {
          plan_item_id: createdExperiences[1].plan_items[1]._id,
          complete: true,
          cost: 50,
          planning_days: 1,
          text: 'Experience Tsukiji Outer Market',
          url: 'https://www.tsukiji.or.jp/english/'
        },
        {
          plan_item_id: createdExperiences[1].plan_items[2]._id,
          complete: false,
          cost: 200,
          planning_days: 2,
          text: 'Book traditional ryokan accommodation'
        },
        {
          plan_item_id: createdExperiences[1].plan_items[3]._id,
          complete: false,
          cost: 80,
          planning_days: 1,
          text: 'Arrange tea ceremony experience'
        },
        {
          plan_item_id: createdExperiences[1].plan_items[4]._id,
          complete: true,
          cost: 300,
          planning_days: 1,
          text: 'Purchase JR Pass for transportation',
          url: 'https://www.japanrailpass.net/'
        }
      ],
      permissions: [
        { _id: createdUsers[2]._id, entity: 'user', type: 'owner' }
      ]
    });
    await plan3.save();
    console.log(`✅ Created plan for Bob: Tokyo Cultural Immersion (${plan3.completion_percentage}% complete)`);

    // Plan 4: Carol's NYC trip (just started)
    const plan4 = new Plan({
      experience: createdExperiences[2]._id,
      user: createdUsers[3]._id, // Carol
      planned_date: new Date('2024-11-05'),
      plan: [
        {
          plan_item_id: createdExperiences[2].plan_items[0]._id,
          complete: false,
          cost: 150,
          planning_days: 2,
          text: 'Book tickets for Broadway show',
          url: 'https://www.broadway.com/'
        },
        {
          plan_item_id: createdExperiences[2].plan_items[1]._id,
          complete: false,
          cost: 80,
          planning_days: 1,
          text: 'Reserve rooftop bar with city views'
        },
        {
          plan_item_id: createdExperiences[2].plan_items[2]._id,
          complete: false,
          cost: 25,
          planning_days: 1,
          text: 'Purchase Museum of Modern Art tickets',
          url: 'https://www.moma.org/'
        },
        {
          plan_item_id: createdExperiences[2].plan_items[3]._id,
          complete: false,
          cost: 75,
          planning_days: 1,
          text: 'Book food tour of diverse neighborhoods',
          url: 'https://www.foodtoursofny.com/'
        },
        {
          plan_item_id: createdExperiences[2].plan_items[4]._id,
          complete: false,
          cost: 50,
          planning_days: 1,
          text: 'Arrange Central Park carriage ride'
        }
      ],
      permissions: [
        { _id: createdUsers[3]._id, entity: 'user', type: 'owner' }
      ]
    });
    await plan4.save();
    console.log(`✅ Created plan for Carol: New York City Explorer (${plan4.completion_percentage}% complete)`);

    // Plan 5: Jack's collaborative plan on Carol's NYC experience
    const plan5 = new Plan({
      experience: createdExperiences[2]._id,
      user: createdUsers[10]._id, // Jack
      planned_date: new Date('2024-12-01'),
      plan: [
        {
          plan_item_id: createdExperiences[2].plan_items[0]._id,
          complete: true,
          cost: 180,
          planning_days: 2,
          text: 'Book tickets for Broadway show',
          url: 'https://www.broadway.com/'
        },
        {
          plan_item_id: createdExperiences[2].plan_items[1]._id,
          complete: false,
          cost: 80,
          planning_days: 1,
          text: 'Reserve rooftop bar with city views'
        },
        {
          plan_item_id: createdExperiences[2].plan_items[2]._id,
          complete: false,
          cost: 25,
          planning_days: 1,
          text: 'Purchase Museum of Modern Art tickets',
          url: 'https://www.moma.org/'
        },
        {
          plan_item_id: createdExperiences[2].plan_items[3]._id,
          complete: false,
          cost: 75,
          planning_days: 1,
          text: 'Book food tour of diverse neighborhoods',
          url: 'https://www.foodtoursofny.com/'
        },
        {
          plan_item_id: createdExperiences[2].plan_items[4]._id,
          complete: false,
          cost: 50,
          planning_days: 1,
          text: 'Arrange Central Park carriage ride'
        }
      ],
      permissions: [
        { _id: createdUsers[10]._id, entity: 'user', type: 'owner' }
      ]
    });
    await plan5.save();
    console.log(`✅ Created collaborative plan for Jack: New York City Explorer (${plan5.completion_percentage}% complete)`);

    console.log('\n🎉 Demo data creation complete!');
    console.log('📊 Summary:');
    console.log(`   👑 Super Admin: 1 user`);
    console.log(`   👥 Regular Users: ${createdUsers.length - 1} users`);
    console.log(`   📍 Destinations: ${createdDestinations.length}`);
    console.log(`   🎯 Experiences: ${createdExperiences.length} (with collaborators)`);
    console.log(`   📸 Photos: ${createdPhotos.length}`);
    console.log(`   📋 Plans: 5 (with varying completion levels)`);

    console.log('\n🔐 SUPER ADMIN CREDENTIALS:');
    console.log('=====================================');
    console.log(`Name:     ${superAdminName}`);
    console.log(`Email:    ${superAdminEmail}`);
    console.log(`Password: ${superAdminPassword}`);
    console.log('=====================================');
    console.log('⚠️  SAVE THESE CREDENTIALS - They will not be shown again!');
    console.log('The super admin has full access to all features and can manage everything.');

    console.log('\n👥 DEMO USER ACCOUNTS:');
    console.log('All demo users have password: demo123');
    createdUsers.slice(1).forEach((user, index) => {
      const userData = users[index];
      console.log(`   ${user.name} (${userData.role}) - ${user.email}`);
    });

    console.log('\n🔍 DEMO SCENARIOS TO EXPLORE:');
    console.log('   • Alice\'s Paris experience with Frank as collaborator');
    console.log('   • Bob\'s Tokyo experience with Grace as collaborator');
    console.log('   • Carol\'s NYC experience with Jack as collaborator');
    console.log('   • Plans with different completion percentages');
    console.log('   • Super admin access to all resources');

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
