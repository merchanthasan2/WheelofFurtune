(() => {
            "use strict";

            const STORAGE_KEY = "ipn-catalyst-spin-wheel:v1";
            const TAU = Math.PI * 2;
            const POINTER_ANGLE = -Math.PI / 2;
            const DEFAULT_NAMES = [
                "Sarah Jenkins",
                "Michael Chang",
                "Amina Al-Mansoor",
                "David K.",
                "Elena Rostova",
                "Marcus Vance",
                "Yuki Sato",
                "Alex Rivera"
            ];

            const THEMES = {
                catalyst: {
                    label: "Catalyst",
                    colors: ["#0569a9", "#2f9134", "#f9ad19", "#dc4d91", "#6f50d4", "#1fa7dd", "#58c98a", "#f47b31"]
                },
                skyline: {
                    label: "Skyline",
                    colors: ["#255fcb", "#4fb8f4", "#98d8ff", "#f7c7e6", "#fff0ad", "#f88f45", "#0d7f6f", "#2a2e85"]
                },
                neon: {
                    label: "Neon",
                    colors: ["#00e5ff", "#ff2c9c", "#39ff8a", "#ffde59", "#8757ff", "#ff5a3d", "#21d4a8", "#3a86ff"]
                },
                gala: {
                    label: "Gala",
                    colors: ["#f7b733", "#fc4a1a", "#7f53ac", "#647dee", "#11998e", "#38ef7d", "#ef476f", "#26547c"]
                }
            };

            const state = {
                names: [...DEFAULT_NAMES],
                theme: "catalyst",
                soundEnabled: true,
                autoRemove: false,
                winnerLog: [],
                removedStack: [],
                currentRotation: 0,
                isSpinning: false,
                activeWinnerIndex: -1,
                activeWinnerName: "",
                latestWinner: "",
                pseudoFullscreen: false
            };

            const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
            let audioCtx = null;
            let spinAnimationId = 0;
            let confettiAnimationId = 0;
            let confettiParticles = [];
            let lastTickSegment = -1;
            let lastFocusedElement = null;
            let overlayHome = null;

            const elements = {
                namesInput: document.getElementById("namesInput"),
                entryCount: document.getElementById("entryCount"),
                entryStatus: document.getElementById("entryStatus"),
                themeGrid: document.getElementById("themeGrid"),
                removeWinnerCheck: document.getElementById("removeWinnerCheck"),
                shuffleBtn: document.getElementById("shuffleBtn"),
                resetBtn: document.getElementById("resetBtn"),
                clearListBtn: document.getElementById("clearListBtn"),
                importBtn: document.getElementById("importBtn"),
                importFile: document.getElementById("importFile"),
                exportBtn: document.getElementById("exportBtn"),
                undoRemoveBtn: document.getElementById("undoRemoveBtn"),
                clearHistoryBtn: document.getElementById("clearHistoryBtn"),
                winnerLog: document.getElementById("winnerLog"),
                fullscreenWinnerLog: document.getElementById("fullscreenWinnerLog"),
                fullscreenWinnerCount: document.getElementById("fullscreenWinnerCount"),
                wheelSection: document.getElementById("wheelSection"),
                wheelCanvas: document.getElementById("wheelCanvas"),
                spinBtn: document.getElementById("spinBtn"),
                spinAgainBtn: document.getElementById("spinAgainBtn"),
                liveStatusText: document.getElementById("liveStatusText"),
                latestWinner: document.getElementById("latestWinner"),
                soundToggleBtn: document.getElementById("soundToggleBtn"),
                soundToggleLabel: document.getElementById("soundToggleLabel"),
                soundIconUse: document.getElementById("soundIconUse"),
                fullscreenToggleBtn: document.getElementById("fullscreenToggleBtn"),
                fullscreenToggleLabel: document.getElementById("fullscreenToggleLabel"),
                fullscreenIconUse: document.getElementById("fullscreenIconUse"),
                closePseudoFsBtn: document.getElementById("closePseudoFsBtn"),
                storageStatus: document.getElementById("storageStatus"),
                winnerModal: document.getElementById("winnerModal"),
                winnerNameDisplay: document.getElementById("winnerNameDisplay"),
                winnerReveal: document.getElementById("winnerReveal"),
                stageWinnerName: document.getElementById("stageWinnerName"),
                stageWinnerCloseBtn: document.getElementById("stageWinnerCloseBtn"),
                stageWinnerSpinAgainBtn: document.getElementById("stageWinnerSpinAgainBtn"),
                modalCloseBtn: document.getElementById("modalCloseBtn"),
                modalRemoveBtn: document.getElementById("modalRemoveBtn"),
                modalSpinAgainBtn: document.getElementById("modalSpinAgainBtn"),
                confettiCanvas: document.getElementById("confettiCanvas")
            };

            overlayHome = elements.winnerModal.parentElement;

            const wheelCtx = elements.wheelCanvas.getContext("2d");
            const confettiCtx = elements.confettiCanvas.getContext("2d");

            init();

            function init() {
                restoreState();
                buildThemeButtons();
                bindEvents();
                renderAll();
                resizeCanvases();
            }

            function bindEvents() {
                elements.namesInput.addEventListener("input", () => {
                    state.names = parseNames(elements.namesInput.value);
                    persist();
                    renderAll();
                });

                elements.wheelCanvas.addEventListener("click", spin);
                elements.spinBtn.addEventListener("click", spin);
                elements.spinAgainBtn.addEventListener("click", spin);
                elements.shuffleBtn.addEventListener("click", shuffleNames);
                elements.resetBtn.addEventListener("click", resetDefaults);
                elements.clearListBtn.addEventListener("click", clearNames);
                elements.importBtn.addEventListener("click", () => elements.importFile.click());
                elements.importFile.addEventListener("change", importEntries);
                elements.exportBtn.addEventListener("click", exportEntries);
                elements.undoRemoveBtn.addEventListener("click", undoRemoval);
                elements.clearHistoryBtn.addEventListener("click", clearHistory);

                elements.removeWinnerCheck.addEventListener("change", () => {
                    state.autoRemove = elements.removeWinnerCheck.checked;
                    persist();
                });

                elements.soundToggleBtn.addEventListener("click", () => {
                    state.soundEnabled = !state.soundEnabled;
                    if (state.soundEnabled) {
                        ensureAudio();
                        playTone(520, 0.05, "triangle", 0.07);
                    }
                    persist();
                    renderSoundState();
                });

                elements.fullscreenToggleBtn.addEventListener("click", toggleFullscreen);
                elements.closePseudoFsBtn.addEventListener("click", disablePseudoFullscreen);
                document.addEventListener("fullscreenchange", handleFullscreenChange);
                window.addEventListener("resize", resizeCanvases);

                elements.modalCloseBtn.addEventListener("click", () => closeWinnerModal(false, false));
                elements.modalRemoveBtn.addEventListener("click", () => closeWinnerModal(true, false));
                elements.modalSpinAgainBtn.addEventListener("click", () => closeWinnerModal(false, true));
                elements.stageWinnerCloseBtn.addEventListener("click", () => closeWinnerModal(false, false));
                elements.stageWinnerSpinAgainBtn.addEventListener("click", () => closeWinnerModal(false, true));

                elements.winnerModal.addEventListener("click", (event) => {
                    if (event.target === elements.winnerModal) {
                        closeWinnerModal(false, false);
                    }
                });

                window.addEventListener("keydown", handleKeydown);
            }

            function restoreState() {
                try {
                    const raw = localStorage.getItem(STORAGE_KEY);
                    if (!raw) {
                        return;
                    }
                    const saved = JSON.parse(raw);
                    if (Array.isArray(saved.names)) {
                        state.names = cleanNames(saved.names);
                    }
                    if (THEMES[saved.theme]) {
                        state.theme = saved.theme;
                    }
                    if (typeof saved.soundEnabled === "boolean") {
                        state.soundEnabled = saved.soundEnabled;
                    }
                    if (typeof saved.autoRemove === "boolean") {
                        state.autoRemove = saved.autoRemove;
                    }
                    if (Array.isArray(saved.winnerLog)) {
                        state.winnerLog = saved.winnerLog
                            .filter((item) => item && typeof item.name === "string")
                            .slice(0, 18);
                    }
                    if (typeof saved.latestWinner === "string") {
                        state.latestWinner = saved.latestWinner;
                    }
                } catch (error) {
                    console.warn("Could not restore saved spin wheel state.", error);
                }
            }

            function persist() {
                try {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify({
                        names: state.names,
                        theme: state.theme,
                        soundEnabled: state.soundEnabled,
                        autoRemove: state.autoRemove,
                        winnerLog: state.winnerLog.slice(0, 18),
                        latestWinner: state.latestWinner
                    }));
                    elements.storageStatus.textContent = "Saved locally";
                } catch (error) {
                    elements.storageStatus.textContent = "Local save unavailable";
                    console.warn("Could not save spin wheel state.", error);
                }
            }

            function buildThemeButtons() {
                elements.themeGrid.textContent = "";
                Object.entries(THEMES).forEach(([key, theme]) => {
                    const button = document.createElement("button");
                    button.type = "button";
                    button.className = "theme-btn";
                    button.dataset.theme = key;
                    button.setAttribute("role", "option");
                    button.setAttribute("aria-selected", key === state.theme ? "true" : "false");
                    button.title = theme.label + " theme";

                    const swatch = document.createElement("span");
                    swatch.className = "swatch";
                    theme.colors.slice(0, 4).forEach((color) => {
                        const square = document.createElement("span");
                        square.style.background = color;
                        swatch.appendChild(square);
                    });

                    const label = document.createElement("span");
                    label.textContent = theme.label;

                    button.append(swatch, label);
                    button.addEventListener("click", () => {
                        state.theme = key;
                        persist();
                        renderThemeState();
                        drawWheel();
                    });
                    elements.themeGrid.appendChild(button);
                });
            }

            function renderAll() {
                elements.namesInput.value = state.names.join("\n");
                elements.removeWinnerCheck.checked = state.autoRemove;
                renderEntryMeta();
                renderThemeState();
                renderSoundState();
                renderHistory();
                renderUndoState();
                elements.latestWinner.textContent = state.latestWinner || "No winner yet";
                setLiveStatus(state.names.length ? "Ready to spin" : "Add entries to spin");
                drawWheel();
            }

            function renderEntryMeta() {
                const count = state.names.length;
                elements.entryCount.textContent = String(count);

                const duplicateCount = countDuplicates(state.names);
                const longCount = state.names.filter((name) => name.length > 34).length;
                const messages = [];
                let tone = "";

                if (count === 0) {
                    messages.push("No entries loaded.");
                    tone = "is-error";
                } else if (count === 1) {
                    messages.push("One entry loaded.");
                    tone = "is-warn";
                } else {
                    messages.push(count + " entries ready.");
                    tone = "is-ok";
                }

                if (duplicateCount) {
                    messages.push(duplicateCount + " duplicate" + (duplicateCount === 1 ? "" : "s") + " kept.");
                    tone = "is-warn";
                }
                if (longCount) {
                    messages.push(longCount + " long label" + (longCount === 1 ? "" : "s") + " shortened on the wheel.");
                }
                if (count > 60) {
                    messages.push("Dense wheel mode active.");
                    tone = "is-warn";
                }

                elements.entryStatus.className = "status-line " + tone;
                elements.entryStatus.textContent = messages.join(" ");

                const hasNames = count > 0;
                elements.shuffleBtn.disabled = count < 2 || state.isSpinning;
                elements.exportBtn.disabled = !hasNames;
                elements.clearListBtn.disabled = !hasNames || state.isSpinning;
                elements.spinBtn.disabled = !hasNames || state.isSpinning;
                elements.spinAgainBtn.disabled = !hasNames || state.isSpinning;
                elements.resetBtn.disabled = state.isSpinning;
            }

            function renderThemeState() {
                elements.themeGrid.querySelectorAll(".theme-btn").forEach((button) => {
                    const active = button.dataset.theme === state.theme;
                    button.classList.toggle("is-active", active);
                    button.setAttribute("aria-selected", active ? "true" : "false");
                });
            }

            function renderSoundState() {
                elements.soundToggleBtn.setAttribute("aria-pressed", state.soundEnabled ? "true" : "false");
                elements.soundToggleLabel.textContent = state.soundEnabled ? "Sound on" : "Muted";
                elements.soundIconUse.setAttribute("href", state.soundEnabled ? "#icon-volume" : "#icon-muted");
            }

            function renderHistory() {
                renderHistoryList(elements.winnerLog, "No winners recorded");
                renderHistoryList(elements.fullscreenWinnerLog, "No winners yet");
                elements.fullscreenWinnerCount.textContent = String(state.winnerLog.length);
                elements.clearHistoryBtn.disabled = !state.winnerLog.length;
            }

            function renderHistoryList(container, emptyText) {
                container.textContent = "";
                if (!state.winnerLog.length) {
                    const empty = document.createElement("div");
                    empty.className = "empty-note";
                    empty.textContent = emptyText;
                    container.appendChild(empty);
                    return;
                }

                state.winnerLog.forEach((item, index) => {
                    const chip = document.createElement("div");
                    chip.className = "history-chip";
                    chip.title = item.name;

                    const rank = document.createElement("strong");
                    rank.textContent = String(index + 1);

                    const label = document.createElement("span");
                    label.textContent = item.name;

                    chip.append(rank, label);
                    container.appendChild(chip);
                });
            }

            function renderUndoState() {
                elements.undoRemoveBtn.disabled = !state.removedStack.length || state.isSpinning;
            }

            function resizeCanvases() {
                resizeWheelCanvas();
                resizeConfettiCanvas();
                drawWheel();
            }

            function resizeWheelCanvas() {
                const rect = elements.wheelCanvas.getBoundingClientRect();
                const size = Math.max(280, Math.floor(Math.min(rect.width || 600, rect.height || 600)));
                const dpr = Math.min(window.devicePixelRatio || 1, 2);
                elements.wheelCanvas.width = Math.floor(size * dpr);
                elements.wheelCanvas.height = Math.floor(size * dpr);
                wheelCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
                elements.wheelCanvas.dataset.size = String(size);
            }

            function resizeConfettiCanvas() {
                const dpr = Math.min(window.devicePixelRatio || 1, 2);
                elements.confettiCanvas.width = Math.floor(window.innerWidth * dpr);
                elements.confettiCanvas.height = Math.floor(window.innerHeight * dpr);
                confettiCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
            }

            function drawWheel() {
                const size = Number(elements.wheelCanvas.dataset.size) || 600;
                const center = size / 2;
                const radius = center - 12;
                const names = state.names;
                const colors = THEMES[state.theme].colors;

                wheelCtx.clearRect(0, 0, size, size);

                wheelCtx.save();
                wheelCtx.translate(center, center);

                drawOuterShadow(wheelCtx, radius);

                if (!names.length) {
                    drawEmptyWheel(wheelCtx, radius);
                    wheelCtx.restore();
                    return;
                }

                const arc = TAU / names.length;
                for (let i = 0; i < names.length; i += 1) {
                    const start = state.currentRotation + i * arc;
                    const end = start + arc;
                    const color = colors[i % colors.length];

                    wheelCtx.beginPath();
                    wheelCtx.moveTo(0, 0);
                    wheelCtx.arc(0, 0, radius, start, end);
                    wheelCtx.closePath();
                    wheelCtx.fillStyle = color;
                    wheelCtx.fill();

                    wheelCtx.lineWidth = names.length > 48 ? 0.8 : 2;
                    wheelCtx.strokeStyle = "rgba(5, 7, 13, 0.42)";
                    wheelCtx.stroke();

                    drawSliceHighlight(wheelCtx, start, end, radius);
                    drawWheelLabel(wheelCtx, names[i], color, start + arc / 2, radius, names.length);
                }

                drawWheelRims(wheelCtx, radius);
                wheelCtx.restore();
            }

            function drawOuterShadow(ctx, radius) {
                const grad = ctx.createRadialGradient(0, 0, radius * 0.2, 0, 0, radius);
                grad.addColorStop(0, "rgba(255,255,255,0.08)");
                grad.addColorStop(0.62, "rgba(255,255,255,0.02)");
                grad.addColorStop(1, "rgba(0,0,0,0.34)");
                ctx.beginPath();
                ctx.arc(0, 0, radius, 0, TAU);
                ctx.fillStyle = grad;
                ctx.fill();
            }

            function drawEmptyWheel(ctx, radius) {
                ctx.beginPath();
                ctx.arc(0, 0, radius, 0, TAU);
                ctx.fillStyle = "#101b2d";
                ctx.fill();
                ctx.lineWidth = 10;
                ctx.strokeStyle = "rgba(169,205,255,0.18)";
                ctx.stroke();

                ctx.fillStyle = "#9fb1c8";
                ctx.font = "800 16px Arial, sans-serif";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText("Add entries", 0, -8);
                ctx.font = "700 12px Arial, sans-serif";
                ctx.fillStyle = "#687c99";
                ctx.fillText("One per line", 0, 16);
            }

            function drawSliceHighlight(ctx, start, end, radius) {
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.arc(0, 0, radius, start, end);
                ctx.closePath();
                const highlight = ctx.createRadialGradient(0, 0, radius * 0.08, 0, 0, radius);
                highlight.addColorStop(0, "rgba(255,255,255,0.24)");
                highlight.addColorStop(0.55, "rgba(255,255,255,0.03)");
                highlight.addColorStop(1, "rgba(0,0,0,0.16)");
                ctx.fillStyle = highlight;
                ctx.fill();
            }

            function drawWheelLabel(ctx, rawName, color, angle, radius, count) {
                if (count > 72) {
                    return;
                }

                const name = truncateLabel(rawName, count);
                const fontSize = Math.max(10, Math.min(18, Math.floor(260 / Math.max(count, 8))));
                const textRadius = radius - Math.max(44, Math.min(80, radius * 0.16));
                const flip = Math.cos(angle) < 0;

                ctx.save();
                ctx.rotate(angle);
                if (flip) {
                    ctx.rotate(Math.PI);
                    ctx.textAlign = "left";
                } else {
                    ctx.textAlign = "right";
                }
                ctx.textBaseline = "middle";
                ctx.font = "900 " + fontSize + "px Arial, sans-serif";
                ctx.fillStyle = isLightColor(color) ? "#06101d" : "#ffffff";
                ctx.shadowColor = isLightColor(color) ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.3)";
                ctx.shadowBlur = 2;
                ctx.fillText(name, flip ? -textRadius : textRadius, 0);
                ctx.restore();
            }

            function drawWheelRims(ctx, radius) {
                ctx.beginPath();
                ctx.arc(0, 0, radius, 0, TAU);
                ctx.lineWidth = 9;
                ctx.strokeStyle = "rgba(5, 7, 13, 0.5)";
                ctx.stroke();

                ctx.beginPath();
                ctx.arc(0, 0, radius - 10, 0, TAU);
                ctx.lineWidth = 2;
                ctx.strokeStyle = "rgba(255,255,255,0.34)";
                ctx.stroke();

                ctx.beginPath();
                ctx.arc(0, 0, radius * 0.19, 0, TAU);
                ctx.fillStyle = "#07101d";
                ctx.fill();
                ctx.lineWidth = 3;
                ctx.strokeStyle = "rgba(255,255,255,0.22)";
                ctx.stroke();
            }

            function spin() {
                if (state.isSpinning || !state.names.length) {
                    if (!state.names.length) {
                        setEntryStatus("Add entries before spinning.", "is-error");
                        setLiveStatus("Add entries to spin");
                    }
                    return;
                }

                ensureAudio();

                const winnerIndex = randomIndex(state.names.length);
                const arc = TAU / state.names.length;
                const winnerCenter = winnerIndex * arc + arc / 2;
                const startRotation = state.currentRotation;
                const baseTarget = POINTER_ANGLE - winnerCenter;
                const rotations = randomRange(6, 9);
                const minTarget = startRotation + rotations * TAU;
                const turnsToAdd = Math.ceil((minTarget - baseTarget) / TAU);
                const targetRotation = baseTarget + turnsToAdd * TAU;
                const duration = reducedMotion.matches ? 900 : randomRange(4700, 6200);
                const startTime = performance.now();

                state.isSpinning = true;
                state.activeWinnerIndex = winnerIndex;
                lastTickSegment = calculateWinnerIndex();
                elements.spinBtn.classList.add("is-busy");
                setLiveStatus("Spinning");
                renderEntryMeta();
                renderUndoState();
                stopConfetti();

                cancelAnimationFrame(spinAnimationId);

                const frame = (now) => {
                    const progress = clamp((now - startTime) / duration, 0, 1);
                    const eased = easeOutCubic(progress);
                    state.currentRotation = startRotation + (targetRotation - startRotation) * eased;
                    drawWheel();
                    triggerSegmentTick();

                    if (progress < 1) {
                        spinAnimationId = requestAnimationFrame(frame);
                        return;
                    }

                    state.currentRotation = targetRotation;
                    state.isSpinning = false;
                    elements.spinBtn.classList.remove("is-busy");
                    renderEntryMeta();
                    renderUndoState();
                    drawWheel();
                    declareWinner(calculateWinnerIndex());
                };

                spinAnimationId = requestAnimationFrame(frame);
            }

            function triggerSegmentTick() {
                if (!state.names.length) {
                    return;
                }
                const segment = calculateWinnerIndex();
                if (segment !== lastTickSegment) {
                    lastTickSegment = segment;
                    playTone(620 + (segment % 5) * 38, 0.025, "square", 0.035);
                }
            }

            function calculateWinnerIndex() {
                if (!state.names.length) {
                    return -1;
                }
                const arc = TAU / state.names.length;
                const relative = normalizeAngle(POINTER_ANGLE - state.currentRotation);
                return Math.min(state.names.length - 1, Math.floor(relative / arc));
            }

            function declareWinner(index) {
                const winnerIndex = index >= 0 ? index : state.activeWinnerIndex;
                const winner = state.names[winnerIndex];
                if (!winner) {
                    return;
                }

                state.activeWinnerIndex = winnerIndex;
                state.activeWinnerName = winner;
                state.latestWinner = winner;
                state.winnerLog.unshift({ name: winner, at: new Date().toISOString() });
                state.winnerLog = state.winnerLog.slice(0, 18);
                persist();
                renderHistory();
                elements.latestWinner.textContent = winner;
                setLiveStatus("Winner selected");
                showWinnerModal(winner);
                playWinnerSound();
                startConfetti();
            }

            function showWinnerModal(name) {
                lastFocusedElement = document.activeElement;
                elements.winnerNameDisplay.textContent = name;
                elements.stageWinnerName.textContent = name;
                elements.winnerReveal.classList.add("is-open");
                elements.winnerModal.classList.add("is-open");
                if (document.fullscreenElement || state.pseudoFullscreen) {
                    elements.stageWinnerSpinAgainBtn.focus();
                } else {
                    elements.modalSpinAgainBtn.focus();
                }
            }

            function closeWinnerModal(forceRemove, spinAfterClose) {
                const modalOpen = elements.winnerModal.classList.contains("is-open");
                const revealOpen = elements.winnerReveal.classList.contains("is-open");
                if (!modalOpen && !revealOpen) {
                    return;
                }

                elements.winnerModal.classList.remove("is-open");
                elements.winnerReveal.classList.remove("is-open");
                stopConfetti();

                const shouldRemove = (forceRemove || state.autoRemove) && state.activeWinnerIndex > -1;
                if (shouldRemove) {
                    removeWinnerAt(state.activeWinnerIndex);
                }

                state.activeWinnerIndex = -1;
                state.activeWinnerName = "";
                persist();
                renderAll();

                if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
                    lastFocusedElement.focus();
                }

                if (spinAfterClose) {
                    window.setTimeout(spin, 120);
                }
            }

            function removeWinnerAt(index) {
                if (index < 0 || index >= state.names.length) {
                    return;
                }
                const removed = state.names.splice(index, 1)[0];
                state.removedStack.unshift({ name: removed, index });
                state.removedStack = state.removedStack.slice(0, 10);
                setEntryStatus("Removed " + removed + ".", "is-ok");
            }

            function shuffleNames() {
                if (state.names.length < 2 || state.isSpinning) {
                    return;
                }
                for (let i = state.names.length - 1; i > 0; i -= 1) {
                    const j = randomIndex(i + 1);
                    [state.names[i], state.names[j]] = [state.names[j], state.names[i]];
                }
                persist();
                renderAll();
                setEntryStatus("List shuffled.", "is-ok");
                playTone(440, 0.05, "triangle", 0.06);
            }

            function resetDefaults() {
                if (state.isSpinning) {
                    return;
                }
                state.names = [...DEFAULT_NAMES];
                state.removedStack = [];
                persist();
                renderAll();
                setEntryStatus("Default entries restored.", "is-ok");
            }

            function clearNames() {
                if (state.isSpinning || !state.names.length) {
                    return;
                }
                state.names = [];
                state.removedStack = [];
                persist();
                renderAll();
                setEntryStatus("Entries cleared.", "is-warn");
            }

            function undoRemoval() {
                if (!state.removedStack.length || state.isSpinning) {
                    return;
                }
                const item = state.removedStack.shift();
                const index = clamp(item.index, 0, state.names.length);
                state.names.splice(index, 0, item.name);
                persist();
                renderAll();
                setEntryStatus("Restored " + item.name + ".", "is-ok");
            }

            function clearHistory() {
                state.winnerLog = [];
                state.latestWinner = "";
                persist();
                renderHistory();
                elements.latestWinner.textContent = "No winner yet";
                setLiveStatus(state.names.length ? "Ready to spin" : "Add entries to spin");
            }

            function importEntries(event) {
                const file = event.target.files && event.target.files[0];
                if (!file) {
                    return;
                }
                const reader = new FileReader();
                reader.onload = () => {
                    state.names = parseNames(String(reader.result || ""));
                    state.removedStack = [];
                    persist();
                    renderAll();
                    setEntryStatus("Imported " + state.names.length + " entries.", state.names.length ? "is-ok" : "is-warn");
                    elements.importFile.value = "";
                };
                reader.onerror = () => {
                    setEntryStatus("Import failed.", "is-error");
                    elements.importFile.value = "";
                };
                reader.readAsText(file);
            }

            function exportEntries() {
                if (!state.names.length) {
                    return;
                }
                const blob = new Blob([state.names.join("\n") + "\n"], { type: "text/plain;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = "spin-wheel-entries.txt";
                document.body.appendChild(link);
                link.click();
                link.remove();
                window.setTimeout(() => URL.revokeObjectURL(url), 500);
                setEntryStatus("Entries exported.", "is-ok");
            }

            function toggleFullscreen() {
                if (document.fullscreenElement || state.pseudoFullscreen) {
                    if (document.fullscreenElement) {
                        document.exitFullscreen().catch(disablePseudoFullscreen);
                    } else {
                        disablePseudoFullscreen();
                    }
                    return;
                }

                moveOverlaysIntoFullscreen();
                elements.wheelSection.requestFullscreen()
                    .catch(() => {
                        restoreOverlays();
                        enablePseudoFullscreen();
                    });
            }

            function enablePseudoFullscreen() {
                state.pseudoFullscreen = true;
                elements.wheelSection.classList.add("is-pseudo-fullscreen");
                handleFullscreenChange();
                window.setTimeout(resizeCanvases, 60);
            }

            function disablePseudoFullscreen() {
                state.pseudoFullscreen = false;
                elements.wheelSection.classList.remove("is-pseudo-fullscreen");
                handleFullscreenChange();
                window.setTimeout(resizeCanvases, 60);
            }

            function handleFullscreenChange() {
                const active = Boolean(document.fullscreenElement) || state.pseudoFullscreen;
                if (document.fullscreenElement) {
                    moveOverlaysIntoFullscreen();
                } else if (!state.pseudoFullscreen) {
                    restoreOverlays();
                }
                elements.fullscreenToggleBtn.setAttribute("aria-pressed", active ? "true" : "false");
                elements.fullscreenToggleLabel.textContent = active ? "Exit full screen" : "Full screen";
                elements.fullscreenIconUse.setAttribute("href", active ? "#icon-minimize" : "#icon-maximize");
                window.setTimeout(resizeCanvases, 80);
            }

            function moveOverlaysIntoFullscreen() {
                if (elements.winnerModal.parentElement !== elements.wheelSection) {
                    elements.wheelSection.append(elements.confettiCanvas, elements.winnerModal);
                }
            }

            function restoreOverlays() {
                if (!overlayHome || elements.winnerModal.parentElement === overlayHome) {
                    return;
                }
                overlayHome.append(elements.confettiCanvas, elements.winnerModal);
            }

            function handleKeydown(event) {
                const modalOpen = elements.winnerModal.classList.contains("is-open");
                if (event.key === "Escape") {
                    if (modalOpen) {
                        event.preventDefault();
                        closeWinnerModal(false, false);
                        return;
                    }
                    if (state.pseudoFullscreen) {
                        event.preventDefault();
                        disablePseudoFullscreen();
                    }
                    return;
                }

                if (modalOpen && event.key === "Tab") {
                    trapModalFocus(event);
                    return;
                }

                if ((event.key === " " || event.key === "Enter") && !isTextEditingTarget(event.target)) {
                    event.preventDefault();
                    spin();
                }
            }

            function trapModalFocus(event) {
                const focusables = Array.from(elements.winnerModal.querySelectorAll("button"));
                if (!focusables.length) {
                    return;
                }
                const first = focusables[0];
                const last = focusables[focusables.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            }

            function ensureAudio() {
                if (!state.soundEnabled) {
                    return null;
                }
                if (!audioCtx) {
                    const AudioContext = window.AudioContext || window.webkitAudioContext;
                    if (!AudioContext) {
                        return null;
                    }
                    audioCtx = new AudioContext();
                }
                if (audioCtx.state === "suspended") {
                    audioCtx.resume().catch(() => {});
                }
                return audioCtx;
            }

            function playTone(frequency, duration, type, volume) {
                if (!state.soundEnabled) {
                    return;
                }
                const ctx = ensureAudio();
                if (!ctx) {
                    return;
                }
                const oscillator = ctx.createOscillator();
                const gain = ctx.createGain();
                const now = ctx.currentTime;
                oscillator.type = type;
                oscillator.frequency.setValueAtTime(frequency, now);
                oscillator.frequency.exponentialRampToValueAtTime(Math.max(80, frequency * 0.62), now + duration);
                gain.gain.setValueAtTime(volume, now);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
                oscillator.connect(gain);
                gain.connect(ctx.destination);
                oscillator.start(now);
                oscillator.stop(now + duration);
            }

            function playWinnerSound() {
                if (!state.soundEnabled) {
                    return;
                }
                const ctx = ensureAudio();
                if (!ctx) {
                    return;
                }
                const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
                const now = ctx.currentTime;
                notes.forEach((frequency, index) => {
                    const oscillator = ctx.createOscillator();
                    const gain = ctx.createGain();
                    const start = now + index * 0.075;
                    oscillator.type = index % 2 ? "triangle" : "sine";
                    oscillator.frequency.setValueAtTime(frequency, start);
                    gain.gain.setValueAtTime(0.12, start);
                    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.32);
                    oscillator.connect(gain);
                    gain.connect(ctx.destination);
                    oscillator.start(start);
                    oscillator.stop(start + 0.34);
                });
            }

            function startConfetti() {
                stopConfetti();
                if (reducedMotion.matches) {
                    return;
                }

                const colors = THEMES[state.theme].colors;
                const amount = Math.min(180, Math.max(90, window.innerWidth / 8));
                for (let i = 0; i < amount; i += 1) {
                    confettiParticles.push({
                        x: randomRange(0, window.innerWidth),
                        y: randomRange(-window.innerHeight * 0.35, -20),
                        size: randomRange(5, 11),
                        width: randomRange(4, 9),
                        color: colors[randomIndex(colors.length)],
                        speedX: randomRange(-2.4, 2.4),
                        speedY: randomRange(3.2, 7.4),
                        rotation: randomRange(0, 360),
                        rotationSpeed: randomRange(-7, 7),
                        life: randomRange(90, 180)
                    });
                }
                animateConfetti();
                window.setTimeout(stopConfetti, 5200);
            }

            function stopConfetti() {
                cancelAnimationFrame(confettiAnimationId);
                confettiParticles = [];
                confettiCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
            }

            function animateConfetti() {
                confettiCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
                confettiParticles = confettiParticles.filter((particle) => particle.life > 0);

                confettiParticles.forEach((particle) => {
                    particle.x += particle.speedX;
                    particle.y += particle.speedY;
                    particle.rotation += particle.rotationSpeed;
                    particle.speedY += 0.035;
                    particle.life -= 1;

                    confettiCtx.save();
                    confettiCtx.translate(particle.x, particle.y);
                    confettiCtx.rotate((particle.rotation * Math.PI) / 180);
                    confettiCtx.fillStyle = particle.color;
                    confettiCtx.globalAlpha = clamp(particle.life / 50, 0, 1);
                    confettiCtx.fillRect(-particle.width / 2, -particle.size / 2, particle.width, particle.size);
                    confettiCtx.restore();
                });

                if (confettiParticles.length) {
                    confettiAnimationId = requestAnimationFrame(animateConfetti);
                } else {
                    confettiCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
                }
            }

            function parseNames(value) {
                return cleanNames(String(value || "").split(/\r?\n|,/));
            }

            function cleanNames(list) {
                return list
                    .map((name) => String(name).replace(/\s+/g, " ").trim())
                    .filter(Boolean)
                    .slice(0, 240);
            }

            function countDuplicates(list) {
                const seen = new Map();
                let duplicates = 0;
                list.forEach((name) => {
                    const key = name.toLocaleLowerCase();
                    const current = seen.get(key) || 0;
                    if (current === 1) {
                        duplicates += 1;
                    }
                    seen.set(key, current + 1);
                });
                return duplicates;
            }

            function truncateLabel(name, count) {
                const limit = count > 36 ? 7 : count > 18 ? 11 : 20;
                if (name.length <= limit) {
                    return name;
                }
                return name.slice(0, Math.max(3, limit - 3)).trim() + "...";
            }

            function isLightColor(hex) {
                const clean = hex.replace("#", "");
                const r = parseInt(clean.slice(0, 2), 16);
                const g = parseInt(clean.slice(2, 4), 16);
                const b = parseInt(clean.slice(4, 6), 16);
                return (r * 299 + g * 587 + b * 114) / 1000 > 154;
            }

            function normalizeAngle(angle) {
                return ((angle % TAU) + TAU) % TAU;
            }

            function easeOutCubic(value) {
                return 1 - Math.pow(1 - value, 3);
            }

            function clamp(value, min, max) {
                return Math.min(max, Math.max(min, value));
            }

            function randomRange(min, max) {
                return min + Math.random() * (max - min);
            }

            function randomIndex(max) {
                if (max <= 1) {
                    return 0;
                }
                if (window.crypto && window.crypto.getRandomValues) {
                    const range = 0x100000000;
                    const limit = Math.floor(range / max) * max;
                    const buffer = new Uint32Array(1);
                    let value;
                    do {
                        window.crypto.getRandomValues(buffer);
                        value = buffer[0];
                    } while (value >= limit);
                    return value % max;
                }
                return Math.floor(Math.random() * max);
            }

            function setEntryStatus(message, tone) {
                elements.entryStatus.className = "status-line " + (tone || "");
                elements.entryStatus.textContent = message;
            }

            function setLiveStatus(message) {
                elements.liveStatusText.textContent = message;
            }

            function isTextEditingTarget(target) {
                if (!target) {
                    return false;
                }
                const tag = target.tagName;
                return tag === "TEXTAREA" || tag === "INPUT" || target.isContentEditable;
            }
        })();

