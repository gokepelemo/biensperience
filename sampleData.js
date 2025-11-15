require('dotenv').config();
const mongoose = require('mongoose');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const User = require('./models/user');
const Destination = require('./models/destination');
const Experience = require('./models/experience');
const Photo = require('./models/photo');
const Plan = require('./models/plan');
const InviteCode = require('./models/inviteCode');
const Activity = require('./models/activity');
const backendLogger = require('./utilities/backend-logger');

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    clear: args.includes('--clear') || args.includes('-c'),
    help: args.includes('--help') || args.includes('-h'),
    adminName: null,
    adminEmail: null,
    users: null,
    destinations: null,
    experiences: null,
    plans: null,
    photos: null,
    invites: null,
    activities: null
  };

  // Parse --admin-name flag
  const nameIndex = args.findIndex(arg => arg === '--admin-name');
  if (nameIndex !== -1 && args[nameIndex + 1]) {
    parsed.adminName = args[nameIndex + 1];
  }

  // Parse --admin-email flag
  const emailIndex = args.findIndex(arg => arg === '--admin-email');
  if (emailIndex !== -1 && args[emailIndex + 1]) {
    parsed.adminEmail = args[emailIndex + 1];
  }

  // Parse resource count flags
  const parseNumberFlag = (flagName) => {
    const index = args.findIndex(arg => arg === flagName);
    if (index !== -1 && args[index + 1]) {
      const num = parseInt(args[index + 1], 10);
      return isNaN(num) ? null : num;
    }
    return null;
  };

  parsed.users = parseNumberFlag('--users');
  parsed.destinations = parseNumberFlag('--destinations');
  parsed.experiences = parseNumberFlag('--experiences');
  parsed.plans = parseNumberFlag('--plans');
  parsed.photos = parseNumberFlag('--photos');
  parsed.invites = parseNumberFlag('--invites');
  parsed.activities = parseNumberFlag('--activities');

  return parsed;
}

/**
 * Display help information
 */
function showHelp() {
  backendLogger.info(`
Biensperience Sample Data Generator

Usage: node sampleData.js [options]

Options:
  --clear, -c                     Clear all existing data before generating new sample data
  --admin-name "Full Name"        Set the super admin's full name
  --admin-email "email@domain"    Set the super admin's email address
  --users <number>                Number of regular users to create (default: 180)
  --destinations <number>         Number of destinations to create (default: 90)
  --experiences <number>          Number of experiences to create (default: 270)
  --plans <number>                Number of user plans to create (default: 450)
  --photos <number>               Number of photos to create (default: 600)
  --invites <number>              Number of invite codes to create (default: 60)
  --activities <number>           Number of activity log entries to create (default: 300)
  --help, -h                      Show this help message

Description:
  Generates comprehensive sample data for Biensperience including:
  - 1 super admin user (interactive or via flags) with API access and active session
  - 180 regular users with varied profiles (configurable with --users):
    * 80% email verified, 20% unverified (email verification flow)
    * 60% with active sessions (session tracking)
    * 30% with invite codes (invite system)
    * 10% with API access enabled (API token system)
    * 70% public, 30% private profiles
  - 90 destinations worldwide with structured travel tips (configurable with --destinations)
  - 270 experiences with collaborators and plan items (configurable with --experiences)
  - 600 photos from Unsplash (configurable with --photos)
  - 450 user plans with varying completion levels (configurable with --plans)
  - 60 invite codes with various configurations (configurable with --invites)
  - 300 activity log entries (last 30 days) with metadata (configurable with --activities)

  If --admin-name and --admin-email are not provided, the script will prompt
  you interactively for these details.

  All output including super admin credentials is saved to sampleData.txt.
  This file is automatically added to .gitignore for security.

Examples:
  node sampleData.js
    # Generate sample data with default counts (3x original)

  node sampleData.js --clear
    # Clear database and generate fresh sample data

  node sampleData.js --admin-name "John Doe" --admin-email "john@example.com"
    # Generate with specific super admin credentials

  node sampleData.js --users 50 --destinations 20 --experiences 100
    # Generate with custom resource counts

  node sampleData.js --clear --admin-name "Admin" --admin-email "admin@test.com" --users 200
    # Clear database and generate with custom super admin and 200 users

  node sampleData.js --help
    # Show this help message

Output:
  - All output is displayed in the terminal
  - Super admin credentials and full log saved to sampleData.txt
  - sampleData.txt is excluded from git for security (contains passwords)
`);
  process.exit(0);
}

/**
 * Prompt user for input
 */
