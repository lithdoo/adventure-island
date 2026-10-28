/**
 * cms-actor × LoomRealm real-Chromium closed loop.
 *
 * Proves, with the FROZEN platform path (no test shortcuts):
 *  - `bootstrapWebPresentation()` loads the classic <script> entry declared
 *    by presentation.json (Web Presentation Config v1);
 *  - `customElements.get("cms-actor")` is defined before first projection;
 *  - WebProjector injects the Context, projects attrs and delivers the
 *    retained avatarPlan through `receiveRenderData`;
 *  - `PresentationResourceClient.resource()` receives the exact Content
 *    logical identity + expectedContentVersion for every painted canvas;
 *  - Canvas pixels: body/head/face/hair anchor alignment, front/back
 *    z-order (incl. alpha), left/right mirroring around the body origin;
 *  - stand1 / walk1 / jump frame advancement per WZ delay;
 *  - one-shot `action` events play once and return to the CURRENT
 *    locomotion; rapid re-trigger restarts from frame 0;
 *  - slow resource responses never let a stale paint overwrite a newer
 *    action; version conflicts and missing resources produce locatable
 *    error diagnostics with no partial frame; disconnect cancels in-flight
 *    reads and releases the bitmap cache; reconnect renders again;
 *  - the decoded-bitmap cache stays inside its documented capacity bound.
 *
 * All imagery is generated at test time (synthetic FSDB + synthetic PNG);
 * nothing here validates real CMS 079 WZ assets.
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import test, { after, before } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const componentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(componentRoot, "..", "..");
const loomRoot = path.join(repoRoot, "loom-realm");
const rendererDistInternal = path.join(loomRoot, "packages", "renderer", "dist", "internal");

const INSTALLATION_ID = "cms-actor-test";
const BEARER = "Bearer cms-actor-test-token";
const SESSION_ID = "session-cms-actor";
const SUBSYSTEM_KEY = "avatar";
const GENERATION = 1;
const DOMAIN_ID = "field";
const TARGET_KEY = "player-1";

const { generateSyntheticFsdb, COLORS, FRAME_MARKERS } = await import("./synthetic-fsdb.mjs");
const { buildAvatarPlan, withResourceVersion } = await import("./look-adapter.mjs");
const { validateAvatarPlan, measureAvatarPlanDataBytes } = await import("../src/avatar-model.mjs");

async function importRendererInternal(module) {
  const file = path.join(rendererDistInternal, `${module}.js`);
  if (!existsSync(file)) {
    assert.fail(`loom-realm renderer dist is missing ${module}.js — run: npm install && npm run build -w @loomrealm/renderer (inside loom-realm/)`);
  }
  return import(pathToFileURL(file).href);
}

function executablePath() {
  return [
    process.env.LOOMREALM_CHROMIUM_PATH,
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ].filter(Boolean).find(existsSync);
}

// ---------------------------------------------------------------------------
// Shared fixture state
// ---------------------------------------------------------------------------
const scriptBytes = await readFile(path.join(componentRoot, "browser", "cms-actor.browser.js"));
const fsdb = generateSyntheticFsdb(path.join(repoRoot, ".work", "cms-actor"), { scriptBytes });
const zOrder = fsdb.readStruct("ZMap", "order").order;
const avatarPlan = validateAvatarPlan(buildAvatarPlan(fsdb.looks, zOrder, fsdb.index));

const serverState = {
  delays: new Map(), // `${ns}/${key}` -> ms
  active: 0,
};

let server;
let origin;
let chromium;

function actorView({ attrs = {}, plan = avatarPlan, withActor = true } = {}) {
  return {
    sessionId: SESSION_ID,
    subsystems: [{
      subsystemKey: SUBSYSTEM_KEY,
      generation: GENERATION,
      eligible: true,
      domains: [{
        domainId: DOMAIN_ID,
        zIndex: 0,
        roots: withActor ? [{
          key: TARGET_KEY,
          tag: "cms-actor",
          attrs: {
            x: "0",
            y: "0",
            locomotion: "stand",
            facing: "right",
            skin: "0",
            face: "00020000",
            hair: "00030000",
            expression: "default",
            equips: "",
            ...attrs,
          },
          data: { avatarPlan: plan },
          children: [],
        }] : [],
      }],
    }],
  };
}

const RENDER_EVENT = {
  sessionId: SESSION_ID,
  subsystemKey: SUBSYSTEM_KEY,
  generation: GENERATION,
  domainId: DOMAIN_ID,
  targetKey: TARGET_KEY,
};

function startServer() {
  return new Promise((resolve) => {
    server = http.createServer(async (request, response) => {
      const url = new URL(request.url ?? "/", "http://localhost");
      try {
        if (url.pathname === "/") {
          response.setHeader("content-type", "text/html");
          response.end("<!doctype html><html><head></head><body style=\"margin:0\"></body></html>");
          return;
        }
        if (url.pathname.startsWith("/packages/renderer/dist/internal/") && url.pathname.endsWith(".js")) {
          const leaf = path.basename(url.pathname);
          try {
            response.setHeader("content-type", "text/javascript");
            response.end(await readFile(path.join(rendererDistInternal, leaf)));
          } catch {
            response.statusCode = 404;
            response.end();
          }
          return;
        }
        if (url.pathname === "/presentation/cms-actor/cms-actor.browser.js") {
          response.setHeader("content-type", "text/javascript");
          response.end(scriptBytes);
          return;
        }
        const resourcePrefix = `/_lr/v1/games/${INSTALLATION_ID}/resources/`;
        if (url.pathname.startsWith(resourcePrefix)) {
          if (request.headers.authorization !== BEARER) { response.statusCode = 401; response.end(); return; }
          const segments = url.pathname.slice(resourcePrefix.length).split("/").map((part) => decodeURIComponent(part));
          const namespace = segments.shift();
          const key = segments.join("/");
          const entry = fsdb.index.get(`${namespace}\0${key}`);
          serverState.active += 1;
          response.on("close", () => { serverState.active -= 1; });
          if (!entry) { response.statusCode = 404; response.end(); return; }
          const delay = serverState.delays.get(`${namespace}/${key}`) ?? 0;
          if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
          response.setHeader("content-type", entry.mime);
          response.setHeader("x-loom-content-version", entry.contentVersion);
          response.setHeader("etag", `"${entry.contentVersion}"`);
          response.end(entry.bytes);
          return;
        }
        response.statusCode = 404;
        response.end();
      } catch (cause) {
        response.statusCode = 500;
        response.end(String(cause));
      }
    });
    server.listen(0, "127.0.0.1", () => {
      origin = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
}

async function preparePresentation() {
  const { prepareWebPresentationV1 } = await importRendererInternal("web-presentation-config");
  const config = JSON.parse(await readFile(path.join(componentRoot, "presentation.json"), "utf8"));
  return prepareWebPresentationV1(config, async (ref) => {
    const entry = fsdb.index.get(`${ref.namespace}\0${ref.key}`);
    if (!entry) throw new Error(`missing presentation artifact ${ref.namespace}/${ref.key}`);
    return { contentVersion: entry.contentVersion, mime: entry.mime, browserSource: `${origin}/presentation/cms-actor/cms-actor.browser.js` };
  });
}

async function openBootstrappedPage(t) {
  const page = await chromium.newPage({ viewport: { width: 480, height: 360 }, deviceScaleFactor: 1 });
  t.after(() => page.close().catch(() => {}));
  await page.goto(origin);
  const prepared = await preparePresentation();
  await page.evaluate(async ({ origin: pageOrigin, prepared: pagePrepared, installationId }) => {
    const { bootstrapWebPresentation } = await import(`${pageOrigin}/packages/renderer/dist/internal/web-presentation-bootstrap.js`);
    const { createRendererResourceClient } = await import(`${pageOrigin}/packages/renderer/dist/internal/resource-client.js`);
    const { WebProjector } = await import(`${pageOrigin}/packages/renderer/dist/internal/web-projector.js`);
    const lifetime = new AbortController();
    const inner = createRendererResourceClient({ origin: pageOrigin, installationId, token: "cms-actor-test-token" }, lifetime.signal);
    window.__resourceCalls = [];
    window.__presentationFailures = [];
    const resourceClient = {
      async resource(namespace, key, expectedContentVersion, signal) {
        const record = { namespace, key, expectedContentVersion, aborted: false };
        window.__resourceCalls.push(record);
        signal?.addEventListener("abort", () => { record.aborted = true; }, { once: true });
        return inner.resource(namespace, key, expectedContentVersion, signal);
      },
    };
    await bootstrapWebPresentation(window, pagePrepared, () => {
      const projector = new WebProjector({
        document,
        resourceClient,
        reportFailure: (cause) => window.__presentationFailures.push(String(cause)),
      });
      window.__applyView = (view) => projector.reevaluate({ read: () => view });
      window.__emitEvent = (event) => projector.deliverRenderEvent(event);
      window.__actor = () => document.querySelector("cms-actor");
      window.__sample = (sx, sy) => {
        const actor = document.querySelector("cms-actor");
        const canvas = actor?.shadowRoot?.querySelector("canvas");
        if (!canvas) return null;
        const left = Number.parseFloat(canvas.style.left) || 0;
        const top = Number.parseFloat(canvas.style.top) || 0;
        const x = Math.round(sx - left);
        const y = Math.round(sy - top);
        if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return null;
        const pixel = canvas.getContext("2d").getImageData(x, y, 1, 1).data;
        return [pixel[0], pixel[1], pixel[2]];
      };
      window.__teardown = () => { projector.teardown(); lifetime.abort(); };
    });
  }, { origin, prepared, installationId: INSTALLATION_ID });
  return page;
}

async function waitFor(page, predicate, label, timeout = 8_000, arg) {
  const deadline = Date.now() + timeout;
  let last;
  while (Date.now() < deadline) {
    last = await page.evaluate(predicate, arg);
    if (last) return last;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.fail(`Timed out waiting for ${label}; last observation: ${JSON.stringify(last)}`);
}

const waitPixel = (page, point, color, label, timeout = 8_000) =>
  waitFor(page, ({ x, y, expected }) => {
    const actual = window.__sample(x, y);
    return actual !== null && actual.every((channel, index) => channel === expected[index]);
  }, label, timeout, { x: point[0], y: point[1], expected: color.slice(0, 3) });

const waitFrame = (page, frame, label, timeout = 8_000) =>
  waitFor(page, (expected) => window.__actor()?.getAttribute("data-frame") === expected, label, timeout, String(frame));

const waitAction = (page, action, label, timeout = 8_000) =>
  waitFor(page, (expected) => window.__actor()?.getAttribute("data-action") === expected, label, timeout, action);

// Scene-space sample points (see synthetic-fsdb.mjs geometry):
//   body spans x[-19,8) y[-32,0); head x[-12,12) y[-34,-10); face x[-6,6)
//   y[-29,-19); hair x[-12,12) y[-32,-14) with a transparent hole over the
//   face; weapon x[1,17) y[-19,9). Body-local (13,31) = (-6,-1) is the
//   per-frame marker row at the bottom of the body canvas.
const POINTS = {
  headOverBody: [-8, -12],
  bodyOnly: [0, -6],
  hairOverHead: [-10, -20],
  faceThroughHairHole: [0, -24],
  weaponRight: [4, -10],
  weaponLeft: [-4, -10],
  marker: [-6, -1],
};

before(async () => {
  await startServer();
  const require = createRequire(path.join(loomRoot, "package.json"));
  const playwrightUrl = pathToFileURL(require.resolve("playwright")).href;
  const playwrightModule = await import(playwrightUrl);
  const chromiumApi = playwrightModule.chromium ?? playwrightModule.default?.chromium;
  if (!chromiumApi) assert.fail("playwright could not be resolved from loom-realm/node_modules");
  const executable = executablePath();
  chromium = await chromiumApi.launch({ headless: true, ...(executable ? { executablePath: executable } : {}) });
});

after(async () => {
  await chromium?.close().catch(() => {});
  await new Promise((resolve) => server?.close(resolve));
});

// ---------------------------------------------------------------------------

test("formal bootstrap registers the classic entry and projects context, attrs and avatarPlan", { timeout: 60_000 }, async (t) => {
  const page = await openBootstrappedPage(t);
  assert.equal(await page.evaluate(() => typeof customElements.get("cms-actor")), "function", "classic script must register cms-actor");

  await page.evaluate((view) => window.__applyView(view), actorView());
  await waitAction(page, "stand1", "element renders stand1");
  await waitFor(page, () => window.__actor()?.getAttribute("data-render-state") === "ready", "element ready");
  await waitFor(page, () => window.__actor()?.shadowRoot?.querySelector("canvas")?.width > 1, "canvas painted");

  const projected = await page.evaluate(() => {
    const actor = window.__actor();
    return {
      attrs: Object.fromEntries(["x", "y", "locomotion", "facing", "skin", "face", "hair", "expression", "equips"].map((name) => [name, actor.getAttribute(name)])),
      diagnostics: actor.diagnostics(),
      inDocument: document.body.contains(actor),
    };
  });
  assert.deepEqual(projected.attrs, {
    x: "0", y: "0", locomotion: "stand", facing: "right",
    skin: "0", face: "00020000", hair: "00030000", expression: "default", equips: "",
  });
  assert.equal(projected.inDocument, true);
  assert.equal(projected.diagnostics.contextInjected, true, "Projector must inject the WebPresentationContext");
  assert.deepEqual(await page.evaluate(() => window.__presentationFailures), [], "no presentation failures during bootstrap + projection");

  // Every resource read must carry an exact plan identity and version.
  const calls = await page.evaluate(() => window.__resourceCalls.map(({ namespace, key, expectedContentVersion }) => `${namespace}\0${key}\0${expectedContentVersion}`));
  const planIdentities = new Set();
  for (const action of Object.values(avatarPlan.actions)) {
    for (const frame of action.frames) {
      for (const layer of frame.layers) {
        planIdentities.add(`${layer.resource.namespace}\0${layer.resource.key}\0${layer.resource.contentVersion}`);
      }
    }
  }
  for (const identity of calls) assert.ok(planIdentities.has(identity), `resource call ${identity.replace(/\0/g, " | ")} must belong to the plan`);
  for (const layer of avatarPlan.actions.stand1.frames[0].layers) {
    const identity = `${layer.resource.namespace}\0${layer.resource.key}\0${layer.resource.contentVersion}`;
    assert.ok(calls.includes(identity), `first frame must fetch ${layer.id} (${layer.resource.key}) through the formal Content identity`);
  }
});

test("anchors align body, head, face and hair; z-order and alpha compose; mirroring flips around the body origin", { timeout: 60_000 }, async (t) => {
  const page = await openBootstrappedPage(t);
  await page.evaluate((view) => window.__applyView(view), actorView({ attrs: { x: "40", y: "60" } }));
  await waitFor(page, () => window.__actor()?.getAttribute("data-render-state") === "ready", "element ready");

  await waitPixel(page, POINTS.headOverBody, COLORS.head, "head aligned over body via the neck anchor");
  await waitPixel(page, POINTS.bodyOnly, COLORS.body, "body fill visible below the head");
  await waitPixel(page, POINTS.hairOverHead, COLORS.hair, "hair paints in front of the head");
  await waitPixel(page, POINTS.faceThroughHairHole, COLORS.face, "face visible through the hair's transparent window");
  await waitPixel(page, POINTS.weaponRight, COLORS.weapon, "weapon aligned to the hand anchor, in front of the body");

  // Facing left mirrors the whole composite around the body origin x.
  await page.evaluate((view) => window.__applyView(view), actorView({ attrs: { x: "40", y: "60", facing: "left" } }));
  await waitPixel(page, POINTS.weaponLeft, COLORS.weapon, "weapon mirrored to the left side");
  await waitPixel(page, [4, -11], COLORS.head, "right side now shows the head, not the weapon");
  await waitPixel(page, [0, -12], COLORS.head, "anchored parts stay aligned after mirroring");
});

test("stand1 and walk1 advance by WZ delay and loop; jump holds its single frame", { timeout: 60_000 }, async (t) => {
  const page = await openBootstrappedPage(t);

  await page.evaluate((view) => window.__applyView(view), actorView({ attrs: { locomotion: "walk" } }));
  for (const expected of [0, 1, 2, 3, 0]) {
    await waitFrame(page, expected, `walk1 frame ${expected}`);
    await waitPixel(page, POINTS.marker, FRAME_MARKERS.walk1[expected], `walk1 frame ${expected} marker`);
  }

  await page.evaluate((view) => window.__applyView(view), actorView({ attrs: { locomotion: "stand" } }));
  await waitAction(page, "stand1", "stand1 active");
  for (const expected of [1, 0]) await waitFrame(page, expected, `stand1 frame ${expected}`);

  await page.evaluate((view) => window.__applyView(view), actorView({ attrs: { locomotion: "jump" } }));
  await waitAction(page, "jump", "jump active");
  await waitPixel(page, POINTS.marker, FRAME_MARKERS.jump[0], "jump frame painted");
  await new Promise((resolve) => setTimeout(resolve, 700));
  const held = await page.evaluate(({ x, y }) => ({
    frame: window.__actor().getAttribute("data-frame"),
    marker: window.__sample(x, y),
  }), { x: POINTS.marker[0], y: POINTS.marker[1] });
  assert.equal(held.frame, "0", "jump holds its only frame");
  assert.deepEqual(held.marker, FRAME_MARKERS.jump[0].slice(0, 3));
});

test("one-shot action events play once and return to the CURRENT locomotion; rapid re-trigger restarts at frame 0", { timeout: 60_000 }, async (t) => {
  const page = await openBootstrappedPage(t);
  await page.evaluate((view) => window.__applyView(view), actorView({ attrs: { locomotion: "walk" } }));
  await waitFor(page, () => window.__actor()?.getAttribute("data-render-state") === "ready", "walk ready");

  await page.evaluate((event) => window.__emitEvent(event), { ...RENDER_EVENT, name: "action", data: { action: "brandish1" } });
  await waitAction(page, "brandish1", "one-shot action active");
  for (const [index, marker] of FRAME_MARKERS.brandish1.entries()) {
    await waitPixel(page, POINTS.marker, marker, `brandish1 frame ${index} marker`);
  }
  await waitAction(page, "walk1", "returns to the locomotion current when the one-shot finished");
  await waitFor(page, (colors) => colors.some((color) => {
    const actual = window.__sample(-6, -1);
    return actual !== null && color.every((channel, index) => channel === actual[index]);
  }), "no freeze on the last one-shot frame", 4_000, FRAME_MARKERS.walk1.map((color) => color.slice(0, 3)));

  // Locomotion changing MID-play must win when the one-shot finishes.
  await page.evaluate((event) => window.__emitEvent(event), { ...RENDER_EVENT, name: "action", data: { action: "brandish1" } });
  await waitAction(page, "brandish1", "second one-shot starts");
  await page.evaluate((view) => window.__applyView(view), actorView({ attrs: { locomotion: "stand" } }));
  await waitAction(page, "stand1", "post-one-shot state is the latest locomotion, not the old one", 5_000);

  // Rapid re-trigger: a second event during playback restarts from frame 0.
  await page.evaluate((event) => window.__emitEvent(event), { ...RENDER_EVENT, name: "action", data: { action: "brandish1" } });
  await waitPixel(page, POINTS.marker, FRAME_MARKERS.brandish1[0], "first frame visible");
  await page.evaluate((event) => window.__emitEvent(event), { ...RENDER_EVENT, name: "action", data: { action: "brandish1" } });
  await waitFor(page, () => window.__actor().diagnostics().oneShotAction === "brandish1", "re-trigger accepted");
  await waitFor(page, ({ x, y, expected }) => {
    const actor = window.__actor();
    const actual = window.__sample(x, y);
    return actor.diagnostics().frameIndex === 0 && actual !== null && expected.every((channel, index) => channel === actual[index]);
  }, "re-trigger restarts at frame 0", 5_000, { x: POINTS.marker[0], y: POINTS.marker[1], expected: FRAME_MARKERS.brandish1[0].slice(0, 3) });
  await waitAction(page, "stand1", "re-triggered one-shot still completes", 6_000);
});

test("a slow resource response never lets the stale paint overwrite the newer action", { timeout: 60_000 }, async (t) => {
  const page = await openBootstrappedPage(t);
  const standFrame1Body = avatarPlan.actions.stand1.frames[1].layers[0].resource;
  serverState.delays.set(`${standFrame1Body.namespace}/${standFrame1Body.key}`, 1_200);

  try {
    await page.evaluate((view) => window.__applyView(view), actorView());
    await waitFor(page, () => window.__actor()?.getAttribute("data-render-state") === "ready", "stand frame 0 ready");
    // Let the stand clock advance into frame 1, whose body PNG is delayed.
    await new Promise((resolve) => setTimeout(resolve, 700));
    await page.evaluate((view) => window.__applyView(view), actorView({ attrs: { locomotion: "walk" } }));
    await waitAction(page, "walk1", "walk active while stand frame 1 is still in flight");
    await waitFor(page, () => window.__actor()?.getAttribute("data-render-state") === "ready", "walk painted");

    // Wait well past the delayed response; the stale stand frame 1 must be discarded.
    await new Promise((resolve) => setTimeout(resolve, 1_600));
    const observed = await page.evaluate(({ x, y }) => ({
      action: window.__actor().getAttribute("data-action"),
      state: window.__actor().getAttribute("data-render-state"),
      marker: window.__sample(x, y),
    }), { x: POINTS.marker[0], y: POINTS.marker[1] });
    assert.equal(observed.action, "walk1");
    assert.equal(observed.state, "ready");
    assert.ok(FRAME_MARKERS.walk1.some((color) => color.slice(0, 3).every((channel, index) => channel === observed.marker[index])),
      `marker must stay walk-colored, got ${JSON.stringify(observed.marker)}`);
  } finally {
    serverState.delays.clear();
  }
});

test("version conflict and missing resources surface locatable errors with no partial frame, then recover", { timeout: 60_000 }, async (t) => {
  const page = await openBootstrappedPage(t);
  await page.evaluate((view) => window.__applyView(view), actorView());
  await waitFor(page, () => window.__actor()?.getAttribute("data-render-state") === "ready", "baseline ready");

  const hairKey = avatarPlan.actions.stand1.frames[0].layers.find((layer) => layer.id === "hair").resource.key;
  const conflicting = withResourceVersion(avatarPlan, hairKey, `sha256:${"0".repeat(64)}`);
  await page.evaluate((view) => window.__applyView(view), actorView({ plan: conflicting }));
  await waitFor(page, () => window.__actor()?.getAttribute("data-render-state") === "error", "conflict error state");
  const conflict = await page.evaluate(() => ({
    message: window.__actor().getAttribute("data-render-error"),
    canvasWidth: window.__actor().shadowRoot.querySelector("canvas").width,
  }));
  assert.match(conflict.message, /CONTENT_CONFLICT/);
  assert.ok(conflict.message.includes(hairKey), `diagnostic must name the resource (${conflict.message})`);
  assert.equal(conflict.canvasWidth, 1, "error must clear the canvas, not leave a partial frame");

  const missingKey = "Look/00020000/default/0/ghost";
  const missingPlan = structuredClone(avatarPlan);
  for (const frame of missingPlan.actions.stand1.frames) {
    const face = frame.layers.find((layer) => layer.id === "face");
    face.resource.key = missingKey;
  }
  await page.evaluate((view) => window.__applyView(view), actorView({ plan: missingPlan }));
  await waitFor(page, () => window.__actor()?.getAttribute("data-render-state") === "error", "missing error state", 6_000);
  const missing = await page.evaluate(() => window.__actor().getAttribute("data-render-error"));
  assert.match(missing, /CONTENT_NOT_FOUND/);
  assert.ok(missing.includes(missingKey), `diagnostic must name the missing key (${missing})`);

  await page.evaluate((view) => window.__applyView(view), actorView());
  await waitFor(page, () => window.__actor()?.getAttribute("data-render-state") === "ready", "recovers on the corrected plan");
  await waitPixel(page, POINTS.faceThroughHairHole, COLORS.face, "pixels restored after recovery");
});

test("disconnect cancels in-flight reads and releases the cache; reconnect renders again", { timeout: 60_000 }, async (t) => {
  const page = await openBootstrappedPage(t);
  await page.evaluate((view) => window.__applyView(view), actorView());
  await waitFor(page, () => window.__actor()?.getAttribute("data-render-state") === "ready", "baseline ready");

  const brandishFrame2Body = avatarPlan.actions.brandish1.frames[2].layers[0].resource;
  serverState.delays.set(`${brandishFrame2Body.namespace}/${brandishFrame2Body.key}`, 1_500);
  try {
    await page.evaluate((event) => window.__emitEvent(event), { ...RENDER_EVENT, name: "action", data: { action: "brandish1" } });
    await waitFor(page, (key) => window.__resourceCalls.some((call) => call.key === key), "delayed brandish frame 2 requested", 6_000, brandishFrame2Body.key);
    await page.evaluate(() => { window.__removedActor = window.__actor(); });
    // Remove the node from the authoritative view: the Projector disconnects it.
    await page.evaluate((view) => window.__applyView(view), actorView({ withActor: false }));
    await waitFor(page, () => document.body.contains(window.__removedActor) === false, "element removed from the managed DOM");
    await waitFor(page, (key) => window.__resourceCalls.find((call) => call.key === key)?.aborted === true, "in-flight read aborted on disconnect", 6_000, brandishFrame2Body.key);
    await waitFor(page, () => window.__removedActor.diagnostics().cache.entries === 0, "bitmap cache released on disconnect");

    // Reconnect: the same key returns as a fresh element and renders again.
    await page.evaluate((view) => window.__applyView(view), actorView());
    await waitFor(page, () => window.__actor() !== null && window.__actor() !== window.__removedActor, "fresh element instance");
    await waitFor(page, () => window.__actor()?.getAttribute("data-render-state") === "ready", "reconnected element ready");
    await waitPixel(page, POINTS.headOverBody, COLORS.head, "reconnected element paints");
    assert.equal(await page.evaluate(() => window.__removedActor.diagnostics().cache.entries), 0, "the disconnected instance must stay released");
    assert.deepEqual(await page.evaluate(() => window.__presentationFailures), [], "no presentation failures across disconnect/reconnect");
  } finally {
    serverState.delays.clear();
  }
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal(serverState.active, 0, "server must not keep aborted requests open");
});

test("decoded-bitmap cache keeps its documented capacity bound across many frames", { timeout: 90_000 }, async (t) => {
  const page = await openBootstrappedPage(t);
  // Touch stand, a full walk cycle and a full brandish play, then stressSpin
  // (48 body frames × 4 layers; the weapon intentionally lacks the action):
  // 73 distinct decoded bitmaps against the 64-entry cap.
  await page.evaluate((view) => window.__applyView(view), actorView({ attrs: { locomotion: "walk" } }));
  await waitFor(page, () => window.__actor()?.getAttribute("data-render-state") === "ready", "walk ready");
  for (const expected of [0, 1, 2, 3]) await waitFrame(page, expected, `walk1 frame ${expected}`, 5_000);
  await page.evaluate((view) => window.__applyView(view), actorView({ attrs: { locomotion: "stand" } }));
  await waitAction(page, "stand1", "stand1 active");
  await waitFrame(page, 1, "stand1 frame 1", 5_000);
  await page.evaluate((event) => window.__emitEvent(event), { ...RENDER_EVENT, name: "action", data: { action: "brandish1" } });
  await waitAction(page, "brandish1", "brandish started");
  await waitPixel(page, POINTS.marker, FRAME_MARKERS.brandish1[2], "brandish last frame", 6_000);

  await page.evaluate((event) => window.__emitEvent(event), { ...RENDER_EVENT, name: "action", data: { action: "stressSpin" } });
  await waitAction(page, "stressSpin", "stressSpin active");
  await waitFor(page, (color) => {
    const actual = window.__sample(-6, -1);
    return actual !== null && color.every((channel, index) => channel === actual[index]);
  }, "stressSpin last frame painted", 25_000, FRAME_MARKERS.stressSpin[47].slice(0, 3));
  await waitAction(page, "stand1", "stressSpin completed and returned to locomotion", 10_000);
  await waitFor(page, () => {
    const actor = window.__actor();
    return actor.diagnostics().paintPending === false && actor.getAttribute("data-render-state") === "ready";
  }, "paint settled");
  const diagnostics = await page.evaluate(() => window.__actor().diagnostics());
  assert.ok(diagnostics.cache.entries <= diagnostics.cache.maxEntries,
    `cache must respect the entry cap (${diagnostics.cache.entries} > ${diagnostics.cache.maxEntries})`);
  assert.ok(diagnostics.cache.bytes <= diagnostics.cache.maxBytes, "cache must respect the byte cap");
});

test("avatarPlan built from the synthetic FSDB respects the frozen RenderNode.data byte cap", () => {
  const bytes = measureAvatarPlanDataBytes(avatarPlan);
  assert.ok(bytes > 0 && bytes <= 262_144, `plan must fit the frozen cap (got ${bytes} bytes)`);
  const distinctResources = new Set();
  for (const action of Object.values(avatarPlan.actions)) {
    for (const frame of action.frames) {
      for (const layer of frame.layers) distinctResources.add(`${layer.resource.namespace}/${layer.resource.key}`);
    }
  }
  // 73 synthetic canvases: body per frame (2+4+1+3+48) plus per-action
  // head (5), hair (4 + shared default via UOL), the shared face canvas and
  // per-action weapon (4; the weapon lacks stressSpin and is not drawn).
  assert.equal(distinctResources.size, 73);
  assert.ok(distinctResources.size > 64, "fixture must exceed the bitmap cache entry cap to exercise eviction");
});
