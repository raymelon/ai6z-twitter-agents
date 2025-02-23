require('dotenv').config({
  path: '.env',
  // debug: true
});
const { execSync } = require('child_process');
const { Scraper } = require('agent-twitter-client');
const fs = require('fs');
const axios = require('axios');
// const cron = require('node-cron');
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

async function getFollowers(scraper, username, userId) {
  const profile = await scraper.getProfile(username);
  const followerCount = profile.followersCount;

  const followerResults = await scraper.getFollowers(userId, 1500);
  const followers = [];

  let recordedFollowerCount = 0;
  for await (const follower of followerResults) {
    recordedFollowerCount++;
    console.log(`Recording ${recordedFollowerCount} follower... ${follower.username}`);

    const folderPath = path.join(BASE_PATH, 'followers');
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    const newUsernames = [follower?.username]

    const filePath = path.join(folderPath, `${username}.json`);
    let existingData = { followers: [], count: 0 };

    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      existingData = JSON.parse(fileContent);
    }
    // Append to existing data
    existingData.followers = [...new Set([...existingData.followers, ...newUsernames])];
    existingData.count = existingData.followers?.length;

    fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2));
  }
}

async function getFollowersPaged(scraper, username, userId, resumeFrom = 0, cursor) {
  const profile = await scraper.getProfile(username);
  const followerCount = profile.followersCount;
  const followersPerPage = 50;  // Assuming 100 followers per page
  const pagesToFetch = Math.ceil(followerCount / followersPerPage);

  console.log({ followerCount, followersPerPage, pagesToFetch });

  const folderPath = path.join(BASE_PATH, 'followers');
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }

  const sourceFilePath = path.join(folderPath, `${username}.json`);
  const destinationFilePath = path.join(folderPath, `${username}-copy.json`);

  if (fs.existsSync(sourceFilePath)) {
    fs.copyFileSync(sourceFilePath, destinationFilePath);
    console.log(`File ${username}.json has been duplicated to ${username}-copy.json`);

    fs.writeFileSync(sourceFilePath, JSON.stringify({ followers: [], count: 0, username }, null, 2));
    console.log(`File ${username}.json has been reset`);
  } else {
    console.log(`File ${username}.json does not exist.`);
  }

  let currentFollowersFetched = 0
  let existingData = { followers: [], count: 0, username };

  for (let page = resumeFrom; page < pagesToFetch; page++) {
    const followerResults = await scraper.fetchProfileFollowers(userId, followersPerPage, cursor);
    console.log(`Fetched page ${page} out of ${pagesToFetch}. next: ${followerResults?.next}, previous: ${followerResults?.previous}`);

    const newUsernames = followerResults?.profiles.map(profile => profile.username).filter(Boolean);
    console.log({ newUsernames });

    if (fs.existsSync(sourceFilePath)) {
      const fileContent = fs.readFileSync(sourceFilePath, 'utf8');
      existingData = JSON.parse(fileContent);
    }

    existingData.followers = [...new Set([...existingData.followers, ...newUsernames])];
    existingData.count = existingData.followers.length;

    currentFollowersFetched += newUsernames.length;

    fs.writeFileSync(sourceFilePath, JSON.stringify(existingData, null, 2));

    cursor = followerResults.next;

    console.log(`existingData.count: ${currentFollowersFetched} followers fetched out of ${followerCount}`)

    // NOTE:
    //  we don't need this because the scraper automatically waits.
    //  so cool.
    //
    // if (existingData.count >= 2400 && existingData.count <= 2500) {
    //   console.log("Pausing for 15 minutes before resuming loop...");
    //   await new Promise(resolve => setTimeout(resolve, 15 * 60 * 1000));
    //   console.log("Resuming after 15 minutes pause");
    // }
  }
}

