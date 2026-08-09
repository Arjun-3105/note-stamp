# LearnLoop STEM Vertical — Technical Addition Spec

## 0. Framing

The current architecture (Next.js + Appwrite + dual-model LLM orchestration + direct context injection) is sound infrastructure. It is not, on its own, a differentiator — any competitor can stand up the same pipeline in a sprint. The additions below are chosen against one filter:

> **Would this feature exist, unchanged, in a general "learn anything" wrapper?**
> If yes → it's UI polish. Cut it or deprioritize it.
> If no, because it depends on deterministic, checkable domain logic → it's real product.

Every section below is split into **Verification Layer** (the part competitors can't copy with a prompt) and **UI Layer** (the part that makes the verification usable). UI is never proposed without a verification layer underneath it.

---

## 1. Math & Whiteboard Module

### 1.1 What NOT to build
Skip freehand handwriting recognition (MyScript, vision-model OCR of handwriting) for v1. It's a multi-month accuracy problem and every error reads as *your* bug, not the student's. Skip Manim — it's a batch animation renderer for pre-scripted videos, not a live interactive surface; wrong tool for "AI checks your work as you go."

### 1.2 Verification Layer (the actual moat)
- **Symbolic engine**: [SymPy](https://www.sympy.org/) (Python microservice) or [math.js](https://mathjs.org/) / [Algebrite](https://algebrite.org/) if you want to stay in the Node process. Use it to check step-to-step algebraic equivalence, not just final-answer string matching.
- **Step-checking, not answer-checking**: parse each line of student work into a symbolic expression, verify line *n+1* is derivable from line *n*. This is what lets you claim "grades your work," not "grades your final number."
- **LLM's job is narration only**: once the symbolic engine has located *which* step is wrong, hand that fact to the LLM and ask it to explain why — don't let the LLM decide correctness. This split is the defensible claim.

### 1.3 UI Layer
- **Equation input**: [MathQuill](http://mathquill.com/) or [MathLive](https://cortexjs.io/mathlive/) — structured math input, exports to LaTeX/MathML that SymPy can parse directly. Reliable, no OCR risk.
- **Rendering**: [KaTeX](https://katex.org/) (faster) or MathJax for displaying LaTeX in cards, chat, and quiz content.
- **Graphing**: [Desmos API](https://www.desmos.com/api/v1/graphing-calculator/docs/index) — free, embeddable, mature. Don't build your own plotter; this is pure rendering, zero differentiation from hand-rolling it.
- **Whiteboard canvas** (for diagrams/scratch work, not handwriting recognition): [tldraw](https://tldraw.dev/) or [Excalidraw](https://excalidraw.com/) — both open source, both embeddable, both give you a real canvas without committing to OCR.

### 1.4 New data model
```
StudentWorkAttempt {
  problemId, workspaceId,
  steps: [{ latex, symbolicForm, verifiedCorrect, errorAt? }],
  finalAnswerCorrect: bool,
  confidenceScore: number  // from your existing dual-model pattern, reused here
}
```

---

## 2. Coding Sandbox with Execution Visualization

### 2.1 What NOT to build
Don't write your own multi-language tracer on day one. Language-by-language instrumentation is a large surface area; Python's `sys.settrace` is easy, C/Java/JS each need separate approaches. **Ship Python-only first.**

### 2.2 Verification Layer
- **Execution sandboxing**: [Pyodide](https://pyodide.org/) (client-side, WASM Python — no server cost, instant feedback) for simple cases; [Judge0](https://github.com/judge0/judge0) (self-hostable, open source) when you need real isolation, resource limits, or multi-language later.
- **Frame-by-frame state capture**: Python's built-in `sys.settrace` / `bdb` module captures variable state, call stack, and line position at every step — this is exactly what [Python Tutor](http://pythontutor.com/) (open source, MIT-licensed core visualization logic) already does. Don't reinvent this; study or adapt their trace-capture approach directly.
- **Auto-graded test execution**: run student code against hidden test cases server-side (via the same sandbox), not "LLM reads your code and guesses if it's right." This is the coding-sandbox equivalent of the math step-checker.

### 2.3 UI Layer
- **Code editor**: [Monaco Editor](https://microsoft.github.io/monaco-editor/) (same engine as VS Code) or [CodeMirror 6](https://codemirror.net/) — both open source, both have first-class syntax highlighting and inline diagnostics support.
- **Variable state visualization**: [D3.js](https://d3js.org/) for a step-through variable inspector (you already depend on graph-layout logic via Dagre for concept maps — this is the same skill applied to execution frames instead of concept nodes).
- **Recursion / call-stack visualization**: render the captured call stack as a ladder (stack frames stacking/unstacking per step) or a tree (each recursive call as a node) using D3 or your existing ReactFlow setup — you already have ReactFlow wired in for concept maps, so this reuses existing infra rather than adding a new dependency.
- **Playback controls**: step forward/back through captured trace frames — this is just an index into a pre-computed array of states, no new backend complexity once tracing works.

### 2.4 New data model
```
ExecutionTrace {
  submissionId,
  frames: [{ line, variables: {}, callStack: [], event: "call"|"return"|"line" }],
  testResults: [{ testCaseId, passed, actualOutput, expectedOutput }]
}
```

---

## 3. Mastery / Learner State Layer (cross-cutting, benefits both modules above)

This is the piece that turns "stateless LLM wrapper" into "adaptive system," and it's mostly instrumentation of things you already compute.

- You already list `ts-fsrs`-style spaced repetition intent in prior discussion — wire actual FSRS state into the system prompt, not just the flashcard scheduler.
- **Knowledge graph per learner**: extend your existing `concept-map` / `prerequisite-map` subsystem (already using ReactFlow + Dagre) to store a per-student mastery score on each node, not just a static curriculum graph. You already have the graph *shape* — you're missing the *state* layered on top of it.
- **Mastery gating**: use the existing prerequisite DAG to lock downstream concepts until upstream mastery crosses a threshold. This reuses `prerequisite-map` infrastructure you've already built; it's a gating rule, not a new subsystem.

```
ConceptMastery {
  studentId, conceptId,
  masteryScore: number,       // 0–1
  stability: number,          // FSRS parameter
  lastReviewed: timestamp,
  sourceOfMastery: "quiz" | "sandbox_trace" | "step_verification"
}
```

Note the `sourceOfMastery` field — because you now have *two* new verification layers (math step-checking, code test execution), mastery evidence is no longer just quiz scores. This is a claim general "learn anything" apps structurally cannot make, because they have no domain-specific ground truth to draw mastery signal from.

---

## 4. Updated API Surface

| Route | Method | Purpose |
|---|---|---|
| `/api/math/verify-step` | POST | SymPy-backed step verification for whiteboard work |
| `/api/math/graph` | GET | Desmos graph config generation from a parsed expression |
| `/api/sandbox/execute` | POST | Run code in Pyodide/Judge0, return trace frames |
| `/api/sandbox/trace` | GET | Fetch stored execution trace for playback |
| `/api/mastery/update` | POST | Update `ConceptMastery` from a verified event (quiz, step-check, test pass) |
| `/api/mastery/gate-check` | GET | Check whether a concept's prerequisites are satisfied for a student |

---

## 5. Build Sequencing (solo dev, realistic)

1. **Python-only sandbox with trace visualization** (biggest reuse of existing OSS: Pyodide + Python Tutor's approach) — highest leverage, lowest novel-engineering risk.
2. **Math step-verification with structured input** (MathLive + SymPy) — skip Desmos/graphing until the checker itself works; graphing is cosmetic on top of correctness.
3. **Mastery layer wiring** — smallest net-new code since it extends `concept-map`/`prerequisite-map` you already have; highest strategic value because it's what makes both modules feel adaptive rather than one-off.
4. **Desmos integration + whiteboard canvas (tldraw/Excalidraw)** — once correctness-checking exists underneath, the visual layer has something real to sit on top of.
5. **Freehand handwriting / multi-language sandbox** — explicitly v2+. Both are the features that demo well and generalize badly; defer until the verified-core is solid.

---

## 6. Summary: Why This Isn't "Just UI"

| Feature | UI-only version (wrapper trap) | With verification layer (defensible) |
|---|---|---|
| Whiteboard | Canvas that sends a screenshot to GPT-4V and asks "is this right?" | SymPy checks each step; LLM only narrates a result you already computed |
| Graphing | Desmos embed with no connection to correctness | Graph generated *from* the verified symbolic expression |
| Code sandbox | LLM reads code, guesses bugs in prose | Real execution, real test cases, real captured trace — bugs are located, not guessed |
| Recursion viz | Animated illustration for effect | Actual call-stack frames from instrumented execution |
| Mastery tracking | "Great job!" streak counter | FSRS-backed score gated against a real prerequisite graph, with evidence sourced from verified events |

The rule holds throughout: **every visual feature should be a window onto a computation you can defend, not a layer painted over LLM output.**