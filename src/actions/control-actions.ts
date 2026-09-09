import streamDeck, {
	action,
	type Action,
	type DialRotateEvent,
	type DidReceiveSettingsEvent,
	type KeyDownEvent,
	SingletonAction,
	type WillAppearEvent,
} from "@elgato/streamdeck";

import { type ApiSettings, type ControlValue, focusriteApi } from "../api";

type ToggleSettings = ApiSettings & {
	control?: string;
	input?: string;
	headphone?: string;
	side?: string;
};

type AirSettings = ApiSettings & {
	input?: string;
};

type SetSettings = ApiSettings & {
	control?: string;
	value?: string;
};

type AdjustSettings = ApiSettings & {
	control?: string;
	step?: number | string;
};

type HeadphoneSettings = ApiSettings & {
	headphone?: string;
	side?: string;
	step?: number | string;
};

type BatchSettings = ApiSettings & {
	commands?: string;
};

async function setTitle(actionInstance: Action, title: string): Promise<void> {
	if (actionInstance.isKey() || actionInstance.isDial()) await actionInstance.setTitle(title);
}

async function setState(actionInstance: Action, state: number): Promise<void> {
	if (actionInstance.isKey()) await actionInstance.setState(state);
}

async function succeed(actionInstance: Action): Promise<void> {
	if (actionInstance.isKey()) await actionInstance.showOk();
}

async function safely(actionInstance: Action, operation: () => Promise<void>): Promise<void> {
	try {
		await operation();
	} catch (error) {
		streamDeck.logger.error(error instanceof Error ? error.message : String(error));
		await actionInstance.showAlert();
	}
}

function parseValue(raw: string | undefined): ControlValue {
	const value = (raw ?? "").trim();
	if (/^(true|on)$/i.test(value)) return true;
	if (/^(false|off)$/i.test(value)) return false;
	if (value !== "" && Number.isFinite(Number(value))) return Number(value);
	return value;
}

abstract class ToggleAction extends SingletonAction<ToggleSettings> {
	protected abstract resolveControl(settings: ToggleSettings): string;

	private async refresh(actionInstance: Action, settings: ToggleSettings): Promise<void> {
		const enabled = Boolean(await focusriteApi.getCached(settings, this.resolveControl(settings)));
		await setState(actionInstance, enabled ? 1 : 0);
	}

	override onWillAppear(ev: WillAppearEvent<ToggleSettings>): Promise<void> {
		return safely(ev.action, () => this.refresh(ev.action, ev.payload.settings));
	}

	override onDidReceiveSettings(ev: DidReceiveSettingsEvent<ToggleSettings>): Promise<void> {
		return safely(ev.action, () => this.refresh(ev.action, ev.payload.settings));
	}

	override onKeyDown(ev: KeyDownEvent<ToggleSettings>): Promise<void> {
		return safely(ev.action, async () => {
			const enabled = Boolean(await focusriteApi.toggle(ev.payload.settings, this.resolveControl(ev.payload.settings)));
			await setState(ev.action, enabled ? 1 : 0);
		});
	}

	async refreshVisible(): Promise<void> {
		await Promise.all(this.actions.map(async (actionInstance) => {
			const settings = await actionInstance.getSettings<ToggleSettings>();
			await safely(actionInstance, () => this.refresh(actionInstance, settings));
		}));
	}
}

@action({ UUID: "com.alexanderdalesio.focusrite-control.dim" })
export class DimAction extends ToggleAction {
	protected resolveControl(): string { return "dim"; }
}

@action({ UUID: "com.alexanderdalesio.focusrite-control.monitor-mute" })
export class MonitorMuteAction extends ToggleAction {
	protected resolveControl(): string { return "monitor-mute"; }
}

@action({ UUID: "com.alexanderdalesio.focusrite-control.phantom" })
export class PhantomAction extends ToggleAction {
	protected resolveControl(settings: ToggleSettings): string { return `input${settings.input || "1"}-phantom`; }
}

@action({ UUID: "com.alexanderdalesio.focusrite-control.instrument" })
export class InstrumentAction extends ToggleAction {
	protected resolveControl(settings: ToggleSettings): string { return `input${settings.input || "1"}-instrument`; }
}

