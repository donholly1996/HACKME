// This endpoint is for the login animation to check if the login would succeed or fail, using the same SQL injection vulnerability.
const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('hackme.db');

router.post('/login-check', (req, res) => {
  const { username, password } = req.body;
  const query = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;
  db.get(query, (err, row) => {
    if (row) {
      res.json({ success: true });
    } else {
      res.json({ success: false });
    }
  });
});

module.exports = router;
