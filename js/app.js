import { VRAMViewer } from './vram_viewer.js';
import { Patcher } from './patcher.js';

export class CodaRom {
    constructor() {
        this.originalBuffer = null;
        this.workingBuffer = null;
        this.currentBankOffset = 0;
        this.viewer = new VRAMViewer('tileCanvas');
        this.gb = null;
        this.loop = null;
        this.init();
    }

    init() {
        document.getElementById('romUpload').onchange = async (e) => {
            const file = e.target.files[0];
            const buf = await file.arrayBuffer();
            this.originalBuffer = new Uint8Array(buf);
            this.workingBuffer = new Uint8Array([...this.originalBuffer]);
            this.populateDropdown();
            this.loadBank(0);
        };

        document.getElementById('bankSelect').onchange = (e) => this.loadBank(parseInt(e.target.value));

        document.getElementById('runRom').onclick = () => {
            if (typeof GameBoyCore === 'undefined') {
                alert("ERROR: Emulator core not found. Check if lib/GameBoyCore.js exists!");
                return;
            }
            this.bootEmulator();
        };

        this.bindTouchControls();
    }

    bootEmulator() {
        const canvas = document.getElementById('emuCanvas');
        // Restart if already running
        if (this.loop) clearInterval(this.loop);
        
        this.gb = new GameBoyCore(canvas, "");
        this.gb.start(this.workingBuffer);
        this.loop = setInterval(() => this.gb.run(), 16);
        console.log("Emulator Started");
    }

    bindTouchControls() {
        const keys = {"btn-up":2,"btn-down":3,"btn-left":1,"btn-right":0,"btn-a":4,"btn-b":5};
        Object.entries(keys).forEach(([id, code]) => {
            const btn = document.getElementById(id);
            if(!btn) return;
            const handler = (val) => { if(this.gb) this.gb.JoyPadEvent(code, val); };
            btn.onmousedown = btn.ontouchstart = (e) => { e.preventDefault(); handler(true); };
            btn.onmouseup = btn.ontouchend = (e) => { e.preventDefault(); handler(false); };
        });
    }

    populateDropdown() {
        const sel = document.getElementById('bankSelect');
        sel.innerHTML = "";
        const count = Math.ceil(this.originalBuffer.length / 0x4000);
        for (let i = 0; i < count; i++) {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = `Bank 0x${i.toString(16).toUpperCase()}`;
            sel.appendChild(opt);
        }
    }

    loadBank(idx) {
        this.currentBankOffset = idx * 0x4000;
        this.viewer.renderBank(this.workingBuffer, this.currentBankOffset);
        document.getElementById('bankSelect').value = idx;
    }
}
new CodaRom();
