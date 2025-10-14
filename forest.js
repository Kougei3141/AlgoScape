/********************************************************************
 🌳 Pupu Learning Forest (v1)
 - 覚えた語彙を森として可視化
 ********************************************************************/

document.addEventListener("DOMContentLoaded", () => {
  PupuCore.initPupuCore();
  drawForest();
});

const canvas = document.getElementById("forestCanvas");
const ctx = canvas.getContext("2d");

// 🌸 木・花・実を描画するエンティティ
function drawForest() {
  const vocab = PupuCore.aiState.vocabulary;
  const keys = Object.keys(vocab);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#e8f5e9";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (keys.length === 0) {
    ctx.font = "24px 'UD デジタル 教科書体'";
    ctx.fillStyle = "#888";
    ctx.fillText("ぷぷはまだ森を育てていないみたい…", 180, 250);
    return;
  }

  ctx.font = "16px 'UD デジタル 教科書体'";
  ctx.fillStyle = "#4e342e";
  ctx.fillText(`総語彙数: ${keys.length}`, 20, 30);

  let i = 0;
  for (const word of keys) {
    const w = vocab[word];
    const x = 60 + (i % 10) * 70;
    const y = 100 + Math.floor(i / 10) * 100;
    drawPlant(word, w, x, y);
    i++;
  }
}

// 🌿 単語の状態に応じて植物を描く
function drawPlant(word, data, x, y) {
  const baseColor = getPlantColor(data);

  // 幹
  ctx.strokeStyle = "#795548";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - 30);
  ctx.stroke();

  // 葉・花
  ctx.fillStyle = baseColor;
  ctx.beginPath();
  ctx.arc(x, y - 40, 15, 0, Math.PI * 2);
  ctx.fill();

  // 単語ラベル
  ctx.font = "13px 'UD デジタル 教科書体'";
  ctx.fillStyle = "#333";
  ctx.fillText(word, x - ctx.measureText(word).width / 2, y + 20);
}

// 🍀 カラー判定（状態別）
function getPlantColor(info) {
  if (info.category === "taught") return "#fdd835"; // 教えられた：金色
  if (info.mastered) return "#ef5350"; // マスター済：赤い花
  if (info.category.startsWith("game")) return "#66bb6a"; // ゲーム習得：緑
  if (info.category === "ai") return "#42a5f5"; // AI発見語：青
  return "#9ccc65"; // 通常：葉色
}

// 🔄 更新ボタン
function refreshForest() {
  PupuCore.loadAiState();
  drawForest();
}
