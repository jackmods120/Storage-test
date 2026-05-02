// api/media.js — Telegram File Proxy (native fetch, Node 24)

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id, redirect } = req.query;
  if (!id) return res.status(400).json({ error: 'file_id required' });

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

  try {
    const infoRes  = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${id}`);
    const infoData = await infoRes.json();

    if (!infoData.ok) return res.status(404).json({ error: 'File not found' });

    const filePath = infoData.result.file_path;
    const fileUrl  = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;

    if (redirect === '1') {
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.redirect(302, fileUrl);
    }

    const fileRes = await fetch(fileUrl);
    if (!fileRes.ok) return res.status(502).json({ error: 'Fetch failed' });

    const contentType = fileRes.headers.get('content-type') || 'application/octet-stream';
    const arrayBuffer = await fileRes.arrayBuffer();

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Content-Length', arrayBuffer.byteLength);
    return res.send(Buffer.from(arrayBuffer));

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
