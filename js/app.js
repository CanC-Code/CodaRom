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

    init() {
        // ROM Upload Handler
        document.getElementById('romUpload').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const arrayBuffer = await file.arrayBuffer();
            this.originalBuffer = new Uint8Array(arrayBuffer);
            // Create a working copy for live edits
            this.workingBuffer = new Uint8Array([...this.originalBuffer]);

            console.log(`ROM Loaded: ${file.name} (${this.originalBuffer.length} bytes)`);
            
            this.populateBankDropdown();
            this.loadBank(0);
        });

        // Tab Switching Logic
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetTab = e.target.dataset.tab;
                
                // UI Updates
                document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                
                document.getElementById(targetTab + 'View').classList.remove('hidden');
                e.target.classList.add('active');
            });
        });

        // Bank Dropdown Change Handler
        document.getElementById('bankSelect').addEventListener('change', (e) => {
            const bankIndex = parseInt(e.target.value);
            if (!isNaN(bankIndex)) {
                this.loadBank(bankIndex);
            }
        });

        // Emulator Boot Button
        document.getElementById('runRom').addEventListener('click', () => {
            if (!this.workingBuffer) {
                alert("Please upload a ROM first.");
                return;
            }
            this.bootEmulator();
        });

        // IPS Export Button
        document.getElementById('exportIps').addEventListener('click', () => {
            if (!this.originalBuffer || !this.workingBuffer) return;
            const patchBlob = Patcher.generateIPS(this.originalBuffer, this.workingBuffer);
            Patcher.downloadPatch(patchBlob, "CodaRom_Patch.ips");
        });

        // Initialize Touch Controls for the Emulator
        this.bindTouchControls();
    }

    populateBankDropdown() {
        const select = document.getElementById('bankSelect');
        select.innerHTML = ""; // Clear placeholder
        
        // GBC Banks are 16KB (0x4000 bytes)
        const bankCount = Math.ceil(this.originalBuffer.length / 0x4000);
        
        for (let i = 0; i < bankCount; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `Bank 0x${i.toString(16).toUpperCase()}`;
            select.appendChild(option);
        }
    }

    loadBank(bankIndex) {
        this.currentBankOffset = bankIndex * 0x4000;
        
        // Sync Dropdown Highlight
        document.getElementById('bankSelect').value = bankIndex;
        
        // Render Graphics for this bank
        this.viewer.renderBank(this.workingBuffer, this.currentBankOffset);
        console.log(`Switched to Bank 0x${bankIndex.toString(16).toUpperCase()} (Offset: 0x${this.currentBankOffset.toString(16).toUpperCase()})`);
    }

    bootEmulator() {
        const canvas = document.getElementById('emuCanvas');
        
        // Verify the library is loaded from /lib/
        if (typeof GameBoyCore === 'undefined') {
            alert("Emulator Core (GameBoyCore.js) not found in /lib/ folder.");
            return;
        }

        // Stop existing loop if running
        if (this.emuLoop) clearInterval(this.emuLoop);

        try {
            // Initialize Core: (canvas, romData, options)
            this.gb = new GameBoyCore(canvas, "");
            this.gb.start(this.workingBuffer);
            
            // Standard 60FPS Refresh (approx 16ms)
            this.emuLoop = setInterval(() => {
                this.gb.run();
            }, 16);
            
            console.log("Emulator Started Successfully.");
        } catch (err) {
            console.error("Emulator Boot Failed:", err);
            alert("Failed to boot emulator. Check console for details.");
        }
    }

    bindTouchControls() {
        const keyMap = {
            "btn-up": 2, "btn-down": 3, "btn-left": 1, "btn-right": 0,
            "btn-a": 4, "btn-b": 5, "btn-select": 6, "btn-start": 7
        };

        Object.entries(keyMap).forEach(([id, keyCode]) => {
            const btn = document.getElementById(id);
            if (!btn) return;

            const handlePress = (e) => {
                e.preventDefault();
                if (this.gb) this.gb.JoyPadEvent(keyCode, true);
            };

            const handleRelease = (e) => {
                e.preventDefault();
                if (this.gb) this.gb.JoyPadEvent(keyCode, false);
            };

            // Support both Touch and Mouse for the D-Pad/Buttons
            btn.addEventListener('touchstart', handlePress);
            btn.addEventListener('touchend', handleRelease);
            btn.addEventListener('mousedown', handlePress);
            btn.addEventListener('mouseup', handleRelease);
            btn.addEventListener('mouseleave', handleRelease);
        });
    }
}

// Global entry point
window.addEventListener('DOMContentLoaded', () => {
    new CodaRom();
});
