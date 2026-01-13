// --- グローバル定数 ---
const AI_NAME = "ぷぷ";
const STORAGE_KEY_STATE = 'pupuAiState_v3'; 
const STORAGE_KEY_API_KEY = 'pupuGeminiApiKey_v1';
const GAME_NAME_ERRAND = "アルゴスケイプ（強化学習ごっこ）"; 

// --- グローバル変数 ---
let geminiApiKey = '';
let aiState = {}; 
let speechBubbleTimeout = null;
let currentGame = null; 
let gameTimer = null;
let gameScore = 0;
let gameTimeLeft = 0;
let currentTopicWord = "";
let shiritoriChainCount = 0; 

// アルゴスケイプ用
let playerPos = { x: 0, y: 0 };
let mapGrid = [];
let errandItemsToGet = [];
const TILE_SIZE = 24; 
const MAP_WIDTH_TILES = 15;
const MAP_HEIGHT_TILES = 10;
let errandSteps = 0; 
let qValues = Array(MAP_HEIGHT_TILES).fill(null).map(() => 
    Array(MAP_WIDTH_TILES).fill(null).map(() => [0, 0, 0, 0])
);
const Q_LEARNING_RATE = 0.5;
const Q_PENALTY_RATE = -10;
const Q_REWARD_RATE = 20;

// Game1 (Tokenize) 用
let tokenizeData = { sentence: "", correctTokens: [], options: [] }; 
let currentSegments = []; 
let allCorrectTokens = new Set(); 
let consecutiveHits = 0; 

// Game3 (連想ゲーム) 用
const 連想候補数 = 5;
let shiritoriUsedWords = new Set(); 

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
    triggers: [{ type: "vocab_count", threshold: 5 }, { type: "structure_level", threshold: 1}],
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
    icon: "🐲", next_phase: "ヨチヨチドラゴン", "image": "assets/pupu_phase3.png",
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
    icon: "🐉", next_phase: "チビドラゴン", "image": "assets/pupu_phase4.png",
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
    icon: "👶", next_phase: "わんぱくドラゴン", "image": "assets/pupu_phase5.png",
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
    icon: "👦", next_phase: "ジュニアドラゴン", "image": "assets/pupu_phase6.png",
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
    icon: "🧑‍🤝‍🧑", next_phase: "ティーンエイジドラゴン", "image": "assets/pupu_phase7.png",
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
    icon: "👩‍🎓", next_phase: "ヤングアダルトドラゴン", "image": "assets/pupu_phase8.png",
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
    icon: "💼", next_phase: "グロースドラゴン", "image": "assets/pupu_phase9.png",
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
    icon: "👑", next_phase: null, "image": "assets/pupu_phase10.png",
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
let loveCountElem, chatArea, userInput, sendButton, statusButton, resetButton, teachButton, loadingIndicator, apiSetupSection, apiKeyInput, phaseIconElem, phaseNameElem, vocabCountElem, responseCountElem, structureLevelElem, masteredPercentElem, progressFillElem, celebrationModal, celebrationPhaseIconElem, celebrationTextElem, celebrationFeaturesElem, aiCharacterDisplayArea, aiCharacterImage, aiSpeechBubble, aiSpeechText, miniGameModal, miniGameTitle, miniGameArea, closeMiniGameBtn, showApiSetupBtn, saveApiKeyBtn, closeCelebrationBtn;

// --- 仮のDOM要素とテンプレート定義 ---
const setupDummyDOM = () => {
    const createElement = (id, tag = 'div', style = {}) => {
        let el = document.getElementById(id);
        if (el) return el;
        el = document.createElement(tag);
        el.id = id;
        Object.assign(el.style, style);
        if(id === 'celebrationModal') el.classList.add('modal');
        if(id === 'apiSetup') el.classList.add('setup-section');
        return el;
    };
    
    loveCountElem = createElement('loveCount', 'span');
    chatArea = createElement('chatArea');
    userInput = createElement('userInput', 'input');
    sendButton = createElement('sendButton', 'button');
    statusButton = createElement('statusButton', 'button');
    resetButton = createElement('resetButton', 'button');
    teachButton = createElement('teachButton', 'button');
    loadingIndicator = createElement('loading', 'span', {display: 'none'});
    apiSetupSection = createElement('apiSetup', 'section');
    apiKeyInput = createElement('apiKeyInput', 'input');
    phaseIconElem = createElement('phaseIcon', 'span');
    phaseNameElem = createElement('phaseName', 'span');
    vocabCountElem = createElement('vocabCount', 'span');
    responseCountElem = createElement('responseCount', 'span');
    structureLevelElem = createElement('structureLevel', 'span');
    masteredPercentElem = createElement('masteredPercent', 'span');
    progressFillElem = createElement('progressFill', 'div');
    aiCharacterDisplayArea = createElement('aiCharacterDisplayArea');
    aiCharacterImage = createElement('aiCharacterImage', 'img');
    aiSpeechBubble = createElement('aiSpeechBubble', 'div');
    aiSpeechText = createElement('aiSpeechText', 'span');
    miniGameModal = createElement('miniGameModal', 'div', {display: 'none'});
    miniGameTitle = createElement('miniGameTitle', 'h2');
    miniGameArea = createElement('miniGameArea', 'div');
    closeMiniGameBtn = createElement('closeMiniGameBtn', 'button');
    showApiSetupBtn = createElement('showApiSetupBtn', 'button');
    saveApiKeyBtn = createElement('saveApiKeyBtn', 'button');
    closeCelebrationBtn = createElement('closeCelebrationBtn', 'button');
    
    celebrationModal = createElement('celebrationModal', 'div', {display: 'none', position: 'fixed', top: '0'});
    const modalContent = createElement('celebrationContent', 'div');
    const contentBody = createElement('celebrationContentBody', 'div', {className: 'content-body', padding: '15px'});
    celebrationPhaseIconElem = createElement('celebrationPhaseIcon', 'span', {fontSize: '2em'});
    celebrationTextElem = createElement('celebrationText', 'p');
    celebrationFeaturesElem = contentBody;
    
    modalContent.appendChild(celebrationPhaseIconElem);
    modalContent.appendChild(celebrationTextElem);
    modalContent.appendChild(contentBody);
    modalContent.appendChild(closeCelebrationBtn);
    celebrationModal.appendChild(modalContent);

    createElement('startGame1Btn', 'button');
    createElement('startGame2Btn', 'button');
    createElement('startGame3Btn', 'button');
};

// --- ユーティリティ関数 ---
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
function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }

// --- 状態管理 ---
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
    love: 0,          
    xp: 0,            
    traits: {         
      curiosity: 0,   
      empathy: 0,     
      mischief: 0,    
      diligence: 0    
    },
    memories: { userName: null, likes: [], dislikes: [] },
    trait_log: []     
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

