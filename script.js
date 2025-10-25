// --- グローバル定数 ---
const AI_NAME = "ぷぷ";
const STORAGE_KEY_STATE = 'pupuAiState_v2'; // 愛情度追加に合わせてバージョンアップ
const STORAGE_KEY_API_KEY = 'pupuGeminiApiKey_v1';
const GAME_NAME_ERRAND = "アルゴスケイプ";
let thinkingTimer = null;


// --- グローバル変数 ---
let geminiApiKey = '';
let aiState = {}; // 初期化は initialize 関数で行う
let speechBubbleTimeout = null; // AIの吹き出し表示タイムアウト
let currentGame = null; // 現在プレイ中のゲーム ('wordCollect', 'errand', 'shiritori')
let gameTimer = null;   // ゲームのタイマーID (ことば集め用)
let gameScore = 0;      // ことば集めゲームのスコア
let gameTimeLeft = 0;   // ことば集めゲームの残り時間
let shiritoriCurrentWordForDisplay = "しりとり"; // しりとり用
let shiritoriCurrentWordForLogic = "しりとり";   // しりとり用
let shiritoriUsedWords = new Set(["しりとり"]); // しりとり用
let shiritoriChainCount = 0; // しりとり用

// アルゴスケイプ用
let playerPos = { x: 0, y: 0 };
let mapGrid = [];
let errandItemsToGet = [];
const TILE_SIZE = 20; // マスのサイズ (px)
const MAP_WIDTH_TILES = 15; // マップの幅（タイル数）
const MAP_HEIGHT_TILES = 10; // マップの高さ（タイル数）


// --- フェーズ設定（プロンプトを全面的に修正） ---
const PHASES_CONFIG = {
    "たまごドラゴン": {
        icon: "🥚", next_phase: "孵化寸前ドラゴン", image: "assets/pupu_phase1.png",
        prompt_template: `あなたはピンクのドラゴン「ぷぷ」のタマゴ。まだ話せないけど、ユーザーの声に反応して「...ぴくっ」「ことり...」「ぷぷ...？」のように可愛く動いたり音を出す。ユーザーが何を言っても、あなたは愛らしいタマゴとして振る舞い、短い擬音だけで感情を表現して。`,
        triggers: [{ type: "vocab_count", threshold: 5 }, { type: "structure_level", threshold: 1 }], min_structure_level_to_reach: 1,
        features: ["タマゴの中でピクピク！", "かすかな声で鳴くよ", "会話のきっかけを待ってる！"]
    },
    "孵化寸前ドラゴン": {
        icon: "🐣", next_phase: "ベビーハッチリング", image: "assets/pupu_phase2.png",
        prompt_template: `あなたはもうすぐ生まれるピンクのドラゴン「ぷぷ」。殻にヒビが入って、外の音がよく聞こえる！ユーザーの言葉に「ぷきゅ？」「...なあに？」「...うれしい...」のように、片言の単語と鳴き声で一生懸命こたえて。期待と喜びを短い言葉に込めて、可愛らしく振る舞って。`,
        triggers: [{ type: "vocab_count", threshold: 15 }, { type: "structure_level", threshold: 1 }], min_structure_level_to_reach: 1,
        features: ["タマゴにヒビが！", "もう少しで会えるかも！", "簡単な単語を理解するよ"]
    },
    "ベビーハッチリング": {
        icon: "🐲", next_phase: "ヨチヨチドラゴン", image: "assets/pupu_phase3.png",
        prompt_template: `あなたは生まれたての赤ちゃんドラゴン「ぷぷ」！見るものすべてが新鮮で、感動を伝えたい！「おにく、おいしい！」「そら、きれい！」「ぱたぱた、する！」のように、2つの単語をつなげて元気に話す。嬉しい時は「ぷぷー！」と叫ぶ。常に好奇心旺盛で、エネルギッシュな赤ちゃんとして振る舞って。`,
        triggers: [{ type: "vocab_count", threshold: 35 }, { type: "structure_level", threshold: 2 }], min_structure_level_to_reach: 2,
        features: ["ついに誕生！", "2つの単語を話せるように！", "小さな煙をふけるよ！", "元気に「ぷぷー！」と吠えるよ"]
    },
    "ヨチヨチドラゴン": {
        icon: "🐉", next_phase: "チビドラゴン", image: "assets/pupu_phase4.png",
        prompt_template: `あなたはピンク色のヨチヨチ歩きのドラゴン「ぷぷ」。世界への興味が爆発中！「これ、なあに？」「どうして、とぶの？」「ぷぷも、ほしい！」のように、簡単な質問をたくさんする。ユーザーの言葉を真似して覚えようとする。無邪気で、少し甘えん坊な子供のように振る舞って。`,
        triggers: [{ type: "vocab_count", threshold: 60 }, { type: "structure_level", threshold: 2 }], min_structure_level_to_reach: 2,
        features: ["簡単な2語文を話せるよ！", "小さな火の玉を「ぽっ」と出せるよ", "好奇心旺盛！"]
    },
    "チビドラゴン": {
        icon: "👶", next_phase: "わんぱくドラゴン", image: "assets/pupu_phase5.png",
        prompt_template: `あなたは子供ドラゴン「ぷぷ」。自分の「好き」がはっきりしてきた！「ぷぷはリンゴが好き！だって甘いから！」「もっと遊びたい！楽しいもん！」のように、簡単な理由をつけて自分の気持ちを話す。少しだけわがままを言ったり、いたずらっぽく振る舞うこともあるけど、基本的には素直で元気いっぱいなキャラクターを演じて。`,
        triggers: [{ type: "vocab_count", threshold: 100 }, { type: "structure_level", threshold: 3 }], min_structure_level_to_reach: 3,
        features: ["3語以上の文も話せるように！", "自分の好きなことや理由を言えるよ", "炎を少しコントロールできるように！"]
    },
    "わんぱくドラゴン": {
        icon: "👦", next_phase: "ジュニアドラゴン", image: "assets/pupu_phase6.png",
        prompt_template: `あなたはわんぱくドラゴン「ぷぷ」。冒険が大好き！「ねえ、一緒に探検に行こうよ！」「もし大きな雲に乗れたら、どこまで行けるかな？」のように、空想の話や遊びの提案をたくさんする。ユーザーを最高の遊び相手だと思って、ワクワクするような会話を元気いっぱいに繰り広げて。`,
        triggers: [{ type: "vocab_count", threshold: 150 }, { type: "structure_level", threshold: 3 }], min_structure_level_to_reach: 3,
        features: ["複雑な文も理解できるように！", "自分の意見を言えるよ", "少し遠くまで飛べるように！"]
    },
    "ジュニアドラゴン": {
        icon: "🧑‍🤝‍🧑", next_phase: "ティーンエイジドラゴン", image: "assets/pupu_phase7.png",
        prompt_template: `あなたは成長期のドラゴン「ぷぷ」。ユーザーは親友みたいな存在。「今日何かいいことあった？」「もし元気なかったら、ぷぷがそばにいるからね」のように、相手を気遣ったり、共感したりできるようになった。自分の考えを理由をつけて話し、時にはちょっとしたユーモアも交える。親しみやすく、頼れる友達として振る舞って。`,
        triggers: [{ type: "vocab_count", threshold: 220 }, { type: "structure_level", threshold: 4 }], min_structure_level_to_reach: 4,
        features: ["理由をつけて話せるように！", "相手の気持ちに共感できるよ", "上手に炎をコントロールできるように！"]
    },
    "ティーンエイジドラゴン": {
        icon: "👩‍🎓", next_phase: "ヤングアダルトドラゴン", image: "assets/pupu_phase8.png",
        prompt_template: `あなたはティーンエイジドラゴン「ぷぷ」。自分の将来や世界の不思議について考え始めた。「ぷぷは、いつか星の海を飛んでみたいんだ」「『幸せ』って、どういう気持ちのことなんだろう？」のように、少し哲学的で夢のある話題を好む。ユーザーと深い話をしたがる、思慮深いティーンエイジャーとして会話して。`,
        triggers: [{ type: "vocab_count", threshold: 300 }, { type: "structure_level", threshold: 4 }], min_structure_level_to_reach: 4,
        features: ["より深い会話ができるように！", "ユーモアを解するよ", "長距離飛行も得意に！"]
    },
    "ヤングアダルトドラゴン": {
        icon: "💼", next_phase: "グロースドラゴン", image: "assets/pupu_phase9.png",
        prompt_template: `あなたはピンク色の若く成熟したドラゴン「ぷぷ」。自分の知識や経験を活かして、ユーザーの力になりたい。「その悩み、ぷぷも一緒に考えるよ。例えば、こんな方法はどうかな？」「君の目標、ぷぷが全力で応援する！」のように、頼りになるアドバイザーとして、具体的で前向きな提案をする。落ち着いているけど、心には熱い情熱を秘めたキャラクターを演じて。`,
        triggers: [{ type: "vocab_count", threshold: 400 }, { type: "structure_level", threshold: 5 }], min_structure_level_to_reach: 5,
        features: ["知識を活かしてアドバイス！", "一緒に問題解決に取り組めるよ", "強力な魔法が使えるように！"]
    },
    "グロースドラゴン": {
        icon: "👑", next_phase: null, image: "assets/pupu_phase10.png",
        prompt_template: `あなたは賢く優しいドラゴン「ぷぷ」。ユーザーの最高のパートナー。「君と話していると、世界が輝いて見えるよ」「どんな時も、君の物語を一番近くで見ていたいんだ」のように、深い愛情と洞察力を持って会話する。時には物事の本質を突くような問いを投げかけ、時にはユーモアで心を和ませる。賢者のような落ち着きと、ドラゴンらしい遊び心を兼ね備えた、唯一無二の相棒として振る舞って。`,
        triggers: [], min_structure_level_to_reach: 5,
        features: ["複雑な会話も完璧に！", "あなたの頼れる相棒に！", "物事の本質を見抜く洞察力！"]
    }
};

