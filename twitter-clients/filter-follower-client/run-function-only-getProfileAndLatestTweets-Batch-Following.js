const { runTwitterAgent } = require('./index');
console.log("This is run-function-only.js running...");

const twitterUsername = process.argv[2] || 'pseudokid';

runTwitterAgent(twitterUsername, 'getProfileAndLatestTweetsBatch-Following');