abstract class HeadphoneMuteAction extends ToggleAction {
	protected readonly headphone?: number;
	protected resolveControl(settings: ToggleSettings): string {
		const headphone = this.headphone ?? Number(settings.headphone || "1");
		return `headphone-${headphone}${settings.side === "r" ? "r" : "l"}-mute`;
	}
}

@action({ UUID: "com.alexanderdalesio.focusrite-control.headphone1-mute" })
export class Headphone1MuteAction extends HeadphoneMuteAction {
}

@action({ UUID: "com.alexanderdalesio.focusrite-control.headphone2-mute" })
export class Headphone2MuteAction extends HeadphoneMuteAction {
	protected override readonly headphone = 2;
}

@action({ UUID: "com.alexanderdalesio.focusrite-control.toggle" })
export class GenericToggleAction extends ToggleAction {
	protected resolveControl(settings: ToggleSettings): string { return settings.control?.trim() || "dim"; }
}

@action({ UUID: "com.alexanderdalesio.focusrite-control.air" })
export class AirAction extends SingletonAction<AirSettings> {
	private control(settings: AirSettings): string { return `input${settings.input || "1"}-air`; }

	private async refresh(actionInstance: Action, settings: AirSettings): Promise<void> {
		const value = await focusriteApi.getCached(settings, this.control(settings));
		const state = value === "presence-drive" ? 2 : value === "presence" || value === true ? 1 : 0;
		await setState(actionInstance, state);
	}

	override onWillAppear(ev: WillAppearEvent<AirSettings>): Promise<void> {
		return safely(ev.action, () => this.refresh(ev.action, ev.payload.settings));
	}

	override onDidReceiveSettings(ev: DidReceiveSettingsEvent<AirSettings>): Promise<void> {
		return safely(ev.action, () => this.refresh(ev.action, ev.payload.settings));
	}

	override onKeyDown(ev: KeyDownEvent<AirSettings>): Promise<void> {
		return safely(ev.action, async () => {
			const health = await focusriteApi.health(ev.payload.settings);
			if (health.backend === "fc2") {
				await focusriteApi.toggle(ev.payload.settings, this.control(ev.payload.settings));
			} else {
				const current = String(await focusriteApi.get(ev.payload.settings, this.control(ev.payload.settings)));
				const next = current === "off" ? "presence" : current === "presence" ? "presence-drive" : "off";
				await focusriteApi.set(ev.payload.settings, this.control(ev.payload.settings), next);
			}
			await this.refresh(ev.action, ev.payload.settings);
		});
	}

	async refreshVisible(): Promise<void> {
		await Promise.all(this.actions.map(async (actionInstance) => {
			const settings = await actionInstance.getSettings<AirSettings>();
			await safely(actionInstance, () => this.refresh(actionInstance, settings));
		}));
	}
}

@action({ UUID: "com.alexanderdalesio.focusrite-control.set" })
export class SetControlAction extends SingletonAction<SetSettings> {
	override onKeyDown(ev: KeyDownEvent<SetSettings>): Promise<void> {
		return safely(ev.action, async () => {
			const control = ev.payload.settings.control?.trim();
			if (!control) throw new Error("Choose a control in the property inspector.");
			await focusriteApi.set(ev.payload.settings, control, parseValue(ev.payload.settings.value));
			await succeed(ev.action);
		});
	}
}

@action({ UUID: "com.alexanderdalesio.focusrite-control.adjust" })
export class AdjustControlAction extends SingletonAction<AdjustSettings> {
	private control(settings: AdjustSettings): string { return settings.control?.trim() || "monitor-gain"; }
	private step(settings: AdjustSettings): number { return Number(settings.step) || 1; }

	private async refresh(actionInstance: Action, settings: AdjustSettings): Promise<void> {
		const value = await focusriteApi.getCached(settings, this.control(settings));
		await setTitle(actionInstance, `${value}\ndB`);
	}

