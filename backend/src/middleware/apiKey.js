// Simple shared-secret auth for unattended automation callers (e.g. n8n cron
// workflows) that can't hold a short-lived user JWT. Not a replacement for
// requireAuth — only mount this on endpoints meant for machine-to-machine use.
export function requireApiKey(req, res, next) {
  const expected = process.env.AUTOMATION_API_KEY;
  if (!expected) {
    return res.status(500).json({ message: 'AUTOMATION_API_KEY is not configured on the server' });
  }
  const provided = req.headers['x-api-key'];
  if (provided !== expected) {
    return res.status(401).json({ message: 'Invalid or missing X-Api-Key header' });
  }
  next();
}