// --- 語彙学習・ステータス更新 ---
function getSimpleWordsFromText(text) {
  if (!text) return [];
  const words = text.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FEA\u3005-\u3007a-zA-Z0-9]+/g);
  return words ? words.filter(w => w.length > 0) : [];
}

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

  const transitionDetails = { currentVocab: aiState.learned_words_count, nextVocabNeeded: null, nextLevelNeeded: null };

  if (ok) {
    for (const t of current.triggers || []) {
      if (t.type === "vocab_count") {
        transitionDetails.nextVocabNeeded = t.threshold;
        if (aiState.learned_words_count < t.threshold) { ok=false; }
      }
      if (t.type === "structure_level") {
        transitionDetails.nextLevelNeeded = t.threshold;
        if (aiState.structure_level < t.threshold) { ok=false; }
      }
    }
  }

  if (ok && (aiState.structure_level < (next.min_structure_level_to_reach || 1))) ok=false;

  if (ok) {
    aiState.love += 100;
    aiState.xp += 500;
    aiState.phase_name = nextName;
    aiState.phase_icon = next.icon;
    
    const dominantTraits = Object.entries(aiState.traits)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 2)
        .filter(([, val]) => val > 0);
        
    return { changed:true, newPhase: nextName, oldPhase: current.prompt_template, transitionDetails, dominantTraits };
  }
  return { changed:false };
}

// --- Gemini API呼び出し ---
async function callGeminiAPI(promptContent, isGamePrompt = false) {
  if (!geminiApiKey) throw new Error('APIキーが設定されていません。');

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
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_CIVIC_INTEGRITY", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
    ]
  };

  const errorStack = [];

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

      if (!res.ok) {
        errorStack.push({
          model: MODEL_NAME,
          httpStatus: res.status,
          errorMessage: data?.error?.message || "不明なAPIエラー",
          errorCode: data?.error?.status || null
        });
        continue; 
      }

      const text = extractText(data);
      if (text) return text;

      errorStack.push({
        model: MODEL_NAME,
        httpStatus: 200,
        errorMessage: "候補が返らずテキストが抽出できませんでした。",
        blockReason: data?.promptFeedback?.blockReason || null,
        safetyRatings: data?.promptFeedback?.safetyRatings || null
      });
      continue;
    } catch (e) {
      errorStack.push({
        model: MODEL_NAME,
        httpStatus: null,
        errorMessage: e?.message || String(e)
      });
      continue;
    }
  }

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

// --- 会話プロンプト合成 ---
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
  if(loveCountElem) loveCountElem.textContent = aiState.love;
  if(phaseIconElem) phaseIconElem.textContent = aiState.phase_icon;
  if(phaseNameElem) phaseNameElem.textContent = aiState.phase_name;
  if(vocabCountElem) vocabCountElem.textContent = aiState.learned_words_count;
  if(responseCountElem) responseCountElem.textContent = aiState.total_responses;
  if(structureLevelElem) structureLevelElem.textContent = aiState.structure_level;

  const currentPhaseConfig = PHASES_CONFIG[aiState.phase_name];
  if (aiCharacterImage) {
      if (currentPhaseConfig?.image) {
          aiCharacterImage.src = currentPhaseConfig.image;
          aiCharacterImage.alt = `${aiState.phase_name}の${AI_NAME}`;
      }
  }

  const masteredCount = Object.values(aiState.vocabulary).filter(v => v.mastered).length;
  const percent = aiState.learned_words_count > 0 ? Math.round((masteredCount / aiState.learned_words_count) * 100) : 0;
  if(masteredPercentElem) masteredPercentElem.textContent = `${percent}%`;

  let progressPercent = 0;
  if (currentPhaseConfig?.next_phase) {
    const vocabTrigger = currentPhaseConfig.triggers?.find(t => t.type === "vocab_count");
    if (vocabTrigger) progressPercent = Math.min(100, (aiState.learned_words_count / vocabTrigger.threshold) * 100);
  } else {
    progressPercent = 100;
  }
  if(progressFillElem) progressFillElem.style.width = `${progressPercent}%`;
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
  if(chatArea) {
      chatArea.appendChild(messageDiv);
      chatArea.scrollTop = chatArea.scrollHeight;
  }

  if (speaker === AI_NAME && !type.startsWith('system') && aiSpeechText && aiSpeechBubble) {
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
    if(apiKeyInput) apiKeyInput.value = savedKey;
    if(apiSetupSection) apiSetupSection.classList.remove('show');
    if(userInput) userInput.disabled = false;
    if(sendButton) sendButton.disabled = false;
    if(aiCharacterDisplayArea) aiCharacterDisplayArea.style.display = 'block';
    return true;
  } else {
    if(apiSetupSection) apiSetupSection.classList.add('show');
    if(userInput) userInput.disabled = true;
    if(sendButton) sendButton.disabled = true;
    if(aiCharacterDisplayArea) aiCharacterDisplayArea.style.display = 'none';
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

function showApiSetup() { if(apiSetupSection) apiSetupSection.classList.add('show'); }

function addInitialAiGreeting() {
  if (aiState.dialogue_history.length > 0 && aiState.dialogue_history[aiState.dialogue_history.length - 1].role === 'model') return;
  const initial = aiState.phase_name === "たまごドラゴン" ? "…ぷ（だれ？）" : "ぷぷー！お話しよ！";
  addMessageToLog(AI_NAME, initial);
  aiState.dialogue_history.push({ role: "model", parts: [{ text: initial }] });
  saveAiState();
}

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
  if(loadingIndicator) loadingIndicator.style.display = 'block';

  if (speechBubbleTimeout) clearTimeout(speechBubbleTimeout);
  if(aiSpeechText) aiSpeechText.innerHTML = `${AI_NAME}考え中... 🤔`;
  if(aiSpeechBubble) aiSpeechBubble.style.display = 'flex';

  aiState.love += 1;
  updateTraitsFromUserUtterance(userText);
  updateVocabularyAndStats(userText, "user");
  gainXp(2);

  aiState.dialogue_history.push({ role: "user", parts: [{ text: userText }] });
  if (aiState.dialogue_history.length > 20) aiState.dialogue_history.splice(0, 2);

  const knownWords = Object.keys(aiState.vocabulary).filter(w => aiState.vocabulary[w].mastered);
  const vocabSample = knownWords.slice(0, 10).join('、') || "まだ言葉を知らない"; 

  const baseInstruction = buildConversationInstruction();
  const systemInstruction = `${baseInstruction}
（現在の愛情度:${aiState.love} / 知っている言葉:${aiState.learned_words_count}語 / 構文Lv:${aiState.structure_level}
サンプル語彙:${vocabSample}）`.replace(/\s+/g, " ").trim();

  const compactHistory = buildCompactHistory(aiState.dialogue_history, 8, 300);

  let sending = [
    { role: "user", parts: [{ text: systemInstruction }] },
    ...compactHistory
  ];

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
    updateVocabularyAndStats(null, "ai");
    gainXp(1);
    aiState.dialogue_history.push({ role: "model", parts: [{ text: aiResponseText }] });

    const phaseChangeResult = checkPhaseTransition();
    if (phaseChangeResult.changed) showCelebration(phaseChangeResult);
  } catch (error) {
    addMessageToLog('システム', `エラー: ${error.message}`, 'system-error');
    if(aiSpeechText) aiSpeechText.textContent = `あれれ？${AI_NAME}、こまっちゃったみたい…`;
  } finally {
    if(loadingIndicator) loadingIndicator.style.display = 'none';
    if(sendButton) sendButton.disabled = false;
    if(userInput) userInput.disabled = false;
    updateDisplay();
    saveAiState();
    if(userInput) userInput.focus();
  }
}

