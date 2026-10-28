import {
  frameDuration,
  layoutFrame,
  mirrorBounds,
  resolveActionName,
  validateAvatarPlan,
} from "./avatar-model.mjs";

const HTMLElementBase = globalThis.HTMLElement ?? class {};
const OBSERVED_ATTRIBUTES = ["x", "y", "locomotion", "facing", "skin", "face", "hair", "expression", "equips"];

/**
 * CMS 079 paper-doll renderer.
 * Game code resolves WZ/UOL/aliases and projects an AvatarPlanV1 into
 * RenderNode.data.avatarPlan. This element only lays out and paints that plan.
 */
export class CmsActor extends HTMLElementBase {
  static get observedAttributes() {
    return OBSERVED_ATTRIBUTES;
  }

  constructor() {
    super();
    this._context = null;
    this._plan = null;
    this._resourceCache = new Map();
    this._abortController = null;
    this._paintEpoch = 0;
    this._paintPending = false;
    this._animationHandle = 0;
    this._lastTick = null;
    this._elapsed = 0;
    this._frameIndex = 0;
    this._activeActionName = null;
    this._oneShotAction = null;
    this._connected = false;

    if (typeof this.attachShadow === "function") {
      const shadow = this.attachShadow({ mode: "open" });
      const style = document.createElement("style");
      style.textContent = `
        :host { display:block; position:absolute; width:0; height:0; overflow:visible; pointer-events:none; }
        canvas { display:block; position:absolute; image-rendering:pixelated; image-rendering:crisp-edges; overflow:visible; }
      `;
      this._canvas = document.createElement("canvas");
      this._canvas.setAttribute("aria-hidden", "true");
      shadow.append(style, this._canvas);
    }
  }

  connectedCallback() {
    this._connected = true;
    if (!this._abortController || this._abortController.signal.aborted) {
      this._abortController = new AbortController();
    }
    this._syncPosition();
    this._requestPaint();
  }

  disconnectedCallback() {
    this._connected = false;
    this._paintEpoch += 1;
    this._paintPending = false;
    if (this._animationHandle) cancelAnimationFrame(this._animationHandle);
    this._animationHandle = 0;
    this._lastTick = null;
    this._abortController?.abort();
    this._abortController = null;
    for (const entry of this._resourceCache.values()) entry.bitmap?.close?.();
    this._resourceCache.clear();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    if (name === "x" || name === "y") {
      // Coordinates move the host element; do not repaint the same sprite.
      this._syncPosition();
      return;
    }
    if ((name === "locomotion" || name === "facing") && this._connected) this._requestPaint();
    // skin/face/hair/equips are selectors for the game-side adapter. Their
    // resolved appearance arrives in the next retained avatarPlan update.
  }

  /** Called by LoomRealm before the first managed insertion. */
  receiveRenderContext(context) {
    if (this._context && this._context !== context) return;
    this._context = context;
    this._requestPaint();
  }

  /** Receives the full retained RenderNode.data object. */
  receiveRenderData(data) {
    try {
      const candidate = data?.avatarPlan;
      this._plan = validateAvatarPlan(candidate);
      this._pruneResourceCache(this._plan);
      this.removeAttribute("data-render-error");
      this._activeActionName = null;
      this._frameIndex = 0;
      this._elapsed = 0;
      this._oneShotAction = null;
      this._requestPaint();
    } catch (error) {
      this._paintEpoch += 1;
      this._paintPending = false;
      this._plan = null;
      this._clearCanvas();
      this.setAttribute("data-render-error", error instanceof Error ? error.message : "Invalid avatar plan");
      this.setAttribute("data-render-state", "invalid");
      this._stopAnimation();
    }
  }

  /** Receives one-shot, transient Render Events; they are never retained in data. */
  receiveRenderEvent(event) {
    if (event?.name !== "action" || typeof event.data?.action !== "string") return;
    const actionName = event.data.action;
    if (!this._plan?.actions?.[actionName]) return;
    this._oneShotAction = actionName;
    this._activeActionName = actionName;
    this._frameIndex = 0;
    this._elapsed = 0;
    this._lastTick = null;
    this._requestPaint();
  }

  _syncPosition() {
    if (!this.style) return;
    const x = this._readNumberAttribute("x", 0);
    const y = this._readNumberAttribute("y", 0);
    this.style.left = `${x}px`;
    this.style.top = `${y}px`;
  }

  _readNumberAttribute(name, fallback) {
    const raw = this.getAttribute?.(name);
    if (raw === null || raw === undefined || raw.trim() === "") return fallback;
    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
  }

  _resolveActiveAction() {
    if (this._oneShotAction && this._plan?.actions?.[this._oneShotAction]) return this._oneShotAction;
    return resolveActionName(this._plan, this.getAttribute?.("locomotion") ?? "stand");
  }

