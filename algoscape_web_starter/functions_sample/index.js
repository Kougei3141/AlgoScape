const functions = require("firebase-functions");
const fetch = require("node-fetch"); // v2.x
const cors = require("cors")({ origin: true });
exports.api = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }
      const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
      if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: "API key missing on server" });
      }
      const { messages } = req.body || {};
      const r = await fetch("https://example.ai.endpoint/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GEMINI_API_KEY}`
        },
        body: JSON.stringify({ messages })
      });
      const data = await r.json();
      return res.status(200).json(data);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Server error" });
    }
  });
});
