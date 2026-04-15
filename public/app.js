const API_BASE = '/integrations/hubspot';

// ── State ────────────────────────────────────────────────
const state = {
    connected: false,
    userId: null,
    orgId: null,
};

// ── Utility: Debounce cross-fill ────────────────────────
function syncIds(sourceUserId, sourceOrgId) {
    const userId = document.getElementById(sourceUserId).value.trim();
    const orgId  = document.getElementById(sourceOrgId).value.trim();
    const targets = ['authUserId','authOrgId','verifyUserId','verifyOrgId','loadUserId','loadOrgId'];
    if (userId) ['verifyUserId','loadUserId'].forEach(id => {
        if (id !== sourceUserId) document.getElementById(id).value = userId;
    });
    if (orgId) ['verifyOrgId','loadOrgId'].forEach(id => {
        if (id !== sourceOrgId) document.getElementById(id).value = orgId;
    });
}

['authUserId','verifyUserId','loadUserId'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
        const pairMap = { authUserId:'authOrgId', verifyUserId:'verifyOrgId', loadUserId:'loadOrgId' };
        syncIds(id, pairMap[id]);
    });
});

// ── Toast Notifications ──────────────────────────────────
function showToast(message, type = 'info') {
    const icons = {
        success: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><polyline points="22 4 12 14.01 9 11.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
        error:   `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
        info:    `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span>${message}</span>`;
    document.getElementById('toastContainer').appendChild(toast);
    setTimeout(() => toast.remove(), 4200);
}

// ── Nav status update ────────────────────────────────────
function updateNavStatus(status) {
    const dot   = document.getElementById('statusDot');
    const label = document.getElementById('statusLabel');
    dot.className = `status-dot ${status}`;
    const labels = { connected: 'HubSpot Connected', disconnected: 'Disconnected', connecting: 'Connecting…' };
    label.textContent = labels[status] || status;
}

// ── Flow diagram step completion ─────────────────────────
function completeFlowStep(step) {
    const el = document.getElementById(`flowStep${step}`);
    if (el) {
        el.classList.add('completed');
        el.classList.remove('flow-step--active');
        const next = document.getElementById(`flowStep${step + 1}`);
        if (next) next.classList.add('flow-step--active');
    }
}

// ── Response area helper ─────────────────────────────────
function setResponse(elementId, content, type = 'info') {
    const el = document.getElementById(elementId);
    el.textContent = typeof content === 'object' ? JSON.stringify(content, null, 2) : content;
    el.className = `response-area ${type}`;
    el.style.display = 'block';
}

// ── Button state helpers ─────────────────────────────────
function setButtonLoading(btnId, loading) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = loading;
    if (loading) btn.classList.add('loading');
    else btn.classList.remove('loading');
}

// ============================================================
// HANDLER 1: POST /integrations/hubspot/authorize
// ============================================================
async function handleAuthorize() {
    const userId = document.getElementById('authUserId').value.trim();
    const orgId  = document.getElementById('authOrgId').value.trim();

    if (!userId || !orgId) {
        showToast('Please enter both User ID and Organization ID.', 'error');
        return;
    }

    setButtonLoading('authorizeBtn', true);
    updateNavStatus('connecting');
    setResponse('authResponse', 'Requesting authorization URL from server…', 'info');
    document.getElementById('authResponse').style.display = 'block';

    try {
        const res = await fetch(`${API_BASE}/authorize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, orgId }),
        });

        const data = await res.json();

        if (!res.ok) {
            setResponse('authResponse', `❌ Error ${res.status}: ${data.error || 'Unknown error'}`, 'error');
            updateNavStatus('disconnected');
            showToast('Authorization failed. Check server.', 'error');
            return;
        }

        // Show auth URL in response
        setResponse('authResponse', `✅ Auth URL generated successfully!\n\nOpening HubSpot authorization page in a popup window…\n\nURL: ${data.authUrl}`, 'success');

        // Save credentials for later use
        state.userId = userId;
        state.orgId  = orgId;

        // Auto-fill other forms
        ['verifyUserId','loadUserId'].forEach(id => document.getElementById(id).value = userId);
        ['verifyOrgId','loadOrgId'].forEach(id  => document.getElementById(id).value = orgId);

        // Complete step 1, enter step 2
        completeFlowStep(1);
        showToast('Auth URL generated! Authorize in the popup.', 'success');

        // Open the OAuth popup
        const popup = window.open(data.authUrl, 'hubspot_oauth', 'width=600,height=700,scrollbars=yes');

        // Poll for popup close
        const pollTimer = setInterval(async () => {
            if (popup && popup.closed) {
                clearInterval(pollTimer);
                
                // VERIFICATION STEP: Check if the token was actually saved in Redis
                try {
                    const checkRes = await fetch(`${API_BASE}/credentials`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId, orgId }),
                    });

                    if (checkRes.ok) {
                        // Token exists — the user completed the flow
                        completeFlowStep(2);
                        completeFlowStep(3);
                        state.connected = true;
                        updateNavStatus('connected');
                        showToast('OAuth complete! Token stored in Redis.', 'success');
                        setResponse('authResponse',
                            `✅ OAuth 2.0 Flow Complete!\n\nUser: ${userId}\nOrg:  ${orgId}\n\nAccess token has been exchanged and stored securely in Redis.\nYou can now verify credentials or load CRM contacts.`,
                            'success'
                        );
                        // Complete final step
                        setTimeout(() => completeFlowStep(4), 500);
                    } else {
                        // Token does NOT exist — the user closed the window prematurely
                        setResponse('authResponse', `❌ OAuth Flow Incomplete.\n\nThe authorization window was closed before the HubSpot connection could be completed.`, 'error');
                        showToast('Authorization cancelled.', 'error');
                        updateNavStatus('disconnected');
                    }
                } catch (err) {
                    setResponse('authResponse', `❌ Verification Error: ${err.message}`, 'error');
                    updateNavStatus('disconnected');
                }
            }
        }, 800);

    } catch (err) {
        setResponse('authResponse', `❌ Network Error: ${err.message}\n\nMake sure the backend server is running on port 8000.`, 'error');
        updateNavStatus('disconnected');
        showToast('Cannot reach server. Is it running?', 'error');
    } finally {
        setButtonLoading('authorizeBtn', false);
    }
}