  _syncActionState() {
    const next = this._resolveActiveAction();
    if (next !== this._activeActionName) {
      this._activeActionName = next;
      this._frameIndex = 0;
      this._elapsed = 0;
      this._lastTick = null;
    }
    return next;
  }

  _currentFrame() {
    const actionName = this._syncActionState();
    const action = actionName ? this._plan?.actions?.[actionName] : null;
    if (!action?.frames?.length) return null;
    this._frameIndex = Math.min(this._frameIndex, action.frames.length - 1);
    return { actionName, action, frame: action.frames[this._frameIndex] };
  }

  _requestPaint() {
    this._syncPosition();
    if (!this._connected || !this._canvas) return;
    const current = this._currentFrame();
    if (!this._context || !current) {
      this._paintEpoch += 1;
      this._paintPending = false;
      this._clearCanvas();
      this._stopAnimation();
      return;
    }
    // Pause the animation clock while a new frame is being prepared/painted.
    this._lastTick = null;
    this._paintFrame(current);
  }

  async _paintFrame(current) {
    const epoch = ++this._paintEpoch;
    this._paintPending = true;
    const { actionName, frame } = current;
    try {
      const bitmaps = await Promise.all(frame.layers.map((layer) => this._getBitmap(layer)));
      if (!this._connected || epoch !== this._paintEpoch) return;
      const layersWithBitmaps = frame.layers.map((layer, index) => ({ layer, bitmap: bitmaps[index] }));
      this._drawFrame(frame, layersWithBitmaps);
      this.setAttribute("data-render-state", "ready");
      this.removeAttribute("data-render-error");
      this.setAttribute("data-action", actionName);
      this.setAttribute("data-frame", String(this._frameIndex));
      this._paintPending = false;
      // The clock remains paused while painting; the first RAF after this
      // completion establishes a fresh timestamp before accumulating delay.
      this._ensureAnimationLoop(current.action, frame);
    } catch (error) {
      if (!this._connected || epoch !== this._paintEpoch) return;
      this._paintPending = false;
      this._clearCanvas();
      this.setAttribute("data-render-state", "error");
      this.setAttribute("data-render-error", error instanceof Error ? error.message : "Unable to load avatar resources");
      this._stopAnimation();
    }
  }

  _resourceKey(resource) {
    return `${resource.namespace}\u0000${resource.key}\u0000${resource.contentVersion}`;
  }

  _pruneResourceCache(plan) {
    const used = new Set();
    for (const action of Object.values(plan.actions)) {
      for (const frame of action.frames) {
        for (const layer of frame.layers) used.add(this._resourceKey(layer.resource));
      }
    }
    for (const [key, entry] of this._resourceCache) {
      if (used.has(key)) continue;
      entry.bitmap?.close?.();
      this._resourceCache.delete(key);
    }
  }

