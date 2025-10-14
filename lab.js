/********************************************************************
 🔬 Pupu Generation Lab (v1)
 - 語彙をEmbeddingで「意味の近さ」マップに配置
 ********************************************************************/

document.addEventListener("DOMContentLoaded", () => {
  PupuCore.initPupuCore();
  drawLab();
});

// === 疑似Embedding生成 ===
// （本来はGemini Embedding APIを使うが、今回はローカル擬似ベクトルで体験可能）
function generateFakeEmbeddings(words) {
  const embeddings = [];
  for (const w of words) {
    const hash = [...w].reduce((a, c) => a + c.charCodeAt(0), 0);
    const angle = (hash % 360) * (Math.PI / 180);
    const radius = (hash % 100) / 100;
    embeddings.push({
      word: w,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius
    });
  }
  return embeddings;
}

// === 描画 ===
function drawLab() {
  const vocabKeys = Object.keys(PupuCore.aiState.vocabulary);
  const chartElem = document.getElementById("chart");
  chartElem.innerHTML = "";

  if (vocabKeys.length < 2) {
    chartElem.innerHTML = "<p style='color:#888;padding:50px;'>ぷぷはまだ意味空間を形成できないみたい…</p>";
    return;
  }

  const data = generateFakeEmbeddings(vocabKeys.slice(-100));

  const ctx = document.createElement("canvas");
  ctx.width = chartElem.clientWidth;
  ctx.height = 500;
  chartElem.appendChild(ctx);

  new Chart(ctx, {
    type: "scatter",
    data: {
      datasets: [{
        label: "ぷぷの意味空間",
        data: data.map(d => ({ x: d.x, y: d.y })),
        pointBackgroundColor: data.map(d => getColorForWord(PupuCore.aiState.vocabulary[d.word])),
        pointRadius: 8
      }]
    },
    options: {
      plugins: {
        tooltip: {
          callbacks: {
            label: function(context) {
              return vocabKeys[context.dataIndex];
            }
          }
        },
        legend: { display: false }
      },
      scales: {
        x: { display: false },
        y: { display: false }
      }
    }
  });
}

// カラー分け（他ページと一致）
function getColorForWord(info) {
  if (info.category === "taught") return "#fdd835"; // 教えられた
  if (info.mastered) return "#ef5350"; // マスター済み
  if (info.category.startsWith("game")) return "#66bb6a"; // ゲーム
  if (info.category === "ai") return "#42a5f5"; // AI語
  return "#9ccc65"; // 通常
}

// 🔄 更新ボタン
function refreshLab() {
  PupuCore.loadAiState();
  drawLab();
}
