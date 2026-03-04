import { VRAMViewer } from './vram_viewer.js';
import { Patcher } from './patcher.js';

export class CodaRom {
    constructor() {
        this.originalBuffer = null;
        this.workingBuffer = null;
        this.currentBankOffset = 0;
        this.viewer = new VRAMViewer('tileCanvas');
        this.gb = null; // Emulator instance
        this.init();
    }

    init() {
        document.getElementById('romUpload').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            this.originalBuffer = new Uint8Array(await file.arrayBuffer());
            this.workingBuffer = new Uint8Array([...this.originalBuffer]);
            this.populateBankList();
            this.loadBank(0);
        });

        // Tab Management
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.getElementById(e.target.dataset.tab + 'View').classList.remove('hidden');
                e.target.classList.add('active');
            });
        });

        // Emulator Boot
        document.getElementById('runRom').addEventListener('click', () => this.bootEmulator());

        // Setup Touch Controls
        this.bindTouchControls();

        // GFX Editing
        document.getElementById('tileCanvas').addEventListener('mousedown', (e) => {
            const { offset, bitPos } = this.viewer.getRomOffsetFromMouse(e, this.currentBankOffset);
            this.workingBuffer[offset] ^= (1 << bitPos);
            document.getElementById('inspectAddr').textContent = `0x${offset.toString(16)}`;
            this.viewer.renderBank(this.workingBuffer, this.currentBankOffset);
        });
    }

    bootEmulator() {
        if (!this.workingBuffer) return alert("Load ROM first");
        const canvas = document.getElementById('emuCanvas');
        
        // Initialize GameBoy-Online Core
        // Standard parameters: canvas, rom, skip-boot-animation, palette-settings
        this.gb = new GameBoyCore(canvas, "");
        this.gb.start(this.workingBuffer);
        
        // Set an interval to drive the emulator frame rate
        setInterval(() => { this.gb.run(); }, 16); 
    }

    bindTouchControls() {
        const keyMap = {
            "btn-up": 2, "btn-down": 3, "btn-left": 1, "btn-right": 0,
            "btn-a": 4, "btn-b": 5, "btn-select": 6, "btn-start": 7
        };

        Object.keys(keyMap).forEach(id => {
            const btn = document.getElementById(id);
            const press = () => { if(this.gb) this.gb.JoyPadEvent(keyMap[id], true); };
            const release = () => { if(this.gb) this.gb.JoyPadEvent(keyMap[id], false); };
            
            btn.addEventListener('touchstart', (e) => { e.preventDefault(); press(); });
            btn.addEventListener('touchend', (e) => { e.preventDefault(); release(); });
            btn.addEventListener('mousedown', press);
            btn.addEventListener('mouseup', release);
        });
    }

    populateBankList() {
        const list = document.getElementById('bankList');
        list.innerHTML = "";
        const bankCount = Math.ceil(this.originalBuffer.length / 0x4000);
        for (let i = 0; i < bankCount; i++) {
            const li = document.createElement('li');
            li.textContent = `Bank ${i.toString(16).toUpperCase()}`;
            li.onclick = () => this.loadBank(i);
            list.appendChild(li);
        }
    }

    loadBank(idx) {
        this.currentBankOffset = idx * 0x4000;
        this.viewer.renderBank(this.workingBuffer, this.currentBankOffset);
    }
}

new CodaRom();