async function getFollowing(scraper, username, userId) {
  const profile = await scraper.getProfile(username);
  const followingCount = profile.followingCount;

  const followingResults = await scraper.getFollowing(userId, followingCount);
  const followings = [];

  let recordedFollowingCount = 0;
  for await (const following of followingResults) {
    recordedFollowingCount++;
    console.log(`Recording ${recordedFollowingCount} following... ${following.username}`);

    const folderPath = path.join(BASE_PATH, 'following');
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    const newUsernames = [following?.username]

    const filePath = path.join(folderPath, `${username}.json`);
    let existingData = { followings: [], count: 0 };

    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      existingData = JSON.parse(fileContent);
    }
    // Append to existing data
    existingData.followings = [...new Set([...existingData.followings, ...newUsernames])];
    existingData.count = existingData.followingResults?.length;

    fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2));
  }
}

async function getProfile(scraper, username) {
  const profile = await scraper.getProfile(username);
  console.log({ profile });
  return profile;
}

async function getProfileAndLatestTweets(scraper, username) {
  try {
    const profile = await getProfile(scraper, username)
    const tweets = await scraper.getTweets(username, 1)
    console.log({ tweets })
    const tweetsAsArray = []
    for await (const tweet of tweets) {
      console.log({ tweet })
      tweetsAsArray.push(tweet)
    }
    return { profile, tweets: tweetsAsArray }
  } catch (e) {
    console.log(e)
    if (e.message.includes('User not found')) {
      return { profile: { error: 'User not found' }, tweets: [] }
    }
  }
}

async function structureProfileAndTweetData(profileAndLatestTweets) {

  // structures profile and tweet data for LLM analysis

  const { profile, tweets } = profileAndLatestTweets

  const structuredData = {
    profile: {},
    tweet: {}
  }

  if (profile) {
    structuredData.profile = {
      isPrivate: profile.isPrivate,
      isVerified: profile.isVerified,
      followRatio: simplifyRatio(profile.followersCount, profile.followingCount),
      location: profile.location,
      name: profile.name,
      isBlueVerified: profile.isBlueVerified,
      biography: profile.biography,
      avatar: profile.avatar,
      joined: timeAgo(profile.joined),
    }

    structuredData.tweet = {
      hashtags: tweets.map(tweet => tweet.hashtags).flat().length,
      mentions: tweets.map(tweet => tweet.mentions).flat().length,
      urls: tweets.map(tweet => tweet.urls).flat().length,
      likes: tweets.map(tweet => tweet.likes).reduce((a, b) => a + b, 0),
      replies: tweets.map(tweet => tweet.replies).reduce((a, b) => a + b, 0),
      retweets: tweets.map(tweet => tweet.retweets).reduce((a, b) => a + b, 0),
      bookmarkCount: tweets.map(tweet => tweet.bookmarkCount).reduce((a, b) => a + b, 0),
      text: tweets.map((tweet, index) => `<tweet ${index} start>: ${tweet.text}<tweet ${index} end>`).join('\n'),
      isRetweet: tweets.map(tweet => tweet.isRetweet).flat(),
      sensitiveContent: tweets.map(tweet => tweet.sensitiveContent).flat(),
      thread: tweets.map(tweet => tweet.thread).flat().length,
      photos: tweets.map(tweet => tweet.photos).flat().length,
      mentions: tweets.map(tweet => tweet.mentions).flat().length,
      videos: tweets.map(tweet => tweet.videos).flat().length,
      isQuoted: tweets.map(tweet => tweet.isQuoted).flat(),
      isPin: tweets.map(tweet => tweet.isPin).flat(),
      views: tweets.map(tweet => tweet.views).flat(),
      timeParsed: tweets.map(tweet => timeAgo(tweet.timeParsed)).flat()
    }
  }

  console.log(structuredData)

  return structuredData
}

function simplifyRatio(numerator, denominator) {
  function gcd(a, b) {
    while (b) {
      [a, b] = [b, a % b];
    }
    return Math.abs(a);
  }

  if (denominator === 0) {
    return "Division by zero"; // Handle division by zero
  }

  const commonDivisor = gcd(numerator, denominator);
  const simplifiedNumerator = numerator / commonDivisor;
  const simplifiedDenominator = denominator / commonDivisor;

  return `${simplifiedNumerator}/${simplifiedDenominator}`;
}

