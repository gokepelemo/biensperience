require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/user');
const Destination = require('./models/destination');
const Experience = require('./models/experience');

async function main() {
  try {
    await mongoose.connect(process.env.DATABASE_URL);
    console.log('Connected to database');

    // Find the user
    const user = await User.findOne({ email: 'goke.pelemo+test@gmail.com' });
    if (!user) {
      console.log('User not found');
      return;
    }
    console.log('User:', user.name, user.email);

    // Get destinations created by the user
    const destinations = await Destination.find({ user: user._id }).populate('user');
    console.log('\nDestinations:');
    destinations.forEach(dest => {
      console.log(`- ${dest.name}, ${dest.country} (${dest.state || 'N/A'})`);
      console.log(`  Created by: ${dest.user.name}`);
      console.log(`  Travel tips: ${dest.travel_tips.join(', ')}`);
    });

    // Get experiences created by the user
    const experiences = await Experience.find({ user: user._id })
      .populate('destination')
      .populate('user');
    console.log('\nExperiences:');
    experiences.forEach(exp => {
      console.log(`- ${exp.name}`);
      console.log(`  Destination: ${exp.destination.name}, ${exp.destination.country}`);
      console.log(`  Type: ${exp.experience_type.join(', ')}`);
      console.log(`  Plan items: ${exp.plan_items.length}`);
      exp.plan_items.forEach(item => {
        console.log(`    - ${item.text} ($${item.cost_estimate}, ${item.planning_days} days)`);
      });
      console.log(`  Total cost estimate: $${exp.cost_estimate}`);
      console.log(`  Max planning days: ${exp.max_planning_days}`);
      console.log(`  Created by: ${exp.user.name}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from database');
  }
}

main();