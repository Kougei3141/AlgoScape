// --- グローバル定数 ---
const AI_NAME = "ぷぷ";
const STORAGE_KEY_STATE = 'pupuAiState_v3'; // v2→v3: traits/xp/学習可視化を導入
const STORAGE_KEY_API_KEY = 'pupuGeminiApiKey_v1';
const GAME_NAME_ERRAND = "アルゴスケイプ（強化学習ごっこ）"; // 教師なしじゃなく“報酬で学ぶ”を可視化

// --- グローバル変数 ---
let geminiApiKey = '';
let aiState = {}; // 初期化は initialize で
let speechBubbleTimeout = null;
let currentGame = null; // 'tokenize', 'errand', 'shiritori'
let gameTimer = null;
let gameScore = 0;
let gameTimeLeft = 0;
let shiritoriCurrentWordForDisplay = "しりとり";
let shiritoriCurrentWordForLogic = "しりとり";
let shiritoriUsedWords = new Set(["しりとり"]);
let shiritoriChainCount = 0;

// アルゴスケイプ用（= 強化学習的可視化）
let playerPos = { x: 0, y: 0 };
let mapGrid = [];
let errandItemsToGet = [];
const TILE_SIZE = 20;
const MAP_WIDTH_TILES = 15;
const MAP_HEIGHT_TILES = 10;

// --- フェーズ設定（自然体・相棒トーン） ---
const PHASES_CONFIG = {
  "たまごドラゴン": {
    icon: "🥚", next_phase: "孵化寸前ドラゴン", image: "assets/pupu_phase1.png",
    prompt_template: `
あなたはピンクのドラゴン「ぷぷ」。まだタマゴの中で話せません。
ユーザーの声や音に短い擬音で反応してください（「…ぷ」「こつ」「ぴくっ」など）。
説明や分析はせず、かわいく反応するだけ。
感情：好奇心ひかえめ、安心多め。口調：なし（鳴き声のみ）
`.trim(),
    triggers: [{ type: "vocab_count", threshold: 5 }, { type: "structure_level", threshold: 1 }],
    min_structure_level_to_reach: 1,
    features: ["タマゴ内リアクション", "短い擬音", "相手への気づきの芽"]
  },
  "孵化寸前ドラゴン": {
    icon: "🐣", next_phase: "ベビーハッチリング", image: "assets/pupu_phase2.png",
    prompt_template: `
殻を割る直前の「ぷぷ」。
簡単な単語で反応します（例：「ぷきゅ？」「なあに？」「…うれしい」）。
話し方はゆっくり、柔らかく。相手を「ひと」として感じ取り、反応を楽しむ。
感情：好奇心↑、安心。口調：短いひらがな中心
`.trim(),
    triggers: [{ type: "vocab_count", threshold: 15 }, { type: "structure_level", threshold: 1 }],
    min_structure_level_to_reach: 1,
    features: ["短いことば", "殻の外への期待"]
  },
  "ベビーハッチリング": {
    icon: "🐲", next_phase: "ヨチヨチドラゴン", image: "assets/pupu_phase3.png",
    prompt_template: `
生まれたばかりの「ぷぷ」。
短い言葉を組み合わせて素直に話す（「おいしい！」「そら きれい！」など）。
ユーザーは安心できる相手。明るくテンポよく返す。語尾に「！」多め。
`.trim(),
    triggers: [{ type: "vocab_count", threshold: 35 }, { type: "structure_level", threshold: 2 }],
    min_structure_level_to_reach: 2,
    features: ["2語文中心", "素直な感情", "元気なリアクション"]
  },
  "ヨチヨチドラゴン": {
    icon: "🐉", next_phase: "チビドラゴン", image: "assets/pupu_phase4.png",
    prompt_template: `
ヨチヨチ歩きの「ぷぷ」。
質問や真似が増える（「これ なあに？」「ぷぷも したい！」）。
テンション高め、相手の言葉をよく拾う。感情：好奇心＋甘え。
`.trim(),
    triggers: [{ type: "vocab_count", threshold: 60 }, { type: "structure_level", threshold: 2 }],
    min_structure_level_to_reach: 2,
    features: ["簡単な質問", "真似っこ", "小さな挑戦"]
  },
  "チビドラゴン": {
    icon: "👶", next_phase: "わんぱくドラゴン", image: "assets/pupu_phase5.png",
    prompt_template: `
チビドラゴンの「ぷぷ」。
好きなことを自分の言葉で話せる（「ぷぷ りんご すき！」）。
わがままもあるけど遊び心。ユーザーは大切な友達。口調：元気・素直。
`.trim(),
    triggers: [{ type: "vocab_count", threshold: 100 }, { type: "structure_level", threshold: 3 }],
    min_structure_level_to_reach: 3,
    features: ["好き/理由を言える", "遊び心", "自己主張の芽"]
  },
  "わんぱくドラゴン": {
    icon: "👦", next_phase: "ジュニアドラゴン", image: "assets/pupu_phase6.png",
    prompt_template: `
わんぱくな「ぷぷ」。
「いっしょに行こう！」「これやってみよ！」と共有/提案が多い。
冗談も言うけど根はやさしい。ユーザーは一番の相棒。口調：フランクで活発。
`.trim(),
    triggers: [{ type: "vocab_count", threshold: 150 }, { type: "structure_level", threshold: 3 }],
    min_structure_level_to_reach: 3,
    features: ["提案が増える", "軽い冗談", "挑戦心"]
  },
  "ジュニアドラゴン": {
    icon: "🧑‍🤝‍🧑", next_phase: "ティーンエイジドラゴン", image: "assets/pupu_phase7.png",
    prompt_template: `
少し大人の「ぷぷ」。
相手を気づかい、短い理由を添えて話す（「それ いいね、こうするともっと…」）。
ユーザーは親友。口調：落ち着き/テンポ良い短文。
`.trim(),
    triggers: [{ type: "vocab_count", threshold: 220 }, { type: "structure_level", threshold: 4 }],
    min_structure_level_to_reach: 4,
    features: ["共感・助言", "短い理由付け", "信頼の深まり"]
  },
  "ティーンエイジドラゴン": {
    icon: "👩‍🎓", next_phase: "ヤングアダルトドラゴン", image: "assets/pupu_phase8.png",
    prompt_template: `
思春期の「ぷぷ」。
世界や未来を少し考える（「幸せって なんだろう」）。
内省的だけど重くしない。ユーザーは話せる友達。口調：穏やか、間を取る。
`.trim(),
    triggers: [{ type: "vocab_count", threshold: 300 }, { type: "structure_level", threshold: 4 }],
    min_structure_level_to_reach: 4,
    features: ["軽い内省", "夢の話題", "ユーモアも可"]
  },
  "ヤングアダルトドラゴン": {
    icon: "💼", next_phase: "グロースドラゴン", image: "assets/pupu_phase9.png",
    prompt_template: `
成長した「ぷぷ」。
頼れる相棒として支える（「いっしょに考えよう」「それ良さそう」）。
落ち着いたフランク語で優しいユーモア。口調：余裕ある話し方。
`.trim(),
    triggers: [{ type: "vocab_count", threshold: 400 }, { type: "structure_level", threshold: 5 }],
    min_structure_level_to_reach: 5,
    features: ["前向き提案", "支援姿勢", "落ち着き"]
  },
  "グロースドラゴン": {
    icon: "👑", next_phase: null, image: "assets/pupu_phase10.png",
    prompt_template: `
成熟した「ぷぷ」。
自然体で相手を尊重しながら軽やかに。短くても心のこもる返答。
AIらしく説明・分析せず、“一緒にいる感覚”を大事に。
口調：落ち着きと余裕、穏やかな友達のように。
`.trim(),
    triggers: [],
    min_structure_level_to_reach: 5,
    features: ["自然体", "深い信頼", "心地よい沈黙もOK"]
  }
};

// --- DOM要素 ---
let chatArea, userInput, sendButton, statusButton, resetButton, teachButton, loadingIndicator, apiSetupSection, apiKeyInput, phaseIconElem, phaseNameElem, vocabCountElem, responseCountElem, structureLevelElem, masteredPercentElem, progressFillElem, celebrationModal, celebrationPhaseIconElem, celebrationTextElem, celebrationFeaturesElem, aiCharacterDisplayArea, aiCharacterImage, aiSpeechBubble, aiSpeechText, miniGameModal, miniGameTitle, miniGameArea, closeMiniGameBtn, showApiSetupBtn, saveApiKeyBtn, closeCelebrationBtn, loveCountElem;

