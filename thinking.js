/********************************************************************
 💭 Pupu Thinking Mode (v1)
 - 語彙データから思考アニメーションを生成
 ********************************************************************/

document.addEventListener("DOMContentLoaded", () => {
  PupuCore.initPupuCore();
  drawThinking();
});

const canvas = document.getElementById("thinkingCanvas");
const ctx = canvas.getContext("2d");
let particles = [];

// 🌱 思考単語をランダムに動かすパーティクル
function drawThinking() {
  const vocabKeys = Object.keys(PupuCore.aiState.vocabulary);
  if (vocabKeys.length === 0) {
    ctx.font = "20px 'UD デジタル 教科書体'";
    ctx.fillStyle = "#c2185b";
    ctx.fillText("まだぷぷは考えられないみたい…", 150, 200);
    return;
  }

  // パーティクル生成
  particles = vocabKeys.slice(-50).map((word, i) => ({
    text: word,
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    dx: (Math.random() - 0.5) * 1.2,
    dy: (Math.random() - 0.5) * 1.2,
    size: 14 + Math.random() * 10,
    color: getColorForWord(PupuCore.aiState.vocabulary[word])
  }));

  animateThinking();
}

// 🎨 単語カテゴリーごとに色分け
function getColorForWord(info) {
  if (info.category === "user") return "#ff80ab";
  if (info.category === "ai") return "#80deea";
  if (info.category.startsWith("game")) return "#c5e1a5";
  if (info.category === "taught") return "#fbc02d";
  return "#e0e0e0";
}

// 💫 アニメーションループ
function animateThinking() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const p of particles) {
    p.x += p.dx;
    p.y += p.dy;

    // 端で跳ね返る
    if (p.x < 0 || p.x > canvas.width) p.dx *= -1;
    if (p.y < 0 || p.y > canvas.height) p.dy *= -1;

    ctx.font = `${p.size}px 'UD デジタル 教科書体', sans-serif`;
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, p.x, p.y);
  }

  requestAnimationFrame(animateThinking);
}

// 🔄 更新ボタンで思考をリロード
function refreshThinking() {
  PupuCore.loadAiState();
  drawThinking();
}
