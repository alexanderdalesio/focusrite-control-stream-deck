let socket;
let inspectorId;
let actionId;
let actionContext;
let actionSettings = {};
let globalSettings = {};
let connectionDetails = null;
let pendingConnection = null;

function sendGlobal(event, payload) {
  const message = { event, context: inspectorId };
  if (payload !== undefined) message.payload = payload;
  socket.send(JSON.stringify(message));
}

function actionMessage(event, payload) {
  return { event, action: actionId, context: actionContext, payload };
}

function sendAction(event, payload) {
  socket.send(JSON.stringify(actionMessage(event, payload)));
}

function setActionSettings(update) {
  actionSettings = { ...actionSettings, ...update };
  sendAction('setSettings', actionSettings);
}

function normalizeUrl(value) {
  const parsed = new URL(value.trim());
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Use an http:// or https:// API URL.');
  return parsed.toString().replace(/\/$/, '');
}

function selectedConnection() {
  const connections = globalSettings.connections || [];
  return connections.find(({ id }) => id === actionSettings.connectionId)
    || connections.find(({ id }) => id === globalSettings.defaultConnectionId)
    || connections[0];
}

function option(value, label) {
  const element = document.createElement('option');
  element.value = value;
  element.textContent = label;
  return element;
}

function fillSelect(select, entries, fallbackLabel = 'Unavailable') {
  const current = actionSettings[select.dataset.setting] || select.dataset.default || '';
  select.replaceChildren();
  if (!entries.length) select.append(option(current, fallbackLabel));
  else for (const [value, label] of entries) select.append(option(value, label));
  select.value = current;
  if (!select.value && entries[0]) {
    select.value = entries[0][0];
    setActionSettings({ [select.dataset.setting]: select.value });
  }
}

function populateAvailableControls() {
  const controls = connectionDetails?.controls || {};
  const definitions = Object.entries(controls);

  for (const select of document.querySelectorAll('[data-control-kind]')) {
    const kind = select.dataset.controlKind;
    const entries = definitions
      .filter(([, definition]) => kind === 'any' || definition.kind === kind)
      .map(([name, definition]) => [name, definition.label ? `${definition.label} (${name})` : name]);
    fillSelect(select, entries, 'No matching controls');
  }

  for (const select of document.querySelectorAll('[data-input-feature]')) {
    const expression = new RegExp(`^input(\\d+)-${select.dataset.inputFeature}$`);
    const entries = definitions.flatMap(([name]) => {
      const match = expression.exec(name);
      return match ? [[match[1], `Input ${match[1]}`]] : [];
    });
    fillSelect(select, [...new Map(entries).entries()], 'No compatible inputs');
  }

  for (const select of document.querySelectorAll('[data-headphone-feature]')) {
    const expression = new RegExp(`^headphone-(\\d+)[lr]-${select.dataset.headphoneFeature}$`);
    const entries = definitions.flatMap(([name]) => {
      const match = expression.exec(name);
      return match ? [[match[1], `Headphone ${match[1]}`]] : [];
    });
    fillSelect(select, [...new Map(entries).entries()], 'No headphone outputs');
  }
}

function showConnectionStatus(message, state = '') {
  for (const status of document.querySelectorAll('.connection-status')) {
    status.textContent = message;
    status.dataset.state = state;
  }
}

function beginConnectionRequest(connection, saving) {
  if (pendingConnection?.timeout) clearTimeout(pendingConnection.timeout);
  const requestId = `${Date.now()}-${Math.random()}`;
  const timeout = setTimeout(() => {
    if (pendingConnection?.requestId !== requestId) return;
    pendingConnection = null;
    document.querySelector('#save-api').disabled = false;
    showConnectionStatus('No reply from the plugin. Restart Stream Deck, then try again.', 'error');
  }, 8000);
  pendingConnection = { requestId, connection, saving, timeout };
  sendAction('sendToPlugin', { type: 'inspectConnection', requestId, connection });
}

function inspectConnection(connection) {
  if (!connection) {
    connectionDetails = null;
    populateAvailableControls();
    return;
  }
  showConnectionStatus(`Connecting to ${connection.name}…`);
  beginConnectionRequest(connection, false);
}

function renderConnections() {
  const connections = globalSettings.connections || [];
  const select = document.querySelector('#api-connection');
  select.replaceChildren();
  if (!connections.length) select.append(option('', 'No API connected'));
  for (const connection of connections) {
    select.append(option(connection.id, connection.deviceName ? `${connection.name} · ${connection.deviceName}` : connection.name));
  }

  const selected = selectedConnection();
  if (selected) {
    if (!actionSettings.connectionId) setActionSettings({ connectionId: selected.id });
    select.value = selected.id;
  }
  document.querySelector('#remove-api').disabled = !selected;
  if (!connections.length) openConnectionDialog(true);
  else inspectConnection(selected);
}

function openConnectionDialog(required = false) {
  const dialog = document.querySelector('#connection-dialog');
  dialog.hidden = false;
  dialog.dataset.required = required ? 'true' : 'false';
  document.querySelector('#api-name').focus();
}

function closeConnectionDialog() {
  if (pendingConnection?.timeout) clearTimeout(pendingConnection.timeout);
  pendingConnection = null;
  document.querySelector('#save-api').disabled = false;
  document.querySelector('#connection-dialog').hidden = true;
}