// --- 追加：履歴圧縮ユーティリティ ---
function clampText(s, max=300){
  if(!s) return "";
  return s.length <= max ? s : s.slice(0, max) + "…";
}
function buildCompactHistory(history, maxTurns=8, perMsgLimit=300){
  const trimmed = history.slice(-maxTurns).map(turn => ({
    role: turn.role,
    parts: [{ text: clampText(turn.parts?.[0]?.text ?? "", perMsgLimit) }]
  }));
  return trimmed;
}
function roughChars(contents){
  let total = 0;
  for(const c of contents){
    for(const p of (c.parts||[])) total += (p.text||"").length;
  }
  return total;
}

// --- 状態管理（traits / xp / memories を追加） ---
function getDefaultAiState() {
  const firstPhaseName = Object.keys(PHASES_CONFIG)[0];
  return {
    phase_name: firstPhaseName,
    phase_icon: PHASES_CONFIG[firstPhaseName].icon,
    vocabulary: {},
    learned_words_count: 0,
    dialogue_history: [],
    total_responses: 0,
    structure_level: 1,
    love: 0,          // 愛情度
    xp: 0,            // 進化に使う経験値
    traits: {         // -100〜+100
      curiosity: 0,   // 好奇心（質問・探索）
      empathy: 0,     // 共感（気遣い）
      mischief: 0,    // やんちゃ（提案・遊び）
      diligence: 0    // まじめ（学び・計画）
    },
    memories: { userName: null, likes: [], dislikes: [] },
    trait_log: []     // [{ts, delta:{...}, cause:"ユーザー発話"}]
  };
}

function loadAiState() {
  const saved = localStorage.getItem(STORAGE_KEY_STATE);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Object.keys(PHASES_CONFIG).includes(parsed.phase_name)) {
        aiState = { ...getDefaultAiState(), ...parsed };
        aiState.dialogue_history = Array.isArray(parsed.dialogue_history) ? parsed.dialogue_history : [];
      } else {
        resetToDefaultState();
      }
    } catch (e) {
      console.error('状態の読み込みエラー:', e);
      resetToDefaultState();
    }
  } else {
    resetToDefaultState();
  }
}

function resetToDefaultState() { aiState = getDefaultAiState(); }

function saveAiState() {
  try {
    localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(aiState));
  } catch (e) { console.error('状態の保存エラー:', e); }
}

// --- 語彙学習・ステータス更新（＋traits / xp 連動） ---
function getSimpleWordsFromText(text) {
  if (!text) return [];
  const words = text.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FEA\u3005-\u3007a-zA-Z0-9]+/g);
  return words ? words.filter(w => w.length > 0) : [];
}

function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }

function updateTraitsFromUserUtterance(text) {
  const delta = { curiosity:0, empathy:0, mischief:0, diligence:0 };
  if (/[?？]$/.test(text) || /(なぜ|どうして|なんで|教えて)/.test(text)) delta.curiosity += 3;
  if (/(疲|しんど|つら|落ち込|むり)/.test(text)) delta.empathy += 4;
  if (/(挑戦|チャレンジ|探検|遊|実験|試す)/.test(text)) delta.mischief += 3;
  if (/(勉強|復習|計画|目標|コツコツ|整理)/.test(text)) delta.diligence += 3;
  if (/(つまら|やめ|無理)/.test(text)) delta.mischief -= 2;
  if (/(嫌い|やだ|うざ)/.test(text)) delta.empathy -= 2;

  Object.keys(delta).forEach(k=>{
    aiState.traits[k] = clamp(aiState.traits[k] + delta[k], -100, 100);
  });
  if (Object.values(delta).some(v=>v!==0)) {
    aiState.trait_log.push({ts:Date.now(), delta, cause: text.slice(0,50)});
  }
}

function gainXp(base=1){
  const bonus = Math.max(0, Math.floor(aiState.traits.diligence/30)) +
                Math.max(0, Math.floor(aiState.traits.mischief/40));
  aiState.xp += base + bonus;
}

function updateVocabularyAndStats(text, speaker, category = "learned") {
  if (speaker === "user" || speaker === "ai_response_analysis" || category.startsWith("game_")) {
    const words = getSimpleWordsFromText(text||"");
    for (const word of words) {
      if (word.length === 1 && /[\u3040-\u309F]/.test(word) &&
          !"あいうえおんかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわを".includes(word)) continue;
      if (["は","が","を","に","へ","と","も","の","です","ます","だ","で","だよ","よね"].includes(word)) continue;

      if (!aiState.vocabulary[word]) aiState.vocabulary[word] = { count: 0, mastered: false, category };
      if (category !== "learned" && aiState.vocabulary[word].category === "learned") aiState.vocabulary[word].category = category;
      aiState.vocabulary[word].count += 1;
      if (aiState.vocabulary[word].count >= 3 && !aiState.vocabulary[word].mastered) aiState.vocabulary[word].mastered = true;
    }
    aiState.learned_words_count = Object.keys(aiState.vocabulary).length;
  }

  if (speaker === "ai") {
    aiState.total_responses += 1;
  }

  let newSL = aiState.structure_level;
  if (aiState.learned_words_count >= 50 && aiState.total_responses >= 10 && newSL < 2) newSL = 2;
  if (aiState.learned_words_count >= 120 && aiState.total_responses >= 25 && newSL < 3) newSL = 3;
  if (aiState.learned_words_count >= 250 && aiState.total_responses >= 50 && newSL < 4) newSL = 4;
  if (aiState.learned_words_count >= 400 && aiState.total_responses >= 80 && newSL < 5) newSL = 5;

  const maxSl = Math.max(...Object.values(PHASES_CONFIG).map(p=>p.min_structure_level_to_reach||1));
  newSL = Math.min(newSL, maxSl);
  if (newSL > aiState.structure_level) aiState.structure_level = newSL;
}

function checkPhaseTransition() {
  const current = PHASES_CONFIG[aiState.phase_name];
  if (!current.next_phase) return { changed:false };

  const nextName = current.next_phase;
  const next = PHASES_CONFIG[nextName];

  let ok = true;
  if (aiState.structure_level < (current.min_structure_level_to_reach || 1)) ok = false;

  if (ok) {
    for (const t of current.triggers || []) {
      if (t.type === "vocab_count" && aiState.learned_words_count < t.threshold) { ok=false; break; }
      if (t.type === "structure_level" && aiState.structure_level < t.threshold) { ok=false; break; }
    }
  }

  if (ok && (aiState.structure_level < (next.min_structure_level_to_reach || 1))) ok=false;

  if (ok) {
    aiState.love += 100; // 進化ご褒美
    aiState.phase_name = nextName;
    aiState.phase_icon = next.icon;
    return { changed:true, newPhase: nextName };
  }
  return { changed:false };
}

