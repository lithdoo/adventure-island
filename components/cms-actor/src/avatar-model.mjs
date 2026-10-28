export const ANCHOR_PRIORITY = Object.freeze([
  "navel",
  "neck",
  "hand",
  "brow",
  "handMove",
]);

const CONTENT_VERSION_PATTERN = /^sha256:[0-9a-f]{64}$/;

function isFinitePair(value) {
  return Array.isArray(value)
    && value.length === 2
    && value.every((part) => typeof part === "number" && Number.isFinite(part));
}

function assert(condition, message) {
  if (!condition) throw new TypeError(`Invalid AvatarPlanV1: ${message}`);
}

/** Validate the renderer-ready, WZ-independent paper-doll plan. */
export function validateAvatarPlan(plan) {
  assert(plan && typeof plan === "object" && !Array.isArray(plan), "plan must be an object");
  assert(plan.formatVersion === 1, "formatVersion must be 1");
  assert(Array.isArray(plan.zOrder) && plan.zOrder.length > 0, "zOrder must be a non-empty array");
  assert(plan.zOrder.every((z) => typeof z === "string" && z.length > 0), "zOrder entries must be non-empty strings");
  assert(new Set(plan.zOrder).size === plan.zOrder.length, "zOrder entries must be unique");
  assert(plan.actions && typeof plan.actions === "object" && !Array.isArray(plan.actions), "actions must be an object");
  assert(Object.keys(plan.actions).length > 0, "actions must not be empty");
  if (plan.locomotionActions !== undefined) {
    assert(plan.locomotionActions && typeof plan.locomotionActions === "object" && !Array.isArray(plan.locomotionActions), "locomotionActions must be an object");
    for (const [state, actionName] of Object.entries(plan.locomotionActions)) {
      assert(["stand", "walk", "jump"].includes(state), `unsupported locomotionActions state: ${state}`);
      assert(typeof actionName === "string" && plan.actions[actionName], `locomotionActions.${state} must name an existing action`);
    }
  }

  for (const [actionName, action] of Object.entries(plan.actions)) {
    assert(actionName.length > 0, "action names must be non-empty");
    assert(action && typeof action === "object" && !Array.isArray(action), `${actionName} must be an object`);
    assert(typeof action.loop === "boolean", `${actionName}.loop must be boolean`);
    assert(Array.isArray(action.frames) && action.frames.length > 0, `${actionName}.frames must be non-empty`);

    for (const [frameIndex, frame] of action.frames.entries()) {
      const frameLabel = `${actionName}.frames[${frameIndex}]`;
      assert(frame && typeof frame === "object" && !Array.isArray(frame), `${frameLabel} must be an object`);
      if (frame.delay !== undefined) assert(typeof frame.delay === "number" && Number.isFinite(frame.delay), `${frameLabel}.delay must be finite`);
      if (frame.move !== undefined) assert(isFinitePair(frame.move), `${frameLabel}.move must be a finite pair`);
      if (frame.flip !== undefined) assert(typeof frame.flip === "boolean", `${frameLabel}.flip must be boolean`);
      assert(Array.isArray(frame.layers) && frame.layers.length > 0, `${frameLabel}.layers must be non-empty`);
      assert(frame.layers[0]?.id === "body", `${frameLabel}.layers[0] must be the body layer`);
      assert(new Set(frame.layers.map((layer) => layer?.id)).size === frame.layers.length, `${frameLabel}.layer ids must be unique`);

      for (const [layerIndex, layer] of frame.layers.entries()) {
        const label = `${frameLabel}.layers[${layerIndex}]`;
        assert(layer && typeof layer === "object" && !Array.isArray(layer), `${label} must be an object`);
        assert(typeof layer.id === "string" && layer.id.length > 0, `${label}.id must be non-empty`);
        assert(typeof layer.z === "string" && plan.zOrder.includes(layer.z), `${label}.z must appear in zOrder`);
        assert(Number.isInteger(layer.width) && layer.width > 0, `${label}.width must be a positive integer`);
        assert(Number.isInteger(layer.height) && layer.height > 0, `${label}.height must be a positive integer`);
        assert(isFinitePair(layer.origin), `${label}.origin must be a finite pair`);
        assert(layer.resource && typeof layer.resource === "object", `${label}.resource is required`);
        assert(typeof layer.resource.namespace === "string" && layer.resource.namespace.length > 0, `${label}.resource.namespace is required`);
        assert(typeof layer.resource.key === "string" && layer.resource.key.length > 0, `${label}.resource.key is required`);
        assert(typeof layer.resource.contentVersion === "string" && CONTENT_VERSION_PATTERN.test(layer.resource.contentVersion), `${label}.resource.contentVersion must be sha256:<64 lowercase hex>`);
        if (layer.anchors !== undefined) {
          assert(layer.anchors && typeof layer.anchors === "object" && !Array.isArray(layer.anchors), `${label}.anchors must be an object`);
          for (const [anchorName, point] of Object.entries(layer.anchors)) {
            assert(anchorName.length > 0 && isFinitePair(point), `${label}.anchors.${anchorName} must be a finite pair`);
          }
        }
      }
    }
  }
  return plan;
}

