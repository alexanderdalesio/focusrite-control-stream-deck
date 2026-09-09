# Security

The plugin sends requests only to a saved API selected for an action. Connection names, URLs, optional network access tokens, and the last detected device name are stored in Stream Deck's plugin-wide settings. They are not included in this repository or its logs.

Localhost access is the safest default. If network access is required, use the API's `focusrite network enable` command, keep the generated token private, and restrict access to a trusted LAN. Do not expose the service through a public reverse proxy: it can change audio-interface settings. Review third-party profiles before importing them because generic and batch actions may contain arbitrary control names and values.

Report a vulnerability privately through [GitHub security advisories](https://github.com/alexanderdalesio/focusrite-control-stream-deck/security/advisories/new). Do not include Focusrite pairing keys or other secrets in a report.
