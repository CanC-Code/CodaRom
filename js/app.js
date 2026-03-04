import { VRAMViewer } from './vram_viewer.js';
import { Patcher } from './patcher.js';

export class CodaRom {
    constructor() {
        this.originalBuffer = null;
        this.workingBuffer = null;
        this.currentBankOffset = 0;
        this.viewer = new VRAMViewer('tileCanvas');
        this.gb = null;
        this.emuLoop = null;
        this.init();
    }

    /**
     * Diagnostic tool to verify that scripts in /lib/ are actually loaded.
     * Updated to check for specific GameBoy-Online class constructors.
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
            const msg = `CRITICAL ERROR: The following files failed to load from /lib/:\n\n${missing.join('\n')}\n\nCheck your file paths and case-sensitivity!`;
            alert(msg);
            return false;
        }
        return true;
    }

    async init() {
        // Run health check. If libraries are missing, we stop here to prevent silent crashes.
        const healthy = await this.runHealthCheck();
        if (!healthy) {
            console.error("Initialization aborted due to missing dependencies.");
            return;
        }

        // ROM Upload
        document.getElementById('romUpload').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // Simple UI feedback during load
            const label = document.querySelector('label[for="bankSelect"]');
            label.textContent = "Loading ROM...";

            try {
                const buf = await file.arrayBuffer();
                this.originalBuffer = new Uint8Array(buf);
                this.workingBuffer = new Uint8Array([...this.originalBuffer]);
                
                this.populateBankDropdown();
                this.loadBank(0);
                
                label.textContent = "Bank Explorer:";
                console.log("ROM Buffer ready for editing.");
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
            try {
                const patch = Patcher.generateIPS(this.originalBuffer, this.workingBuffer);
                Patcher.downloadPatch(patch, "CodaRom_v04.ips");
            } catch (err) {
                alert("IPS Generation failed: " + err.message);
            }
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
        // Trigger the VRAM viewer to render the tiles for the selected bank
        this.viewer.renderBank(this.workingBuffer, this.currentBankOffset);
    }

    bootEmulator() {
        const canvas = document.getElementById('emuCanvas');
        if (this.emuLoop) clearInterval(this.emuLoop);

        try {
            // Instantiate the GameBoyCore from the global window scope
            this.gb = new window.GameBoyCore(canvas, "");
            this.gb.start(this.workingBuffer);
            
            // Run at ~60 FPS
            this.emuLoop = setInterval(() => {
                this.gb.run();
            }, 16);
            
            console.log("Emulator engine started with working buffer.");
        } catch (err) {
            console.error("Emulator Crash:", err);
            alert("Emulator Boot Failed! Check the console for internal engine errors.");
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

            // Prevent default to stop scrolling/zooming while playing
            btn.addEventListener('touchstart', (e) => { e.preventDefault(); handleAction(true); });
            btn.addEventListener('touchend', (e) => { e.preventDefault(); handleAction(false); });
            btn.addEventListener('mousedown', (e) => { e.preventDefault(); handleAction(true); });
            btn.addEventListener('mouseup', (e) => { e.preventDefault(); handleAction(false); });
            btn.addEventListener('mouseleave', (e) => { if(this.gb) handleAction(false); });
        });
    }
}

// Global Startup
window.addEventListener('DOMContentLoaded', () => { 
    window.App = new CodaRom(); 
});
