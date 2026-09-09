import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import test from "node:test";
import { WebSocketServer } from "ws";

test("installed plugin answers a property-inspector connection request", async (t) => {
	const api = createServer((request, response) => {
		response.setHeader("Content-Type", "application/json");
		if (request.url === "/api/v1/health") response.end(JSON.stringify({ ok: true, backend: "usb", connected: true }));
		else if (request.url === "/api/v1/device") response.end(JSON.stringify({ ok: true, device: { productName: "Test Scarlett" } }));
		else if (request.url === "/api/v1/controls") response.end(JSON.stringify({ ok: true, controls: { dim: { kind: "boolean", label: "Dim" } } }));
		else response.end(JSON.stringify({ ok: false, error: "Not found" }));
	});
	await new Promise<void>((resolve) => api.listen(0, "127.0.0.1", resolve));
	t.after(() => api.close());
	const apiAddress = api.address();
	assert(apiAddress && typeof apiAddress === "object");

	const streamDeck = new WebSocketServer({ port: 0, host: "127.0.0.1" });
	await new Promise<void>((resolve) => streamDeck.once("listening", resolve));
	t.after(() => streamDeck.close());
	const socketAddress = streamDeck.address();
	assert(socketAddress && typeof socketAddress === "object");

	const info = JSON.stringify({
		application: { font: "Arial", language: "en", platform: "windows", platformVersion: "11", version: "6.9.1" },
		colors: {},
		devicePixelRatio: 1,
		devices: [{ id: "device-1", name: "Stream Deck", size: { columns: 5, rows: 3 }, type: 0 }],
		plugin: { uuid: "com.alexanderdalesio.focusrite-control", version: "1.1.3.0" },
	});
	const plugin = spawn(process.execPath, [
		"bin/plugin.js",
		"-port", String(socketAddress.port),
		"-pluginUUID", "com.alexanderdalesio.focusrite-control",
		"-registerEvent", "registerPlugin",
		"-info", info,
	], {
		cwd: new URL("../com.alexanderdalesio.focusrite-control.sdPlugin", import.meta.url),
		stdio: ["ignore", "pipe", "pipe"],
	});
	t.after(() => plugin.kill());
	let pluginOutput = "";
	let hostOutput = "";
	plugin.stdout.on("data", (chunk) => { pluginOutput += chunk.toString(); });
	plugin.stderr.on("data", (chunk) => { pluginOutput += chunk.toString(); });

	const response = await new Promise<Record<string, unknown>>((resolve, reject) => {
		const timeout = setTimeout(() => reject(new Error("Plugin round-trip timed out.")), 5000);
		plugin.once("exit", (code, signal) => reject(new Error(`Plugin exited with code ${code}, signal ${signal}. Host received: ${hostOutput}. ${pluginOutput}`.trim())));
		streamDeck.once("connection", (socket) => {
			socket.on("message", (data) => {
				const message = JSON.parse(data.toString());
				hostOutput += `${JSON.stringify(message)}\n`;
				if (message.event === "registerPlugin") {
					socket.send(JSON.stringify({
						event: "willAppear",
						action: "com.alexanderdalesio.focusrite-control.dim",
						context: "action-instance-1",
						device: "device-1",
						payload: { controller: "Keypad", coordinates: { column: 0, row: 0 }, isInMultiAction: false, settings: {}, state: 0 },
					}));
					socket.send(JSON.stringify({
						event: "propertyInspectorDidAppear",
						action: "com.alexanderdalesio.focusrite-control.dim",
						context: "action-instance-1",
						device: "device-1",
					}));
					socket.send(JSON.stringify({
						event: "sendToPlugin",
						action: "com.alexanderdalesio.focusrite-control.dim",
						context: "action-instance-1",
						payload: {
							type: "inspectConnection",
							requestId: "request-1",
							connection: { id: "test", name: "Test", url: `http://127.0.0.1:${apiAddress.port}` },
						},
					}));
				} else if (message.event === "sendToPropertyInspector") {
					clearTimeout(timeout);
					resolve(message);
				}
			});
		});
	});

	assert.equal(response.context, "action-instance-1");
	assert.deepEqual(response.payload, {
		type: "connectionResult",
		requestId: "request-1",
		ok: true,
		backend: "usb",
		connected: true,
		deviceName: "Test Scarlett",
		controls: { dim: { kind: "boolean", label: "Dim" } },
	});
});
