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

    async runHealthCheck() {
        console.log("--- CodaRom System Health Check ---");
        const requirements = [
            { name: "GameBoyCore.js", check: () => typeof window.GameBoyCore === 'function' },
            { name: "GameBoyIO.js", check: () => typeof window.GameBoyKeyInput === 'function' || (window.GameBoyCore && window.GameBoyCore.prototype.JoyPadEvent) },
            { name: "XAudioServer.js", check: () => typeof window.XAudioServer === 'function' }
        ];

        let missing = [];
        requirements.forEach(lib => {
            if (!lib.check()) missing.push(lib.name);
        });

        if (missing.length > 0) {
            alert(`Missing dependencies: ${missing.join(', ')}`);
            return false;
        }
        return true;
    }

    async init() {
        const healthy = await this.runHealthCheck();
        if (!healthy) return;

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
            } catch (err) {
                label.textContent = "Load Failed!";
            }
        });

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
            const val = parseInt(e.target.value);
            if (!isNaN(val)) this.loadBank(val);
        });

        document.getElementById('runRom').addEventListener('click', () => {
            if (!this.workingBuffer) return alert("Upload ROM first");
            this.bootEmulator();
        });

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
        if (this.emuLoop) cancelAnimationFrame(this.emuLoop);

        try {
            console.log("Analyzing Header & Preparing Buffer...");
            
            // 1. Calculate required size from Header [0x0148]
            // Game Boy ROMs are 32KB * (2 ^ sizeCode)
            const sizeCode = this.workingBuffer[0x0148];
            const expectedSize = 32768 << sizeCode;
            
            let bootBuffer = this.workingBuffer;

            // 2. Auto-Padding for Trimmed ROMs
            if (this.workingBuffer.length < expectedSize) {
                console.warn(`Padding ROM: ${this.workingBuffer.length} -> ${expectedSize}`);
                bootBuffer = new Uint8Array(expectedSize);
                bootBuffer.fill(0xFF); // Fill with standard empty ROM data
                bootBuffer.set(this.workingBuffer);
            }

            // 3. Setup Canvas and Core
            canvas.width = 160;
            canvas.height = 144;
            this.gb = new window.GameBoyCore(canvas, "");
            
            // 4. Force GBC Mode for Pokemon Crystal
            // Offset 0x0143: 0x80 or 0xC0 indicates GBC support
            const cgbFlag = this.workingBuffer[0x0143];
            if (cgbFlag === 0x80 || cgbFlag === 0xC0) {
                console.log("GBC Flag detected, enabling Color mode.");
                this.gb.toggleGBC(true);
            }

            // 5. Start Engine
            this.gb.start(bootBuffer);
            
            const emuStep = () => {
                if (this.gb) {
                    this.gb.run();
                    this.emuLoop = requestAnimationFrame(emuStep);
                }
            };
            this.emuLoop = requestAnimationFrame(emuStep);
            
        } catch (err) {
            console.error("Boot Error:", err);
            alert("Boot Failed: " + (err.message || "Invalid ROM Structure"));
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
            const handleAction = (isPressed) => { if (this.gb) this.gb.JoyPadEvent(code, isPressed); };
            btn.addEventListener('touchstart', (e) => { e.preventDefault(); handleAction(true); }, {passive: false});
            btn.addEventListener('touchend', (e) => { e.preventDefault(); handleAction(false); }, {passive: false});
            btn.addEventListener('mousedown', (e) => { e.preventDefault(); handleAction(true); });
            btn.addEventListener('mouseup', (e) => { e.preventDefault(); handleAction(false); });
        });
    }
}

window.addEventListener('DOMContentLoaded', () => { window.App = new CodaRom(); });
