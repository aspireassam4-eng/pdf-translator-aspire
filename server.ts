import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

// Use high-capacity JSON bodies for uploaded Base64 PDFs
app.use(express.json({ limit: "50mb" }));

// Lazy initialize Gemini Client to prevent crashing on load and show readable errors if not configured.
let aiClientInstance: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === "MY_GEMINI_API_KEY" || key.startsWith("AQ.")) {
    throw new Error(
      "GEMINI_API_KEY environment variable is not configured or is invalid. " +
      "Please configure your Gemini API Key (starts with 'AIzaSy') in your server's environment variables (e.g., Vercel Project Settings)."
    );
  }
  if (!aiClientInstance) {
    aiClientInstance = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClientInstance;
}

/**
 * Endpoint to parse a Base64 encoded PDF file and split it into pages using Gemini.
 */
app.post("/api/parse-pdf", async (req, res) => {
  try {
    const { file } = req.body;
    if (!file) {
      return res.status(400).json({ error: "No PDF file data provided" });
    }

    const ai = getAiClient();

    // Call Gemini 3.5 Flash to extract original English text page-by-page
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        {
          inlineData: {
            mimeType: "application/pdf",
            data: file,
          },
        },
        "You are a highly precise document text extractor. Read the attached PDF. Extract the full text of the PDF page-by-page. " +
        "Do NOT translate, do NOT summarize, do NOT omit anything, and do NOT add any conversational commentary. " +
        "Maintain all original paragraphs, lists, formatting, headings, and structures exactly. " +
        "Insert '---PAGE_SPLIT---' on a newline between each page."
      ],
      config: {
        temperature: 0.1,
      }
    });

    const rawText = response.text || "";

    let pages = rawText
      .split("---PAGE_SPLIT---")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    // Fallback if split fails or document is 1 page
    if (pages.length === 0 && rawText.trim().length > 0) {
      pages = [rawText.trim()];
    }

    res.json({
      totalPages: pages.length,
      pages: pages,
      info: { title: "Parsed PDF document" },
    });
  } catch (error: any) {
    console.error("PDF Parsing Error:", error);
    res.status(500).json({ error: "Failed to parse PDF document: " + error.message });
  }
});

/**
 * Endpoint to translate a segment of text into Assamese or Bodo.
 * Strictly adheres to the requirement: "Do not translate numerical values".
 */
app.post("/api/translate", async (req, res) => {
  try {
    const { text, targetLanguage } = req.body;

    if (!text || !targetLanguage) {
      return res.status(400).json({ error: "Missing text or targetLanguage" });
    }

    const languageName = targetLanguage === "assamese" ? "Assamese" : "Bodo";

    const systemInstruction = `You are a professional, 100% accurate translator specializing in translating English text into ${languageName}.
Your translation must be authentic, natural, and grammatically impeccable.

CRITICAL RULE FOR NUMERICAL VALUES:
- Absolutely DO NOT translate, convert, or transliterate any numerical values, numbers, digits, years, decimals, or counts.
- Keep all numerical characters and digits exactly as they appear in the source English text (e.g., "1", "25", "45.6", "10,000", "2026" must remain "1", "25", "45.6", "10,000", "2026" in the translated text). Do not use Assamese/Bodo script digits; write them in Western Arabic digits (0-9) exactly as provided.
- Keep mathematical symbols, percentages, and currencies coupled with numbers intact (e.g., "$100", "50%").

FORMATTING RULES:
- Preserve the exact layout, paragraphs, list structures, capitalization styles (for names/titles), and formatting of the source text.
- Do not add any conversational meta-commentary, introduction, or explanations. Only return the translated text.`;

    const ai = getAiClient();

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: text,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.1, // Low temperature for high precision and accuracy
      },
    });

    const translatedText = response.text || "";

    res.json({ translation: translatedText });
  } catch (error: any) {
    console.error("Translation Error:", error);
    res.status(500).json({ error: "Translation failed: " + error.message });
  }
});

// Configure Vite middleware in development, or serve built assets in production
async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

setupServer();
