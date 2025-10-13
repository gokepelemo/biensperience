require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/user');
const Destination = require('./models/destination');
const Experience = require('./models/experience');
const Photo = require('./models/photo');

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
      User.deleteMany({ email: { $regex: /sample[0-9]*@/ } }),
      Photo.deleteMany({ s3_key: { $regex: /^sample-/ } }),
      Destination.deleteMany({ name: { $regex: /^Sample|^Test/ } }),
      Experience.deleteMany({ name: { $regex: /^Sample|^Test/ } })
    ]);
    console.log('✅ Cleared existing sample data');

    // Create sample users
    console.log('👥 Creating sample users...');
    const users = [
      { name: 'John Doe', email: 'john@doe.com', password: 'test' },
      { name: 'Sarah Johnson', email: 'sample1@test.com', password: 'password123' },
      { name: 'Mike Chen', email: 'sample2@test.com', password: 'password123' },
      { name: 'Emma Wilson', email: 'sample3@test.com', password: 'password123' },
      { name: 'David Brown', email: 'sample4@test.com', password: 'password123' },
      { name: 'Lisa Garcia', email: 'sample5@test.com', password: 'password123' },
      { name: 'Alex Thompson', email: 'sample6@test.com', password: 'password123' },
      { name: 'Maria Rodriguez', email: 'sample7@test.com', password: 'password123' },
      { name: 'James Lee', email: 'sample8@test.com', password: 'password123' },
      { name: 'Anna Kim', email: 'sample9@test.com', password: 'password123' }
    ];

    const createdUsers = [];
    for (const userData of users) {
      let user = await User.findOne({ email: userData.email });
      if (!user) {
        user = new User(userData);
        await user.save();
        console.log(`✅ Created user: ${user.email}`);
      } else {
        console.log(`ℹ️  Found existing user: ${user.email}`);
      }
      createdUsers.push(user);
    }

    // Create sample photos
    console.log('📸 Creating sample photos...');
    const photos = [
      { url: 'https://images.unsplash.com/photo-1431274172761-fca41d930114?w=800', photo_credit: 'Unsplash', photo_credit_url: 'https://unsplash.com', user: createdUsers[0]._id, permissions: [{ _id: createdUsers[0]._id, entity: 'user', type: 'owner' }] },
      { url: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800', photo_credit: 'Unsplash', photo_credit_url: 'https://unsplash.com', user: createdUsers[1]._id, permissions: [{ _id: createdUsers[1]._id, entity: 'user', type: 'owner' }] },
      { url: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=800', photo_credit: 'Unsplash', photo_credit_url: 'https://unsplash.com', user: createdUsers[2]._id, permissions: [{ _id: createdUsers[2]._id, entity: 'user', type: 'owner' }] },
      { url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800', photo_credit: 'Unsplash', photo_credit_url: 'https://unsplash.com', user: createdUsers[3]._id, permissions: [{ _id: createdUsers[3]._id, entity: 'user', type: 'owner' }] },
      { url: 'https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=800', photo_credit: 'Unsplash', photo_credit_url: 'https://unsplash.com', user: createdUsers[4]._id, permissions: [{ _id: createdUsers[4]._id, entity: 'user', type: 'owner' }] },
      { url: 'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=800', photo_credit: 'Unsplash', photo_credit_url: 'https://unsplash.com', user: createdUsers[5]._id, permissions: [{ _id: createdUsers[5]._id, entity: 'user', type: 'owner' }] },
      { url: 'https://images.unsplash.com/photo-1531572753322-ad063cecc140?w=800', photo_credit: 'Unsplash', photo_credit_url: 'https://unsplash.com', user: createdUsers[6]._id, permissions: [{ _id: createdUsers[6]._id, entity: 'user', type: 'owner' }] },
      { url: 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=800', photo_credit: 'Unsplash', photo_credit_url: 'https://unsplash.com', user: createdUsers[7]._id, permissions: [{ _id: createdUsers[7]._id, entity: 'user', type: 'owner' }] },
      { url: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800', photo_credit: 'Unsplash', photo_credit_url: 'https://unsplash.com', user: createdUsers[8]._id, permissions: [{ _id: createdUsers[8]._id, entity: 'user', type: 'owner' }] },
      { url: 'https://images.unsplash.com/photo-1519677100203-a0e668c92439?w=800', photo_credit: 'Unsplash', photo_credit_url: 'https://unsplash.com', user: createdUsers[9]._id, permissions: [{ _id: createdUsers[9]._id, entity: 'user', type: 'owner' }] },
      { url: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800', photo_credit: 'Unsplash', photo_credit_url: 'https://unsplash.com', user: createdUsers[0]._id, permissions: [{ _id: createdUsers[0]._id, entity: 'user', type: 'owner' }] },
      { url: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800', photo_credit: 'Unsplash', photo_credit_url: 'https://unsplash.com', user: createdUsers[1]._id, permissions: [{ _id: createdUsers[1]._id, entity: 'user', type: 'owner' }] },
      { url: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800', photo_credit: 'Unsplash', photo_credit_url: 'https://unsplash.com', user: createdUsers[2]._id, permissions: [{ _id: createdUsers[2]._id, entity: 'user', type: 'owner' }] },
      { url: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=800', photo_credit: 'Unsplash', photo_credit_url: 'https://unsplash.com', user: createdUsers[3]._id, permissions: [{ _id: createdUsers[3]._id, entity: 'user', type: 'owner' }] },
      { url: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=800', photo_credit: 'Unsplash', photo_credit_url: 'https://unsplash.com', user: createdUsers[4]._id, permissions: [{ _id: createdUsers[4]._id, entity: 'user', type: 'owner' }] },
      { url: 'https://images.unsplash.com/photo-1555992336-fb0d29498b13?w=800', photo_credit: 'Unsplash', photo_credit_url: 'https://unsplash.com', user: createdUsers[5]._id, permissions: [{ _id: createdUsers[5]._id, entity: 'user', type: 'owner' }] },
      { url: 'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=800', photo_credit: 'Unsplash', photo_credit_url: 'https://unsplash.com', user: createdUsers[6]._id, permissions: [{ _id: createdUsers[6]._id, entity: 'user', type: 'owner' }] },
      { url: 'https://images.unsplash.com/photo-1513622470522-26c3c8a854bc?w=800', photo_credit: 'Unsplash', photo_credit_url: 'https://unsplash.com', user: createdUsers[7]._id, permissions: [{ _id: createdUsers[7]._id, entity: 'user', type: 'owner' }] },
      { url: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800', photo_credit: 'Unsplash', photo_credit_url: 'https://unsplash.com', user: createdUsers[8]._id, permissions: [{ _id: createdUsers[8]._id, entity: 'user', type: 'owner' }] },
      { url: 'https://images.unsplash.com/photo-1539635278303-d4002c07eae3?w=800', photo_credit: 'Unsplash', photo_credit_url: 'https://unsplash.com', user: createdUsers[9]._id, permissions: [{ _id: createdUsers[9]._id, entity: 'user', type: 'owner' }] },
      { url: 'https://images.unsplash.com/photo-1540979388789-6cee28a1cdc9?w=800', photo_credit: 'Unsplash', photo_credit_url: 'https://unsplash.com', user: createdUsers[0]._id, permissions: [{ _id: createdUsers[0]._id, entity: 'user', type: 'owner' }] },
      { url: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800', photo_credit: 'Unsplash', photo_credit_url: 'https://unsplash.com', user: createdUsers[1]._id, permissions: [{ _id: createdUsers[1]._id, entity: 'user', type: 'owner' }] },
      { url: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800', photo_credit: 'Unsplash', photo_credit_url: 'https://unsplash.com', user: createdUsers[2]._id, permissions: [{ _id: createdUsers[2]._id, entity: 'user', type: 'owner' }] },
      { url: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800', photo_credit: 'Unsplash', photo_credit_url: 'https://unsplash.com', user: createdUsers[3]._id, permissions: [{ _id: createdUsers[3]._id, entity: 'user', type: 'owner' }] },
      { url: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=800', photo_credit: 'Unsplash', photo_credit_url: 'https://unsplash.com', user: createdUsers[4]._id, permissions: [{ _id: createdUsers[4]._id, entity: 'user', type: 'owner' }] },
      { url: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=800', photo_credit: 'Unsplash', photo_credit_url: 'https://unsplash.com', user: createdUsers[5]._id, permissions: [{ _id: createdUsers[5]._id, entity: 'user', type: 'owner' }] },
      { url: 'https://images.unsplash.com/photo-1555992336-fb0d29498b13?w=800', photo_credit: 'Unsplash', photo_credit_url: 'https://unsplash.com', user: createdUsers[6]._id, permissions: [{ _id: createdUsers[6]._id, entity: 'user', type: 'owner' }] },
      { url: 'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=800', photo_credit: 'Unsplash', photo_credit_url: 'https://unsplash.com', user: createdUsers[7]._id, permissions: [{ _id: createdUsers[7]._id, entity: 'user', type: 'owner' }] },
      { url: 'https://images.unsplash.com/photo-1513622470522-26c3c8a854bc?w=800', photo_credit: 'Unsplash', photo_credit_url: 'https://unsplash.com', user: createdUsers[8]._id, permissions: [{ _id: createdUsers[8]._id, entity: 'user', type: 'owner' }] },
      { url: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800', photo_credit: 'Unsplash', photo_credit_url: 'https://unsplash.com', user: createdUsers[9]._id, permissions: [{ _id: createdUsers[9]._id, entity: 'user', type: 'owner' }] },
      { url: 'https://images.unsplash.com/photo-1539635278303-d4002c07eae3?w=800', photo_credit: 'Unsplash', photo_credit_url: 'https://unsplash.com', user: createdUsers[0]._id, permissions: [{ _id: createdUsers[0]._id, entity: 'user', type: 'owner' }] }
    ];

    const createdPhotos = [];
    for (const photoData of photos) {
      const photo = new Photo(photoData);
      await photo.save();
      createdPhotos.push(photo);
      console.log(`✅ Created photo: ${photo._id}`);
    }

    // Create destinations
    console.log('📍 Creating sample destinations...');
    const destinations = [
      {
        name: 'Paris',
        country: 'France',
        state: 'Île-de-France',
        map_location: '48.8566,2.3522',
        user: createdUsers[0]._id,
        permissions: [{
          _id: createdUsers[0]._id,
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
        user: createdUsers[1]._id,
        permissions: [{
          _id: createdUsers[1]._id,
          entity: 'user',
          type: 'owner'
        }],
        photo: createdPhotos[1]._id,
        travel_tips: [
          'Experience Shibuya Crossing during peak hours',
          'Visit Senso-ji Temple in Asakusa for traditional culture',
          'Try street food at Tsukiji Outer Market',
          'Respect bowing customs when greeting locals'
        ]
      },
      {
        name: 'New York City',
        country: 'USA',
        state: 'New York',
        map_location: '40.7128,-74.0060',
        user: createdUsers[2]._id,
        permissions: [{
          _id: createdUsers[2]._id,
          entity: 'user',
          type: 'owner'
        }],
        photo: createdPhotos[2]._id,
        travel_tips: [
          'Walk across the Brooklyn Bridge at sunrise',
          'Take the Staten Island Ferry for free harbor views',
          'Explore Central Park for a peaceful escape in the city',
          'Try food from diverse neighborhoods representing global cuisines'
        ]
      },
      {
        name: 'Sydney',
        country: 'Australia',
        state: 'New South Wales',
        map_location: '-33.8688,151.2093',
        user: createdUsers[3]._id,
        permissions: [{
          _id: createdUsers[3]._id,
          entity: 'user',
          type: 'owner'
        }],
        photo: createdPhotos[3]._id,
        travel_tips: [
          'Climb to the top of the Sydney Harbour Bridge',
          'Visit the Sydney Opera House for a performance',
          'Explore Bondi Beach and the coastal walk',
          'Take a ferry to Manly for scenic views'
        ]
      },
      {
        name: 'Cape Town',
        country: 'South Africa',
        state: 'Western Cape',
        map_location: '-33.9249,18.4241',
        user: createdUsers[4]._id,
        permissions: [{
          _id: createdUsers[4]._id,
          entity: 'user',
          type: 'owner'
        }],
        photo: createdPhotos[4]._id,
        travel_tips: [
          'Drive along Chapman\'s Peak Drive for stunning coastal views',
          'Visit Table Mountain for panoramic city views',
          'Explore the Cape Peninsula for wildlife and beaches',
          'Try local wines in the nearby Stellenbosch region'
        ]
      },
      {
        name: 'Rome',
        country: 'Italy',
        map_location: '41.9028,12.4964',
        user: createdUsers[5]._id,
        permissions: [{
          _id: createdUsers[5]._id,
          entity: 'user',
          type: 'owner'
        }],
        photo: createdPhotos[5]._id,
        travel_tips: [
          'Visit the Colosseum and Roman Forum',
          'Toss a coin into the Trevi Fountain',
          'Explore Vatican City and St. Peter\'s Basilica',
          'Try authentic Roman pizza and gelato'
        ]
      },
      {
        name: 'London',
        country: 'United Kingdom',
        map_location: '51.5074,-0.1278',
        user: createdUsers[6]._id,
        permissions: [{
          _id: createdUsers[6]._id,
          entity: 'user',
          type: 'owner'
        }],
        photo: createdPhotos[6]._id,
        travel_tips: [
          'Visit Buckingham Palace and watch the changing of the guard',
          'Take a ride on the London Eye',
          'Explore the British Museum',
          'Walk across Tower Bridge'
        ]
      },
      {
        name: 'Amsterdam',
        country: 'Netherlands',
        map_location: '52.3676,4.9041',
        user: createdUsers[7]._id,
        permissions: [{
          _id: createdUsers[7]._id,
          entity: 'user',
          type: 'owner'
        }],
        photo: createdPhotos[7]._id,
        travel_tips: [
          'Rent a bike and explore the canals',
          'Visit the Anne Frank House',
          'Take a canal cruise',
          'See the tulips at Keukenhof (seasonal)'
        ]
      },
      {
        name: 'Barcelona',
        country: 'Spain',
        map_location: '41.3851,2.1734',
        user: createdUsers[8]._id,
        permissions: [{
          _id: createdUsers[8]._id,
          entity: 'user',
          type: 'owner'
        }],
        photo: createdPhotos[8]._id,
        travel_tips: [
          'Visit Sagrada Familia and Park Güell',
          'Walk along La Rambla',
          'Explore Gothic Quarter',
          'Relax on Barceloneta Beach'
        ]
      },
      {
        name: 'Prague',
        country: 'Czech Republic',
        map_location: '50.0755,14.4378',
        user: createdUsers[9]._id,
        permissions: [{
          _id: createdUsers[9]._id,
          entity: 'user',
          type: 'owner'
        }],
        photo: createdPhotos[9]._id,
        travel_tips: [
          'Visit Prague Castle',
          'Cross the Charles Bridge at sunset',
          'Explore the Astronomical Clock',
          'Try traditional Czech beer and svíčková'
        ]
      },
      {
        name: 'Rio de Janeiro',
        country: 'Brazil',
        state: 'Rio de Janeiro',
        map_location: '-22.9068,-43.1729',
        user: createdUsers[0]._id,
        permissions: [{
          _id: createdUsers[0]._id,
          entity: 'user',
          type: 'owner'
        }],
        photo: createdPhotos[10]._id,
        travel_tips: [
          'Visit Christ the Redeemer',
          'Hike Sugarloaf Mountain',
          'Relax on Copacabana Beach',
          'Watch the sunset from Arpoador'
        ]
      },
      {
        name: 'Mexico City',
        country: 'Mexico',
        map_location: '19.4326,-99.1332',
        user: createdUsers[1]._id,
        permissions: [{
          _id: createdUsers[1]._id,
          entity: 'user',
          type: 'owner'
        }],
        photo: createdPhotos[11]._id,
        travel_tips: [
          'Explore the historic center and Zócalo',
          'Visit the National Anthropology Museum',
          'Take the cable car to Teotihuacan Pyramids',
          'Try street food at Mercado Medellín'
        ]
      },
      {
        name: 'Bangkok',
        country: 'Thailand',
        map_location: '13.7563,100.5018',
        user: createdUsers[2]._id,
        permissions: [{
          _id: createdUsers[2]._id,
          entity: 'user',
          type: 'owner'
        }],
        photo: createdPhotos[12]._id,
        travel_tips: [
          'Visit the Grand Palace and Wat Arun',
          'Take a boat on the Chao Phraya River',
          'Explore Chatuchak Weekend Market',
          'Experience street food at Jay Fai'
        ]
      },
      {
        name: 'Istanbul',
        country: 'Turkey',
        map_location: '41.0082,28.9784',
        user: createdUsers[3]._id,
        permissions: [{
          _id: createdUsers[3]._id,
          entity: 'user',
          type: 'owner'
        }],
        photo: createdPhotos[13]._id,
        travel_tips: [
          'Visit Hagia Sophia and Blue Mosque',
          'Explore the Grand Bazaar',
          'Take a Bosphorus cruise',
          'Relax in hammams'
        ]
      },
      {
        name: 'Dublin',
        country: 'Ireland',
        map_location: '53.3498,-6.2603',
        user: createdUsers[4]._id,
        permissions: [{
          _id: createdUsers[4]._id,
          entity: 'user',
          type: 'owner'
        }],
        photo: createdPhotos[14]._id,
        travel_tips: [
          'Visit Dublin Castle and Trinity College',
          'Explore the Guinness Storehouse',
          'Walk along the River Liffey',
          'Try traditional Irish music pubs'
        ]
      },
      {
        name: 'Vancouver',
        country: 'Canada',
        state: 'British Columbia',
        map_location: '49.2827,-123.1207',
        user: createdUsers[5]._id,
        permissions: [{
          _id: createdUsers[5]._id,
          entity: 'user',
          type: 'owner'
        }],
        photo: createdPhotos[15]._id,
        travel_tips: [
          'Hike in Stanley Park',
          'Visit Granville Island',
          'Take the Sea to Sky Highway',
          'Explore Gastown historic district'
        ]
      },
      {
        name: 'Munich',
        country: 'Germany',
        state: 'Bavaria',
        map_location: '48.1351,11.5820',
        user: createdUsers[6]._id,
        permissions: [{
          _id: createdUsers[6]._id,
          entity: 'user',
          type: 'owner'
        }],
        photo: createdPhotos[16]._id,
        travel_tips: [
          'Visit Neuschwanstein Castle',
          'Explore Marienplatz and the Glockenspiel',
          'Try Bavarian beer at Hofbräuhaus',
          'Visit the English Garden'
        ]
      },
      {
        name: 'Copenhagen',
        country: 'Denmark',
        map_location: '55.6761,12.5683',
        user: createdUsers[7]._id,
        permissions: [{
          _id: createdUsers[7]._id,
          entity: 'user',
          type: 'owner'
        }],
        photo: createdPhotos[17]._id,
        travel_tips: [
          'Visit Tivoli Gardens',
          'See the Little Mermaid statue',
          'Explore Christiania',
          'Try Danish pastries and smørrebrød'
        ]
      },
      {
        name: 'Zurich',
        country: 'Switzerland',
        map_location: '47.3769,8.5417',
        user: createdUsers[8]._id,
        permissions: [{
          _id: createdUsers[8]._id,
          entity: 'user',
          type: 'owner'
        }],
        photo: createdPhotos[18]._id,
        travel_tips: [
          'Walk along Lake Zurich',
          'Visit the Grossmünster',
          'Take a day trip to the Alps',
          'Explore Bahnhofstrasse shopping'
        ]
      },
      {
        name: 'Stockholm',
        country: 'Sweden',
        map_location: '59.3293,18.0686',
        user: createdUsers[9]._id,
        permissions: [{
          _id: createdUsers[9]._id,
          entity: 'user',
          type: 'owner'
        }],
        photo: createdPhotos[19]._id,
        travel_tips: [
          'Visit the Royal Palace',
          'Explore Gamla Stan (Old Town)',
          'Take the archipelago boat tour',
          'Visit the Vasa Museum'
        ]
      },
      {
        name: 'Wellington',
        country: 'New Zealand',
        map_location: '-41.2865,174.7762',
        user: createdUsers[0]._id,
        permissions: [{
          _id: createdUsers[0]._id,
          entity: 'user',
          type: 'owner'
        }],
        photo: createdPhotos[20]._id,
        travel_tips: [
          'Visit Te Papa Museum',
          'Take the Wellington Cable Car',
          'Explore Zealandia Ecosanctuary',
          'Hike in the surrounding hills'
        ]
      },
      {
        name: 'Marrakech',
        country: 'Morocco',
        map_location: '31.6295,-7.9811',
        user: createdUsers[1]._id,
        permissions: [{
          _id: createdUsers[1]._id,
          entity: 'user',
          type: 'owner'
        }],
        photo: createdPhotos[21]._id,
        travel_tips: [
          'Explore Jemaa el-Fnaa square',
          'Visit Bahia Palace',
          'Relax in hammams',
          'Shop in the souks'
        ]
      },
      {
        name: 'Hanoi',
        country: 'Vietnam',
        map_location: '21.0278,105.8342',
        user: createdUsers[2]._id,
        permissions: [{
          _id: createdUsers[2]._id,
          entity: 'user',
          type: 'owner'
        }],
        photo: createdPhotos[22]._id,
        travel_tips: [
          'Visit Ho Chi Minh Mausoleum',
          'Explore the Old Quarter',
          'Take a cruise on Halong Bay',
          'Try pho and street food'
        ]
      },
      {
        name: 'Singapore',
        country: 'Singapore',
        map_location: '1.3521,103.8198',
        user: createdUsers[3]._id,
        permissions: [{
          _id: createdUsers[3]._id,
          entity: 'user',
          type: 'owner'
        }],
        photo: createdPhotos[23]._id,
        travel_tips: [
          'Visit Gardens by the Bay',
          'Explore Sentosa Island',
          'Take the Singapore Flyer',
          'Try hawker center food'
        ]
      },
      {
        name: 'Dubai',
        country: 'UAE',
        map_location: '25.2048,55.2708',
        user: createdUsers[4]._id,
        permissions: [{
          _id: createdUsers[4]._id,
          entity: 'user',
          type: 'owner'
        }],
        photo: createdPhotos[24]._id,
        travel_tips: [
          'Visit Burj Khalifa',
          'Explore Dubai Mall',
          'Take a desert safari',
          'Relax at Jumeirah Beach'
        ]
      },
      {
        name: 'Edinburgh',
        country: 'United Kingdom',
        map_location: '55.9533,-3.1883',
        user: createdUsers[5]._id,
        permissions: [{
          _id: createdUsers[5]._id,
          entity: 'user',
          type: 'owner'
        }],
        photo: createdPhotos[25]._id,
        travel_tips: [
          'Visit Edinburgh Castle',
          'Explore the Royal Mile',
          'Hike Arthur\'s Seat',
          'Visit the Scotch Whisky Experience'
        ]
      },
      {
        name: 'Quebec City',
        country: 'Canada',
        state: 'Quebec',
        map_location: '46.8139,-71.2080',
        user: createdUsers[6]._id,
        permissions: [{
          _id: createdUsers[6]._id,
          entity: 'user',
          type: 'owner'
        }],
        photo: createdPhotos[26]._id,
        travel_tips: [
          'Explore Old Quebec',
          'Visit Château Frontenac',
          'Walk along the Promenade',
          'Try poutine and maple syrup'
        ]
      },
      {
        name: 'Vienna',
        country: 'Austria',
        map_location: '48.2082,16.3738',
        user: createdUsers[7]._id,
        permissions: [{
          _id: createdUsers[7]._id,
          entity: 'user',
          type: 'owner'
        }],
        photo: createdPhotos[27]._id,
        travel_tips: [
          'Visit Schönbrunn Palace',
          'Explore St. Stephen\'s Cathedral',
          'Listen to music at Wiener Musikverein',
          'Try Sachertorte and coffee houses'
        ]
      },
      {
        name: 'Oslo',
        country: 'Norway',
        map_location: '59.9139,10.7522',
        user: createdUsers[8]._id,
        permissions: [{
          _id: createdUsers[8]._id,
          entity: 'user',
          type: 'owner'
        }],
        photo: createdPhotos[28]._id,
        travel_tips: [
          'Visit the Viking Ship Museum',
          'Explore the Royal Palace',
          'Hike in Nordmarka forest',
          'Take the Fløibanen funicular'
        ]
      },
      {
        name: 'Berlin',
        country: 'Germany',
        map_location: '52.5200,13.4050',
        user: createdUsers[9]._id,
        permissions: [{
          _id: createdUsers[9]._id,
          entity: 'user',
          type: 'owner'
        }],
        photo: createdPhotos[29]._id,
        travel_tips: [
          'Visit the Berlin Wall Memorial',
          'Explore Museum Island',
          'Walk along Unter den Linden',
          'Experience Berlin nightlife'
        ]
      },
      {
        name: 'Helsinki',
        country: 'Finland',
        map_location: '60.1699,24.9384',
        user: createdUsers[0]._id,
        permissions: [{
          _id: createdUsers[0]._id,
          entity: 'user',
          type: 'owner'
        }],
        photo: createdPhotos[30]._id,
        travel_tips: [
          'Visit Suomenlinna fortress',
          'Explore the Design District',
          'Take a sauna experience',
          'Try Finnish cuisine'
        ]
      }
    ];

    const createdDestinations = [];
    for (const destData of destinations) {
      const dest = new Destination(destData);
      await dest.save();
      createdDestinations.push(dest);
      console.log(`✅ Created destination: ${dest.name}`);
    }

    // Create experiences
    console.log('🎯 Creating sample experiences...');
    const experiences = [
      {
        name: 'Romantic Paris Getaway',
        destination: createdDestinations[0]._id,
        experience_type: ['Romantic', 'Cultural', 'Food & Wine'],
        user: createdUsers[0]._id,
        permissions: [{
          _id: createdUsers[0]._id,
          entity: 'user',
          type: 'owner'
        }],
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
        user: createdUsers[1]._id,
        permissions: [{
          _id: createdUsers[1]._id,
          entity: 'user',
          type: 'owner'
        }],
        photo: createdPhotos[1]._id,
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
        user: createdUsers[2]._id,
        permissions: [{
          _id: createdUsers[2]._id,
          entity: 'user',
          type: 'owner'
        }],
        photo: createdPhotos[2]._id,
        plan_items: [
          {
            text: 'Book tickets for Broadway show',
            url: 'https://www.broadway.com/',
            cost_estimate: 150,
            planning_days: 2
          },
          {
            text: 'Reserve Top of the Rock observation deck',
            url: 'https://www.topoftherocknyc.com/',
            cost_estimate: 40,
            planning_days: 1
          },
          {
            text: 'Book hotel in Manhattan',
            cost_estimate: 300,
            planning_days: 3
          },
          {
            text: 'Purchase MetroCard for subway',
            cost_estimate: 30,
            planning_days: 1
          },
          {
            text: 'Arrange food tour of different neighborhoods',
            cost_estimate: 100,
            planning_days: 1
          }
        ]
      },
      {
        name: 'Sydney Harbour Adventure',
        destination: createdDestinations[3]._id,
        experience_type: ['Adventure', 'Nature', 'Water Sports'],
        user: createdUsers[3]._id,
        permissions: [{
          _id: createdUsers[3]._id,
          entity: 'user',
          type: 'owner'
        }],
        photo: createdPhotos[3]._id,
        plan_items: [
          {
            text: 'Book Sydney Harbour Bridge climb',
            url: 'https://www.bridgeclimb.com/',
            cost_estimate: 150,
            planning_days: 2
          },
          {
            text: 'Arrange ferry tickets for harbour exploration',
            cost_estimate: 25,
            planning_days: 1
          },
          {
            text: 'Book beachside accommodation',
            cost_estimate: 180,
            planning_days: 3
          },
          {
            text: 'Reserve Sydney Opera House tour',
            url: 'https://www.sydneyoperahouse.com/',
            cost_estimate: 45,
            planning_days: 1
          },
          {
            text: 'Plan Bondi Beach coastal walk',
            cost_estimate: 0,
            planning_days: 1
          }
        ]
      },
      {
        name: 'Cape Town Wildlife Safari',
        destination: createdDestinations[4]._id,
        experience_type: ['Adventure', 'Nature', 'Wildlife'],
        user: createdUsers[4]._id,
        permissions: [{
          _id: createdUsers[4]._id,
          entity: 'user',
          type: 'owner'
        }],
        photo: createdPhotos[4]._id,
        plan_items: [
          {
            text: 'Book Table Mountain cable car tickets',
            url: 'https://www.tablemountain.net/',
            cost_estimate: 35,
            planning_days: 1
          },
          {
            text: 'Arrange Cape Peninsula tour for wildlife',
            cost_estimate: 120,
            planning_days: 1
          },
          {
            text: 'Book waterfront accommodation',
            cost_estimate: 160,
            planning_days: 3
          },
          {
            text: 'Reserve wine tasting in Stellenbosch',
            cost_estimate: 80,
            planning_days: 1
          },
          {
            text: 'Plan Chapmans Peak Drive scenic route',
            cost_estimate: 0,
            planning_days: 1
          }
        ]
      },
      {
        name: 'Rome Historical Journey',
        destination: createdDestinations[5]._id,
        experience_type: ['Cultural', 'Historical', 'Food & Wine'],
        user: createdUsers[5]._id,
        permissions: [{
          _id: createdUsers[5]._id,
          entity: 'user',
          type: 'owner'
        }],
        photo: createdPhotos[5]._id,
        plan_items: [
          {
            text: 'Book Colosseum and Roman Forum tickets',
            url: 'https://www.coopculture.it/',
            cost_estimate: 18,
            planning_days: 1
          },
          {
            text: 'Reserve Vatican Museums entry',
            url: 'https://www.museivaticani.va/',
            cost_estimate: 20,
            planning_days: 1
          },
          {
            text: 'Book hotel near Piazza Navona',
            cost_estimate: 200,
            planning_days: 3
          },
          {
            text: 'Arrange cooking class for pasta making',
            cost_estimate: 80,
            planning_days: 1
          },
          {
            text: 'Purchase Roma Pass for transportation',
            url: 'https://www.romapass.it/',
            cost_estimate: 40,
            planning_days: 1
          }
        ]
      },
      {
        name: 'London Royal Experience',
        destination: createdDestinations[6]._id,
        experience_type: ['Cultural', 'Historical', 'Urban'],
        user: createdUsers[6]._id,
        permissions: [{
          _id: createdUsers[6]._id,
          entity: 'user',
          type: 'owner'
        }],
        photo: createdPhotos[6]._id,
        plan_items: [
          {
            text: 'Book Tower of London tickets',
            url: 'https://www.hrp.org.uk/tower-of-london/',
            cost_estimate: 30,
            planning_days: 1
          },
          {
            text: 'Reserve Changing of the Guard viewing',
            cost_estimate: 0,
            planning_days: 1
          },
          {
            text: 'Book hotel in Westminster',
            cost_estimate: 250,
            planning_days: 3
          },
          {
            text: 'Purchase London Pass',
            url: 'https://www.londonpass.com/',
            cost_estimate: 80,
            planning_days: 1
          },
          {
            text: 'Arrange Thames River cruise',
            cost_estimate: 25,
            planning_days: 1
          }
        ]
      },
      {
        name: 'Amsterdam Canal Exploration',
        destination: createdDestinations[7]._id,
        experience_type: ['Cultural', 'Adventure', 'Urban'],
        user: createdUsers[7]._id,
        permissions: [{
          _id: createdUsers[7]._id,
          entity: 'user',
          type: 'owner'
        }],
        photo: createdPhotos[7]._id,
        plan_items: [
          {
            text: 'Book Anne Frank House tickets',
            url: 'https://www.annefrank.org/',
            cost_estimate: 16,
            planning_days: 1
          },
          {
            text: 'Rent bikes for canal exploration',
            cost_estimate: 15,
            planning_days: 1
          },
          {
            text: 'Book canal house hotel',
            cost_estimate: 180,
            planning_days: 3
          },
          {
            text: 'Reserve Rijksmuseum tickets',
            url: 'https://www.rijksmuseum.nl/',
            cost_estimate: 20,
            planning_days: 1
          },
          {
            text: 'Arrange cheese and clog making workshop',
            cost_estimate: 60,
            planning_days: 1
          }
        ]
      },
      {
        name: 'Barcelona Gaudi Adventure',
        destination: createdDestinations[8]._id,
        experience_type: ['Cultural', 'Adventure', 'Architecture'],
        user: createdUsers[8]._id,
        permissions: [{
          _id: createdUsers[8]._id,
          entity: 'user',
          type: 'owner'
        }],
        photo: createdPhotos[8]._id,
        plan_items: [
          {
            text: 'Book Sagrada Familia tickets',
            url: 'https://sagradafamilia.org/',
            cost_estimate: 26,
            planning_days: 1
          },
          {
            text: 'Reserve Park Güell entry',
            url: 'https://parkguell.barcelona/',
            cost_estimate: 10,
            planning_days: 1
          },
          {
            text: 'Book Gothic Quarter hotel',
            cost_estimate: 150,
            planning_days: 3
          },
          {
            text: 'Arrange tapas and wine tour',
            cost_estimate: 70,
            planning_days: 1
          },
          {
            text: 'Purchase Barcelona Card',
            url: 'https://www.barcelonacard.org/',
            cost_estimate: 50,
            planning_days: 1
          }
        ]
      },
      {
        name: 'Prague Castle Discovery',
        destination: createdDestinations[9]._id,
        experience_type: ['Cultural', 'Historical', 'Adventure'],
        user: createdUsers[9]._id,
        permissions: [{
          _id: createdUsers[9]._id,
          entity: 'user',
          type: 'owner'
        }],
        photo: createdPhotos[9]._id,
        plan_items: [
          {
            text: 'Book Prague Castle complex tickets',
            url: 'https://www.hrad.cz/',
            cost_estimate: 15,
            planning_days: 1
          },
          {
            text: 'Reserve Charles Bridge photography tour',
            cost_estimate: 40,
            planning_days: 1
          },
          {
            text: 'Book hotel in Old Town Square',
            cost_estimate: 120,
            planning_days: 3
          },
          {
            text: 'Arrange beer tasting experience',
            cost_estimate: 35,
            planning_days: 1
          },
          {
            text: 'Purchase Prague Card',
            url: 'https://www.praguecard.com/',
            cost_estimate: 25,
            planning_days: 1
          }
        ]
      },
      {
        name: 'Rio Carnival Experience',
        destination: createdDestinations[10]._id,
        experience_type: ['Cultural', 'Adventure', 'Entertainment'],
        user: createdUsers[0]._id,
        permissions: [{
          _id: createdUsers[0]._id,
          entity: 'user',
          type: 'owner'
        }],
        photo: createdPhotos[10]._id,
        plan_items: [
          {
            text: 'Book Carnival parade tickets',
            cost_estimate: 200,
            planning_days: 3
          },
          {
            text: 'Reserve Christ the Redeemer entry',
            url: 'https://www.christthe redeemer3d.com/',
            cost_estimate: 25,
            planning_days: 1
          },
          {
            text: 'Book Copacabana beachfront hotel',
            cost_estimate: 180,
            planning_days: 3
          },
          {
            text: 'Arrange samba dance lessons',
            cost_estimate: 50,
            planning_days: 1
          },
          {
            text: 'Purchase Sugarloaf Mountain tickets',
            cost_estimate: 30,
            planning_days: 1
          }
        ]
      },
      {
        name: 'Mexico City Cultural Tour',
        destination: createdDestinations[11]._id,
        experience_type: ['Cultural', 'Historical', 'Food & Wine'],
        user: createdUsers[1]._id,
        permissions: [{
          _id: createdUsers[1]._id,
          entity: 'user',
          type: 'owner'
        }],
        photo: createdPhotos[11]._id,
        plan_items: [
          {
            text: 'Book National Anthropology Museum tickets',
            url: 'https://www.mna.inah.gob.mx/',
            cost_estimate: 5,
            planning_days: 1
          },
          {
            text: 'Reserve Teotihuacan Pyramids tour',
            cost_estimate: 45,
            planning_days: 1
          },
          {
            text: 'Book hotel in Condesa district',
            cost_estimate: 100,
            planning_days: 3
          },
          {
            text: 'Arrange Mexican cooking class',
            cost_estimate: 60,
            planning_days: 1
          },
          {
            text: 'Purchase CDMX metro card',
            cost_estimate: 3,
            planning_days: 1
          }
        ]
      },
      {
        name: 'Bangkok Street Food Journey',
        destination: createdDestinations[12]._id,
        experience_type: ['Food & Wine', 'Cultural', 'Adventure'],
        user: createdUsers[2]._id,
        permissions: [{
          _id: createdUsers[2]._id,
          entity: 'user',
          type: 'owner'
        }],
        photo: createdPhotos[12]._id,
        plan_items: [
          {
            text: 'Book Grand Palace and Wat Phra Kaew tickets',
            url: 'https://www.palaces.thai.net/',
            cost_estimate: 15,
            planning_days: 1
          },
          {
            text: 'Reserve Chao Phraya River dinner cruise',
            cost_estimate: 35,
            planning_days: 1
          },
          {
            text: 'Book hotel in Sukhumvit district',
            cost_estimate: 80,
            planning_days: 3
          },
          {
            text: 'Arrange street food tour',
            cost_estimate: 25,
            planning_days: 1
          },
          {
            text: 'Purchase BTS Skytrain card',
            cost_estimate: 10,
            planning_days: 1
          }
        ]
      },
      {
        name: 'Istanbul Bosphorus Cruise',
        destination: createdDestinations[13]._id,
        experience_type: ['Cultural', 'Adventure', 'Historical'],
        user: createdUsers[3]._id,
        permissions: [{
          _id: createdUsers[3]._id,
          entity: 'user',
          type: 'owner'
        }],
        photo: createdPhotos[13]._id,
        plan_items: [
          {
            text: 'Book Hagia Sophia and Blue Mosque entry',
            url: 'https://www.hagiasophia.com/',
            cost_estimate: 20,
            planning_days: 1
          },
          {
            text: 'Reserve Bosphorus cruise',
            cost_estimate: 25,
            planning_days: 1
          },
          {
            text: 'Book hotel in Sultanahmet',
            cost_estimate: 90,
            planning_days: 3
          },
          {
            text: 'Arrange Turkish bath experience',
            cost_estimate: 40,
            planning_days: 1
          },
          {
            text: 'Purchase Istanbulkart',
            cost_estimate: 8,
            planning_days: 1
          }
        ]
      },
      {
        name: 'Dublin Literary Tour',
        destination: createdDestinations[14]._id,
        experience_type: ['Cultural', 'Historical', 'Food & Wine'],
        user: createdUsers[4]._id,
        permissions: [{
          _id: createdUsers[4]._id,
          entity: 'user',
          type: 'owner'
        }],
        photo: createdPhotos[14]._id,
        plan_items: [
          {
            text: 'Book Dublin Castle tour',
            url: 'https://www.dublincastle.ie/',
            cost_estimate: 8,
            planning_days: 1
          },
          {
            text: 'Reserve Guinness Storehouse tickets',
            url: 'https://www.guinness-storehouse.com/',
            cost_estimate: 18,
            planning_days: 1
          },
          {
            text: 'Book hotel in Temple Bar',
            cost_estimate: 140,
            planning_days: 3
          },
          {
            text: 'Arrange Irish whiskey tasting',
            cost_estimate: 45,
            planning_days: 1
          },
          {
            text: 'Purchase Leap Card',
            cost_estimate: 15,
            planning_days: 1
          }
        ]
      },
      {
        name: 'Vancouver Island Nature Escape',
        destination: createdDestinations[15]._id,
        experience_type: ['Nature', 'Adventure', 'Wildlife'],
        user: createdUsers[5]._id,
        permissions: [{
          _id: createdUsers[5]._id,
          entity: 'user',
          type: 'owner'
        }],
        photo: createdPhotos[15]._id,
        plan_items: [
          {
            text: 'Book whale watching tour',
            cost_estimate: 120,
            planning_days: 1
          },
          {
            text: 'Reserve Pacific Rim National Park lodging',
            cost_estimate: 150,
            planning_days: 3
          },
          {
            text: 'Arrange bear viewing safari',
            cost_estimate: 80,
            planning_days: 1
          },
          {
            text: 'Book storm watching experience',
            cost_estimate: 60,
            planning_days: 1
          },
          {
            text: 'Purchase BC Ferries ticket',
            cost_estimate: 20,
            planning_days: 1
          }
        ]
      },
      {
        name: 'Munich Beer Garden Tour',
        destination: createdDestinations[16]._id,
        experience_type: ['Food & Wine', 'Cultural', 'Adventure'],
        user: createdUsers[6]._id,
        permissions: [{
          _id: createdUsers[6]._id,
          entity: 'user',
          type: 'owner'
        }],
        photo: createdPhotos[16]._id,
        plan_items: [
          {
            text: 'Book Neuschwanstein Castle day trip',
            cost_estimate: 70,
            planning_days: 1
          },
          {
            text: 'Reserve Hofbräuhaus table',
            url: 'https://www.hofbraeuhaus.de/',
            cost_estimate: 15,
            planning_days: 1
          },
          {
            text: 'Book hotel in Schwabing',
            cost_estimate: 130,
            planning_days: 3
          },
          {
            text: 'Arrange Oktoberfest tickets (seasonal)',
            cost_estimate: 80,
            planning_days: 2
          },
          {
            text: 'Purchase Munich CityTourCard',
            cost_estimate: 15,
            planning_days: 1
          }
        ]
      },
      {
        name: 'Copenhagen Hygge Experience',
        destination: createdDestinations[17]._id,
        experience_type: ['Cultural', 'Food & Wine', 'Urban'],
        user: createdUsers[7]._id,
        permissions: [{
          _id: createdUsers[7]._id,
          entity: 'user',
          type: 'owner'
        }],
        photo: createdPhotos[17]._id,
        plan_items: [
          {
            text: 'Book Tivoli Gardens entry',
            url: 'https://www.tivoli.dk/',
            cost_estimate: 15,
            planning_days: 1
          },
          {
            text: 'Reserve Copenhagen Card',
            url: 'https://www.copenhagencard.com/',
            cost_estimate: 60,
            planning_days: 1
          },
          {
            text: 'Book hotel in Vesterbro',
            cost_estimate: 160,
            planning_days: 3
          },
          {
            text: 'Arrange New Nordic cuisine tasting',
            cost_estimate: 90,
            planning_days: 1
          },
          {
            text: 'Purchase bicycle rental',
            cost_estimate: 20,
            planning_days: 1
          }
        ]
      },
      {
        name: 'Zurich Lake and Mountains',
        destination: createdDestinations[18]._id,
        experience_type: ['Nature', 'Adventure', 'Cultural'],
        user: createdUsers[8]._id,
        permissions: [{
          _id: createdUsers[8]._id,
          entity: 'user',
          type: 'owner'
        }],
        photo: createdPhotos[18]._id,
        plan_items: [
          {
            text: 'Book Mount Rigi day trip',
            cost_estimate: 80,
            planning_days: 1
          },
          {
            text: 'Reserve Lake Zurich cruise',
            cost_estimate: 35,
            planning_days: 1
          },
          {
            text: 'Book hotel near the lake',
            cost_estimate: 200,
            planning_days: 3
          },
          {
            text: 'Arrange chocolate making workshop',
            cost_estimate: 70,
            planning_days: 1
          },
          {
            text: 'Purchase Swiss Travel Pass',
            cost_estimate: 90,
            planning_days: 1
          }
        ]
      },
      {
        name: 'Stockholm Archipelago Cruise',
        destination: createdDestinations[19]._id,
        experience_type: ['Nature', 'Adventure', 'Cultural'],
        user: createdUsers[9]._id,
        permissions: [{
          _id: createdUsers[9]._id,
          entity: 'user',
          type: 'owner'
        }],
        photo: createdPhotos[19]._id,
        plan_items: [
          {
            text: 'Book Vasa Museum tickets',
            url: 'https://www.vasamuseet.se/',
            cost_estimate: 15,
            planning_days: 1
          },
          {
            text: 'Reserve archipelago boat tour',
            cost_estimate: 40,
            planning_days: 1
          },
          {
            text: 'Book hotel on Djurgården',
            cost_estimate: 170,
            planning_days: 3
          },
          {
            text: 'Arrange fika experience',
            cost_estimate: 25,
            planning_days: 1
          },
          {
            text: 'Purchase Stockholm Pass',
            cost_estimate: 70,
            planning_days: 1
          }
        ]
      },
      {
        name: 'Paris Food & Wine Tour',
        destination: createdDestinations[0]._id,
        experience_type: ['Food & Wine', 'Cultural'],
        user: createdUsers[0]._id,
        permissions: [{
          _id: createdUsers[0]._id,
          entity: 'user',
          type: 'owner'
        }],
        plan_items: [
          {
            text: 'Book wine tasting in Bordeaux region',
            cost_estimate: 120,
            planning_days: 2
          },
          {
            text: 'Reserve cooking class with local chef',
            cost_estimate: 150,
            planning_days: 1
          },
          {
            text: 'Arrange food market tour in Les Halles',
            cost_estimate: 60,
            planning_days: 1
          }
        ]
      },
      {
        name: 'Tokyo Nightlife Experience',
        destination: createdDestinations[1]._id,
        experience_type: ['Cultural', 'Urban', 'Entertainment'],
        user: createdUsers[1]._id,
        permissions: [{
          _id: createdUsers[1]._id,
          entity: 'user',
          type: 'owner'
        }],
        plan_items: [
          {
            text: 'Book tickets for Robot Restaurant show',
            url: 'https://www.robotrestaurant.jp/',
            cost_estimate: 80,
            planning_days: 2
          },
          {
            text: 'Reserve karaoke room in Shibuya',
            cost_estimate: 50,
            planning_days: 1
          },
          {
            text: 'Arrange izakaya pub crawl experience',
            cost_estimate: 100,
            planning_days: 1
          }
        ]
      },
      {
        name: 'Barcelona Beach & Culture',
        destination: createdDestinations[8]._id,
        experience_type: ['Adventure', 'Cultural', 'Urban'],
        user: createdUsers[2]._id,
        permissions: [{
          _id: createdUsers[2]._id,
          entity: 'user',
          type: 'owner'
        }],
        plan_items: [
          {
            text: 'Book Barceloneta Beach club day pass',
            cost_estimate: 25,
            planning_days: 1
          },
          {
            text: 'Reserve Picasso Museum tickets',
            url: 'https://www.museupicasso.bcn.cat/',
            cost_estimate: 12,
            planning_days: 1
          },
          {
            text: 'Arrange flamenco dance show',
            cost_estimate: 40,
            planning_days: 1
          }
        ]
      },
      {
        name: 'Rome Ancient History Tour',
        destination: createdDestinations[5]._id,
        experience_type: ['Historical', 'Cultural', 'Adventure'],
        user: createdUsers[3]._id,
        permissions: [{
          _id: createdUsers[3]._id,
          entity: 'user',
          type: 'owner'
        }],
        plan_items: [
          {
            text: 'Book Gladiator School experience',
            cost_estimate: 90,
            planning_days: 1
          },
          {
            text: 'Reserve Pompeii day trip',
            cost_estimate: 60,
            planning_days: 1
          },
          {
            text: 'Arrange private Vatican tour',
            cost_estimate: 120,
            planning_days: 1
          }
        ]
      },
      {
        name: 'London Theater District',
        destination: createdDestinations[6]._id,
        experience_type: ['Entertainment', 'Cultural', 'Urban'],
        user: createdUsers[4]._id,
        permissions: [{
          _id: createdUsers[4]._id,
          entity: 'user',
          type: 'owner'
        }],
        plan_items: [
          {
            text: 'Book West End musical tickets',
            url: 'https://www.londontheatre.co.uk/',
            cost_estimate: 120,
            planning_days: 2
          },
          {
            text: 'Reserve afternoon tea at The Ritz',
            cost_estimate: 80,
            planning_days: 1
          },
          {
            text: 'Arrange Jack the Ripper walking tour',
            cost_estimate: 20,
            planning_days: 1
          }
        ]
      },
      {
        name: 'Amsterdam Red Light District Tour',
        destination: createdDestinations[7]._id,
        experience_type: ['Cultural', 'Urban', 'Adventure'],
        user: createdUsers[5]._id,
        permissions: [{
          _id: createdUsers[5]._id,
          entity: 'user',
          type: 'owner'
        }],
        plan_items: [
          {
            text: 'Book Red Light District guided tour',
            cost_estimate: 25,
            planning_days: 1
          },
          {
            text: 'Reserve coffee shop experience',
            cost_estimate: 30,
            planning_days: 1
          },
          {
            text: 'Arrange canal house boat rental',
            cost_estimate: 150,
            planning_days: 1
          }
        ]
      },
      {
        name: 'Sydney Wildlife Encounter',
        destination: createdDestinations[3]._id,
        experience_type: ['Nature', 'Wildlife', 'Adventure'],
        user: createdUsers[6]._id,
        permissions: [{
          _id: createdUsers[6]._id,
          entity: 'user',
          type: 'owner'
        }],
        plan_items: [
          {
            text: 'Book Taronga Zoo tickets',
            url: 'https://taronga.org.au/',
            cost_estimate: 50,
            planning_days: 1
          },
          {
            text: 'Reserve Great Barrier Reef day trip',
            cost_estimate: 200,
            planning_days: 1
          },
          {
            text: 'Arrange koala cuddling experience',
            cost_estimate: 35,
            planning_days: 1
          }
        ]
      },
      {
        name: 'Cape Town Wine Country',
        destination: createdDestinations[4]._id,
        experience_type: ['Food & Wine', 'Nature', 'Cultural'],
        user: createdUsers[7]._id,
        permissions: [{
          _id: createdUsers[7]._id,
          entity: 'user',
          type: 'owner'
        }],
        plan_items: [
          {
            text: 'Book Stellenbosch wine tour',
            cost_estimate: 80,
            planning_days: 1
          },
          {
            text: 'Reserve Franschhoek valley experience',
            cost_estimate: 100,
            planning_days: 1
          },
          {
            text: 'Arrange gourmet picnic basket',
            cost_estimate: 45,
            planning_days: 1
          }
        ]
      },
      {
        name: 'Tokyo Sushi Masterclass',
        destination: createdDestinations[1]._id,
        experience_type: ['Food & Wine', 'Cultural', 'Adventure'],
        user: createdUsers[8]._id,
        permissions: [{
          _id: createdUsers[8]._id,
          entity: 'user',
          type: 'owner'
        }],
        plan_items: [
          {
            text: 'Book sushi making workshop',
            cost_estimate: 120,
            planning_days: 1
          },
          {
            text: 'Reserve Tsukiji fish market tour',
            cost_estimate: 40,
            planning_days: 1
          },
          {
            text: 'Arrange sake tasting experience',
            cost_estimate: 60,
            planning_days: 1
          }
        ]
      },
      {
        name: 'New York Broadway Week',
        destination: createdDestinations[2]._id,
        experience_type: ['Entertainment', 'Cultural', 'Urban'],
        user: createdUsers[9]._id,
        permissions: [{
          _id: createdUsers[9]._id,
          entity: 'user',
          type: 'owner'
        }],
        plan_items: [
          {
            text: 'Book Hamilton musical tickets',
            cost_estimate: 200,
            planning_days: 3
          },
          {
            text: 'Reserve Top of the Rock VIP experience',
            cost_estimate: 80,
            planning_days: 1
          },
          {
            text: 'Arrange backstage theater tour',
            cost_estimate: 50,
            planning_days: 1
          }
        ]
      }
    ];

    for (const expData of experiences) {
      const exp = new Experience(expData);
      await exp.save();
      console.log(`✅ Created experience: ${exp.name}`);
    }

    console.log('\nSample data creation completed successfully!');
    console.log('User created: john@doe.com / test');
    console.log(`Created ${createdDestinations.length} destinations`);
    console.log(`Created ${experiences.length} experiences`);
    console.log(`Created ${createdPhotos.length} photos`);

  } catch (error) {
    console.error('Error creating sample data:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the function
createSampleData().catch(console.error);