import streamDeck from "@elgato/streamdeck";

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
