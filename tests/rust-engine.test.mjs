import test from "node:test";import assert from "node:assert/strict";import {isRustEngineBuilt,runRustEngine} from "../scripts/rust-engine.mjs";
test("Rust bridge rejects malformed requests",async()=>{await assert.rejects(runRustEngine(null),TypeError);await assert.rejects(runRustEngine({}),TypeError);});
test("Rust bridge reports missing build explicitly",async()=>{if(!(await isRustEngineBuilt()))await assert.rejects(runRustEngine({op:"health"}),e=>e.code==="RUST_ENGINE_NOT_BUILT");});
test("Rust bridge health-checks compiled engine",async()=>{if(await isRustEngineBuilt()){const r=await runRustEngine({op:"health"});assert.equal(r.ok,true);assert.equal(r.result.status,"ready");}});
