const axios = require('axios');
const express = require('express');
const multer = require('multer');
const FormData = require('form-data');

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', '*');
  next();
});

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const PORT = process.env.PORT || 10000;

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
let submissions = {};
const botUrl = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function sendToAdmin(text, replyMarkup = null) {
  return axios.post(`${botUrl}/sendMessage`, {
    chat_id: ADMIN_CHAT_ID, text, parse_mode: 'HTML', reply_markup: replyMarkup
  });
}

async function sendPhotoToAdmin(buffer, filename, caption = '') {
  const form = new FormData();
  form.append('chat_id', ADMIN_CHAT_ID);
  form.append('photo', buffer, { filename });
  if (caption) form.append('caption', caption);
  form.append('parse_mode', 'HTML');
  return axios.post(`${botUrl}/sendPhoto`, form, { headers: form.getHeaders() });
}

app.get('/', (req, res) => res.send('KYC Bot is running ✅'));

app.post('/webhook/kyc-submit', upload.array('photos', 5), async (req, res) => {
  try {
    const { name, email, username } = req.body;
    const files = req.files;
    if (!name || !files?.length) return res.status(400).json({ error: "Missing data" });

    const id = Date.now().toString();
    submissions[id] = { name, email, username };

    const keyboard = {
      inline_keyboard: [
        [{ text: "✅ Approve", callback_data: `approve_${id}` }],
        [{ text: "❌ Reject", callback_data: `reject_${id}` }]
      ]
    };

    await sendToAdmin(`🆕 <b>New KYC</b>\n👤 ${name}\n📧 ${email}\n🔗 ${username || 'N/A'}\n📸 ${files.length} photos\n🆔 ${id}`);
    for (let i = 0; i < files.length; i++) {
      await sendPhotoToAdmin(files[i].buffer, files[i].originalname, i===0 ? `For ${name} - ${id}` : '');
    }
    await sendToAdmin(`👆 Approve or Reject ${name}?`, keyboard);

    res.json({ success: true, id });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "Failed" });
  }
});

app.post('/webhook/callback', async (req, res) => {
  const update = req.body;
  if (update.callback_query) {
    const q = update.callback_query;
    const [action, id] = q.data.split('_');
    const data = submissions[id];
    if (data) {
      await sendToAdmin(`✅ <b>${data.name}</b> has been <b>${action === 'approve' ? 'Approved' : 'Rejected'}</b> (ID: ${id})`);
      delete submissions[id];
    }
    await axios.post(`${botUrl}/answerCallbackQuery`, { callback_query_id: q.id, text: `User ${action}d!` });
  }
  res.json({ status: 'ok' });
});

app.listen(PORT, () => console.log(`Running on ${PORT}`));
