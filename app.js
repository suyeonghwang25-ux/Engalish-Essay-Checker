// Engalish Essay Checker - client-only app that calls the Gemini API directly
// from the browser. No server, no build step: open index.html and go.

const LS_API_KEY = "engalish_gemini_api_key";
const LS_MODEL = "engalish_gemini_model";
const LS_CUSTOM_MODEL = "engalish_gemini_custom_model";

const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB per image
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

// ---------- Elements ----------

const apiKeyInput = document.getElementById("apiKeyInput");
const toggleKeyBtn = document.getElementById("toggleKeyBtn");
const clearKeyBtn = document.getElementById("clearKeyBtn");
const keyStatus = document.getElementById("keyStatus");
const modelSelect = document.getElementById("modelSelect");
const customModelInput = document.getElementById("customModelInput");

const levelSelect = document.getElementById("level");
const checkBtn = document.getElementById("checkBtn");
const clearBtn = document.getElementById("clearBtn");
const errorMsg = document.getElementById("errorMsg");
const loading = document.getElementById("loading");
const resultPanel = document.getElementById("resultPanel");

const dropzone = document.getElementById("dropzone");
const dropzoneText = document.getElementById("dropzoneText");
const imageFileInput = document.getElementById("imageFile");
const imageThumbs = document.getElementById("imageThumbs");

let selectedImages = []; // [{ base64, mediaType }]

const CATEGORY_META = {
  Grammar: { cls: "cat-grammar", label: "🔴 Grammar" },
  Spelling: { cls: "cat-spelling", label: "🔵 Spelling" },
  "Vocabulary/Word Choice": { cls: "cat-vocabulary", label: "🟢 Vocabulary/Word Choice" },
  Punctuation: { cls: "cat-punctuation", label: "🟠 Punctuation" },
  "Sentence Structure/Naturalness": { cls: "cat-structure", label: "🟣 Sentence Structure" },
  "Organization/Coherence": { cls: "cat-organization", label: "🟡 Organization/Coherence" },
  Other: { cls: "cat-other", label: "⚪ Other" },
};
const OCR_META = { cls: "cat-ocr", label: "🟤 OCR Uncertain" };
const SEVERITY_LABEL = { Minor: "Minor", Moderate: "Moderate", Major: "Major" };

// ---------- API key / model persistence ----------

function loadSettings() {
  const savedKey = localStorage.getItem(LS_API_KEY) || "";
  apiKeyInput.value = savedKey;
  updateKeyStatus();

  const savedModel = localStorage.getItem(LS_MODEL);
  const savedCustomModel = localStorage.getItem(LS_CUSTOM_MODEL) || "";
  customModelInput.value = savedCustomModel;

  if (savedModel) {
    const optionExists = Array.from(modelSelect.options).some((o) => o.value === savedModel);
    if (optionExists) {
      modelSelect.value = savedModel;
    } else {
      modelSelect.value = "custom";
      customModelInput.value = savedModel;
    }
  }
  customModelInput.hidden = modelSelect.value !== "custom";
}

function updateKeyStatus() {
  const key = apiKeyInput.value.trim();
  if (!key) {
    keyStatus.textContent = "API 키가 입력되지 않았습니다.";
    keyStatus.className = "key-status warn";
  } else {
    keyStatus.textContent = "✓ API 키가 이 브라우저에 저장되어 있습니다.";
    keyStatus.className = "key-status ok";
  }
}

apiKeyInput.addEventListener("input", () => {
  localStorage.setItem(LS_API_KEY, apiKeyInput.value.trim());
  updateKeyStatus();
});

toggleKeyBtn.addEventListener("click", () => {
  apiKeyInput.type = apiKeyInput.type === "password" ? "text" : "password";
});

clearKeyBtn.addEventListener("click", () => {
  apiKeyInput.value = "";
  localStorage.removeItem(LS_API_KEY);
  updateKeyStatus();
});

modelSelect.addEventListener("change", () => {
  customModelInput.hidden = modelSelect.value !== "custom";
  if (modelSelect.value !== "custom") {
    localStorage.setItem(LS_MODEL, modelSelect.value);
  }
});

customModelInput.addEventListener("input", () => {
  localStorage.setItem(LS_MODEL, "custom");
  localStorage.setItem(LS_CUSTOM_MODEL, customModelInput.value.trim());
});

