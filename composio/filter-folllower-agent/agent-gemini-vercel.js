// based on https://docs.composio.dev/patterns/tools/build-tools/custom-action-without-auth 
//  and https://docs.composio.dev/javascript/vercel#using-composio-with-vercel-ai-sdk

import { VercelAIToolSet } from "composio-core";
import dotenv from "dotenv";
import { runTwitterAgent } from "../../twitter-clients/filter-follower-client/index.js";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { z } from "zod";

dotenv.config();

const toolset = new VercelAIToolSet({
  apiKey: process.env.COMPOSIO_API_KEY
});

await toolset.createAction({
  actionName: "myCustomAction",
  description: "custom action that runs a custom agent",
  inputParams: z.object({
    username: z.string()
  }),
  callback: async (inputParams) => {
    const username = inputParams.username;
    const response = `Filtering followers for: ${username}`;

    console.log('RUNNING Twitter follower filter agent...');
    await runTwitterAgent(username);
    console.log('Agent is done.');

    return response;
  }
});

const tools = await toolset.getTools({
  actions: ["myCustomAction"]
});

const instruction = `Username is '${process.env.TWITTER_ACCOUNT_TO_TRACK_UNFOLLOWERS}'`;

const output = await generateText({
  model: google("gemini-2.0-flash-exp"),
  streamText: false,
  tools,
  prompt: instruction,
  maxToolRoundtrips: 5,
});

console.log(output.text);
