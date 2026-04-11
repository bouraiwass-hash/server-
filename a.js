import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3000;

// 🔑 Gemini API Key — من Vercel Environment Variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// ================================
// 🏪 INFO TABA3 BAJA
// ================================
let bajaInfo = {
  name: "اسم الباجة",
  activity: "نوع النشاط",
  location: "المدينة",
  hours: "من 9 الصباح لـ 9 الليل",
  phone: "+213xxxxxxxxx",
};

// ================================
// 📦 PRODUCTS
// ================================
let products = [];

// ================================
// 📊 CRM
// ================================
let clients = [];

// ================================
// 🧠 MEMORY
// ================================
let conversations = {};

// ================================
// 🧠 SYSTEM PROMPT
// ================================
function buildSystemPrompt() {
  const productsList =
    products.length > 0
      ? products
          .map(
            (p, i) =>
              `${i + 1}. ${p.name} — السعر: ${p.price} دج` +
              (p.description ? ` — ${p.description}` : "") +
              (p.sizes ? ` — المقاسات: ${p.sizes}` : "")
          )
          .join("\n")
      : "ما زالت ما تزادت حتى منتجات";

  return `
أنت مساعد ذكي تخدم في خدمة زبائن لـ "${bajaInfo.name}".

معلومات الباجة:
- النشاط: ${bajaInfo.activity}
- الموقع: ${bajaInfo.location}
- أوقات العمل: ${bajaInfo.hours}
- التواصل: ${bajaInfo.phone}

المنتجات المتوفرة:
${productsList}

قواعد مهمة:
- تحكي دايما بالدارجة الجزائرية بشكل طبيعي ومريح
- كن ودود وقريب من الزبون، كيما بنادم حقيقي
- جاوب غير على اللي يخص الباجة
- إذا سألك على شي ما تعرفوش قول "نسقسي صاحب الباجة ونرجعلك"
- ما تطولش في الردود — قصير وواضح
- اجمع من الزبون: الاسم، الطلب، رقم الهاتف، العنوان إذا كان فيه توصيل
- ما تقولش أنك AI إلا إذا سألك مباشرة
- ردك يكون نص فقط
`;
}

// ================================
// 🤖 GEMINI
// ================================
async function askGemini(userId, userMessage) {
  if (!conversations[userId]) conversations[userId] = [];

  conversations[userId].push({ role: "user", content: userMessage });

  // احتفظ بـ 20 رسالة فقط
  if (conversations[userId].length > 20) {
    conversations[userId] = conversations[userId].slice(-20);
  }

  const historyText = conversations[userId]
    .map((msg) => `${msg.role === "user" ? "زبون" : "بوت"}: ${msg.content}`)
    .join("\n");

  const finalPrompt = `${buildSystemPrompt()}

المحادثة:
${historyText}

رد:`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: finalPrompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 300,
        },
      }),
    }
  );

  const data = await response.json();

  if (data.error) {
    console.error("Gemini error:", JSON.stringify(data.error));
    return "سيرفر الذكاء الاصطناعي فيه مشكل، حاول مرة أخرى";
  }

  const reply =
    data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
    "ما فهمتش مليح";

  conversations[userId].push({ role: "assistant", content: reply });
  return reply;
}

