import { VRAMViewer } from './vram_viewer.js';
import { Patcher } from './patcher.js';

export class CodaRom {
    constructor() {
        this.originalBuffer = null;
        this.workingBuffer = null;
        this.viewer = new VRAMViewer('tileCanvas');
        this.gb = null;
        this.init();
    }

    async init() {
        document.getElementById('romUpload').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const arrayBuffer = await file.arrayBuffer();
                let temp = new Uint8Array(arrayBuffer);

                // 1. Force the size to exactly 2MB for Pokemon Crystal 
                // (or any size indicated by the header)
                const sizeCode = temp[0x0148];
                const expectedSize = 32768 << sizeCode;
                
                let finalized = new Uint8Array(expectedSize).fill(0);
                finalized.set(temp);

                this.originalBuffer = finalized;
                this.workingBuffer = new Uint8Array([...this.originalBuffer]);
                
                this.populateBankDropdown();
                this.loadBank(0);
                console.log("ROM Ready: " + this.workingBuffer.length + " bytes.");
            } catch (err) { console.error(err); }
        });

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
                document.getElementById(btn.dataset.tab + 'View').classList.remove('hidden');
            };
        });

        document.getElementById('runRom').onclick = () => this.bootEmulator();
    }

    populateBankDropdown() {
        const select = document.getElementById('bankSelect');
        select.innerHTML = "";
        const count = this.workingBuffer.length / 0x4000;
        for (let i = 0; i < count; i++) {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = `Bank 0x${i.toString(16).toUpperCase()}`;
            select.appendChild(opt);
        }
    }

    loadBank(idx) {
        this.viewer.renderBank(this.workingBuffer, idx * 0x4000);
    }

    bootEmulator() {
        const canvas = document.getElementById('emuCanvas');
        try {
            // BRUTE FORCE: Convert Uint8Array to a standard JavaScript Array.
            // Some versions of GameBoyCore.js only accept standard Arrays.
            const legacyArray = Array.from(this.workingBuffer);

            this.gb = new window.GameBoyCore(canvas, "");
            
            // Set flags before starting
            this.gb.cgb = true;
            
            // Try to start with the legacy array format
            this.gb.start(legacyArray);
            
            const step = () => {
                if (this.gb) {
                    this.gb.run();
                    requestAnimationFrame(step);
                }
            };
            requestAnimationFrame(step);
        } catch (err) {
            alert("Still failing: " + err.message);
        }
    }

    bindTouchControls() {
        // ... (Existing touch logic)
    }
}

window.addEventListener('DOMContentLoaded', () => { new CodaRom(); });