function timeAgo(isoTimestamp) {
  const now = new Date();
  const pastDate = new Date(isoTimestamp);
  const timeDiff = now.getTime() - pastDate.getTime();

  if (isNaN(timeDiff)) {
    return "Invalid date";
  }

  const seconds = Math.floor(timeDiff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30.44); // Average month length
  const years = Math.floor(months / 12);

  const secondsAgo = seconds % 60;
  const minutesAgo = minutes % 60;
  const hoursAgo = hours % 24;
  const daysAgo = days % 7; // Remaining days after weeks are calculated
  const weeksAgo = weeks % 4.35; // Remaining weeks after months are roughly calculated (not really used in final output as months are prioritized)
  const monthsAgo = months % 12;


  let timeAgoString = '';

  if (years > 0) {
    timeAgoString += `${years} year${years > 1 ? 's' : ''}, `;
  }
  if (monthsAgo > 0) {
    timeAgoString += `${monthsAgo} month${monthsAgo > 1 ? 's' : ''}, `;
  }
  if (weeksAgo > 0 && years === 0 && monthsAgo === 0) { // Show weeks only if years and months are zero for specificity as requested
    timeAgoString += `${Math.floor(weeksAgo)} week${Math.floor(weeksAgo) > 1 ? 's' : ''}, `;
  }
  if (daysAgo > 0 && years === 0 && monthsAgo === 0) { // Show days only if years and months are zero for specificity as requested
    timeAgoString += `${daysAgo} day${daysAgo > 1 ? 's' : ''}, `;
  }
  if (hoursAgo > 0 && years === 0 && monthsAgo === 0 && Math.floor(weeksAgo) === 0 && daysAgo === 0) { // Show hours only if years, months, weeks, days are zero for specificity
    timeAgoString += `${hoursAgo} hour${hoursAgo > 1 ? 's' : ''}, `;
  }
  if (minutesAgo > 0 && years === 0 && monthsAgo === 0 && Math.floor(weeksAgo) === 0 && daysAgo === 0 && hoursAgo === 0) { // Show minutes only if years, months, weeks, days, hours are zero for specificity
    timeAgoString += `${minutesAgo} min, `;
  }
  if (secondsAgo > 0 && years === 0 && monthsAgo === 0 && Math.floor(weeksAgo) === 0 && daysAgo === 0 && hoursAgo === 0 && minutesAgo === 0) { // Show seconds only if all larger units are zero for specificity
    timeAgoString += `${secondsAgo} second${secondsAgo > 1 ? 's' : ''}, `;
  }


  if (timeAgoString.endsWith(', ')) {
    timeAgoString = timeAgoString.slice(0, -2); // Remove trailing comma and space
  }

  if (timeAgoString === '') {
    return 'Just now';
  } else {
    return timeAgoString + ' ago';
  }
}

async function gitPull() {
  // Git operations before updating follower jsons
  try {
    execSync('git pull origin');
    console.log('"git pull origin" completed successfully');
  } catch (error) {
    console.error('Error during "git pull origin":', error.message);
  }
}

async function gitCommitAndPush() {
  // Git operations after compareFollowers
  const now = new Date();
  const timezoneOffset = -now.getTimezoneOffset() / 60;
  const timezone = `GMT${timezoneOffset >= 0 ? '+' : ''}${timezoneOffset}`;
  const timestamp = `${now.toISOString().split('T')[0]} ${now.toTimeString().split(' ')[0]} ${timezone}`;

  try {
    execSync(`git commit -am "unfollowers update ${timestamp}"`);
    execSync('git push');
    console.log('Git operations completed successfully');
  } catch (error) {
    console.error('Error during git operations:', error.message);
  }
}

