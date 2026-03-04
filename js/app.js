import { VRAMViewer } from './vram_viewer.js';
import { Patcher } from './patcher.js';

export class CodaRom {
    constructor() {
        this.originalBuffer = null;
        this.workingBuffer = null;
        this.currentBankOffset = 0;
        this.viewer = new VRAMViewer('tileCanvas');
        this.gb = null;
        this.emuLoop = null; // Changed to hold requestAnimationFrame ID
        this.init();
    }

    /**
     * Diagnostic tool to verify that scripts in /lib/ are actually loaded.
     */
    async runHealthCheck() {
        console.log("--- CodaRom System Health Check ---");
        const requirements = [
            { name: "GameBoyCore.js", check: () => typeof window.GameBoyCore === 'function' },
            { name: "GameBoyIO.js", check: () => typeof window.GameBoyKeyInput === 'function' || (window.GameBoyCore && window.GameBoyCore.prototype.JoyPadEvent) },
            { name: "XAudioServer.js", check: () => typeof window.XAudioServer === 'function' }
        ];

        let results = [];
        let missing = [];

        requirements.forEach(lib => {
            const isLoaded = lib.check();
            results.push({ Library: lib.name, Status: isLoaded ? "✅ Loaded" : "❌ Missing" });
            if (!isLoaded) missing.push(lib.name);
        });

        console.table(results);

        if (missing.length > 0) {
            const msg = `CRITICAL ERROR: Missing dependencies:\n\n${missing.join('\n')}\n\nCheck folder naming (lib vs libs) and case-sensitivity.`;
            alert(msg);
            return false;
        }
        return true;
    }

    async init() {
        const healthy = await this.runHealthCheck();
        if (!healthy) return;

        // ROM Upload
        document.getElementById('romUpload').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const label = document.querySelector('label[for="bankSelect"]');
            label.textContent = "Loading ROM...";

            try {
                const buf = await file.arrayBuffer();
                this.originalBuffer = new Uint8Array(buf);
                this.workingBuffer = new Uint8Array([...this.originalBuffer]);
                
                this.populateBankDropdown();
                this.loadBank(0);
                
                label.textContent = "Bank Explorer:";
                console.log("ROM Ready.");
            } catch (err) {
                console.error("ROM Load Error:", err);
                label.textContent = "Load Failed!";
            }
        });

        // Tabs Logic
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.target.dataset.tab;
                document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.getElementById(target + 'View').classList.remove('hidden');
                e.target.classList.add('active');
            });
        });

        // Bank Selection
        document.getElementById('bankSelect').addEventListener('change', (e) => {
            const val = parseInt(e.target.value);
            if (!isNaN(val)) this.loadBank(val);
        });

        // Emulator Control
        document.getElementById('runRom').addEventListener('click', () => {
            if (!this.workingBuffer) return alert("Please upload a ROM first!");
            this.bootEmulator();
        });

        // IPS Export
        document.getElementById('exportIps').addEventListener('click', () => {
            if (!this.originalBuffer || !this.workingBuffer) return;
            const patch = Patcher.generateIPS(this.originalBuffer, this.workingBuffer);
            Patcher.downloadPatch(patch, "CodaRom_v04.ips");
        });

        this.bindTouchControls();
    }

    populateBankDropdown() {
        const select = document.getElementById('bankSelect');
        select.innerHTML = "";
        const count = Math.ceil(this.originalBuffer.length / 0x4000);
        for (let i = 0; i < count; i++) {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = `Bank 0x${i.toString(16).toUpperCase().padStart(2, '0')}`;
            select.appendChild(opt);
        }
    }

    loadBank(idx) {
        this.currentBankOffset = idx * 0x4000;
        document.getElementById('bankSelect').value = idx;
        this.viewer.renderBank(this.workingBuffer, this.currentBankOffset);
    }

    bootEmulator() {
        const canvas = document.getElementById('emuCanvas');
        
        // Stop any existing loop
        if (this.emuLoop) {
            cancelAnimationFrame(this.emuLoop);
        }

        try {
            console.log("Starting Emulator Boot Sequence...");

            // Ensure the canvas is correctly sized
            canvas.width = 160;
            canvas.height = 144;

            // Instantiate Core
            // Note: Some versions of GameBoyCore require the canvas, 
            // and an optional "options" object or rom string.
            this.gb = new window.GameBoyCore(canvas, "");
            
            // Start the core with the buffer
            this.gb.start(this.workingBuffer);
            
            // Animation loop using requestAnimationFrame for better mobile performance
            const emuStep = () => {
                if (this.gb) {
                    this.gb.run();
                    this.emuLoop = requestAnimationFrame(emuStep);
                }
            };

            this.emuLoop = requestAnimationFrame(emuStep);
            console.log("✅ Emulator engine live.");
            
        } catch (err) {
            console.error("Emulator Crash:", err);
            // If the error is still {}, try to stringify or log the keys
            alert("Boot Failed! " + (err.message || "Unknown Core Error"));
        }
    }

    bindTouchControls() {
        const keys = {
            "btn-up": 2, "btn-down": 3, "btn-left": 1, "btn-right": 0,
            "btn-a": 4, "btn-b": 5, "btn-select": 6, "btn-start": 7
        };

        Object.entries(keys).forEach(([id, code]) => {
            const btn = document.getElementById(id);
            if (!btn) return;

            const handleAction = (isPressed) => {
                if (this.gb) this.gb.JoyPadEvent(code, isPressed);
            };

            btn.addEventListener('touchstart', (e) => { e.preventDefault(); handleAction(true); }, {passive: false});
            btn.addEventListener('touchend', (e) => { e.preventDefault(); handleAction(false); }, {passive: false});
            btn.addEventListener('mousedown', (e) => { e.preventDefault(); handleAction(true); });
            btn.addEventListener('mouseup', (e) => { e.preventDefault(); handleAction(false); });
            btn.addEventListener('mouseleave', (e) => { handleAction(false); });
        });
    }
}

window.addEventListener('DOMContentLoaded', () => { 
    window.App = new CodaRom(); 
});
