import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(cors());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, "public")));

// Serve Speed Insights module from node_modules
app.use("/modules", express.static(path.join(__dirname, "node_modules")));

const PORT = 3000;

// 🔑 API KEY
const GEMINI_API_KEY = "AIzaSyAuYKSBXts3lntMlj7FrSMKAorRM9wPwRo";

// ================================
// 👑 ADMIN CONFIG — نمرة أو ID تاع صاحب الباجة
// ================================
const ADMINS = {
  whatsapp: ["+213xxxxxxxxx"],       // نمرة صاحب الباجة على WhatsApp
  instagram: ["username_moul_baja"], // username تاعو على Instagram
  telegram: ["123456789"],           // user_id تاعو على Telegram
};

function isAdmin(platform, senderId) {
  return ADMINS[platform]?.includes(senderId);
}

// ================================
// 🧠 MEMORY — محادثات الزبائن
// ================================
let conversations = {};

// ================================
// 📦 PRODUCTS — قائمة المنتجات (يضيفها صاحب الباجة)
// ================================
let products = [];

// ================================
// 📊 CRM — بيانات الزبائن
// ================================
let clients = [];

// ================================
// 🏪 INFO TABA3 BAJA — صاحب الباجة يقدر يبدلها
// ================================
let bajaInfo = {
  name: "اسم الباجة",
  activity: "نوع النشاط",
  location: "المدينة",
  hours: "من 9 الصباح لـ 9 الليل",
  phone: "+213xxxxxxxxx",
};

// ================================
// 🧠 SYSTEM PROMPT — يتبنى تلقائي من المنتجات
// ================================
function buildSystemPrompt() {
  const productsList =
    products.length > 0
      ? products
          .map(
            (p, i) =>
              `${i + 1}. ${p.name} — السعر: ${p.price} دج${p.description ? " — " + p.description : ""}${p.sizes ? " — المقاسات: " + p.sizes : ""}`
          )
          .join("\n")
      : "ما زالت ما تزادت حتى منتجات";

  return `
أنت مساعد ذكي تخدم في خدمة زبائن لـ "${bajaInfo.name}".

**معلومات الباجة:**
- النشاط: ${bajaInfo.activity}
- الموقع: ${bajaInfo.location}

- أوقات العمل: ${bajaInfo.hours}
- التواصل: ${bajaInfo.phone}

**المنتجات المتوفرة:**
${productsList}

**قواعد مهمة:**
- تحكي دايما بالدارجة الجزائرية بشكل طبيعي ومريح
- كن ودود وقريب من الزبون، كيما بنادم حقيقي
- جاوب غير على اللي يخص الباجة
- إذا سألك على شي ما تعرفوش قول "نسقسي صاحب الباجة ونرجعلك"
- ما تطولش في الردود — قصير وواضح
- اجمع من الزبون: الاسم، الطلب، رقم الهاتف، العنوان إذا كان فيه توصيل
- ما تقولش أنك AI إلا إذا سألك مباشرة;
`;
}

// ================================
// 🤖 GEMINI — يبعت الرسالة
// ================================
async function askGemini(userId, userMessage) {
  if (!conversations[userId]) conversations[userId] = [];

  conversations[userId].push({ role: "user", content: userMessage });

  const historyText = conversations[userId]
    .map((msg) => `${msg.role === "user" ? "زبون" : "بوت"}: ${msg.content}`)
    .join("\n");

  const finalPrompt = `${buildSystemPrompt()}

**المحادثة:**
${historyText}

رد:`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: finalPrompt }] }],
      }),
    }
  );

  const data = await response.json();
  const reply =
    data.candidates?.[0]?.content?.parts?.[0]?.text || "ما فهمتش مليح 😅";

  conversations[userId].push({ role: "assistant", content: reply });
  return reply;
}

// ================================
// 📥 ADMIN COMMANDS — أوامر صاحب الباجة
// ================================
function handleAdminMessage(message) {
  const msg = message.trim();

  // ➕ إضافة منتج
  // مثال: "زيد: جاكيت أسود | 3500 | S/M/L | جودة عالية"
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

  // ❌ حذف منتج
  // مثال: "حذف: جاكيت أسود"
  if (msg.startsWith("حذف:")) {
    const name = msg.replace("حذف:", "").trim();
    const before = products.length;
    products = products.filter((p) => !p.name.includes(name));
    if (products.length < before) return `✅ تحذف: ${name}`;
    return `❌ ما لقيتش منتج باسم: ${name}`;
  }

  // ✏️ تعديل معلومات الباجة
  // مثال: "بدل الاسم: بوتيك سارة"
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

  // 📋 عرض المنتجات
  if (msg === "المنتجات") {
    if (products.length === 0) return "📦 ما عندكش حتى منتج مزال";
    return (
      "📦 المنتجات:\n" +
      products
        .map((p) => `• ${p.name} — ${p.price} دج${p.sizes ? ` (${p.sizes})` : ""}`)
        .join("\n")
    );
  }

  // 👥 عرض الزبائن
  if (msg === "الزبائن") {
    if (clients.length === 0) return "👥 ما عندكش حتى زبون مزال";
    return (
      "👥 الزبائن:\n" +
      clients
        .map((c) => `• ${c.name} — ${c.phone} — ${c.date.toLocaleDateString("ar")}`)
        .join("\n")
    );
  }

  // ❓ مساعدة
  if (msg === "مساعدة") {
    return `👑 الأوامر المتاحة:
• زيد: [اسم] | [سعر] | [مقاسات] | [وصف]
• حذف: [اسم المنتج]
• بدل الاسم: [اسم جديد]
• بدل الموقع: [موقع جديد]
• بدل الأوقات: [أوقات جديدة]
• المنتجات — تشوف كل المنتجات
• الزبائن — تشوف كل الزبائن`;
  }

  return `❓ ما فهمتش الأمر. بعت "مساعدة" تشوف كل الأوامر`;
}

// ================================
// 🚀 MAIN CHAT ROUTE
// ================================
app.post("/chat", async (req, res) => {
  const { userId, message, platform = "whatsapp" } = req.body;

  if (!userId || !message) {
    return res.status(400).json({ error: "userId و message مطلوبين" });
  }

  try {
    // 👑 صاحب الباجة
    if (isAdmin(platform, userId)) {
      const adminReply = handleAdminMessage(message);
      return res.json({ reply: adminReply, role: "admin" });
    }

    // 🛍️ زبون عادي
    const reply = await askGemini(userId, message);
    res.json({ reply, role: "customer" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "مشكل فالسيرفر" });
  }
});

// ================================
// 📊 SAVE CLIENT
// ================================
app.post("/save", (req, res) => {
  const { name, phone } = req.body;
  if (!name || !phone) return res.status(400).json({ error: "name و phone مطلوبين" });

  clients.push({ name, phone, date: new Date() });
  res.json({ success: true, total: clients.length });
});

// ================================
// 📋 GET PRODUCTS
// ================================
app.get("/products", (req, res) => {
  res.json(products);
});

// ================================
// 👥 GET CLIENTS
// ================================
app.get("/clients", (req, res) => {
  res.json(clients);
});

// ================================
// 🧠 GET HISTORY
// ================================
app.get("/history/:userId", (req, res) => {
  res.json(conversations[req.params.userId] || []);
});

// ================================
// ▶️ START SERVER
// ================================
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`👑 Admin numbers: ${JSON.stringify(ADMINS)}`);
});
