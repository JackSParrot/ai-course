import { GeneticTrainer } from "./training-engine.js";

// El navegador ejecuta este archivo aparte para que los botones sigan respondiendo.
let trainer = null;
let mode = "paused";
let timer = null;
let lastUpdate = 0;
let pace = "fast";

function send() {
  postMessage({ kind: "state", running: mode !== "paused", mode, state: trainer.snapshot() });
  lastUpdate = performance.now();
}

function pause() {
  mode = "paused";
  clearTimeout(timer);
  timer = null;
}

function batch() {
  if (!trainer || mode === "paused") return;
  try {
    const phase = trainer.phase;
    if (phase === "evaluate") {
      // Trabajar en bloques cortos permite recibir Pausar sin esperar a la generación.
      const until = performance.now() + 12;
      let steps = 0;
      do { trainer.tick(); steps++; }
      while (trainer.phase === "evaluate" && performance.now() < until && (pace === "fast" || steps < 4));
    } else if (phase === "select") trainer.select();
    else if (phase === "reproduce") trainer.reproduce();

    const changed = trainer.phase !== phase;
    if (trainer.phase === "complete" || (changed && mode === "step")) pause();
    if (changed || performance.now() - lastUpdate > 100) send();
    if (mode !== "paused") timer = setTimeout(batch, changed ? 650 : pace === "watch" ? 16 : 0);
  } catch (error) {
    pause();
    postMessage({ kind: "error", message: error.message });
  }
}

self.addEventListener("message", event => {
  try {
    const { command } = event.data;
    if (command === "init") {
      pause();
      trainer = new GeneticTrainer(event.data.setup);
      pace = event.data.pace === "watch" ? "watch" : "fast";
      send();
    } else if (command === "pace") {
      pace = event.data.pace === "watch" ? "watch" : "fast";
    } else if (command === "pause") {
      pause();
      if (trainer) send();
    } else if (command === "step" || command === "auto") {
      if (!trainer || trainer.phase === "complete") return;
      pause();
      mode = command;
      send();
      timer = setTimeout(batch, 0);
    }
  } catch (error) {
    pause();
    postMessage({ kind: "error", message: error.message });
  }
});
