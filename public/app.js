const levelSelect = document.getElementById("level");
const checkBtn = document.getElementById("checkBtn");
const clearBtn = document.getElementById("clearBtn");
const errorMsg = document.getElementById("errorMsg");
const loading = document.getElementById("loading");
const resultPanel = document.getElementById("resultPanel");

const tabButtons = document.querySelectorAll(".tab-btn");
const imageModePanel = document.getElementById("imageMode");
const textModePanel = document.getElementById("textMode");

const dropzone = document.getElementById("dropzone");
const dropzoneText = document.getElementById("dropzoneText");
const imageFileInput = document.getElementById("imageFile");
const imageThumbs = document.getElementById("imageThumbs");

const essayInput = document.getElementById("essayInput");
const charCount = document.getElementById("charCount");

const MAX_TEXT_LENGTH = 8000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES = 5;

let currentMode = "image";
let selectedImages = []; // [{ base64, mediaType }]

const CATEGORY_META = {
  "Grammar": { cls: "cat-grammar", label: "🔴 문법 (Grammar)" },
  "Spelling": { cls: "cat-spelling", label: "🔵 철자 (Spelling)" },
  "Vocabulary/Word Choice": { cls: "cat-vocabulary", label: "🟢 어휘 (Vocabulary)" },
  "Punctuation": { cls: "cat-punctuation", label: "🟠 문장부호 (Punctuation)" },
  "Sentence Structure/Naturalness": { cls: "cat-structure", label: "🟣 문장 구조 (Structure)" },
  "Organization/Coherence": { cls: "cat-organization", label: "🟡 구성/논리 (Organization)" },
  "Other": { cls: "cat-other", label: "⚪ 기타 (Other)" },
};
const OCR_META = { cls: "cat-ocr", label: "🟤 OCR 판독 불확실" };

const SEVERITY_LABEL = { Minor: "경미", Moderate: "보통", Major: "심각" };

// ---------- Tabs ----------

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    currentMode = btn.dataset.mode;
    tabButtons.forEach((b) => b.classList.toggle("active", b === btn));
    imageModePanel.hidden = currentMode !== "image";
    textModePanel.hidden = currentMode !== "text";
    hideError();
  });
});

// ---------- Image upload ----------

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result; // data:<mime>;base64,<data>
      const [, base64] = result.split(",");
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function renderImageThumbs() {
  imageThumbs.innerHTML = "";
  selectedImages.forEach((img, index) => {
    const thumb = document.createElement("div");
    thumb.className = "thumb";
    thumb.innerHTML = `
      <img src="data:${img.mediaType};base64,${img.base64}" alt="업로드한 에세이 페이지 ${index + 1}" />
      <span class="thumb-index">${index + 1}</span>
      <button type="button" class="thumb-remove" data-index="${index}" aria-label="이미지 제거">×</button>
    `;
    imageThumbs.appendChild(thumb);
  });

  const remaining = MAX_IMAGES - selectedImages.length;
  if (remaining <= 0) {
    dropzone.classList.add("disabled");
    dropzoneText.textContent = `최대 ${MAX_IMAGES}장까지 업로드했습니다`;
  } else {
    dropzone.classList.remove("disabled");
    dropzoneText.textContent =
      selectedImages.length === 0
        ? "클릭하거나 이미지를 끌어다 놓으세요"
        : `이미지 추가 (${selectedImages.length}/${MAX_IMAGES})`;
  }
}

imageThumbs.addEventListener("click", (e) => {
  const btn = e.target.closest(".thumb-remove");
  if (!btn) return;
  const index = Number(btn.dataset.index);
  selectedImages.splice(index, 1);
  renderImageThumbs();
});

async function handleImageFiles(fileList) {
  hideError();
  const files = Array.from(fileList || []);
  if (files.length === 0) return;

  for (const file of files) {
    if (selectedImages.length >= MAX_IMAGES) {
      showError(`이미지는 최대 ${MAX_IMAGES}장까지 업로드할 수 있습니다.`);
      break;
    }
    if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type)) {
      showError("지원하지 않는 이미지 형식입니다. (JPEG, PNG, GIF, WEBP만 지원)");
      continue;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      showError("이미지 용량이 너무 큽니다. 장당 5MB 이하로 업로드해주세요.");
      continue;
    }

    try {
      const base64 = await readFileAsBase64(file);
      selectedImages.push({ base64, mediaType: file.type });
    } catch {
      showError("이미지를 읽는 중 오류가 발생했습니다.");
    }
  }

  renderImageThumbs();
}

imageFileInput.addEventListener("change", (e) => {
  handleImageFiles(e.target.files);
  imageFileInput.value = "";
});