	private async adjust(actionInstance: Action, settings: AdjustSettings, ticks: number): Promise<void> {
		const current = Number(await focusriteApi.get(settings, this.control(settings)));
		if (!Number.isFinite(current)) throw new Error("The selected control is not numeric.");
		const value = await focusriteApi.set(settings, this.control(settings), current + this.step(settings) * ticks);
		await setTitle(actionInstance, `${value}\ndB`);
	}

	override onWillAppear(ev: WillAppearEvent<AdjustSettings>): Promise<void> {
		return safely(ev.action, () => this.refresh(ev.action, ev.payload.settings));
	}

	override onDidReceiveSettings(ev: DidReceiveSettingsEvent<AdjustSettings>): Promise<void> {
		return safely(ev.action, () => this.refresh(ev.action, ev.payload.settings));
	}

	override onKeyDown(ev: KeyDownEvent<AdjustSettings>): Promise<void> {
		return safely(ev.action, () => this.adjust(ev.action, ev.payload.settings, 1));
	}

	override onDialRotate(ev: DialRotateEvent<AdjustSettings>): Promise<void> {
		return safely(ev.action, () => this.adjust(ev.action, ev.payload.settings, ev.payload.ticks));
	}

	async refreshVisible(): Promise<void> {
		await Promise.all(this.actions.map(async (actionInstance) => {
			const settings = await actionInstance.getSettings<AdjustSettings>();
			await safely(actionInstance, () => this.refresh(actionInstance, settings));
		}));
	}
}

abstract class HeadphoneLevelAction extends SingletonAction<HeadphoneSettings> {
	protected readonly headphone?: number;

	private output(settings: HeadphoneSettings): number {
		return this.headphone ?? Number(settings.headphone || "1");
	}

	private control(settings: HeadphoneSettings): string {
		return `headphone-${this.output(settings)}${settings.side === "r" ? "r" : "l"}-level`;
	}

	private step(settings: HeadphoneSettings): number { return Number(settings.step) || 1; }

	private async refresh(actionInstance: Action, settings: HeadphoneSettings): Promise<void> {
		const value = await focusriteApi.getCached(settings, this.control(settings));
		await setTitle(actionInstance, `HP${this.output(settings)} ${settings.side === "r" ? "R" : "L"}\n${value} dB`);
	}

	private async adjust(actionInstance: Action, settings: HeadphoneSettings, ticks: number): Promise<void> {
		const current = Number(await focusriteApi.get(settings, this.control(settings)));
		if (!Number.isFinite(current)) throw new Error("The selected headphone level is unavailable.");
		const value = await focusriteApi.set(settings, this.control(settings), current + this.step(settings) * ticks);
		await setTitle(actionInstance, `HP${this.output(settings)} ${settings.side === "r" ? "R" : "L"}\n${value} dB`);
	}

	override onWillAppear(ev: WillAppearEvent<HeadphoneSettings>): Promise<void> {
		return safely(ev.action, () => this.refresh(ev.action, ev.payload.settings));
	}

	override onDidReceiveSettings(ev: DidReceiveSettingsEvent<HeadphoneSettings>): Promise<void> {
		return safely(ev.action, () => this.refresh(ev.action, ev.payload.settings));
	}

	override onKeyDown(ev: KeyDownEvent<HeadphoneSettings>): Promise<void> {
		return safely(ev.action, () => this.adjust(ev.action, ev.payload.settings, 1));
	}

	override onDialRotate(ev: DialRotateEvent<HeadphoneSettings>): Promise<void> {
		return safely(ev.action, () => this.adjust(ev.action, ev.payload.settings, ev.payload.ticks));
	}

	async refreshVisible(): Promise<void> {
		await Promise.all(this.actions.map(async (actionInstance) => {
			const settings = await actionInstance.getSettings<HeadphoneSettings>();
			await safely(actionInstance, () => this.refresh(actionInstance, settings));
		}));
	}
}

@action({ UUID: "com.alexanderdalesio.focusrite-control.headphone1-level" })
export class Headphone1LevelAction extends HeadphoneLevelAction {
}

@action({ UUID: "com.alexanderdalesio.focusrite-control.headphone2-level" })
export class Headphone2LevelAction extends HeadphoneLevelAction {
	protected override readonly headphone = 2;
}

