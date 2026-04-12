const client = require('../../redis/redisClient');
require('dotenv').config({path : '../../.env'});


const REDIRECT_URI = 'http://localhost:8000/integrations/hubspot/oauth2callback'

const authorizeHubspot = async (req, res) => {

    const { userId, orgId } = req.body;
    const state = JSON.stringify({userId, orgId});

    try {
        const redisClient = await client;

        await redisClient.set(`State of ${userId}:${orgId}`, state);

        const oAuthUrl = `https://app-na2.hubspot.com/oauth/authorize?client_id=e5a25490-fdd3-4c4c-a675-50b51aea9499&redirect_uri=http%3A%2F%2Flocalhost%3A8000%2Fintegrations%2Fhubspot%2Foauth2callback&scope=oauth+crm.objects.contacts.read&state=${encodeURIComponent(state)}`
    
        res.status(200).json({
            authUrl : oAuthUrl
        })
        
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error!"})
    }
}

module.exports = authorizeHubspot;


