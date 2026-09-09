import assert from "node:assert/strict";
import test from "node:test";

import { controlValueEnabled, focusriteApi } from "../src/api.ts";

test("toggle state parsing handles boolean, numeric, and named states", () => {
	for (const value of [false, 0, "off", "false", "disabled", "line"]) assert.equal(controlValueEnabled(value), false);
	for (const value of [true, 1, "on", "true", "enabled", "instrument", "inst"]) assert.equal(controlValueEnabled(value), true);
	assert.throws(() => controlValueEnabled("unexpected"), /Cannot interpret/);
});

test("control and batch requests use the configured local API", async () => {
	const requests: Array<{ url: string; init?: RequestInit }> = [];
	const originalFetch = globalThis.fetch;
	globalThis.fetch = async (input, init) => {
		requests.push({ url: String(input), init });
		const url = String(input);
		if (url.endsWith("/get")) return Response.json({ ok: true, value: -24 });
		if (url.endsWith("/set")) return Response.json({ ok: true, value: -18 });
		return Response.json({ ok: true });
	};

	try {
		assert.equal(await focusriteApi.get({}, "monitor-gain"), -24);
		assert.equal(await focusriteApi.set({}, "monitor-gain", -18), -18);
		await focusriteApi.batch({ apiUrl: "http://localhost:5000/" }, [{ control: "dim", value: true }]);

		assert.equal(requests[0].url, "http://127.0.0.1:41780/api/v1/control/monitor-gain/get");
		assert.equal(requests[1].init?.method, "POST");
		assert.equal(requests[2].url, "http://localhost:5000/api/v1/batch");
		assert.deepEqual(JSON.parse(String(requests[2].init?.body)), { operations: [{ control: "dim", value: true }] });
	} finally {
		globalThis.fetch = originalFetch;
	}
});

test("API errors preserve the service message", async () => {
	const originalFetch = globalThis.fetch;
	globalThis.fetch = async () => Response.json({ ok: false, error: "No interface connected." }, { status: 503 });
	try {
		await assert.rejects(focusriteApi.reconnect({}), /No interface connected/);
	} finally {
		globalThis.fetch = originalFetch;
	}
});

test("invalid HTTP responses identify a wrong API URL", async () => {
	const originalFetch = globalThis.fetch;
	globalThis.fetch = async () => new Response("<html>Not the API</html>", { status: 200 });
	try {
		await assert.rejects(focusriteApi.health({ apiUrl: "http://wrong-service.test" }), /points to a Focusrite Control API/);
	} finally {
		globalThis.fetch = originalFetch;
	}
});

test("selects the backend-specific control name from live state", async () => {
	const originalFetch = globalThis.fetch;
	globalThis.fetch = async () => Response.json({
		ok: true,
		values: { "input1-phantom-power": false, "input1-instrument": false },
	});
	try {
		const settings = { apiUrl: "http://control-selection.test" };
		assert.equal(
			await focusriteApi.findAvailableControl(settings, ["input1-phantom", "input1-phantom-power"]),
			"input1-phantom-power",
		);
		assert.equal(await focusriteApi.findAvailableControl(settings, ["input1-instrument"]), "input1-instrument");
	} finally {
		globalThis.fetch = originalFetch;
	}
});

test("connection inspection authenticates network requests", async () => {
	const originalFetch = globalThis.fetch;
	const requests: RequestInit[] = [];
	globalThis.fetch = async (input, init) => {
		requests.push(init ?? {});
		const path = new URL(String(input)).pathname;
		if (path.endsWith("/health")) return Response.json({ ok: true, backend: "usb", connected: true });
		if (path.endsWith("/device")) return Response.json({ ok: true, device: { productName: "Studio Scarlett" } });
		return Response.json({ ok: true, controls: { dim: { kind: "boolean", label: "Dim" } } });
	};
	try {
		const result = await focusriteApi.inspect({ id: "studio", name: "Studio", url: "http://192.168.1.10:41780", token: "secret" });
		assert.equal(result.deviceName, "Studio Scarlett");
		assert.equal(result.controls.dim.kind, "boolean");
		for (const request of requests) assert.equal(new Headers(request.headers).get("Authorization"), "Bearer secret");
	} finally {
		globalThis.fetch = originalFetch;
	}
});