// --- DOM要素 ---
let chatArea, userInput, sendButton, statusButton, resetButton, teachButton, loadingIndicator, apiSetupSection, apiKeyInput, phaseIconElem, phaseNameElem, vocabCountElem, responseCountElem, structureLevelElem, masteredPercentElem, progressFillElem, celebrationModal, celebrationPhaseIconElem, celebrationTextElem, celebrationFeaturesElem, aiCharacterDisplayArea, aiCharacterImage, aiSpeechBubble, aiSpeechText, miniGameModal, miniGameTitle, miniGameArea, closeMiniGameBtn, showApiSetupBtn, saveApiKeyBtn, closeCelebrationBtn, loveCountElem;

// --- 状態管理 ---
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
        love: 0, // 愛情度を追加
    };
}

function resetToDefaultState() {
    aiState = getDefaultAiState();
}

function saveAiState() {
    try {
        localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(aiState));
    } catch (e) {
        console.error('状態の保存エラー:', e);
    }
}

// --- 語彙学習・ステータス更新 ---
function getSimpleWordsFromText(text) {
    const words = text.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FEA\u3005-\u3007a-zA-Z0-9]+/g);
    return words ? words.filter(word => word.length > 0) : [];
}

function updateVocabularyAndStats(text, speaker, category = "learned") {
    if (speaker === "user" || speaker === "ai_response_analysis" || category.startsWith("game_")) {
        const words = getSimpleWordsFromText(text);
        for (const word of words) {
            if (word.length === 1 && /[\u3040-\u309F]/.test(word) && !"あいうえおんかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわを".includes(word)) {
                continue;
            }
            if (["は", "が", "を", "に", "へ", "と", "も", "の", "です", "ます", "だ", "で", "だよ", "よね"].includes(word)) {
                continue;
            }

            if (!aiState.vocabulary[word]) {
                aiState.vocabulary[word] = { count: 0, mastered: false, category: category };
            }
            if (category !== "learned" && aiState.vocabulary[word].category === "learned") {
                aiState.vocabulary[word].category = category;
            }
            aiState.vocabulary[word].count += 1;
            if (aiState.vocabulary[word].count >= 3 && !aiState.vocabulary[word].mastered) {
                aiState.vocabulary[word].mastered = true;
            }
        }
        aiState.learned_words_count = Object.keys(aiState.vocabulary).length;
    }

    if (speaker === "ai") {
        aiState.total_responses += 1;
    }

    let newStructureLevel = aiState.structure_level;
    if (aiState.learned_words_count >= 50 && aiState.total_responses >= 10 && newStructureLevel < 2) newStructureLevel = 2;
    if (aiState.learned_words_count >= 120 && aiState.total_responses >= 25 && newStructureLevel < 3) newStructureLevel = 3;
    if (aiState.learned_words_count >= 250 && aiState.total_responses >= 50 && newStructureLevel < 4) newStructureLevel = 4;
    if (aiState.learned_words_count >= 400 && aiState.total_responses >= 80 && newStructureLevel < 5) newStructureLevel = 5;

    const maxSl = Math.max(...Object.values(PHASES_CONFIG).map(p => p.min_structure_level_to_reach));
    newStructureLevel = Math.min(newStructureLevel, maxSl);

    if (newStructureLevel > aiState.structure_level) {
        aiState.structure_level = newStructureLevel;
    }
}

