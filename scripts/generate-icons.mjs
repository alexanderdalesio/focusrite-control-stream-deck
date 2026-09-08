import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = new URL("../com.alexanderdalesio.focusrite-control.sdPlugin/imgs/", import.meta.url).pathname;
const docs = new URL("../docs/", import.meta.url).pathname;

const glyphs = {
  dim: '<circle cx="50" cy="50" r="20"/><path d="M50 13v12M50 75v12M13 50h12M75 50h12M24 24l9 9M67 67l9 9M76 24l-9 9"/><path d="M20 84L84 20"/>',
  mute: '<path d="M18 42h18l22-18v52L36 58H18z"/><path d="M70 38l22 24M92 38L70 62"/>',
  phantom: '<path d="M58 11L25 56h25l-8 37 34-49H52z"/>',
  air: '<path d="M14 34c17-17 31 17 48 0s29 0 29 0M14 51c17-17 31 17 48 0s29 0 29 0M14 68c17-17 31 17 48 0s29 0 29 0"/>',
  instrument: '<path d="M35 52l7-14 13 13 24-24-4-7 13-7 5 5-7 13-7-4-24 24 13 13-14 7-5 11c-4 10-16 13-24 6-8-7-8-17-1-25z"/><circle cx="37" cy="69" r="6"/>',
  headphone1Level: '<path d="M9 62V45a43 43 0 0 1 86 0v17M9 59h16v30H9zM79 59h16v30H79z"/><circle cx="52" cy="65" r="17"/><path d="M52 65l11-11"/>',
  headphone2Level: '<path d="M9 62V45a43 43 0 0 1 86 0v17M9 59h16v30H9zM79 59h16v30H79z"/><circle cx="52" cy="65" r="17"/><path d="M52 65l11-11"/>',
  headphone1Mute: '<path d="M9 62V45a43 43 0 0 1 86 0v17M9 59h16v30H9zM79 59h16v30H79zM39 51l26 27M65 51L39 78"/>',
  headphone2Mute: '<path d="M9 62V45a43 43 0 0 1 86 0v17M9 59h16v30H9zM79 59h16v30H79zM39 51l26 27M65 51L39 78"/>',
  level: '<circle cx="52" cy="53" r="34"/><path d="M52 53l20-20M18 90h68"/>',
  toggle: '<path d="M52 13v35"/><path d="M31 25a35 35 0 1 0 42 0"/>',
  set: '<path d="M18 27h68M18 52h68M18 77h68"/><circle cx="38" cy="27" r="8"/><circle cx="67" cy="52" r="8"/><circle cx="47" cy="77" r="8"/>',
  batch: '<path d="M20 25h10l7 7 13-15M56 25h31M20 52h10l7 7 13-15M56 52h31M20 79h10l7 7 13-15M56 79h31"/>',
  backend: '<path d="M15 35h60l-13-13M75 35L62 48M89 69H29l13-13M29 69l13 13"/>',
  reconnect: '<path d="M82 39A34 34 0 0 0 24 28l-9 12M15 19v21h21M22 65a34 34 0 0 0 58 11l9-12M89 85V64H68"/>',
  dashboard: '<rect x="14" y="17" width="76" height="67" rx="7"/><path d="M14 37h76M38 37v47M64 37v47"/>',
  status: '<circle cx="52" cy="52" r="13"/><path d="M29 29a33 33 0 0 0 0 46M75 29a33 33 0 0 1 0 46M15 15a52 52 0 0 0 0 74M89 15a52 52 0 0 1 0 74"/>',
};

const files = {
  dim: ["off", "on"], mute: ["off", "on"], phantom: ["off", "on"], instrument: ["off", "on"],
  headphone1Level: ["key"], headphone2Level: ["key"], headphone1Mute: ["off", "on"], headphone2Mute: ["off", "on"],
  air: ["off", "presence", "drive"], level: ["key"], toggle: ["off", "on"],
  set: ["key"], batch: ["key"], backend: ["fc2", "usb"], reconnect: ["key"],
  dashboard: ["key"], status: ["off", "on"],
};

