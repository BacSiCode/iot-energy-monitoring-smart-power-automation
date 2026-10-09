// GET /api/state -> full middleware state for the dashboard.
const s = flow.get('iot55') || { online: false, systemState: 'OFFLINE', events: [], history: [] };
msg.headers = { 'content-type': 'application/json', 'cache-control': 'no-store' };
msg.payload = s;
return msg;