/** Map the small runtime vocabulary to the concrete WZ action name. */
export function resolveActionName(plan, locomotion = "stand") {
  const defaults = { stand: "stand1", walk: "walk1", jump: "jump" };
  const requested = plan?.locomotionActions?.[locomotion] ?? defaults[locomotion] ?? locomotion;
  if (plan?.actions?.[requested]) return requested;
  if (plan?.actions?.stand1) return "stand1";
  return Object.keys(plan?.actions ?? {})[0] ?? null;
}

export function frameDuration(frame) {
  const delay = frame?.delay;
  return typeof delay === "number" && Number.isFinite(delay) ? Math.abs(delay) : 0;
}

/**
 * Resolve WZ map anchors into actor-origin-relative canvas positions.
 * frame.layers is intentionally in anchor dependency order (body, head,
 * face/hair, then attached equipment); z-order is applied only afterwards.
 */
export function layoutFrame(frame, zOrder, x = 0, y = 0) {
  const knownAnchors = new Map();
  const positioned = [];
  const skipped = [];
  const moveX = frame.move?.[0] ?? 0;
  const moveY = frame.move?.[1] ?? 0;
  const base = { x: x + moveX, y: y + moveY };

  for (const [index, layer] of frame.layers.entries()) {
    let originX = base.x;
    let originY = base.y;
    let matchedAnchor = null;

    if (index > 0 && layer.anchors) {
      for (const name of ANCHOR_PRIORITY) {
        const local = layer.anchors[name];
        const global = knownAnchors.get(name);
        if (local && global) {
          originX = global[0] - local[0];
          originY = global[1] - local[1];
          matchedAnchor = name;
          break;
        }
      }
      if (Object.keys(layer.anchors).length > 0 && matchedAnchor === null) {
        skipped.push(layer.id);
        continue;
      }
    }

    const item = {
      layer,
      index,
      originX,
      originY,
      left: originX - layer.origin[0],
      top: originY - layer.origin[1],
      width: layer.width,
      height: layer.height,
      matchedAnchor,
    };
    positioned.push(item);

    for (const [name, local] of Object.entries(layer.anchors ?? {})) {
      if (!knownAnchors.has(name)) knownAnchors.set(name, [originX + local[0], originY + local[1]]);
    }
  }

  const orderIndex = new Map(zOrder.map((z, index) => [z, index]));
  // zOrder is front-to-back, so paint in reverse: back first, front last.
  const drawOrder = [...positioned].sort((a, b) => {
    const zDelta = orderIndex.get(b.layer.z) - orderIndex.get(a.layer.z);
    return zDelta || a.index - b.index;
  });

  return { positioned, drawOrder, skipped, anchors: knownAnchors };
}

/** Bounding box after reflecting one positioned image around the body origin. */
export function mirrorBounds(item, pivotX = 0) {
  return {
    left: 2 * pivotX - (item.left + item.width),
    right: 2 * pivotX - item.left,
    top: item.top,
    bottom: item.top + item.height,
  };
}
