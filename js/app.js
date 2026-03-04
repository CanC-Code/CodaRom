import { VRAMViewer } from './vram_viewer.js';
import { Patcher } from './patcher.js';

export class CodaRom {
    constructor() {
        this.originalBuffer = null;
        this.workingBuffer = null;
        this.currentBankOffset = 0x0000;
        this.viewer = new VRAMViewer('tileCanvas');
        this.emulator = null;
        this.init();
    }

    init() {
        document.getElementById('romUpload').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            const buffer = await file.arrayBuffer();
            this.originalBuffer = new Uint8Array(buffer);
            this.workingBuffer = new Uint8Array([...this.originalBuffer]);
            
            this.populateBankList();
            this.loadBank(0);
            console.log("ROM Ready for Analysis");
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

        // Pixel Editor + Inspector QoL
        document.getElementById('tileCanvas').addEventListener('mousedown', (e) => {
            if (!this.workingBuffer) return;
            const { offset, bitPos } = this.viewer.getRomOffsetFromMouse(e, this.currentBankOffset);
            
            // Modify Buffer
            this.workingBuffer[offset] ^= (1 << bitPos);
            
            // Update UI Inspector
            document.getElementById('inspectAddr').textContent = `0x${offset.toString(16).toUpperCase()}`;
            document.getElementById('inspectVal').textContent = `0x${this.workingBuffer[offset].toString(16).toUpperCase()}`;
            
            this.viewer.renderBank(this.workingBuffer, this.currentBankOffset);
        });

        // Emulator Trigger
        document.getElementById('runRom').addEventListener('click', () => {
            if (!this.workingBuffer) return alert("Upload a ROM first");
            this.startEmulator();
        });

        document.getElementById('exportIps').onclick = () => {
            const patch = Patcher.generateIPS(this.originalBuffer, this.workingBuffer);
            Patcher.downloadPatch(patch);
        };
    }

    startEmulator() {
        const canvas = document.getElementById('emuCanvas');
        // Initialize Binjgb Emulator with workingBuffer
        if (window.binjgb) {
            window.binjgb.run(this.workingBuffer, canvas);
        } else {
            alert("Emulator library still loading...");
        }
    }

    populateBankList() {
        const list = document.getElementById('bankList');
        list.innerHTML = "";
        const bankCount = Math.ceil(this.originalBuffer.length / 0x4000);
        for (let i = 0; i < bankCount; i++) {
            const li = document.createElement('li');
            li.textContent = `Bank 0x${i.toString(16).toUpperCase()}`;
            li.onclick = () => this.loadBank(i);
            list.appendChild(li);
        }
    }

    loadBank(idx) {
        this.currentBankOffset = idx * 0x4000;
        this.viewer.renderBank(this.workingBuffer, this.currentBankOffset);
        document.querySelectorAll('#bankList li').forEach((el, i) => {
            el.className = i === idx ? 'active-bank' : '';
        });
    }
}

new CodaRom();
