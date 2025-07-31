// src/ai.ts
import fetch from "node-fetch";

/** 프롬프트 최적화: 참조 예시 운영계획 포함 */
export function makePrompt(schoolLevel: string, planType: string, keywords: string, includeBudget: boolean, referenceTexts: string[]) {
  let base = `당신은 대한민국의 유능한 교사입니다. '${schoolLevel} ${planType}' 운영 계획을 작성해 주세요. 핵심 키워드는 '${keywords}' 입니다.`;
  if (referenceTexts.length) {
    base += `\n\n[아래는 유사한 실제 운영계획 사례입니다. 참고해서 더 현실적이고 완성도 높게 작성하세요]\n\n`;
    referenceTexts.forEach((r, i) => {
      if(r?.trim()?.length > 0) base += `[사례${i+1}]\n${r.trim().slice(0, 1200)}\n`;
    });
  }
  base += `\n출력형식: TITLE: [제목], ### 목적, ### 운영방침, ### 세부 운영 계획${includeBudget ? ', ### 예산(표로 작성)' : ''}, ### 기대효과 (각 항목별로 구분)\n`;
  return base;
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}

export async function requestGemini(prompt: string): Promise<string> {
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [ { parts: [ { text: prompt } ] } ] }),
    }
  );
  if (!resp.ok) throw new Error(`Gemini API error: ${resp.statusText}`);
  const result: GeminiResponse = (await resp.json()) as GeminiResponse;
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text) throw new Error("AI 응답이 없습니다.");
  return text;
}
