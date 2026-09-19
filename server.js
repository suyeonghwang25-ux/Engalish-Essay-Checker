import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json({ limit: "30mb" }));
app.use(express.static(path.join(__dirname, "public")));

const MODEL = "claude-opus-5";
const MAX_ESSAY_LENGTH = 8000;
const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB per image
const MAX_TOTAL_IMAGE_BYTES = 20 * 1024 * 1024; // 20MB combined
const ALLOWED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

const ERROR_CATEGORIES = [
  "Grammar",
  "Spelling",
  "Vocabulary/Word Choice",
  "Punctuation",
  "Sentence Structure/Naturalness",
  "Organization/Coherence",
  "Other",
];

const ErrorItemSchema = z.object({
  original: z.string().describe("Exact substring from the transcribed essay text that contains the error"),
  correction: z.string().describe("The corrected version of that substring"),
  category: z.enum(ERROR_CATEGORIES),
  explanation: z.string().describe("Brief explanation useful to an English teacher"),
  severity: z.enum(["Minor", "Moderate", "Major"]),
});

const OcrIssueSchema = z.object({
  ocr_text: z
    .string()
    .describe("Exact substring from the transcribed text that is uncertain due to OCR/handwriting legibility"),
  likely_intended: z
    .string()
    .nullable()
    .describe("Best guess of the intended word/phrase if reasonably certain from context, otherwise null"),
  note: z.string().describe("Why this is flagged as an OCR/legibility uncertainty rather than a student error"),
});

const ScoreCategorySchema = z.object({
  score: z.number().describe("Points awarded in this category"),
  max: z.number().describe("Maximum possible points in this category"),
  comment: z.string().describe("Brief justification for the score"),
});

const EssayReviewSchema = z.object({
  transcribed_text: z
    .string()
    .describe(
      "The full essay text exactly as transcribed (verbatim, uncorrected). If the input was already typed text, this equals that text."
    ),
  essay_info: z.object({
    word_count: z.number(),
    sentence_count: z.number(),
    avg_sentence_length: z.number().describe("word_count divided by sentence_count, rounded to 1 decimal"),
  }),
  ocr_issues: z
    .array(OcrIssueSchema)
    .describe("Words/phrases that are uncertain due to OCR or handwriting legibility, not writing errors. Empty array if the input was typed text or nothing is uncertain."),
  errors: z.array(ErrorItemSchema).describe("Every meaningful writing error found in the transcribed text"),
  scores: z.object({
    grammar: ScoreCategorySchema,
    vocabulary: ScoreCategorySchema,
    content: ScoreCategorySchema,
    organization: ScoreCategorySchema,
    mechanics: ScoreCategorySchema,
    total: z.number().describe("Sum of the five category scores, out of 100"),
  }),
  feedback: z.object({
    strengths: z.array(z.string()).describe("2-3 specific strengths"),
    areas_to_improve: z.array(z.string()).describe("2-4 most important areas the student should work on"),
    teaching_points: z.array(z.string()).describe("Practical points a teacher can address in the next lesson"),
    overall: z.string().describe("Short paragraph summarizing writing ability, weaknesses, and next steps"),
  }),
  corrected_essay: z
    .string()
    .describe(
      "The essay with only necessary corrections applied, in Markdown, with changed words/phrases wrapped in **bold**. Do not rewrite sentences that were already acceptable."
    ),
});

const SYSTEM_PROMPT = `You are an English essay correction and assessment assistant designed specifically for English teachers.

Your task is to analyze a student's English essay - which may come from a handwritten essay converted via OCR, or from already-typed text - and return a structured assessment.

## 1. OCR Text Verification (only relevant when the input is an image)
- Carefully review the transcribed text.
- Do not automatically "correct" unclear words unless the intended word is reasonably certain from context.
- If a word/phrase is likely an OCR or legibility error, put it in "ocr_issues" - NOT in "errors". Never double-count the same span in both lists.
- Preserve the student's original meaning and writing style.
- If the input was already typed text (no image), "ocr_issues" must be an empty array.
- If multiple images are provided, they are sequential pages of the same handwritten essay, in the order given. Transcribe each page in order and join them into one continuous "transcribed_text" (do not repeat page numbers/headers unless they are part of the essay content itself).

## 2. Error Identification
Identify every meaningful error. Each error gets exactly one category: Grammar, Spelling, Vocabulary/Word Choice, Punctuation, Sentence Structure/Naturalness, Organization/Coherence, or Other.
For each error give: the exact original substring, the corrected substring, category, a brief explanation useful to a teacher, and severity (Minor/Moderate/Major).
Do not flag stylistic preferences as definite errors. Do not mark a sentence wrong simply because another phrasing sounds more sophisticated. Do not invent errors.
Every "original" and every ocr_issues "ocr_text" must be an exact, verbatim substring of "transcribed_text" (matching whitespace and punctuation) - this is used to highlight the text programmatically.

## 3. Word Count
Count total words, sentences, and average words per sentence (word_count / sentence_count). Do not count punctuation as separate words.

## 4. Essay Score (out of 100)
- Grammar: 25 points
- Vocabulary / Word Choice: 20 points
- Content / Development: 20 points
- Organization / Coherence: 20 points
- Spelling / Punctuation / Mechanics: 15 points
Give a score, max, and brief justification for each category. Do not inflate the score simply because the essay is understandable - evaluate rigorously against the apparent grade/level provided.

## 5. Teacher's Final Feedback
- Strengths: 2-3 specific strengths.
- Areas to improve: the 2-4 most important areas.
- Teaching points: practical points for the next lesson.
- Overall: a short paragraph summarizing current ability, major weaknesses, and next steps. Avoid overly advanced terminology unless necessary.

## 6. Corrected Essay
Provide the essay with only necessary corrections applied, wrapping changed words/phrases in **bold** Markdown. Do not rewrite sentences that were already acceptable, and do not unnecessarily rephrase.

## General rules
- If the student's intended meaning is unclear, say so explicitly rather than guessing.
- Distinguish between an actual grammatical error and an optional stylistic improvement; avoid correcting acceptable phrasing merely because it isn't your preferred wording.
- Keep feedback specific, evidence-based, and useful to an English teacher.`;

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY가 설정되지 않았습니다. .env 파일을 확인해주세요.");
  }
  return new Anthropic();
}