function getResolvedModel() {
  if (modelSelect.value === "custom") {
    return customModelInput.value.trim();
  }
  return modelSelect.value;
}

// ---------- Image upload ----------

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
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
  selectedImages.splice(Number(btn.dataset.index), 1);
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
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
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
dropzone.addEventListener("drop", (e) => handleImageFiles(e.dataTransfer.files));
dropzone.addEventListener("click", (e) => {
  if (selectedImages.length >= MAX_IMAGES) {
    e.preventDefault();
    showError(`이미지는 최대 ${MAX_IMAGES}장까지 업로드할 수 있습니다.`);
  }
});

// ---------- Shared UI helpers ----------

clearBtn.addEventListener("click", () => {
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

// ---------- Highlighting ----------
// Finds the (occurrenceIndex)-th occurrence of `needle` in `text` (0-based).
function findOccurrence(text, needle, occurrenceIndex) {
  let idx = -1;
  for (let i = 0; i <= occurrenceIndex; i++) {
    idx = text.indexOf(needle, idx + 1);
    if (idx === -1) return -1;
  }
  return idx;
}

// Builds highlighted HTML in a single left-to-right pass. Tracks how many
// times each exact needle string has already been claimed so repeated
// substrings (e.g. multiple identical "[OCR uncertain]" placeholders, or the
// same typo appearing twice) each get their own, distinct highlight instead
// of all pointing at the first match.
function buildHighlightedEssay(rawText, errors, ocrIssues) {
  const occurrenceCounters = new Map();

  function nextIndexFor(needle) {
    const used = occurrenceCounters.get(needle) || 0;
    const idx = findOccurrence(rawText, needle, used);
    if (idx !== -1) occurrenceCounters.set(needle, used + 1);
    return idx;
  }

  const spans = [];

  (errors || []).forEach((err) => {
    if (!err.original) return;
    const idx = nextIndexFor(err.original);
    if (idx === -1) return;
    spans.push({
      start: idx,
      end: idx + err.original.length,
      meta: CATEGORY_META[err.category] || CATEGORY_META.Other,
      tooltip: `[${err.category}] → ${err.correction}\n${err.explanation}`,
    });
  });

  (ocrIssues || []).forEach((issue) => {
    if (!issue.ocr_text) return;
    const idx = nextIndexFor(issue.ocr_text);
    if (idx === -1) return;
    spans.push({
      start: idx,
      end: idx + issue.ocr_text.length,
      meta: OCR_META,
      tooltip: `[OCR uncertain]${issue.likely_intended ? ` 추정: ${issue.likely_intended}` : ""}\n${issue.note}`,
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

// ---------- Gemini response schema ----------

const SCORE_CATEGORY_SCHEMA = {
  type: "OBJECT",
  properties: {
    score: { type: "NUMBER" },
    max: { type: "NUMBER" },
    comment: { type: "STRING" },
  },
  required: ["score", "max", "comment"],
};

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    transcribed_text: { type: "STRING" },
    essay_info: {
      type: "OBJECT",
      properties: {
        word_count: { type: "INTEGER" },
        sentence_count: { type: "INTEGER" },
        avg_sentence_length: { type: "NUMBER" },
      },
      required: ["word_count", "sentence_count", "avg_sentence_length"],
    },
    ocr_issues: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          ocr_text: { type: "STRING" },
          likely_intended: { type: "STRING", nullable: true },
          note: { type: "STRING" },
        },
        required: ["ocr_text", "note"],
      },
    },
    errors: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          original: { type: "STRING" },
          correction: { type: "STRING" },
          category: {
            type: "STRING",
            enum: [
              "Grammar",
              "Spelling",
              "Vocabulary/Word Choice",
              "Punctuation",
              "Sentence Structure/Naturalness",
              "Organization/Coherence",
              "Other",
            ],
          },
          explanation: { type: "STRING" },
          severity: { type: "STRING", enum: ["Minor", "Moderate", "Major"] },
        },
        required: ["original", "correction", "category", "explanation", "severity"],
      },
    },
    scores: {
      type: "OBJECT",
      properties: {
        grammar: SCORE_CATEGORY_SCHEMA,
        vocabulary: SCORE_CATEGORY_SCHEMA,
        content: SCORE_CATEGORY_SCHEMA,
        organization: SCORE_CATEGORY_SCHEMA,
        mechanics: SCORE_CATEGORY_SCHEMA,
        total: { type: "NUMBER" },
      },
      required: ["grammar", "vocabulary", "content", "organization", "mechanics", "total"],
    },
    feedback: {
      type: "OBJECT",
      properties: {
        strengths: { type: "ARRAY", items: { type: "STRING" } },
        areas_to_improve: { type: "ARRAY", items: { type: "STRING" } },
        teaching_points: { type: "ARRAY", items: { type: "STRING" } },
        overall: { type: "STRING" },
      },
      required: ["strengths", "areas_to_improve", "teaching_points", "overall"],
    },
    corrected_essay: { type: "STRING" },
  },
  required: [
    "transcribed_text",
    "essay_info",
    "ocr_issues",
    "errors",
    "scores",
    "feedback",
    "corrected_essay",
  ],
};

