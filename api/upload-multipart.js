// api/upload-multipart.js — CommonJS + busboy

module.exports.config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
};

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const BOT_TOKEN  = process.env.TELEGRAM_BOT_TOKEN;
  const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;
  if (!BOT_TOKEN || !CHANNEL_ID) {
    return res.status(500).json({ error: 'Bot token or channel not configured' });
  }

  let Busboy;
  try {
    Busboy = require('busboy');
  } catch(e) {
    // busboy نییە — فۆلبەک بۆ خوێندنەوەی دەستی
    return handleManual(req, res, BOT_TOKEN, CHANNEL_ID);
  }

  let fileType  = 'image';
  let fileName  = 'upload_' + Date.now();
  let mimeType  = 'application/octet-stream';
  const chunks  = [];
  let finished  = false;

  let bb;
  try {
    bb = Busboy({ headers: req.headers, limits: { fileSize: 350 * 1024 * 1024 } });
  } catch(e) {
    return res.status(500).json({ error: 'Busboy init failed: ' + e.message });
  }

  bb.on('field', (name, val) => {
    if (name === 'type') fileType = val.trim();
  });

  bb.on('file', (name, stream, info) => {
    if (info.filename) fileName = info.filename;
    if (info.mimeType && info.mimeType !== 'application/octet-stream') mimeType = info.mimeType;
    stream.on('data', d => chunks.push(d));
    stream.resume();
  });

  bb.on('finish', () => {
    if (finished) return;
    finished = true;
    sendToTelegram(chunks, fileName, mimeType, fileType, BOT_TOKEN, CHANNEL_ID, res);
  });

  bb.on('error', err => {
    if (finished) return;
    finished = true;
    return res.status(500).json({ error: 'Parse error: ' + err.message });
  });

  req.on('error', err => {
    if (finished) return;
    finished = true;
    return res.status(500).json({ error: 'Request error: ' + err.message });
  });

  req.pipe(bb);
};

// ── فۆلبەک: خوێندنەوەی دەستی بەبێ busboy ────────────────────────────────
function handleManual(req, res, BOT_TOKEN, CHANNEL_ID) {
  const contentType = req.headers['content-type'] || '';
  const boundaryMatch = contentType.match(/boundary=([^\s;]+)/);
  if (!boundaryMatch) {
    return res.status(400).json({ error: 'No boundary in content-type' });
  }
  const boundary = boundaryMatch[1].trim();
  const chunks = [];

  req.on('data', d => chunks.push(d));
  req.on('error', err => res.status(500).json({ error: err.message }));
  req.on('end', () => {
    try {
      const raw   = Buffer.concat(chunks);
      const delim = Buffer.from('\r\n--' + boundary);
      const first = Buffer.from('--' + boundary + '\r\n');

      let fileBuffer = null;
      let fileName   = 'upload_' + Date.now();
      let mimeType   = 'application/octet-stream';
      let fileType   = 'image';

      // پارسکردنی بە دەست
      let pos = raw.indexOf(first);
      if (pos === -1) return res.status(400).json({ error: 'Bad multipart format' });
      pos += first.length;

      while (pos < raw.length) {
        const headerEnd = indexOfBuf(raw, Buffer.from('\r\n\r\n'), pos);
        if (headerEnd === -1) break;
        const header    = raw.slice(pos, headerEnd).toString('utf8');
        const bodyStart = headerEnd + 4;
        const bodyEnd   = indexOfBuf(raw, delim, bodyStart);
        const body      = bodyEnd === -1 ? raw.slice(bodyStart) : raw.slice(bodyStart, bodyEnd);

        const nameMatch = header.match(/name="([^"]+)"/i);
        if (nameMatch) {
          const fieldName = nameMatch[1];
          if (fieldName === 'type') {
            fileType = body.toString('utf8').trim();
          } else if (fieldName === 'file') {
            const fnMatch = header.match(/filename="([^"]+)"/i);
            if (fnMatch) fileName = fnMatch[1];
            const ctMatch = header.match(/Content-Type:\s*([^\r\n]+)/i);
            if (ctMatch) mimeType = ctMatch[1].trim();
            fileBuffer = body;
          }
        }
        if (bodyEnd === -1) break;
        pos = bodyEnd + delim.length + 2; // +2 for \r\n
        if (raw[pos] === 0x2d && raw[pos+1] === 0x2d) break; // --
      }

      if (!fileBuffer || fileBuffer.length === 0) {
        return res.status(400).json({ error: 'No file data in request' });
      }
      sendToTelegram([fileBuffer], fileName, mimeType, fileType, BOT_TOKEN, CHANNEL_ID, res);
    } catch(e) {
      return res.status(500).json({ error: 'Manual parse error: ' + e.message });
    }
  });
}

function indexOfBuf(buf, search, offset) {
  for (let i = offset || 0; i <= buf.length - search.length; i++) {
    let ok = true;
    for (let j = 0; j < search.length; j++) {
      if (buf[i+j] !== search[j]) { ok = false; break; }
    }
    if (ok) return i;
  }
  return -1;
}

// ── ناردن بۆ Telegram ────────────────────────────────────────────────────
async function sendToTelegram(chunks, fileName, mimeType, fileType, BOT_TOKEN, CHANNEL_ID, res) {
  try {
    const fileBuffer = Buffer.concat(chunks);
    if (!fileBuffer || fileBuffer.length === 0) {
      return res.status(400).json({ error: 'File buffer is empty' });
    }

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
    const fileId  = fileType === 'video' ? msg.video?.file_id  : msg.document?.file_id;
    const thumbId = fileType === 'video'
      ? (msg.video?.thumbnail?.file_id || msg.video?.thumb?.file_id || '') : '';

    return res.status(200).json({
      success   : true,
      file_id   : fileId,
      thumb_id  : thumbId,
      type      : fileType,
      message_id: msg.message_id,
    });
  } catch(err) {
    return res.status(500).json({ error: 'Telegram send failed: ' + err.message });
  }
}
