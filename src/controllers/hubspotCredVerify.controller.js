const client = require('../../redis/redisClient');

const verifyCredentials = async (req, res) => {
    const redisClient = await client;

    // check whether it is token or state (json)
    const tokenOrState = await redisClient.get(`State of ${req.body.userId}:${req.body.orgId}`);

    // Check 1: Does the key exist at all?
    if (!tokenOrState) {
        return res.status(401).json({ error: "User Unauthorized!"});
    }

    // Check 2: Is it still the original JSON state? 
    // (If it contains 'userId', it hasn't been overwritten by the token yet)
    if (tokenOrState.includes('"userId"')) {
        return res.status(401).json({ error: "OAuth Incomplete! Window closed early."});
    }

    // If it exists and isn't the state JSON, it must be the Access Token
    res.status(200).json({ message: "Success!"});
}

module.exports = verifyCredentials;