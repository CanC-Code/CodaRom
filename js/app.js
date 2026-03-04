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
        const requirements = [
            { name: "GameBoyCore.js", check: () => typeof window.GameBoyCore === 'function' },
            { name: "GameBoyIO.js", check: () => typeof window.GameBoyKeyInput === 'function' || (window.GameBoyCore && window.GameBoyCore.prototype.JoyPadEvent) },
            { name: "XAudioServer.js", check: () => typeof window.XAudioServer === 'function' }
        ];
        let missing = [];
        requirements.forEach(lib => { if (!lib.check()) missing.push(lib.name); });
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
            label.textContent = "Processing ROM...";

            try {
                const arrayBuffer = await file.arrayBuffer();
                let tempBuffer = new Uint8Array(arrayBuffer);

                // --- GLOBAL PADDING LOGIC ---
                // We fix the size HERE so every part of the app sees a valid ROM
                const sizeCode = tempBuffer[0x0148];
                const expectedSize = 32768 << sizeCode;

                if (tempBuffer.length < expectedSize) {
                    console.log(`Auto-repairing ROM size: ${tempBuffer.length} -> ${expectedSize}`);
                    const padded = new Uint8Array(expectedSize);
                    padded.fill(0xFF);
                    padded.set(tempBuffer);
                    tempBuffer = padded;
                }

                this.originalBuffer = tempBuffer;
                this.workingBuffer = new Uint8Array([...this.originalBuffer]);
                
                this.populateBankDropdown();
                this.loadBank(0);
                
                label.textContent = "Bank Explorer:";
                console.log("ROM loaded and verified.");
            } catch (err) {
                console.error(err);
                label.textContent = "Load Error!";
            }
        });

        // Tab and UI logic
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
        const count = Math.ceil(this.workingBuffer.length / 0x4000);
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
            canvas.width = 160;
            canvas.height = 144;
            
            // Initialize the engine
            this.gb = new window.GameBoyCore(canvas, "");
            
            // Manual GBC check and fallback
            const cgbFlag = this.workingBuffer[0x0143];
            if (cgbFlag === 0x80 || cgbFlag === 0xC0) {
                if (typeof this.gb.toggleGBC === 'function') {
                    this.gb.toggleGBC(true);
                } else {
                    this.gb.cgb = true;
                    this.gb.useGBC = true;
                }
            }

            // Start using our pre-processed workingBuffer
            this.gb.start(this.workingBuffer);
            
            const emuStep = () => {
                if (this.gb) {
                    this.gb.run();
                    this.emuLoop = requestAnimationFrame(emuStep);
                }
            };
            this.emuLoop = requestAnimationFrame(emuStep);
            console.log("Emulator Running.");
            
        } catch (err) {
            console.error(err);
            alert("Boot Failed: " + (err.message || "Engine Error"));
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
            const handle = (v) => { if (this.gb) this.gb.JoyPadEvent(code, v); };
            btn.addEventListener('touchstart', (e) => { e.preventDefault(); handle(true); }, {passive: false});
            btn.addEventListener('touchend', (e) => { e.preventDefault(); handle(false); }, {passive: false});
            btn.addEventListener('mousedown', (e) => { e.preventDefault(); handle(true); });
            btn.addEventListener('mouseup', (e) => { e.preventDefault(); handle(false); });
        });
    }
}

window.addEventListener('DOMContentLoaded', () => { window.App = new CodaRom(); });