function promptUser(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Get super admin details interactively or from flags
 */
async function getSuperAdminDetails(args) {
  let adminName = args.adminName;
  let adminEmail = args.adminEmail;

  // If name not provided via flag, prompt interactively
  if (!adminName) {
    backendLogger.info('\n👤 Super Admin Setup');
    backendLogger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    adminName = await promptUser('Enter super admin full name: ');

    // Validate name is not empty
    while (!adminName || adminName.length === 0) {
      backendLogger.warn('❌ Name cannot be empty.');
      adminName = await promptUser('Enter super admin full name: ');
    }
  }

  // If email not provided via flag, prompt interactively
  if (!adminEmail) {
    adminEmail = await promptUser('Enter super admin email address: ');

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    while (!adminEmail || !emailRegex.test(adminEmail)) {
      backendLogger.warn('❌ Invalid email format.');
      adminEmail = await promptUser('Enter super admin email address: ');
    }
  }

  backendLogger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  return { adminName, adminEmail };
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
 * Shuffle array using Fisher-Yates algorithm
 */
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Data generators for comprehensive sample data
 */
class DataGenerator {
  constructor() {
    // Massively expanded list of realistic first names (diverse, international)
    this.firstNames = [
      // Common English names (Classic)
      'James', 'Mary', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth',
      'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah',
      'Christopher', 'Karen', 'Daniel', 'Lisa', 'Matthew', 'Nancy', 'Anthony', 'Betty',
      'Mark', 'Margaret', 'Donald', 'Sandra', 'Steven', 'Ashley', 'Andrew', 'Emily',
      'Paul', 'Kimberly', 'Joshua', 'Donna', 'Kenneth', 'Michelle', 'Kevin', 'Carol',
      'Brian', 'Amanda', 'George', 'Dorothy', 'Edward', 'Melissa', 'Ronald', 'Deborah',
      'Timothy', 'Stephanie', 'Jason', 'Rebecca', 'Jeffrey', 'Sharon', 'Ryan', 'Cynthia',
      'Jacob', 'Kathleen', 'Gary', 'Amy', 'Nicholas', 'Angela', 'Eric', 'Shirley',
      'Jonathan', 'Anna', 'Stephen', 'Brenda', 'Larry', 'Pamela', 'Justin', 'Emma',
      'Scott', 'Nicole', 'Brandon', 'Helen', 'Benjamin', 'Samantha', 'Samuel', 'Katherine',

      // Modern/Popular names (2000s-2020s)
      'Liam', 'Olivia', 'Noah', 'Ava', 'Ethan', 'Sophia', 'Mason', 'Isabella',
      'Logan', 'Mia', 'Lucas', 'Charlotte', 'Jackson', 'Amelia', 'Aiden', 'Harper',
      'Carter', 'Evelyn', 'Jayden', 'Abigail', 'Alexander', 'Ella', 'Sebastian', 'Aria',
      'Grayson', 'Scarlett', 'Matthew', 'Chloe', 'Jack', 'Victoria', 'Owen', 'Madison',
      'Luke', 'Luna', 'Henry', 'Grace', 'Wyatt', 'Nora', 'Levi', 'Lily',
      'Isaac', 'Hannah', 'Gabriel', 'Layla', 'Julian', 'Zoey', 'Mateo', 'Penelope',
      'Anthony', 'Lillian', 'Jaxon', 'Addison', 'Lincoln', 'Aubrey', 'Joshua', 'Ellie',

      // International names (East Asian)
      'Wei', 'Yuki', 'Mei', 'Jin', 'Sakura', 'Akira', 'Hana', 'Kenji', 'Sora',
      'Ren', 'Aiko', 'Haruto', 'Yui', 'Sota', 'Hinata', 'Riku', 'Mio', 'Kaito',
      'Ming', 'Jian', 'Liang', 'Xiao', 'Yan', 'Feng', 'Ling', 'Hui', 'Jun',
      'Tae', 'Soo', 'Min', 'Ji', 'Hye', 'Sung', 'Eun', 'Kyung', 'Young',

      // International names (South Asian)
      'Priya', 'Raj', 'Ravi', 'Anika', 'Arjun', 'Devi', 'Rohan', 'Sanjay', 'Deepak',
      'Kavya', 'Vikram', 'Neha', 'Amit', 'Pooja', 'Kiran', 'Maya', 'Aditya', 'Shreya',
      'Aarav', 'Ananya', 'Vihaan', 'Ishaan', 'Vivaan', 'Sara', 'Reyansh', 'Diya',

      // International names (Middle Eastern/Arabic)
      'Ahmed', 'Fatima', 'Hassan', 'Aisha', 'Omar', 'Layla', 'Ali', 'Zahra',
      'Muhammad', 'Noor', 'Yusuf', 'Amira', 'Karim', 'Zainab', 'Ibrahim', 'Mariam',
      'Khalid', 'Hala', 'Tariq', 'Rania', 'Samir', 'Leila', 'Rashid', 'Yasmin',

      // International names (Hispanic/Latino)
      'Carlos', 'Sofia', 'Luis', 'Diego', 'Mateo', 'Lucia', 'Marco', 'Valentina',
      'Santiago', 'Isabella', 'Miguel', 'Camila', 'Gabriel', 'Valeria', 'Alejandro', 'Daniela',
      'Rafael', 'Adriana', 'Fernando', 'Natalia', 'Pablo', 'Elena', 'Javier', 'Catalina',
      'Antonio', 'Mariana', 'Eduardo', 'Carolina', 'Ricardo', 'Gabriela', 'Andres', 'Andrea',

      // International names (European)
      'Luca', 'Emma', 'Matteo', 'Alice', 'Leonardo', 'Giulia', 'Alessandro', 'Francesca',
      'Pierre', 'Marie', 'Jean', 'Claire', 'Antoine', 'Camille', 'Louis', 'Manon',
      'Max', 'Anna', 'Felix', 'Lena', 'Lukas', 'Mia', 'Jonas', 'Emma',
      'Nikita', 'Anastasia', 'Ivan', 'Natasha', 'Dmitri', 'Olga', 'Mikhail', 'Svetlana',
      'Lars', 'Ingrid', 'Erik', 'Astrid', 'Anders', 'Freya', 'Henrik', 'Sigrid',

      // International names (African)
      'Amara', 'Kofi', 'Zuri', 'Kwame', 'Nia', 'Jabari', 'Ayana', 'Kendi',
      'Sekou', 'Makena', 'Adama', 'Zalika', 'Themba', 'Nala', 'Mandla', 'Ife',

      // Unique/Modern names
      'Phoenix', 'River', 'Sky', 'Ocean', 'Sage', 'Rowan', 'Quinn', 'Blair',
      'Casey', 'Jordan', 'Taylor', 'Morgan', 'Riley', 'Avery', 'Cameron', 'Dylan'
    ];

    // Massively expanded list of realistic last names (diverse origins)
    this.lastNames = [
      // Common English/American surnames
      'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
      'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
      'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
      'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker',
      'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
      'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell',
      'Carter', 'Roberts', 'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker',
      'Cruz', 'Edwards', 'Collins', 'Reyes', 'Stewart', 'Morris', 'Morales', 'Murphy',
      'Cook', 'Rogers', 'Morgan', 'Peterson', 'Cooper', 'Reed', 'Bailey', 'Bell',
      'Howard', 'Ward', 'Cox', 'Richardson', 'Wood', 'Watson', 'Brooks', 'Bennett',
      'Gray', 'James', 'Reyes', 'Powell', 'Perry', 'Russell', 'Sullivan', 'Jenkins',

      // East Asian surnames
      'Chen', 'Wang', 'Li', 'Zhang', 'Liu', 'Yang', 'Huang', 'Zhao', 'Wu', 'Zhou',
      'Xu', 'Sun', 'Ma', 'Zhu', 'Hu', 'Guo', 'He', 'Gao', 'Lin', 'Luo',
      'Kim', 'Park', 'Choi', 'Jung', 'Kang', 'Cho', 'Yoon', 'Jang', 'Lim', 'Han',
      'Yamamoto', 'Tanaka', 'Suzuki', 'Watanabe', 'Ito', 'Nakamura', 'Kobayashi', 'Kato',
      'Yoshida', 'Yamada', 'Sasaki', 'Yamaguchi', 'Matsumoto', 'Inoue', 'Kimura', 'Hayashi',

      // South Asian surnames
      'Kumar', 'Singh', 'Patel', 'Sharma', 'Gupta', 'Khan', 'Reddy', 'Rao',
      'Agarwal', 'Jain', 'Desai', 'Mehta', 'Shah', 'Verma', 'Malhotra', 'Chopra',
      'Kapoor', 'Bose', 'Das', 'Mukherjee', 'Banerjee', 'Chatterjee', 'Nair', 'Menon',

      // European surnames (Romance languages)
      'Silva', 'Santos', 'Costa', 'Oliveira', 'Pereira', 'Ferreira', 'Rodrigues', 'Alves',
      'Rossi', 'Russo', 'Ferrari', 'Esposito', 'Bianchi', 'Romano', 'Colombo', 'Ricci',
      'Moreau', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand',
      'Leroy', 'Moreau', 'Simon', 'Laurent', 'Lefebvre', 'Michel', 'Garcia', 'Martinez',

      // European surnames (Germanic)
      'Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker',
      'Schulz', 'Hoffmann', 'Koch', 'Richter', 'Klein', 'Wolf', 'Schröder', 'Neumann',
      'Schwarz', 'Zimmermann', 'Braun', 'Hofmann', 'Hartmann', 'Lange', 'Schmitt', 'Werner',

      // European surnames (Slavic)
      'Ivanov', 'Petrov', 'Sidorov', 'Popov', 'Volkov', 'Sokolov', 'Lebedev', 'Kozlov',
      'Novak', 'Kowalski', 'Nowak', 'Wojcik', 'Kowalczyk', 'Kaminski', 'Lewandowski',
      'Zielinski', 'Szymanski', 'Wozniak', 'Dabrowski', 'Jankowski', 'Mazur', 'Kwiatkowski',

      // European surnames (Nordic)
      'Nielsen', 'Hansen', 'Andersen', 'Pedersen', 'Christensen', 'Larsen', 'Sørensen',
      'Rasmussen', 'Jørgensen', 'Petersen', 'Madsen', 'Kristensen', 'Olsen', 'Thomsen',
      'Johansson', 'Karlsson', 'Nilsson', 'Eriksson', 'Larsson', 'Olsson', 'Persson',

      // European surnames (Celtic/British Isles)
      "O'Brien", 'Murphy', 'Kelly', "O'Sullivan", 'Walsh', "O'Connor", 'McCarthy', 'Gallagher',
      'Doherty', 'Kennedy', 'Lynch', 'Murray', "O'Neill", 'Quinn', 'Moore', 'McLaughlin',
      'Davies', 'Evans', 'Thomas', 'Roberts', 'Lewis', 'Hughes', 'Morgan', 'Griffiths',

      // Middle Eastern/North African surnames
      'Hassan', 'Ali', 'Ahmed', 'Hussein', 'Ibrahim', 'Mahmoud', 'Abdullah', 'Mohammed',
      'Omar', 'Khalil', 'Rashid', 'Farid', 'Nasser', 'Salem', 'Hamid', 'Amin',

      // Hungarian surnames
      'Kovács', 'Nagy', 'Tóth', 'Szabó', 'Horváth', 'Varga', 'Kiss', 'Molnár',
      'Németh', 'Farkas', 'Balogh', 'Papp', 'Takács', 'Juhász', 'Lakatos', 'Mészáros',

      // African surnames
      'Diallo', 'Diop', 'Ndiaye', 'Fall', 'Sow', 'Sy', 'Ba', 'Thiam',
      'Mensah', 'Owusu', 'Asante', 'Boateng', 'Osei', 'Agyemang', 'Ofori', 'Opoku',
      'Okafor', 'Okonkwo', 'Nwosu', 'Eze', 'Okeke', 'Chukwu', 'Obi', 'Mbah'
    ];

    // Realistic email domains
    this.domains = [
      'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com',
      'protonmail.com', 'mail.com', 'aol.com', 'zoho.com', 'yandex.com'
    ];

    // Track generated emails to prevent duplicates
    this.usedEmails = new Set();
    this.usedNames = new Set();

    this.destinations = [
      // Europe - Western
      { name: 'Paris', country: 'France', state: 'Île-de-France', map_location: '48.8566,2.3522' },
      { name: 'London', country: 'United Kingdom', map_location: '51.5074,-0.1278' },
      { name: 'Rome', country: 'Italy', map_location: '41.9028,12.4964' },
      { name: 'Barcelona', country: 'Spain', map_location: '41.3851,2.1734' },
      { name: 'Amsterdam', country: 'Netherlands', map_location: '52.3676,4.9041' },
      { name: 'Berlin', country: 'Germany', map_location: '52.5200,13.4050' },
      { name: 'Vienna', country: 'Austria', map_location: '48.2082,16.3738' },
      { name: 'Zurich', country: 'Switzerland', map_location: '47.3769,8.5417' },
      { name: 'Brussels', country: 'Belgium', map_location: '50.8503,4.3517' },
      { name: 'Munich', country: 'Germany', map_location: '48.1351,11.5820' },
      { name: 'Milan', country: 'Italy', map_location: '45.4642,9.1900' },
      { name: 'Florence', country: 'Italy', map_location: '43.7696,11.2558' },
      { name: 'Venice', country: 'Italy', map_location: '45.4408,12.3155' },
      { name: 'Madrid', country: 'Spain', map_location: '40.4168,-3.7038' },
      { name: 'Lisbon', country: 'Portugal', map_location: '38.7223,-9.1393' },
      { name: 'Porto', country: 'Portugal', map_location: '41.1579,-8.6291' },
      { name: 'Edinburgh', country: 'United Kingdom', map_location: '55.9533,-3.1883' },
      { name: 'Dublin', country: 'Ireland', map_location: '53.3498,-6.2603' },
      { name: 'Lyon', country: 'France', map_location: '45.7640,4.8357' },
      { name: 'Bordeaux', country: 'France', map_location: '44.8378,-0.5792' },
      { name: 'Nice', country: 'France', map_location: '43.7102,7.2620' },
      { name: 'Geneva', country: 'Switzerland', map_location: '46.2044,6.1432' },
      { name: 'Copenhagen', country: 'Denmark', map_location: '55.6761,12.5683' },
      { name: 'Stockholm', country: 'Sweden', map_location: '59.3293,18.0686' },
      { name: 'Oslo', country: 'Norway', map_location: '59.9139,10.7522' },
      { name: 'Helsinki', country: 'Finland', map_location: '60.1699,24.9384' },

      // Europe - Eastern & Central
      { name: 'Prague', country: 'Czech Republic', map_location: '50.0755,14.4378' },
      { name: 'Budapest', country: 'Hungary', map_location: '47.4979,19.0402' },
      { name: 'Krakow', country: 'Poland', map_location: '50.0647,19.9450' },
      { name: 'Warsaw', country: 'Poland', map_location: '52.2297,21.0122' },
      { name: 'Dubrovnik', country: 'Croatia', map_location: '42.6507,18.0944' },
      { name: 'Split', country: 'Croatia', map_location: '43.5081,16.4402' },
      { name: 'Athens', country: 'Greece', map_location: '37.9838,23.7275' },
      { name: 'Santorini', country: 'Greece', map_location: '36.3932,25.4615' },
      { name: 'Istanbul', country: 'Turkey', map_location: '41.0082,28.9784' },
      { name: 'Antalya', country: 'Turkey', map_location: '36.8969,30.7133' },
      { name: 'Bucharest', country: 'Romania', map_location: '44.4268,26.1025' },
      { name: 'Sofia', country: 'Bulgaria', map_location: '42.6977,23.3219' },
      { name: 'Tallinn', country: 'Estonia', map_location: '59.4370,24.7536' },
      { name: 'Riga', country: 'Latvia', map_location: '56.9496,24.1052' },
      { name: 'Vilnius', country: 'Lithuania', map_location: '54.6872,25.2797' },

      // Asia - East
      { name: 'Tokyo', country: 'Japan', map_location: '35.6762,139.6503' },
      { name: 'Kyoto', country: 'Japan', map_location: '35.0116,135.7681' },
      { name: 'Osaka', country: 'Japan', map_location: '34.6937,135.5023' },
      { name: 'Seoul', country: 'South Korea', map_location: '37.5665,126.9780' },
      { name: 'Busan', country: 'South Korea', map_location: '35.1796,129.0756' },
      { name: 'Beijing', country: 'China', map_location: '39.9042,116.4074' },
      { name: 'Shanghai', country: 'China', map_location: '31.2304,121.4737' },
      { name: 'Hong Kong', country: 'China', map_location: '22.3193,114.1694' },
      { name: 'Taipei', country: 'Taiwan', map_location: '25.0330,121.5654' },
      { name: 'Hanoi', country: 'Vietnam', map_location: '21.0285,105.8542' },
      { name: 'Ho Chi Minh City', country: 'Vietnam', map_location: '10.8231,106.6297' },

      // Asia - Southeast
      { name: 'Bangkok', country: 'Thailand', map_location: '13.7563,100.5018' },
      { name: 'Phuket', country: 'Thailand', map_location: '7.8804,98.3923' },
      { name: 'Chiang Mai', country: 'Thailand', map_location: '18.7883,98.9853' },
      { name: 'Singapore', country: 'Singapore', map_location: '1.3521,103.8198' },
      { name: 'Bali', country: 'Indonesia', map_location: '-8.3405,115.0920' },
      { name: 'Jakarta', country: 'Indonesia', map_location: '-6.2088,106.8456' },
      { name: 'Kuala Lumpur', country: 'Malaysia', map_location: '3.1390,101.6869' },
      { name: 'Penang', country: 'Malaysia', map_location: '5.4141,100.3288' },
      { name: 'Manila', country: 'Philippines', map_location: '14.5995,120.9842' },
      { name: 'Cebu', country: 'Philippines', map_location: '10.3157,123.8854' },
      { name: 'Siem Reap', country: 'Cambodia', map_location: '13.3671,103.8448' },
      { name: 'Yangon', country: 'Myanmar', map_location: '16.8661,96.1951' },
      { name: 'Vientiane', country: 'Laos', map_location: '17.9757,102.6331' },

      // Asia - South
      { name: 'Mumbai', country: 'India', map_location: '19.0760,72.8777' },
      { name: 'Delhi', country: 'India', map_location: '28.7041,77.1025' },
      { name: 'Bangalore', country: 'India', map_location: '12.9716,77.5946' },
      { name: 'Jaipur', country: 'India', map_location: '26.9124,75.7873' },
      { name: 'Goa', country: 'India', map_location: '15.2993,74.1240' },
      { name: 'Kathmandu', country: 'Nepal', map_location: '27.7172,85.3240' },
      { name: 'Colombo', country: 'Sri Lanka', map_location: '6.9271,79.8612' },
      { name: 'Dhaka', country: 'Bangladesh', map_location: '23.8103,90.4125' },

      // Middle East
      { name: 'Dubai', country: 'United Arab Emirates', map_location: '25.2048,55.2708' },
      { name: 'Abu Dhabi', country: 'United Arab Emirates', map_location: '24.4539,54.3773' },
      { name: 'Doha', country: 'Qatar', map_location: '25.2854,51.5310' },
      { name: 'Muscat', country: 'Oman', map_location: '23.5880,58.3829' },
      { name: 'Tel Aviv', country: 'Israel', map_location: '32.0853,34.7818' },
      { name: 'Jerusalem', country: 'Israel', map_location: '31.7683,35.2137' },
      { name: 'Amman', country: 'Jordan', map_location: '31.9454,35.9284' },
      { name: 'Beirut', country: 'Lebanon', map_location: '33.8886,35.4955' },
      { name: 'Cairo', country: 'Egypt', map_location: '30.0444,31.2357' },
      { name: 'Marrakech', country: 'Morocco', map_location: '31.6295,-7.9811' },
      { name: 'Casablanca', country: 'Morocco', map_location: '33.5731,-7.5898' },

      // North America
      { name: 'New York City', country: 'United States', state: 'New York', map_location: '40.7128,-74.0060' },
      { name: 'Los Angeles', country: 'United States', state: 'California', map_location: '34.0522,-118.2437' },
      { name: 'San Francisco', country: 'United States', state: 'California', map_location: '37.7749,-122.4194' },
      { name: 'Miami', country: 'United States', state: 'Florida', map_location: '25.7617,-80.1918' },
      { name: 'Las Vegas', country: 'United States', state: 'Nevada', map_location: '36.1699,-115.1398' },
      { name: 'Chicago', country: 'United States', state: 'Illinois', map_location: '41.8781,-87.6298' },
      { name: 'Seattle', country: 'United States', state: 'Washington', map_location: '47.6062,-122.3321' },
      { name: 'Boston', country: 'United States', state: 'Massachusetts', map_location: '42.3601,-71.0589' },
      { name: 'Washington DC', country: 'United States', state: 'District of Columbia', map_location: '38.9072,-77.0369' },
      { name: 'New Orleans', country: 'United States', state: 'Louisiana', map_location: '29.9511,-90.0715' },
      { name: 'Austin', country: 'United States', state: 'Texas', map_location: '30.2672,-97.7431' },
      { name: 'Nashville', country: 'United States', state: 'Tennessee', map_location: '36.1627,-86.7816' },
      { name: 'Portland', country: 'United States', state: 'Oregon', map_location: '45.5152,-122.6784' },
      { name: 'Denver', country: 'United States', state: 'Colorado', map_location: '39.7392,-104.9903' },
      { name: 'San Diego', country: 'United States', state: 'California', map_location: '32.7157,-117.1611' },
      { name: 'Honolulu', country: 'United States', state: 'Hawaii', map_location: '21.3069,-157.8583' },
      { name: 'Anchorage', country: 'United States', state: 'Alaska', map_location: '61.2181,-149.9003' },

      // Canada
      { name: 'Vancouver', country: 'Canada', state: 'British Columbia', map_location: '49.2827,-123.1207' },
      { name: 'Toronto', country: 'Canada', state: 'Ontario', map_location: '43.6532,-79.3832' },
      { name: 'Montreal', country: 'Canada', state: 'Quebec', map_location: '45.5017,-73.5673' },
      { name: 'Banff', country: 'Canada', state: 'Alberta', map_location: '51.1784,-115.5708' },
      { name: 'Quebec City', country: 'Canada', state: 'Quebec', map_location: '46.8139,-71.2080' },
      { name: 'Calgary', country: 'Canada', state: 'Alberta', map_location: '51.0447,-114.0719' },
      { name: 'Ottawa', country: 'Canada', state: 'Ontario', map_location: '45.4215,-75.6972' },
      { name: 'Victoria', country: 'Canada', state: 'British Columbia', map_location: '48.4284,-123.3656' },
      { name: 'Whistler', country: 'Canada', state: 'British Columbia', map_location: '50.1163,-122.9574' },

      // Mexico & Central America
      { name: 'Cancun', country: 'Mexico', map_location: '21.1619,-86.8515' },
      { name: 'Mexico City', country: 'Mexico', map_location: '19.4326,-99.1332' },
      { name: 'Tulum', country: 'Mexico', map_location: '20.2114,-87.4654' },
      { name: 'Playa del Carmen', country: 'Mexico', map_location: '20.6296,-87.0739' },
      { name: 'Puerto Vallarta', country: 'Mexico', map_location: '20.6534,-105.2253' },
      { name: 'Cabo San Lucas', country: 'Mexico', map_location: '22.8905,-109.9167' },
      { name: 'San José', country: 'Costa Rica', map_location: '9.9281,-84.0907' },
      { name: 'Panama City', country: 'Panama', map_location: '8.9824,-79.5199' },
      { name: 'Guatemala City', country: 'Guatemala', map_location: '14.6349,-90.5069' },
      { name: 'San Salvador', country: 'El Salvador', map_location: '13.6929,-89.2182' },

      // South America
      { name: 'Buenos Aires', country: 'Argentina', map_location: '-34.6118,-58.3966' },
      { name: 'Rio de Janeiro', country: 'Brazil', map_location: '-22.9068,-43.1729' },
      { name: 'São Paulo', country: 'Brazil', map_location: '-23.5505,-46.6333' },
      { name: 'Lima', country: 'Peru', map_location: '-12.0464,-77.0428' },
      { name: 'Cusco', country: 'Peru', map_location: '-13.5319,-71.9675' },
      { name: 'Machu Picchu', country: 'Peru', map_location: '-13.1631,-72.5450' },
      { name: 'Santiago', country: 'Chile', map_location: '-33.4489,-70.6693' },
      { name: 'Valparaíso', country: 'Chile', map_location: '-33.0472,-71.6127' },
      { name: 'Patagonia', country: 'Chile', map_location: '-53.1638,-70.9171' },
      { name: 'Cartagena', country: 'Colombia', map_location: '10.3910,-75.4794' },
      { name: 'Bogotá', country: 'Colombia', map_location: '4.7110,-74.0721' },
      { name: 'Medellín', country: 'Colombia', map_location: '6.2486,-75.5742' },
      { name: 'Quito', country: 'Ecuador', map_location: '-0.1807,-78.4678' },
      { name: 'Galápagos Islands', country: 'Ecuador', map_location: '-0.9538,-90.9656' },
      { name: 'La Paz', country: 'Bolivia', map_location: '-16.5000,-68.1500' },
      { name: 'Montevideo', country: 'Uruguay', map_location: '-34.9011,-56.1645' },

      // Oceania
      { name: 'Sydney', country: 'Australia', state: 'New South Wales', map_location: '-33.8688,151.2093' },
      { name: 'Melbourne', country: 'Australia', state: 'Victoria', map_location: '-37.8136,144.9631' },
      { name: 'Brisbane', country: 'Australia', state: 'Queensland', map_location: '-27.4698,153.0251' },
      { name: 'Perth', country: 'Australia', state: 'Western Australia', map_location: '-31.9505,115.8605' },
      { name: 'Adelaide', country: 'Australia', state: 'South Australia', map_location: '-34.9285,138.6007' },
      { name: 'Gold Coast', country: 'Australia', state: 'Queensland', map_location: '-28.0167,153.4000' },
      { name: 'Cairns', country: 'Australia', state: 'Queensland', map_location: '-16.9186,145.7781' },
      { name: 'Auckland', country: 'New Zealand', map_location: '-36.8485,174.7633' },
      { name: 'Wellington', country: 'New Zealand', map_location: '-41.2865,174.7762' },
      { name: 'Queenstown', country: 'New Zealand', map_location: '-45.0312,168.6626' },
      { name: 'Christchurch', country: 'New Zealand', map_location: '-43.5321,172.6362' },
      { name: 'Rotorua', country: 'New Zealand', map_location: '-38.1368,176.2497' },
      { name: 'Fiji Islands', country: 'Fiji', map_location: '-17.7134,178.0650' },
      { name: 'Bora Bora', country: 'French Polynesia', map_location: '-16.5004,-151.7414' },

      // Africa
      { name: 'Cape Town', country: 'South Africa', map_location: '-33.9249,18.4241' },
      { name: 'Johannesburg', country: 'South Africa', map_location: '-26.2041,28.0473' },
      { name: 'Nairobi', country: 'Kenya', map_location: '-1.2864,36.8172' },
      { name: 'Lagos', country: 'Nigeria', map_location: '6.5244,3.3792' },
      { name: 'Accra', country: 'Ghana', map_location: '5.6037,-0.1870' },
      { name: 'Zanzibar', country: 'Tanzania', map_location: '-6.1659,39.2026' },
      { name: 'Addis Ababa', country: 'Ethiopia', map_location: '9.0320,38.7469' },
      { name: 'Dakar', country: 'Senegal', map_location: '14.7167,-17.4677' },
      { name: 'Tunis', country: 'Tunisia', map_location: '36.8065,10.1815' },

      // Nordics & Scandinavia
      { name: 'Reykjavik', country: 'Iceland', map_location: '64.1466,-21.9426' },
      { name: 'Tromsø', country: 'Norway', map_location: '69.6492,18.9553' },
      { name: 'Bergen', country: 'Norway', map_location: '60.3913,5.3221' },
      { name: 'Gothenburg', country: 'Sweden', map_location: '57.7089,11.9746' },
      { name: 'Malmö', country: 'Sweden', map_location: '55.6050,13.0038' },
      { name: 'Aarhus', country: 'Denmark', map_location: '56.1629,10.2039' },
      { name: 'Turku', country: 'Finland', map_location: '60.4518,22.2666' },

      // Island Nations & Special Regions
      { name: 'Maldives', country: 'Maldives', map_location: '3.2028,73.2207' },
      { name: 'Seychelles', country: 'Seychelles', map_location: '-4.6796,55.4920' },
      { name: 'Mauritius', country: 'Mauritius', map_location: '-20.1609,57.5012' },
      { name: 'Bermuda', country: 'Bermuda', map_location: '32.3078,-64.7505' },
      { name: 'Bahamas', country: 'Bahamas', map_location: '25.0343,-77.3963' },
      { name: 'Barbados', country: 'Barbados', map_location: '13.1939,-59.5432' },
      { name: 'Jamaica', country: 'Jamaica', map_location: '18.1096,-77.2975' },
      { name: 'Aruba', country: 'Aruba', map_location: '12.5211,-69.9683' },

      // Mountain/Ski Destinations
      { name: 'Innsbruck', country: 'Austria', map_location: '47.2692,11.4041' },
      { name: 'Zermatt', country: 'Switzerland', map_location: '46.0207,7.7491' },
      { name: 'Chamonix', country: 'France', map_location: '45.9237,6.8694' },
      { name: 'Aspen', country: 'United States', state: 'Colorado', map_location: '39.1911,-106.8175' },
      { name: 'Lake Tahoe', country: 'United States', state: 'California', map_location: '39.0968,-120.0324' }
    ];

    this.experienceTypes = [
      // Travel Styles
      'Romantic', 'Cultural', 'Adventure', 'Food & Wine', 'Beach', 'Urban', 'Nature',
      'Historical', 'Shopping', 'Nightlife', 'Family', 'Luxury', 'Budget', 'Solo Travel',
      'Group Travel', 'Photography', 'Wellness', 'Business', 'Education', 'Volunteering',
      
      // Activity Types
      'Hiking', 'Skiing', 'Surfing', 'Diving', 'Cycling', 'Kayaking', 'Rock Climbing',
      'Safari', 'Whale Watching', 'Birdwatching', 'Snorkeling', 'Sailing', 'Fishing',
      
      // Experience Focus
      'Art & Museums', 'Music & Festivals', 'Spiritual', 'Culinary Tour', 'Wine Tasting',
      'Coffee Culture', 'Street Food', 'Fine Dining', 'Cooking Classes', 'Local Markets',
      
      // Special Interest
      'Architecture', 'Design', 'Film & Cinema', 'Literature', 'Theater', 'Dance',
      'Nightlife', 'Pub Crawl', 'Rooftop Bars', 'Beach Clubs', 'Live Music',
      
      // Seasonal
      'Winter Sports', 'Summer Activities', 'Fall Foliage', 'Spring Blossoms',
      'Cherry Blossom', 'Northern Lights', 'Midnight Sun', 'Monsoon Season',
      
      // Wellness & Relaxation
      'Spa & Massage', 'Yoga Retreat', 'Meditation', 'Hot Springs', 'Thermal Baths',
      'Detox', 'Fitness', 'Beach Relaxation', 'Mountain Retreat',
      
      // Adventure Levels
      'Extreme Sports', 'Adrenaline', 'Moderate Activity', 'Leisurely Pace', 'Off-the-Grid',
      'Backpacking', 'Glamping', 'Camping', 'RV Travel', 'Road Trip',
      
      // Cultural Immersion
      'Language Learning', 'Homestay', 'Farm Stay', 'Village Visit', 'Temple Tour',
      'Religious Sites', 'Indigenous Culture', 'Traditional Crafts', 'Local Festivals'
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
      // Accommodation
      { text: 'Book hotel accommodation', cost_range: [80, 500], days_range: [1, 7] },
      { text: 'Reserve hostel bed', cost_range: [20, 80], days_range: [1, 5] },
      { text: 'Book luxury resort', cost_range: [300, 1500], days_range: [1, 10] },
      { text: 'Rent vacation apartment', cost_range: [100, 400], days_range: [3, 14] },
      { text: 'Book boutique hotel', cost_range: [150, 600], days_range: [1, 5] },
      { text: 'Reserve glamping site', cost_range: [120, 350], days_range: [1, 4] },
      
      // Transportation
      { text: 'Purchase flight tickets', cost_range: [200, 1200], days_range: [1, 3] },
      { text: 'Book train tickets', cost_range: [30, 200], days_range: [1, 2] },
      { text: 'Rent car for duration', cost_range: [150, 800], days_range: [1, 7] },
      { text: 'Purchase ferry tickets', cost_range: [25, 150], days_range: [1, 1] },
      { text: 'Book airport transfer', cost_range: [30, 100], days_range: [1, 1] },
      { text: 'Purchase metro/subway pass', cost_range: [15, 80], days_range: [1, 1] },
      { text: 'Book intercity bus', cost_range: [20, 100], days_range: [1, 2] },
      { text: 'Arrange private driver', cost_range: [50, 300], days_range: [1, 3] },
      { text: 'Rent bicycle for city tour', cost_range: [10, 50], days_range: [1, 1] },
      { text: 'Book helicopter tour', cost_range: [200, 800], days_range: [1, 2] },
      
      // Dining & Food
      { text: 'Reserve fine dining restaurant', cost_range: [80, 300], days_range: [1, 2] },
      { text: 'Book food tour', cost_range: [40, 150], days_range: [1, 1] },
      { text: 'Reserve rooftop bar table', cost_range: [50, 200], days_range: [1, 1] },
      { text: 'Book cooking class', cost_range: [40, 150], days_range: [1, 2] },
      { text: 'Reserve wine tasting', cost_range: [30, 180], days_range: [1, 2] },
      { text: 'Book brewery tour', cost_range: [25, 80], days_range: [1, 1] },
      { text: 'Purchase street food tour', cost_range: [20, 70], days_range: [1, 1] },
      { text: 'Book coffee tasting experience', cost_range: [25, 90], days_range: [1, 1] },
      { text: 'Reserve chef table experience', cost_range: [150, 500], days_range: [1, 2] },
      
      // Activities & Tours
      { text: 'Book guided city tour', cost_range: [20, 120], days_range: [1, 2] },
      { text: 'Purchase museum tickets', cost_range: [15, 60], days_range: [1, 1] },
      { text: 'Book adventure activity', cost_range: [60, 350], days_range: [1, 5] },
      { text: 'Reserve spa treatment', cost_range: [50, 300], days_range: [1, 2] },
      { text: 'Book scuba diving excursion', cost_range: [80, 250], days_range: [1, 3] },
      { text: 'Purchase theme park tickets', cost_range: [40, 150], days_range: [1, 2] },
      { text: 'Book hot air balloon ride', cost_range: [150, 400], days_range: [1, 2] },
      { text: 'Reserve kayaking tour', cost_range: [40, 120], days_range: [1, 2] },
      { text: 'Book zip-lining adventure', cost_range: [50, 180], days_range: [1, 1] },
      { text: 'Purchase snorkeling equipment rental', cost_range: [20, 60], days_range: [1, 3] },
      { text: 'Book whale watching tour', cost_range: [70, 200], days_range: [1, 2] },
      { text: 'Reserve rock climbing session', cost_range: [40, 150], days_range: [1, 2] },
      { text: 'Book paragliding experience', cost_range: [100, 300], days_range: [1, 2] },
      { text: 'Purchase safari tour', cost_range: [200, 800], days_range: [2, 7] },
      
      // Cultural & Educational
      { text: 'Book historical walking tour', cost_range: [25, 100], days_range: [1, 1] },
      { text: 'Reserve traditional show tickets', cost_range: [30, 150], days_range: [1, 2] },
      { text: 'Book language lesson', cost_range: [20, 80], days_range: [1, 5] },
      { text: 'Purchase concert tickets', cost_range: [40, 250], days_range: [1, 3] },
      { text: 'Book photography workshop', cost_range: [60, 250], days_range: [1, 3] },
      { text: 'Reserve art gallery tour', cost_range: [20, 100], days_range: [1, 1] },
      { text: 'Book theater performance', cost_range: [40, 200], days_range: [1, 2] },
      { text: 'Purchase opera tickets', cost_range: [60, 300], days_range: [1, 2] },
      
      // Wellness & Relaxation
      { text: 'Book yoga class', cost_range: [15, 60], days_range: [1, 5] },
      { text: 'Reserve massage appointment', cost_range: [40, 180], days_range: [1, 2] },
      { text: 'Book meditation session', cost_range: [20, 100], days_range: [1, 3] },
      { text: 'Purchase hot springs entry', cost_range: [15, 80], days_range: [1, 2] },
      { text: 'Book wellness retreat day', cost_range: [100, 500], days_range: [1, 3] },
      
      // Shopping & Souvenirs
      { text: 'Visit local market', cost_range: [5, 50], days_range: [1, 1] },
      { text: 'Book shopping tour', cost_range: [30, 120], days_range: [1, 2] },
      { text: 'Purchase craft workshop', cost_range: [25, 100], days_range: [1, 2] },
      
      // Miscellaneous
      { text: 'Purchase travel insurance', cost_range: [30, 150], days_range: [1, 1] },
      { text: 'Book visa assistance', cost_range: [50, 200], days_range: [7, 14] },
      { text: 'Reserve luggage storage', cost_range: [5, 30], days_range: [1, 1] },
      { text: 'Purchase SIM card/eSIM', cost_range: [10, 50], days_range: [1, 1] },
      { text: 'Book photography session', cost_range: [60, 250], days_range: [1, 2] }
    ];
  }

  /**
   * Generate unique email address
   */
  generateUniqueEmail(firstName, lastName) {
    const domain = getRandomElement(this.domains);
    const baseEmail = `${firstName.toLowerCase()}.${lastName.toLowerCase()}`;

    // Try base email first
    let email = `${baseEmail}@${domain}`;
    if (!this.usedEmails.has(email)) {
      this.usedEmails.add(email);
      return email;
    }

    // Try with random numbers
    for (let attempt = 0; attempt < 100; attempt++) {
      const randomNum = randomBetween(1, 9999);
      email = `${baseEmail}${randomNum}@${domain}`;
      if (!this.usedEmails.has(email)) {
        this.usedEmails.add(email);
        return email;
      }
    }

    // Fallback: add timestamp + random string
    const timestamp = Date.now().toString().slice(-6);
    email = `${baseEmail}.${timestamp}${generateRandomString(4)}@${domain}`;
    this.usedEmails.add(email);
    return email;
  }

  /**
   * Generate unique name
   */
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

    // Fallback: add middle initial
    const firstName = getRandomElement(this.firstNames);
    const lastName = getRandomElement(this.lastNames);
    const middleInitial = String.fromCharCode(65 + Math.floor(Math.random() * 26)); // A-Z
    const name = `${firstName} ${middleInitial}. ${lastName}`;
    this.usedNames.add(name);
    return { firstName, lastName, name };
  }

  /**
   * Generate invite codes (short alphanumeric format: XXX-XXX-XXX)
   */
  generateInviteCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const segments = 3;
    const segmentLength = 3;
    const code = [];

    for (let i = 0; i < segments; i++) {
      let segment = '';
      for (let j = 0; j < segmentLength; j++) {
        segment += chars[Math.floor(Math.random() * chars.length)];
      }
      code.push(segment);
    }

    return code.join('-');
  }

  /**
   * Generate session ID (UUID-like format)
   */
  generateSessionId() {
    return `sess_${generateRandomString(32)}`;
  }

  /**
   * Generate users with varied profiles (no duplicates)
   * @param {number} count - Total number of users to generate
   * @param {Object} adminDetails - Custom super admin details (optional)
   * @param {string} adminDetails.name - Super admin full name
   * @param {string} adminDetails.email - Super admin email address
   */
  generateUsers(count = 180, adminDetails = null) {
    const users = [];

    // Create super admin first
    const superAdminName = adminDetails?.name || `SuperAdmin_${generateRandomString(6)}`;
    const superAdminEmail = adminDetails?.email || `superadmin_${generateRandomString(8).toLowerCase()}@biensperience.demo`;
    const superAdminPassword = generateRandomString(12);

    const sessionId = this.generateSessionId();
    const now = Date.now();
    const expiresAt = now + (24 * 60 * 60 * 1000); // 24 hours

    const superAdmin = {
      name: superAdminName,
      email: superAdminEmail,
      password: superAdminPassword,
      role: 'super_admin',
      isSuperAdmin: true,
      emailConfirmed: true, // Super admin always verified
      apiEnabled: true, // Enable API access for super admin
      visibility: 'public',
      currentSessionId: sessionId,
      sessionCreatedAt: now,
      sessionExpiresAt: expiresAt,
      credentials: { name: superAdminName, email: superAdminEmail, password: superAdminPassword }
    };
    users.push(superAdmin);
    this.usedEmails.add(superAdminEmail);
    this.usedNames.add(superAdminName);

    // Generate regular users with unique names and emails
    for (let i = 0; i < count - 1; i++) {
      const { firstName, lastName, name } = this.generateUniqueName();
      const email = this.generateUniqueEmail(firstName, lastName);

      // Varied user configurations:
      // - 80% have confirmed emails
      // - 20% have unconfirmed emails (demonstrate email verification flow)
      // - 30% have invite codes (demonstrate invite system)
      // - 10% have API enabled (demonstrate API token system)
      // - 70% public visibility, 30% private
      // - 60% have active sessions (demonstrate session tracking)

      const emailConfirmed = Math.random() < 0.8;
      const hasInviteCode = Math.random() < 0.3;
      const apiEnabled = Math.random() < 0.1;
      const visibility = Math.random() < 0.7 ? 'public' : 'private';
      const hasActiveSession = Math.random() < 0.6;

      const user = {
        name,
        email,
        password: 'demo123',
        role: 'regular_user',
        emailConfirmed,
        apiEnabled,
        visibility
      };

      // Add invite code if applicable
      if (hasInviteCode) {
        user.inviteCode = this.generateInviteCode();
      }

      // Add session data if user has active session
      if (hasActiveSession) {
        const sessionId = this.generateSessionId();
        const sessionStart = now - randomBetween(0, 20 * 60 * 60 * 1000); // Started 0-20 hours ago
        const sessionExpiry = sessionStart + (24 * 60 * 60 * 1000); // 24-hour session

        user.currentSessionId = sessionId;
        user.sessionCreatedAt = sessionStart;
        user.sessionExpiresAt = sessionExpiry;
      }

      users.push(user);
    }

    return users;
  }

  /**
   * Generate destinations
   */
  generateDestinations(count = 90) {
    // If count is larger than available destinations, cycle through them
    const destinations = [];
    const shuffled = shuffleArray(this.destinations);

    for (let i = 0; i < count; i++) {
      const dest = shuffled[i % shuffled.length];
      // Add variation to name if we're cycling through
      const suffix = i >= shuffled.length ? ` (${Math.floor(i / shuffled.length) + 1})` : '';

      destinations.push({
        name: dest.name + suffix,
        country: dest.country,
        state: dest.state,
        map_location: dest.map_location,
        travel_tips: this.generateTravelTips(dest.name),
        permissions: [], // Will be set after users are created
        photos: [] // Will be set after photos are created
      });
    }

    return destinations;
  }

  /**
   * Generate travel tips for a destination (mix of simple and structured)
   */
  generateTravelTips(destinationName) {
    // Simple string tips (backwards compatible)
    const simpleTips = [
      `🏛️ Visit the main attractions in ${destinationName} early to avoid crowds`,
      '🍜 Try authentic local cuisine at family-run restaurants',
      '🗣️ Learn basic local phrases to enhance your experience',
      '🌙 Experience the nightlife in the city center',
      '📸 Best photo spots are near the waterfront at sunset',
      '👟 Wear comfortable shoes for exploring cobblestone streets'
    ];

    // Structured tips with rich metadata
    const structuredTips = [
      {
        type: 'Currency',
        value: 'Euro (EUR) is the official currency',
        note: 'Credit cards widely accepted in tourist areas',
        exchangeRate: '1 USD ≈ 0.85 EUR (check current rates)',
        icon: '💶',
        callToAction: {
          label: 'Check Current Rate',
          url: 'https://www.xe.com/currency-converter'
        }
      },
      {
        type: 'Language',
        value: 'English widely spoken in tourist areas',
        note: 'Learn these phrases: "Hello" (Bonjour), "Thank you" (Merci), "Excuse me" (Excusez-moi)',
        icon: '🗣️'
      },
      {
        type: 'Transportation',
        value: 'Metro system is the fastest way to get around',
        note: 'Purchase a multi-day pass for unlimited rides. Trains run from 5:30 AM to 1:00 AM',
        icon: '🚇',
        callToAction: {
          label: 'View Metro Map',
          url: 'https://www.google.com/maps'
        }
      },
      {
        type: 'Safety',
        value: 'Generally safe for tourists, but stay vigilant',
        note: 'Keep valuables secure in crowded tourist areas. Avoid isolated areas at night',
        icon: '🛡️'
      },
      {
        type: 'Weather',
        value: 'Best time to visit is April-June and September-October',
        note: 'Summer (July-August) can be very hot and crowded. Winter is mild but rainy',
        icon: '🌤️'
      },
      {
        type: 'Customs',
        value: 'Greet shopkeepers when entering stores',
        note: 'Tipping is appreciated but not mandatory (5-10% in restaurants). Dress modestly when visiting religious sites',
        icon: '🤝'
      },
      {
        type: 'Food',
        value: 'Don\'t miss the local specialty dishes',
        note: 'Try the street food markets for authentic flavors. Lunch is served 12-2 PM, dinner after 8 PM',
        icon: '🍽️',
        callToAction: {
          label: 'Top Restaurants',
          url: 'https://www.tripadvisor.com'
        }
      },
      {
        type: 'Accommodation',
        value: 'Book hotels in the city center for easy access',
        note: 'Consider boutique hotels or vacation rentals for local experience. Book 2-3 months in advance for peak season',
        icon: '🏨',
        callToAction: {
          label: 'Search Hotels',
          url: 'https://www.booking.com'
        }
      },
      {
        type: 'Emergency',
        value: 'Emergency number: 112 (EU standard)',
        note: 'Tourist police available 24/7. Keep hotel contact card for taxi drivers',
        icon: '🚨'
      },
      {
        type: 'Custom',
        category: 'Shopping',
        value: 'Markets are best on Saturday mornings',
        note: 'Bargaining is not common in shops. VAT refund available for purchases over €175',
        icon: '🛍️'
      },
      {
        type: 'Custom',
        category: 'WiFi & Connectivity',
        value: 'Free WiFi available in most cafes and hotels',
        note: 'Consider getting a local SIM card for data. Roaming charges apply outside EU',
        icon: '📱',
        callToAction: {
          label: 'Buy eSIM',
          url: 'https://www.airalo.com'
        }
      }
    ];

    // Mix simple and structured tips (roughly 40% simple, 60% structured)
    const mixedTips = [];
    const totalTips = randomBetween(4, 8);
    const simpleCount = Math.floor(totalTips * 0.4);
    const structuredCount = totalTips - simpleCount;

    // Add random simple tips
    const selectedSimple = getRandomElements(simpleTips, simpleCount);
    mixedTips.push(...selectedSimple);

    // Add random structured tips
    const selectedStructured = getRandomElements(structuredTips, structuredCount);
    mixedTips.push(...selectedStructured);

    // Shuffle the mixed array for variety
    return shuffleArray(mixedTips);
  }

  /**
   * Generate photos
   */
  generatePhotos(count = 600) {
    const photos = [];

    for (let i = 0; i < count; i++) {
      photos.push({
        url: getRandomElement(this.unsplashUrls),
        photo_credit: 'Unsplash',
        photo_credit_url: 'https://unsplash.com',
        permissions: [] // Will be set after users are created
      });
    }

    return photos;
  }

  /**
   * Generate experiences
   */
  generateExperiences(count = 270, users = [], destinations = [], photos = []) {
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

      // Build permissions array (ensure ObjectId types and include metadata)
      const permissions = [
        { _id: mongoose.Types.ObjectId(owner._id), entity: 'user', type: 'owner', granted_at: new Date(), granted_by: mongoose.Types.ObjectId(owner._id) }
      ];

      collaborators.forEach(collaborator => {
        permissions.push({ _id: mongoose.Types.ObjectId(collaborator._id), entity: 'user', type: 'collaborator', granted_at: new Date(), granted_by: mongoose.Types.ObjectId(owner._id) });
      });

      contributors.forEach(contributor => {
        permissions.push({ _id: mongoose.Types.ObjectId(contributor._id), entity: 'user', type: 'contributor', granted_at: new Date(), granted_by: mongoose.Types.ObjectId(owner._id) });
      });

      experiences.push({
        name: this.generateExperienceName(destination.name, experienceTypes),
        destination: destination._id,
        experience_type: experienceTypes,
        permissions,
        photos: [getRandomElement(photos)._id],
        default_photo_id: getRandomElement(photos)._id,
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
  generatePlans(count = 450, experiences = [], users = []) {
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
  permissions: [{ _id: mongoose.Types.ObjectId(user._id), entity: 'user', type: 'owner', granted_at: new Date(), granted_by: mongoose.Types.ObjectId(user._id) }]
      });
    }

    return plans;
  }

  /**
   * Generate invite codes
   */
  generateInviteCodes(count = 60, users = [], experiences = [], destinations = []) {
    const invites = [];
    const now = new Date();

    for (let i = 0; i < count; i++) {
      const creator = getRandomElement(users.filter(u => !u.isSuperAdmin));

      // Varied invite configurations:
      // - 40% have specific email restrictions
      // - 60% include experiences
      // - 40% include destinations
      // - 20% are multi-use (max 5 uses)
      // - 30% have expiration dates
      // - 20% have custom messages
      // - 50% have been redeemed at least once

      const hasEmailRestriction = Math.random() < 0.4;
      const includeExperiences = Math.random() < 0.6;
      const includeDestinations = Math.random() < 0.4;
      const isMultiUse = Math.random() < 0.2;
      const hasExpiration = Math.random() < 0.3;
      const hasCustomMessage = Math.random() < 0.2;
      const isRedeemed = Math.random() < 0.5;

      const invite = {
        code: this.generateInviteCode(),
        createdBy: creator._id,
        experiences: includeExperiences ? getRandomElements(experiences, randomBetween(1, 3)).map(e => e._id) : [],
        destinations: includeDestinations ? getRandomElements(destinations, randomBetween(1, 2)).map(d => d._id) : [],
        maxUses: isMultiUse ? randomBetween(2, 5) : 1,
        usedCount: 0,
        redeemedBy: [],
        isActive: true
      };

      if (hasEmailRestriction) {
        const { firstName, lastName } = this.generateUniqueName();
        const email = this.generateUniqueEmail(firstName, lastName);
        invite.email = email;
        invite.inviteeName = `${firstName} ${lastName}`;
      }

      if (hasExpiration) {
        const daysUntilExpiry = randomBetween(7, 90);
        invite.expiresAt = new Date(now.getTime() + (daysUntilExpiry * 24 * 60 * 60 * 1000));
      }

      if (hasCustomMessage) {
        const messages = [
          'Join me for an amazing travel experience!',
          'I thought you might enjoy these destinations.',
          'Let\'s plan our next adventure together!',
          'Check out these cool experiences I found.',
          'You have to see these travel ideas!'
        ];
        invite.customMessage = getRandomElement(messages);
      }

      // Mark invite as used if applicable
      if (isRedeemed && !hasExpiration) {
        const redeemer = getRandomElement(users.filter(u => !u.isSuperAdmin && u._id !== creator._id));
        invite.usedCount = 1;
        invite.redeemedBy = [redeemer._id];
        invite.inviteMetadata = {
          sentAt: new Date(now.getTime() - randomBetween(1, 30) * 24 * 60 * 60 * 1000),
          sentFrom: `192.168.${randomBetween(1, 255)}.${randomBetween(1, 255)}`,
          emailSent: true
        };
      }

      invites.push(invite);
    }

    return invites;
  }

  /**
   * Generate activity log entries
   */
  generateActivities(count = 300, users = [], experiences = [], destinations = [], plans = []) {
    const activities = [];
    const now = new Date();

    // Activity types with their resource types
    const activityTypes = [
      { action: 'resource_created', resourceTypes: ['Experience', 'Destination', 'Plan'], weight: 20 },
      { action: 'resource_updated', resourceTypes: ['Experience', 'Destination', 'User'], weight: 30 },
      { action: 'permission_added', resourceTypes: ['Experience', 'Destination'], weight: 15 },
      { action: 'plan_created', resourceTypes: ['Plan'], weight: 10 },
      { action: 'plan_item_completed', resourceTypes: ['Plan'], weight: 15 },
      { action: 'favorite_added', resourceTypes: ['Destination'], weight: 5 },
      { action: 'collaborator_added', resourceTypes: ['Experience'], weight: 5 }
    ];

    for (let i = 0; i < count; i++) {
      // Pick random activity type based on weights
      const totalWeight = activityTypes.reduce((sum, type) => sum + type.weight, 0);
      let random = Math.random() * totalWeight;
      let activityType;

      for (const type of activityTypes) {
        random -= type.weight;
        if (random <= 0) {
          activityType = type;
          break;
        }
      }

      const actor = getRandomElement(users);
      const resourceType = getRandomElement(activityType.resourceTypes);

      let resource, resourceName;
      if (resourceType === 'Experience') {
        resource = getRandomElement(experiences);
        resourceName = resource.experience_name;
      } else if (resourceType === 'Destination') {
        resource = getRandomElement(destinations);
        resourceName = resource.name;
      } else if (resourceType === 'Plan') {
        resource = getRandomElement(plans);
        const exp = experiences.find(e => e._id.equals(resource.experience));
        resourceName = exp ? `Plan for ${exp.experience_name}` : 'Unnamed Plan';
      } else {
        resource = actor;
        resourceName = actor.name;
      }

      // Generate session ID for metadata
      const sessionId = this.generateSessionId();

      const activity = {
        timestamp: new Date(now.getTime() - randomBetween(0, 30 * 24 * 60 * 60 * 1000)), // Last 30 days
        action: activityType.action,
        actor: {
          _id: actor._id,
          email: actor.email,
          name: actor.name,
          role: actor.role
        },
        resource: {
          id: resource._id,
          type: resourceType,
          name: resourceName
        },
        reason: this.generateActivityReason(activityType.action, actor.name, resourceName),
        metadata: {
          ipAddress: `192.168.${randomBetween(1, 255)}.${randomBetween(1, 255)}`,
          userAgent: getRandomElement([
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
            'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
          ]),
          requestPath: this.getRequestPath(activityType.action, resourceType),
          requestMethod: activityType.action.includes('created') ? 'POST' : 'PUT',
          sessionId
        },
        status: Math.random() < 0.95 ? 'success' : 'partial',
        tags: this.getActivityTags(activityType.action, resourceType)
      };

      // Add target for permission/collaborator actions
      if (activityType.action.includes('permission') || activityType.action.includes('collaborator')) {
        const target = getRandomElement(users.filter(u => u._id !== actor._id));
        activity.target = {
          id: target._id,
          type: 'User',
          name: target.name
        };
      }

      activities.push(activity);
    }

    return activities;
  }

  /**
   * Generate activity reason text
   */
  generateActivityReason(action, actorName, resourceName) {
    const reasons = {
      resource_created: `${actorName} created ${resourceName}`,
      resource_updated: `${actorName} updated ${resourceName}`,
      permission_added: `${actorName} granted permissions for ${resourceName}`,
      plan_created: `User created plan for experience`,
      plan_item_completed: `User completed plan item`,
      favorite_added: `${actorName} added ${resourceName} to favorites`,
      collaborator_added: `${actorName} added collaborator to ${resourceName}`
    };

    return reasons[action] || `${actorName} performed ${action} on ${resourceName}`;
  }

  /**
   * Get request path for activity
   */
  getRequestPath(action, resourceType) {
    const basePath = resourceType === 'Experience' ? '/api/experiences' :
                     resourceType === 'Destination' ? '/api/destinations' :
                     resourceType === 'Plan' ? '/api/plans' : '/api/users';

    if (action.includes('created')) return basePath;
    return `${basePath}/${new mongoose.Types.ObjectId()}`;
  }

  /**
   * Get activity tags
   */
  getActivityTags(action, resourceType) {
    const tags = [resourceType.toLowerCase()];

    if (action.includes('permission')) tags.push('permissions');
    if (action.includes('plan')) tags.push('planning');
    if (action.includes('collaborator')) tags.push('collaboration');
    if (action.includes('favorite')) tags.push('favorites');

    return tags;
  }
}