// --- お祝いモーダル (強化版) ---
function showCelebration(result) {
  const newPhaseName = result.newPhase;
  const phaseConfig = PHASES_CONFIG[newPhaseName];
  const nextPhase = PHASES_CONFIG[phaseConfig.next_phase];
  
  const contentBody = document.getElementById('celebrationContentBody');
  if (!contentBody) return;

  celebrationPhaseIconElem.textContent = phaseConfig.icon;
  
  const cuteMessages = [
    `わーい！${AI_NAME}、ちょっと大きくなったよ！`,
    `すごい！${AI_NAME}の体が光ったよ！新しい言葉がたくさん見える！`,
    `ひととの会話のおかげで、${AI_NAME}が一皮むけたみたい！`
  ];
  const message = cuteMessages[Math.floor(Math.random() * cuteMessages.length)];
  celebrationTextElem.innerHTML = `${message}<br><strong>「${newPhaseName}」</strong>に進化したよ！`;
  
  const featuresHtml = (phaseConfig.features || []).map(f => `<li style="list-style: none; padding-left: 1.2em; text-indent: -1.2em;">⭐ ${f}</li>`).join('');
  
  let traitHtml = '<h4 style="margin-bottom: 5px;">🧠 成長に貢献した個性</h4>';
  if (result.dominantTraits.length > 0) {
      traitHtml += `<p style="margin: 0;">特にあなたの行動で「${result.dominantTraits.map(([name]) => {
          if (name === 'curiosity') return '好奇心';
          if (name === 'empathy') return '共感';
          if (name === 'mischief') return 'やんちゃ';
          if (name === 'diligence') return 'まじめ';
          return name;
      }).join('」と「')}」が伸びたよ！</p>`;
  } else {
      traitHtml += `<p style="margin: 0;">まんべんなく成長したみたい！</p>`;
  }
  
  let nextGoalHtml = '<h4>🚀 次の目標</h4>';
  if (nextPhase) {
      const nextVocab = nextPhase.triggers?.find(t => t.type === "vocab_count")?.threshold;
      const nextLevel = nextPhase.min_structure_level_to_reach;
      
      nextGoalHtml += '<ul style="padding-left: 15px; margin-top: 0;">';
      if (nextVocab) nextGoalHtml += `<li>新しい言葉を**${nextVocab}語**まで覚えよう！ (現在: ${aiState.learned_words_count}語)</li>`;
      if (nextLevel) nextGoalHtml += `<li>言葉の使い方のレベルを**Lv.${nextLevel}**に上げよう！ (現在: Lv.${aiState.structure_level})</li>`;
      nextGoalHtml += '</ul>';
  } else {
      nextGoalHtml += `<p style="margin: 0;">これで「究極のドラゴン」だね！一緒にいる時間を楽しもう！</p>`;
  }

  contentBody.innerHTML = `${traitHtml}<hr style="margin: 10px 0;"><h4 style="margin-bottom: 5px;">🌟 新しい特長</h4><ul style="padding-left: 0; margin-top: 0;">${featuresHtml}</ul><hr style="margin: 10px 0;">${nextGoalHtml}`;

  celebrationModal.classList.add('show');
  celebrationModal.style.display = 'flex';
  updateDisplay();
}

function closeCelebration() { 
    celebrationModal.classList.remove('show'); 
    celebrationModal.style.display = 'none';
    const contentBody = document.getElementById('celebrationContentBody');
    if(contentBody) contentBody.innerHTML = '';
}

// --- ステータス表示 ---
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
    const mid = (val+100)/2;
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
  div.style.cssText = "text-align: left; max-width: 90%; width:520px; max-height:80vh; overflow-y:auto; background:white; border-radius: 8px; padding: 20px;";
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
    <button onclick="document.getElementById('statusModalContainer').remove()" style="margin-top: 15px; padding: 10px 20px; background: #ff758c; color: white; border: none; border-radius: 5一遍; cursor: pointer; display:block; margin-left:auto; margin-right:auto;">閉じる</button>
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
    if(apiKeyInput) apiKeyInput.value = '';
    if(chatArea) chatArea.innerHTML = '';
    if(aiCharacterDisplayArea) aiCharacterDisplayArea.style.display = 'none';
    if(aiSpeechBubble) aiSpeechBubble.style.display = 'none';
    if(aiSpeechText) aiSpeechText.textContent = '';
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
      if (phaseChangeResult.changed) showCelebration(phaseChangeResult);
    } else {
      addMessageToLog('システム', '有効な単語として認識できませんでした。ひらがな、カタカナ、漢字で入力してください。', 'system-error');
    }
  }
}

// =====================
// ミニゲーム（再定義）
// =====================

// --- Game1：AIトークン・ブレイク (tokenize) ---

