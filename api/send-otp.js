const nodemailer = require('nodemailer');
const otpGenerator = require('otp-generator');
const fs = require('fs');
const path = require('path');

// --- File System Helpers (Vercel Read-Only Workaround) ---
const dbPath = path.join(process.cwd(), 'database.json');
const statsPath = path.join(process.cwd(), 'stats.json');

const defaultStats = { api_name: "Gmail OTP API", version: "1.0.0", developer: "https://t.me/username_506", status: "Online", total_requests: 0, total_users: 0, total_otps_sent: 0, verified_otps: 0, expired_otps: 0, last_2_days_requests: 0, _users: [], _requests: [] };

function readJSON(filePath, defaultData) {
  let targetPath = filePath;
  try {
    const tmpPath = path.join('/tmp', path.basename(filePath));
    if (fs.existsSync(tmpPath)) targetPath = tmpPath;
    if (fs.existsSync(targetPath)) return JSON.parse(fs.readFileSync(targetPath, 'utf8'));
  } catch (err) {}
  return defaultData;
}

function writeJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (err) {
    if (err.code === 'EROFS') {
      const tmpPath = path.join('/tmp', path.basename(filePath));
      fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
    }
  }
}

function updateStats(type, email = null) {
  const stats = readJSON(statsPath, defaultStats);
  const now = Date.now();
  stats.total_requests += 1;
  
  if (email) {
    if (!stats._users) stats._users = [];
    if (!stats._users.includes(email)) {
      stats._users.push(email);
      stats.total_users = stats._users.length;
    }
  }

  if (type === 'sent') stats.total_otps_sent += 1;
  
  if (!stats._requests) stats._requests = [];
  stats._requests.push(now);
  stats._requests = stats._requests.filter(time => time > now - (48 * 60 * 60 * 1000));
  stats.last_2_days_requests = stats._requests.length;

  writeJSON(statsPath, stats);
}
// ---------------------------------------------------------

module.exports = async (req, res) => {
  try {
    const { email } = req.query;

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      updateStats('error');
      return res.status(400).json({ success: false, message: "Valid email is required" });
    }

    // Generate 6-digit numeric OTP
    const otp = otpGenerator.generate(6, { digits: true, lowerCaseAlphabets: false, upperCaseAlphabets: false, specialChars: false });
    const createdAt = Date.now();
    const expiresAt = createdAt + 3600000; // 1 hour expiration

    // Store in database.json (Overwrites if exists - ensuring 1 active OTP per email)
    const db = readJSON(dbPath, {});
    db[email] = { otp, createdAt, expiresAt };
    writeJSON(dbPath, db);

    // Setup Nodemailer
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_EMAIL,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });

    const mailOptions = {
      from: `"Gmail OTP API" <${process.env.GMAIL_EMAIL}>`,
      to: email,
      subject: "Your Verification OTP",
      text: `Hello,\n\nYour OTP is\n\n${otp}\n\nThis OTP is valid for 1 hour.\n\nApi by\nhttps://t.me/username_506\n\nOtp by\nhttps://t.me/username_506\n\nTag by\nhttps://t.me/username_506\n\nDo not share this OTP with anyone.`
    };

    await transporter.sendMail(mailOptions);
    updateStats('sent', email);

    res.status(200).json({
      success: true,
      message: "OTP sent successfully",
      expires_in: "1 hour",
      developer: "https://t.me/username_506"
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
  }
};