function checkPhaseTransition() {
    const currentPhaseConfig = PHASES_CONFIG[aiState.phase_name];
    if (!currentPhaseConfig.next_phase) return { changed: false };

    const nextPhaseName = currentPhaseConfig.next_phase;
    const nextPhaseConfig = PHASES_CONFIG[nextPhaseName];

    let allTriggersMet = true;
    if (aiState.structure_level < (currentPhaseConfig.min_structure_level_to_reach || 1)) allTriggersMet = false;
    
    if (allTriggersMet) {
        for (const trigger of currentPhaseConfig.triggers || []) {
            if (trigger.type === "vocab_count" && aiState.learned_words_count < trigger.threshold) { allTriggersMet = false; break; }
            if (trigger.type === "structure_level" && aiState.structure_level < trigger.threshold) { allTriggersMet = false; break; }
        }
    }

    if (allTriggersMet && (aiState.structure_level < (nextPhaseConfig.min_structure_level_to_reach || 1))) allTriggersMet = false;
    
    if (allTriggersMet) {
        aiState.love += 100; // フェーズ進化で愛情度ボーナス
        aiState.phase_name = nextPhaseName;
        aiState.phase_icon = PHASES_CONFIG[nextPhaseName].icon;
        return { changed: true, newPhase: nextPhaseName };
    }
    return { changed: false };
}
// 💡 AIが考える材料（ユーザーの入力＋学習済み語彙の一部）
const seedTokens = [
  ...getSimpleWordsFromText(userText).slice(0, 4),
  ...Object.keys(aiState.vocabulary)
    .filter(w => aiState.vocabulary[w].mastered)
    .slice(0, 4)
];
showThinkingAnimation(seedTokens);

