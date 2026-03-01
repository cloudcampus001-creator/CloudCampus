/* src/lib/gemini.js */
import { GoogleGenerativeAI } from "@google/generative-ai";

// 1. Securely access the API key
// We will set this up in Step 4. 
// If you just want to test quickly, you can paste your key string here, but .env is better.
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY; 

let chatSession = null;

export const initializeGemini = async () => {
  if (!API_KEY) {
    throw new Error("Gemini API Key is missing. Please check your .env file.");
  }

  try {
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // 2. Initialize the chat with a specific persona for Cloud Campus
    chatSession = model.startChat({
      history: [
        {
          role: "user",
          parts: [{ text: "You are the AI assistant for 'Cloud Campus', a school management platform. You are helpful, polite, and focused on education. Keep answers concise." }],
        },
        {
          role: "model",
          parts: [{ text: "Understood. I am ready to assist students, teachers, and parents with their educational needs on Cloud Campus." }],
        },
      ],
      generationConfig: {
        maxOutputTokens: 1000,
      },
    });

    return true;
  } catch (error) {
    console.error("Gemini Initialization Error:", error);
    throw error;
  }
};

export const sendMessageToGemini = async (userMessage) => {
  if (!chatSession) {
    await initializeGemini();
  }

  try {
    const result = await chatSession.sendMessage(userMessage);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Gemini Send Error:", error);
    throw new Error(error.message || "Failed to get response from AI.");
  }
};