const express = require('express');
const router = express.Router();
const countriesCtrl = require('../../controllers/api/countries');

// GET /api/countries/:countryName - Get all destinations and experiences for a country
router.get('/:countryName', countriesCtrl.getByCountry);

module.exports = router;