function simpleTokenizerCandidates(sentence){
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
    "あしたはゆうえんちにいく",
    "りんごとミルクをかう",
    "AIはことばをまなぶ",
    "きょうのてんきははれ",
    "ドラゴンはげんき"
  ];
  let sentence = sampleSentences[Math.floor(Math.random()*sampleSentences.length)];
  let base = sentence.replace(/\s+/g,'').trim();
  let correctTokens = [];

  if (geminiApiKey) {
    try{
      const prompt = `以下の日本語の文を、AIモデルがトークン化する際によく見られる「サブワード」分割の形式で区切ってください。区切りには半角スペースのみを使用してください。ひらがなや助詞は、単独のトークンになることが多いです。
入力: きょうのてんきははれ
出力: きょう の てんき は はれ
入力: ${base}
出力: `;
      const res = await callGeminiAPI(prompt, true);
      const tokenizedLine = (res||"").split(/\n/).map(s=>s.trim()).filter(Boolean)[0];
      
      if (tokenizedLine && tokenizedLine.includes(' ')) {
          correctTokens = tokenizedLine.split(' ').filter(t => t.length > 0);
          base = correctTokens.join(''); 
      } else {
         const line = (res||"").split(/\n/).map(s=>s.trim()).filter(Boolean)[0];
         if (line && line.length<=20 && !line.includes(' ')) base = line;
      }
    }catch{}
  }
  
  if (correctTokens.length === 0) {
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
  
  miniGameTitle.textContent = "AIトークン・ブレイク（最小単位に分割！）"; 
  
  const newTemplate = document.createElement('div');
  newTemplate.innerHTML = `
    <div style="padding: 10px;">
        <div id="tokenizeGameTheme" style="font-size: small; color: #555; margin-bottom: 12px; font-weight: bold;">
            💡 AIが言葉を「最小の塊（トークン）」に分ける感覚をつかもう。
        </div>
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; background: #ffe4e9; padding: 8px; border-radius: 6px;">
            <div style="font-size: 1.2em; font-weight: bold;">スコア: <span id="tokenizeScore" style="color: #ff4081;">0</span></div>
            <div style="font-size: 1.2em; font-weight: bold;">残り時間: <span id="tokenizeTimeLeft" style="color: #1e88e5;">40</span>秒</div>
        </div>

        <div style="border: 2px solid #ccc; padding: 15px; border-radius: 8px; background: #fff; text-align: center;">
            <p style="margin: 0 0 8px; font-weight: bold; font-size: 1.1em;">問題文を分割！</p>
            
            <div id="tokenizeTokensArea" style="min-height: 40px; display: flex; flex-wrap: wrap; align-items: center; line-height: 1.6; justify-content: center; font-size: 1.3em;">
                <!-- 分割されたトークン操作UIがここに入る -->
            </div>
            
            <small id="tokenizeGuideText" style="display: block; margin-top: 10px; color: #888;">
                区切りたい**隙間**の点線をクリック！
            </small>
        </div>

        <div id="tokenizeResultArea" style="margin-top: 15px; padding: 10px; border: 1px dashed #b3e0ff; background: #f0f8ff; border-radius: 5px; font-size: small;">
            <p style="margin: 0; font-weight: bold; color: #007bff;">🤖 AIの理想分割（参照）</p>
            <p style="margin: 3px 0 0; word-break: break-all;"><span id="correctTokensText"></span></p>
        </div>

        <p id="tokenizeMessage" style="margin-top: 15px; font-size: small; color: #d32f2f; font-weight: bold;"></p>
    </div>
  `;
  miniGameArea.innerHTML = '';
  miniGameArea.appendChild(newTemplate);

  const objectsArea = document.getElementById('tokenizeTokensArea');
  const correctTokensTextElem = document.getElementById('correctTokensText');
  const messageElem = document.getElementById('tokenizeMessage');

  objectsArea.innerHTML = '';
  gameScore = 0;
  gameTimeLeft = 40;
  consecutiveHits = 0; 
  
  await setupNewTokenizeTask();

  document.getElementById('tokenizeScore').textContent = gameScore;
  document.getElementById('tokenizeTimeLeft').textContent = gameTimeLeft;
  
  messageElem.textContent = `${AI_NAME}「AIは長い言葉を効率のいいかたまり（トークン）に分けるよ。レディ・ゴー！」`;

  gameTimer = setInterval(async ()=>{
    gameTimeLeft--;
    document.getElementById('tokenizeTimeLeft').textContent = gameTimeLeft;
    if (gameTimeLeft<=0){
        clearInterval(gameTimer);
        handleGameEnd();
    }
  },1000);
}

async function setupNewTokenizeTask() {
    await generateTokenizeTask();

    const correctTokensTextElem = document.getElementById('correctTokensText');
    const messageElem = document.getElementById('tokenizeMessage');

    allCorrectTokens = new Set(tokenizeData.correctTokens);
    currentSegments = [tokenizeData.sentence];
    correctTokensTextElem.textContent = tokenizeData.correctTokens.join(" | ");

    renderSegmentsAndCheckCompletion();

    const learnedCount = allCorrectTokens.size;
    aiState.love += Math.floor(learnedCount * 1.5); 
    updateDisplay();
    messageElem.textContent = `${AI_NAME}「新しい文だよ！トークン化開始！」`;
}

function renderSegmentsAndCheckCompletion() {
    const objectsArea = document.getElementById('tokenizeTokensArea');
    const correctTokens = tokenizeData.correctTokens;
    const messageElem = document.getElementById('tokenizeMessage');
    const guideElem = document.getElementById('tokenizeGuideText');

    objectsArea.innerHTML = '';
    
    const finalSegments = currentSegments.filter(s => s.length > 0);
    const isPerfectMatch = finalSegments.length === correctTokens.length && finalSegments.every((seg, idx) => seg === correctTokens[idx]);

    if (isPerfectMatch) {
        let bonus = 100 + consecutiveHits * 20; 
        gameScore += bonus;
        consecutiveHits++; 
        
        updateVocabularyAndStats(finalSegments.join(' '), null, "game_tokenize");
        gainXp(20 + consecutiveHits * 5);
        
        document.getElementById('tokenizeScore').textContent = gameScore;
        messageElem.textContent = `🎊 **PERFECT!** (+${bonus}点) 連続 ${consecutiveHits} 回！AIの理解度MAX！`;
        guideElem.textContent = '🌟 次の問題を読み込み中 🌟';
        
        setTimeout(setupNewTokenizeTask, 1500);
        return; 
    }
    
    currentSegments.forEach((segment, segmentIndex) => {
        const container = document.createElement('span');
        container.className = 'token-segment';
        
        let bgColor = 'transparent';
        if (segment.length > 0) {
            if (allCorrectTokens.has(segment)) {
                bgColor = '#d4edda';
                container.title = "正解のトークン！";
            } else if (finalSegments.length > correctTokens.length) {
                 if(segment.length <= 2) bgColor = '#f8d7da'; 
            }
        }
        
        for(let charIdx=0; charIdx<segment.length; charIdx++){
            const charSpan = document.createElement('span');
            charSpan.textContent = segment[charIdx];
            charSpan.className = 'token-char';
            charSpan.style.backgroundColor = bgColor;
            container.appendChild(charSpan);

            if (charIdx < segment.length - 1){
                 const breakPoint = document.createElement('span');
                 breakPoint.className = 'break-point';
                 breakPoint.dataset.segmentIndex = segmentIndex;
                 breakPoint.dataset.splitIndex = charIdx + 1; 
                 
                 breakPoint.style.cssText = 'cursor: pointer; border-right: 2px dashed #999; padding: 0 4px; margin: 0 1px; transition: all 0.2s;';
                 
                 breakPoint.onmouseover = ()=> breakPoint.style.borderRight = '2px dashed #ff4081';
                 breakPoint.onmouseout = ()=> breakPoint.style.borderRight = '2px dashed #999';
                 breakPoint.title = 'トークンを分割';

                 breakPoint.onclick = handleSegmentSplit;
                 container.appendChild(breakPoint);
            }
        }
        
        objectsArea.appendChild(container);
    });
}

