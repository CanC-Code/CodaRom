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
        const reqs = [
            { name: "GameBoyCore", check: () => typeof window.GameBoyCore === 'function' },
            { name: "XAudioServer", check: () => typeof window.XAudioServer === 'function' }
        ];
        return reqs.every(r => r.check());
    }

    async init() {
        if (!await this.runHealthCheck()) return;

        document.getElementById('romUpload').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const label = document.querySelector('label[for="bankSelect"]');
            label.textContent = "Repairing ROM...";

            try {
                const arrayBuffer = await file.arrayBuffer();
                let raw = new Uint8Array(arrayBuffer);

                // --- CRITICAL REPAIR ---
                // Pokemon Crystal header says it needs 2MB. 
                // We force the buffer to match the header immediately.
                const sizeCode = raw[0x0148];
                const expectedSize = 32768 << sizeCode;

                if (raw.length < expectedSize) {
                    console.log(`Fixing trimmed ROM: ${raw.length} -> ${expectedSize}`);
                    const fixed = new Uint8Array(expectedSize);
                    fixed.fill(0x00); // Fill with 0s (Standard for empty ROM space)
                    fixed.set(raw);
                    raw = fixed;
                }

                this.originalBuffer = raw;
                this.workingBuffer = new Uint8Array([...this.originalBuffer]);
                
                this.populateBankDropdown();
                this.loadBank(0);
                label.textContent = "Bank Explorer:";
            } catch (err) {
                label.textContent = "Error!";
            }
        });

        // UI Listeners
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.onclick = () => {
                const target = btn.dataset.tab;
                document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
                document.getElementById(target + 'View').classList.remove('hidden');
            };
        });

        document.getElementById('bankSelect').onchange = (e) => this.loadBank(parseInt(e.target.value));

        document.getElementById('runRom').onclick = () => {
            if (!this.workingBuffer) return alert("Upload ROM first");
            this.bootEmulator();
        };

        this.bindTouchControls();
    }

    populateBankDropdown() {
        const select = document.getElementById('bankSelect');
        select.innerHTML = "";
        const count = Math.ceil(this.workingBuffer.length / 0x4000);
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
        if (this.emuLoop) cancelAnimationFrame(this.emuLoop);

        try {
            // Reset Canvas for Engine
            canvas.width = 160;
            canvas.height = 144;
            
            // Re-verify size one last time before passing to Core
            const sizeCode = this.workingBuffer[0x0148];
            const expectedSize = 32768 << sizeCode;
            
            if (this.workingBuffer.length < expectedSize) {
                throw new Error(`Buffer mismatch: ${this.workingBuffer.length} vs ${expectedSize}`);
            }

            this.gb = new window.GameBoyCore(canvas, "");
            
            // GBC Mode Check
            const cgbFlag = this.workingBuffer[0x0143];
            if (cgbFlag === 0x80 || cgbFlag === 0xC0) {
                if (this.gb.toggleGBC) this.gb.toggleGBC(true);
                else { this.gb.cgb = true; this.gb.useGBC = true; }
            }

            // Start Engine
            this.gb.start(this.workingBuffer);
            
            const step = () => {
                if (this.gb) {
                    this.gb.run();
                    this.emuLoop = requestAnimationFrame(step);
                }
            };
            this.emuLoop = requestAnimationFrame(step);
            console.log("Boot Successful.");
            
        } catch (err) {
            console.error(err);
            alert("Engine Error: " + err.message);
        }
    }

    bindTouchControls() {
        const keys = {"btn-up":2,"btn-down":3,"btn-left":1,"btn-right":0,"btn-a":4,"btn-b":5};
        Object.entries(keys).forEach(([id, code]) => {
            const btn = document.getElementById(id);
            if (!btn) return;
            const press = (v) => { if(this.gb) this.gb.JoyPadEvent(code, v); };
            btn.ontouchstart = (e) => { e.preventDefault(); press(true); };
            btn.ontouchend = (e) => { e.preventDefault(); press(false); };
        });
    }
}

window.addEventListener('DOMContentLoaded', () => { new CodaRom(); });