function listIcon(glyph) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 104 104"><g fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">${glyph}</g></svg>\n`;
}

function keyIcon(glyph, state) {
  const active = ["on", "presence", "drive", "usb"].includes(state);
  const accent = state === "drive" ? "#ff9f43" : "#ef3e55";
  const ring = active ? `<rect x="7" y="7" width="130" height="130" rx="26" fill="none" stroke="${accent}" stroke-width="8"/>` : "";
  const glow = active ? `<circle cx="72" cy="72" r="50" fill="${accent}" opacity=".12"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144 144"><rect width="144" height="144" rx="28" fill="#11151b"/>${glow}${ring}<g transform="translate(20 20)" fill="none" stroke="${active ? accent : "#d8dde5"}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">${glyph}</g></svg>\n`;
}

for (const [name, states] of Object.entries(files)) {
  const directory = join(root, "actions", name);
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, "list.svg"), listIcon(glyphs[name]));
  for (const state of states) await writeFile(join(directory, `${state}.svg`), keyIcon(glyphs[name], state));
}

const category = '<path d="M19 67a40 40 0 1 1 66 0"/><circle cx="52" cy="52" r="20"/><path d="M52 52l17-17"/>';
await writeFile(join(root, "plugin", "category-icon.svg"), listIcon(category));

const marketplace = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="104" fill="#11151b"/><path d="M105 328a170 170 0 1 1 302 0" fill="none" stroke="#ef3e55" stroke-width="36" stroke-linecap="round"/><circle cx="256" cy="258" r="88" fill="none" stroke="#f6f7f9" stroke-width="30"/><path d="M256 258l79-79" fill="none" stroke="#f6f7f9" stroke-width="30" stroke-linecap="round"/><circle cx="256" cy="258" r="15" fill="#ef3e55"/></svg>\n`;
await writeFile(join(root, "plugin", "marketplace.svg"), marketplace);

const previewItems = [
  ["dim", "on", "Dim"], ["mute", "on", "Monitor mute"], ["phantom", "on", "Phantom power"],
  ["air", "presence", "Air mode"], ["instrument", "on", "Instrument"], ["level", "key", "Adjust level"],
  ["headphone1Level", "key", "HP 1 level"], ["headphone1Mute", "on", "HP 1 mute"],
  ["headphone2Level", "key", "HP 2 level"], ["headphone2Mute", "on", "HP 2 mute"],
  ["toggle", "on", "Toggle control"], ["set", "key", "Set control"], ["batch", "key", "Run batch"],
  ["backend", "usb", "Communication"], ["reconnect", "key", "Reconnect"], ["dashboard", "key", "Dashboard"],
  ["status", "on", "Status"],
];
const previewCells = previewItems.map(([name, state, label], index) => {
  const x = 26 + (index % 5) * 186;
  const y = 28 + Math.floor(index / 5) * 196;
  const icon = keyIcon(glyphs[name], state).replace(/^<svg[^>]*>|<\/svg>\s*$/g, "");
  return `<g transform="translate(${x} ${y})"><svg width="144" height="144" viewBox="0 0 144 144">${icon}</svg><text x="72" y="169" text-anchor="middle" fill="#d8dde5" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="16">${label}</text></g>`;
}).join("");
await mkdir(docs, { recursive: true });
const previewWidth = 956;
const previewHeight = previewWidth;
await writeFile(join(docs, "icon-preview.svg"), `<svg xmlns="http://www.w3.org/2000/svg" width="${previewWidth}" height="${previewHeight}" viewBox="0 0 ${previewWidth} ${previewHeight}"><rect width="${previewWidth}" height="${previewHeight}" rx="28" fill="#0b0e12"/>${previewCells}</svg>\n`);
