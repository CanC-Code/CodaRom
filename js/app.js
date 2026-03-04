import { VRAMViewer } from './vram_viewer.js';
import { Patcher } from './patcher.js'; // Assuming the patcher logic is in patcher.js

export class CodaRom {
    constructor() {
        this.originalBuffer = null;
        this.workingBuffer = null;
        this.currentBankOffset = 0x0000;
        this.viewer = new VRAMViewer('tileCanvas');
        this.init();
    }

    init() {
        // ROM Upload
        document.getElementById('romUpload').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            const arrayBuffer = await file.arrayBuffer();
            this.originalBuffer = new Uint8Array(arrayBuffer);
            this.workingBuffer = new Uint8Array([...this.originalBuffer]); // Clone buffer
            
            this.populateBankList();
            this.loadBank(0);
        });

        // Tab Switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.getElementById(e.target.dataset.tab + 'View').classList.remove('hidden');
                e.target.classList.add('active');
            });
        });

        // Click-to-Edit Logic
        document.getElementById('tileCanvas').addEventListener('click', (e) => {
            if (!this.workingBuffer) return;

            const { offset, bitPos } = this.viewer.getRomOffsetFromMouse(e, this.currentBankOffset);
            
            // Simple logic: Flip the bits in the working buffer to change color
            // This modifies the low-bit byte. 
            this.workingBuffer[offset] ^= (1 << bitPos);
            
            // Re-render immediately to show visual change
            this.viewer.renderBank(this.workingBuffer, this.currentBankOffset);
            console.log(`Modified ROM at Address: 0x${offset.toString(16).toUpperCase()}`);
        });

        // IPS Export
        document.getElementById('exportIps').onclick = () => {
            if (!this.originalBuffer) return alert("Please load a ROM first!");
            const patch = Patcher.generateIPS(this.originalBuffer, this.workingBuffer);
            Patcher.downloadPatch(patch, "CodaRom_Upgrade.ips");
        };
    }

    populateBankList() {
        const list = document.getElementById('bankList');
        list.innerHTML = ""; // Clear existing
        const bankSize = 0x4000; // 16KB Banks
        const bankCount = Math.ceil(this.originalBuffer.length / bankSize);

        for (let i = 0; i < bankCount; i++) {
            const li = document.createElement('li');
            li.textContent = `Bank 0x${i.toString(16).toUpperCase()}`;
            li.style.cursor = "pointer";
            li.onclick = () => this.loadBank(i);
            list.appendChild(li);
        }
    }

    loadBank(bankIndex) {
        this.currentBankOffset = bankIndex * 0x4000;
        this.viewer.renderBank(this.workingBuffer, this.currentBankOffset);
        
        // Update UI styling
        const items = document.querySelectorAll('#bankList li');
        items.forEach((item, idx) => {
            item.style.color = idx === bankIndex ? "#00ff41" : "#888";
        });
    }
}

// Initialize the App
new CodaRom();