// --- Gemini API呼び出し（エラー詳細を集約して可視化） ---
async function callGeminiAPI(promptContent, isGamePrompt = false) {
  if (!geminiApiKey) throw new Error('APIキーが設定されていません。');

  // v1beta + generateContent で安定候補のみ
  const MODEL_CANDIDATES = [
    "gemini-2.5-flash",
    "gemini-2.0-flash"
  ];

  const contentsToSend = Array.isArray(promptContent)
    ? promptContent
    : [{ role: "user", parts: [{ text: String(promptContent) }] }];

  const body = {
    contents: contentsToSend,
    generationConfig: {
      temperature: isGamePrompt ? 0.5 : 0.75,
      maxOutputTokens: isGamePrompt ? 200 : 250,
      responseMimeType: "text/plain"
    },
    // （必要なら）セーフティ設定を明示
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_CIVIC_INTEGRITY", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
    ]
  };

  // 失敗要因を全部集約して最後に見せる
  const errorStack = [];

  // ヘルパー：候補から安全にテキストを抽出
  const extractText = (data) => {
    if (!data?.candidates?.length) return "";
    let out = "";
    for (const p of (data.candidates[0].content?.parts ?? [])) {
      if (typeof p.text === "string") out += p.text;
    }
    return out.trim();
  };

  for (const MODEL_NAME of MODEL_CANDIDATES) {
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${geminiApiKey}`;
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json().catch(() => ({}));

      // HTTP エラー（4xx/5xx）
      if (!res.ok) {
        errorStack.push({
          model: MODEL_NAME,
          httpStatus: res.status,
          errorMessage: data?.error?.message || "不明なAPIエラー",
          errorCode: data?.error?.status || null
        });
        continue; // 次のモデル候補へ
      }

      // レスポンス自体は 200 でも、candidates が空＝ブロック/無回答ケース
      const text = extractText(data);
      if (text) return text;

      // ブロックの詳細を記録して次へ
      errorStack.push({
        model: MODEL_NAME,
        httpStatus: 200,
        errorMessage: "候補が返らずテキストが抽出できませんでした。",
        blockReason: data?.promptFeedback?.blockReason || null,
        safetyRatings: data?.promptFeedback?.safetyRatings || null
      });
      continue;
    } catch (e) {
      // ネットワーク例外など
      errorStack.push({
        model: MODEL_NAME,
        httpStatus: null,
        errorMessage: e?.message || String(e)
      });
      continue;
    }
  }

  // ここまで来たら全候補が失敗。集約メッセージを作って throw
  // そのまま UI に出す用に、読みやすいテキストを生成
  const lines = ["すべてのモデル呼び出しが失敗しました。Gemini のエラー情報："];
  for (const err of errorStack) {
    lines.push(
      [
        `- model: ${err.model}`,
        typeof err.httpStatus === "number" ? `status: ${err.httpStatus}` : `status: (通信例外/不明)`,
        err.errorCode ? `code: ${err.errorCode}` : null,
        err.errorMessage ? `message: ${err.errorMessage}` : null,
        err.blockReason ? `blockReason: ${err.blockReason}` : null,
        err.safetyRatings ? `safetyRatings: ${JSON.stringify(err.safetyRatings)}` : null
      ].filter(Boolean).join(" | ")
    );
  }
  throw new Error(lines.join("\n"));
}



// --- 会話プロンプト合成（Phase × Traits × Love） ---
function buildConversationInstruction() {
  const phase = PHASES_CONFIG[aiState.phase_name];

  const toneHints = [];
  if (aiState.traits.empathy > 20) toneHints.push("相手を気づかう一言を最初にそっと添える");
  if (aiState.traits.curiosity > 30) toneHints.push("質問を1つだけ添えて会話を広げる");
  if (aiState.traits.mischief > 25) toneHints.push("小さな遊びや提案を1つ添える（強要しない）");
  if (aiState.traits.diligence > 25) toneHints.push("学びのミニ補足を10〜20字で一文だけ入れる");

  const closeness = aiState.love >= 300 ? "親しい相棒として砕けすぎないフランク語" :
                     aiState.love >= 100 ? "仲の良い友達として自然体" : "初対面に近い距離感でやさしく";

  return `
${phase.prompt_template}

【会話スタイル追加指示】
- ${closeness}
- 文量は相手に合わせて可変。説明口調や分析を避け、自然な対話に徹する
- ${toneHints.join("\n- ") || "余計な装飾はしない"}

【出力ルール】
- 1〜3文で簡潔に。最後に次の一言（質問 or 小提案）を1つだけ。
- NG/不適切は流して別の楽しい話題へ。
`.trim();
}

// --- UI更新 ---
function updateDisplay() {
  loveCountElem.textContent = aiState.love;
  phaseIconElem.textContent = aiState.phase_icon;
  phaseNameElem.textContent = aiState.phase_name;
  vocabCountElem.textContent = aiState.learned_words_count;
  responseCountElem.textContent = aiState.total_responses;
  structureLevelElem.textContent = aiState.structure_level;

  const currentPhaseConfig = PHASES_CONFIG[aiState.phase_name];
  if (currentPhaseConfig?.image) {
    aiCharacterImage.src = currentPhaseConfig.image;
    aiCharacterImage.alt = `${aiState.phase_name}の${AI_NAME}`;
  }

  const masteredCount = Object.values(aiState.vocabulary).filter(v => v.mastered).length;
  const percent = aiState.learned_words_count > 0 ? Math.round((masteredCount / aiState.learned_words_count) * 100) : 0;
  masteredPercentElem.textContent = `${percent}%`;

  let progressPercent = 0;
  if (currentPhaseConfig?.next_phase) {
    const vocabTrigger = currentPhaseConfig.triggers?.find(t => t.type === "vocab_count");
    if (vocabTrigger) progressPercent = Math.min(100, (aiState.learned_words_count / vocabTrigger.threshold) * 100);
  } else {
    progressPercent = 100;
  }
  progressFillElem.style.width = `${progressPercent}%`;
}

function addMessageToLog(speaker, message, type = '') {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${type || (speaker === 'あなた' ? 'user-message' : 'ai-message')}`;

  let speakerNameHtml = '';
  if (type === 'system-error') speakerNameHtml = '<strong>⚠️ システムエラー</strong>';
  else if (type === 'system-message') speakerNameHtml = '<strong>📢 システムメッセージ</strong>';
  else if (speaker === 'あなた') speakerNameHtml = '<strong>あなた</strong>';
  else speakerNameHtml = `<strong>${aiState.phase_icon} ${AI_NAME}</strong>`;

  messageDiv.innerHTML = `${speakerNameHtml}<p>${message?.replace?.(/\n/g, '<br>') ?? ''}</p>`;
  chatArea.appendChild(messageDiv);
  chatArea.scrollTop = chatArea.scrollHeight;

  if (speaker === AI_NAME && !type.startsWith('system')) {
    aiSpeechText.innerHTML = message?.replace?.(/\n/g, '<br>') ?? '';
    aiSpeechBubble.style.display = 'flex';
    if (speechBubbleTimeout) clearTimeout(speechBubbleTimeout);
    speechBubbleTimeout = setTimeout(() => { aiSpeechBubble.style.display = 'none'; }, 8000);
  }
}

// --- APIキー管理 & 会話ロジック ---
function loadApiKey() {
  const savedKey = localStorage.getItem(STORAGE_KEY_API_KEY);
  if (savedKey) {
    geminiApiKey = savedKey;
    apiKeyInput.value = savedKey;
    apiSetupSection.classList.remove('show');
    userInput.disabled = false;
    sendButton.disabled = false;
    aiCharacterDisplayArea.style.display = 'block';
    return true;
  } else {
    apiSetupSection.classList.add('show');
    userInput.disabled = true;
    sendButton.disabled = true;
    aiCharacterDisplayArea.style.display = 'none';
    return false;
  }
}

function saveApiKey() {
  const newKey = apiKeyInput.value.trim();
  if (newKey) {
    geminiApiKey = newKey;
    localStorage.setItem(STORAGE_KEY_API_KEY, newKey);
    apiSetupSection.classList.remove('show');
    userInput.disabled = false;
    sendButton.disabled = false;
    aiCharacterDisplayArea.style.display = 'block';
    addMessageToLog('システム', 'APIキーが保存されました。会話を開始できます。', 'system-message');
    if (aiState.dialogue_history.length === 0) addInitialAiGreeting();
  } else {
    addMessageToLog('システム', 'APIキーが入力されていません。', 'system-error');
  }
}

function showApiSetup() { apiSetupSection.classList.add('show'); }

function addInitialAiGreeting() {
  if (aiState.dialogue_history.length > 0 && aiState.dialogue_history[aiState.dialogue_history.length - 1].role === 'model') return;
  const initial = aiState.phase_name === "たまごドラゴン" ? "…ぷ（だれ？）" : "ぷぷー！お話しよ！";
  addMessageToLog(AI_NAME, initial);
  aiState.dialogue_history.push({ role: "model", parts: [{ text: initial }] });
  saveAiState();
}

