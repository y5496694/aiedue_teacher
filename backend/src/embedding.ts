// src/embedding.ts
import fetch from "node-fetch";

const PINECONE_API_KEY = process.env.PINECONE_API_KEY!;
const PINECONE_ENV = process.env.PINECONE_ENV!;
const PINECONE_INDEX = process.env.PINECONE_INDEX!;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

interface OpenAIEmbeddingResponse {
  data: Array<{
    embedding: number[];
  }>;
}

interface PineconeQueryMatch {
  metadata: {
    text: string;
  };
}

interface PineconeQueryResponse {
  matches?: PineconeQueryMatch[];
}

export async function createEmbedding(text: string): Promise<number[]> {
  const resp = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      input: text,
      model: "text-embedding-3-large",
    }),
  });
  if (!resp.ok) throw new Error(`Embedding API Error: ${resp.statusText}`);
  const data = (await resp.json()) as OpenAIEmbeddingResponse;
  return data.data[0].embedding;
}

export async function upsertDocument(id: string, text: string) {
  const embedding = await createEmbedding(text);

  const upsertRes = await fetch(
    `https://${PINECONE_INDEX}-${PINECONE_ENV}.svc.pinecone.io/vectors/upsert`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": PINECONE_API_KEY,
      },
      body: JSON.stringify({
        vectors: [{ id, values: embedding }],
        namespace: "plans",
      }),
    }
  );
  if (!upsertRes.ok) throw new Error("Vector upsert failed");
}

export async function querySimilarDocuments(queryText: string, topK = 3): Promise<string[]> {
  const queryEmbedding = await createEmbedding(queryText);

  const queryRes = await fetch(
    `https://${PINECONE_INDEX}-${PINECONE_ENV}.svc.pinecone.io/query`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": PINECONE_API_KEY,
      },
      body: JSON.stringify({
        vector: queryEmbedding,
        topK,
        includeMetadata: true,
        namespace: "plans",
      }),
    }
  );
  if (!queryRes.ok) throw new Error("Vector query failed");

  const data = (await queryRes.json()) as PineconeQueryResponse;
  return data.matches?.map((m) => m.metadata.text) || [];
}
