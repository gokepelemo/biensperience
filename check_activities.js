const mongoose = require('mongoose');
const Activity = require('./models/activity');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/biensperience')
  .then(async () => {
    console.log('Connected to MongoDB');
    
    const count = await Activity.countDocuments();
    console.log(`\nTotal activities in database: ${count}`);
    
    const recent = await Activity.find().sort({ timestamp: -1 }).limit(5).lean();
    console.log('\nMost recent 5 activities:');
    recent.forEach(a => {
      console.log(`\n- ${a.action} by ${a.actor.email} at ${a.timestamp}`);
      console.log(`  Resource: ${a.resource.type} - ${a.resource.name}`);
      console.log(`  Actor ID: ${a.actor._id}`);
      if (a.target) {
        console.log(`  Target: ${a.target.type} - ${a.target.name}`);
      }
    });
    
    const planItems = await Activity.find({ 
      action: { $in: ['plan_item_completed', 'plan_item_uncompleted'] }
    }).sort({ timestamp: -1 }).limit(5).lean();
    
    console.log(`\n\nPlan item completion activities: ${planItems.length}`);
    planItems.forEach(a => {
      console.log(`\n- ${a.action} by ${a.actor.email} at ${a.timestamp}`);
      console.log(`  Resource: ${a.resource.name}`);
      console.log(`  Target: ${a.target.name}`);
      console.log(`  Actor ID: ${a.actor._id}`);
    });
    
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
