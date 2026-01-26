const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

module.exports.config = {
  name: "gemini",
  version: "10.0.0",
  hasPermssion: 0,
  credits: "Gemini AI Voice",
  description: "প্রথম প্রশ্ন এবং রিপ্লাই—সবই এখন ১০০% ভয়েসে আসবে",
  commandCategory: "AI",
  usages: "[আপনার প্রশ্ন]",
  cooldowns: 1,
};

const nix = "https://raw.githubusercontent.com/aryannix/stuffs/master/raw/apis.json";

module.exports.run = async function({ api, event, args }) {
  const { threadID, messageID, senderID } = event;
  const prompt = args.join(" ");
  if (!prompt) return api.sendMessage("❌ জানু, কিছু তো জিজ্ঞেস করো! 🥰", threadID, messageID);

  api.setMessageReaction("⏳", messageID, () => {}, true);

  try {
    const apiConfig = await axios.get(nix);
    const baseApi = apiConfig.data?.api;

    // Gemini থেকে সংক্ষেপে উত্তর আনা
    const r = await axios.get(`${baseApi}/gemini?prompt=${encodeURIComponent("সংক্ষেপে ২ লাইনে উত্তর দাও: " + prompt)}`);
    const reply = r.data?.response;
    
    if (reply) {
      // ভয়েসে পাঠানোর জন্য মেইন ফাংশন কল
      return await generateAndSendVoice(api, event, reply, baseApi);
    }
  } catch (error) {
    api.sendMessage("⚠ উত্তর দিতে সমস্যা হচ্ছে জানু।", threadID, messageID);
  }
};

module.exports.handleReply = async function({ api, event, handleReply }) {
  const { threadID, messageID, body, senderID } = event;
  if (!body) return;

  api.setMessageReaction("⏳", messageID, () => {}, true);

  try {
    // রিপ্লাই এর টেক্সট নিয়ে জেমিনিকে কল
    const r = await axios.get(`${handleReply.baseApi}/gemini?prompt=${encodeURIComponent("খুব সংক্ষেপে উত্তর দাও: " + body)}`);
    const reply = r.data?.response;

    if (reply) {
      // রিপ্লাই এর উত্তরটিও ভয়েসে পাঠানো নিশ্চিত করা হলো
      return await generateAndSendVoice(api, event, reply, handleReply.baseApi);
    }
  } catch (error) {
    api.setMessageReaction("❌", messageID, () => {}, true);
  }
};

// 🔊 মেইন ভয়েস ইঞ্জিন (প্রথম মেসেজ ও রিপ্লাই উভয়ের জন্য)
async function generateAndSendVoice(api, event, text, baseApi) {
  const { threadID, messageID, senderID } = event;
  
  // ক্যাশ ফোল্ডার নিশ্চিত করা
  const cacheDir = path.join(__dirname, "cache");
  if (!fs.existsSync(cacheDir)) fs.ensureDirSync(cacheDir);
  
  const cachePath = path.join(cacheDir, `${Date.now()}_gemini.mp3`);

  try {
    // গুগলের হাই-কোয়ালিটি টিটিএস লিঙ্ক
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=bn&client=tw-ob`;
    
    const response = await axios({
      method: 'get',
      url: url,
      responseType: 'arraybuffer'
    });

    fs.writeFileSync(cachePath, Buffer.from(response.data));

    api.setMessageReaction("✅", messageID, () => {}, true);

    return api.sendMessage({
      body: `🎙️ 𝗚𝗲𝗺𝗶𝗻𝗶 𝗩𝗼𝗶𝗰𝗲 𝗥𝗲𝘀𝗽𝗼𝗻𝘀𝗲:\n\n${text}`,
      attachment: fs.createReadStream(cachePath)
    }, threadID, (err, info) => {
      // ভয়েস পাঠানোর পর ফাইল ডিলিট
      if (fs.existsSync(cachePath)) fs.unlinkSync(cachePath);
      
      // পরবর্তী রিপ্লাই এর জন্য লুপ বজায় রাখা
      global.client.handleReply.push({
        name: module.exports.config.name,
        messageID: info.messageID,
        author: senderID,
        baseApi: baseApi
      });
    }, messageID);

  } catch (e) {
    // কোনো কারণে ভয়েস ফেইল করলে টেক্সট পাঠাবে
    return api.sendMessage(text, threadID, messageID);
  }
  }
  
