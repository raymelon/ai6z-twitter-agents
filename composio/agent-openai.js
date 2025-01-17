// based on https://docs.composio.dev/patterns/tools/build-tools/custom-action-without-auth

import { OpenAIToolSet } from "composio-core";
import dotenv from "dotenv";
import { runTwitterAgent } from "../twitter-clients/unfollower-client/index.js";
import { OpenAI } from "openai";
import { z } from "zod";

dotenv.config();

const openai_client = new OpenAI();
const toolset = new OpenAIToolSet({
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
    const response = `Checking unfollowers for: ${username}`;

    console.log('RUNNING Twitter unfollower tracker agent...');
    await runTwitterAgent(username);
    console.log('Agent is done.');

    return response;
  }
});

const tools = await toolset.getTools({
  actions: ["myCustomAction"]
});

const instruction = `Username is '${process.env.TWITTER_ACCOUNT_TO_TRACK_UNFOLLOWERS}'`;

const response = await openai_client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: instruction }],
  tools: tools,
  tool_choice: "auto",
});

const result = await toolset.handleToolCall(response);
console.log(result);
