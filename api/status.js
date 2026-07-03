const fs = require('fs');
const path = require('path');

// --- File System Helpers ---
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
// ---------------------------

module.exports = async (req, res) => {
  try {
    const stats = readJSON(statsPath, defaultStats);
    
    // Update simple request metric
    const now = Date.now();
    stats.total_requests += 1;
    if (!stats._requests) stats._requests = [];
    stats._requests.push(now);
    stats._requests = stats._requests.filter(time => time > now - (48 * 60 * 60 * 1000));
    stats.last_2_days_requests = stats._requests.length;

    writeJSON(statsPath, stats);

    // Return clean JSON (Exclude internal mapping variables)
    const { _users, _requests, ...cleanStats } = stats;

    res.status(200).json(cleanStats);

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