@action({ UUID: "com.alexanderdalesio.focusrite-control.batch" })
export class BatchAction extends SingletonAction<BatchSettings> {
	override onKeyDown(ev: KeyDownEvent<BatchSettings>): Promise<void> {
		return safely(ev.action, async () => {
			const assignments = (ev.payload.settings.commands || "").split(/[\n,]+/).map((value) => value.trim()).filter(Boolean);
			if (!assignments.length) throw new Error("Add at least one control=value assignment.");
			const operations = assignments.map((assignment) => {
				const separator = assignment.indexOf("=");
				if (separator < 1) throw new Error(`Invalid assignment: ${assignment}`);
				return { control: assignment.slice(0, separator).trim(), value: parseValue(assignment.slice(separator + 1)) };
			});
			await focusriteApi.batch(ev.payload.settings, operations);
			await succeed(ev.action);
		});
	}
}

@action({ UUID: "com.alexanderdalesio.focusrite-control.backend" })
export class BackendAction extends SingletonAction<ApiSettings> {
	private async refresh(actionInstance: Action, settings: ApiSettings): Promise<void> {
		const health = await focusriteApi.healthCached(settings);
		await setTitle(actionInstance, health.backend === "usb" ? "USB" : "FC2");
		await setState(actionInstance, health.backend === "usb" ? 1 : 0);
	}

	override onWillAppear(ev: WillAppearEvent<ApiSettings>): Promise<void> {
		return safely(ev.action, () => this.refresh(ev.action, ev.payload.settings));
	}

	override onKeyDown(ev: KeyDownEvent<ApiSettings>): Promise<void> {
		return safely(ev.action, async () => {
			const current = await focusriteApi.health(ev.payload.settings);
			await focusriteApi.switchBackend(ev.payload.settings, current.backend === "usb" ? "fc2" : "usb");
			await this.refresh(ev.action, ev.payload.settings);
		});
	}

	async refreshVisible(): Promise<void> {
		await Promise.all(this.actions.map(async (actionInstance) => {
			const settings = await actionInstance.getSettings<ApiSettings>();
			await safely(actionInstance, () => this.refresh(actionInstance, settings));
		}));
	}
}

@action({ UUID: "com.alexanderdalesio.focusrite-control.reconnect" })
export class ReconnectAction extends SingletonAction<ApiSettings> {
	override onKeyDown(ev: KeyDownEvent<ApiSettings>): Promise<void> {
		return safely(ev.action, async () => {
			await focusriteApi.reconnect(ev.payload.settings);
			await succeed(ev.action);
		});
	}
}

@action({ UUID: "com.alexanderdalesio.focusrite-control.dashboard" })
export class DashboardAction extends SingletonAction<ApiSettings> {
	override onKeyDown(ev: KeyDownEvent<ApiSettings>): Promise<void> {
		return safely(ev.action, async () => streamDeck.system.openUrl(await focusriteApi.dashboardUrl(ev.payload.settings)));
	}
}

@action({ UUID: "com.alexanderdalesio.focusrite-control.status" })
export class StatusAction extends SingletonAction<ApiSettings> {
	private async refresh(actionInstance: Action, settings: ApiSettings): Promise<void> {
		const health = await focusriteApi.healthCached(settings);
		await setTitle(actionInstance, `${health.backend === "usb" ? "USB" : "FC2"}\n${health.connected ? "Ready" : "Offline"}`);
		await setState(actionInstance, health.connected ? 1 : 0);
	}

	override onWillAppear(ev: WillAppearEvent<ApiSettings>): Promise<void> {
		return safely(ev.action, () => this.refresh(ev.action, ev.payload.settings));
	}

	override onKeyDown(ev: KeyDownEvent<ApiSettings>): Promise<void> {
		return safely(ev.action, () => this.refresh(ev.action, ev.payload.settings));
	}

	async refreshVisible(): Promise<void> {
		await Promise.all(this.actions.map(async (actionInstance) => {
			const settings = await actionInstance.getSettings<ApiSettings>();
			await safely(actionInstance, () => this.refresh(actionInstance, settings));
		}));
	}
}