function handleSegmentSplit(e) {
    const messageElem = document.getElementById('tokenizeMessage');
    const segIdx = parseInt(e.target.dataset.segmentIndex);
    const splitIdx = parseInt(e.target.dataset.splitIndex);
    
    const targetSegment = currentSegments[segIdx];
    const newPart1 = targetSegment.slice(0, splitIdx);
    const newPart2 = targetSegment.slice(splitIdx);
    
    currentSegments.splice(segIdx, 1, newPart1, newPart2);
    
    let isHit = allCorrectTokens.has(newPart1) || allCorrectTokens.has(newPart2);
    let scoreChange = isHit ? 2 : -1;

    gameScore = Math.max(0, gameScore + scoreChange);
    document.getElementById('tokenizeScore').textContent = gameScore;
    
    if(isHit) {
        messageElem.textContent = `✅ いい分割！AIの学習効率が上がったよ！ (+2)`;
    } else {
        messageElem.textContent = `${AI_NAME}「ちょっと細かすぎたかも…。」 (-1) `;
        consecutiveHits = 0; 
    }

    renderSegmentsAndCheckCompletion(); 
}

function handleGameEnd() {
    const messageElem = document.getElementById('tokenizeMessage');
    
    const finalSegments = currentSegments.filter(s => s.length > 0);
    let finalCorrectCount = 0;
    
    finalSegments.forEach(seg => { if(allCorrectTokens.has(seg)) finalCorrectCount++; });

    const msg = `タイムアップ！最終スコア: ${gameScore}点。\nトークン化された語彙数: ${finalCorrectCount} / ${allCorrectTokens.size}。\n\nAIは文章を、頻繁に使われる「サブワード」に分割して学習するよ。分割の重要性がわかったかな？`;
    
    endGame("tokenize", msg);
}


// --- Game2：アルゴスケイプ（強化学習ごっこ） ---

function startGameErrand() {
    if (currentGame) return;
    currentGame = "errand";
    miniGameModal.style.display = 'flex';
    miniGameTitle.textContent = GAME_NAME_ERRAND + "（Q値可視化モード）";

    const template = document.createElement('div');
    template.id = 'errandGameTemplateContent';
    template.innerHTML = `
        <div id="errandTheme" style="font-size: small; color: #555; margin-bottom: 12px; font-weight: bold;">
            🧠 報酬(Reward)を目指し、損失(Loss)を避けろ！移動で学習(Q値)が溜まるよ。
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; background: #fff8e1; padding: 8px; border-radius: 6px;">
            <div style="font-size: 1.2em; font-weight: bold;">学習ステップ: <span id="errandScore" style="color: #ff9800;">0</span></div>
            <div style="font-size: 1em; font-weight: bold; color: #555;"><span id="errandObjective"></span></div>
        </div>
        <div style="text-align: center;">
            <div id="errandMapArea" style="position: relative; margin: 0 auto; border: 1px solid #000; display: inline-block;">
                <div id="errandPlayer" class="map-item" style="position: absolute; width:${TILE_SIZE}px; height:${TILE_SIZE}px; background:#4CAF50; border-radius:50%; z-index:10; transition: all 0.2s;">ぷぷ</div>
            </div>
        </div>
        <div id="errandControls" style="text-align: center; margin-top: 15px;">
            <button data-direction="up" style="display: block; margin: 0 auto;">↑ (W)</button>
            <button data-direction="left">← (A)</button>
            <button data-direction="down">↓ (S)</button>
            <button data-direction="right">→ (D)</button>
        </div>
        <p id="errandMessage" style="margin-top: 15px; font-size: small; color: #555;"></p>
    `;
    miniGameArea.innerHTML = '';
    miniGameArea.appendChild(template);

    const mapAreaElem = document.getElementById('errandMapArea');
    if (mapAreaElem) {
        mapAreaElem.style.width = `${MAP_WIDTH_TILES * TILE_SIZE}px`;
        mapAreaElem.style.height = `${MAP_HEIGHT_TILES * TILE_SIZE}px`;
    }

    initializeErrandMap();
    drawErrandMap();
    updateErrandObjective();
    document.getElementById('errandScore').textContent = `ステップ: ${errandSteps}`; 

    document.getElementById('errandMessage').textContent =
        `${AI_NAME}「どこへ行くと報酬がもらえるか、学習（移動）して探ろう！壁は損失だよ！」`;

    document.querySelectorAll('#errandControls button').forEach(btn => {
        btn.onclick = (e) => movePlayerErrand(e.target.dataset.direction);
        btn.disabled = false;
    });
}

function handleErrandKeyboardInput(e) {
    if (currentGame !== "errand" || miniGameModal.style.display !== 'flex') return;
    let direction = null;
    if (e.key === 'ArrowUp' || e.key === 'w') direction = 'up';
    else if (e.key === 'ArrowDown' || e.key === 's') direction = 'down';
    else if (e.key === 'ArrowLeft' || e.key === 'a') direction = 'left';
    else if (e.key === 'ArrowRight' || e.key === 'd') direction = 'right';

    if (direction) {
        e.preventDefault(); 
        movePlayerErrand(direction);
    }
}