// ============================================================
// HANDLER 2: POST /integrations/hubspot/credentials
// ============================================================
async function handleVerify() {
    const userId = document.getElementById('verifyUserId').value.trim();
    const orgId  = document.getElementById('verifyOrgId').value.trim();

    if (!userId || !orgId) {
        showToast('Please enter both User ID and Organization ID.', 'error');
        return;
    }

    setButtonLoading('verifyBtn', true);
    setResponse('verifyResponse', 'Checking credentials in Redis…', 'info');

    try {
        const res = await fetch(`${API_BASE}/credentials`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, orgId }),
        });

        const data = await res.json();

        if (!res.ok) {
            setResponse('verifyResponse', `❌ Error ${res.status}: ${data.error || 'Credentials not found'}\n\nComplete the OAuth flow first.`, 'error');
            showToast('No credentials found. Complete OAuth first.', 'error');
            updateNavStatus('disconnected');
        } else {
            setResponse('verifyResponse', `✅ Credentials Verified!\n\nResponse: ${JSON.stringify(data, null, 2)}\n\nUser: ${userId}\nOrg:  ${orgId}\n\nAccess token found in Redis — connection is active.`, 'success');
            showToast('Credentials verified successfully!', 'success');
            state.connected = true;
            updateNavStatus('connected');
        }

    } catch (err) {
        setResponse('verifyResponse', `❌ Network Error: ${err.message}\n\nMake sure the backend server is running on port 8000.`, 'error');
        showToast('Cannot reach server. Is it running?', 'error');
    } finally {
        setButtonLoading('verifyBtn', false);
    }
}

