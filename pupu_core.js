/********************************************************************
 🧩 Pupu Core Shared Module (v1)
 全ページ共通でぷぷの状態・語彙・APIキーを扱う
 ********************************************************************/

// --- 定数 ---
const AI_NAME = "ぷぷ";
const STORAGE_KEY_STATE = "pupuAiState_v4";
const STORAGE_KEY_API_KEY = "pupuGeminiApiKey_v1";

// --- 変数 ---
let aiState = {};
let geminiApiKey = "";

// --- デフォルト状態 ---
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

// --- 状態読み込み・保存 ---
function loadAiState() {
  const saved = localStorage.getItem(STORAGE_KEY_STATE);
  aiState = saved ? JSON.parse(saved) : getDefaultAiState();
}
function saveAiState() {
  localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(aiState));
}
function resetAiState() {
  aiState = getDefaultAiState();
  saveAiState();
}

// --- APIキー管理 ---
function loadApiKey() {
  const saved = localStorage.getItem(STORAGE_KEY_API_KEY);
  geminiApiKey = saved || "";
  return geminiApiKey;
}
function saveApiKey(key) {
  geminiApiKey = key;
  localStorage.setItem(STORAGE_KEY_API_KEY, key);
}
function clearApiKey() {
  localStorage.removeItem(STORAGE_KEY_API_KEY);
  geminiApiKey = "";
}

// --- 語彙登録ヘルパー ---
function updateVocabulary(text, source = "user") {
  if (!text) return;
  const now = new Date().toISOString();
  const words = text.match(/[\u3040-\u9FFF\u3040-\u309F\u30A0-\u30FFa-zA-Z0-9]+/g) || [];

  for (const word of words) {
    if (!aiState.vocabulary[word]) {
      aiState.vocabulary[word] = {
        count: 1,
        mastered: false,
        category: source,
        first_learned: now,
        last_used: now
      };
    } else {
      aiState.vocabulary[word].count++;
      aiState.vocabulary[word].last_used = now;
    }
    if (aiState.vocabulary[word].count >= 3) aiState.vocabulary[word].mastered = true;
  }

  aiState.learned_words_count = Object.keys(aiState.vocabulary).length;
  saveAiState();
}

// --- 感情判定 ---
function analyzeSentiment(text) {
  const pos = ["うれしい","たのしい","すき","ありがとう","やった","ハッピー"];
  const neg = ["かなしい","むかつく","つらい","きらい","いや","しんどい"];
  if (pos.some(w => text.includes(w))) return "happy";
  if (neg.some(w => text.includes(w))) return "sad";
  return "neutral";
}

// --- 共有初期化 ---
function initPupuCore() {
  loadAiState();
  loadApiKey();
  console.log("✅ Pupu Core initialized", aiState);
}

// --- 共通関数をグローバルに展開 ---
window.PupuCore = {
  aiState,
  getDefaultAiState,
  loadAiState,
  saveAiState,
  resetAiState,
  loadApiKey,
  saveApiKey,
  clearApiKey,
  updateVocabulary,
  analyzeSentiment,
  initPupuCore,
  AI_NAME
};