async function sendToTelegramChannel(message) {
  const botToken = process.env.TELEGRAM_BOT_NEWTWITTERFOLLOWERSBOT_TOKEN;
  const chatId = process.env.TELEGRAM_BOT_NEWTWITTERFOLLOWERSBOT_CHATID;

  if (!botToken || !chatId) {
    console.error('Telegram bot token or chat ID is not set in environment variables.');
    return;
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  try {
    const response = await axios.post(url, {
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML'
    });

    if (response.data.ok) {
      console.log('Message sent successfully to Telegram channel');
    } else {
      console.error('Failed to send message to Telegram channel:', response.data.description);
    }
  } catch (error) {
    console.error('Error sending message to Telegram channel:', error.message);
  }
}

async function runTwitterAgent(username = 'pseudokid', agentName = 'getFollowers') {

  const scraper = new Scraper();
  console.log(`logging in as ${process.env.TWITTER_USERNAME}`);
  await scraper.login(process.env.TWITTER_USERNAME, process.env.TWITTER_PASSWORD);

  // await getCookies(scraper, process.env.TWITTER_USERNAME)

  const profile = await getProfile(scraper, username)

  // await gitPull()

  // await getFollowersPaged(scraper, username, profile?.userId, 0, null)
  // await getProfile(scraper, username)
  if (agentName === 'getFollowers') {
    await getFollowers(scraper, username, profile?.userId)
  }

  if (agentName === 'getFollowing') {
    await getFollowing(scraper, username, profile?.userId)
  }

  if (agentName === 'getProfileAndLatestTweets') {
    const profileAndLatestTweets = await getProfileAndLatestTweets(scraper, username)
    await structureProfileAndTweetData(profileAndLatestTweets)
  }

  if (agentName === 'getProfileAndLatestTweetsBatch-Followers') {

    const sourceFilePath = `followers/${username}.json`;
    if (!fs.existsSync(sourceFilePath)) {
      console.log(`File ${sourceFilePath} does not exist.`);
      return;
    }

    const fileContent = fs.readFileSync(sourceFilePath, 'utf8');
    const { followers } = JSON.parse(fileContent);

    for (const followerUsername of followers) {

      // check if follower is on strucuted-data folder
      const structuredDataFilePath = path.join(BASE_PATH, 'structured-data-followers', `${followerUsername}.json`);
      if (fs.existsSync(structuredDataFilePath)) {
        console.log(`Skipping follower ${followerUsername} as it is already processed`);
        continue;
      }

      console.log(`Processing follower: ${followerUsername}`);

      // get profile and latest tweets (2 API calls)
      const profileAndLatestTweets = await getProfileAndLatestTweets(scraper, followerUsername);

      // structure profile and tweet data to make it LLM-friendly
      const structuredData = await structureProfileAndTweetData(profileAndLatestTweets);

      // make json file for each follower
      const folderPath = path.join(BASE_PATH, 'structured-data-followers');
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }
      // write to file
      fs.writeFileSync(path.join(folderPath, `${followerUsername}.json`), JSON.stringify(structuredData, null, 2));
    }
  }
  // await gitCommitAndPush()


  if (agentName === 'getProfileAndLatestTweetsBatch-Following') {

    const sourceFilePath = `following/${username}.json`;
    if (!fs.existsSync(sourceFilePath)) {
      console.log(`File ${sourceFilePath} does not exist.`);
      return;
    }

    const fileContent = fs.readFileSync(sourceFilePath, 'utf8');
    const { followings } = JSON.parse(fileContent);

    for (const followingUsername of followings) {

      // check if following is on strucuted-data folder
      const structuredDataFilePath = path.join(BASE_PATH, 'structured-data-following', `${followingUsername}.json`);
      if (fs.existsSync(structuredDataFilePath)) {
        console.log(`Skipping following ${followingUsername} as it is already processed`);
        continue;
      }

      console.log(`Processing following: ${followingUsername}`);

      // get profile and latest tweets (2 API calls)
      const profileAndLatestTweets = await getProfileAndLatestTweets(scraper, followingUsername);

      // structure profile and tweet data to make it LLM-friendly
      const structuredData = await structureProfileAndTweetData(profileAndLatestTweets);

      // make json file for each follower
      const folderPath = path.join(BASE_PATH, 'structured-data-following');
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }
      // write to file
      fs.writeFileSync(path.join(folderPath, `${followingUsername}.json`), JSON.stringify(structuredData, null, 2));
    }
  }
}

// script entry point - start

