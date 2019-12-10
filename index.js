const express = require('express');
const bodyParser = require('body-parser');

const app = express();
const port = 5040;

// Use bodyParser Middleware to fetch body params
app.use(bodyParser.urlencoded({ extended: false }));

app.post('/addMessage', (req, res) => {
    const message = req.body.message;
    const time = req.body.time;
    

    res.send(`got ${message} and ${time}`);
});

app.listen(port, () => console.log(`Listening on port ${port}`));