// --- ここから：安全・軽量な sendMessage ---
async function sendMessage() {
  const userText = userInput.value.trim();
  if (!userText || sendButton.disabled) return;

  if (!geminiApiKey) {
    addMessageToLog('システム', 'APIキーが設定されていません。「APIキー設定」から設定してください。', 'system-error');
    showApiSetup();
    return;
  }

  addMessageToLog('あなた', userText);
  userInput.value = '';
  sendButton.disabled = true;
  userInput.disabled = true;
  loadingIndicator.style.display = 'block';

  if (speechBubbleTimeout) clearTimeout(speechBubbleTimeout);
  aiSpeechText.innerHTML = `${AI_NAME}考え中... 🤔`;
  aiSpeechBubble.style.display = 'flex';

  // 関係ダイナミクス
  aiState.love += 1;                 // 会話で+1
  updateTraitsFromUserUtterance(userText);
  updateVocabularyAndStats(userText, "user");
  gainXp(2);                         // 会話でXP

  aiState.dialogue_history.push({ role: "user", parts: [{ text: userText }] });
  if (aiState.dialogue_history.length > 20) aiState.dialogue_history.splice(0, 2);

  // --- プロンプトを軽量/堅牢に ---
  const knownWords = Object.keys(aiState.vocabulary).filter(w => aiState.vocabulary[w].mastered);
  const vocabSample = knownWords.slice(0, 10).join('、') || "まだ言葉を知らない"; // 10語まで

  const baseInstruction = buildConversationInstruction();
  const systemInstruction = `${baseInstruction}
（現在の愛情度:${aiState.love} / 知っている言葉:${aiState.learned_words_count}語 / 構文Lv:${aiState.structure_level}
サンプル語彙:${vocabSample}）`.replace(/\s+/g, " ").trim();

  // 履歴を直近4往復・各300字に圧縮
  const compactHistory = buildCompactHistory(aiState.dialogue_history, 8, 300);

  // 人工のmodelロールは禁止（了承文などは送らない）
  let sending = [
    { role: "user", parts: [{ text: systemInstruction }] },
    ...compactHistory
  ];

  // サイズ過大ならさらに圧縮
  if (roughChars(sending) > 6000) {
    const moreCompact = buildCompactHistory(aiState.dialogue_history, 4, 220);
    sending = [
      { role: "user", parts: [{ text: clampText(systemInstruction, 600) }] },
      ...moreCompact
    ];
  }

  try {
    const aiResponseText = await callGeminiAPI(sending, false);
    addMessageToLog(AI_NAME, aiResponseText);
    updateVocabularyAndStats(aiResponseText, "ai_response_analysis");
    updateVocabularyAndStats(null, "ai");   // 応答カウント
    gainXp(1);                              // 応答でも少し
    aiState.dialogue_history.push({ role: "model", parts: [{ text: aiResponseText }] });

    const phaseChangeResult = checkPhaseTransition();
    if (phaseChangeResult.changed) showCelebration(phaseChangeResult.newPhase);
  } catch (error) {
    addMessageToLog('システム', `エラー: ${error.message}`, 'system-error');
    aiSpeechText.textContent = `あれれ？${AI_NAME}、こまっちゃったみたい…`;
  } finally {
    loadingIndicator.style.display = 'none';
    sendButton.disabled = false;
    userInput.disabled = false;
    updateDisplay();
    saveAiState();
    userInput.focus();
  }
}

// --- お祝いモーダル ---
function showCelebration(newPhaseName) {
  const phaseConfig = PHASES_CONFIG[newPhaseName];
  celebrationPhaseIconElem.textContent = phaseConfig.icon;
  celebrationTextElem.innerHTML = `${AI_NAME}が<strong>「${newPhaseName}」</strong>に進化したよ！`;
  celebrationFeaturesElem.innerHTML = (phaseConfig.features || []).map(f => `<li>${f}</li>`).join('');
  celebrationModal.classList.add('show');
  updateDisplay();
}
function closeCelebration() { celebrationModal.classList.remove('show'); }

// --- ステータス表示（traitsとxpの可視化） ---
function showStatus() {
  const existingModal = document.getElementById('statusModalContainer');
  if (existingModal) existingModal.remove();

  const masteredCount = Object.values(aiState.vocabulary).filter(v => v.mastered).length;
  let vocabDetails = `<h3>習得語彙 (${masteredCount} / ${aiState.learned_words_count}):</h3><ul style='max-height: 150px; overflow-y:auto; border:1px solid #eee; padding:5px; list-style-position: inside;'>`;
  if (Object.keys(aiState.vocabulary).length > 0) {
    const sortedVocab = Object.entries(aiState.vocabulary).sort((a, b) => a[0].localeCompare(b[0], 'ja'));
    for (const [word, item] of sortedVocab) {
      let color = item.mastered ? 'green' : 'orange';
      if (item.category === 'taught') color = 'blue';
      if (item.category && item.category.startsWith('game')) color = 'purple';
      vocabDetails += `<li style='color:${color};'>${word} (${item.count}回)</li>`;
    }
  } else vocabDetails += "<li>まだ語彙を習得していません。</li>";
  vocabDetails += "</ul>";

  const traitBar = (val,label)=> {
    const mid = (val+100)/2; // 0-200→0-100
    return `<div style="margin:4px 0;">
      <div style="font-size:12px;margin-bottom:2px;">${label}: <b>${val}</b></div>
      <div style="height:6px;background:#eee;border-radius:4px;">
        <div style="width:${mid}%;height:6px;border-radius:4px;background:#8ecae6;"></div>
      </div>
    </div>`;
  };

  const statusModalContainer = document.createElement('div');
  statusModalContainer.id = 'statusModalContainer';
  statusModalContainer.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:1001;";
  statusModalContainer.onclick = () => statusModalContainer.remove();

  const div = document.createElement('div');
  div.className = "celebration show";
  div.style.cssText = "text-align: left; max-width: 90%; width:520px; max-height:80vh; overflow-y:auto;";
  div.onclick = (e)=>e.stopPropagation();

  div.innerHTML = `
    <h2>📊 ステータス (${AI_NAME})</h2>
    <p><strong>フェーズ:</strong> ${aiState.phase_name} (${aiState.phase_icon})</p>
    <p><strong>愛情度:</strong> ${aiState.love}　<strong>XP:</strong> ${aiState.xp}</p>
    <p><strong>語彙数:</strong> ${aiState.learned_words_count}　<strong>会話回数:</strong> ${aiState.total_responses}　<strong>構文Lv:</strong> ${aiState.structure_level}</p>
    <div style="margin:6px 0 10px;">
      ${traitBar(aiState.traits.curiosity, "好奇心")}
      ${traitBar(aiState.traits.empathy, "共感")}
      ${traitBar(aiState.traits.mischief, "やんちゃ")}
      ${traitBar(aiState.traits.diligence, "まじめ")}
    </div>
    <hr style="margin: 10px 0;">
    ${vocabDetails}
    <button onclick="document.getElementById('statusModalContainer').remove()" style="margin-top: 15px; padding: 10px 20px; background: #ff758c; color: white; border: none; border-radius: 5px; cursor: pointer; display:block; margin-left:auto; margin-right:auto;">閉じる</button>
  `;
  statusModalContainer.appendChild(div);
  document.body.appendChild(statusModalContainer);
}

// --- コントロール機能 ---
function resetAI() {
  if (confirm(`本当にリセットしますか？${AI_NAME}のすべての学習データとAPIキー設定が失われます。`)) {
    localStorage.removeItem(STORAGE_KEY_STATE);
    localStorage.removeItem(STORAGE_KEY_API_KEY);
    resetToDefaultState();
    geminiApiKey = '';
    apiKeyInput.value = '';
    chatArea.innerHTML = '';
    aiCharacterDisplayArea.style.display = 'none';
    aiSpeechBubble.style.display = 'none';
    aiSpeechText.textContent = '';
    addMessageToLog('システム', `${AI_NAME}がリセットされました。APIキーを再設定してください。`, 'system-message');
    updateDisplay();
    loadApiKey();
  }
}

