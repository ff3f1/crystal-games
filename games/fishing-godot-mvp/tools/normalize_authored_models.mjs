#!/usr/bin/env node
// Convert independently authored meshopt/quantized CC0 GLBs to standard
// floating-point glTF geometry that Godot 4.5 can import. Does NOT simplify
// meshes, synthesize shapes, or flatten away real material surfaces.
import fs from "node:fs";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dequantize } from "@gltf-transform/functions";
import { MeshoptDecoder } from "meshoptimizer";

const [source, destination] = process.argv.slice(2);
if (!source || !destination) throw new Error("usage: normalize_authored_models.mjs input.glb output.glb");
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder });

const doc = await io.read(source);
const before = doc.getRoot().listExtensionsUsed().map((e) => e.extensionName);
await doc.transform(dequantize());
for (const extension of doc.getRoot().listExtensionsUsed()) {
  if (extension.extensionName === "EXT_meshopt_compression") extension.dispose();
}
await io.write(destination, doc);
const result = fs.readFileSync(destination);
if (result.length < 200 || result.toString("ascii", 0, 4) !== "glTF") {
  throw new Error("Failed to export valid uncompressed GLB " + destination);
}
const after = doc.getRoot().listExtensionsUsed().map((e) => e.extensionName);
if (after.includes("EXT_meshopt_compression") || after.includes("KHR_mesh_quantization")) {
  throw new Error("Incompatible geometry extensions remain: " + after);
}
console.log(JSON.stringify({
  model: source,
  uncompressed_bytes: result.length,
  meshes: doc.getRoot().listMeshes().length,
  materials: doc.getRoot().listMaterials().length,
  before,
  after
}));
