const client = require('../../redis/redisClient');
const axios = require('axios');

const getItems = async (req, res) => {
    const {userId, orgId} = req.body;
    try {
        const redisClient = await client;
        const accessToken = await redisClient.get(`State of ${userId}:${orgId}`);

        const response = await axios.get('https://api.hubapi.com/crm/v3/objects/contacts', {
            headers: {
                Authorization: `Bearer ${accessToken}`, 
                "Content-Type": "application/json"
            }, 
            params: {
                limit: 10, 
                archived: false, 
                properties: 'firstname,lastname,email'
            }
        });

        if (response.status !== 200) {
            return res.status(500).json({ error: "Internal Server Error!"})
        }

        const data = response.data;

        res.status(200).json(data);
    } catch(err) {
        console.error(err)
        res.status(500).json({ error: "Something went Wrong, Server Error!"})
    }

}

module.exports = getItems;