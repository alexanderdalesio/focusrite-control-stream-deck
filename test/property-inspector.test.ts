import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(
	new URL("../com.alexanderdalesio.focusrite-control.sdPlugin/ui/common.js", import.meta.url),
	"utf8",
);

test("property inspector routes action messages through its callback UUID", () => {
	const context = vm.createContext({ URL, window: {} });
	vm.runInContext(source, context);
	vm.runInContext('actionId = "com.example.action"; actionContext = "action-instance-uuid";', context);
	const message = JSON.parse(
		vm.runInContext('JSON.stringify(actionMessage("sendToPlugin", { type: "inspectConnection" }))', context),
	);

	assert.deepEqual(message, {
		event: "sendToPlugin",
		action: "com.example.action",
		context: "action-instance-uuid",
		payload: { type: "inspectConnection" },
	});
	assert.match(source, /actionContext = propertyInspectorUUID;/);
});
