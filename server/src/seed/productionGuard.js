// Seed scripts create accounts with the public seed password and fake data, so they refuse
// to run with NODE_ENV=production unless --allow-production is passed on purpose.
function refuseInProduction(what) {
  if (process.env.NODE_ENV !== "production" || process.argv.includes("--allow-production")) return;
  console.error(`Refusing to ${what}: NODE_ENV=production. Re-run with --allow-production only if you really mean it.`);
  process.exit(1);
}

module.exports = { refuseInProduction };
