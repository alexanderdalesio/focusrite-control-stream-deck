# Security

The plugin sends requests only to the API address configured for each action. The default is the loopback-only Focusrite Control API at `http://127.0.0.1:41780`; no credentials, pairing keys, device serial numbers, or control history are stored by this repository.

Keep the API bound to localhost. Do not expose it through a public reverse proxy: it can change audio-interface settings. Review third-party profiles before importing them because generic and batch actions may contain arbitrary control names and values.

Report a vulnerability privately through [GitHub security advisories](https://github.com/alexanderdalesio/focusrite-control-stream-deck/security/advisories/new). Do not include Focusrite pairing keys or other secrets in a report.
