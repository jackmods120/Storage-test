// api/upload-multipart.js — Multipart streaming upload (بەبێ Base64، بۆ 300MB+)
// Vercel bodyParser دادەخرێت چونکە ئێمە ستریم دەکەین

export const config = {
  api: {
    bodyParser: false,          // IMPORTANT: ستریم دەکەین، bodyParser پێویست نییە
    responseLimit: false,
    maxDuration: 300,           // 5 خولەک بۆ فایلە گەورەکان
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  try {
    const BOT_TOKEN  = process.env.TELEGRAM_BOT_TOKEN;
    const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;

    if (!BOT_TOKEN || !CHANNEL_ID) {
      return res.status(500).json({ error: 'Bot token or channel not configured' });
    }

    // ── Multipart خوێندنەوە بە دەست ──────────────────────────────────────
    const contentType = req.headers['content-type'] || '';
    const boundaryMatch = contentType.match(/boundary=(.+)$/);
    if (!boundaryMatch) {
      return res.status(400).json({ error: 'No multipart boundary found' });
    }
    const boundary = boundaryMatch[1];

    // هەموو بایتەکان بخوێنەوە بە chunk
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const rawBuffer = Buffer.concat(chunks);

    // ── Parse multipart بە دەست ──────────────────────────────────────────
    const boundaryBuf = Buffer.from('--' + boundary);
    const parts       = splitBuffer(rawBuffer, boundaryBuf);

    let fileBuffer = null;
    let fileName   = 'upload_' + Date.now();
    let mimeType   = 'application/octet-stream';
    let fileType   = 'image';   // image | video | font | apk

    for (const part of parts) {
      // سەرپەڕەکان جیا بکەوە
      const headerEnd = indexOfSeq(part, Buffer.from('\r\n\r\n'));
      if (headerEnd === -1) continue;

      const headerBuf = part.slice(0, headerEnd).toString('utf8');
      const body      = part.slice(headerEnd + 4);
      // \r\n ی کۆتایی لاببە
      const bodyClean = body.slice(0, body.length - 2);

      // ناوی فیلد
      const dispMatch = headerBuf.match(/Content-Disposition:[^\r\n]*name="([^"]+)"/i);
      if (!dispMatch) continue;
      const fieldName = dispMatch[1];

      if (fieldName === 'type') {
        fileType = bodyClean.toString('utf8').trim();
        continue;
      }

      if (fieldName === 'file') {
        // ناوی فایل
        const fnMatch = headerBuf.match(/filename="([^"]+)"/i);
        if (fnMatch) fileName = fnMatch[1];

        // MIME
        const ctMatch = headerBuf.match(/Content-Type:\s*([^\r\n]+)/i);
        if (ctMatch) mimeType = ctMatch[1].trim();

        fileBuffer = bodyClean;
      }
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      return res.status(400).json({ error: 'No file data received' });
    }

    // ── ناردن بۆ Telegram ────────────────────────────────────────────────
    const tgForm = new FormData();
    tgForm.append('chat_id', CHANNEL_ID);
    const blob = new Blob([fileBuffer], { type: mimeType });

    let endpoint;
    if (fileType === 'video') {
      endpoint = 'sendVideo';
      tgForm.append('video', blob, fileName);
      tgForm.append('supports_streaming', 'true');
    } else {
      endpoint = 'sendDocument';
      tgForm.append('document', blob, fileName);
    }

    const tgRes  = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/${endpoint}`,
      { method: 'POST', body: tgForm }
    );
    const tgData = await tgRes.json();

    if (!tgData.ok) {
      return res.status(500).json({ error: tgData.description || 'Telegram upload failed' });
    }

    const msg     = tgData.result;
    const fileId  = fileType === 'video' ? msg.video?.file_id : msg.document?.file_id;
    const thumbId = fileType === 'video'
      ? (msg.video?.thumbnail?.file_id || msg.video?.thumb?.file_id || '')
      : '';

    return res.status(200).json({
      success   : true,
      file_id   : fileId,
      thumb_id  : thumbId,
      type      : fileType,
      message_id: msg.message_id,
    });

  } catch (err) {
    console.error('Multipart upload error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// ── Helper: Buffer split ──────────────────────────────────────────────────
function splitBuffer(buf, delimiter) {
  const parts = [];
  let start = 0;
  let idx;
  while ((idx = indexOfSeq(buf, delimiter, start)) !== -1) {
    if (idx > start) parts.push(buf.slice(start, idx));
    start = idx + delimiter.length;
    // \r\n بعد از delimiter
    if (buf[start] === 0x0d && buf[start + 1] === 0x0a) start += 2;
    if (buf[start] === 0x2d && buf[start + 1] === 0x2d) break; // --boundary--
  }
  return parts.filter(p => p.length > 4);
}

function indexOfSeq(buf, seq, offset = 0) {
  outer: for (let i = offset; i <= buf.length - seq.length; i++) {
    for (let j = 0; j < seq.length; j++) {
      if (buf[i + j] !== seq[j]) continue outer;
    }
    return i;
  }
  return -1;
}
