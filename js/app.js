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
     * Diagnostic tool to verify that scripts in /lib/ are actually loaded
     */
    async runHealthCheck() {
        console.log("--- CodaRom System Health Check ---");
        const requirements = [
            { name: "GameBoyCore.js", check: () => typeof window.GameBoyCore !== 'undefined' },
            { name: "GameBoyIO.js", check: () => typeof window.GameBoyKeyInput !== 'undefined' },
            { name: "XAudioServer.js", check: () => typeof window.XAudioServer !== 'undefined' }
        ];

        let missing = [];
        requirements.forEach(lib => {
            if (lib.check()) {
                console.log(`✅ ${lib.name}: Loaded`);
            } else {
                console.warn(`❌ ${lib.name}: Missing from Global Scope`);
                missing.push(lib.name);
            }
        });

        if (missing.length > 0) {
            // Display error directly on UI for mobile QoL
            const msg = `CRITICAL ERROR: Missing ${missing.join(', ')}. \n\nCheck if your folder is named 'lib' or 'libs'. Your HTML expects 'lib/'.`;
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
            const buf = await file.arrayBuffer();
            this.originalBuffer = new Uint8Array(buf);
            this.workingBuffer = new Uint8Array([...this.originalBuffer]);
            this.populateBankDropdown();
            this.loadBank(0);
        });

        // Tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.target.dataset.tab;
                document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.getElementById(target + 'View').classList.remove('hidden');
                e.target.classList.add('active');
            });
        });

        document.getElementById('bankSelect').addEventListener('change', (e) => {
            this.loadBank(parseInt(e.target.value));
        });

        document.getElementById('runRom').addEventListener('click', () => {
            if (!this.workingBuffer) return alert("Upload ROM first");
            this.bootEmulator();
        });

        document.getElementById('exportIps').addEventListener('click', () => {
            if (!this.originalBuffer) return;
            const patch = Patcher.generateIPS(this.originalBuffer, this.workingBuffer);
            Patcher.downloadPatch(patch);
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
            opt.textContent = `Bank 0x${i.toString(16).toUpperCase()}`;
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
        if (this.emuLoop) clearInterval(this.emuLoop);

        try {
            // Using window context to ensure legacy compatibility
            this.gb = new window.GameBoyCore(canvas, "");
            this.gb.start(this.workingBuffer);
            this.emuLoop = setInterval(() => this.gb.run(), 16);
            console.log("Emulator running.");
        } catch (err) {
            console.error(err);
            alert("Boot failed. See console.");
        }
    }

    bindTouchControls() {
        const keys = {"btn-up":2,"btn-down":3,"btn-left":1,"btn-right":0,"btn-a":4,"btn-b":5,"btn-select":6,"btn-start":7};
        Object.entries(keys).forEach(([id, code]) => {
            const btn = document.getElementById(id);
            if (!btn) return;
            const press = (v) => { if(this.gb) this.gb.JoyPadEvent(code, v); };
            btn.onmousedown = btn.ontouchstart = (e) => { e.preventDefault(); press(true); };
            btn.onmouseup = btn.ontouchend = btn.onmouseleave = (e) => { e.preventDefault(); press(false); };
        });
    }
}

window.addEventListener('DOMContentLoaded', () => { new CodaRom(); });
