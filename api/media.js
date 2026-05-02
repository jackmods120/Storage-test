// ═══════════════════════════════════════════════════════════
//  JACK POSTS — api/media.js
//  فایلەکانی Telegram بۆ بەرنامەکە دەگەیەنێت
//  بۆتۆکن تایبەت دەمێنێتەوە، بەرنامەکە ئیمنەی
//
//  بەکارهێنان:
//    GET /api/media?id=FILE_ID          → فایلی ڕاستەوخۆ
//    GET /api/media?id=FILE_ID&redirect=1 → ڕیدایرێکت (بۆ ڤیدیۆ)
// ═══════════════════════════════════════════════════════════

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id, redirect } = req.query;
  if (!id) return res.status(400).json({ error: 'file_id required' });

  try {
    // ── ١. file_path وەرگرتن لە Telegram ───────────────────
    const infoRes  = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${id}`);
    const infoData = await infoRes.json();

    if (!infoData.ok) {
      return res.status(404).json({ error: 'File not found' });
    }

    const filePath = infoData.result.file_path;
    const fileUrl  = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;

    // ── ٢ـأ. بۆ ڤیدیۆ: ڕیدایرێکت (سریعتر) ─────────────────
    if (redirect === '1') {
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.redirect(302, fileUrl);
    }

    // ── ٢ـب. بۆ وێنە: proxy کردن (بۆتۆکن نامێنێتەوە) ────────
    const fileRes  = await fetch(fileUrl);
    if (!fileRes.ok) return res.status(502).json({ error: 'Fetch failed' });

    const contentType = fileRes.headers.get('content-type') || 'application/octet-stream';
    const arrayBuffer = await fileRes.arrayBuffer();

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // کاچ ٢٤ کاتژمێر
    res.setHeader('Content-Length', arrayBuffer.byteLength);
    return res.send(Buffer.from(arrayBuffer));

  } catch (err) {
    console.error('Media proxy error:', err);
    return res.status(500).json({ error: err.message });
  }
}
