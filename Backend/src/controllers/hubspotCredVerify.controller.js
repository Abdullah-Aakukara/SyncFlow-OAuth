const client = require('../../redis/redisClient');

const verifyCredentials = async (req, res) => {
    const redisClient = await client;

    const isAccessToken = await redisClient.get(`State of ${req.body.userId}:${req.body.orgId}`)

    if (!isAccessToken) {
        return res.status(401).json({ error: "User Unauthorized!"})
    }

    res.status(200).json({ message: "Success!"})

}

module.exports = verifyCredentials;