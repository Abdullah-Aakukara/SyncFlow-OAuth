const app = require('./src/app');
require('dotenv').config({path: './.env'})
const PORT = process.env.PORT;

app.listen(PORT, ()=> {
    console.log(`Server is running on PORT:${PORT}`);
})