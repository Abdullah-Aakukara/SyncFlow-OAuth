const express = require('express');
const authorize_hubspot = require('../controllers/hubspotAuth.controller')
const oauth2callback_hubspot = require('../controllers/oauth2cbHubspot.controller')
const verifyCredentials = require('../controllers/hubspotCredVerify.controller')
const getItems = require('../controllers/hubspotGetItems.controllers')
const router = express.Router();

router.post('/authorize', authorize_hubspot)

router.get('/oauth2callback', oauth2callback_hubspot)

router.post('/credentials', verifyCredentials);

router.post('/load', getItems)


module.exports = router;

