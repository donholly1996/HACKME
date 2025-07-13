# HACKME

This is a deliberately vulnerable Node.js web application for demonstrating common web security flaws such as SQL Injection and Cross-Site Scripting (XSS).

## Features
- Insecure login form (SQL Injection)
- XSS in user feedback
- SQLite database

## Usage
1. Install dependencies: `npm install`
2. Start the app: `node app.js`
3. Visit `http://localhost:3000` in your browser

**Warning:** This app is intentionally insecure. Do NOT deploy in production or expose to the internet.
