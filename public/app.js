const essayInput = document.getElementById("essayInput");
const levelSelect = document.getElementById("level");
const checkBtn = document.getElementById("checkBtn");
const clearBtn = document.getElementById("clearBtn");
const charCount = document.getElementById("charCount");
const errorMsg = document.getElementById("errorMsg");
const loading = document.getElementById("loading");
const resultPanel = document.getElementById("resultPanel");

const MAX_LENGTH = 8000;

const CATEGORY_CLASS = {
  "문법": "cat-grammar",
  "어휘": "cat-vocab",
  "문장 구조": "cat-structure",
  "내용/논리": "cat-logic",
  "문체": "cat-style",
};

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

essayInput.addEventListener("input", () => {
  charCount.textContent = `${essayInput.value.length} / ${MAX_LENGTH}`;
});

clearBtn.addEventListener("click", () => {
  essayInput.value = "";
  charCount.textContent = `0 / ${MAX_LENGTH}`;
  resultPanel.hidden = true;
  hideError();
});

function showError(message) {
  errorMsg.textContent = message;
  errorMsg.hidden = false;
}

function hideError() {
  errorMsg.hidden = true;
  errorMsg.textContent = "";
}

function buildHighlightedEssay(rawEssay, corrections) {
  let escaped = escapeHtml(rawEssay);

  for (const c of corrections) {
    const needle = escapeHtml(c.original);
    if (!needle || !escaped.includes(needle)) continue;

    const catClass = CATEGORY_CLASS[c.category] || "";
    const tooltip = escapeHtml(`[${c.category}] → ${c.suggestion}\n${c.explanation}`);
    const replacement = `<mark class="correction ${catClass}" title="${tooltip}">${needle}</mark>`;

    escaped = escaped.replace(needle, replacement);
  }

  return escaped;
}

function renderResult(data, rawEssay) {
  document.getElementById("scoreValue").textContent = Math.round(data.overall_score);
  document.getElementById("summaryText").textContent = data.summary;

  const strengthsList = document.getElementById("strengthsList");
  strengthsList.innerHTML = "";
  (data.strengths || []).forEach((s) => {
    const li = document.createElement("li");
    li.textContent = s;
    strengthsList.appendChild(li);
  });

  const improvementsList = document.getElementById("improvementsList");
  improvementsList.innerHTML = "";
  (data.improvements || []).forEach((s) => {
    const li = document.createElement("li");
    li.textContent = s;
    improvementsList.appendChild(li);
  });

  document.getElementById("highlightedEssay").innerHTML = buildHighlightedEssay(
    rawEssay,
    data.corrections || []
  );

  document.getElementById("correctedEssay").textContent = data.corrected_essay;

  const correctionsList = document.getElementById("correctionsList");
  correctionsList.innerHTML = "";
  document.getElementById("correctionCount").textContent = (data.corrections || []).length;

  (data.corrections || []).forEach((c) => {
    const item = document.createElement("div");
    item.className = "correction-item";
    item.innerHTML = `
      <span class="badge">${escapeHtml(c.category)}</span>
      <div class="diff">
        <span class="orig">${escapeHtml(c.original)}</span>
        <span class="arrow">→</span>
        <span class="fix">${escapeHtml(c.suggestion)}</span>
      </div>
      <p class="explanation">${escapeHtml(c.explanation)}</p>
    `;
    correctionsList.appendChild(item);
  });

  resultPanel.hidden = false;
}

async function handleCheck() {
  const essay = essayInput.value.trim();
  hideError();

  if (!essay) {
    showError("첨삭할 에세이 내용을 입력해주세요.");
    return;
  }
  if (essay.length > MAX_LENGTH) {
    showError(`에세이가 너무 깁니다. ${MAX_LENGTH}자 이내로 입력해주세요.`);
    return;
  }

  checkBtn.disabled = true;
  resultPanel.hidden = true;
  loading.hidden = false;

  try {
    const res = await fetch("/api/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ essay, level: levelSelect.value }),
    });

    const data = await res.json();

    if (!res.ok) {
      showError(data.error || "첨삭 중 오류가 발생했습니다.");
      return;
    }

    renderResult(data, essay);
  } catch (err) {
    showError("서버와 통신 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
  } finally {
    checkBtn.disabled = false;
    loading.hidden = true;
  }
}

checkBtn.addEventListener("click", handleCheck);
