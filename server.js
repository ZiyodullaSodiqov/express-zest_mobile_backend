const express = require('express');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const MONGODB_URI = process.env.MONGODB_URI || '';
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const messageSchema = new mongoose.Schema({
  name: { type: String, required: true },
  number: { type: String, required: true },
  text: { type: String, required: true },
  reply: { type: String },
  replied: { type: Boolean, default: false },
  replyTimestamp: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Message = mongoose.model('Message', messageSchema);

const TELEGRAM_BOT_TOKEN = '';
// CHAT ID ni number formatda ishlating
const TELEGRAM_CHAT_ID = 571241984;

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

// Debug: Barcha kelayotgan xabarlarni ko'rsatish
bot.on('message', (msg) => {
  console.log('🔍 Kelgan xabar:', {
    chatId: msg.chat.id,
    text: msg.text,
    type: msg.chat.type,
    user: msg.from.username
  });
});

// Xabarlarni yuborish funksiyasini alohida qilish
const sendTelegramMessage = async (messageText) => {
  try {
    console.log('📤 Telegramga xabar yuborilmoqda...');
    console.log('Chat ID:', TELEGRAM_CHAT_ID);
    console.log('Message:', messageText);
    
    const result = await bot.sendMessage(TELEGRAM_CHAT_ID, messageText);
    console.log('✅ Xabar muvaffaqiyatli yuborildi:', result.message_id);
    return true;
  } catch (error) {
    console.error('❌ Telegram xabar yuborish xatosi:', error);
    
    // Xatoni tahlil qilish
    if (error.response && error.response.statusCode === 403) {
      console.log('⚠️ Bot bu chatga xabar yubora olmaydi. Chat ID ni tekshiring.');
    } else if (error.response && error.response.statusCode === 400) {
      console.log('⚠️ Noto\'g\'ri chat ID yoki xabar formati.');
    }
    return false;
  }
};

app.post('/api/messages', async (req, res) => {
  try {
    const { name, number, text } = req.body;

    if (!name || !number || !text) {
      return res.status(400).json({ 
        success: false, 
        message: 'Barcha maydonlarni to\'ldiring' 
      });
    }

    const newMessage = new Message({
      name,
      number,
      text,
      replied: false
    });

    const savedMessage = await newMessage.save();

    // Telegram xabarini yuborish
    const telegramMessage = `
🆕 Yangi Savol

👤 Ism: ${name}
📞 Telefon: ${number}
💬 Savol: ${text}
🆔 ID: ${savedMessage._id}

⏰ Vaqt: ${new Date().toLocaleString('uz-UZ')}

/javob_${savedMessage._id} - Javob berish
    `;

    const telegramSent = await sendTelegramMessage(telegramMessage);

    res.status(200).json({ 
      success: true, 
      message: 'Xabar muvaffaqiyatli yuborildi',
      telegramSent: telegramSent,
      data: savedMessage
    });

  } catch (error) {
    console.error('Error processing message:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server xatosi' 
    });
  }
});

// ... qolgan endpointlar o'zgarmaydi (sizning original kodingizdagi kabi)

// Yangi test endpoint - Telegram chat ID ni tekshirish
app.get('/api/test-telegram', async (req, res) => {
  try {
    const testMessage = `
🤖 Test Xabar
⏰ Vaqt: ${new Date().toLocaleString('uz-UZ')}
✅ Server ishlayapti
    `;

    const sent = await sendTelegramMessage(testMessage);
    
    res.json({
      success: sent,
      message: sent ? 'Test xabar yuborildi' : 'Xabar yuborish muvaffaqiyatsiz',
      chatId: TELEGRAM_CHAT_ID
    });
  } catch (error) {
    console.error('Test xabar xatosi:', error);
    res.status(500).json({
      success: false,
      message: 'Test xabar xatosi',
      error: error.message
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    telegramChatId: TELEGRAM_CHAT_ID
  });
});

// MongoDB connection events
mongoose.connection.on('connected', () => {
  console.log('✅ MongoDB ga ulandi');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB ulanish xatosi:', err);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server ${PORT}-portda ishga tushdi`);
  console.log(`🤖 Telegram bot faollashtirildi`);
});
