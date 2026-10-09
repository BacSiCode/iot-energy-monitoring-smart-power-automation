// Node-RED settings for IoT 55. Secrets come from environment variables (.env),
// never from this file. See docs/security.md.
const settings = {
    flowFile: 'flows.json',
    flowFilePretty: true,
    userDir: '/data',
    uiPort: process.env.PORT || 1880,
    // Persist flow context (state machine, event log) across Node-RED restarts.
    contextStorage: {
        default: { module: 'localfilesystem' }
    },
    editorTheme: {
        projects: { enabled: false },
        tours: false
    },
    diagnostics: { enabled: false },
    telemetry: { enabled: false },
    logging: {
        console: { level: 'info', metrics: false, audit: false }
    }
};

// Encrypts flows_cred.json (MQTT credentials entered in the editor).
if (process.env.NODE_RED_CREDENTIAL_SECRET) {
    settings.credentialSecret = process.env.NODE_RED_CREDENTIAL_SECRET;
}

// Protect the editor when a bcrypt hash is provided:
//   docker compose run --rm nodered node-red admin hash-pw
if (process.env.NODE_RED_ADMIN_USER && process.env.NODE_RED_ADMIN_PASSWORD_HASH) {
    settings.adminAuth = {
        type: 'credentials',
        users: [{
            username: process.env.NODE_RED_ADMIN_USER,
            password: process.env.NODE_RED_ADMIN_PASSWORD_HASH,
            permissions: '*'
        }]
    };
}

module.exports = settings;
