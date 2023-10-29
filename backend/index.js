const express = require('express');
const app = express();
const port = 8000;

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.get('/signup', (req, res) => {
    res.send('This is the signup page!');
  });

app.get('/login', (req, res) => {
    res.send('This is the login page!');
  });

app.listen(port, () => {
  console.log(`The backend server is running at http://localhost:${port}`);
})