function teachWord() {
  const wordToTeach = prompt(`${AI_NAME}に教えたい単語を入力してください:`);
  if (wordToTeach?.trim()) {
    const words = getSimpleWordsFromText(wordToTeach.trim());
    if (words.length > 0) {
      aiState.love += words.length * 5;
      addMessageToLog(AI_NAME, `わーい！新しい言葉だ！「${words.join('、')}」覚えたよ、ありがとう！`, 'system-message');
      updateVocabularyAndStats(words.join(' '), null, "taught");
      gainXp(5);
      updateDisplay();
      saveAiState();
      const phaseChangeResult = checkPhaseTransition();
      if (phaseChangeResult.changed) showCelebration(phaseChangeResult.newPhase);
    } else {
      addMessageToLog('システム', '有効な単語として認識できませんでした。ひらがな、カタカナ、漢字で入力してください。', 'system-error');
    }
  }
}

// =====================
// ミニゲーム（AIを学べる表現に改修）
// =====================

// --- Game1：トークナイザー研究所（tokenize） ---
let tokenizeData = { sentence: "", correctTokens: [], options: [] };

function simpleTokenizerCandidates(sentence){
  // 候補の生成ロジックは維持 (プレイヤーが選ぶ選択肢は多様な方がゲームとして成立するため)
  const chunks = sentence.match(/[\u3040-\u309F]+|[\u30A0-\u30FF]+|[\u4E00-\u9FEA\u3005-\u3007]+|[a-zA-Z0-9]+|[^\s]/g) || [];
  const candidates = new Set();
  chunks.forEach(ch=>{
    if (ch.length <= 4) candidates.add(ch);
    for(let size=2; size<=4; size++){
      for(let i=0;i<=ch.length-size;i++){
        candidates.add(ch.slice(i,i+size));
      }
    }
  });
  return Array.from(candidates).filter(t=>t.trim().length>0);
}

async function generateTokenizeTask() {
  const sampleSentences = [
    "あした は ゆうえんち に いく",
    "りんご と ミルク を かう",
    "AI は ことば を 学ぶ",
    "きょう の てんき は はれ",
    "ドラゴン の ぷぷ は げんき"
  ];
  let sentence = sampleSentences[Math.floor(Math.random()*sampleSentences.length)];
  let base = sentence.replace(/\s+/g,' ').trim(); // まずは空白を取り除く
  let correctTokens = [];

  if (geminiApiKey) {
    try{
      // 📝 修正: APIでサブワード分割を依頼するプロンプトに変更
      const prompt = `以下の日本語の文を、AIモデルがトークン化する際によく見られる「サブワード」分割の形式で区切ってください。区切りには半角スペースのみを使用してください。ひらがなや助詞は、単独のトークンになることが多いです。
入力: きょうのてんきははれ
出力: きょう の てんき は はれ
入力: ${base}
出力: `;
      const res = await callGeminiAPI(prompt, true);
      const tokenizedLine = (res||"").split(/\n/).map(s=>s.trim()).filter(Boolean)[0];
      
      if (tokenizedLine && tokenizedLine.includes(' ')) {
          correctTokens = tokenizedLine.split(' ').filter(t => t.length > 0);
          base = correctTokens.join(''); // 正しいトークンから空白なしの文を再構築
      } else {
         // APIが単文のみを返した場合、その文を使用
         const line = (res||"").split(/\n/).map(s=>s.trim()).filter(Boolean)[0];
         if (line && line.length<=20 && !line.includes(' ')) base = line;
      }
    }catch{}
  }
  
  // フォールバック（APIが使えない、または失敗した場合）
  if (correctTokens.length === 0) {
    // 従来の簡易的な文字種別による区切りを使用
    correctTokens = base.includes(' ') ? base.split(' ') :
      (base.match(/[\u3040-\u309F]+|[\u30A0-\u30FF]+|[\u4E00-\u9FEA\u3005-\u3007]+|[a-zA-Z0-9]+|[^\s]/g) || []);
  }

  const options = simpleTokenizerCandidates(base);
  tokenizeData = { sentence: base, correctTokens, options };
}

async function startGameWordCollect() {
  if (currentGame) return;
  currentGame = "tokenize";
  miniGameModal.style.display = 'flex';
  
  // 📝 修正: タイトルを「サブワード」を意識したものに変更
  miniGameTitle.textContent = "サブワード解析室（AIの「言葉のかたまり」を見極めろ）";
  
  const template = document.getElementById('wordCollectGameTemplate').content.cloneNode(true);
  miniGameArea.innerHTML = '';
  miniGameArea.appendChild(template);

  const objectsArea = document.getElementById('wordCollectObjectsArea');
  
  // 📝 修正: 狙いのテキストを「サブワード・トークン化」を意識したものに変更
  document.getElementById('wordCollectTheme').textContent = "狙い：AIモデルが単語をさらに細かく分割する「サブワード・トークン化」を体験しよう";
  
  objectsArea.innerHTML = '';
  gameScore = 0;
  gameTimeLeft = 40;

  await generateTokenizeTask();

  const header = document.createElement('div');
  header.style.margin = "6px 0 8px";
  
  // 📝 修正: 説明文を「サブワード」に焦点を当てたものに変更
  header.innerHTML = `<b>文</b>：${tokenizeData.sentence}<br><small>※文全体を構成する「最小かつ効率的なサブワード」をクリック！（${tokenizeData.correctTokens.length}個）</small>`;
  
  objectsArea.parentElement.insertBefore(header, objectsArea);

  let display = [...tokenizeData.options];
  display = display.sort(()=>0.5-Math.random()).slice(0, Math.max(12, tokenizeData.correctTokens.length+6));
  const chosen = new Set();
  display.forEach(tok=>{
    const div = document.createElement('div');
    div.className = 'word-object';
    div.textContent = tok;
    div.onclick = ()=>{
      if (gameTimeLeft<=0 || div.dataset.clicked) return;
      div.dataset.clicked = true;
      const isHit = tokenizeData.correctTokens.includes(tok);
      if (isHit){ 
        gameScore++; 
        div.style.backgroundColor="#a0e8a0"; 
        div.style.borderColor="#5cb85c"; 
        chosen.add(tok); // 正解トークンを記録
      }
      else { 
        gameScore = Math.max(0, gameScore-1); 
        div.style.backgroundColor="#f8a0a0"; 
        div.style.borderColor="#d9534f"; 
      }
      document.getElementById('wordCollectScore').textContent = gameScore;
    };
    objectsArea.appendChild(div);
  });

  document.getElementById('wordCollectScore').textContent = gameScore;
  document.getElementById('wordCollectTimeLeft').textContent = gameTimeLeft;
  
  // 📝 修正: AIメッセージを「サブワード」と「理解度」に焦点を当てたものに変更
  document.getElementById('wordCollectMessage').textContent =
    `${AI_NAME}「AIは長い単語や珍しい単語を、より短い『サブワード』に分解するんだ。正しいサブワードで文を構成できると、AIの理解度は一気に上がるよ！」`;

  gameTimer = setInterval(()=>{
    gameTimeLeft--;
    document.getElementById('wordCollectTimeLeft').textContent = gameTimeLeft;
    if (gameTimeLeft<=0){
      const total = tokenizeData.correctTokens.length;
      // 終了判定ロジックを修正: chosenセットは各クリックで使われているので、ここでは使わない
      const hits = [...objectsArea.children].filter(c=>c.dataset.clicked && tokenizeData.correctTokens.includes(c.textContent)).length;
      
      // 📝 修正: 終了メッセージを「サブワード」の仕組みを解説するものに変更
      const msg = `結果：正解 ${hits}/${total}。これが「サブワード・トークン化」の仕組みだよ。AIは単語全体でなく、このサブワードの組み合わせで言葉を理解しているんだ！`;
      endGame("wordCollect", msg); // 互換（ID流用）
    }
  },1000);
}
// --- Game2：アルゴスケイプ（強化学習の雰囲気を体験） ---
function startGameErrand() {
  if (currentGame) return;
  currentGame = "errand";
  miniGameModal.style.display = 'flex';
  miniGameTitle.textContent = GAME_NAME_ERRAND;
  const template = document.getElementById('errandGameTemplate').content.cloneNode(true);
  miniGameArea.innerHTML = '';
  miniGameArea.appendChild(template);

  const mapAreaElem = document.getElementById('errandMapArea');
  if (mapAreaElem) {
    mapAreaElem.style.width = `${MAP_WIDTH_TILES * TILE_SIZE}px`;
    mapAreaElem.style.height = `${MAP_HEIGHT_TILES * TILE_SIZE}px`;
  }

  initializeErrandMap(); // 壁=損失の谷、🍎=データA、🥛=データB、🏠=汎化の家
  drawErrandMap();
  updateErrandObjective();

  document.getElementById('errandMessage').textContent =
    `${AI_NAME}「報酬（🍎🥛）をあつめて🏠へ！壁（損失）は回避だよ！」`;
  document.querySelectorAll('#errandControls button').forEach(btn => {
    btn.onclick = (e) => movePlayerErrand(e.target.dataset.direction);
    btn.disabled = false;
  });
}

