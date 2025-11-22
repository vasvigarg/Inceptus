import dotenv from "dotenv";
dotenv.config();
import express from "express";
import { GoogleGenAI, type Content } from "@google/genai";
import { BASE_PROMPT, getSystemPrompt } from "./prompts.js";
import { basePrompt as nodeBasePrompt } from "./defaults/node.js";
import { basePrompt as reactBasePrompt } from "./defaults/react.js";
import cors from "cors";

// Initialize the Gemini client.
const ai = new GoogleGenAI({});
const app = express();
app.use(cors());
app.use(express.json());

// The model to use for all requests
const MODEL = "gemini-2.5-flash";

// --- Single-turn Classification Endpoint ---
// Purpose: Classifies the project type ('node' or 'react') based on the prompt.
app.post("/template", async (req, res) => {
  const prompt: string = req.body.prompt;

  try {
    const response = await ai.models.generateContent({
      model: MODEL, // The prompt is the only content for this request
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      config: {
        maxOutputTokens: 1024, // System instruction enforces a single, specific word output
        systemInstruction:
          "Return either node or react based on what do you think this project should be. Only return a single word either 'node' or 'react'. Do not return anything extra",
      },
    });

    console.log("Full Gemini Response:", JSON.stringify(response, null, 2));

    // Ensure response.text exists before using it
    if (!response.text) {
      return res.status(403).json({
        message:
          "Gemini model failed to provide a classification (react/node).",
      });
    }

    // Extract and sanitize the single-word answer
    const answer = response.text.trim().toLowerCase();

    if (answer == "react") {
      res.json({
        prompts: [
          BASE_PROMPT,
          `Here is an artifact that contains all files of the project visible to you.\nConsider the contents of ALL files in the project.\n\n${reactBasePrompt}\n\nHere is a list of files that exist on the file system but are not being shown to you:\n\n - .gitignore\n - package-lock.json\n`,
        ],
        uiPrompts: [reactBasePrompt],
      });
      return;
    }

    if (answer === "node") {
      res.json({
        prompts: [
          `Here is an artifact that contains all files of the project visible to you.\nConsider the contents of ALL files in the project.\n\n${reactBasePrompt}\n\nHere is a list of files that exist on the file system but are not being shown to you:\n\n - .gitignore\n - package-lock.json\n`,
        ],
        uiPrompts: [nodeBasePrompt],
      });
      return;
    }

    res.status(403).json({
      message: `Model returned unexpected response: ${response.text}`,
    });
  } catch (error) {
    console.error("Gemini API Error in /template:", error);
    res
      .status(500)
      .json({ message: "An error occurred calling the Gemini API" });
  }
});

// --- Multi-turn Chat Endpoint ---
// Purpose: Handles a full conversation with chat history included in the `messages` body.
app.post("/chat", async (req, res) => {
  // We expect the incoming messages to already be in the Gemini 'Content[]' format
  const messages: Content[] = req.body.messages;

  try {
    const response = await ai.models.generateContent({
      model: MODEL, // The history is passed directly as contents
      contents: messages,
      config: {
        maxOutputTokens: 8000,
        systemInstruction: getSystemPrompt(),
      },
    });

    // Ensure response.text exists before returning
    if (!response.text) {
      return res.status(500).json({
        response: "The AI response was blocked or empty. Please try again.",
      });
    }

    res.json({
      // Return the plain text response
      response: response.text,
    });
  } catch (error) {
    console.error("Gemini API Error in /chat:", error);
    res
      .status(500)
      .json({ message: "An error occurred calling the Gemini API" });
  }
});

app.listen(3000, () => {
  console.log("Server listening on port 3000");
});
