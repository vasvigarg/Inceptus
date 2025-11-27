import dotenv from "dotenv";
dotenv.config();
import express from "express";
import type { Request, Response } from "express";
import { GoogleGenAI, type Content } from "@google/genai";
import { BASE_PROMPT, getSystemPrompt } from "./prompts.js";
import { basePrompt as nodeBasePrompt } from "./defaults/node.js";
import { basePrompt as reactBasePrompt } from "./defaults/react.js";
import cors from "cors";

// Initialize the Gemini client.
// Note: Ensure GEMINI_API_KEY is set in your environment variables on Render
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error("GEMINI_API_KEY environment variable is not set");
}
const ai = new GoogleGenAI({ apiKey });
const app = express();
app.use(cors());
app.use(express.json());

// The model to use for all requests
const MODEL = "gemini-2.5-flash";

// --- Single-turn Classification Endpoint ---
app.post("/template", async (req: Request, res: Response): Promise<void> => {
  const prompt: string = req.body.prompt;

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      config: {
        maxOutputTokens: 1024,
        systemInstruction:
          "Return either node or react based on what do you think this project should be. Only return a single word either 'node' or 'react'. Do not return anything extra",
      },
    });

    console.log("Full Gemini Response:", JSON.stringify(response, null, 2));

    if (!response.text) {
       res.status(403).json({
        message: "Gemini model failed to provide a classification (react/node).",
      });
      return;
    }

    const answer = response.text.trim().toLowerCase();

    if (answer === "react") {
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
      message: `Model returned unexpected response: ${answer}`,
    });
  } catch (error) {
    console.error("Gemini API Error in /template:", error);
    res.status(500).json({ message: "An error occurred calling the Gemini API" });
  }
});

// --- Multi-turn Chat Endpoint ---
app.post("/chat", async (req: Request, res: Response): Promise<void> => {
  const messages: Content[] = req.body.messages;

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: messages,
      config: {
        maxOutputTokens: 8000,
        systemInstruction: getSystemPrompt(),
      },
    });

    if (!response.text) {
       res.status(500).json({
        response: "The AI response was blocked or empty. Please try again.",
      });
      return;
    }

    res.json({
      response: response.text,
    });
  } catch (error) {
    console.error("Gemini API Error in /chat:", error);
    res.status(500).json({ message: "An error occurred calling the Gemini API" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});