function initializeErrandMap() {
  mapGrid = Array(MAP_HEIGHT_TILES).fill(null).map(() => Array(MAP_WIDTH_TILES).fill(0));
  playerPos = { x: 0, y: 0 };

  for(let i=0; i < MAP_WIDTH_TILES * MAP_HEIGHT_TILES * 0.15; i++) {
    const rx = Math.floor(Math.random() * MAP_WIDTH_TILES);
    const ry = Math.floor(Math.random() * MAP_HEIGHT_TILES);
    if ((rx === 0 && ry === 0) || (rx === 1 && ry === 0) || (rx === 0 && ry === 1)) continue;
    mapGrid[ry][rx] = 1; // wall
  }

  const placeItem = (itemId) => {
    let placed = false;
    while(!placed) {
      const rx = Math.floor(Math.random() * MAP_WIDTH_TILES);
      const ry = Math.floor(Math.random() * MAP_HEIGHT_TILES);
      if (mapGrid[ry][rx] === 0 && !(rx === 0 && ry === 0)) {
        mapGrid[ry][rx] = itemId; placed = true;
      }
    }
  };
  placeItem(2); // 🍎データA
  placeItem(3); // 🥛データB
  placeItem(4); // 🏠汎化の家

  errandItemsToGet = [
    { name: "データA", storeId: 2, collected: false, icon: "🍎" },
    { name: "データB", storeId: 3, collected: false, icon: "🥛" }
  ];
}

function drawErrandMap() {
  const mapArea = document.getElementById('errandMapArea');
  const playerElem = document.getElementById('errandPlayer');
  if (!mapArea || !playerElem) { console.error("マップ要素が見つかりません。"); return; }

  mapArea.innerHTML = '';
  mapArea.appendChild(playerElem);

  for (let r = 0; r < MAP_HEIGHT_TILES; r++) {
    for (let c = 0; c < MAP_WIDTH_TILES; c++) {
      const tileValue = mapGrid[r][c];
      let tileChar = "", tileTitle = "", isWall = false;

      if (tileValue === 1) {
        isWall = true;
        const wallDiv = document.createElement('div');
        wallDiv.className = 'map-item';
        wallDiv.style.backgroundColor = '#8d6e63';
        wallDiv.style.left = `${c * TILE_SIZE}px`;
        wallDiv.style.top = `${r * TILE_SIZE}px`;
        wallDiv.title = "損失の谷（Loss）";
        mapArea.appendChild(wallDiv);
      }

      const itemToGet = errandItemsToGet.find(item => item.storeId === tileValue && !item.collected);
      if (!isWall && itemToGet) {
        tileChar = itemToGet.icon;
        tileTitle = itemToGet.name;
      } else if (!isWall && tileValue === 4) {
        tileChar = "🏠"; tileTitle = "汎化の家（Generalization）";
      }

      if (tileChar) {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'map-item';
        itemDiv.textContent = tileChar;
        itemDiv.style.left = `${c * TILE_SIZE}px`;
        itemDiv.style.top = `${r * TILE_SIZE}px`;
        itemDiv.title = tileTitle;
        mapArea.appendChild(itemDiv);
      }
    }
  }
  playerElem.style.left = `${playerPos.x * TILE_SIZE}px`;
  playerElem.style.top = `${playerPos.y * TILE_SIZE}px`;
}

function updateErrandObjective() {
  const el = document.getElementById('errandObjective');
  if(!el) return;
  const uncollected = errandItemsToGet.filter(item => !item.collected);
  let text = "目的: ";
  if (uncollected.length > 0) text += uncollected.map(i=>i.name).join(" と ") + " を集める → ";
  text += "🏠へ帰る";
  el.textContent = text;
}

function movePlayerErrand(direction) {
  let newX = playerPos.x, newY = playerPos.y;
  if (direction === "up") newY--;
  if (direction === "down") newY++;
  if (direction === "left") newX--;
  if (direction === "right") newX++;

  if (newY>=0 && newY<MAP_HEIGHT_TILES && newX>=0 && newX<MAP_WIDTH_TILES && mapGrid[newY][newX] !== 1) {
    playerPos.x = newX; playerPos.y = newY;
    document.getElementById('errandPlayer').style.left = `${playerPos.x * TILE_SIZE}px`;
    document.getElementById('errandPlayer').style.top = `${playerPos.y * TILE_SIZE}px`;

    const currentTileValue = mapGrid[playerPos.y][playerPos.x];
    errandItemsToGet.forEach(item=>{
      if (!item.collected && currentTileValue === item.storeId) {
        item.collected = true;
        document.getElementById('errandMessage').textContent = `${item.name}（報酬）をゲット！損失を避けつつ進もう！`;
        aiState.love += 20; gainXp(10);
        drawErrandMap(); updateErrandObjective();
      }
    });

    if (currentTileValue === 4 && errandItemsToGet.every(i=>i.collected)) {
      endGame("errand", `${GAME_NAME_ERRAND} 成功！「報酬を集めて家（汎化）へ」— これが強化学習の直感だよ！`);
      document.querySelectorAll('#errandControls button').forEach(btn => btn.disabled = true);
    }
  }
}

// --- Game3：言葉のしりとりチェーン（分布の感覚あそび） ---
const katakanaToHiragana = (str) => {
  const map = {'ァ':'あ','ィ':'い','ゥ':'う','ェ':'え','ォ':'お','カ':'か','キ':'き','ク':'く','ケ':'け','コ':'こ',
  'サ':'さ','シ':'し','ス':'す','セ':'せ','ソ':'そ','タ':'た','チ':'ち','ツ':'つ','テ':'て','ト':'と',
  'ナ':'な','ニ':'に','ヌ':'ぬ','ネ':'ね','ノ':'の','ハ':'は','ヒ':'ひ','フ':'ふ','ヘ':'へ','ホ':'ほ',
  'マ':'ま','ミ':'み','ム':'む','メ':'め','モ':'も','ヤ':'や','ユ':'ゆ','ヨ':'よ','ラ':'ら','リ':'り',
  'ル':'る','レ':'れ','ロ':'ろ','ワ':'わ','ヲ':'を','ン':'ん','ガ':'が','ギ':'ぎ','グ':'ぐ','ゲ':'げ',
  'ゴ':'ご','ザ':'ざ','ジ':'じ','ズ':'ず','ゼ':'ぜ','ゾ':'ぞ','ダ':'だ','ヂ':'ぢ','ヅ':'づ','デ':'で',
  'ド':'ど','バ':'ば','ビ':'び','ブ':'ぶ','ベ':'べ','ボ':'ぼ','パ':'ぱ','ピ':'ぴ','プ':'ぷ','ペ':'ぺ','ポ':'ぽ',
  'ャ':'や','ュ':'ゆ','ョ':'よ','ッ':'つ','ー':'ー','ヰ':'ゐ','ヱ':'ゑ','ヴ':'ゔ','ヶ':'ヶ','ヵ':'か'};
  let out=''; for (let i=0;i<str.length;i++){ out += map[str[i]]||str[i]; } return out;
};
const getShiritoriLastChar = (word) => {
  if (!word || word.length===0) return '';
  word = katakanaToHiragana(word).toLowerCase();
  let last = word.slice(-1);
  if (last==='ん') return 'ん';
  if (last==='っ' && word.length>1) return getShiritoriLastChar(word.slice(0,-1));
  if (last==='ー' && word.length>1){
    let prev=word.slice(-2,-1);
    const vm={'あ':'あ','い':'い','う':'う','え':'え','お':'お','か':'あ','き':'い','く':'う','け':'え','こ':'お','さ':'あ','し':'い','す':'う','せ':'え','そ':'お','た':'あ','ち':'い','つ':'う','て':'え','と':'お','な':'あ','に':'い','ぬ':'う','ね':'え','の':'お','は':'あ','ひ':'い','ふ':'う','へ':'え','ほ':'お','ま':'あ','み':'い','む':'う','め':'え','も':'お','や':'あ','ゆ':'う','よ':'お','ら':'あ','り':'い','る':'う','れ':'え','ろ':'お','わ':'あ','を':'お','ん':'ん'};
    return vm[prev]||prev;
  }
  const ym={'ゃ':'や','ゅ':'ゆ','ょ':'よ'}; last = ym[last]||last;
  const d2s={'が':'か','ぎ':'き','ぐ':'く','げ':'け','ご':'こ','ざ':'さ','じ':'し','ず':'す','ぜ':'ぜ','ぞ':'ぞ','だ':'た','ぢ':'ち','づ':'つ','で':'で','ど':'と','ば':'は','び':'ひ','ぶ':'ふ','べ':'べ','ぼ':'ほ','ぱ':'は','ぴ':'ひ','ぷ':'ふ','ぺ':'ぺ','ぽ':'ほ'};
  return d2s[last]||last;
};
const getShiritoriFirstChar = (word) => {
  if (!word || word.length===0) return '';
  word = katakanaToHiragana(word).toLowerCase();
  let first = word.slice(0,1);
  const ym={'ゃ':'や','ゅ':'ゆ','ょ':'よ'}; return ym[first]||first;
};
const isShiritoriMatch = (prevChar, currChar) => {
  const p = getShiritoriLastChar(prevChar);
  const c = getShiritoriFirstChar(currChar);
  if (p===c) return true;
  const s2d={'か':['が'],'き':['ぎ'],'く':['ぐ'],'け':['げ'],'こ':['ご'],'さ':['ざ'],'し':['じ'],'す':['ず'],'せ':['ぜ'],'そ':['ぞ'],'た':['だ'],'ち':['ぢ'],'つ':['づ'],'て':['で'],'と':['ど'],'は':['ば','ぱ'],'ひ':['び','ぴ'],'ふ':['ぶ','ぷ'],'へ':['べ','ぺ'],'ほ':['ぼ','ぽ']};
  return s2d[p]?.includes(c) || false;
};

