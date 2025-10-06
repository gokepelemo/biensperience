require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/user');
const Destination = require('./models/destination');
const Experience = require('./models/experience');

async function main() {
  try {
    await mongoose.connect(process.env.DATABASE_URL);
    console.log('Connected to database');

    // Find or create user
    let user = await User.findOne({ email: 'goke.pelemo+test@gmail.com' });
    if (!user) {
      user = new User({
        name: 'Test User',
        email: 'goke.pelemo+test@gmail.com',
        password: 'testpassword123' // Will be hashed
      });
      await user.save();
      console.log('Created user:', user.email);
    } else {
      console.log('Found user:', user.email);
    }

    // Create destinations
    const destinations = [
      { name: 'Paris', country: 'France', state: 'Île-de-France' },
      { name: 'Tokyo', country: 'Japan' },
      { name: 'New York', country: 'USA', state: 'New York' },
      { name: 'Sydney', country: 'Australia', state: 'New South Wales' },
      { name: 'Cape Town', country: 'South Africa', state: 'Western Cape' }
    ];

    const createdDestinations = [];
    for (const destData of destinations) {
      const dest = new Destination({
        ...destData,
        user: user._id,
        travel_tips: [`Visit ${destData.name} for amazing experiences!`]
      });
      await dest.save();
      createdDestinations.push(dest);
      console.log('Created destination:', dest.name);
    }

    // Create experiences
    const experiences = [
      {
        name: 'Romantic Paris Getaway',
        destination: createdDestinations[0]._id,
        experience_type: ['Romantic', 'Cultural'],
        plan_items: [
          { text: 'Book Eiffel Tower tickets', cost_estimate: 50, planning_days: 7 },
          { text: 'Reserve Seine River dinner cruise', cost_estimate: 30, planning_days: 14 },
          { text: 'Purchase Louvre Museum tickets', cost_estimate: 20, planning_days: 3 }
        ]
      },
      {
        name: 'Tokyo Food Adventure',
        destination: createdDestinations[1]._id,
        experience_type: ['Food', 'Cultural'],
        plan_items: [
          { text: 'Reserve Tsukiji Market sushi course', cost_estimate: 100, planning_days: 30 },
          { text: 'Book ramen tour in Shinjuku', cost_estimate: 15, planning_days: 7 },
          { text: 'Schedule tempura making class', cost_estimate: 40, planning_days: 21 }
        ]
      },
      {
        name: 'New York City Exploration',
        destination: createdDestinations[2]._id,
        experience_type: ['Urban', 'Adventure'],
        plan_items: [
          { text: 'Book Statue of Liberty ferry tickets', cost_estimate: 25, planning_days: 14 },
          { text: 'Reserve Central Park picnic area', cost_estimate: 10, planning_days: 1 },
          { text: 'Purchase Broadway show tickets', cost_estimate: 150, planning_days: 60 }
        ]
      },
      {
        name: 'Sydney Beach Holiday',
        destination: createdDestinations[3]._id,
        experience_type: ['Beach', 'Nature'],
        plan_items: [
          { text: 'Book Bondi Beach surf lessons', cost_estimate: 50, planning_days: 7 },
          { text: 'Reserve Sydney Opera House tour', cost_estimate: 45, planning_days: 30 },
          { text: 'Book Harbour Bridge climb', cost_estimate: 200, planning_days: 60 }
        ]
      },
      {
        name: 'Cape Town Wine Tour',
        destination: createdDestinations[4]._id,
        experience_type: ['Wine', 'Nature'],
        plan_items: [
          { text: 'Book Stellenbosch wine tasting tour', cost_estimate: 80, planning_days: 14 },
          { text: 'Reserve Table Mountain hiking guide', cost_estimate: 20, planning_days: 7 },
          { text: 'Schedule Cape Peninsula coastal drive', cost_estimate: 15, planning_days: 3 }
        ]
      }
    ];

    for (const expData of experiences) {
      const exp = new Experience({
        ...expData,
        user: user._id
      });
      await exp.save();
      console.log('Created experience:', exp.name);
    }

    console.log('All data added successfully!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from database');
  }
}

main();