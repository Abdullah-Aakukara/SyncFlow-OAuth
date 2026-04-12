const express = require('express');
const cors = require('cors');
const hubspotRouter = require('./routes/hubspot.routes')
const app = express();

app.use(express.json());
app.use(cors());

app.use('/integrations/hubspot', hubspotRouter);

module.exports = app;