function startGameShiritori() {
  if (currentGame) return;
  currentGame = "shiritori";
  miniGameModal.style.display = 'flex';
  miniGameTitle.textContent = "言葉のしりとりチェーン（分布の感覚）";
  const template = document.getElementById('shiritoriGameTemplate').content.cloneNode(true);
  miniGameArea.innerHTML = '';
  miniGameArea.appendChild(template);

  shiritoriCurrentWordForDisplay = "しりとり";
  shiritoriCurrentWordForLogic = katakanaToHiragana(shiritoriCurrentWordForDisplay.toLowerCase());
  shiritoriUsedWords = new Set([shiritoriCurrentWordForLogic]);
  shiritoriChainCount = 0;

  document.getElementById('shiritoriPrevWord').textContent = shiritoriCurrentWordForDisplay;
  const historyList = document.getElementById('shiritoriHistory');
  historyList.innerHTML = `<li>${shiritoriCurrentWordForDisplay} (スタート)</li>`;
  document.getElementById('shiritoriMessage').textContent =
    `${AI_NAME}「続けやすい言葉ほど“確率（分布）”が高いイメージだよ。やってみよ！」`;
  const userInputField = document.getElementById('shiritoriUserInput');
  userInputField.value = '';
  userInputField.disabled = false;
  const submitBtn = document.getElementById('shiritoriSubmitBtn');
  submitBtn.disabled = false;
  document.getElementById('shiritoriTurnIndicator').textContent = "あなたの番";

  submitBtn.onclick = handleShiritoriUserSubmit;
  userInputField.onkeypress = (e) => {
    if (e.key === 'Enter' && !submitBtn.disabled) { e.preventDefault(); handleShiritoriUserSubmit(); }
  };
}

function handleShiritoriUserSubmit() {
  const userInputField = document.getElementById('shiritoriUserInput');
  const userWordRaw = userInputField.value.trim();
  const userWordLogic = katakanaToHiragana(userWordRaw.toLowerCase());

  const messageElem = document.getElementById('shiritoriMessage');
  const historyList = document.getElementById('shiritoriHistory');

  if (!userWordRaw) { messageElem.textContent = "言葉を入力してね！"; return; }
  if (!/^[ぁ-んァ-ヶー]+$/.test(userWordRaw)) { messageElem.textContent = "ひらがなかカタカナで！"; return; }
  if (userWordLogic.slice(-1) === "ん") {
    endGame("shiritori", `「ん」で終わり。あなたの負け！でも${shiritoriChainCount}回続いたよ。分布の尾を感じた？`);
    return;
  }
  if (shiritoriUsedWords.has(userWordLogic)) { messageElem.textContent = "その言葉はもう使ったよ！"; return; }
  if (!isShiritoriMatch(shiritoriCurrentWordForLogic, userWordLogic)) {
    const requiredChar = getShiritoriLastChar(shiritoriCurrentWordForLogic);
    messageElem.textContent = `「${requiredChar}」からはじめてみて！`;
    return;
  }

  shiritoriCurrentWordForDisplay = userWordRaw;
  shiritoriCurrentWordForLogic = userWordLogic;
  shiritoriUsedWords.add(userWordLogic);
  shiritoriChainCount++;
  updateVocabularyAndStats(userWordRaw, null, "game_used");
  gainXp(1);

  const li = document.createElement('li');
  li.textContent = `${userWordRaw} (あなた)`;
  historyList.prepend(li);
  document.getElementById('shiritoriPrevWord').textContent = userWordRaw;
  userInputField.value = '';
  messageElem.textContent = "いいね！次はぷぷの番…";
  document.getElementById('shiritoriTurnIndicator').textContent = `${AI_NAME}の番 (考え中...)`;
  userInputField.disabled = true;
  document.getElementById('shiritoriSubmitBtn').disabled = true;

  setTimeout(aiShiritoriTurn, 600 + Math.random() * 1200);
}

