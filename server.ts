import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Let's support larger base64 payloads for multi-page invoices
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Helper to load Gemini API key resiliently with logs
  const getGeminiApiKey = () => {
    const key = process.env.GEMINI_API_KEY || process.env.API_KEY || "";
    console.log("[Gemini API Resolver] Key detected:", key ? "YES (masked)" : "NO");
    return key;
  };

  // API Route: Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // API Route: Extract Invoice Data
  app.post("/api/gemini/extract-invoice", async (req, res) => {
    console.log("[Gemini API Endpoint] Invoice extraction requested");
    try {
      const apiKey = getGeminiApiKey();
      if (!apiKey) {
        console.error("[Gemini API Endpoint] Extraction blocked: GEMINI_API_KEY is not defined.");
        return res.status(400).json({
          success: false,
          error: "Credentials Error: GEMINI_API_KEY is not configured in the system environment. Please navigate to Settings > Secrets in Google AI Studio to configure your API key."
        });
      }

      const { files } = req.body;
      if (!files || !Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ success: false, error: "No document fragments submitted for parsing." });
      }

      console.log(`[Gemini API Endpoint] Analyzing ${files.length} pages...`);

      // Initialize Gemini Client Lazily (avoids crash on startup if missing)
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const fileParts = files.map((f: any) => ({
        inlineData: {
          data: f.data,
          mimeType: f.mimeType,
        },
      }));

      const prompt = `
        Analyze these car spare parts invoice pages. 
        
        IMPORTANT FILTERING RULES:
        1. ONLY PROCESS THE ORIGINAL COPY: Invoices often contain 'Original', 'Duplicate', 'Triplicate', and 'Quadruplicate' pages. 
        2. You MUST ONLY extract data from the page(s) explicitly marked as "ORIGINAL" or "ORIGINAL FOR RECIPIENT/BUYER".
        3. IGNORE ALL OTHER COPIES: Do not process or extract items from pages marked as 'DUPLICATE', 'TRIPLICATE', 'QUADRUPLICATE', 'EXTRA COPY', 'TRANSPORT COPY', or 'OFFICE COPY'.
        4. CONSOLIDATE: If the "Original" invoice itself spans multiple pages (e.g. Page 1 of 2, Page 2 of 2), extract and combine all items from those original pages.
        5. DE-DUPLICATION: If the user provides multiple images of the same "Original" page, only extract those items once.

        CRITICAL VALIDATION RULES FOR METADATA:
        - INVOICE DATE VS INVOICE NUMBER: Do NOT mistake the Invoice Date for the Invoice Number. The Invoice/Bill Number MUST NOT be a date (e.g., if you extract a date value like "29/01/2026", that is NOT the invoice number).
        - If the invoice number cannot be confidently found, set it to null or empty string, but NEVER populate it with the invoice date or invoice timestamp.

        DATA TO EXTRACT:
        1. Identify the Dealer/Vendor Name (The company selling the parts).
        2. Identify the Invoice Date.
        3. Identify the Invoice Number/Bill Number (This is usually labeled 'Invoice No.', 'Inv No.', 'Bill No.', 'Tax Invoice No.' etc., e.g. "INV-2024-001" or "GST/1293").
        4. Extract line items strictly from the ORIGINAL pages with these fields:
           - Part Number (alphanumeric SKU)
           - Part Name/Description (the full descriptive name of the part)
           - Quantity (Qty)
           - MRP (Maximum Retail Price before discount)
           - B.DC % (Basic Discount percentage, typically around 12%)
           - Printed Net Unit Price (Final price for one unit shown on the bill)

        Ensure numerical values are clean numbers. 
        Return the data strictly as a JSON object.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: { parts: [...fileParts, { text: prompt }] },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              dealerName: { type: Type.STRING, description: "Name of the supplier/dealer" },
              invoiceDate: { type: Type.STRING, description: "Date on the invoice" },
              invoiceNumber: { type: Type.STRING, description: "The unique invoice number or bill number (e.g. GST-1293). This MUST NOT be a date format like 'DD/MM/YYYY'." },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    partNumber: { type: Type.STRING },
                    name: { type: Type.STRING, description: "Descriptive name of the part" },
                    quantity: { type: Type.NUMBER },
                    mrp: { type: Type.NUMBER },
                    discountPercent: { type: Type.NUMBER, description: "B.DC percentage" },
                    printedUnitPrice: { type: Type.NUMBER, description: "The unit price shown on the bill after discount" }
                  },
                  required: ["partNumber", "name", "quantity", "mrp", "discountPercent", "printedUnitPrice"]
                }
              }
            },
            required: ["dealerName", "items"]
          }
        }
      });

      console.log("[Gemini API Endpoint] Invoice extraction succeeded.");
      const cleanedText = response.text || "{}";
      const parsedData = JSON.parse(cleanedText);
      res.json({ success: true, data: parsedData });
    } catch (err: any) {
      console.error("[Gemini API Endpoint] Invoice extraction failed:", err);
      res.status(500).json({
        success: false,
        error: err.message || "Failed to scan the invoice. Kindly verify the quality of your uploaded documents and Gemini key state."
      });
    }
  });

  // API Route: Generate Stock Insights
  app.post("/api/gemini/insights", async (req, res) => {
    console.log("[Gemini API Endpoint] Stock insights requested");
    try {
      const apiKey = getGeminiApiKey();
      if (!apiKey) {
        console.error("[Gemini API Endpoint] Insights blocked: GEMINI_API_KEY is not defined.");
        return res.status(400).json({
          success: false,
          error: "Credentials Error: GEMINI_API_KEY is not configured in the system environment. Please set GEMINI_API_KEY in Settings > Secrets."
        });
      }

      const { inventory } = req.body;
      if (!inventory || !Array.isArray(inventory)) {
        return res.status(400).json({ success: false, error: "Inventory list array is required." });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const summary = inventory.map(i => 
        `- ${i.partNumber} (${i.brand}): ${i.quantity} units (Threshold: ${i.minStockThreshold})`
      ).join('\n');

      const prompt = `
        You are an inventory analyst for a car spare parts shop named "Sparezy".
        We stock Hyundai and Mahindra parts.
        
        Here is the current stock list status:
        ${summary}

        Please provide a concise strategic summary for the Business Owner.
        1. Identify critical shortages (Zero stock).
        2. Highlight low stock risks.
        3. Suggest which brand needs more immediate attention.
        4. Provide a short "Health Score" of the inventory out of 10.
        
        Keep it professional, actionable, and under 200 words.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
      });

      console.log("[Gemini API Endpoint] Insights generated successfully.");
      res.json({ success: true, text: response.text || "No insights generated." });
    } catch (err: any) {
      console.error("[Gemini API Endpoint] Stock insights failed:", err);
      res.status(500).json({
        success: false,
        error: err.message || "Failed to generate stock insights. Please ensure your Gemini key is valid and configured."
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Full-stack Server] Running on http://localhost:${PORT}`);
  });
}

startServer();
