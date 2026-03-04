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

                const sizeCode = raw[0x0148];
                const expectedSize = 32768 << sizeCode;

                if (raw.length < expectedSize) {
                    console.log(`Padding ROM to ${expectedSize} bytes...`);
                    const padded = new Uint8Array(expectedSize).fill(0);
                    padded.set(raw);
                    raw = padded;
                }

                this.originalBuffer = raw;
                this.workingBuffer = new Uint8Array([...this.originalBuffer]);

                this.populateBankDropdown();
                this.loadBank(0);
                console.log("ROM Ready.");
            } catch (err) {
                console.error("ROM Load Error:", err);
            }
        });

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
            if (!this.workingBuffer) return alert("Please upload a ROM first.");
            
            // CRITICAL: Resume Audio Context on user gesture
            if (window.AudioContext || window.webkitAudioContext) {
                const context = new (window.AudioContext || window.webkitAudioContext)();
                if (context.state === 'suspended') context.resume();
            }

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
            // 1. Setup Canvas dimensions
            canvas.width = 160;
            canvas.height = 144;

            // 2. Convert to Binary String
            let binaryString = "";
            for (let i = 0; i < this.workingBuffer.length; i++) {
                binaryString += String.fromCharCode(this.workingBuffer[i]);
            }

            // 3. Initialize Core
            this.gb = new window.GameBoyCore(canvas, binaryString);
            
            // 4. Force GBC Mode manually before start
            this.gb.useGBC = true;
            this.gb.cgb = true;
            
            // 5. Grant Galitz Core: Start and immediately trigger the run loop
            this.gb.start();
            
            // 6. Robust Animation Loop
            const emuStep = () => {
                if (this.gb) {
                    // Execute frames until the internal buffer is satisfied
                    // This bypasses the "white screen" caused by the engine 
                    // waiting for an external timer that doesn't exist in mobile web
                    this.gb.run(); 
                    this.emuLoop = requestAnimationFrame(emuStep);
                }
            };
            this.emuLoop = requestAnimationFrame(emuStep);
            
            console.log("Boot sequence complete. Engine loop running.");

        } catch (err) {
            console.error("Boot Failure:", err);
            alert("Emulator Error: " + err.message);
        }
    }

    bindTouchControls() {
        const keys = {
            "btn-up": 2, "btn-down": 3, "btn-left": 1, "btn-right": 0,
            "btn-a": 4, "btn-b": 5
        };
        Object.entries(keys).forEach(([id, code]) => {
            const btn = document.getElementById(id);
            if (!btn) return;
            const handle = (isPressed) => { 
                if (this.gb) this.gb.JoyPadEvent(code, isPressed); 
            };
            btn.addEventListener('touchstart', (e) => { e.preventDefault(); handle(true); }, {passive: false});
            btn.addEventListener('touchend', (e) => { e.preventDefault(); handle(false); }, {passive: false});
            btn.addEventListener('mousedown', (e) => { e.preventDefault(); handle(true); });
            btn.addEventListener('mouseup', (e) => { e.preventDefault(); handle(false); });
        });
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.CodaApp = new CodaRom();
});
