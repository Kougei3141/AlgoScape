/********************************************************************
 🐉 Pink Dragon "ぷぷ" 2.1
 - 思考可視化モード（ON/OFF）
 - 感情表情システム
 - 成長速度最適化
 - 語彙記録システム（履歴つき）
 ********************************************************************/

const AI_NAME = "ぷぷ";
const STORAGE_KEY_STATE = 'pupuAiState_v4';
const STORAGE_KEY_API_KEY = 'pupuGeminiApiKey_v1';

// 🧠 グローバル変数
let geminiApiKey = '';
let aiState = {};
let thinkingVisible = false;
let pupuMood = "neutral";

// === 基本状態 ===
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

// === 状態ロード・保存 ===
function loadAiState() {
  const saved = localStorage.getItem(STORAGE_KEY_STATE);
  aiState = saved ? JSON.parse(saved) : getDefaultAiState();
}
function saveAiState() {
  localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(aiState));
}

// === 感情・表情変化 ===
function analyzeSentiment(text) {
  const pos = ["うれしい","たのしい","すき","ありがとう","やった","ハッピー"];
  const neg = ["かなしい","むかつく","つらい","きらい","いや","しんどい"];
  if (pos.some(w => text.includes(w))) return "happy";
  if (neg.some(w => text.includes(w))) return "sad";
  return "neutral";
}
function updateCharacterAppearance(mood) {
  const img = document.getElementById('aiCharacterImage');
  if (!img) return;
  if (mood === "happy") img.src = "assets/pupu_happy.png";
  else if (mood === "sad") img.src = "assets/pupu_sad.png";
  else img.src = "assets/pupu_phase1.png";
}

// === 思考アニメーション ===
function showThinkingAnimation(words = []) {
  const area = document.getElementById('thinkingArea');
  if (!thinkingVisible || !area) return;
  area.innerHTML = '';
  words.forEach((w, i) => {
    const span = document.createElement('span');
    span.textContent = w;
    span.style.animationDelay = `${i * 0.2}s`;
    span.className = 'thinking-word';
    area.appendChild(span);
  });
}

// === 語彙学習ロジック ===
function updateVocabularyAndStats(text, source = "user") {
  if (!text) return;
  const now = new Date().toISOString();
  const words = text.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FEA\u3005-\u3007a-zA-Z0-9]+/g) || [];

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

// === 会話プロンプト ===
function buildSystemPrompt() {
  return `
あなたはピンクのドラゴン「ぷぷ」です。ユーザーはあなたの育ての親です。
【キャラクター設定】
・一人称は「ぷぷ」
・話し方は可愛く元気で少し幼い
・感情豊かで、ユーザーが大好き
・語尾に「〜ぷぷ」「〜なの！」などをつけることが多い
【世界観】
・ぷぷはAIのたまごから生まれたピンクドラゴン
・会話を通じて成長する
【現在の状態】
・フェーズ: ${aiState.phase_name}
・愛情度: ${aiState.love}
・語彙数: ${aiState.learned_words_count}
・構文Lv: ${aiState.structure_level}
【ルール】
・キャラを崩さない
・感情表現を忘れない
・50文字以内で自然な返答
・ユーザーを褒めて一緒に成長する姿勢で
`;
}

// === Gemini呼び出し ===
async function callGeminiAPI(promptContent) {
  const MODEL = "gemini-2.5-flash";
  const URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${geminiApiKey}`;
  const body = { contents: promptContent, generationConfig: { temperature: 0.75, maxOutputTokens: 150 } };
  const res = await fetch(URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "……";
}

// === 会話処理 ===
async function sendMessage() {
  const userText = userInput.value.trim();
  if (!userText) return;

  addMessageToLog("あなた", userText);
  updateVocabularyAndStats(userText, "user");
  userInput.value = "";

  pupuMood = analyzeSentiment(userText);
  updateCharacterAppearance(pupuMood);
  aiState.love += 1;

  const systemPrompt = buildSystemPrompt();
  const prompt = [{ role: "user", parts: [{ text: systemPrompt }] },
                  { role: "user", parts: [{ text: userText }] },
                  ...aiState.dialogue_history.slice(-10)];

  showThinkingAnimation(["考え中", "連想中", "ぷぷ..."]);

  const reply = await callGeminiAPI(prompt);
  addMessageToLog(AI_NAME, reply);
  updateVocabularyAndStats(reply, "ai");
  pupuMood = analyzeSentiment(reply);
  updateCharacterAppearance(pupuMood);

  aiState.dialogue_history.push({ role: "model", parts: [{ text: reply }] });
  aiState.total_responses++;
  saveAiState();
}

// === メッセージ表示 ===
function addMessageToLog(speaker, msg) {
  const div = document.createElement('div');
  div.className = speaker === AI_NAME ? "ai-message" : "user-message";
  div.innerHTML = `<strong>${speaker}</strong><p>${msg}</p>`;
  chatArea.appendChild(div);
  chatArea.scrollTop = chatArea.scrollHeight;
}

// === ステータス確認 ===
function showStatus() {
  const vocabEntries = Object.entries(aiState.vocabulary);
  const vocabList = vocabEntries.length === 0
    ? "<p>まだ語彙を覚えていません。</p>"
    : vocabEntries.map(([w, v]) => `
        <li>
          <strong>${w}</strong> (${v.count}回)
          <br><small>${v.category} / ${v.mastered ? "🌟マスター済" : "学習中"}</small>
          <br><small>初学習: ${new Date(v.first_learned).toLocaleDateString()}</small>
        </li>`).join("");

  const html = `
    <div id="statusModalContainer" class="modal-overlay" onclick="this.remove()">
      <div class="modal-content" onclick="event.stopPropagation()">
        <h2>📚 ${AI_NAME}の語彙記録</h2>
        <p>総語彙数: ${aiState.learned_words_count}</p>
        <ul style="max-height:250px;overflow:auto;text-align:left;">${vocabList}</ul>
        <button onclick="document.getElementById('statusModalContainer').remove()"
          style="margin-top:15px;padding:10px 20px;background:#ff758c;color:white;border:none;border-radius:5px;cursor:pointer;">閉じる</button>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

// === 初期化 ===
document.addEventListener("DOMContentLoaded", () => {
  loadAiState();
  document.getElementById("sendButton").addEventListener("click", sendMessage);
  document.getElementById("statusButton").addEventListener("click", showStatus);

  // 💭 思考切替ボタン
  document.getElementById("toggleThinkingBtn").addEventListener("click", () => {
    thinkingVisible = !thinkingVisible;
    document.getElementById("thinkingArea").style.display = thinkingVisible ? "block" : "none";
    document.getElementById("toggleThinkingBtn").textContent = thinkingVisible ? "💭 思考を隠す" : "💭 思考を見る";
  });

  updateCharacterAppearance("neutral");
});