// ============================================================
// HANDLER 3: POST /integrations/hubspot/load
// ============================================================
async function handleLoadContacts() {
    const userId = document.getElementById('loadUserId').value.trim();
    const orgId  = document.getElementById('loadOrgId').value.trim();

    if (!userId || !orgId) {
        showToast('Please enter both User ID and Organization ID.', 'error');
        return;
    }

    // Show loading
    document.getElementById('emptyState').style.display    = 'none';
    document.getElementById('contactsGrid').style.display   = 'none';
    document.getElementById('errorState').style.display     = 'none';
    document.getElementById('loadingContainer').style.display = 'flex';
    setButtonLoading('loadBtn', true);

    try {
        const res = await fetch(`${API_BASE}/load`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, orgId }),
        });

        const data = await res.json();
        document.getElementById('loadingContainer').style.display = 'none';

        if (!res.ok) {
            document.getElementById('errorState').style.display = 'flex';
            document.getElementById('errorMessage').textContent =
                data.error || `HTTP ${res.status} — Complete OAuth authorization first.`;
            showToast('Failed to load contacts.', 'error');
            return;
        }

        const contacts = data.results || [];

        if (contacts.length === 0) {
            document.getElementById('emptyState').style.display = 'flex';
            showToast('No contacts found in HubSpot.', 'info');
            return;
        }

        renderContacts(contacts);
        showToast(`Loaded ${contacts.length} contacts from HubSpot!`, 'success');
        completeFlowStep(4);

    } catch (err) {
        document.getElementById('loadingContainer').style.display = 'none';
        document.getElementById('errorState').style.display = 'flex';
        document.getElementById('errorMessage').textContent =
            `Network Error: ${err.message}. Make sure the backend is running on port 8000.`;
        showToast('Cannot reach server. Is it running?', 'error');
    } finally {
        setButtonLoading('loadBtn', false);
    }
}

function renderContacts(contacts) {
    const grid = document.getElementById('contactsGrid');
    grid.innerHTML = '';

    contacts.forEach((contact, i) => {
        const props    = contact.properties || {};
        const first    = props.firstname || '';
        const last     = props.lastname  || '';
        const email    = props.email     || 'No email';
        const fullName = (first + ' ' + last).trim() || 'Unknown Contact';
        const initials = (first[0] || '') + (last[0] || '') || '?';

        const card = document.createElement('div');
        card.className = 'contact-card';
        card.style.animationDelay = `${i * 60}ms`;
        card.innerHTML = `
            <div class="contact-avatar">${initials.toUpperCase()}</div>
            <div class="contact-info">
                <div class="contact-name">${escHtml(fullName)}</div>
                <div class="contact-email">${escHtml(email)}</div>
                <span class="contact-id">ID: ${escHtml(contact.id || 'N/A')}</span>
            </div>
        `;
        grid.appendChild(card);
    });

    grid.style.display = 'grid';
}

function escHtml(str) {
    return String(str)
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;');
}