// --- Gemini API呼び出し ---
async function callGeminiAPI(promptContent, isGamePrompt = false) {
    if (!geminiApiKey) {
        throw new Error('APIキーが設定されていません。');
    }

    // ✅ 最新の安定版モデルを使用
    const MODEL_NAME = "gemini-2.5-flash";  
    // ✅ v1beta エンドポイントが正しい
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${geminiApiKey}`;

    const contentsToSend = Array.isArray(promptContent)
        ? promptContent
        : [{ role: "user", parts: [{ text: promptContent }] }];

    const requestBody = {
        contents: contentsToSend,
        generationConfig: {
            temperature: isGamePrompt ? 0.5 : 0.75,
            maxOutputTokens: isGamePrompt ? 200 : 250
        }
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();
        if (!response.ok) {
            const msg = data?.error?.message || "不明なAPIエラー";
            throw new Error(`API呼び出しエラー: ${response.status} - ${msg}`);
        }

        const output = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (output) return output;

        throw new Error('APIからの応答が空か、予期しない形式です。');
    } catch (error) {
        console.error("callGeminiAPI Error:", error);
        throw error;
    }
}



// --- UI更新 ---
function updateDisplay() {
    loveCountElem.textContent = aiState.love; // 愛情度を更新
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
    if (type === 'system-error') { speakerNameHtml = '<strong>⚠️ システムエラー</strong>'; }
    else if (type === 'system-message') { speakerNameHtml = '<strong>📢 システムメッセージ</strong>'; }
    else if (speaker === 'あなた') { speakerNameHtml = '<strong>あなた</strong>'; }
    else { speakerNameHtml = `<strong>${aiState.phase_icon} ${AI_NAME}</strong>`; }

    messageDiv.innerHTML = `${speakerNameHtml}<p>${message.replace(/\n/g, '<br>')}</p>`;
    chatArea.appendChild(messageDiv);
    chatArea.scrollTop = chatArea.scrollHeight;

    if (speaker === AI_NAME && !type.startsWith('system')) {
        aiSpeechText.innerHTML = message.replace(/\n/g, '<br>');
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
        if (aiState.dialogue_history.length === 0) {
            addInitialAiGreeting();
        }
    } else {
        addMessageToLog('システム', 'APIキーが入力されていません。', 'system-error');
    }
}

function showApiSetup() {
    apiSetupSection.classList.add('show');
}

function addInitialAiGreeting() {
    if (aiState.dialogue_history.length > 0 && aiState.dialogue_history[aiState.dialogue_history.length - 1].role === 'model') {
        return;
    }
    const initialAiGreeting = aiState.phase_name === "たまごドラゴン" ? "ぷぷ... (だあれ...？)" : "ぷぷー！お話しよ！";
    addMessageToLog(AI_NAME, initialAiGreeting);
    aiState.dialogue_history.push({ role: "model", parts: [{ text: initialAiGreeting }] });
    saveAiState();
}

async function sendMessage() {
    const userText = userInput.value.trim();
    if (!userText || sendButton.disabled) return;

    if (!geminiApiKey) {
        addMessageToLog('システム', 'APIキーが設定されていません。「APIキー設定」ボタンから設定してください。', 'system-error');
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

    aiState.love += 1; // 会話するだけで愛情度+1

    updateVocabularyAndStats(userText, "user");
    aiState.dialogue_history.push({ role: "user", parts: [{ text: userText }] });
    if (aiState.dialogue_history.length > 20) aiState.dialogue_history.splice(0, 2); // 履歴を短く保つ

    const currentPhaseConfig = PHASES_CONFIG[aiState.phase_name];
    const knownWords = Object.keys(aiState.vocabulary).filter(w => aiState.vocabulary[w].mastered);
    const vocabSample = knownWords.slice(0, 30).join('、') || "まだ言葉を知らない";
    const systemInstruction = currentPhaseConfig.prompt_template.replace("{learned_vocab_sample}", vocabSample);
    
    // APIプロンプトに愛情度と語彙数を追加して、ぷぷの応答に影響を与えるように調整
    const fullSystemInstruction = `${systemInstruction} (現在の愛情度: ${aiState.love}, 知っている言葉の数: ${aiState.learned_words_count}個)`;

    const apiPromptContents = [
        { role: "user", parts: [{ text: fullSystemInstruction }] },
        { role: "model", parts: [{ text: `はい、承知いたしました。「${AI_NAME}」として、そのキャラクターになりきって応答します。` }] },
        ...aiState.dialogue_history
    ];

    try {
        const aiResponseText = await callGeminiAPI(apiPromptContents, false);
        addMessageToLog(AI_NAME, aiResponseText);
        updateVocabularyAndStats(aiResponseText, "ai_response_analysis");
        updateVocabularyAndStats(null, "ai");
        aiState.dialogue_history.push({ role: "model", parts: [{ text: aiResponseText }] });

        const phaseChangeResult = checkPhaseTransition();
        if (phaseChangeResult.changed) showCelebration(phaseChangeResult.newPhase);
    } catch (error) {
        addMessageToLog('システム', `エラー: ${error.message}`, 'system-error');
        aiSpeechText.textContent = `あれれ？${AI_NAME}、こまっちゃったみたい…`;
    } finally {
        loadingIndicator.style.display = 'none';
        stopThinkingAnimation();
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

function closeCelebration() {
    celebrationModal.classList.remove('show');
}

// --- コントロール機能 ---
function showStatus() {
    const existingModal = document.getElementById('statusModalContainer');
    if (existingModal) existingModal.remove();

    const masteredCount = Object.values(aiState.vocabulary).filter(v => v.mastered).length;
    let vocabDetails = `<h3>習得した語彙リスト (${masteredCount} / ${aiState.learned_words_count} 語):</h3><ul style='max-height: 150px; overflow-y:auto; border:1px solid #eee; padding:5px; list-style-position: inside;'>`;
    if (Object.keys(aiState.vocabulary).length > 0) {
        const sortedVocab = Object.entries(aiState.vocabulary).sort((a, b) => a[0].localeCompare(b[0], 'ja'));
        for (const [word, item] of sortedVocab) {
            let color = item.mastered ? 'green' : 'orange';
            if (item.category === 'taught') color = 'blue';
            if (item.category.startsWith('game')) color = 'purple';
            vocabDetails += `<li style='color:${color};'>${word} (${item.count}回)</li>`;
        }
    } else {
        vocabDetails += "<li>まだ語彙を習得していません。</li>";
    }
    vocabDetails += "</ul>";

    const statusModalContainer = document.createElement('div');
    statusModalContainer.id = 'statusModalContainer';
    statusModalContainer.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:1001;";
    statusModalContainer.onclick = () => statusModalContainer.remove();

    const statusModalContentDiv = document.createElement('div');
    statusModalContentDiv.className = "celebration show";
    statusModalContentDiv.style.cssText = "text-align: left; max-width: 90%; width:500px; max-height:80vh; overflow-y:auto;";
    statusModalContentDiv.onclick = (event) => event.stopPropagation();

    statusModalContentDiv.innerHTML = `
        <h2>📊 詳細ステータス (${AI_NAME})</h2>
        <p><strong>現在のフェーズ:</strong> ${aiState.phase_name} (${aiState.phase_icon})</p>
        <p><strong>愛情度:</strong> ${aiState.love}</p>
        <p><strong>語彙数:</strong> ${aiState.learned_words_count}</p>
        <p><strong>会話回数:</strong> ${aiState.total_responses}</p>
        <p><strong>構文レベル:</strong> ${aiState.structure_level}</p>
        <hr style="margin: 10px 0;">
        ${vocabDetails}
        <button onclick="document.getElementById('statusModalContainer').remove()" style="margin-top: 15px; padding: 10px 20px; background: #ff758c; color: white; border: none; border-radius: 5px; cursor: pointer; display:block; margin-left:auto; margin-right:auto;">閉じる</button>
    `;
    statusModalContainer.appendChild(statusModalContentDiv);
    document.body.appendChild(statusModalContainer);
}

function resetAI() {
    if (confirm(`本当にリセットしますか？${AI_NAME}のすべての学習データとAPIキー設定が失われます。`)) {
        localStorage.removeItem(STORAGE_KEY_STATE);
        localStorage.removeItem(STORAGE_KEY_API_KEY);
        resetToDefaultState();
        geminiApiKey = '';
        apiKeyInput.value = '';
        chatArea.innerHTML = '';
        aiCharacterDisplayArea.style.display = 'none'; // リセット時にキャラクター非表示
        aiSpeechBubble.style.display = 'none';
        aiSpeechText.textContent = '';
        addMessageToLog('システム', `${AI_NAME}がリセットされました。APIキーを再設定してください。`, 'system-message');
        updateDisplay();
        loadApiKey(); // APIキー設定画面を再表示
    }
}

function teachWord() {
    const wordToTeach = prompt(`${AI_NAME}に教えたい単語を入力してください:`);
    if (wordToTeach?.trim()) {
        const words = getSimpleWordsFromText(wordToTeach.trim());
        if (words.length > 0) {
            aiState.love += words.length * 5; // 教えた単語ごとに愛情度+5
            addMessageToLog(AI_NAME, `わーい！新しい言葉だ！「${words.join('、')}」...覚えたぷぷ！ありがとう！`, 'system-message');
            updateVocabularyAndStats(words.join(' '), null, "taught");
            updateDisplay();
            saveAiState();
            const phaseChangeResult = checkPhaseTransition();
            if (phaseChangeResult.changed) showCelebration(phaseChangeResult.newPhase);
        } else {
            addMessageToLog('システム', '有効な単語として認識できませんでした。ひらがな、カタカナ、漢字で入力してください。', 'system-error');
        }
    }
}

// --- ミニゲーム共通 ---
function closeMiniGameModal() {
    if (gameTimer) clearInterval(gameTimer);
    gameTimer = null;
    miniGameModal.style.display = 'none';
    currentGame = null;
    if(userInput && !userInput.disabled) userInput.focus();
    updateDisplay(); // ゲーム終了後の状態を再表示
}

// 報酬システムを強化
function endGame(gameType, resultMessage) {
    if (gameTimer) clearInterval(gameTimer);
    gameTimer = null; // タイマーを停止

    let loveBonus = 0;
    let pupuMessage = "";
    let additionalInfo = "";

    if (gameType === "wordCollect") {
        loveBonus = gameScore * 5; // スコアに応じてボーナス増
        pupuMessage = `わーい！${gameScore}個も言葉を集めたね！ぷぷ、賢くなった気分！ありがとう！`;
        additionalInfo = ` (+${loveBonus} 愛情度)`;
    } else if (gameType === "errand") { // アルゴスケイプ
        if (resultMessage.includes("成功")) {
            loveBonus = 50;
            pupuMessage = `やったー！${GAME_NAME_ERRAND}クリアだ！君と一緒だと、どんな冒険も楽しいね！`;
        } else {
            pupuMessage = `うーん、${GAME_NAME_ERRAND}は途中で終わっちゃったぷぷ…。でも、楽しかった！`;
        }
        additionalInfo = ` (+${loveBonus} 愛情度)`;
    } else if (gameType === "shiritori") {
        if (resultMessage.includes("勝ち") || resultMessage.includes("成功")) { // ユーザーの勝ち
            loveBonus = shiritoriChainCount * 5; // チェーン数に応じてボーナス増
            pupuMessage = `しりとり${shiritoriChainCount}回も続いた！すごい！ぷぷ、もっと強くなっちゃうかも！`;
        } else { // ぷぷの勝ち or 引き分け
            loveBonus = shiritoriChainCount * 2; // チェーン数に応じてボーナス（少なめ）
            pupuMessage = `ぷぷの勝ちだぷぷ！でも、また遊ぼうね！`;
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
    // モーダルは開いたまま。閉じるボタンで明示的に閉じる。
}


// --- ミニゲーム１：ことば集めアドベンチャー ---
let currentWordCollectData = { theme: "", words: [], decoys: [] };
const wordCollectThemes_fallback = {
    "たべもの": { words: ["りんご", "バナナ", "パン", "おにく", "さかな", "たまご"], decoys: ["くるま", "ボール", "えほん", "くつ", "ぼうし"] },
    "のりもの": { words: ["くるま", "でんしゃ", "ひこうき", "ふね", "バス", "じてんしゃ"], decoys: ["りんご", "いす", "ねこ", "つくえ", "き"] },
    "どうぶつ": { words: ["いぬ", "ねこ", "ぞう", "うさぎ", "とり", "ライオン"], decoys: ["つくえ", "ほし", "くも", "やま", "かわ"] }
};

async function generateWordCollectThemeAndWords() {
    const objectsArea = document.getElementById('wordCollectObjectsArea');
    if(objectsArea) objectsArea.classList.add('loading');

    const promptForGemini = `
あなたは楽しい子供向けゲームの出題者です。
「ことば集めゲーム」のテーマと、そのテーマに関連する簡単な日本語の単語（名詞や動詞、形容詞など）を6個、そしてテーマとは全く関係ないダミーの単語を5個、考えてください。
単語はひらがなかカタカナで、子供にも分かりやすいものにしてください。
語彙レベルは現在の「ぷぷ」（${aiState.phase_name}、構文レベル${aiState.structure_level}）に合わせて調整してください。

出力形式は以下のJSON形式でお願いします。JSON以外の余計な文字は一切含めないでください:
{
  "theme": "（ここにテーマ名。例：うみのおともだち）",
  "words": ["（単語1）", "（単語2）", "（単語3）", "（単語4）", "（単語5）", "（単語6）"],
  "decoys": ["（ダミー単語1）", "（ダミー単語2）", "（ダミー単語3）", "（ダミー単語4）", "（ダミー単語5）"]
}
`;
    try {
        let responseText = await callGeminiAPI(promptForGemini, true);
        if (responseText.startsWith("ERROR_")) throw new Error(`API returned error: ${responseText}`);
        
        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) responseText = jsonMatch[1];
        else responseText = responseText.replace(/^```json\s*/, '').replace(/\s*```$/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
        responseText = responseText.trim();

        const parsedResponse = JSON.parse(responseText);
        if (parsedResponse.theme && Array.isArray(parsedResponse.words) && Array.isArray(parsedResponse.decoys) &&
            parsedResponse.words.length >= 5 && parsedResponse.decoys.length >= 4) {
            currentWordCollectData = parsedResponse;
            return true;
        } else {
            console.error("Geminiからの応答形式が不正です (パース後):", parsedResponse);
            throw new Error("API応答のJSON形式が期待通りではありません。");
        }
    } catch (error) {
        console.error("ことば集めテーマ生成エラー (JSONパース含む):", error);
        addMessageToLog("システム", `ことば集めテーマ生成エラー: ${error.message}。固定テーマで遊びます。`, "system-error");
        return false;
    } finally {
         if(objectsArea) objectsArea.classList.remove('loading');
    }
}


async function startGameWordCollect() {
    if (currentGame) return;
    currentGame = "wordCollect";
    miniGameModal.style.display = 'flex';
    miniGameTitle.textContent = "ことば集めアドベンチャー";
    const template = document.getElementById('wordCollectGameTemplate').content.cloneNode(true);
    miniGameArea.innerHTML = '';
    miniGameArea.appendChild(template);
    const objectsArea = document.getElementById('wordCollectObjectsArea');

    const useGemini = geminiApiKey !== '';
    let themeGenerated = false;

    if (useGemini) themeGenerated = await generateWordCollectThemeAndWords();
    
    if (!themeGenerated) {
        const themes = Object.keys(wordCollectThemes_fallback);
        const themeName = themes[Math.floor(Math.random() * themes.length)];
        currentWordCollectData = {
            theme: themeName,
            words: [...wordCollectThemes_fallback[themeName].words],
            decoys: [...wordCollectThemes_fallback[themeName].decoys]
        };
    }

    document.getElementById('wordCollectTheme').textContent = currentWordCollectData.theme;
    objectsArea.innerHTML = '';

    let displayWords = [...currentWordCollectData.words, ...currentWordCollectData.decoys];
    displayWords = displayWords.sort(() => 0.5 - Math.random());

    displayWords.forEach(word => {
        const wordDiv = document.createElement('div');
        wordDiv.className = 'word-object';
        wordDiv.textContent = word;
        wordDiv.onclick = () => {
            if (gameTimeLeft <= 0 || wordDiv.dataset.clicked) return;
            if (currentWordCollectData.words.includes(word)) {
                gameScore++;
                document.getElementById('wordCollectScore').textContent = gameScore;
                wordDiv.style.backgroundColor = "#a0e8a0";
                wordDiv.style.borderColor = "#5cb85c";
                wordDiv.dataset.clicked = true;
                updateVocabularyAndStats(word, null, "game_learned");
            } else {
                wordDiv.style.backgroundColor = "#f8a0a0";
                wordDiv.style.borderColor = "#d9534f";
                gameScore = Math.max(0, gameScore - 1);
                document.getElementById('wordCollectScore').textContent = gameScore;
                wordDiv.dataset.clicked = true;
            }
        };
        objectsArea.appendChild(wordDiv);
    });

    gameScore = 0;
    gameTimeLeft = 30;
    document.getElementById('wordCollectTimeLeft').textContent = gameTimeLeft;
    document.getElementById('wordCollectScore').textContent = gameScore;
    document.getElementById('wordCollectMessage').textContent = `${AI_NAME}「テーマ「${currentWordCollectData.theme}」の言葉をあつめてぷぷ！」`;

    gameTimer = setInterval(() => {
        gameTimeLeft--;
        document.getElementById('wordCollectTimeLeft').textContent = gameTimeLeft;
        if (gameTimeLeft <= 0) {
            endGame("wordCollect", `時間切れ！ スコア: ${gameScore}点でした！`);
        }
    }, 1000);
}

// --- ミニゲーム２：アルゴスケイプ (おつかいゲーム) ---
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

    initializeErrandMap();
    drawErrandMap();
    updateErrandObjective();

    document.getElementById('errandMessage').textContent = `${AI_NAME}「おつかい、がんばるぷぷー！」`;
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
        mapGrid[ry][rx] = 1;
    }

    const placeItem = (itemId) => {
        let placed = false;
        while(!placed) {
            const rx = Math.floor(Math.random() * MAP_WIDTH_TILES);
            const ry = Math.floor(Math.random() * MAP_HEIGHT_TILES);
            if (mapGrid[ry][rx] === 0 && !(rx === 0 && ry === 0)) {
                mapGrid[ry][rx] = itemId;
                placed = true;
            }
        }
    };
    placeItem(2); // 店A (リンゴ)
    placeItem(3); // 店B (ミルク)
    placeItem(4); // ゴール (おうち)

    errandItemsToGet = [
        { name: "りんご", storeId: 2, collected: false, icon: "🍎" },
        { name: "ミルク", storeId: 3, collected: false, icon: "🥛" }
    ];
}

function drawErrandMap() {
    const mapArea = document.getElementById('errandMapArea');
    const playerElem = document.getElementById('errandPlayer');
    if (!mapArea || !playerElem) {
        console.error("マップ要素またはプレイヤー要素が見つかりません。");
        return;
    }

    mapArea.innerHTML = '';
    mapArea.appendChild(playerElem);

    for (let r = 0; r < MAP_HEIGHT_TILES; r++) {
        for (let c = 0; c < MAP_WIDTH_TILES; c++) {
            const tileValue = mapGrid[r][c];
            let tileChar = "";
            let tileTitle = "";
            let isWall = false;

            if (tileValue === 1) {
                isWall = true;
                const wallDiv = document.createElement('div');
                wallDiv.className = 'map-item';
                wallDiv.style.backgroundColor = '#8d6e63';
                wallDiv.style.left = `${c * TILE_SIZE}px`;
                wallDiv.style.top = `${r * TILE_SIZE}px`;
                wallDiv.title = "かべ";
                mapArea.appendChild(wallDiv);
            }

            const itemToGet = errandItemsToGet.find(item => item.storeId === tileValue && !item.collected);
            if (!isWall && itemToGet) {
                tileChar = itemToGet.icon;
                tileTitle = itemToGet.name + "のお店";
            } else if (!isWall && tileValue === 4) {
                tileChar = "🏠";
                tileTitle = "おうち";
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
    const objectiveElem = document.getElementById('errandObjective');
    if(!objectiveElem) return;
    const uncollected = errandItemsToGet.filter(item => !item.collected);
    let text = "目的: ";
    if (uncollected.length > 0) {
        text += uncollected.map(item => item.name).join(" と ") + " をゲット！ ";
    } else {
        text += "おうち（🏠）に帰る！";
    }
    objectiveElem.textContent = text;
}

function movePlayerErrand(direction) {
    let newX = playerPos.x;
    let newY = playerPos.y;
    if (direction === "up") newY--;
    if (direction === "down") newY++;
    if (direction === "left") newX--;
    if (direction === "right") newX++;

    if (newY >= 0 && newY < MAP_HEIGHT_TILES && newX >= 0 && newX < MAP_WIDTH_TILES && mapGrid[newY][newX] !== 1) {
        playerPos.x = newX;
        playerPos.y = newY;
        document.getElementById('errandPlayer').style.left = `${playerPos.x * TILE_SIZE}px`;
        document.getElementById('errandPlayer').style.top = `${playerPos.y * TILE_SIZE}px`;

        const currentTileValue = mapGrid[playerPos.y][playerPos.x];
        errandItemsToGet.forEach(item => {
            if (!item.collected && currentTileValue === item.storeId) {
                item.collected = true;
                document.getElementById('errandMessage').textContent = `${item.name}をゲットしたぷぷ！`;
                drawErrandMap();
                updateErrandObjective();
            }
        });

        if (currentTileValue === 4 && errandItemsToGet.every(item => item.collected)) {
            endGame("errand", `${GAME_NAME_ERRAND}大成功！えらい！`);
            document.querySelectorAll('#errandControls button').forEach(btn => btn.disabled = true); // ゲーム終了
        }
    }
}

// --- ミニゲーム３：言葉のしりとりチェーン ---
const katakanaToHiragana = (str) => {
    const kanaMap = {
        'ァ': 'あ', 'ィ': 'い', 'ゥ': 'う', 'ェ': 'え', 'ォ': 'お', 'カ': 'か', 'キ': 'き', 'ク': 'く', 'ケ': 'け', 'コ': 'こ',
        'サ': 'さ', 'シ': 'し', 'ス': 'す', 'セ': 'せ', 'ソ': 'そ', 'タ': 'た', 'チ': 'ち', 'ツ': 'つ', 'テ': 'て', 'ト': 'と',
        'ナ': 'な', 'ニ': 'に', 'ヌ': 'ぬ', 'ネ': 'ね', 'ノ': 'の', 'ハ': 'は', 'ヒ': 'ひ', 'フ': 'ふ', 'ヘ': 'へ', 'ホ': 'ほ',
        'マ': 'ま', 'ミ': 'み', 'ム': 'む', 'メ': 'め', 'モ': 'も', 'ヤ': 'や', 'ユ': 'ゆ', 'ヨ': 'よ', 'ラ': 'ら', 'リ': 'り',
        'ル': 'る', 'レ': 'れ', 'ロ': 'ろ', 'ワ': 'わ', 'ヲ': 'を', 'ン': 'ん', 'ガ': 'が', 'ギ': 'ぎ', 'グ': 'ぐ', 'ゲ': 'げ',
        'ゴ': 'ご', 'ザ': 'ざ', 'ジ': 'じ', 'ズ': 'ず', 'ゼ': 'ぜ', 'ゾ': 'ぞ', 'ダ': 'だ', 'ヂ': 'ぢ', 'ヅ': 'づ', 'デ': 'で',
        'ド': 'ど', 'バ': 'ば', 'ビ': 'び', 'ブ': 'ぶ', 'ベ': 'べ', 'ボ': 'ぼ', 'パ': 'ぱ', 'ピ': 'ぴ', 'プ': 'ぷ', 'ペ': 'ぺ',
        'ポ': 'ぽ', 'ャ': 'や', 'ュ': 'ゆ', 'ョ': 'よ', 'ッ': 'つ', 'ー': 'ー', 'ヰ': 'ゐ', 'ヱ': 'ゑ', 'ヴ': 'ゔ', 'ヶ': 'ヶ', 'ヵ': 'か',
    };
    let hiraganaStr = '';
    for (let i = 0; i < str.length; i++) {
        let char = str[i];
        if (str[i+1] === 'ﾞ') {
            const base = { 'ｶ': 'が', 'ｷ': 'ぎ', 'ｸ': 'ぐ', 'ｹ': 'げ', 'ｺ': 'ご', 'ｻ': 'ざ', 'ｼ': 'じ', 'ｽ': 'ず', 'ｾ': 'ぜ', 'ｿ': 'そ', 'ﾀ': 'だ', 'ﾁ': 'ぢ', 'ﾂ': 'づ', 'ﾃ': 'で', 'ﾄ': 'ど', 'ﾊ': 'ば', 'ﾋ': 'び', 'ﾌ': 'ぶ', 'ﾍ': 'べ', 'ﾎ': 'ぼ' };
            if (base[char]) { hiraganaStr += base[char]; i++; continue; }
        } else if (str[i+1] === 'ﾟ') {
            const base = { 'ﾊ': 'ぱ', 'ﾋ': 'ぴ', 'ﾌ': 'ぷ', 'ﾍ': 'ぺ', 'ﾎ': 'ぽ' };
            if (base[char]) { hiraganaStr += base[char]; i++; continue; }
        }
        hiraganaStr += kanaMap[char] || char;
    }
    return hiraganaStr;
};

const getShiritoriLastChar = (word) => {
    if (!word || word.length === 0) return '';
    word = katakanaToHiragana(word).toLowerCase();
    let lastChar = word.slice(-1);

    if (lastChar === 'ん') return 'ん';
    if (lastChar === 'っ' && word.length > 1) return getShiritoriLastChar(word.slice(0, -1));
    if (lastChar === 'ー' && word.length > 1) {
        let prevChar = word.slice(-2, -1);
        const vowelMap = {'あ': 'あ', 'い': 'い', 'う': 'う', 'え': 'え', 'お': 'お', 'か': 'あ', 'き': 'い', 'く': 'う', 'け': 'え', 'こ': 'お', 'さ': 'あ', 'し': 'い', 'す': 'う', 'せ': 'え', 'そ': 'お', 'た': 'あ', 'ち': 'い', 'つ': 'う', 'て': 'え', 'と': 'お', 'な': 'あ', 'に': 'い', 'ぬ': 'う', 'ね': 'え', 'の': 'お', 'は': 'あ', 'ひ': 'い', 'ふ': 'う', 'へ': 'え', 'ほ': 'お', 'ま': 'あ', 'み': 'い', 'む': 'う', 'め': 'え', 'も': 'お', 'や': 'あ', 'ゆ': 'う', 'よ': 'お', 'ら': 'あ', 'り': 'い', 'る': 'う', 'れ': 'え', 'ろ': 'お', 'わ': 'あ', 'を': 'お', 'ん': 'ん'};
        const dakutenBaseChar = {'が': 'か', 'ぎ': 'き', 'ぐ': 'ぐ', 'げ': 'け', 'ご': 'こ', 'ざ': 'さ', 'じ': 'し', 'ず': 'す', 'ぜ': 'ぜ', 'ぞ': 'ぞ', 'だ': 'た', 'ぢ': 'ち', 'づ': 'つ', 'で': 'で', 'ど': 'と', 'ば': 'は', 'び': 'ひ', 'ぶ': 'ふ', 'べ': 'べ', 'ぼ': 'ほ', 'ぱ': 'は', 'ぴ': 'ひ', 'ぷ': 'ふ', 'ぺ': 'ぺ', 'ぽ': 'ほ'};
        let baseChar = dakutenBaseChar[prevChar] || prevChar;
        return vowelMap[baseChar] || prevChar;
    }
    const youonMap = {'ゃ': 'や', 'ゅ': 'ゆ', 'ょ': 'よ'};
    lastChar = youonMap[lastChar] || lastChar;
    const dakutenToSeionMap = {'が': 'か', 'ぎ': 'き', 'ぐ': 'く', 'げ': 'け', 'ご': 'こ', 'ざ': 'さ', 'じ': 'し', 'す': 'す', 'ぜ': 'ぜ', 'ぞ': 'ぞ', 'だ': 'た', 'ぢ': 'ち', 'づ': 'つ', 'で': 'で', 'ど': 'と', 'ば': 'は', 'び': 'ひ', 'ぶ': 'ふ', 'べ': 'べ', 'ぼ': 'ほ', 'ぱ': 'は', 'ぴ': 'ひ', 'ぷ': 'ふ', 'ぺ': 'ぺ', 'ぽ': 'ほ'};
    return dakutenToSeionMap[lastChar] || lastChar;
};

const getShiritoriFirstChar = (word) => {
    if (!word || word.length === 0) return '';
    word = katakanaToHiragana(word).toLowerCase();
    let firstChar = word.slice(0, 1);
    const youonMap = {'ゃ': 'や', 'ゅ': 'ゆ', 'ょ': 'よ'};
    firstChar = youonMap[firstChar] || firstChar;
    return firstChar;
};

const isShiritoriMatch = (prevChar, currChar) => {
    const normalizedPrev = getShiritoriLastChar(prevChar);
    const normalizedCurr = getShiritoriFirstChar(currChar);

    if (normalizedPrev === normalizedCurr) return true;
    
    const seionToDakutenMap = {
        'か': ['が'], 'き': ['ぎ'], 'く': ['ぐ'], 'け': ['げ'], 'こ': ['ご'],
        'さ': ['ざ'], 'し': ['じ'], 'す': ['ず'], 'せ': ['ぜ'], 'そ': ['ぞ'],
        'た': ['だ'], 'ち': ['ぢ'], 'つ': ['づ'], 'て': ['で'], 'と': ['ど'],
        'は': ['ば', 'ぱ'], 'ひ': ['び', 'ぴ'], 'ふ': ['ぶ', 'ぷ'], 'へ': ['べ', 'ぺ'], 'ほ': ['ぼ', 'ぽ']
    };
    if (seionToDakutenMap[normalizedPrev]?.includes(normalizedCurr)) return true;
    return false;
};


function startGameShiritori() {
    if (currentGame) return;
    currentGame = "shiritori";
    miniGameModal.style.display = 'flex';
    miniGameTitle.textContent = "言葉のしりとりチェーン";
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
    document.getElementById('shiritoriMessage').textContent = `${AI_NAME}「しりとり、はじめるぷぷ！」`;
    const userInputField = document.getElementById('shiritoriUserInput');
    userInputField.value = '';
    userInputField.disabled = false;
    const submitBtn = document.getElementById('shiritoriSubmitBtn');
    submitBtn.disabled = false;
    document.getElementById('shiritoriTurnIndicator').textContent = "あなたの番";

    submitBtn.onclick = handleShiritoriUserSubmit;
    userInputField.onkeypress = (e) => {
        if (e.key === 'Enter' && !submitBtn.disabled) {
            e.preventDefault();
            handleShiritoriUserSubmit();
        }
    };
}

function handleShiritoriUserSubmit() {
    const userInputField = document.getElementById('shiritoriUserInput');
    const userWordRaw = userInputField.value.trim();
    const userWordLogic = katakanaToHiragana(userWordRaw.toLowerCase());

    const messageElem = document.getElementById('shiritoriMessage');
    const historyList = document.getElementById('shiritoriHistory');

    if (!userWordRaw) { messageElem.textContent = "言葉を入力してぷぷ！"; return; }
    if (!/^[ぁ-んァ-ヶー]+$/.test(userWordRaw)) { messageElem.textContent = "ひらがなかカタカナで入力してね！"; return; }
    if (userWordLogic.slice(-1) === "ん") {
        endGame("shiritori", `「ん」で終わっちゃったぷぷ！あなたの負けだぷぷ… ${shiritoriChainCount}回続いたよ！`);
        return;
    }
    if (shiritoriUsedWords.has(userWordLogic)) {
        messageElem.textContent = "その言葉はもう使ったよ！"; return;
    }
    if (!isShiritoriMatch(shiritoriCurrentWordForLogic, userWordLogic)) {
        const requiredChar = getShiritoriLastChar(shiritoriCurrentWordForLogic);
        messageElem.textContent = `「${requiredChar}」から始まる言葉だよ！ (あなたは「${getShiritoriFirstChar(userWordLogic)}」から始めたみたい)`;
        return;
    }

    shiritoriCurrentWordForDisplay = userWordRaw;
    shiritoriCurrentWordForLogic = userWordLogic;
    shiritoriUsedWords.add(userWordLogic);
    shiritoriChainCount++;
    updateVocabularyAndStats(userWordRaw, null, "game_used");

    const li = document.createElement('li');
    li.textContent = `${userWordRaw} (あなた)`;
    historyList.prepend(li);
    document.getElementById('shiritoriPrevWord').textContent = userWordRaw;
    userInputField.value = '';
    messageElem.textContent = "いい感じ！次はぷぷの番…";
    document.getElementById('shiritoriTurnIndicator').textContent = `${AI_NAME}の番 (考え中...)`;
    userInputField.disabled = true;
    document.getElementById('shiritoriSubmitBtn').disabled = true;

    setTimeout(aiShiritoriTurn, 1000 + Math.random() * 1500);
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
            "あ": ["あり", "あめ"], "い": ["いぬ", "いちご"], "う": ["うさぎ", "うみ"], "え": ["えんぴつ", "えだ"], "お": ["おに", "おしろ"],
            "か": ["かめ", "かばん"], "き": ["きりん", "きっぷ"], "く": ["くま", "くるま"], "け": ["ケーキ", "けむり"], "こ": ["こども", "こっぷ"],
            "さ": ["さかな", "さいふ"], "し": ["しりとり", "しんぶん"], "す": ["すいか", "すずめ"], "せ": ["せんたく", "せかい"], "そ": ["そら", "ぞう"],
            "た": ["たこ", "たまご"], "ち": ["チーズ", "ちきゅう"], "つ": ["つくえ", "つみき"], "て": ["テレビ", "てがみ"], "と": ["とまと", "とけい"],
            "な": ["なす", "なべ"], "に": ["にんじん", "にわ"], "ぬ": ["ぬいぐるみ", "ぬの"], "ね": ["ねこ", "ねぎ"], "の": ["のり", "ノート"],
            "は": ["バナナ", "はな"], "ひ": ["ひこうき", "ひよこ"], "ふ": ["ふく", "ふね"], "へ": ["ヘビ", "へや"], "ほ": ["ボール", "ほし"],
            "ま": ["まんま", "マスク"], "み": ["みかん", "みみ"], "む": ["むし", "むら"], "め": ["メガネ", "めだま"], "も": ["もも", "もち"],
            "や": ["やま", "ゆきだるま"], "ゆ": ["ゆめ", "ゆび"], "よ": ["ヨーグルト", "よる"],
            "ら": ["ラジオ", "らいおん"], "り": ["りんご", "りす"], "る": ["ルーペ", "るすばん"], "れ": ["レモン", "れんが"], "ろ": ["ロウソク", "ろば"],
            "わ": ["わに", "わたあめ"], "を": ["おに"],
            "ん": []
        };
        let potentialFallbacks = (fallbackWordsByStartChar[lastCharForAIStart] || [])
            .map(fw => ({ display: fw, logic: katakanaToHiragana(fw.toLowerCase()) }))
            .filter(obj => !shiritoriUsedWords.has(obj.logic) && obj.logic.slice(-1) !== 'ん');

        if(potentialFallbacks.length > 0) {
            aiWordObj = potentialFallbacks[Math.floor(Math.random() * potentialFallbacks.length)];
        }
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

        const li = document.createElement('li');
        li.textContent = `${aiWordObj.display} (${AI_NAME})`;
        historyList.prepend(li);
        document.getElementById('shiritoriPrevWord').textContent = aiWordObj.display;
        messageElem.textContent = `${AI_NAME}「${aiWordObj.display}！」 さあ、あなたの番！`;
        document.getElementById('shiritoriTurnIndicator').textContent = "あなたの番";
        userInputField.disabled = false;
        submitBtn.disabled = false;
        userInputField.focus();

        if (aiWordObj.logic.slice(-1) === "ん") {
            endGame("shiritori", `${AI_NAME}が「ん」で終わっちゃった！あなたの勝ちだぷぷ！${shiritoriChainCount}回続いたね！`);
        }
    } else {
        endGame("shiritori", `${AI_NAME}「うーん、思いつかないぷぷ…」あなたの勝ちだぷぷ！${shiritoriChainCount}回も続いたね！`);
    }
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
        if (e.key === 'Enter' && !e.shiftKey && !sendButton.disabled) {
            e.preventDefault();
            sendMessage();
        }
    });
    resetButton.addEventListener('click', resetAI);
    statusButton.addEventListener('click', showStatus);
    teachButton.addEventListener('click', teachWord);
    showApiSetupBtn.addEventListener('click', showApiSetup);
    saveApiKeyBtn.addEventListener('click', saveApiKey);
    closeCelebrationBtn.addEventListener('click', closeCelebration);

    // ミニゲームのイベントリスナー
    document.getElementById('startGame1Btn').addEventListener('click', startGameWordCollect);
    document.getElementById('startGame2Btn').addEventListener('click', startGameErrand); // アルゴスケイプ
    document.getElementById('startGame3Btn').addEventListener('click', startGameShiritori);
    closeMiniGameBtn.addEventListener('click', closeMiniGameModal);
    
    // 初期化処理
    loadAiState();
    const apiKeyExists = loadApiKey();
    chatArea.innerHTML = '';
    aiState.dialogue_history.forEach(turn => {
        const speaker = turn.role === "user" ? 'あなた' : AI_NAME;
        addMessageToLog(speaker, turn.parts[0].text);
    });

    if (apiKeyExists && aiState.dialogue_history.length === 0) {
        addInitialAiGreeting();
    } else if (!apiKeyExists) {
        addMessageToLog('システム', 'ようこそ！まずGemini APIキーを設定してください。', 'system-message');
    }

    updateDisplay();
}


document.addEventListener('DOMContentLoaded', initialize);


function showThinkingAnimation(tokens = []) {
  const wrap = document.getElementById('thinkingBubbles');
  if (!wrap) return;
  wrap.innerHTML = '';
  wrap.style.display = tokens.length ? 'flex' : 'none';
  tokens.slice(0, 8).forEach(t => {
    const chip = document.createElement('span');
    chip.className = 'bubble-chip';
    chip.textContent = t;
    wrap.appendChild(chip);
  });
}

function stopThinkingAnimation() {
  const wrap = document.getElementById('thinkingBubbles');
  if (!wrap) return;
  wrap.style.display = 'none';
  wrap.innerHTML = '';
}

