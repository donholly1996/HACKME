const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');

const app = express();
const db = new sqlite3.Database(':memory:');

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({
  secret: 'hackme-secret',
  resave: false,
  saveUninitialized: true
}));

db.serialize(() => {
  db.run('CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, password TEXT)');
  db.run("INSERT INTO users (username, password) VALUES ('admin', 'password')");
});

app.get('/', (req, res) => {
  if (req.session.username) {
    return res.redirect('/dashboard');
  }
  res.render('login', { message: null });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  // VULNERABLE: SQL Injection
  const query = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;
  db.get(query, (err, row) => {
    if (row) {
      req.session.username = username;
      return res.redirect('/dashboard');
    } else {
      res.render('login', { message: 'Invalid credentials' });
    }
  });
});

app.get('/dashboard', (req, res) => {
  if (!req.session.username) {
    return res.redirect('/');
  }
  // VULNERABLE: XSS in username
  res.render('dashboard', { username: req.session.username });
});

app.get('/help', (req, res) => {
  res.render('help');
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

app.get('/account', (req, res) => {
  // IDOR: Anyone can view any user's info by changing the id param
  // EXPLANATION: This endpoint is vulnerable to Insecure Direct Object Reference (IDOR).
  // By changing the 'id' parameter in the URL, a user can access other users' data, including passwords.
  const id = req.query.id || 1;
  db.get(`SELECT * FROM users WHERE id = ${id}`, (err, user) => {
    if (user) {
      res.render('account', { user });
    } else {
      res.send('Account not found');
    }
  });
});

app.get('/transfer', (req, res) => {
  // CSRF: No protection on this form
  // EXPLANATION: This form is vulnerable to Cross-Site Request Forgery (CSRF).
  // There is no CSRF token or validation, so a malicious site could submit this form on behalf of a logged-in user.
  if (!req.session.username) return res.redirect('/');
  res.render('transfer', { username: req.session.username });
});

app.post('/transfer', (req, res) => {
  // CSRF: No protection, no validation
  // EXPLANATION: This endpoint processes transfers without any authentication or validation, making it vulnerable to CSRF and logic flaws.
  res.send('Transfer complete! (not really)');
});

app.get('/redirect', (req, res) => {
  // Open Redirect
  // EXPLANATION: This endpoint is vulnerable to Open Redirect attacks.
  // It redirects users to any URL provided in the 'url' query parameter, which can be abused for phishing.
  const url = req.query.url || '/';
  res.redirect(url);
});

// Clickjacking: No X-Frame-Options header is set, so the app can be embedded in an iframe.
// EXPLANATION: This allows attackers to trick users into clicking on hidden UI elements (Clickjacking).

app.get('/whoami', (req, res) => {
  // Sensitive Information in URL: Expose session username in a query parameter
  // EXPLANATION: This endpoint exposes the logged-in username in the URL, which can leak sensitive info via browser history or logs.
  res.send(`You are: ${req.session.username || 'not logged in'}`);
});

app.get('/goto/:site', (req, res) => {
  // Unvalidated Redirect with user input in path
  // EXPLANATION: This endpoint redirects to any site provided in the path, e.g. /goto/evil.com
  res.redirect('http://' + req.params.site);
});

// Weak Session Management: Predictable secret, no expiration
// (Already present: 'hackme-secret', no cookie expiration)

app.post('/login-verbose', (req, res) => {
  // User Enumeration: Different error messages for username vs. password
  const { username, password } = req.body;
  db.get(`SELECT * FROM users WHERE username = '${username}'`, (err, user) => {
    if (!user) {
      return res.render('login', { message: 'No such user' });
    }
    if (user.password !== password) {
      return res.render('login', { message: 'Wrong password' });
    }
    req.session.username = username;
    res.redirect('/dashboard');
  });
});

app.get('/register', (req, res) => {
  res.render('register', { message: null });
});

app.post('/register', (req, res) => {
  const { username, password } = req.body;
  // VULNERABLE: No input validation, allows duplicate usernames, XSS, etc.
  db.run(`INSERT INTO users (username, password) VALUES ('${username}', '${password}')`, function(err) {
    if (err) {
      return res.render('register', { message: 'Registration failed: ' + err.message });
    }
    res.render('register', { message: 'User registered! You can now log in.' });
  });
});

app.get('/profile', (req, res) => {
  // VULNERABLE: No authentication, IDOR, XSS
  const username = req.query.username || req.session.username;
  db.get(`SELECT * FROM users WHERE username = '${username}'`, (err, user) => {
    if (user) {
      res.render('profile', { user });
    } else {
      res.send('Profile not found');
    }
  });
});

app.get('/change-password', (req, res) => {
  res.render('change-password', { message: null });
});

app.post('/change-password', (req, res) => {
  // VULNERABLE: No authentication, anyone can change any password
  const { username, password } = req.body;
  db.run(`UPDATE users SET password = '${password}' WHERE username = '${username}'`, function(err) {
    if (err || this.changes === 0) {
      return res.render('change-password', { message: 'Password change failed.' });
    }
    res.render('change-password', { message: 'Password changed!' });
  });
});

app.get('/xss-test', (req, res) => {
  const input = req.query.input || '';
  res.send(`<!DOCTYPE html><html><head><title>XSS Test</title></head><body><h2>XSS Test</h2><div>Echoed input:</div><div style='border:1px solid #ccc;padding:1em;margin:1em 0;'>${input}</div><form method='GET'><input name='input' placeholder='Try &lt;script&gt;alert(1)&lt;/script&gt;' style='width:300px'><button type='submit'>Test</button></form><div style='margin-top:2em;'><a href="/">Back to Login</a></div></body></html>`);
});

app.listen(3000, () => {
  console.log('HACKME app listening on http://localhost:3000');
});