  _getBitmap(layer) {
    const resource = layer.resource;
    const cacheKey = this._resourceKey(resource);
    const cached = this._resourceCache.get(cacheKey);
    if (cached) return cached.promise;

    const controller = this._abortController ?? new AbortController();
    const entry = { bitmap: null, promise: null };
    entry.promise = this._context.resources.resource(
      resource.namespace,
      resource.key,
      resource.contentVersion,
      { signal: controller.signal },
    ).then(async (resolved) => {
      if (resolved.contentVersion !== resource.contentVersion) {
        throw new Error(`Content version mismatch: ${resource.namespace}/${resource.key}`);
      }
      if (typeof resolved.mime !== "string" || !resolved.mime.startsWith("image/")) {
        throw new Error(`Avatar resource is not an image: ${resource.namespace}/${resource.key}`);
      }
      if (typeof createImageBitmap !== "function") throw new Error("createImageBitmap is not available in this browser");
      const bitmap = await createImageBitmap(new Blob([resolved.bytes], { type: resolved.mime }));
      if (bitmap.width !== layer.width || bitmap.height !== layer.height) {
        bitmap.close?.();
        throw new Error(`Image dimensions do not match plan for ${resource.namespace}/${resource.key}`);
      }
      if (!this._connected || controller.signal.aborted || this._resourceCache.get(cacheKey) !== entry) {
        bitmap.close?.();
        throw new DOMException("Avatar resource load cancelled or superseded", "AbortError");
      }
      entry.bitmap = bitmap;
      return bitmap;
    }).catch((error) => {
      if (this._resourceCache.get(cacheKey) === entry) this._resourceCache.delete(cacheKey);
      throw error;
    });
    this._resourceCache.set(cacheKey, entry);
    return entry.promise;
  }
  _drawFrame(frame, layersWithBitmaps) {
    const canvas = this._canvas;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("2D canvas context is not available");
    const facingLeft = this.getAttribute("facing") === "left";
    const mirror = Boolean(facingLeft) !== Boolean(frame.flip);
    const mirrorPivotX = frame.move?.[0] ?? 0;
    const layout = layoutFrame(frame, this._plan.zOrder, 0, 0);
    const drawItems = layout.drawOrder
      .map((item) => {
        const entry = layersWithBitmaps.find((candidate) => candidate.layer === item.layer);
        return entry ? { ...item, bitmap: entry.bitmap } : null;
      })
      .filter(Boolean);

    if (drawItems.length === 0) {
      this._clearCanvas();
      return;
    }

    const rects = drawItems.map((item) => mirror
      ? mirrorBounds(item, mirrorPivotX)
      : { left: item.left, right: item.left + item.width, top: item.top, bottom: item.top + item.height });
    const minX = Math.floor(Math.min(...rects.map((rect) => rect.left)));
    const maxX = Math.ceil(Math.max(...rects.map((rect) => rect.right)));
    const minY = Math.floor(Math.min(...rects.map((rect) => rect.top)));
    const maxY = Math.ceil(Math.max(...rects.map((rect) => rect.bottom)));
    const cssWidth = Math.max(1, maxX - minX);
    const cssHeight = Math.max(1, maxY - minY);
    const dpr = Math.max(1, Number(globalThis.devicePixelRatio) || 1);

    canvas.width = Math.ceil(cssWidth * dpr);
    canvas.height = Math.ceil(cssHeight * dpr);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    canvas.style.left = `${minX}px`;
    canvas.style.top = `${minY}px`;
    context.imageSmoothingEnabled = false;
    const translateX = mirror ? (2 * mirrorPivotX - minX) * dpr : -minX * dpr;
    context.setTransform(dpr, 0, 0, dpr, translateX, -minY * dpr);
    if (mirror) context.scale(-1, 1);

    for (const item of drawItems) {
      context.drawImage(item.bitmap, item.left, item.top, item.width, item.height);
    }
    if (layout.skipped.length > 0) this.setAttribute("data-skipped-layers", layout.skipped.join(","));
    else this.removeAttribute("data-skipped-layers");
  }

  _ensureAnimationLoop(action, frame) {
    const canAdvance = frameDuration(frame) > 0
      && (this._oneShotAction !== null || (action.loop && action.frames.length > 1));
    if (!canAdvance) {
      this._stopAnimation();
      return;
    }
    if (!this._animationHandle) {
      this._animationHandle = requestAnimationFrame((time) => this._tick(time));
    }
  }

  _tick(time) {
    this._animationHandle = 0;
    if (!this._connected || !this._plan || this._paintPending) return;
    const current = this._currentFrame();
    if (!current) return;
    if (this._lastTick === null) {
      this._lastTick = time;
      this._ensureAnimationLoop(current.action, current.frame);
      return;
    }
    const delta = Math.min(250, Math.max(0, time - this._lastTick));
    this._lastTick = time;
    this._elapsed += delta;

    let frame = current.frame;
    let duration = frameDuration(frame);
    let changed = false;
    let safety = 0;
    while (duration > 0 && this._elapsed >= duration && safety < 32) {
      this._elapsed -= duration;
      const isLast = this._frameIndex >= current.action.frames.length - 1;
      if (isLast && this._oneShotAction) {
        this._oneShotAction = null;
        this._activeActionName = null;
        this._frameIndex = 0;
        this._elapsed = 0;
        changed = true;
        break;
      }
      if (isLast && !current.action.loop) {
        this._frameIndex = current.action.frames.length - 1;
        this._elapsed = 0;
        this._stopAnimation();
        return;
      }
      this._frameIndex = isLast ? 0 : this._frameIndex + 1;
      frame = current.action.frames[this._frameIndex];
      duration = frameDuration(frame);
      changed = true;
      safety += 1;
      if (duration === 0) break;
    }

    if (changed) {
      this._lastTick = null;
      this._requestPaint();
    } else {
      this._ensureAnimationLoop(current.action, current.frame);
    }
  }
  _stopAnimation() {
    if (this._animationHandle) cancelAnimationFrame(this._animationHandle);
    this._animationHandle = 0;
    this._lastTick = null;
  }

  _clearCanvas() {
    if (!this._canvas) return;
    const context = this._canvas.getContext?.("2d");
    context?.clearRect(0, 0, this._canvas.width, this._canvas.height);
    this._canvas.width = 1;
    this._canvas.height = 1;
    this._canvas.style.width = "1px";
    this._canvas.style.height = "1px";
    this._canvas.style.left = "0px";
    this._canvas.style.top = "0px";
  }
}

if (globalThis.customElements && !customElements.get("cms-actor")) {
  customElements.define("cms-actor", CmsActor);
}
