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
        // ROM Upload Handler
        document.getElementById('romUpload').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const arrayBuffer = await file.arrayBuffer();
                let raw = new Uint8Array(arrayBuffer);

                // --- FORCE POKEMON CRYSTAL SIZE (2MB) ---
                // Header at 0x0148 determines the size. We force it here.
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
                console.log("ROM Prepared and Buffered.");
            } catch (err) {
                console.error("ROM Load Error:", err);
            }
        });

        // UI Tabs
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
            // Reset Canvas
            canvas.width = 160;
            canvas.height = 144;

            // Grant Galitz's Core requires the ROM as a binary string or specialized array
            // We convert our Uint8Array to a binary string for maximum compatibility
            let binaryString = "";
            for (let i = 0; i < this.workingBuffer.length; i++) {
                binaryString += String.fromCharCode(this.workingBuffer[i]);
            }

            // Initialize the Core
            this.gb = new window.GameBoyCore(canvas, binaryString);
            
            // Explicitly enable GBC mode
            this.gb.cGBC = true;
            this.gb.useGBC = true;

            // Start the engine
            this.gb.start();
            
            const emuStep = () => {
                if (this.gb && (this.gb.stopEmulator & 2) === 0) {
                    this.gb.run();
                    this.emuLoop = requestAnimationFrame(emuStep);
                }
            };
            this.emuLoop = requestAnimationFrame(emuStep);
            console.log("Emulator Started.");

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
            btn.addEventListener('touchstart', (e) => { e.preventDefault(); handle(true); });
            btn.addEventListener('touchend', (e) => { e.preventDefault(); handle(false); });
        });
    }
}

// Ensure the class is instantiated
window.CodaApp = new CodaRom();
