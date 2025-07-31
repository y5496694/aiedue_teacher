import express, { Request, Response } from "express";
import multer from "multer";
import cors, { CorsOptions } from "cors";
import "dotenv/config";
import { admin, db } from "./firebase";
import { makePrompt, requestGemini } from "./ai";
import { upsertDocument, querySimilarDocuments } from "./embedding";
import fetch from "node-fetch";

const app = express();

// CORS 도메인 리스트
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "https://your-frontend-domain.com", // 실제 배포 도메인으로 변경
];

// CORS 옵션에 명확한 타입 지정 및 암시적 any 제거
const corsOptions: CorsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("CORS 정책 위반: 접근이 차단되었습니다."));
    }
  },
};

app.use(cors(corsOptions));
app.use(express.json());

// multer: 메모리 저장소 사용
const upload = multer({ storage: multer.memoryStorage() });

// 타입스크립트에서 multer 파일 인식용 Request 확장
interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

/**
 * AI 운영계획서 생성 API
 */
app.post("/generatePlan", async (req: Request, res: Response) => {
  try {
    const { token, schoolLevel, planType, keywords, includeBudget } = req.body;
    if (!token) {
      return res.status(401).json({ error: "인증 토큰이 없습니다." });
    }

    const decoded = await admin.auth().verifyIdToken(token);
    const uid = decoded.uid;

    // 벡터 DB 내 유사 문서 검색
    const similarTexts = await querySimilarDocuments(`${schoolLevel} ${planType} ${keywords}`, 3);

    // 프롬프트 생성
    const prompt = makePrompt(schoolLevel, planType, keywords, includeBudget, similarTexts);

    // AI 호출
    const aiResult = await requestGemini(prompt);

    // Firestore 저장
    await db.collection("users").doc(uid).collection("plans").add({
      title: planType,
      planType,
      schoolLevel,
      keywords,
      includeBudget,
      createdAt: new Date(),
      rawContent: aiResult,
      referenceCount: similarTexts.length,
    });

    return res.json({ planText: aiResult });
  } catch (err: unknown) {
    // err는 unknown 타입이므로 안전하게 처리
    const message = err instanceof Error ? err.message : String(err);
    return res.status(400).json({ error: message });
  }
});

/**
 * PDF/HWP 텍스트 추출 프록시 API
 */
app.post("/extract-text", upload.single("file"), async (req: MulterRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "파일이 업로드되지 않았습니다." });
    }

    const extractorUrl = process.env.EXTRACTOR_SERVER_URL || "http://localhost:5001/extract-text";

    // FormData 생성 (Node 18 이상은 내장 지원)
    const form = new FormData();
    form.append("file", new Blob([req.file.buffer], { type: req.file.mimetype }), req.file.originalname);

    const response = await fetch(extractorUrl, { method: "POST", body: form });
    if (!response.ok) {
      const err = (await response.json()) as { error?: string };
      return res.status(500).json({ error: `Extractor error: ${err.error || "Unknown error"}` });
    }    

    const json = await response.json();
    return res.json(json);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
});

/**
 * 벡터 DB 인덱싱 API
 */
app.post("/index-document", async (req: Request, res: Response) => {
  try {
    const { id, text } = req.body;
    if (!id || !text) {
      return res.status(400).json({ error: "id와 text는 필수입니다." });
    }

    await upsertDocument(id, text);
    return res.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
