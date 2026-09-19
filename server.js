import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const MODEL = "claude-opus-5";
const MAX_ESSAY_LENGTH = 8000;

const CorrectionSchema = z.object({
  category: z.enum(["문법", "어휘", "문장 구조", "내용/논리", "문체"]),
  original: z.string().describe("에세이 원문에서 그대로 발췌한 문제 구간(정확히 일치해야 함)"),
  suggestion: z.string().describe("수정 제안 문구"),
  explanation: z.string().describe("한국어로 작성된, 왜 수정이 필요한지에 대한 간결한 설명"),
});

const EssayReviewSchema = z.object({
  corrected_essay: z.string().describe("문법과 표현이 교정된 영어 에세이 전문"),
  overall_score: z.number().min(0).max(100).describe("100점 만점 기준 종합 점수"),
  summary: z.string().describe("한국어로 작성된 전반적인 총평 (2~4문장)"),
  strengths: z.array(z.string()).describe("에세이의 잘된 점 (한국어)"),
  improvements: z.array(z.string()).describe("보완이 필요한 점 (한국어)"),
  corrections: z.array(CorrectionSchema).describe("구체적인 첨삭 사항 목록"),
});

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY가 설정되지 않았습니다. .env 파일을 확인해주세요.");
  }
  return new Anthropic();
}

app.post("/api/check", async (req, res) => {
  const { essay, level } = req.body ?? {};

  if (typeof essay !== "string" || essay.trim().length === 0) {
    return res.status(400).json({ error: "첨삭할 에세이 내용을 입력해주세요." });
  }
  if (essay.length > MAX_ESSAY_LENGTH) {
    return res.status(400).json({
      error: `에세이가 너무 깁니다. ${MAX_ESSAY_LENGTH}자 이내로 입력해주세요. (현재 ${essay.length}자)`,
    });
  }

  const levelText =
    typeof level === "string" && level.trim().length > 0 ? level.trim() : "일반 학습자";

  try {
    const client = getClient();

    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      system:
        "당신은 숙련된 영어 작문 교사입니다. 학습자가 제출한 영어 에세이를 첨삭합니다. " +
        "문법, 어휘 선택, 문장 구조, 논리적 흐름을 검토하고 개선된 버전을 제시하세요. " +
        "corrections 배열의 각 'original' 필드는 에세이 원문에서 공백과 철자까지 정확히 일치하는 부분 문자열이어야 합니다(하이라이트 표시에 사용됨). " +
        "설명과 총평은 한국어로 작성하되, 에세이 본문과 교정문(corrected_essay)은 영어를 유지하세요.",
      messages: [
        {
          role: "user",
          content:
            `학습자 수준: ${levelText}\n\n다음 영어 에세이를 첨삭해주세요:\n\n"""\n${essay}\n"""`,
        },
      ],
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
