export type FocusriteConnection = {
	id: string;
	name: string;
	url: string;
	token?: string;
	deviceName?: string;
};

export type ConnectionSettings = {
	connectionId?: string;
	/** Retained so existing v1.0 profiles continue to work after upgrading. */
	apiUrl?: string;
};

export type ConnectionRegistry = {
	connections?: FocusriteConnection[];
	defaultConnectionId?: string;
};

export function resolveConnection(settings: ConnectionSettings): Promise<FocusriteConnection>;
