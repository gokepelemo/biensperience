require('dotenv').config();
const mongoose = require('mongoose');
const Experience = require('./models/experience');
const Destination = require('./models/destination');
const Photo = require('./models/photo');
const User = require('./models/user');

async function enrichExperiences() {
  try {
    console.log('🔌 Connecting to database...');
    await mongoose.connect(process.env.DATABASE_URL);
    console.log('✅ Connected to database successfully');

    // Get all experiences with populated data
    const experiences = await Experience.find({})
      .populate('destination')
      .populate('photo')
      .populate('user')
      .populate('plan_items.photo');

    console.log(`📊 Found ${experiences.length} total experiences`);

    // Find experiences that need enrichment
    const experiencesToEnrich = experiences.filter(exp => {
      const needsImage = !exp.photo;
      const needsPlanItems = !exp.plan_items || exp.plan_items.length === 0;
      const needsChildItems = !exp.plan_items || !exp.plan_items.some(item => item.parent);
      
      return needsImage || needsPlanItems || needsChildItems;
    });

    console.log(`🎯 Found ${experiencesToEnrich.length} experiences that need enrichment`);

    // Get available photos and destinations for enrichment
    const availablePhotos = await Photo.find({});
    const availableDestinations = await Destination.find({});

    for (const experience of experiencesToEnrich) {
      console.log(`\n🔄 Enriching experience: "${experience.name}"`);
      
      let needsUpdate = false;
      const updateData = {};

      // 1. Add photo if missing
      if (!experience.photo && availablePhotos.length > 0) {
        // Find a photo that matches the destination or use a random one
        const matchingPhoto = availablePhotos.find(photo => 
          photo.url && photo.url.includes(experience.destination.name.toLowerCase().replace(/\s+/g, ''))
        ) || availablePhotos[Math.floor(Math.random() * availablePhotos.length)];
        
        updateData.photo = matchingPhoto._id;
        console.log(`   📸 Added photo: ${matchingPhoto.url}`);
        needsUpdate = true;
      }

      // 2. Add plan items if missing
      if (!experience.plan_items || experience.plan_items.length === 0) {
        const destinationName = experience.destination.name;
        const planItems = generatePlanItemsForDestination(destinationName, availablePhotos);
        updateData.plan_items = planItems;
        console.log(`   📝 Added ${planItems.length} plan items`);
        needsUpdate = true;
      }

      // 3. Add child plan items if missing
      if (experience.plan_items && experience.plan_items.length > 0 && !experience.plan_items.some(item => item.parent)) {
        const childItems = generateChildPlanItems(experience.plan_items, availablePhotos);
        if (childItems.length > 0) {
          updateData.plan_items = [...experience.plan_items, ...childItems];
          console.log(`   👶 Added ${childItems.length} child plan items`);
          needsUpdate = true;
        }
      }

      // Update the experience if needed
      if (needsUpdate) {
        await Experience.findByIdAndUpdate(experience._id, updateData);
        console.log(`   ✅ Updated experience: "${experience.name}"`);
      } else {
        console.log(`   ℹ️  No updates needed for: "${experience.name}"`);
      }
    }

    console.log('\n🎉 Experience enrichment completed!');
    
    // Show summary
    const enrichedExperiences = await Experience.find({})
      .populate('destination')
      .populate('photo')
      .populate('plan_items.photo');

    const withPhotos = enrichedExperiences.filter(exp => exp.photo).length;
    const withPlanItems = enrichedExperiences.filter(exp => exp.plan_items && exp.plan_items.length > 0).length;
    const withChildItems = enrichedExperiences.filter(exp => exp.plan_items && exp.plan_items.some(item => item.parent)).length;

    console.log('\n📈 Enrichment Summary:');
    console.log(`   📸 Experiences with photos: ${withPhotos}/${enrichedExperiences.length}`);
    console.log(`   📝 Experiences with plan items: ${withPlanItems}/${enrichedExperiences.length}`);
    console.log(`   👶 Experiences with child items: ${withChildItems}/${enrichedExperiences.length}`);

  } catch (error) {
    console.error('❌ Error enriching experiences:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

function generatePlanItemsForDestination(destinationName, availablePhotos) {
  const planTemplates = {
    'Paris': [
      { text: 'Book Eiffel Tower tickets in advance', url: 'https://www.toureiffel.paris/en', cost_estimate: 20, planning_days: 1 },
      { text: 'Reserve table at a Michelin-starred restaurant', cost_estimate: 300, planning_days: 2 },
      { text: 'Arrange Seine River dinner cruise', cost_estimate: 150, planning_days: 1 },
      { text: 'Purchase Louvre Museum tickets', cost_estimate: 17, planning_days: 1 },
      { text: 'Book hotel in Le Marais district', cost_estimate: 250, planning_days: 3 }
    ],
    'Tokyo': [
      { text: 'Visit Senso-ji Temple in Asakusa', cost_estimate: 0, planning_days: 1 },
      { text: 'Experience Tsukiji Outer Market', cost_estimate: 50, planning_days: 1 },
      { text: 'Book traditional ryokan accommodation', cost_estimate: 200, planning_days: 2 },
      { text: 'Arrange tea ceremony experience', cost_estimate: 80, planning_days: 1 },
      { text: 'Purchase JR Pass for transportation', cost_estimate: 300, planning_days: 1 }
    ],
    'New York': [
      { text: 'Book tickets for Broadway show', cost_estimate: 150, planning_days: 2 },
      { text: 'Reserve Top of the Rock observation deck', cost_estimate: 40, planning_days: 1 },
      { text: 'Book hotel in Manhattan', cost_estimate: 300, planning_days: 3 },
      { text: 'Purchase MetroCard for subway', cost_estimate: 30, planning_days: 1 },
      { text: 'Arrange food tour of different neighborhoods', cost_estimate: 100, planning_days: 1 }
    ],
    'default': [
      { text: 'Book accommodation for your stay', cost_estimate: 200, planning_days: 3 },
      { text: 'Research local transportation options', cost_estimate: 50, planning_days: 1 },
      { text: 'Plan daily itinerary and activities', cost_estimate: 0, planning_days: 2 },
      { text: 'Arrange meals and dining reservations', cost_estimate: 150, planning_days: 1 },
      { text: 'Purchase tickets for attractions', cost_estimate: 100, planning_days: 1 }
    ]
  };

  const template = planTemplates[destinationName] || planTemplates['default'];
  
  return template.map((item, index) => {
    // Add a random photo to some plan items
    const shouldAddPhoto = Math.random() > 0.6 && availablePhotos.length > 0;
    const photo = shouldAddPhoto ? availablePhotos[Math.floor(Math.random() * availablePhotos.length)]._id : undefined;
    
    return {
      text: item.text,
      url: item.url,
      cost_estimate: item.cost_estimate,
      planning_days: item.planning_days,
      photo: photo
    };
  });
}

function generateChildPlanItems(parentItems, availablePhotos) {
  const childItems = [];
  
  // For each parent item, potentially add 1-2 child items
  parentItems.forEach((parentItem, index) => {
    if (Math.random() > 0.6) { // 40% chance to add child items
      const numChildren = Math.floor(Math.random() * 2) + 1; // 1-2 children
      
      for (let i = 0; i < numChildren; i++) {
        const childTemplates = [
          'Research specific details and requirements',
          'Check weather and best time to visit',
          'Book transportation to location',
          'Prepare necessary documentation',
          'Arrange backup plans and alternatives',
          'Coordinate with travel companions',
          'Pack appropriate clothing and gear',
          'Set up local communication methods'
        ];
        
        const randomTemplate = childTemplates[Math.floor(Math.random() * childTemplates.length)];
        const shouldAddPhoto = Math.random() > 0.7 && availablePhotos.length > 0;
        const photo = shouldAddPhoto ? availablePhotos[Math.floor(Math.random() * availablePhotos.length)]._id : undefined;
        
        childItems.push({
          text: randomTemplate,
          cost_estimate: Math.floor(Math.random() * 50),
          planning_days: Math.floor(Math.random() * 3) + 1,
          parent: parentItem._id || parentItem, // Handle both ObjectId and plan item object
          photo: photo
        });
      }
    }
  });
  
  return childItems;
}

enrichExperiences().catch(console.error);