// ============================================================
// API EXPLORER
// ============================================================
const endpointData = {
    authorize: {
        method: 'POST',
        path: '/integrations/hubspot/authorize',
        description: 'Initiates the OAuth 2.0 authorization flow with HubSpot. Stores the state (userId + orgId) in Redis and returns a redirect URL to open in the user\'s browser. The user authenticates with HubSpot and grants CRM access.',
        params: [
            { name: 'userId', type: 'string', required: true,  desc: 'Unique identifier for the user initiating the OAuth flow.' },
            { name: 'orgId',  type: 'string', required: true,  desc: 'Organization/workspace ID to scope the integration.' },
        ],
        requestBody: `{
  <span class="code-key">"userId"</span><span class="code-punct">:</span> <span class="code-str">"user_001"</span><span class="code-punct">,</span>
  <span class="code-key">"orgId"</span><span class="code-punct">:</span>  <span class="code-str">"org_acme"</span>
}`,
        responseBody: `{
  <span class="code-key">"authUrl"</span><span class="code-punct">:</span> <span class="code-str">"https://app-na2.hubspot.com/oauth/authorize?client_id=...&amp;redirect_uri=...&amp;scope=oauth+crm.objects.contacts.read&amp;state=..."</span>
}`,
        errorBody: `{
  <span class="code-key">"error"</span><span class="code-punct">:</span> <span class="code-str">"Internal server error!"</span>
}`,
    },
    callback: {
        method: 'GET',
        path: '/integrations/hubspot/oauth2callback',
        description: 'OAuth 2.0 redirect callback handled automatically by HubSpot. Validates the returned state against Redis, exchanges the authorization code for an access token using the HubSpot token endpoint, and stores the access token in Redis. Closes the popup window on success.',
        params: [
            { name: 'code',  type: 'string (query)', required: true,  desc: 'Authorization code returned by HubSpot after user grants access.' },
            { name: 'state', type: 'string (query)', required: true,  desc: 'JSON-encoded state { userId, orgId } for CSRF verification.' },
        ],
        requestBody: `<span class="code-comment">// This is a redirect endpoint — called automatically by HubSpot.</span>
<span class="code-comment">// Query params are appended by HubSpot:</span>

GET /integrations/hubspot/oauth2callback
  ?code=<span class="code-str">AQS...xyz</span>
  &amp;state=<span class="code-str">%7B%22userId%22%3A%22user_001%22%7D</span>`,
        responseBody: `<span class="code-comment">// On success — closes popup window:</span>
&lt;html&gt;
  &lt;body&gt;
    &lt;script&gt;window.close();&lt;/script&gt;
  &lt;/body&gt;
&lt;/html&gt;`,
        errorBody: `{
  <span class="code-key">"error"</span><span class="code-punct">:</span> <span class="code-str">"You are not an Authorized person!"</span>
}`,
    },
    credentials: {
        method: 'POST',
        path: '/integrations/hubspot/credentials',
        description: 'Verifies that a valid HubSpot access token exists in Redis for the given userId + orgId combination. Returns 200 on success or 401 if no token is found (OAuth not completed).',
        params: [
            { name: 'userId', type: 'string', required: true, desc: 'User identifier to look up token in Redis.' },
            { name: 'orgId',  type: 'string', required: true, desc: 'Organization identifier scoping the token lookup.' },
        ],
        requestBody: `{
  <span class="code-key">"userId"</span><span class="code-punct">:</span> <span class="code-str">"user_001"</span><span class="code-punct">,</span>
  <span class="code-key">"orgId"</span><span class="code-punct">:</span>  <span class="code-str">"org_acme"</span>
}`,
        responseBody: `{
  <span class="code-key">"message"</span><span class="code-punct">:</span> <span class="code-str">"Success!"</span>
}`,
        errorBody: `{
  <span class="code-key">"error"</span><span class="code-punct">:</span> <span class="code-str">"Internal Server Error!"</span>
}`,
    },
    load: {
        method: 'POST',
        path: '/integrations/hubspot/load',
        description: 'Retrieves HubSpot access token from Redis and fetches up to 10 non-archived contacts from the HubSpot CRM API (v3). Returns contact properties: firstname, lastname, and email.',
        params: [
            { name: 'userId', type: 'string', required: true, desc: 'User identifier to retrieve the access token from Redis.' },
            { name: 'orgId',  type: 'string', required: true, desc: 'Organization identifier scoping the token lookup.' },
        ],
        requestBody: `{
  <span class="code-key">"userId"</span><span class="code-punct">:</span> <span class="code-str">"user_001"</span><span class="code-punct">,</span>
  <span class="code-key">"orgId"</span><span class="code-punct">:</span>  <span class="code-str">"org_acme"</span>
}`,
        responseBody: `{
  <span class="code-key">"results"</span><span class="code-punct">:</span> [
    {
      <span class="code-key">"id"</span><span class="code-punct">:</span>          <span class="code-str">"12345"</span><span class="code-punct">,</span>
      <span class="code-key">"properties"</span><span class="code-punct">:</span> {
        <span class="code-key">"firstname"</span><span class="code-punct">:</span> <span class="code-str">"John"</span><span class="code-punct">,</span>
        <span class="code-key">"lastname"</span><span class="code-punct">:</span>  <span class="code-str">"Doe"</span><span class="code-punct">,</span>
        <span class="code-key">"email"</span><span class="code-punct">:</span>     <span class="code-str">"john@example.com"</span>
      }
    }
    <span class="code-comment">// ... up to 10 contacts</span>
  ]
}`,
        errorBody: `{
  <span class="code-key">"error"</span><span class="code-punct">:</span> <span class="code-str">"Something went Wrong, Server Error!"</span>
}`,
    },
};

