// src/index.ts
import express from "express";
import cors from "cors";
import "dotenv/config";
import { admin } from "./firebase";
import { requestGemini } from "./ai";

const app = express();
app.use(cors());
app.use(express.json());

// 실전 API 엔드포인트 (생성)
app.post("/generatePlan", async (req, res) => {
  try {
    const { token, schoolLevel, planType, keywords, includeBudget } = req.body;
    // 1. 사용자 인증
    const decoded = await admin.auth().verifyIdToken(token);
    const uid = decoded.uid;

    // 2. (여기서 필요시 과거 운영계획서/참고자료 DB에서 불러와 프롬프트에 삽입 가능)
    let prompt = `당신은 대한민국의 유능한 교사입니다. '${schoolLevel} ${planType}' 운영 계획을 작성해 주세요. 핵심 키워드는 '${keywords}' 입니다.${includeBudget ? " 예산 항목도 표로 포함해 주세요." : ""}`;
    prompt += " 출력형식: TITLE: [제목], ### 목적, ### 운영방침, ### 세부 운영 계획" + (includeBudget ? ', ### 예산(표로 작성)' : "") + ", ### 기대효과 순으로 작성";

    // 3. Gemini 요청
    const aiResult = await requestGemini(prompt);

    // 4. Firestore 저장
    await admin.firestore().collection("users").doc(uid).collection("plans").add({
      title: planType,
      planType,
      createdAt: new Date(),
      rawContent: aiResult,
    });

    res.json({ planText: aiResult });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// 서버 시작
const PORT = 8080;
app.listen(PORT, () => {
  console.log(`AI Server running on http://localhost:${PORT}`);
});

