# This repo demonstrates how to use [ai6z/agent-twitter-client](https://github.com/ai16z/agent-twitter-client) in different agentic frameworks

The idea is to demonstrate how [ai6z/agent-twitter-client](https://github.com/ai16z/agent-twitter-client), an unofficial Twitter client, can be used in different agentic frameworks ([Composio](https://composio.dev/), [CrewAI](https://www.crewai.com/), etc.)

## Table of Contents

1. [Use Cases](#use-cases)
2. [DO THIS FIRST ⚠️](#do-this-first-️)
3. [Agent Demos (with and w/o agentic frameworks)](#agent-demos-with-and-wo-agentic-frameworks)

## Use Cases

- Tweet search
- User lookup
- [Unfollower tracking + Telegram bot notifs](/twitter-clients/unfollower-client/)

## DO THIS FIRST ⚠️:

We need to setup [ai6z/agent-twitter-client](https://github.com/ai16z/agent-twitter-client) first

### agent-twitter-client setup

1. Make sure the current working directory is on `/twitter-clients/unfollower-client`

2. Install dependencies

```javascript
npm i
```

## Agent Demos (with and w/o agentic frameworks)

1. [Standalone + cron (no agentic framework)](#running-agent-without-agentic-framework)
2. [Composio](#using-ai6zagent-twitter-client-in-composio)
3. [CrewAI (🚧 WIP 🚧)](#using-ai6zagent-twitter-client-in-crewai)

### Running agent without agentic framework

#### Setup (skip this if you accomplished [agent-twitter-client setup](#agent-twitter-client-setup) already)

1. Make sure the current working directory is on `/twitter-clients/unfollower-client`

2. Install dependencies

```javascript
npm i
```

3. Make sure `/twitter-clients/unfollower-client/.env` is populated

```
# /twitter-clients/unfollower-client/.env

TWITTER_USERNAME=    # Account username
TWITTER_PASSWORD=""    # Account password
TWITTER_EMAIL=       # Account email
PROXY_URL=           # HTTP(s) proxy for requests (necessary for browsers)

# Twitter API v2 credentials for tweet and poll functionality
TWITTER_API_KEY=               # Twitter API Key
TWITTER_API_SECRET_KEY=        # Twitter API Secret Key
TWITTER_ACCESS_TOKEN=          # Access Token for Twitter API v2
TWITTER_ACCESS_TOKEN_SECRET=   # Access Token Secret for Twitter API v2

TELEGRAM_BOT_NEWTWITTERFOLLOWERSBOT_TOKEN=
TELEGRAM_BOT_NEWTWITTERFOLLOWERSBOT_CHATID=
TELEGRAM_BOT_AUTOREPLIERTWITTERBOT_TOKEN=

BASE_PATH=../twitter-clients/unfollower-client/    # Base directory for storing data files
```

#### To run agent as standalone

```javascript
node run-standalone.js
```

### Using [ai6z/agent-twitter-client](https://github.com/ai16z/agent-twitter-client) in Composio

#### To set up Composio for this project:

1. Make sure the current working directory is on `/composio` by running

```javascript
cd composio
```

2. Install dependencies

```javascript
npm i
```

3. Make sure `/composio/.env` is populated

```
# /composio/.env

COMPOSIO_API_KEY=XXX # required

GOOGLE_GENERATIVE_AI_API_KEY=XXX # populate when using Google Gemini via Vercel AI Toolset

OPENAI_API_KEY=sk-proj-XXX # populate applies when using OpenAI via Open AI Toolset / Langchain Toolset

TWITTER_ACCOUNT_TO_TRACK_UNFOLLOWERS=pseudokid # or your Twitter username
```

#### To run agents using Composio

1. Agent demo using OpenAI (Open AI chat client and Open AI Toolset) - _based on https://docs.composio.dev/patterns/tools/build-tools/custom-action-without-auth_

```javascript
node agent-openai.js
```

2. Agent demo using Google Gemini and Vercel AI SDK (Google Gemini and Vercel AI Toolset)

```javascript
node agent-gemini-vercel.js
```

### Using [ai6z/agent-twitter-client](https://github.com/ai16z/agent-twitter-client) in CrewAI

🚧 WIP (contributions are welcome) 🚧
