import test from "node:test";
import assert from "node:assert/strict";
import {
  frameDuration,
  layoutFrame,
  mirrorBounds,
  resolveActionName,
  validateAvatarPlan,
} from "../src/avatar-model.mjs";

const version = `sha256:${"a".repeat(64)}`;
const resource = { namespace: "图", key: "Look/00002000/stand1/0/body", contentVersion: version };

function layer(id, z, origin, anchors = {}) {
  return { id, z, resource: { ...resource, key: `${resource.key}/${id}` }, width: 24, height: 32, origin, anchors };
}

function plan() {
  return {
    formatVersion: 1,
    zOrder: ["hair", "face", "head", "body"],
    locomotionActions: { stand: "stand1", walk: "stand1", jump: "jump" },
    actions: {
      stand1: { loop: true, frames: [{ delay: 500, layers: [
        layer("body", "body", [12, 32], { neck: [-4, -32], navel: [-6, -20] }),
        layer("head", "head", [12, 12], { neck: [-4, -10], brow: [0, -7] }),
        layer("face", "face", [6, 5], { brow: [0, -5] }),
        layer("hair", "hair", [12, 10], { brow: [0, -8] }),
      ] }] },
      jump: { loop: false, frames: [{ delay: -200, move: [0, -4], layers: [layer("body", "body", [12, 32])] }] },
    },
  };
}

test("accepts a renderer-ready AvatarPlanV1", () => {
  assert.equal(validateAvatarPlan(plan()).formatVersion, 1);
});

test("rejects a resource without a SHA-256 content version", () => {
  const candidate = plan();
  candidate.actions.stand1.frames[0].layers[0].resource.contentVersion = "v079";
  assert.throws(() => validateAvatarPlan(candidate), /contentVersion/);
});

test("rejects a layer whose z is absent from the authoritative order", () => {
  const candidate = plan();
  candidate.actions.stand1.frames[0].layers[0].z = "unknown-layer";
  assert.throws(() => validateAvatarPlan(candidate), /z must appear in zOrder/);
});

test("maps body, head, face and hair by shared WZ anchors", () => {
  const candidate = plan();
  const frame = candidate.actions.stand1.frames[0];
  const result = layoutFrame(frame, candidate.zOrder);
  const byId = new Map(result.positioned.map((item) => [item.layer.id, item]));
  assert.deepEqual([byId.get("body").originX, byId.get("body").originY], [0, 0]);
  assert.deepEqual([byId.get("head").originX, byId.get("head").originY], [0, -22]);
  assert.deepEqual([byId.get("face").originX, byId.get("face").originY], [0, -24]);
  assert.deepEqual([byId.get("hair").originX, byId.get("hair").originY], [0, -21]);
  assert.equal(result.skipped.length, 0);
});

test("paints back-to-front while keeping z-order separate from anchor order", () => {
  const candidate = plan();
  const result = layoutFrame(candidate.actions.stand1.frames[0], candidate.zOrder);
  assert.deepEqual(result.drawOrder.map((item) => item.layer.id), ["body", "head", "face", "hair"]);
});

test("applies frame move to this frame only and does not mutate source data", () => {
  const candidate = plan();
  const frame = candidate.actions.jump.frames[0];
  const before = structuredClone(frame);
  const result = layoutFrame(frame, candidate.zOrder, 100, 80);
  assert.deepEqual([result.positioned[0].originX, result.positioned[0].originY], [100, 76]);
  assert.deepEqual(frame, before);
});

test("uses WZ delay magnitude and resolves adapter-selected locomotion actions", () => {
  const candidate = plan();
  assert.equal(frameDuration({ delay: -200 }), 200);
  assert.equal(frameDuration({}), 0);
  assert.equal(resolveActionName(candidate, "stand"), "stand1");
  assert.equal(resolveActionName(candidate, "walk"), "stand1");
  assert.equal(resolveActionName(candidate, "jump"), "jump");
  candidate.actions.stand2 = candidate.actions.stand1;
  candidate.locomotionActions.stand = "stand2";
  assert.equal(resolveActionName(candidate, "stand"), "stand2");
});

test("skips a layer whose required anchor cannot be resolved", () => {
  const candidate = plan();
  const frame = candidate.actions.stand1.frames[0];
  frame.layers.push(layer("detached", "head", [12, 12], { missing: [0, 0] }));
  const result = layoutFrame(frame, candidate.zOrder);
  assert.deepEqual(result.skipped, ["detached"]);
});

test("mirrors a layer around the frame body origin, including frame move", () => {
  const rect = { left: 8, top: -20, width: 10, height: 12 };
  assert.deepEqual(mirrorBounds(rect, 3), { left: -12, right: -2, top: -20, bottom: -8 });
});