function showEndpoint(key) {
    // Update active sidebar item
    document.querySelectorAll('.api-endpoint').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`ep-${key}`).classList.add('active');

    const ep = endpointData[key];
    const methodClass = ep.method.toLowerCase();
    const paramsHtml = ep.params.map(p => `
        <tr>
            <td>${p.name}<span class="${p.required ? 'param-required' : 'param-optional'}">${p.required ? 'required' : 'optional'}</span></td>
            <td><code style="font-size:11px;color:var(--orange-500)">${p.type}</code></td>
            <td>${p.desc}</td>
        </tr>
    `).join('');

    document.getElementById('apiDetail').innerHTML = `
        <div class="api-detail-header">
            <span class="api-method-pill ${methodClass}">${ep.method}</span>
            <code class="api-path">${ep.path}</code>
        </div>

        <p class="api-desc">${ep.description}</p>

        <div class="api-section-title">Parameters</div>
        <table class="param-table">
            <thead><tr><th>Name</th><th>Type</th><th>Description</th></tr></thead>
            <tbody>${paramsHtml}</tbody>
        </table>

        <div class="api-section-title">Request Body / Input</div>
        <div class="code-block">${ep.requestBody}</div>

        <div class="api-section-title">Success Response (200)</div>
        <div class="code-block">${ep.responseBody}</div>

        <div class="api-section-title">Error Response (4xx / 5xx)</div>
        <div class="code-block">${ep.errorBody}</div>
    `;
}

// ── Background particles ─────────────────────────────────
function initParticles() {
    const container = document.getElementById('bgParticles');
    for (let i = 0; i < 25; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.cssText = `
            left: ${Math.random() * 100}%;
            animation-duration: ${8 + Math.random() * 14}s;
            animation-delay: ${Math.random() * 10}s;
            opacity: 0;
            background: ${Math.random() > 0.5 ? 'var(--purple-400)' : 'var(--cyan-500)'};
        `;
        container.appendChild(p);
    }
}

// ── Navbar scroll effect ─────────────────────────────────
window.addEventListener('scroll', () => {
    const navbar = document.getElementById('navbar');
    if (window.scrollY > 20) navbar.classList.add('scrolled');
    else navbar.classList.remove('scrolled');
});

// ── Smooth nav link active state ─────────────────────────
function initNavHighlight() {
    const sections = ['overview','connect','data','api-explorer'];
    const navMap = { 'overview':'nav-overview','connect':'nav-connect','data':'nav-data','api-explorer':'nav-api' };
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                const link = document.getElementById(navMap[entry.target.id]);
                if (link) link.classList.add('active');
            }
        });
    }, { threshold: 0.3, rootMargin: '-80px 0px 0px 0px' });

    sections.forEach(id => {
        const el = document.getElementById(id);
        if (el) observer.observe(el);
    });
}

// ── Init ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initParticles();
    initNavHighlight();
    showEndpoint('authorize'); // Default API explorer view

    // Hero connect button scrolls to connect section
    document.getElementById('heroConnectBtn').addEventListener('click', e => {
        e.preventDefault();
        document.getElementById('connect').scrollIntoView({ behavior: 'smooth' });
    });
});
