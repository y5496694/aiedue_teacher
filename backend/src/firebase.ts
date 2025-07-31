// src/firebase.ts
import admin from "firebase-admin";
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON!);

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

// 예시: 플랜 타입+학교급 조건별 과거 운영계획 사례 k개 Retrieve하기(RAG)
export async function searchReferencePlans(schoolLevel: string, planType: string, limit = 3): Promise<string[]> {
  const docs = await db
    .collectionGroup("plans")
    .where("schoolLevel", "==", schoolLevel)
    .where("planType", "==", planType)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  return docs.docs.map(doc => (doc.data().rawContent as string || "")).filter(Boolean);
}

export { admin, db };