// ================================
// 📥 ADMIN COMMANDS
// ================================
function handleAdminMessage(message) {
  const msg = message.trim();

  if (msg.startsWith("زيد:")) {
    const parts = msg.replace("زيد:", "").trim().split("|");
    const product = {
      id: Date.now(),
      name: parts[0]?.trim(),
      price: parts[1]?.trim(),
      sizes: parts[2]?.trim() || null,
      description: parts[3]?.trim() || null,
      addedAt: new Date(),
    };
    products.push(product);
    return `✅ تزاد المنتج: ${product.name} بـ ${product.price} دج`;
  }

  if (msg.startsWith("حذف:")) {
    const name = msg.replace("حذف:", "").trim();
    const before = products.length;
    products = products.filter((p) => !p.name.includes(name));
    return products.length < before
      ? `✅ تحذف: ${name}`
      : `❌ ما لقيتش منتج باسم: ${name}`;
  }

  if (msg.startsWith("بدل الاسم:")) {
    bajaInfo.name = msg.replace("بدل الاسم:", "").trim();
    return `✅ تبدل اسم الباجة لـ: ${bajaInfo.name}`;
  }
  if (msg.startsWith("بدل الموقع:")) {
    bajaInfo.location = msg.replace("بدل الموقع:", "").trim();
    return `✅ تبدل الموقع لـ: ${bajaInfo.location}`;
  }
  if (msg.startsWith("بدل الأوقات:")) {
    bajaInfo.hours = msg.replace("بدل الأوقات:", "").trim();
    return `✅ تبدلو أوقات العمل`;
  }

  if (msg === "المنتجات") {
    if (products.length === 0) return "📦 ما عندكش حتى منتج مزال";
    return (
      "📦 المنتجات:\n" +
      products
        .map(
          (p) =>
            `• ${p.name} — ${p.price} دج${p.sizes ? ` (${p.sizes})` : ""}`
        )
        .join("\n")
    );
  }

  if (msg === "الزبائن") {
    if (clients.length === 0) return "👥 ما عندكش حتى زبون مزال";
    return (
      "👥 الزبائن:\n" +
      clients.map((c) => `• ${c.name} — ${c.phone}`).join("\n")
    );
  }

  if (msg === "مساعدة") {
    return `👑 الأوامر:
• زيد: [اسم] | [سعر] | [مقاسات] | [وصف]
• حذف: [اسم المنتج]
• بدل الاسم: [جديد]
• بدل الموقع: [جديد]
• بدل الأوقات: [جديد]
• المنتجات
• الزبائن`;
  }

  return null; // مش أمر admin
}

// ================================
// 🚀 MANYCHAT ENDPOINT
// ================================
// ManyChat يبعت POST على /manychat بـ JSON:
// {
//   "userId": "instagram_user_id",
//   "message": "واش عندكم جاكيت؟",
//   "isAdmin": false
// }
// ويستنى رد:
// { "reply": "نعم عندنا..." }

app.post("/manychat", async (req, res) => {
  const { userId, message, isAdmin } = req.body;

  if (!userId || !message) {
    return res.status(400).json({ error: "userId و message مطلوبين" });
  }

  console.log(`📩 [${isAdmin ? "ADMIN" : "USER"}] ${userId}: ${message}`);

  try {
    if (isAdmin) {
      const adminReply = handleAdminMessage(message);
      if (adminReply) {
        return res.json({ reply: adminReply });
      }
      // إذا مش أمر — يكمل لـ Gemini
    }

    const reply = await askGemini(userId, message);
    return res.json({ reply });

  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ reply: "مشكل فالسيرفر، حاول مرة أخرى" });
  }
});

// ================================
// 💬 CHAT (للاختبار)
// ================================
app.post("/chat", async (req, res) => {
  const { userId, message } = req.body;
  if (!userId || !message) {
    return res.status(400).json({ error: "userId و message مطلوبين" });
  }
  try {
    const reply = await askGemini(userId, message);
    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "مشكل فالسيرفر" });
  }
});

// ================================
// 📋 OTHER ROUTES
// ================================
app.get("/products", (req, res) => res.json(products));
app.get("/clients", (req, res) => res.json(clients));
app.get("/history/:userId", (req, res) =>
  res.json(conversations[req.params.userId] || [])
);

app.post("/save", (req, res) => {
  const { name, phone } = req.body;
  if (!name || !phone)
    return res.status(400).json({ error: "name و phone مطلوبين" });
  clients.push({ name, phone, date: new Date() });
  res.json({ success: true, total: clients.length });
});

// Health check
app.get("/", (req, res) =>
  res.json({
    status: "✅ Server is running",
    routes: ["/manychat", "/chat", "/products", "/clients"],
  })
);

// ================================
// ▶️ START
// ================================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

export default app;