["dragenter", "dragover"].forEach((evt) => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.add("drag-over");
  });
});
["dragleave", "drop"].forEach((evt) => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.remove("drag-over");
  });
});
dropzone.addEventListener("drop", (e) => {
  handleImageFiles(e.dataTransfer.files);
});

dropzone.addEventListener("click", (e) => {
  if (selectedImages.length >= MAX_IMAGES) {
    e.preventDefault();
    showError(`이미지는 최대 ${MAX_IMAGES}장까지 업로드할 수 있습니다.`);
  }
});

// ---------- Text mode ----------

essayInput.addEventListener("input", () => {
  charCount.textContent = `${essayInput.value.length} / ${MAX_TEXT_LENGTH}`;
});

// ---------- Shared ----------

clearBtn.addEventListener("click", () => {
  essayInput.value = "";
  charCount.textContent = `0 / ${MAX_TEXT_LENGTH}`;
  selectedImages = [];
  renderImageThumbs();
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

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Build highlighted HTML by locating each error/OCR-issue span once in the
// plain text and rendering the whole string in a single left-to-right pass,
// so nested/overlapping matches never corrupt already-inserted markup.
function buildHighlightedEssay(rawText, errors, ocrIssues) {
  const spans = [];

  (errors || []).forEach((err) => {
    const idx = rawText.indexOf(err.original);
    if (idx === -1 || !err.original) return;
    spans.push({
      start: idx,
      end: idx + err.original.length,
      type: "error",
      meta: CATEGORY_META[err.category] || CATEGORY_META.Other,
      tooltip: `[${err.category}] → ${err.correction}\n${err.explanation}`,
    });
  });

  (ocrIssues || []).forEach((issue) => {
    const idx = rawText.indexOf(issue.ocr_text);
    if (idx === -1 || !issue.ocr_text) return;
    spans.push({
      start: idx,
      end: idx + issue.ocr_text.length,
      type: "ocr",
      meta: OCR_META,
      tooltip: `[OCR 불확실] ${issue.likely_intended ? `추정: ${issue.likely_intended}\n` : ""}${issue.note}`,
    });
  });

  spans.sort((a, b) => a.start - b.start || b.end - a.end);

  const resolved = [];
  let lastEnd = 0;
  for (const span of spans) {
    if (span.start < lastEnd) continue; // skip overlaps, first match wins
    resolved.push(span);
    lastEnd = span.end;
  }

  let html = "";
  let cursor = 0;
  for (const span of resolved) {
    html += escapeHtml(rawText.slice(cursor, span.start));
    const text = escapeHtml(rawText.slice(span.start, span.end));
    html += `<mark class="correction ${span.meta.cls}" title="${escapeHtml(span.tooltip)}">${text}</mark>`;
    cursor = span.end;
  }
  html += escapeHtml(rawText.slice(cursor));

  return html;
}

function renderLegend(errors, ocrIssues) {
  const usedCategories = new Set((errors || []).map((e) => e.category));
  const legend = document.getElementById("legend");
  legend.innerHTML = "";

  usedCategories.forEach((cat) => {
    const meta = CATEGORY_META[cat] || CATEGORY_META.Other;
    const item = document.createElement("span");
    item.className = "legend-item";
    item.innerHTML = `<span class="legend-dot" style="background:var(--${meta.cls.replace("cat-", "c-")})"></span>${escapeHtml(meta.label)}`;
    legend.appendChild(item);
  });

  if ((ocrIssues || []).length > 0) {
    const item = document.createElement("span");
    item.className = "legend-item";
    item.innerHTML = `<span class="legend-dot" style="background:var(--c-ocr)"></span>${OCR_META.label}`;
    legend.appendChild(item);
  }
}

function renderScoreTable(scores) {
  const rows = [
    ["Grammar", "문법", scores.grammar],
    ["Vocabulary", "어휘", scores.vocabulary],
    ["Content", "내용", scores.content],
    ["Organization", "구성", scores.organization],
    ["Mechanics", "표기/문장부호", scores.mechanics],
  ];

  const tbody = document.getElementById("scoreTableBody");
  tbody.innerHTML = "";
  rows.forEach(([, label, cat]) => {
    if (!cat) return;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(label)}</td>
      <td>${cat.score}</td>
      <td>${cat.max}</td>
      <td>${escapeHtml(cat.comment)}</td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById("totalScore").textContent = `${Math.round(scores.total)} / 100`;
}

function renderList(elId, items) {
  const el = document.getElementById(elId);
  el.innerHTML = "";
  (items || []).forEach((text) => {
    const li = document.createElement("li");
    li.textContent = text;
    el.appendChild(li);
  });
}

function renderErrorList(errors) {
  const container = document.getElementById("correctionsList");
  container.innerHTML = "";
  document.getElementById("errorCount").textContent = (errors || []).length;

  (errors || []).forEach((err) => {
    const meta = CATEGORY_META[err.category] || CATEGORY_META.Other;
    const severityCls = `severity-${(err.severity || "minor").toLowerCase()}`;
    const item = document.createElement("div");
    item.className = "correction-item";
    item.innerHTML = `
      <span class="badge ${meta.cls}">${escapeHtml(meta.label)}</span>
      <span class="badge ${severityCls}">${escapeHtml(SEVERITY_LABEL[err.severity] || err.severity)}</span>
      <div class="diff">
        <span class="orig">${escapeHtml(err.original)}</span>
        <span class="arrow">→</span>
        <span class="fix">${escapeHtml(err.correction)}</span>
      </div>
      <p class="explanation">${escapeHtml(err.explanation)}</p>
    `;
    container.appendChild(item);
  });
}

function renderOcrIssues(ocrIssues) {
  const card = document.getElementById("ocrCard");
  const container = document.getElementById("ocrIssuesList");
  container.innerHTML = "";

  if (!ocrIssues || ocrIssues.length === 0) {
    card.hidden = true;
    return;
  }
  card.hidden = false;

  ocrIssues.forEach((issue) => {
    const item = document.createElement("div");
    item.className = "correction-item";
    item.innerHTML = `
      <span class="badge cat-ocr">${OCR_META.label}</span>
      <div class="diff">
        <span class="orig">${escapeHtml(issue.ocr_text)}</span>
        ${issue.likely_intended ? `<span class="arrow">→</span><span class="fix">${escapeHtml(issue.likely_intended)}</span>` : ""}
      </div>
      <p class="explanation">${escapeHtml(issue.note)}</p>
    `;
    container.appendChild(item);
  });
}

// Renders the corrected_essay markdown (only **bold** is used by the model)
// as HTML without a full markdown parser dependency.
function renderCorrectedEssay(markdownText) {
  const escaped = escapeHtml(markdownText);
  const withBold = escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  document.getElementById("correctedEssay").innerHTML = withBold;
}

function renderResult(data) {
  document.getElementById("scoreValue").textContent = Math.round(data.scores.total);
  document.getElementById("wordCount").textContent = data.essay_info.word_count;
  document.getElementById("sentenceCount").textContent = data.essay_info.sentence_count;
  document.getElementById("avgSentenceLength").textContent = data.essay_info.avg_sentence_length;

  renderScoreTable(data.scores);
  renderLegend(data.errors, data.ocr_issues);
  document.getElementById("highlightedEssay").innerHTML = buildHighlightedEssay(
    data.transcribed_text,
    data.errors,
    data.ocr_issues
  );
  renderOcrIssues(data.ocr_issues);
  renderErrorList(data.errors);
  renderList("strengthsList", data.feedback.strengths);
  renderList("improvementsList", data.feedback.areas_to_improve);
  renderList("teachingPointsList", data.feedback.teaching_points);
  document.getElementById("overallFeedback").textContent = data.feedback.overall;
  renderCorrectedEssay(data.corrected_essay);

  resultPanel.hidden = false;
}

async function handleCheck() {
  hideError();

  let body;
  if (currentMode === "image") {
    if (selectedImages.length === 0) {
      showError("첨삭할 에세이 이미지를 업로드해주세요.");
      return;
    }
    body = {
      mode: "image",
      images: selectedImages.map((img) => ({ data: img.base64, mediaType: img.mediaType })),
      level: levelSelect.value,
    };
  } else {
    const essay = essayInput.value.trim();
    if (!essay) {
      showError("첨삭할 에세이 내용을 입력해주세요.");
      return;
    }
    if (essay.length > MAX_TEXT_LENGTH) {
      showError(`에세이가 너무 깁니다. ${MAX_TEXT_LENGTH}자 이내로 입력해주세요.`);
      return;
    }
    body = { mode: "text", essay, level: levelSelect.value };
  }

  checkBtn.disabled = true;
  resultPanel.hidden = true;
  loading.hidden = false;

  try {
    const res = await fetch("/api/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      showError(data.error || "첨삭 중 오류가 발생했습니다.");
      return;
    }

    renderResult(data);
  } catch {
    showError("서버와 통신 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
  } finally {
    checkBtn.disabled = false;
    loading.hidden = true;
  }
}

checkBtn.addEventListener("click", handleCheck);

renderImageThumbs();