/**
 * Output manager for writing to both console and file
 */
class OutputManager {
  constructor(filePath) {
    this.filePath = filePath;
    this.output = [];
  }

  log(message) {
    backendLogger.info(message);
    this.output.push(message);
  }

  error(message) {
    backendLogger.error(message);
    this.output.push(`ERROR: ${message}`);
  }

  writeToFile() {
    const content = this.output.join('\n');
    fs.writeFileSync(this.filePath, content, 'utf8');
    backendLogger.info(`Output saved to file`, { filePath: this.filePath });
  }
}

/**
 * Clear all existing data
 */
async function clearDatabase(output) {
  output.log('🧹 Clearing all existing data...');
  await Promise.all([
    User.deleteMany({}),
    Destination.deleteMany({}),
    Experience.deleteMany({}),
    Photo.deleteMany({}),
    Plan.deleteMany({}),
    InviteCode.deleteMany({}),
    Activity.deleteMany({})
  ]);
  output.log('✅ Database cleared (all 7 entity types: Users, Destinations, Experiences, Photos, Plans, InviteCodes, Activities)');
}

/**
 * Create comprehensive demo data for Biensperience
 */
async function createSampleData() {
  const args = parseArgs();
  if (args.help) {
    showHelp();
  }

  // Initialize output manager
  const outputFilePath = path.join(__dirname, 'sampleData.txt');
  const output = new OutputManager(outputFilePath);

  try {
    // Check for required environment variables
    if (!process.env.DATABASE_URL) {
      output.error('❌ ERROR: DATABASE_URL environment variable is not set!');
      output.error('Please ensure your .env file contains:');
      output.error('DATABASE_URL=mongodb+srv://username:password@cluster.mongodb.net/database');
      process.exit(1);
    }

    if (!process.env.SECRET) {
      output.error('❌ ERROR: SECRET environment variable is not set!');
      output.error('Please ensure your .env file contains:');
      output.error('SECRET=your-secret-key-here');
      process.exit(1);
    }

    // Get super admin details (interactive or from flags)
    const { adminName, adminEmail } = await getSuperAdminDetails(args);

    output.log('🔌 Connecting to database...');
    await mongoose.connect(process.env.DATABASE_URL);
    output.log('✅ Connected to database successfully');

    // Clear database if requested
    if (args.clear) {
      await clearDatabase(output);
    } else {
      output.log('ℹ️  Keeping existing data. Use --clear to remove all data first.');
    }

    const generator = new DataGenerator();

    // Set resource counts from args or defaults (3x original counts)
    const resourceCounts = {
      users: args.users || 180,
      destinations: args.destinations || 90,
      experiences: args.experiences || 270,
      plans: args.plans || 450,
      photos: args.photos || 600,
      invites: args.invites || 60,
      activities: args.activities || 300
    };

    output.log('📊 Resource Counts:');
    output.log(`   👥 Users: ${resourceCounts.users} (1 super admin + ${resourceCounts.users - 1} regular)`);
    output.log(`   📍 Destinations: ${resourceCounts.destinations}`);
    output.log(`   🎯 Experiences: ${resourceCounts.experiences}`);
    output.log(`   📋 Plans: ${resourceCounts.plans}`);
    output.log(`   📸 Photos: ${resourceCounts.photos}`);
    output.log(`   🎟️  Invite Codes: ${resourceCounts.invites}`);
    output.log(`   📝 Activity Logs: ${resourceCounts.activities}`);
    output.log('');

    // Generate and create users with custom super admin details
    output.log('👥 Generating users...');
    const userData = generator.generateUsers(resourceCounts.users, { name: adminName, email: adminEmail });
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
    output.log(`✅ Created ${createdUsers.length} users (${createdUsers.filter(u => u.isSuperAdmin).length} super admin, ${createdUsers.filter(u => !u.isSuperAdmin).length} regular users)`);

    // Generate and create destinations
    output.log('📍 Generating destinations...');
    const destinationData = generator.generateDestinations(resourceCounts.destinations);
    const createdDestinations = [];

    for (let i = 0; i < destinationData.length; i++) {
      const dest = destinationData[i];
      const owner = getRandomElement(createdUsers.filter(u => !u.isSuperAdmin));

  dest.user = owner._id;
  dest.permissions = [{ _id: mongoose.Types.ObjectId(owner._id), entity: 'user', type: 'owner', granted_at: new Date(), granted_by: mongoose.Types.ObjectId(owner._id) }];

      const destination = new Destination(dest);
      await destination.save();
      createdDestinations.push(destination);
    }
    output.log(`✅ Created ${createdDestinations.length} destinations`);

    // Generate and create photos
    output.log('📸 Generating photos...');
    const photoData = generator.generatePhotos(resourceCounts.photos);
    const createdPhotos = [];

    for (const photoInfo of photoData) {
      const owner = getRandomElement(createdUsers.filter(u => !u.isSuperAdmin));
  photoInfo.user = owner._id;
  photoInfo.permissions = [{ _id: mongoose.Types.ObjectId(owner._id), entity: 'user', type: 'owner', granted_at: new Date(), granted_by: mongoose.Types.ObjectId(owner._id) }];

      const photo = new Photo(photoInfo);
      await photo.save();
      createdPhotos.push(photo);
    }
    output.log(`✅ Created ${createdPhotos.length} photos`);

    // Assign photos to destinations
    output.log('🔗 Assigning photos to destinations...');
    for (const destination of createdDestinations) {
      const randomPhoto = getRandomElement(createdPhotos);
      destination.photos = [randomPhoto._id];
      destination.default_photo_id = randomPhoto._id;
      await destination.save();
    }

    // Generate and create experiences
    output.log('🎯 Generating experiences...');
    const experienceData = generator.generateExperiences(resourceCounts.experiences, createdUsers, createdDestinations, createdPhotos);
    const createdExperiences = [];

    for (const expData of experienceData) {
      const experience = new Experience(expData);
      await experience.save();
      createdExperiences.push(experience);
    }
    output.log(`✅ Created ${createdExperiences.length} experiences with varied collaborators and plan items`);

    // Generate and create plans
    output.log('📋 Generating user plans...');
    const planData = generator.generatePlans(resourceCounts.plans, createdExperiences, createdUsers);
    const createdPlans = [];

    for (const planInfo of planData) {
      const plan = new Plan(planInfo);
      await plan.save();
      createdPlans.push(plan);
    }
    output.log(`✅ Created ${createdPlans.length} user plans with varying completion levels`);

    // Generate and create invite codes
    output.log('🎟️  Generating invite codes...');
    const inviteData = generator.generateInviteCodes(resourceCounts.invites, createdUsers, createdExperiences, createdDestinations);
    const createdInvites = [];

    for (const inviteInfo of inviteData) {
      const invite = new InviteCode(inviteInfo);
      await invite.save();
      createdInvites.push(invite);
    }
    output.log(`✅ Created ${createdInvites.length} invite codes with varied configurations`);

    // Generate and create activity logs
    output.log('📝 Generating activity logs...');
    const activityData = generator.generateActivities(resourceCounts.activities, createdUsers, createdExperiences, createdDestinations, createdPlans);
    const createdActivities = [];

    for (const activityInfo of activityData) {
      const activity = new Activity(activityInfo);
      await activity.save();
      createdActivities.push(activity);
    }
    output.log(`✅ Created ${createdActivities.length} activity log entries`);

    // Display super admin credentials
    const superAdmin = createdUsers.find(u => u.isSuperAdmin);
    if (superAdmin && superAdmin.credentials) {
      output.log('\n🔐 SUPER ADMIN CREDENTIALS:');
      output.log('=====================================');
      output.log(`Name:     ${superAdmin.credentials.name}`);
      output.log(`Email:    ${superAdmin.credentials.email}`);
      output.log(`Password: ${superAdmin.credentials.password}`);
      output.log('=====================================');
      output.log('⚠️  SAVE THESE CREDENTIALS - They will not be shown again!');
      output.log('The super admin has full access to all features and can manage everything.');
    }

    output.log('\n🎉 Sample data generation complete!');
    output.log('📊 Summary:');
    output.log(`   👑 Super Admin: 1 user (custom credentials, API enabled, active session)`);
    output.log(`   👥 Regular Users: ${createdUsers.length - 1} users`);
    output.log(`   📍 Destinations: ${createdDestinations.length}`);
    output.log(`   🎯 Experiences: ${createdExperiences.length} (with varied collaborators and plan items)`);
    output.log(`   📸 Photos: ${createdPhotos.length}`);
    output.log(`   📋 Plans: ${createdPlans.length} (with completion tracking)`);
    output.log(`   🎟️  Invite Codes: ${createdInvites.length} (various configurations)`);
    output.log(`   📝 Activity Logs: ${createdActivities.length} (last 30 days)`);

    output.log('\n👥 DEMO USER ACCOUNTS:');
    output.log('All regular users have password: demo123');
    const usersWithSessions = createdUsers.filter(u => !u.isSuperAdmin && u.currentSessionId);
    const usersWithInvites = createdUsers.filter(u => !u.isSuperAdmin && u.inviteCode);
    const usersWithAPI = createdUsers.filter(u => !u.isSuperAdmin && u.apiEnabled);
    const unverifiedUsers = createdUsers.filter(u => !u.isSuperAdmin && !u.emailConfirmed);

    createdUsers.filter(u => !u.isSuperAdmin).slice(0, 10).forEach(user => {
      const badges = [];
      if (user.currentSessionId) badges.push('📱 Active Session');
      if (user.inviteCode) badges.push(`🎟️  Invite: ${user.inviteCode}`);
      if (user.apiEnabled) badges.push('🔑 API');
      if (!user.emailConfirmed) badges.push('✉️  Unverified');
      if (user.visibility === 'private') badges.push('🔒 Private');

      output.log(`   ${user.name} - ${user.email}${badges.length ? ' [' + badges.join(', ') + ']' : ''}`);
    });
    if (createdUsers.filter(u => !u.isSuperAdmin).length > 10) {
      output.log(`   ... and ${createdUsers.filter(u => !u.isSuperAdmin).length - 10} more users`);
    }

    output.log('\n📊 USER FEATURE BREAKDOWN:');
    output.log(`   📱 Active Sessions: ${usersWithSessions.length} users (~60%)`);
    output.log(`   🎟️  Used Invite Codes: ${usersWithInvites.length} users (~30%)`);
    output.log(`   🔑 API Access Enabled: ${usersWithAPI.length} users (~10%)`);
    output.log(`   ✅ Email Verified: ${createdUsers.filter(u => !u.isSuperAdmin && u.emailConfirmed).length} users (~80%)`);
    output.log(`   ✉️  Email Unverified: ${unverifiedUsers.length} users (~20%)`);
    output.log(`   👁️  Public Profiles: ${createdUsers.filter(u => !u.isSuperAdmin && u.visibility === 'public').length} users (~70%)`);
    output.log(`   🔒 Private Profiles: ${createdUsers.filter(u => !u.isSuperAdmin && u.visibility === 'private').length} users (~30%)`);

    output.log('\n🎟️  INVITE CODE BREAKDOWN:');
    const activeInvites = createdInvites.filter(i => i.isActive && (!i.expiresAt || i.expiresAt > new Date()));
    const redeemedInvites = createdInvites.filter(i => i.usedCount > 0);
    const multiUseInvites = createdInvites.filter(i => i.maxUses > 1);
    const emailRestrictedInvites = createdInvites.filter(i => i.email);

    output.log(`   ✅ Active Invites: ${activeInvites.length}`);
    output.log(`   🎫 Redeemed Invites: ${redeemedInvites.length} (~50%)`);
    output.log(`   🔄 Multi-Use Invites: ${multiUseInvites.length} (~20%)`);
    output.log(`   📧 Email-Restricted: ${emailRestrictedInvites.length} (~40%)`);
    output.log(`   🎁 With Experiences: ${createdInvites.filter(i => i.experiences.length > 0).length} (~60%)`);
    output.log(`   📍 With Destinations: ${createdInvites.filter(i => i.destinations.length > 0).length} (~40%)`);

    output.log('\n📝 ACTIVITY LOG BREAKDOWN:');
    const activityByType = activityData.reduce((acc, activity) => {
      acc[activity.action] = (acc[activity.action] || 0) + 1;
      return acc;
    }, {});

    Object.entries(activityByType).forEach(([action, count]) => {
      const percentage = Math.round((count / activityData.length) * 100);
      output.log(`   ${action}: ${count} (${percentage}%)`);
    });

    output.log('\n🔍 SAMPLE SCENARIOS TO EXPLORE:');
    output.log('   • Session tracking: Check user sessions in Activity Monitor');
    output.log('   • Email verification: Test signup flow with unverified users');
    output.log('   • Invite codes: View and redeem invite codes');
    output.log('   • API tokens: Test API access with enabled users');
    output.log('   • Activity logs: Super admin can view all activities');
    output.log('   • Experiences with multiple collaborators and contributors');
    output.log('   • Plans with different completion percentages');
    output.log('   • Destinations with varied travel tips');
    output.log('   • User profile visibility (public vs private)');
    output.log('   • User plans with realistic cost variations');

    // Write output to file
    output.writeToFile();

  } catch (error) {
    output.error('❌ Error creating sample data:');
    output.error(error.message);
    output.error(error.stack);
    output.writeToFile();
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    output.log('🔌 Disconnected from database');
    output.writeToFile();
  }
}

// Run the function
createSampleData().catch(error => backendLogger.error('Sample data creation failed', error));