function initializeErrandMap() {
    mapGrid = Array(MAP_HEIGHT_TILES).fill(null).map(() => Array(MAP_WIDTH_TILES).fill(0));
    playerPos = { x: 0, y: 0 };
    errandSteps = 0; 
    qValues = Array(MAP_HEIGHT_TILES).fill(null).map(() => 
      Array(MAP_WIDTH_TILES).fill(null).map(() => [0, 0, 0, 0])
    );

    for(let i=0; i < MAP_WIDTH_TILES * MAP_HEIGHT_TILES * 0.15; i++) {
      const rx = Math.floor(Math.random() * MAP_WIDTH_TILES);
      const ry = Math.floor(Math.random() * MAP_HEIGHT_TILES);
      if ((rx === 0 && ry === 0) || (rx === 1 && ry === 0) || (rx === 0 && ry === 1)) continue;
      mapGrid[ry][rx] = 1; 
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
    placeItem(2);
    placeItem(3); 
    placeItem(4); 

    errandItemsToGet = [
      { name: "データA", storeId: 2, collected: false, icon: "🍎", reward: 50 },
      { name: "データB", storeId: 3, collected: false, icon: "🥛", reward: 70 }
    ];
}

function drawErrandMap() {
    const mapArea = document.getElementById('errandMapArea');
    const playerElem = document.getElementById('errandPlayer');
    if (!mapArea || !playerElem) return;

    mapArea.innerHTML = '';
    mapArea.appendChild(playerElem);

    for (let r = 0; r < MAP_HEIGHT_TILES; r++) {
      for (let c = 0; c < MAP_WIDTH_TILES; c++) {
        const tileValue = mapGrid[r][c];
        
        const tileDiv = document.createElement('div');
        tileDiv.className = 'map-tile';
        tileDiv.style.width = `${TILE_SIZE}px`;
        tileDiv.style.height = `${TILE_SIZE}px`;
        tileDiv.style.left = `${c * TILE_SIZE}px`;
        tileDiv.style.top = `${r * TILE_SIZE}px`;
        tileDiv.style.position = 'absolute';
        tileDiv.style.boxSizing = 'border-box';
        
        if (tileValue === 1) {
          tileDiv.style.backgroundColor = '#a1887f'; 
          tileDiv.title = "損失の谷（Loss）";
          mapArea.appendChild(tileDiv);
          continue;
        }
        
        const q = qValues[r][c];
        const directions = ['up', 'down', 'left', 'right'];
        const directionMap = { 'up': 0, 'down': 1, 'left': 2, 'right': 3 };
        
        directions.forEach(dir => {
          const idx = directionMap[dir];
          const qVal = q[idx];
          const bar = document.createElement('div');
          
          let color = qVal > 0 ? '#4caf50' : qVal < 0 ? '#f44336' : '#999';
          let size = Math.min(TILE_SIZE / 2, Math.abs(qVal) / 20 * TILE_SIZE / 2);

          bar.style.position = 'absolute';
          
          if (dir === 'up') bar.style.cssText += `top: 0; left: 50%; transform: translateX(-50%); width: 2px; height: ${size}px; background: ${color};`;
          if (dir === 'down') bar.style.cssText += `bottom: 0; left: 50%; transform: translateX(-50%); width: 2px; height: ${size}px; background: ${color};`;
          if (dir === 'left') bar.style.cssText += `top: 50%; left: 0; transform: translateY(-50%); height: 2px; width: ${size}px; background: ${color};`;
          if (dir === 'right') bar.style.cssText += `top: 50%; right: 0; transform: translateY(-50%); height: 2px; width: ${size}px; background: ${color};`;
          
          if (size > 0.5) tileDiv.appendChild(bar); 
        });
        
        mapArea.appendChild(tileDiv);
        
        let tileChar = ""; let tileTitle = "";
        const itemToGet = errandItemsToGet.find(item => item.storeId === tileValue && !item.collected);
        if (itemToGet) {
          tileChar = itemToGet.icon; tileTitle = itemToGet.name;
        } else if (tileValue === 4) {
          tileChar = "🏠"; tileTitle = "汎化の家（Generalization）";
        }

        if (tileChar) {
          const itemDiv = document.createElement('div');
          itemDiv.className = 'map-item';
          itemDiv.textContent = tileChar;
          itemDiv.style.left = `${c * TILE_SIZE}px`;
          itemDiv.style.top = `${r * TILE_SIZE}px`;
          itemDiv.title = tileTitle;
          itemDiv.style.position = 'absolute';
          itemDiv.style.fontSize = '1.2em';
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
  if (uncollected.length > 0) text += uncollected.map(i=>i.icon).join(" と ") + " を集める → ";
  text += "🏠へ帰る";
  el.textContent = text;
}

function getDirectionIndex(direction) {
    if (direction === 'up') return 0;
    if (direction === 'down') return 1;
    if (direction === 'left') return 2;
    if (direction === 'right') return 3;
    return -1;
}

function updateQValue(oldX, oldY, direction, reward, newX, newY) {
    const dirIdx = getDirectionIndex(direction);
    if (dirIdx === -1) return;

    const currentQ = qValues[oldY][oldX][dirIdx];
    
    let maxNextQ = 0;
    if (newY >= 0 && newY < MAP_HEIGHT_TILES && newX >= 0 && newX < MAP_WIDTH_TILES) {
        if(mapGrid[newY][newX] !== 1) {
             maxNextQ = Math.max(...qValues[newY][newX]);
        }
    }

    const newQ = currentQ + Q_LEARNING_RATE * (reward + 0.9 * maxNextQ - currentQ);

    qValues[oldY][oldX][dirIdx] = newQ;
}


function movePlayerErrand(direction) {
  const oldX = playerPos.x;
  const oldY = playerPos.y;
  let newX = oldX, newY = oldY;
  let reward = -1; 

  if (direction === "up") newY--;
  if (direction === "down") newY++;
  if (direction === "left") newX--;
  if (direction === "right") newX++;

  const isValidPos = newY>=0 && newY<MAP_HEIGHT_TILES && newX>=0 && newX<MAP_WIDTH_TILES;
  const isWall = isValidPos && mapGrid[newY][newX] === 1;

  if (isWall || !isValidPos) {
    reward += Q_PENALTY_RATE;
    document.getElementById('errandMessage').textContent = `💥 壁（損失）に当たった！ペナルティ！ ${reward}`;
  } else {
    playerPos.x = newX; playerPos.y = newY;
    errandSteps++;

    const currentTileValue = mapGrid[playerPos.y][playerPos.x];
    const itemToGet = errandItemsToGet.find(item => item.storeId === currentTileValue && !item.collected);
    
    if (itemToGet) {
      itemToGet.collected = true;
      reward += itemToGet.reward;
      document.getElementById('errandMessage').textContent = `${itemToGet.name}（報酬）をゲット！+${itemToGet.reward}！`;
      aiState.love += 20; gainXp(10);
      itemToGet.icon = "✅"; 
      mapGrid[playerPos.y][playerPos.x] = 0; 
      updateErrandObjective();
    } else {
        document.getElementById('errandMessage').textContent = `ステップ: ${errandSteps} | ${AI_NAME}「目標まであとすこし！」`;
    }

    if (currentTileValue === 4 && errandItemsToGet.every(i=>i.collected)) {
      reward += 150; 
      endGame("errand", `🎉 ${GAME_NAME_ERRAND} 成功！${errandSteps}ステップで完了！`);
      document.querySelectorAll('#errandControls button').forEach(btn => btn.disabled = true);
    }
  }

  updateQValue(oldX, oldY, direction, reward, playerPos.x, playerPos.y);

  document.getElementById('errandScore').textContent = `ステップ: ${errandSteps}`;
  drawErrandMap();
}

// --- Game3：AI単語連想ゲーム（学習連鎖） ---

function startGameShiritori() {
  if (currentGame) return;
  currentGame = "shiritori";
  miniGameModal.style.display = 'flex';
  miniGameTitle.textContent = "AI単語連想ゲーム（学習連鎖）";
  
  const template = document.createElement('div');
  template.id = 'shiritoriGameTemplateContent';
  template.innerHTML = `
    <div style="padding: 10px;">
        <div id="shiritoriGameTheme" style="font-size: small; color: #555; margin-bottom: 12px; font-weight: bold;">
            💡 AIが次に「連想しやすい」単語の分布を当てよう！
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; background: #ebf5ff; padding: 8px; border-radius: 6px;">
            <div style="font-size: 1.2em; font-weight: bold;">連鎖数: <span id="shiritoriChainCount" style="color: #007bff;">0</span></div>
            <div style="font-size: 1.2em; font-weight: bold;">スコア: <span id="shiritoriScore" style="color: #ff4081;">0</span></div>
        </div>
        
        <div style="border: 2px solid #ccc; padding: 15px; border-radius: 8px; background: #fff;">
            <p style="margin-top: 0; font-weight: bold; font-size: 1.1em;">現在のテーマ：<span id="shiritoriPrevWord" style="color: #007bff; font-size: 1.2em;"></span></p>
            
            <p style="margin: 10px 0 5px; font-weight: bold;">ぷぷの連想する単語はどれ？（高確率なほど高得点！）</p>
            <div id="shiritoriCandidatesArea" style="display: flex; flex-wrap: wrap; gap: 8px; min-height: 40px;">
                <!-- 連想候補ボタンがここに入る -->
            </div>
            <p style="margin: 10px 0 0; font-size: small; color: #888;">高確率な言葉を当てて連鎖（チェーン）を伸ばそう！</p>
        </div>

        <p id="shiritoriMessage" style="margin-top: 15px; font-size: small; color: #d32f2f; font-weight: bold;"></p>
    </div>
  `;
  miniGameArea.innerHTML = '';
  miniGameArea.appendChild(template);

  shiritoriChainCount = 0;
  gameScore = 0;
  shiritoriUsedWords = new Set(); // 🌟 リセット
  
  document.getElementById('shiritoriChainCount').textContent = shiritoriChainCount;
  document.getElementById('shiritoriScore').textContent = gameScore;
  document.getElementById('shiritoriMessage').textContent =
    `${AI_NAME}「AIは、次にどの言葉が出やすいか『確率（分布）』で考えているんだ。やってみよう！」`;
  
  startNew連想Round("たべもの"); 
}

function getNewTopicFromVocabulary() {
    const masteredWords = Object.keys(aiState.vocabulary).filter(w => 
        aiState.vocabulary[w].mastered && 
        w.length >= 2 && 
        !shiritoriUsedWords.has(w)
    );

    if (masteredWords.length > 0) {
        return masteredWords[Math.floor(Math.random() * masteredWords.length)];
    }
    return ["ねこ", "あそび", "がっこう", "くるま", "うみ"][Math.floor(Math.random() * 5)];
}

function getFallbackCandidates(topicWord) {
    const candidates = new Set();
    const allWords = Object.keys(aiState.vocabulary);
    
    allWords.filter(w => w.includes(topicWord) && w !== topicWord).slice(0, 3).forEach(w => candidates.add(w));

    allWords.filter(w => aiState.vocabulary[w].count > 5).sort((a, b) => aiState.vocabulary[b].count - aiState.vocabulary[a].count).slice(0, 3).forEach(w => candidates.add(w));

    ["たのしい", "わくわく", "ともだち", "きらきら", "やさしい"].forEach(w => candidates.add(w));

    const filtered = Array.from(candidates).filter(w => 
        w.length > 1 && 
        !w.includes('ん') && 
        !shiritoriUsedWords.has(w.toLowerCase())
    );

    return filtered.slice(0, 8); 
}

async function startNew連想Round(topicWord) {
    if (currentGame !== "shiritori") return; 

    currentTopicWord = topicWord;
    document.getElementById('shiritoriPrevWord').textContent = topicWord;
    const candidatesArea = document.getElementById('shiritoriCandidatesArea');
    candidatesArea.innerHTML = '';
    const messageElem = document.getElementById('shiritoriMessage');

    messageElem.textContent = `${AI_NAME}が「${topicWord}」から連想する言葉を考え中...`;

    const prompt = `以下の単語から連想される単語を${連想候補数}つ、簡潔に返してください。単語は半角スペースで区切ってください。句読点や余計な語は含めないでください。既に使った単語や、「ん」で終わる単語は使わないでください。
入力: りんご
出力: あか おいしい フルーツ あまい くだもの
入力: ${topicWord}
出力: `;

    let rawCandidates = [];
    if (geminiApiKey) {
        try {
            const aiResponse = await callGeminiAPI(prompt, true);
            rawCandidates = aiResponse.split(/\s+/).filter(w => 
                w.length > 0 && 
                w.length <= 5 && 
                !w.includes('ん') && 
                !shiritoriUsedWords.has(w.toLowerCase())
            );
        } catch(e) {
            rawCandidates = getFallbackCandidates(topicWord); 
        }
    } else {
        rawCandidates = getFallbackCandidates(topicWord);
    }
    
    if (rawCandidates.length < 3) {
         rawCandidates.push(...getFallbackCandidates("汎用")); 
    }
    
    const uniqueCandidates = Array.from(new Set(rawCandidates)).filter(w => !shiritoriUsedWords.has(w.toLowerCase()));
    
    const candidatesWithScore = uniqueCandidates.slice(0, 連想候補数).map((word, index) => ({
        word: word,
        score: (連想候補数 - index) * 10, 
        isHighProbability: index < 2 
    }));

    if (candidatesWithScore.length < 3) {
        messageElem.textContent = `${AI_NAME}「うーん、連想できる言葉が少ないね。ちょっと気分を変えて…新しいテーマだよ！」`;
        const newTopic = getNewTopicFromVocabulary();
        setTimeout(() => startNew連想Round(newTopic), 2500);
        return;
    }
    
    candidatesWithScore.sort(() => 0.5 - Math.random());
    
    candidatesWithScore.forEach(candidate => {
        const btn = document.createElement('button');
        btn.className = '連想-object-btn';
        btn.textContent = candidate.word;
        btn.style.cssText = 'padding: 8px 12px; border-radius: 4px; border: 1px solid #ccc; cursor: pointer; transition: background 0.2s; background: white;';
        
        btn.onmouseover = () => btn.style.background = '#e0f7fa';
        btn.onmouseout = () => btn.style.background = 'white';
        
        btn.onclick = () => handle連想Guess(candidate.word, candidate.score, candidate.isHighProbability, candidatesWithScore);
        
        candidatesArea.appendChild(btn);
    });

    messageElem.textContent = `ぷぷが連想した言葉だよ。どれが最も「連想しやすい」（高確率）かな？`;
}

function handle連想Guess(guessedWord, score, isHighProbability, allCandidates) {
    const messageElem = document.getElementById('shiritoriMessage');
    const candidatesArea = document.getElementById('shiritoriCandidatesArea');

    [...candidatesArea.querySelectorAll('button')].forEach(btn => btn.disabled = true);

    let baseScore = score;
    let reward = 0;
    
    if (isHighProbability) {
        reward = baseScore + shiritoriChainCount * 5;
        gameScore += reward;
        shiritoriChainCount++;
        messageElem.textContent = `🎉 **大連想！** これぞぷぷが最も連想しやすい言葉！ (+${reward}点, 連鎖+1)`;
        shiritoriUsedWords.add(guessedWord.toLowerCase());
        
        setTimeout(() => startNew連想Round(guessedWord), 2500);

    } else {
        reward = baseScore;
        gameScore += reward;
        shiritoriChainCount = 0; 
        messageElem.textContent = `⭕ 正解！これはぷぷにとって低確率な連想だったみたい。連鎖リセット... (+${reward}点)`;
        
        const newTopic = getNewTopicFromVocabulary();
        shiritoriUsedWords.add(guessedWord.toLowerCase());
        setTimeout(() => startNew連想Round(newTopic), 2500);
    }
    
    document.getElementById('shiritoriChainCount').textContent = shiritoriChainCount;
    document.getElementById('shiritoriScore').textContent = gameScore;
    
    allCandidates.forEach(cand => {
        const btn = [...candidatesArea.querySelectorAll('button')].find(b => b.textContent === cand.word);
        if (!btn) return;
        btn.style.backgroundColor = cand.isHighProbability ? '#c8e6c9' : '#e0f7fa'; 
        if (btn.textContent === guessedWord) {
            btn.style.border = '2px solid #ff4081'; 
            btn.onmouseout = () => btn.style.backgroundColor = cand.isHighProbability ? '#b3e0b5' : '#c8e6e5'; 
        } else {
            btn.onmouseout = () => btn.style.backgroundColor = cand.isHighProbability ? '#c8e6c9' : '#e0f7fa'; 
        }
    });
    
    updateVocabularyAndStats(guessedWord, null, "game_連想");
    gainXp(10 + shiritoriChainCount * 3);
    aiState.love += 5; 
    updateDisplay();
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
    
    let messageElem;
    if (gameType === "tokenize") {
        messageElem = document.getElementById(`tokenizeMessage`);
    } else if (gameType === "errand") {
        messageElem = document.getElementById(`errandMessage`);
    } else if (gameType === "shiritori") {
        messageElem = document.getElementById(`shiritoriMessage`);
    }

    if (gameType === "wordCollect" || gameType === "tokenize") {
        loveBonus = Math.max(10, Math.floor(gameScore / 10)); 
        gainXp(12 + Math.floor(gameScore / 20));
        pupuMessage = `トークン化のお手伝いありがとう！ ${consecutiveHits}連続パーフェクトはすごい！ (+${loveBonus} 愛情度)`;
    } else if (gameType === "errand") {
        if (resultMessage.includes("成功")) {
            loveBonus = 60; gainXp(20);
            pupuMessage = `やった！報酬を集めて汎化に到達！ 強化学習の直感つかめたね！ (+${loveBonus} 愛情度)`;
        } else {
            loveBonus = 20; gainXp(6);
            pupuMessage = `惜しい！でも体感できたね。次は壁（損失）をもっと避けてみよう。 (+${loveBonus} 愛情度)`;
        }
    } else if (gameType === "shiritori") { 
        loveBonus = Math.max(20, Math.floor(gameScore / 10)); 
        gainXp(15 + shiritoriChainCount * 5);
        pupuMessage = `連想ゲームおしまい！最終スコア: ${gameScore}点。\nAIが言葉を確率（分布）でつなぐ感覚がわかったかな？ (+${loveBonus} 愛情度)`;
    }

    document.getElementById('closeMiniGameBtn').textContent = "✕"; 
    
    if (messageElem) messageElem.textContent = resultMessage + `\n${AI_NAME}「${pupuMessage}」`;

    if(loveBonus > 0) {
        aiState.love += loveBonus;
    }

    updateDisplay();
    saveAiState();
}


// --- 初期化 ---
function initialize() {
  setupDummyDOM();
  
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
  miniGameModal = document.getElementById('miniGameModal');
  miniGameTitle = document.getElementById('miniGameTitle');
  miniGameArea = document.getElementById('miniGameArea');
  closeMiniGameBtn = document.getElementById('closeMiniGameBtn');
  showApiSetupBtn = document.getElementById('showApiSetupBtn');
  saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
  closeCelebrationBtn = document.getElementById('closeCelebrationBtn');
  
  const modalBody = celebrationModal ? celebrationModal.querySelector('#celebrationContentBody') : null;
  if (modalBody) celebrationFeaturesElem = modalBody;


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

  document.getElementById('startGame1Btn').addEventListener('click', startGameWordCollect);
  document.getElementById('startGame2Btn').addEventListener('click', startGameErrand);
  document.getElementById('startGame3Btn').addEventListener('click', startGameShiritori);
  closeMiniGameBtn.addEventListener('click', closeMiniGameModal);
  
  document.addEventListener('keydown', (e) => {
      handleErrandKeyboardInput(e); 
  }); 

  // 初期化処理
  loadAiState();
  const apiKeyExists = loadApiKey();
  if (chatArea) chatArea.innerHTML = '';
  aiState.dialogue_history.forEach(turn => {
    const speaker = turn.role === "user" ? 'あなた' : AI_NAME;
    addMessageToLog(speaker, turn.parts[0].text);
  });

  if (apiKeyExists && aiState.dialogue_history.length === 0) addInitialAiGreeting();
  else if (!apiKeyExists) addMessageToLog('システム', 'ようこそ！まずGemini APIキーを設定してください。', 'system-message');

  updateDisplay();
}

document.addEventListener('DOMContentLoaded', initialize);

