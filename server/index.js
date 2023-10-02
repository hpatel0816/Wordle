const express = require('express');
const app = express();
const port = 8000;

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.get('/wordle', (req, res) => {
    res.send('This is Wordle backend server!');
  });

app.listen(port, () => {
  console.log(`The backend server is running at http://localhost:${port}`);
})