/**
 * @memdecks/mp-types — shared contracts for the memdecks game platform.
 *
 * This package contains ONLY types + a couple of const maps (no runtime logic), so it
 * is safe to depend on from both the browser (game client / Translator client) and
 * Node (mp-runtime). It is the single source of truth both the private core app and
 * every game depend on, which is what keeps the integration contract from drifting.
 */
export * from "./cards";
export * from "./match";
export * from "./game-module";
export * from "./bridge";
export * from "./protocol";