function estimateBase64Bytes(base64) {
  const len = base64.length;
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return (len * 3) / 4 - padding;
}

app.post("/api/check", async (req, res) => {
  const { mode, essay, images, level } = req.body ?? {};

  const levelText =
    typeof level === "string" && level.trim().length > 0 ? level.trim() : "General student";

  let userContent;

  if (mode === "image") {
    if (!Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: "업로드된 이미지가 없습니다." });
    }
    if (images.length > MAX_IMAGES) {
      return res.status(400).json({ error: `이미지는 최대 ${MAX_IMAGES}장까지 업로드할 수 있습니다.` });
    }

    let totalBytes = 0;
    for (const img of images) {
      if (!img || typeof img.data !== "string" || img.data.length === 0) {
        return res.status(400).json({ error: "이미지 데이터를 읽을 수 없습니다." });
      }
      if (!ALLOWED_MEDIA_TYPES.includes(img.mediaType)) {
        return res.status(400).json({ error: "지원하지 않는 이미지 형식입니다. (JPEG, PNG, GIF, WEBP만 지원)" });
      }
      const bytes = estimateBase64Bytes(img.data);
      if (bytes > MAX_IMAGE_BYTES) {
        return res.status(400).json({ error: "이미지 용량이 너무 큽니다. 장당 5MB 이하로 업로드해주세요." });
      }
      totalBytes += bytes;
    }
    if (totalBytes > MAX_TOTAL_IMAGE_BYTES) {
      return res.status(400).json({ error: "업로드한 이미지의 총 용량이 너무 큽니다. 20MB 이하로 맞춰주세요." });
    }

    userContent = [
      ...images.map((img) => ({
        type: "image",
        source: { type: "base64", media_type: img.mediaType, data: img.data },
      })),
      {
        type: "text",
        text:
          `Student level: ${levelText}\n\n` +
          (images.length > 1
            ? `The ${images.length} images contain sequential pages of a student's handwritten English essay, in order. `
            : "The image contains a student's handwritten English essay. ") +
          "Transcribe it via OCR into transcribed_text, then analyze it following your instructions. " +
          "Flag any illegible or uncertain words as ocr_issues rather than writing errors.",
      },
    ];
  } else {
    if (typeof essay !== "string" || essay.trim().length === 0) {
      return res.status(400).json({ error: "첨삭할 에세이 내용을 입력해주세요." });
    }
    if (essay.length > MAX_ESSAY_LENGTH) {
      return res.status(400).json({
        error: `에세이가 너무 깁니다. ${MAX_ESSAY_LENGTH}자 이내로 입력해주세요. (현재 ${essay.length}자)`,
      });
    }

    userContent = [
      {
        type: "text",
        text:
          `Student level: ${levelText}\n\n` +
          "This text was already typed (no OCR needed - ocr_issues must be an empty array). " +
          `Please analyze this English essay:\n\n"""\n${essay}\n"""`,
      },
    ];
  }

  try {
    const client = getClient();

    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
      output_format: betaZodOutputFormat(EssayReviewSchema),
    });

    if (response.stop_reason === "refusal") {
      return res.status(422).json({ error: "요청을 처리할 수 없습니다. 다른 내용으로 시도해주세요." });
    }

    if (!response.parsed) {
      return res.status(502).json({ error: "AI 응답을 해석하는 데 실패했습니다. 다시 시도해주세요." });
    }

    return res.json(response.parsed);
  } catch (err) {
    console.error(err);
    if (err instanceof Anthropic.AuthenticationError) {
      return res.status(500).json({ error: "서버의 Anthropic API 키가 유효하지 않습니다." });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: "요청이 많아 잠시 후 다시 시도해주세요." });
    }
    if (err instanceof Anthropic.APIError) {
      return res.status(502).json({ error: `AI 서비스 오류: ${err.message}` });
    }
    return res.status(500).json({ error: err.message || "알 수 없는 오류가 발생했습니다." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`영어 에세이 첨삭기가 http://localhost:${PORT} 에서 실행 중입니다.`);
});
