import { VRAMViewer } from './vram_viewer.js';

export class CodaRom {
    constructor() {
        this.originalBuffer = null;
        this.workingBuffer = null;
        this.currentBankOffset = 0;
        this.viewer = new VRAMViewer('tileCanvas');
        this.gb = null;
        this.init();
    }

    init() {
        document.getElementById('romUpload').onchange = async (e) => {
            const buf = await e.target.files[0].arrayBuffer();
            this.originalBuffer = new Uint8Array(buf);
            this.workingBuffer = new Uint8Array([...this.originalBuffer]);
            this.populateDropdown();
            this.loadBank(0);
        };

        document.getElementById('bankSelect').onchange = (e) => {
            this.loadBank(parseInt(e.target.value));
        };

        document.getElementById('runRom').onclick = () => {
            if (!window.GameBoyCore) return alert("Emulator Core Missing in lib/ folder!");
            const canvas = document.getElementById('emuCanvas');
            this.gb = new GameBoyCore(canvas, "");
            this.gb.start(this.workingBuffer);
            if (this.loop) clearInterval(this.loop);
            this.loop = setInterval(() => this.gb.run(), 16);
        };
    }

    populateDropdown() {
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
        this.viewer.renderBank(this.workingBuffer, this.currentBankOffset);
        document.getElementById('bankSelect').value = idx; // Highlight selection
    }
}
new CodaRom();
