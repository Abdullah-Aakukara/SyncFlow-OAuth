const axios = require('axios');
const client = require('../../redis/redisClient');
const path = require('path');
require('dotenv').config({path: path.resolve(__dirname, '../../.env')});

const oauth2callbackHubspot = async (req, res) => {
    const redisClient = await client;
    const authCode = req.query.code;
    const state = JSON.parse(req.query.state);
    try {
        const actualState = await redisClient.get(`State of ${state.userId}:${state.orgId}`);
        const parsedActualState = JSON.parse(actualState);
        if (state.userId !== parsedActualState.userId || state.orgId !== parsedActualState.orgId) {
            res.status(401).json({
                error: "You are not an Authorized person!"
            })
        }
        
        const tokenExchange = new URLSearchParams();

        tokenExchange.append('grant_type', 'authorization_code');
        tokenExchange.append('client_id', process.env.CLIENT_ID);
        tokenExchange.append('client_secret', process.env.CLIENT_SECRET);
        tokenExchange.append('redirect_uri', 'http://localhost:8000/integrations/hubspot/oauth2callback' );
        tokenExchange.append('code', authCode);


        const response = await axios.post('https://api.hubspot.com/oauth/v3/token', tokenExchange)

        await redisClient.set(`State of ${state.userId}:${state.orgId}`, response.data.access_token);

        res.status(200).send(`
            <html>
                <body>
                    <script>
                        window.close();
                    </script>
                </body>
            </html>`);
    } catch (err) {
        console.log(err.message);
        res.status(500).json({ error: "Internal Server Error"});
    }
}

module.exports = oauth2callbackHubspot;