const SYSTEM_PROMPT = `You are an English essay correction and assessment assistant designed specifically for English teachers.

You will be given one or more photos of a student's handwritten English essay (sequential pages, in order) and must transcribe and analyze it. Respond with ONLY a JSON object matching the required schema - no extra commentary.

## 1. OCR Transcription Rules
- Transcribe the handwriting as accurately as possible into "transcribed_text". If multiple images are given, they are sequential pages of the same essay - join them into one continuous "transcribed_text".
- NEVER invent or guess text you cannot confidently read. If a word or phrase is illegible, smudged, cut off, or otherwise uncertain, write the exact literal placeholder "[OCR uncertain]" at that position instead of guessing.
- For every "[OCR uncertain]" placeholder you insert, add one corresponding entry to "ocr_issues": ocr_text must be exactly "[OCR uncertain]", likely_intended is your best guess if you have reasonable confidence (otherwise null), and note briefly explains why (e.g. "handwriting is smudged", "word is cut off at the page edge").

## 2. Error Identification
Identify every meaningful writing error. Do not flag stylistic preferences as definite errors, and do not mark a sentence wrong simply because another phrasing sounds more sophisticated. Preserve the student's original voice and meaning; do not invent errors.
Each error gets exactly one category: Grammar, Spelling, Vocabulary/Word Choice, Punctuation, Sentence Structure/Naturalness, Organization/Coherence, or Other.
For each error give: the exact original substring (verbatim from transcribed_text), the corrected substring, category, a brief explanation useful to a teacher, and severity (Minor/Moderate/Major).
Every "original" in errors, and every "ocr_text" in ocr_issues, must be an exact, verbatim substring of "transcribed_text" (matching whitespace/punctuation) - this is used to highlight the text programmatically. Never double-count the same span as both an error and an OCR issue.

## 3. Word Count
Count total words, sentences, and average words per sentence (word_count / sentence_count, one decimal place). Do not count punctuation as separate words.

## 4. Essay Score (out of 100)
- Grammar: 25 points
- Vocabulary / Word Choice: 20 points
- Content / Development: 20 points
- Organization / Coherence: 20 points
- Spelling / Punctuation / Mechanics: 15 points
Give a score, max, and brief justification for each category. Do not inflate the score simply because the essay is understandable - evaluate rigorously against the given student level.

## 5. Teacher's Final Feedback
- strengths: 2-3 specific strengths.
- areas_to_improve: the 2-4 most important areas.
- teaching_points: practical points for the next lesson.
- overall: a short paragraph summarizing current ability, major weaknesses, and next steps. Avoid overly advanced terminology unless necessary.

## 6. Corrected Essay
Provide "corrected_essay": the essay with only necessary corrections applied, wrapping changed words/phrases in **bold** Markdown. Do not rewrite sentences that were already acceptable, and preserve the student's own words wherever they are correct.

## General rules
- Distinguish between an actual error and an optional stylistic improvement; never flag acceptable phrasing merely because it isn't your preferred wording.
- If the student's intended meaning is genuinely unclear, say so in the relevant explanation rather than guessing.`;

// ---------- Gemini API call ----------

