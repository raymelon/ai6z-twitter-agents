require('dotenv').config({
  path: '.env',
  // debug: true
});
const { execSync } = require('child_process');
const { Scraper } = require('agent-twitter-client');
const fs = require('fs');
const axios = require('axios');
const readline = require('readline');
const path = require('path');

// Ensure base directory exists
const BASE_PATH = process.env.BASE_PATH || './';
if (!fs.existsSync(BASE_PATH)) {
  console.log(`BASE_PATH ${BASE_PATH} does not exist.`);
}

function getCookies(scraper) {
  scraper.getCookies().then((cookies) => {
    const cookiesArray = cookies.map(cookie => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path,
      expires: cookie.expires,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure
    }));

    const folderPath = path.join(BASE_PATH, 'cookies');
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }
    fs.writeFileSync(path.join(folderPath, `${process.env.TWITTER_USERNAME}.json`), JSON.stringify(cookiesArray, null, 2));
  });
}

async function fetchTopics() {
  // Empty for now as requested
}

async function fetchProfiles(scraper, profiles) {
  const results = [];

  for (const username of profiles) {
    try {
      const tweets = await scraper.getTweets(username, 1);
      const tweetsAsArray = [];

      for await (const tweet of tweets) {
        console.log({ tweet });
        tweetsAsArray.push(tweet);
      }

      results.push({
        username,
        tweets: tweetsAsArray
      });
    } catch (e) {
      console.log(`Error fetching tweets for ${username}:`, e);
      results.push({
        username,
        tweets: [],
        error: e.message
      });
    }
  }

  return results;
}

module.exports = {
  getCookies,
  fetchTopics,
  fetchProfiles
}; 