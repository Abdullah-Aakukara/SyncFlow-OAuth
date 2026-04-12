const { createClient } = require('redis');
const path = require('path');
require('dotenv').config({ 
  path: path.resolve(__dirname, '../.env') 
});

const client = createClient({
    username: process.env.REDIS_USER,
    password: process.env.REDIS_PASSWORD,
    socket: {
        host: 'redis-10659.c60.us-west-1-2.ec2.cloud.redislabs.com',
        port: 10659
    }
});

client.on('error', err => console.error('Redis Client Error', err));

const redisReady = client.connect().then(() => {
  console.log("Redis Client connected!");
  return client;
});

module.exports = redisReady;