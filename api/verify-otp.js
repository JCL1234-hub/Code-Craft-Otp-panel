const fs = require('fs');
const path = require('path');

// --- File System Helpers ---
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
  
  if (type === 'verified') stats.verified_otps += 1;
  if (type === 'expired') stats.expired_otps += 1;

  if (!stats._requests) stats._requests = [];
  stats._requests.push(now);
  stats._requests = stats._requests.filter(time => time > now - (48 * 60 * 60 * 1000));
  stats.last_2_days_requests = stats._requests.length;

  writeJSON(statsPath, stats);
}
// ---------------------------

module.exports = async (req, res) => {
  try {
    const { email, otp } = req.query;

    if (!email || !otp) {
      updateStats('error');
      return res.status(400).json({ success: false, message: "Email and OTP are required" });
    }

    const db = readJSON(dbPath, {});
    const record = db[email];

    // Wrong OTP or no request found
    if (!record || record.otp !== otp) {
      updateStats('error');
      return res.status(200).json({
        success: false,
        verified: false,
        message: "Invalid OTP"
      });
    }

    // Check expiration
    if (Date.now() > record.expiresAt) {
      delete db[email];
      writeJSON(dbPath, db);
      updateStats('expired', email);
      return res.status(200).json({
        success: false,
        message: "OTP expired"
      });
    }

    // Success Match
    delete db[email]; // Delete active OTP after verified
    writeJSON(dbPath, db);
    updateStats('verified', email);

    res.status(200).json({
      success: true,
      verified: true,
      message: "OTP verified successfully",
      developer: "https://t.me/username_506"
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
  }
};
