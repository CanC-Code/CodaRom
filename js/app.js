import { VRAMViewer } from './vram_viewer.js';
import { Patcher } from './patcher.js';

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
        document.getElementById('romUpload').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            const buf = await file.arrayBuffer();
            this.originalBuffer = new Uint8Array(buf);
            this.workingBuffer = new Uint8Array([...this.originalBuffer]);
            this.populateBankList();
            this.loadBank(0);
        });

        // Tab Switching Logic
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.getElementById(e.target.dataset.tab + 'View').classList.remove('hidden');
                e.target.classList.add('active');
            });
        });

        document.getElementById('runRom').onclick = () => this.bootEmulator();
        this.bindTouchControls();
    }

    bootEmulator() {
        if (!this.workingBuffer) return;
        const canvas = document.getElementById('emuCanvas');
        
        // Initialize the Core
        this.gb = new GameBoyCore(canvas, "");
        this.gb.start(this.workingBuffer);
        
        // Clear any existing intervals
        if (this.emuLoop) clearInterval(this.emuLoop);
        this.emuLoop = setInterval(() => { this.gb.run(); }, 16);
    }

    bindTouchControls() {
        const keyMap = {
            "btn-up": 2, "btn-down": 3, "btn-left": 1, "btn-right": 0,
            "btn-a": 4, "btn-b": 5, "btn-select": 6, "btn-start": 7
        };

        Object.keys(keyMap).forEach(id => {
            const btn = document.getElementById(id);
            if (!btn) return;
            
            const press = (e) => { e.preventDefault(); if(this.gb) this.gb.JoyPadEvent(keyMap[id], true); };
            const release = (e) => { e.preventDefault(); if(this.gb) this.gb.JoyPadEvent(keyMap[id], false); };
            
            btn.addEventListener('touchstart', press);
            btn.addEventListener('touchend', release);
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
            li.textContent = `Bank 0x${i.toString(16).toUpperCase()}`;
            li.id = `bank-${i}`;
            li.onclick = () => this.loadBank(i);
            list.appendChild(li);
        }
    }

    loadBank(idx) {
        this.currentBankOffset = idx * 0x4000;
        this.viewer.renderBank(this.workingBuffer, this.currentBankOffset);
        document.querySelectorAll('#bankList li').forEach(li => li.classList.remove('active-bank'));
        document.getElementById(`bank-${idx}`).classList.add('active-bank');
    }
}

new CodaRom();