function saveConnection() {
  try {
    const name = document.querySelector('#api-name').value.trim();
    if (!name) throw new Error('Give this connection a name.');
    const connection = {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      name,
      url: normalizeUrl(document.querySelector('#api-url').value),
      token: document.querySelector('#api-token').value.trim() || undefined,
    };
    showConnectionStatus(`Testing ${name}…`);
    document.querySelector('#save-api').disabled = true;
    beginConnectionRequest(connection, true);
  } catch (error) {
    showConnectionStatus(error.message, 'error');
  }
}

function receiveConnectionResult(payload) {
  if (!pendingConnection || payload.requestId !== pendingConnection.requestId) return;
  clearTimeout(pendingConnection.timeout);
  document.querySelector('#save-api').disabled = false;
  if (!payload.ok) {
    showConnectionStatus(payload.error || 'Connection failed.', 'error');
    pendingConnection = null;
    return;
  }

  connectionDetails = payload;
  if (pendingConnection.saving) {
    const connection = { ...pendingConnection.connection, deviceName: payload.deviceName };
    const connections = [...(globalSettings.connections || []), connection];
    globalSettings = {
      ...globalSettings,
      connections,
      defaultConnectionId: globalSettings.defaultConnectionId || connection.id,
    };
    sendGlobal('setGlobalSettings', globalSettings);
    setActionSettings({ connectionId: connection.id, apiUrl: undefined });
    document.querySelector('#connection-dialog').hidden = true;
    document.querySelector('#api-name').value = '';
    document.querySelector('#api-token').value = '';
    pendingConnection = null;
    renderConnections();
    return;
  } else {
    showConnectionStatus(`${payload.deviceName} · ${payload.backend.toUpperCase()} · ${payload.connected ? 'ready' : 'API reachable, device offline'}`, payload.connected ? 'ok' : 'warning');
    populateAvailableControls();
  }
  pendingConnection = null;
}

function bindActionFields() {
  for (const field of document.querySelectorAll('[data-setting]')) {
    const key = field.dataset.setting;
    const stored = actionSettings[key];
    if (stored !== undefined) field.value = stored;
    else if (field.dataset.default !== undefined) field.value = field.dataset.default;
    field.addEventListener('change', () => setActionSettings({ [key]: field.value }));
  }
}

function buildConnectionPanel() {
  const container = document.createElement('section');
  container.className = 'connection-panel';
  container.innerHTML = `
    <label class="field"><span>API selected</span><select id="api-connection"></select></label>
    <div class="button-row"><button id="add-api" type="button">Add API</button><button id="remove-api" class="quiet" type="button">Remove</button></div>
    <p id="connection-status" class="status connection-status" aria-live="polite"></p>
    <div id="connection-dialog" class="dialog" hidden>
      <div class="dialog-card">
        <h2>Connect a Focusrite API</h2>
        <p>Name the computer or interface so it is easy to recognize on every button.</p>
        <label class="field"><span>Connection name</span><input id="api-name" placeholder="Studio Scarlett"></label>
        <label class="field"><span>API URL</span><input id="api-url" value="http://127.0.0.1:41780" spellcheck="false"></label>
        <label class="field"><span>Access token</span><input id="api-token" type="password" placeholder="Required for network access"></label>
        <p class="status connection-status" aria-live="polite"></p>
        <div class="button-row"><button id="save-api" type="button">Test and save</button><button id="cancel-api" class="quiet" type="button">Cancel</button></div>
      </div>
    </div>`;
  document.body.prepend(container);

  document.querySelector('#api-connection').addEventListener('change', (event) => {
    setActionSettings({ connectionId: event.target.value });
    inspectConnection(selectedConnection());
  });
  document.querySelector('#add-api').addEventListener('click', () => openConnectionDialog(false));
  document.querySelector('#cancel-api').addEventListener('click', closeConnectionDialog);
  document.querySelector('#save-api').addEventListener('click', saveConnection);
  document.querySelector('#remove-api').addEventListener('click', () => {
    const selected = selectedConnection();
    if (!selected || !confirm(`Remove “${selected.name}”?`)) return;
    const connections = (globalSettings.connections || []).filter(({ id }) => id !== selected.id);
    globalSettings = { ...globalSettings, connections, defaultConnectionId: connections[0]?.id };
    sendGlobal('setGlobalSettings', globalSettings);
    setActionSettings({ connectionId: connections[0]?.id });
    renderConnections();
  });
}

window.connectElgatoStreamDeckSocket = function (port, propertyInspectorUUID, registerEvent, _info, rawActionInfo) {
  inspectorId = propertyInspectorUUID;
  const actionInfo = JSON.parse(rawActionInfo);
  actionId = actionInfo.action;
  actionContext = propertyInspectorUUID;
  actionSettings = actionInfo.payload.settings || {};
  buildConnectionPanel();
  bindActionFields();

  socket = new WebSocket(`ws://127.0.0.1:${port}`);
  socket.addEventListener('open', () => {
    socket.send(JSON.stringify({ event: registerEvent, uuid: inspectorId }));
    sendGlobal('getGlobalSettings');
  });
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.event === 'didReceiveGlobalSettings') {
      globalSettings = message.payload.settings || {};
      renderConnections();
    } else if (message.event === 'sendToPropertyInspector') {
      receiveConnectionResult(message.payload);
    }
  });
};
