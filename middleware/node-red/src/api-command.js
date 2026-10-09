// POST /api/command -> forward the request body to the state engine,
// which validates it, publishes the MQTT downlink and answers the HTTP request.
const body = msg.payload;
msg.payload = body !== null && typeof body === 'object' && !Array.isArray(body) ? body : {};
msg.topic = 'internal/command';
return msg;