async function runStandalone() {

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  // Prompt user to run immediately with 10-second timer
  const timerDuration = 10000; // 10 seconds
  let timer;

  const promptMessage = `Do you want to run the agent now? (Y/N) [Auto N in ${timerDuration / 1000} seconds]: `;

  // Start the countdown
  let remainingTime = timerDuration / 1000;
  const countdown = setInterval(() => {
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    process.stdout.write(promptMessage.replace(/\d+/, remainingTime));
    remainingTime--;
  }, 1000);

  // Set timeout for automatic 'N' response
  timer = setTimeout(() => {
    clearInterval(countdown);
    console.log('\nNo response received, defaulting to N');
    rl.close();
    console.log('Skipping immediate run. Agent will run on schedule.');
    displayLiveTimerUntilNextCronRun();
  }, timerDuration);

  // Ask the question
  rl.question(promptMessage, (answer) => {
    clearTimeout(timer);
    clearInterval(countdown);
    if (answer.toLowerCase() === 'y') {
      console.log('\nRunning agent immediately...');
      runTwitterAgent();
    } else {
      console.log('\nSkipping immediate run. Agent will run on schedule.');
    }
    rl.close();
  });

  // Schedule runTwitterAgent() to run daily at 12:00 AM
  cron.schedule('0 1 * * *', () => {
    console.log('Running scheduled task...');
    runTwitterAgent();
  });

}

// script entry point - end

// Calculate time remaining until next scheduled run
function getTimeUntilNextCronRun() {
  const now = new Date();
  const nextRun = new Date();
  nextRun.setHours(1, 0, 0, 0); // Next run at 12:00 AM
  if (now.getHours() === 0 && now.getMinutes() === 0) {
    nextRun.setDate(nextRun.getDate() + 1);
  }
  return nextRun - now;
}

// Display live timer for next scheduled run
function displayLiveTimerUntilNextCronRun() {
  let timeRemaining = getTimeUntilNextCronRun();
  const liveTimer = setInterval(() => {
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
    const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);
    process.stdout.write(`Time until next scheduled run: ${hours}h ${minutes}m ${seconds}s`);
    timeRemaining -= 1000;
    if (timeRemaining < 0) {
      clearInterval(liveTimer);
      process.stdout.clearLine();
      process.stdout.cursorTo(0);
      process.stdout.write('\n\nScheduled task is running now...');
    }
  }, 1000);
}

async function purgedOrNotOrRestricted(scraper, username) {
  try {
    const profile = await scraper.getProfile(username);

    // console.log({ profile })
    if (profile.followingCount === 0 || profile.friendsCount === 0) {
      console.log(`${username} RESTRICTED - could be a voluntary/involuntary unfollower`)
      return 'RESTRICTED - could be a voluntary/involuntary unfollower'
    } else {
      console.log(`${username} NOT_PURGED - is a voluntary unfollower`)
      return 'NOT_PURGED - is a voluntary unfollower'
    }
  } catch (e) {
    console.log(`${username} PURGED - could be a voluntary/involuntary unfollower`)
    return 'PURGED - could be a voluntary/involuntary unfollower'
  }
}

// async function playground() {

//   const scraper = new Scraper();
//   await scraper.login(process.env.TWITTER_USERNAME, process.env.TWITTER_PASSWORD);

//   const username = 'pseudokid'
//   await getCookies(scraper, process.env.TWITTER_USERNAME)

//   await purgedOrNotOrRestricted(scraper, 'elonmusk')
//   await purgedOrNotOrRestricted(scraper, 'elonmusk')
//   await purgedOrNotOrRestricted(scraper, 'elonmusk')
//   await purgedOrNotOrRestricted(scraper, 'elonmusk')
//   await purgedOrNotOrRestricted(scraper, 'elonmusk')
// }

// playground()

module.exports = {
  getCookies,
  getProfile,
  getFollowers,
  getFollowersPaged,
  getFollowing,
  gitPull,
  gitCommitAndPush,
  sendToTelegramChannel,
  runTwitterAgent,
  getTimeUntilNextCronRun,
  displayLiveTimerUntilNextCronRun,
  purgedOrNotOrRestricted,
  runStandalone
};