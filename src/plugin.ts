import streamDeck from "@elgato/streamdeck";

import { focusriteApi } from "./api";
import type { FocusriteConnection } from "./connections.js";

import {
	AdjustControlAction,
	AirAction,
	BackendAction,
	BatchAction,
	DashboardAction,
	DimAction,
	GenericToggleAction,
	Headphone1LevelAction,
	Headphone1MuteAction,
	Headphone2LevelAction,
	Headphone2MuteAction,
	InstrumentAction,
	MonitorMuteAction,
	PhantomAction,
	ReconnectAction,
	SetControlAction,
	StatusAction,
} from "./actions/control-actions";

streamDeck.logger.setLevel("info");

type InspectorRequest = {
	type?: string;
	requestId?: string;
	connection?: FocusriteConnection;
};

streamDeck.ui.onSendToPlugin<InspectorRequest>((event) => {
	if (event.payload.type !== "inspectConnection" || !event.payload.connection) return;
	void (async () => {
		try {
			const details = await focusriteApi.inspect(event.payload.connection!);
			await streamDeck.ui.sendToPropertyInspector({
				type: "connectionResult",
				requestId: event.payload.requestId,
				ok: true,
				...details,
			});
		} catch (error) {
			await streamDeck.ui.sendToPropertyInspector({
				type: "connectionResult",
				requestId: event.payload.requestId,
				ok: false,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	})();
});

const refreshableActions = [
	new DimAction(),
	new MonitorMuteAction(),
	new PhantomAction(),
	new InstrumentAction(),
	new Headphone1MuteAction(),
	new Headphone2MuteAction(),
	new GenericToggleAction(),
	new AirAction(),
	new AdjustControlAction(),
	new Headphone1LevelAction(),
	new Headphone2LevelAction(),
	new BackendAction(),
	new StatusAction(),
];

for (const action of refreshableActions) streamDeck.actions.registerAction(action);
streamDeck.actions.registerAction(new SetControlAction());
streamDeck.actions.registerAction(new BatchAction());
streamDeck.actions.registerAction(new ReconnectAction());
streamDeck.actions.registerAction(new DashboardAction());

setInterval(() => {
	for (const action of refreshableActions) void action.refreshVisible();
}, 2000).unref();

streamDeck.connect();
