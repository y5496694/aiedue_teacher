// src/ai.ts
import fetch from "node-fetch";

// Gemini API 응답 타입 정의 (필요한 부분만 타입 선언)
interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

export async function requestGemini(prompt: string): Promise<string> {
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );

  if (!resp.ok) {
    throw new Error(`Gemini API error: ${resp.statusText}`);
  }

  // resp.json()은 unknown이므로 타입 단언 또는 변수에 타입 부여
  const result: GeminiResponse = (await resp.json()) as GeminiResponse;

  const text = result.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  if (!text) {
    throw new Error("AI 응답이 없습니다.");
  }

  return text;
}
