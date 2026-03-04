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

                // 1. Mandatory Padding for MBC3/Pokemon Crystal
                const sizeCode = raw[0x0148];
                const expectedSize = 32768 << sizeCode;

                if (raw.length < expectedSize) {
                    console.log(`Auto-Fixing ROM Size: ${raw.length} -> ${expectedSize}`);
                    const padded = new Uint8Array(expectedSize).fill(0xFF);
                    padded.set(raw);
                    raw = padded;
                }

                this.originalBuffer = raw;
                this.workingBuffer = new Uint8Array([...this.originalBuffer]);
                this.populateBankDropdown();
                this.loadBank(0);
            } catch (err) {
                console.error("ROM Load Error:", err);
            }
        });

        // UI Listeners
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.onclick = () => {
                const target = btn.dataset.tab;
                document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.getElementById(target + 'View').classList.remove('hidden');
                btn.classList.add('active');
            };
        });

        document.getElementById('bankSelect').onchange = (e) => this.loadBank(parseInt(e.target.value));
        document.getElementById('runRom').onclick = () => this.bootEmulator();

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
            // 1. Convert to a standard Array - This is the most compatible format
            const romArray = Array.from(this.workingBuffer);

            // 2. Initialize Core with null data first to prevent constructor errors
            this.gb = new window.GameBoyCore(canvas, "");

            // 3. Manually inject the ROM and Hardware settings
            // This bypasses the buggy constructor logic
            this.gb.ROM = romArray;
            this.gb.useGBC = true;
            this.gb.cgb = true;
            
            // 4. Force Internal Initialization
            // Grant Galitz core usually has a 'start' or 'init' that needs the ROM
            this.gb.start(romArray);

            // 5. High-Frequency Execution Loop
            const emuStep = () => {
                if (this.gb) {
                    this.gb.run(); 
                    this.emuLoop = requestAnimationFrame(emuStep);
                }
            };
            this.emuLoop = requestAnimationFrame(emuStep);
            
            console.log("✅ Core forced start successful.");

        } catch (err) {
            console.error("Boot Failure:", err);
            // If the error says "start is not a method", we try the secondary boot method
            try {
                this.gb.init();
                console.log("Core initialized via .init()");
            } catch(e) {
                alert("Emulator Error: " + err.message);
            }
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
