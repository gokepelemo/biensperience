require('dotenv').config();
require('./config/database');

const User = require('./models/user');

let user, item, category, order;
let users, items, categories, orders;