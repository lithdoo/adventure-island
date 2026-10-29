// PWA installation-root binding for the shared no-op smoke Subsystem.
// The logical module must live inside the installation root; the shared
// implementation stays in systems/loomrealm-smoke/ so both platform entries
// represent the same empty test application.
export * from "../../../systems/loomrealm-smoke/subsystem.mjs";
export { default } from "../../../systems/loomrealm-smoke/subsystem.mjs";
