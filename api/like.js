// ═══════════════════════════════════════════════════════════
//  JACK POSTS — api/like.js
//  لایک و ئەنلایک کردن
// ═══════════════════════════════════════════════════════════

const DB_URL = process.env.FIREBASE_DB_URL || 'https://jack-9a034-default-rtdb.firebaseio.com';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { postId, userId, action } = req.body;
    // action = "like" یان "unlike"

    if (!postId || !userId) {
      return res.status(400).json({ error: 'postId and userId required' });
    }

    // چێک بکە ئایا پێشتر لایک کردووە
    const likeRef = `${DB_URL}/likes/${postId}/${userId}.json`;

    if (action === 'like') {
      // زیادکردنی لایک
      await fetch(likeRef, {
        method: 'PUT',
        body: JSON.stringify(true),
        headers: { 'Content-Type': 'application/json' },
      });

      // ژمارەی لایکەکان وەرگرتن و زیادکردن
      const likesRef  = `${DB_URL}/posts/${postId}/likes.json`;
      const currentRes = await fetch(likesRef);
      const current    = await currentRes.json();
      const newCount   = (current || 0) + 1;
      await fetch(likesRef, {
        method: 'PUT',
        body: JSON.stringify(newCount),
        headers: { 'Content-Type': 'application/json' },
      });
      return res.status(200).json({ success: true, likes: newCount, liked: true });

    } else {
      // سڕینەوەی لایک
      await fetch(likeRef, { method: 'DELETE' });

      const likesRef  = `${DB_URL}/posts/${postId}/likes.json`;
      const currentRes = await fetch(likesRef);
      const current    = await currentRes.json();
      const newCount   = Math.max((current || 1) - 1, 0);
      await fetch(likesRef, {
        method: 'PUT',
        body: JSON.stringify(newCount),
        headers: { 'Content-Type': 'application/json' },
      });
      return res.status(200).json({ success: true, likes: newCount, liked: false });
    }

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
