require('dotenv').config({
  path: '../twitter-clients/unfollower-client/.env',
  debug: true
});
const { execSync } = require('child_process');
const { Scraper } = require('agent-twitter-client');
const fs = require('fs');
const axios = require('axios');
// const cron = require('node-cron');
const readline = require('readline');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Ensure base directory exists
const BASE_PATH = process.env.BASE_PATH || './';
if (!fs.existsSync(BASE_PATH)) {
  fs.mkdirSync(BASE_PATH, { recursive: true });
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

async function getProfile(scraper, username) {
  return await scraper.getProfile(username)
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
    existingData.count = existingData.followers.length;

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

function compareFollowers(scraper, username) {
  const oldFilePath = path.join(BASE_PATH, 'followers', `${username}-copy.json`);
  const newFilePath = path.join(BASE_PATH, 'followers', `${username}.json`);

  if (!fs.existsSync(oldFilePath) || !fs.existsSync(newFilePath)) {
    console.log("One or both of the required files do not exist.");
    return;
  }

  const oldFileContent = fs.readFileSync(oldFilePath, 'utf8');
  const newFileContent = fs.readFileSync(newFilePath, 'utf8');

  const oldData = JSON.parse(oldFileContent);
  const newData = JSON.parse(newFileContent);

  const oldFollowers = new Set(oldData.followers);
  const newFollowers = new Set(newData.followers);

  const unfollowers = [...oldFollowers].filter(follower => !newFollowers.has(follower));

  if (unfollowers.length > 0) {
    console.log(`Unfollowers as of: ${new Date().toLocaleString()}`);
    unfollowers.forEach(async unfollower => {
      console.log(`https://x.com/${unfollower}`);

      const doubleCheck = await purgedOrNotOrRestricted(scraper, unfollower)

      await sendToTelegramChannel(`
New unfollower / changed username / bot purged: @${unfollower}

@${unfollower} is ${doubleCheck}

Profile Link: https://x.com/${unfollower}

(${new Date().toLocaleString('en-US', { timeZone: 'Asia/Singapore' })})
`);
    });
  } else {
    console.log("No unfollowers found.");
    sendToTelegramChannel(`No unfollowers today. (${new Date().toLocaleString('en-US', { timeZone: 'Asia/Singapore' })})`)
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

async function runTwitterAgent(username = 'pseudokid') {

  const scraper = new Scraper();
  console.log(`logging in as ${process.env.TWITTER_USERNAME}`);
  await scraper.login(process.env.TWITTER_USERNAME, process.env.TWITTER_PASSWORD);

  // await getCookies(scraper, process.env.TWITTER_USERNAME)

  const profile = await getProfile(scraper, username)

  // await gitPull()

  await getFollowersPaged(scraper, username, profile?.userId, 0, null)
  // await getFollowers(scraper, username, profile?.userId)

  compareFollowers(scraper, username)

  // await gitCommitAndPush()
}

// script entry point - start

async function runStandalone() {

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
  compareFollowers,
  gitPull,
  gitCommitAndPush,
  sendToTelegramChannel,
  runTwitterAgent,
  getTimeUntilNextCronRun,
  displayLiveTimerUntilNextCronRun,
  purgedOrNotOrRestricted,
  runStandalone
};