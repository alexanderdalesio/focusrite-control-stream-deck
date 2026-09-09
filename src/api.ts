import { type ConnectionSettings, type FocusriteConnection, resolveConnection } from "./connections.js";

export type ControlValue = boolean | number | string;

export type ApiSettings = ConnectionSettings;

export type ControlDefinition = {
	kind: string;
	label?: string;
	minimum?: number;
	maximum?: number;
	values?: string[];
};

type ApiResponse = {
	ok: boolean;
	error?: string;
	[key: string]: unknown;
};

type TimedValue<T> = {
	expires: number;
	promise: Promise<T>;
};

const healthCache = new Map<string, TimedValue<{ backend: "fc2" | "usb"; connected: boolean }>>();
const stateCache = new Map<string, TimedValue<Record<string, ControlValue>>>();
const REFRESH_CACHE_MS = 1000;

function baseUrl(connection: FocusriteConnection): string {
	return connection.url.trim().replace(/\/$/, "");
}

async function request<T extends ApiResponse>(settings: ApiSettings, path: string, init?: RequestInit): Promise<T> {
	return requestConnection(await resolveConnection(settings), path, init);
}

async function requestConnection<T extends ApiResponse>(connection: FocusriteConnection, path: string, init?: RequestInit): Promise<T> {
	const headers = new Headers(init?.headers);
	if (connection.token) headers.set("Authorization", `Bearer ${connection.token}`);
	const response = await fetch(`${baseUrl(connection)}${path}`, {
		...init,
		headers,
		signal: AbortSignal.timeout(5000),
	});
	const body = await response.json() as T;
	if (!response.ok || !body.ok) {
		throw new Error(body.error || `Focusrite API request failed (${response.status}).`);
	}
	return body;
}

function json(body: unknown): RequestInit {
	return {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	};
}

function cached<T>(cache: Map<string, TimedValue<T>>, key: string, load: () => Promise<T>): Promise<T> {
	const current = cache.get(key);
	if (current && current.expires > Date.now()) return current.promise;
	const promise = load().catch((error) => {
		cache.delete(key);
		throw error;
	});
	cache.set(key, { expires: Date.now() + REFRESH_CACHE_MS, promise });
	return promise;
}

async function cacheKey(settings: ApiSettings): Promise<string> {
	const connection = await resolveConnection(settings);
	return `${baseUrl(connection)}|${connection.id}`;
}

async function invalidate(settings: ApiSettings): Promise<void> {
	const key = await cacheKey(settings);
	healthCache.delete(key);
	stateCache.delete(key);
}

export const focusriteApi = {
	async health(settings: ApiSettings): Promise<{ backend: "fc2" | "usb"; connected: boolean }> {
		const result = await request<ApiResponse & { backend: "fc2" | "usb"; connected: boolean }>(settings, "/api/v1/health");
		return { backend: result.backend, connected: result.connected };
	},

	healthCached(settings: ApiSettings): Promise<{ backend: "fc2" | "usb"; connected: boolean }> {
		return cacheKey(settings).then((key) => cached(healthCache, key, () => this.health(settings)));
	},

	async state(settings: ApiSettings): Promise<Record<string, ControlValue>> {
		const result = await request<ApiResponse & { values: Record<string, ControlValue> }>(settings, "/api/v1/state");
		return result.values;
	},

	stateCached(settings: ApiSettings): Promise<Record<string, ControlValue>> {
		return cacheKey(settings).then((key) => cached(stateCache, key, () => this.state(settings)));
	},

	async get(settings: ApiSettings, control: string): Promise<ControlValue> {
		const result = await request<ApiResponse & { value: ControlValue }>(settings, `/api/v1/control/${encodeURIComponent(control)}/get`);
		return result.value;
	},

	async getCached(settings: ApiSettings, control: string): Promise<ControlValue> {
		const values = await this.stateCached(settings);
		if (!(control in values)) throw new Error(`Control is unavailable: ${control}`);
		return values[control];
	},

	async toggle(settings: ApiSettings, control: string): Promise<ControlValue> {
		await invalidate(settings);
		const result = await request<ApiResponse & { value: ControlValue }>(settings, `/api/v1/control/${encodeURIComponent(control)}/toggle`);
		return result.value;
	},

	async set(settings: ApiSettings, control: string, value: ControlValue): Promise<ControlValue> {
		await invalidate(settings);
		const result = await request<ApiResponse & { value: ControlValue }>(settings, `/api/v1/control/${encodeURIComponent(control)}/set`, json({ value }));
		return result.value;
	},

	async batch(settings: ApiSettings, operations: Array<{ control: string; value?: ControlValue; action?: "toggle" }>): Promise<void> {
		await invalidate(settings);
		await request(settings, "/api/v1/batch", json({ operations }));
	},

	async switchBackend(settings: ApiSettings, backend: "fc2" | "usb"): Promise<void> {
		await invalidate(settings);
		await request(settings, "/api/v1/backend", json({ backend }));
	},

	async reconnect(settings: ApiSettings): Promise<void> {
		await invalidate(settings);
		await request(settings, "/api/v1/reconnect", json({}));
	},

	async dashboardUrl(settings: ApiSettings): Promise<string> {
		const connection = await resolveConnection(settings);
		const url = new URL(baseUrl(connection));
		if (connection.token) url.searchParams.set("access_token", connection.token);
		return url.toString();
	},

	async inspect(connection: FocusriteConnection): Promise<{
		backend: "fc2" | "usb";
		connected: boolean;
		deviceName: string;
		controls: Record<string, ControlDefinition>;
	}> {
		const [health, device, definitions] = await Promise.all([
			requestConnection<ApiResponse & { backend: "fc2" | "usb"; connected: boolean }>(connection, "/api/v1/health"),
			requestConnection<ApiResponse & { device?: { productName?: string } }>(connection, "/api/v1/device"),
			requestConnection<ApiResponse & { controls: Record<string, ControlDefinition> }>(connection, "/api/v1/controls"),
		]);
		return {
			backend: health.backend,
			connected: health.connected,
			deviceName: device.device?.productName || "Focusrite interface",
			controls: definitions.controls,
		};
	},
};
