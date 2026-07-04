const express = require('express');
const axios = require('axios');
const router = express.Router();

const CLIENT_ID = process.env.GITHUB_CLIENT_ID || 'placeholder_client_id';
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || 'placeholder_client_secret';
// In a real app, you would configure the redirect URI in GitHub to point to this callback
const REDIRECT_URI = process.env.GITHUB_REDIRECT_URI || 'http://localhost:5173/git?github_auth=true';

router.get('/login', (req, res) => {
  const url = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&scope=repo,user&redirect_uri=${encodeURIComponent('http://localhost:5000/api/auth/github/callback')}`;
  res.redirect(url);
});

router.get('/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.status(400).send('No code provided');
  }

  try {
    const response = await axios.post('https://github.com/login/oauth/access_token', {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code: code
    }, {
      headers: { accept: 'application/json' }
    });

    const accessToken = response.data.access_token;
    
    // Redirect back to frontend with token (in a real app, set an httpOnly cookie or save to DB)
    // Here we pass it in the hash fragment or query so the frontend can grab it
    res.redirect(`${REDIRECT_URI}&token=${accessToken}`);
  } catch (error) {
    console.error('GitHub OAuth Error:', error.message);
    res.status(500).send('Authentication failed');
  }
});

module.exports = router;
