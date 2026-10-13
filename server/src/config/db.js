const dns = require("dns");
const mongoose = require("mongoose");

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set. Copy server/.env.example to server/.env and fill it in.");
  }
  // Optional: DNS servers for Node's own resolver (comma-separated, e.g. "8.8.8.8,1.1.1.1").
  // Needed on networks whose DNS server Node can't use (e.g. an IPv6 link-local router
  // address on a phone hotspot), where the mongodb+srv:// lookup fails with
  // "querySrv ECONNREFUSED" even though the browser and Windows resolve fine.
  if (process.env.DNS_SERVERS) {
    dns.setServers(process.env.DNS_SERVERS.split(",").map((s) => s.trim()).filter(Boolean));
  }
  await mongoose.connect(uri);
  console.log("MongoDB connected:", mongoose.connection.name);
}

module.exports = connectDB;
