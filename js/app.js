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
        console.log("--- CodaRom System Health Check ---");
        const requirements = [
            { name: "GameBoyCore.js", check: () => typeof window.GameBoyCore !== 'undefined' },
            { name: "GameBoyIO.js", check: () => typeof window.GameBoyKeyInput !== 'undefined' },
            { name: "XAudioServer.js", check: () => typeof window.XAudioServer !== 'undefined' }
        ];

        let missing = [];

        for (const lib of requirements) {
            try {
                if (lib.check()) {
                    console.log(`✅ ${lib.name}: Loaded`);
                } else {
                    console.warn(`❌ ${lib.name}: Missing or failed to initialize`);
                    missing.push(lib.name);
                }
            } catch (e) {
                console.error(`❌ ${lib.name}: Error during check`, e);
                missing.push(lib.name);
            }
        }

        if (missing.length > 0) {
            const errorMsg = `System Error: The following files are missing from your /lib/ folder or failed to load:\n\n${missing.join('\n')}\n\nPlease ensure these files are physically present in your repository.`;
            alert(errorMsg);
            return false;
        }

        console.log("--- All systems nominal ---");
        return true;
    }

    async init() {
        // Run health check immediately on startup
        const isHealthy = await this.runHealthCheck();
        if (!isHealthy) return;

        // ROM Upload Handler
        document.getElementById('romUpload').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const arrayBuffer = await file.arrayBuffer();
            this.originalBuffer = new Uint8Array(arrayBuffer);
            this.workingBuffer = new Uint8Array([...this.originalBuffer]);

            console.log(`ROM Loaded: ${file.name} (${this.originalBuffer.length} bytes)`);

            this.populateBankDropdown();
            this.loadBank(0);
        });

        // ... [Rest of your init() logic remains the same] ...
        
        // Tab Switching Logic
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetTab = e.target.dataset.tab;
                document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.getElementById(targetTab + 'View').classList.remove('hidden');
                e.target.classList.add('active');
            });
        });

        document.getElementById('bankSelect').addEventListener('change', (e) => {
            const bankIndex = parseInt(e.target.value);
            if (!isNaN(bankIndex)) this.loadBank(bankIndex);
        });

        document.getElementById('runRom').addEventListener('click', () => {
            if (!this.workingBuffer) return alert("Please upload a ROM first.");
            this.bootEmulator();
        });

        document.getElementById('exportIps').addEventListener('click', () => {
            if (!this.originalBuffer || !this.workingBuffer) return;
            const patchBlob = Patcher.generateIPS(this.originalBuffer, this.workingBuffer);
            Patcher.downloadPatch(patchBlob, "CodaRom_Patch.ips");
        });

        this.bindTouchControls();
    }

    // ... [Rest of the class methods: populateBankDropdown, loadBank, bootEmulator, bindTouchControls] ...
}

window.addEventListener('DOMContentLoaded', () => {
    new CodaRom();
});
