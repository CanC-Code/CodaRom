import { VRAMViewer } from './vram_viewer.js';
import { Patcher } from './patcher.js';

export class CodaRom {
    constructor() {
        this.originalBuffer = null;
        this.workingBuffer = null;
        this.viewer = new VRAMViewer('tileCanvas');
        this.gb = null;
        this.emuLoop = null;
        this.init();
    }

    async init() {
        document.getElementById('romUpload').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const arrayBuffer = await file.arrayBuffer();
                let raw = new Uint8Array(arrayBuffer);

                // 1. HEADER-BASED REPAIR
                // Pokemon Crystal (MBC3) must be exactly 2MB.
                const sizeCode = raw[0x0148];
                const expectedSize = 32768 << sizeCode;

                if (raw.length < expectedSize) {
                    console.log(`Pading ROM: ${raw.length} -> ${expectedSize}`);
                    const padded = new Uint8Array(expectedSize).fill(0xFF);
                    padded.set(raw);
                    raw = padded;
                }

                this.originalBuffer = raw;
                this.workingBuffer = new Uint8Array([...this.originalBuffer]);

                this.populateBankDropdown();
                this.loadBank(0);
            } catch (err) {
                console.error("Load Error:", err);
            }
        });

        // Tab Switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.onclick = () => {
                const target = btn.dataset.tab;
                document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.getElementById(target + 'View').classList.remove('hidden');
                btn.classList.add('active');
            };
        });

        document.getElementById('bankSelect').onchange = (e) => {
            this.loadBank(parseInt(e.target.value));
        };

        document.getElementById('runRom').onclick = () => {
            if (!this.workingBuffer) return alert("Upload ROM first!");
            this.bootEmulator();
        };

        this.bindTouchControls();
    }

    populateBankDropdown() {
        const select = document.getElementById('bankSelect');
        select.innerHTML = "";
        const count = this.workingBuffer.length / 0x4000;
        for (let i = 0; i < count; i++) {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = `Bank 0x${i.toString(16).toUpperCase().padStart(2, '0')}`;
            select.appendChild(opt);
        }
    }

    loadBank(idx) {
        this.viewer.renderBank(this.workingBuffer, idx * 0x4000);
    }

    bootEmulator() {
        const canvas = document.getElementById('emuCanvas');
        if (this.emuLoop) cancelAnimationFrame(this.emuLoop);

        try {
            // 1. Prepare Buffer: Some versions of GameBoyCore prefer a standard Array
            const romData = Array.from(this.workingBuffer);

            // 2. Initialize Core
            // If GameBoyCore(canvas, data) fails, it might need GameBoyCore(canvas, data, options)
            this.gb = new window.GameBoyCore(canvas, romData);

            // 3. HARDWARE CONFIGURATION
            // Pokemon Crystal MUST have CGB (Color) mode enabled or it stays white.
            this.gb.useGBC = true;
            this.gb.cgb = true;
            this.gb.cartridgeType = this.workingBuffer[0x0147];
            
            // Bypass potential audio-lock
            if (this.gb.registerAudioBuffer) this.gb.registerAudioBuffer();

            // 4. START ENGINE
            this.gb.start();

            // 5. IMPROVED EXECUTION LOOP
            // We force a high-priority loop to ensure frames are actually pushed to canvas
            const emuStep = () => {
                if (this.gb) {
                    // Run logic until a frame is ready
                    this.gb.run();
                    this.emuLoop = requestAnimationFrame(emuStep);
                }
            };
            this.emuLoop = requestAnimationFrame(emuStep);
            
            console.log("✅ Emulator Loop Active");

        } catch (err) {
            console.error("Boot failure:", err);
            alert("Emulator Error: " + err.message);
        }
    }

    bindTouchControls() {
        const keys = { "btn-up": 2, "btn-down": 3, "btn-left": 1, "btn-right": 0, "btn-a": 4, "btn-b": 5 };
        Object.entries(keys).forEach(([id, code]) => {
            const btn = document.getElementById(id);
            if (!btn) return;
            const handle = (isPressed) => { if (this.gb) this.gb.JoyPadEvent(code, isPressed); };
            btn.addEventListener('touchstart', (e) => { e.preventDefault(); handle(true); }, {passive: false});
            btn.addEventListener('touchend', (e) => { e.preventDefault(); handle(false); }, {passive: false});
        });
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.CodaApp = new CodaRom();
});