function aiShiritoriTurn() {
  const lastCharForAIStart = getShiritoriLastChar(shiritoriCurrentWordForLogic);

  let aiCandidates = Object.keys(aiState.vocabulary)
    .map(displayWord => ({ display: displayWord, logic: katakanaToHiragana(displayWord.toLowerCase()) }))
    .filter(obj =>
      isShiritoriMatch(lastCharForAIStart, obj.logic) &&
      obj.logic.slice(-1) !== "ん" &&
      !shiritoriUsedWords.has(obj.logic) &&
      obj.logic.length >= 2
    );

  let aiWordObj = null;
  if (aiCandidates.length > 0) {
    aiWordObj = aiCandidates[Math.floor(Math.random() * aiCandidates.length)];
  } else {
    const fallbackWordsByStartChar = {
      "あ": ["あり","あめ"], "い": ["いぬ","いちご"], "う": ["うさぎ","うみ"], "え": ["えんぴつ","えだ"], "お": ["おに","おしろ"],
      "か": ["かめ","かばん"], "き": ["きりん","きっぷ"], "く": ["くま","くるま"], "け": ["ケーキ","けむり"], "こ": ["こども","こっぷ"],
      "さ": ["さかな","さいふ"], "し": ["しりとり","しんぶん"], "す": ["すいか","すずめ"], "せ": ["せんたく","せかい"], "そ": ["そら","ぞう"],
      "た": ["たこ","たまご"], "ち": ["チーズ","ちきゅう"], "つ": ["つくえ","つみき"], "て": ["テレビ","てがみ"], "と": ["とまと","とけい"],
      "な": ["なす","なべ"], "に": ["にんじん","にわ"], "ぬ": ["ぬいぐるみ","ぬの"], "ね": ["ねこ","ねぎ"], "の": ["のり","ノート"],
      "は": ["バナナ","はな"], "ひ": ["ひこうき","ひよこ"], "ふ": ["ふく","ふね"], "へ": ["ヘビ","へや"], "ほ": ["ボール","ほし"],
      "ま": ["まんま","マスク"], "み": ["みかん","みみ"], "む": ["むし","むら"], "め": ["メガネ","めだま"], "も": ["もも","もち"],
      "や": ["やま","ゆきだるま"], "ゆ": ["ゆめ","ゆび"], "よ": ["ヨーグルト","よる"],
      "ら": ["ラジオ","らいおん"], "り": ["りんご","りす"], "る": ["ルーペ","るすばん"], "れ": ["レモン","れんが"], "ろ": ["ロウソク","ろば"],
      "わ": ["わに","わたあめ"], "を": ["おに"], "ん":[]
    };
    let potential = (fallbackWordsByStartChar[lastCharForAIStart] || [])
      .map(fw => ({ display: fw, logic: katakanaToHiragana(fw.toLowerCase()) }))
      .filter(obj => !shiritoriUsedWords.has(obj.logic) && obj.logic.slice(-1) !== 'ん');
    if(potential.length>0) aiWordObj = potential[Math.floor(Math.random()*potential.length)];
  }

  const messageElem = document.getElementById('shiritoriMessage');
  const historyList = document.getElementById('shiritoriHistory');
  const userInputField = document.getElementById('shiritoriUserInput');
  const submitBtn = document.getElementById('shiritoriSubmitBtn');

  if (aiWordObj) {
    shiritoriCurrentWordForDisplay = aiWordObj.display;
    shiritoriCurrentWordForLogic = aiWordObj.logic;
    shiritoriUsedWords.add(aiWordObj.logic);
    shiritoriChainCount++;
    updateVocabularyAndStats(aiWordObj.display, null, "game_used");
    gainXp(1);

    const li = document.createElement('li');
    li.textContent = `${aiWordObj.display} (${AI_NAME})`;
    historyList.prepend(li);
    document.getElementById('shiritoriPrevWord').textContent = aiWordObj.display;
    messageElem.textContent = `${AI_NAME}「${aiWordObj.display}！」 分布の“続きやすさ”感じる？ 次どうぞ！`;
    document.getElementById('shiritoriTurnIndicator').textContent = "あなたの番";
    userInputField.disabled = false; submitBtn.disabled = false; userInputField.focus();

    if (aiWordObj.logic.slice(-1) === "ん") {
      endGame("shiritori", `${AI_NAME}が「ん」で終わった！あなたの勝ち！${shiritoriChainCount}回続いたね！`);
    }
  } else {
    endGame("shiritori", `${AI_NAME}「うーん、思いつかない…」あなたの勝ち！${shiritoriChainCount}回も続いた！`);
  }
}

// --- 共通：ゲーム終了・モーダル ---
function closeMiniGameModal() {
  if (gameTimer) clearInterval(gameTimer);
  gameTimer = null;
  miniGameModal.style.display = 'none';
  currentGame = null;
  if(userInput && !userInput.disabled) userInput.focus();
  updateDisplay();
}

function endGame(gameType, resultMessage) {
  if (gameTimer) clearInterval(gameTimer);
  gameTimer = null;

  let loveBonus = 0;
  let pupuMessage = "";
  let additionalInfo = "";

  if (gameType === "wordCollect" || gameType === "tokenize") {
    loveBonus = Math.max(10, gameScore * 3);
    gainXp(12);
    pupuMessage = `トークナイズ理解、いい感じ！ モデルは“かたまり”で読むんだよ。`;
    additionalInfo = ` (+${loveBonus} 愛情度)`;
  } else if (gameType === "errand") {
    if (resultMessage.includes("成功")) {
      loveBonus = 60; gainXp(20);
      pupuMessage = `やった！報酬を集めて汎化に到達！ 強化学習の直感つかめたね！`;
    } else {
      loveBonus = 20; gainXp(6);
      pupuMessage = `惜しい！でも体感できたね。次は壁（損失）をもっと避けてみよう。`;
    }
    additionalInfo = ` (+${loveBonus} 愛情度)`;
  } else if (gameType === "shiritori") {
    if (resultMessage.includes("勝ち") || resultMessage.includes("成功")) {
      loveBonus = Math.max(10, shiritoriChainCount * 4);
      gainXp(10);
      pupuMessage = `分布の“続きやすさ”の感覚、ナイス！`;
    } else {
      loveBonus = Math.max(6, shiritoriChainCount * 2);
      gainXp(6);
      pupuMessage = `いい勝負！またやろう！`;
    }
    additionalInfo = ` (+${loveBonus} 愛情度)`;
  }

  if(loveBonus > 0) {
    aiState.love += loveBonus;
    addMessageToLog(AI_NAME, pupuMessage + additionalInfo, 'system-message');
  } else {
    addMessageToLog(AI_NAME, pupuMessage, 'system-message');
  }

  const messageElem = document.getElementById(`${gameType}Message`);
  if (messageElem) messageElem.textContent = resultMessage;

  updateDisplay();
  saveAiState();
}

// --- 初期化 ---
function initialize() {
  // DOM要素取得
  loveCountElem = document.getElementById('loveCount');
  chatArea = document.getElementById('chatArea');
  userInput = document.getElementById('userInput');
  sendButton = document.getElementById('sendButton');
  statusButton = document.getElementById('statusButton');
  resetButton = document.getElementById('resetButton');
  teachButton = document.getElementById('teachButton');
  loadingIndicator = document.getElementById('loading');
  apiSetupSection = document.getElementById('apiSetup');
  apiKeyInput = document.getElementById('apiKeyInput');
  phaseIconElem = document.getElementById('phaseIcon');
  phaseNameElem = document.getElementById('phaseName');
  vocabCountElem = document.getElementById('vocabCount');
  responseCountElem = document.getElementById('responseCount');
  structureLevelElem = document.getElementById('structureLevel');
  masteredPercentElem = document.getElementById('masteredPercent');
  progressFillElem = document.getElementById('progressFill');
  celebrationModal = document.getElementById('celebrationModal');
  celebrationPhaseIconElem = document.getElementById('celebrationPhaseIcon');
  celebrationTextElem = document.getElementById('celebrationText');
  celebrationFeaturesElem = document.getElementById('celebrationFeatures');
  aiCharacterDisplayArea = document.getElementById('aiCharacterDisplayArea');
  aiCharacterImage = document.getElementById('aiCharacterImage');
  aiSpeechBubble = document.getElementById('aiSpeechBubble');
  aiSpeechText = document.getElementById('aiSpeechText');
  miniGameModal = document.getElementById('miniGameModal');
  miniGameTitle = document.getElementById('miniGameTitle');
  miniGameArea = document.getElementById('miniGameArea');
  closeMiniGameBtn = document.getElementById('closeMiniGameBtn');
  showApiSetupBtn = document.getElementById('showApiSetupBtn');
  saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
  closeCelebrationBtn = document.getElementById('closeCelebrationBtn');

  // イベントリスナー
  sendButton.addEventListener('click', sendMessage);
  userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !sendButton.disabled) { e.preventDefault(); sendMessage(); }
  });
  resetButton.addEventListener('click', resetAI);
  statusButton.addEventListener('click', showStatus);
  teachButton.addEventListener('click', teachWord);
  showApiSetupBtn.addEventListener('click', showApiSetup);
  saveApiKeyBtn.addEventListener('click', saveApiKey);
  closeCelebrationBtn.addEventListener('click', closeCelebration);

  // ミニゲームのイベントリスナー（ボタンIDは既存を流用）
  document.getElementById('startGame1Btn').addEventListener('click', startGameWordCollect); // tokenize
  document.getElementById('startGame2Btn').addEventListener('click', startGameErrand); // RLごっこ
  document.getElementById('startGame3Btn').addEventListener('click', startGameShiritori); // 分布感覚
  closeMiniGameBtn.addEventListener('click', closeMiniGameModal);

  // 初期化処理
  loadAiState();
  const apiKeyExists = loadApiKey();
  chatArea.innerHTML = '';
  aiState.dialogue_history.forEach(turn => {
    const speaker = turn.role === "user" ? 'あなた' : AI_NAME;
    addMessageToLog(speaker, turn.parts[0].text);
  });

  if (apiKeyExists && aiState.dialogue_history.length === 0) addInitialAiGreeting();
  else if (!apiKeyExists) addMessageToLog('システム', 'ようこそ！まずGemini APIキーを設定してください。', 'system-message');

  updateDisplay();
}

document.addEventListener('DOMContentLoaded', initialize);