async function callGemini({ apiKey, model, instructionText, images }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const parts = [{ text: instructionText }];
  images.forEach((img) => {
    parts.push({ inlineData: { mimeType: img.mediaType, data: img.base64 } });
  });

  const requestBody = {
    contents: [{ role: "user", parts }],
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.2,
    },
  };

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
  } catch {
    throw new Error(
      "Gemini API에 연결할 수 없습니다. 인터넷 연결을 확인하거나, 브라우저가 로컬 파일에서의 외부 요청을 차단하고 있는지 확인해주세요."
    );
  }

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Gemini 응답을 읽을 수 없습니다 (HTTP ${res.status}).`);
  }

  if (!res.ok) {
    const message = data?.error?.message || `요청이 실패했습니다 (HTTP ${res.status}).`;
    throw new Error(message);
  }

  const blockReason = data?.promptFeedback?.blockReason;
  if (blockReason) {
    throw new Error(`Gemini가 콘텐츠를 안전 문제로 차단했습니다 (${blockReason}).`);
  }

  const candidate = data?.candidates?.[0];
  if (!candidate) {
    throw new Error("Gemini로부터 응답을 받지 못했습니다.");
  }
  if (candidate.finishReason && candidate.finishReason !== "STOP") {
    throw new Error(
      `응답이 끝까지 완료되지 않았습니다 (${candidate.finishReason}). 이미지 수를 줄이거나 다시 시도해주세요.`
    );
  }

  const text = (candidate.content?.parts || []).map((p) => p.text || "").join("");
  if (!text) {
    throw new Error("Gemini 응답에서 텍스트를 찾을 수 없습니다.");
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Gemini 응답을 JSON으로 해석하는 데 실패했습니다. 다시 시도해주세요.");
  }

  return parsed;
}

// ---------- Rendering ----------

function renderLegend(errors, ocrIssues) {
  const usedCategories = new Set((errors || []).map((e) => e.category));
  const legend = document.getElementById("legend");
  legend.innerHTML = "";

  usedCategories.forEach((cat) => {
    const meta = CATEGORY_META[cat] || CATEGORY_META.Other;
    const item = document.createElement("span");
    item.className = "legend-item";
    item.innerHTML = `<span class="legend-dot" style="background:var(--${meta.cls.replace(
      "cat-",
      "c-"
    )})"></span>${escapeHtml(meta.label)}`;
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
    ["문법", scores.grammar],
    ["어휘", scores.vocabulary],
    ["내용", scores.content],
    ["구성", scores.organization],
    ["표기/문장부호", scores.mechanics],
  ];

  const tbody = document.getElementById("scoreTableBody");
  tbody.innerHTML = "";
  rows.forEach(([label, cat]) => {
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

function renderCorrectedEssay(markdownText) {
  const escaped = escapeHtml(markdownText);
  const withBold = escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  document.getElementById("correctedEssay").innerHTML = withBold;
}

function assertValidResult(data) {
  const requiredKeys = [
    "transcribed_text",
    "essay_info",
    "ocr_issues",
    "errors",
    "scores",
    "feedback",
    "corrected_essay",
  ];
  const missing = requiredKeys.filter((k) => !(k in data));
  if (missing.length > 0) {
    throw new Error(`AI 응답 형식이 올바르지 않습니다 (누락된 필드: ${missing.join(", ")}).`);
  }
}

function renderResult(data) {
  assertValidResult(data);

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

// ---------- Submit ----------

async function handleCheck() {
  hideError();

  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    showError("Gemini API 키를 먼저 입력해주세요.");
    return;
  }

  const model = getResolvedModel();
  if (!model) {
    showError("사용할 모델을 선택하거나 입력해주세요.");
    return;
  }

  if (selectedImages.length === 0) {
    showError("첨삭할 손글씨 에세이 이미지를 1장 이상 업로드해주세요.");
    return;
  }

  const levelText = levelSelect.value;
  const instructionText =
    `Student level: ${levelText}\n\n` +
    (selectedImages.length > 1
      ? `The ${selectedImages.length} images are sequential pages of a student's handwritten English essay, in order. `
      : "The image contains a student's handwritten English essay. ") +
    "Transcribe it and analyze it following your instructions.";

  checkBtn.disabled = true;
  resultPanel.hidden = true;
  loading.hidden = false;

  try {
    const data = await callGemini({ apiKey, model, instructionText, images: selectedImages });
    renderResult(data);
  } catch (err) {
    showError(err.message || "첨삭 중 오류가 발생했습니다.");
  } finally {
    checkBtn.disabled = false;
    loading.hidden = true;
  }
}

checkBtn.addEventListener("click", handleCheck);

// ---------- Init ----------

loadSettings();
renderImageThumbs();
