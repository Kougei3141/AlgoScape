/**********************************************************************
 * 🐉 Pupu AI Main Script - AlgoScape Project
 * index.html 専用（forest, lab, thinking は pupu_core.js を共有）
 **********************************************************************/

// --- グローバル定数 ---
const AI_NAME = "ぷぷ";
const STORAGE_KEY_STATE = "pupuAiState_v2";
const STORAGE_KEY_API_KEY = "pupuGeminiApiKey_v1";
const GAME_NAME_ERRAND = "アルゴスケイプ";
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models/";

// --- グローバル変数 ---
let geminiApiKey = "";
let aiState = {};
let currentGame = null;
let speechBubbleTimeout = null;
let gameTimer = null;
let gameScore = 0;
let gameTimeLeft = 0;

// --- ページ連携 ---
function navigateTo(page) {
  saveAiState();
  location.href = page;
}

// --- 状態ロード／セーブ ---
function loadAiState() {
  const saved = localStorage.getItem(STORAGE_KEY_STATE);
  if (saved) {
    try {
      aiState = JSON.parse(saved);
    } catch (e) {
      console.error("状態の読み込みエラー:", e);
      aiState = getDefaultAiState();
    }
  } else {
    aiState = getDefaultAiState();
  }
}
function getDefaultAiState() {
  return {
    phase_name: "たまごドラゴン",
    phase_icon: "🥚",
    vocabulary: {},
    learned_words_count: 0,
    dialogue_history: [],
    total_responses: 0,
    structure_level: 1,
    love: 0
  };
}
function saveAiState() {
  localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(aiState));
}

// --- APIキー管理 ---
function loadApiKey() {
  const key = localStorage.getItem(STORAGE_KEY_API_KEY);
  if (key) {
    geminiApiKey = key;
    document.getElementById("apiSetup").classList.remove("show");
    userInput.disabled = false;
    sendButton.disabled = false;
  } else {
    document.getElementById("apiSetup").classList.add("show");
    userInput.disabled = true;
    sendButton.disabled = true;
  }
}
function saveApiKey() {
  const input = document.getElementById("apiKeyInput").value.trim();
  if (input) {
    geminiApiKey = input;
    localStorage.setItem(STORAGE_KEY_API_KEY, input);
    document.getElementById("apiSetup").classList.remove("show");
    userInput.disabled = false;
    sendButton.disabled = false;
    addMessageToLog("システム", "APIキーが保存されました。会話を開始できます。", "system-message");
  } else {
    addMessageToLog("システム", "APIキーを入力してください。", "system-error");
  }
}

// --- Gemini API呼び出し ---
async function callGeminiAPI(prompt, temperature = 0.8) {
  if (!geminiApiKey) throw new Error("APIキーが設定されていません。");
  const response = await fetch(
    `${GEMINI_API_BASE}${GEMINI_MODEL}:generateContent?key=${geminiApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: Array.isArray(prompt)
          ? prompt
          : [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature, maxOutputTokens: 300 }
      })
    }
  );
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("API応答が空です");
  return text.trim();
}

// --- 会話処理 ---
async function sendMessage() {
  const text = userInput.value.trim();
  if (!text) return;
  if (!geminiApiKey) {
    addMessageToLog("システム", "APIキーを設定してください。", "system-error");
    return;
  }

  addMessageToLog("あなた", text);
  aiState.dialogue_history.push({ role: "user", parts: [{ text }] });
  aiState.love += 1;
  updateVocabulary(text, "user");
  saveAiState();

  sendButton.disabled = true;
  userInput.disabled = true;
  aiSpeechText.textContent = "ぷぷ考え中… 🤔";
  aiSpeechBubble.style.display = "flex";

  const prompt = `
あなたはピンクのドラゴン「${AI_NAME}」。
現在のフェーズは「${aiState.phase_name}」。
愛情度は ${aiState.love}、語彙数は ${aiState.learned_words_count}語です。
ユーザーと会話を続けながら、キャラを維持しつつ自然に応答してください。
${AI_NAME}らしく、優しく、可愛く返事して。
`;

  try {
    const reply = await callGeminiAPI([
      { role: "user", parts: [{ text: prompt }] },
      ...aiState.dialogue_history
    ]);
    addMessageToLog(AI_NAME, reply);
    aiState.dialogue_history.push({ role: "model", parts: [{ text: reply }] });
    updateVocabulary(reply, "ai");
    saveAiState();
  } catch (e) {
    addMessageToLog("システム", "エラー: " + e.message, "system-error");
  } finally {
    sendButton.disabled = false;
    userInput.disabled = false;
    aiSpeechBubble.style.display = "none";
    updateDisplay();
  }
}

// --- 語彙更新 ---
function updateVocabulary(text, speaker) {
  const words = text.match(/[\u3040-\u30FF\u4E00-\u9FFF]+/g) || [];
  words.forEach(w => {
    if (!aiState.vocabulary[w]) aiState.vocabulary[w] = { count: 0, mastered: false };
    aiState.vocabulary[w].count++;
    if (aiState.vocabulary[w].count >= 3) aiState.vocabulary[w].mastered = true;
  });
  aiState.learned_words_count = Object.keys(aiState.vocabulary).length;
  if (speaker === "ai") aiState.total_responses++;
}

// --- UI更新 ---
function updateDisplay() {
  document.getElementById("phaseIcon").textContent = aiState.phase_icon;
  document.getElementById("phaseName").textContent = aiState.phase_name;
  document.getElementById("vocabCount").textContent = aiState.learned_words_count;
  document.getElementById("loveCount").textContent = aiState.love;
  document.getElementById("responseCount").textContent = aiState.total_responses;

  const progressFill = document.getElementById("progressFill");
  const percent = Math.min(100, (aiState.learned_words_count / 100) * 100);
  progressFill.style.width = `${percent}%`;
}

// --- メッセージ描画 ---
function addMessageToLog(speaker, message, type = "") {
  const div = document.createElement("div");
  div.className =
    type || (speaker === "あなた" ? "message user-message" : "message ai-message");
  div.innerHTML = `<strong>${speaker}</strong><p>${message.replace(/\n/g, "<br>")}</p>`;
  chatArea.appendChild(div);
  chatArea.scrollTop = chatArea.scrollHeight;
}

// --- 初期化 ---
document.addEventListener("DOMContentLoaded", () => {
  chatArea = document.getElementById("chatArea");
  userInput = document.getElementById("userInput");
  sendButton = document.getElementById("sendButton");
  aiSpeechBubble = document.getElementById("aiSpeechBubble");
  aiSpeechText = document.getElementById("aiSpeechText");

  loadAiState();
  loadApiKey();
  updateDisplay();

  sendButton.onclick = sendMessage;
  document.getElementById("saveApiKeyBtn").onclick = saveApiKey;

  // 🔄 ページ遷移ボタン
  document.getElementById("toThinking").onclick = () => navigateTo("thinking.html");
  document.getElementById("toForest").onclick = () => navigateTo("forest.html");
  document.getElementById("toLab").onclick = () => navigateTo("lab.html");
});
