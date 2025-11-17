const express = require('express');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;


app.use(cors());
app.use(express.json());


const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://Ziydoulla:ziyodulla0105@cluster0.heagvwv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
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


const TELEGRAM_BOT_TOKEN = '8239147230:AAGs_CPOMk2i9y-2uyLSP_J6wCRA4uwARfs';
const TELEGRAM_CHAT_ID = '571241984';

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });


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

    
    const telegramMessage = `
🆕 Yangi Savol

👤 Ism: ${name}
📞 Telefon: ${number}
💬 Savol: ${text}
🆔 ID: ${savedMessage._id}

⏰ Vaqt: ${new Date().toLocaleString('uz-UZ')}

/javob_${savedMessage._id} - Javob berish
    `;

    await bot.sendMessage(TELEGRAM_CHAT_ID, telegramMessage);

    res.status(200).json({ 
      success: true, 
      message: 'Xabar muvaffaqiyatli yuborildi',
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


app.get('/api/messages', async (req, res) => {
  try {
    const messages = await Message.find()
      .sort({ createdAt: -1 })
      .lean();

    
    const formattedMessages = messages.map(msg => ({
      id: msg._id.toString(),
      text: msg.text,
      name: msg.name,
      number: msg.number,
      timestamp: new Date(msg.createdAt).toLocaleString('uz-UZ'),
      isAdmin: false,
      reply: msg.reply,
      replied: msg.replied,
      replyTimestamp: msg.replyTimestamp ? new Date(msg.replyTimestamp).toLocaleString('uz-UZ') : null
    }));

    res.json({ 
      success: true, 
      messages: formattedMessages 
    });

  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server xatosi' 
    });
  }
});

// API endpoint to get messages with replies (for admin)
app.get('/api/admin/messages', async (req, res) => {
  try {
    const messages = await Message.find()
      .sort({ createdAt: -1 });

    res.json({ 
      success: true, 
      messages 
    });

  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server xatosi' 
    });
  }
});

// API endpoint to add admin reply
app.post('/api/messages/:id/reply', async (req, res) => {
  try {
    const { id } = req.params;
    const { reply } = req.body;

    if (!reply) {
      return res.status(400).json({ 
        success: false, 
        message: 'Javob matni kiritilmagan' 
      });
    }

    const message = await Message.findById(id);
    
    if (!message) {
      return res.status(404).json({ 
        success: false, 
        message: 'Xabar topilmadi' 
      });
    }

    // Update message with reply
    message.reply = reply;
    message.replied = true;
    message.replyTimestamp = new Date();
    message.updatedAt = new Date();

    await message.save();

    // Here you can add SMS notification or other notification methods
    console.log(`✅ Javob yuborildi ${message.name} ga: ${reply}`);

    res.json({ 
      success: true, 
      message: 'Javob muvaffaqiyatli yuborildi',
      data: message
    });

  } catch (error) {
    console.error('Error sending reply:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server xatosi' 
    });
  }
});

// Telegram bot command handlers
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  
  Message.countDocuments({ replied: false })
    .then(unansweredCount => {
      Message.countDocuments()
        .then(totalCount => {
          bot.sendMessage(chatId, 
            `👋 Assalomu alaykum Admin!

📊 Joriy statistikalar:
• Yangi savollar: ${unansweredCount}
• Jami savollar: ${totalCount}

💡 Buyruqlar:
/savollar - Barcha savollarni ko'rish
/statistika - Umumiy statistika`
          );
        });
    })
    .catch(error => {
      console.error('Error counting messages:', error);
      bot.sendMessage(chatId, '❌ Statistika olishda xatolik');
    });
});

bot.onText(/\/savollar/, (msg) => {
  const chatId = msg.chat.id;
  
  Message.find({ replied: false })
    .sort({ createdAt: -1 })
    .then(unanswered => {
      if (unanswered.length === 0) {
        bot.sendMessage(chatId, '✅ Barcha savollarga javob berilgan');
        return;
      }

      unanswered.forEach((message) => {
        const messageText = `
📝 Savol #${message._id}

👤: ${message.name}
📞: ${message.number}
💬: ${message.text}
⏰: ${new Date(message.createdAt).toLocaleString('uz-UZ')}

/javob_${message._id} - Javob berish
        `;
        
        bot.sendMessage(chatId, messageText);
      });
    })
    .catch(error => {
      console.error('Error fetching unanswered messages:', error);
      bot.sendMessage(chatId, '❌ Savollarni olishda xatolik');
    });
});

bot.onText(/\/javob_(.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const messageId = match[1];
  
  Message.findById(messageId)
    .then(message => {
      if (message) {
        bot.sendMessage(chatId, 
          `Javob yuborish uchun quyidagi formatda yozing:

💬 javob_${messageId} Sizning javobingiz matni

Misol:
💬 javob_${messageId} Assalomu alaykum! Sizning savolingizga javob...`
        );
      } else {
        bot.sendMessage(chatId, '❌ Xabar topilmadi');
      }
    })
    .catch(error => {
      console.error('Error finding message:', error);
      bot.sendMessage(chatId, '❌ Xatolik yuz berdi');
    });
});

// Handle reply messages from Telegram
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (text && text.startsWith('💬 javob_')) {
    const parts = text.split(' ');
    const messageId = parts[1].replace('javob_', '');
    const replyText = parts.slice(2).join(' ');

    if (!replyText) {
      bot.sendMessage(chatId, '❌ Iltimos, javob matnini kiriting');
      return;
    }

    Message.findById(messageId)
      .then(message => {
        if (message) {
          message.reply = replyText;
          message.replied = true;
          message.replyTimestamp = new Date();
          message.updatedAt = new Date();

          return message.save();
        } else {
          throw new Error('Message not found');
        }
      })
      .then(updatedMessage => {
        bot.sendMessage(chatId, 
          `✅ Javob muvaffaqiyatli yuborildi!

👤 Foydalanuvchi: ${updatedMessage.name}
📞 Telefon: ${updatedMessage.number}

💬 Sizning javobingiz: ${replyText}

📱 Endi foydalanuvchi veb-sahifada javobingizni ko'rishi mumkin.`
        );
      })
      .catch(error => {
        console.error('Error processing reply:', error);
        bot.sendMessage(chatId, '❌ Javob yuborishda xatolik');
      });
  }
});

bot.onText(/\/statistika/, (msg) => {
  const chatId = msg.chat.id;
  
  Promise.all([
    Message.countDocuments(),
    Message.countDocuments({ replied: true }),
    Message.countDocuments({ replied: false })
  ])
  .then(([total, answered, unanswered]) => {
    const stats = `
📊 Umumiy Statistika

• Jami savollar: ${total}
• Javob berilgan: ${answered}
• Javob kutilayotgan: ${unanswered}

📈 Foizlar:
• Javob berilgan: ${total > 0 ? ((answered / total) * 100).toFixed(1) : 0}%
• Javob kutilayotgan: ${total > 0 ? ((unanswered / total) * 100).toFixed(1) : 0}%
    `;

    bot.sendMessage(chatId, stats);
  })
  .catch(error => {
    console.error('Error getting statistics:', error);
    bot.sendMessage(chatId, '❌ Statistika olishda xatolik');
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
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
  console.log(`🗄️  MongoDB: ${MONGODB_URI}`);
});