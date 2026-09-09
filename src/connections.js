import streamDeck from "@elgato/streamdeck";

let registry;

streamDeck.settings.onDidReceiveGlobalSettings((event) => {
	registry = event.settings;
});

async function getRegistry() {
	if (!registry) {
		try {
			registry = await streamDeck.settings.getGlobalSettings();
		} catch {
			registry = {};
		}
	}
	return registry;
}

export async function resolveConnection(settings) {
	if (settings.apiUrl?.trim()) {
		return { id: "legacy", name: "Legacy API", url: settings.apiUrl.trim() };
	}

	const current = await getRegistry();
	const connections = current.connections ?? [];
	const id = settings.connectionId || current.defaultConnectionId;
	const selected = connections.find((connection) => connection.id === id) ?? connections[0];
	if (selected) return selected;

	return { id: "local-default", name: "Local API", url: "http://127.0.0.1:41780" };
}
