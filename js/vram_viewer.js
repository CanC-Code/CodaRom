export class VRAMViewer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        // Classic GBC Greyscale Palette
        this.palette = ['#ffffff', '#aaaaaa', '#555555', '#000000'];
        this.scale = 2; 
        this.tilesPerRow = 16;
    }

    /**
     * Decodes 16 bytes of 2bpp data into an 8x8 tile
     */
    drawTile(buffer, offset, x, y) {
        for (let row = 0; row < 8; row++) {
            let byte1 = buffer[offset + (row * 2)];
            let byte2 = buffer[offset + (row * 2) + 1];

            for (let col = 0; col < 8; col++) {
                let bit = 7 - col;
                let lowBit = (byte1 >> bit) & 1;
                let highBit = (byte2 >> bit) & 1;
                let colorIndex = (highBit << 1) | lowBit;
                
                this.ctx.fillStyle = this.palette[colorIndex];
                this.ctx.fillRect(x + (col * this.scale), y + (row * this.scale), this.scale, this.scale);
            }
        }
    }

    /**
     * Renders a full 16KB Bank of tiles (approx 1024 tiles possible)
     */
    renderBank(buffer, bankOffset) {
        // Clear and resize canvas for the bank
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.canvas.width = this.tilesPerRow * (8 * this.scale);
        this.canvas.height = 1024; // Large enough for most GBC banks

        for (let i = 0; i < 512; i++) { // Render first 512 tiles in bank
            let tileOffset = bankOffset + (i * 16);
            if (tileOffset + 16 > buffer.length) break;

            let tx = (i % this.tilesPerRow) * (8 * this.scale);
            let ty = Math.floor(i / this.tilesPerRow) * (8 * this.scale);
            this.drawTile(buffer, tileOffset, tx, ty);
        }
    }

    /**
     * Maps screen clicks back to ROM addresses
     */
    getRomOffsetFromMouse(event, currentBankOffset) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = (event.clientX - rect.left);
        const mouseY = (event.clientY - rect.top);

        const tileX = Math.floor(mouseX / (8 * this.scale));
        const tileY = Math.floor(mouseY / (8 * this.scale));
        const tileIndex = (tileY * this.tilesPerRow) + tileX;

        const pixelY = Math.floor((mouseY % (8 * this.scale)) / this.scale);
        const pixelX = 7 - Math.floor((mouseX % (8 * this.scale)) / this.scale);

        // Every row is 2 bytes. Offset is: BankStart + (TileNum * 16) + (Row * 2)
        const absoluteOffset = currentBankOffset + (tileIndex * 16) + (pixelY * 2);
        
        return { offset: absoluteOffset, bitPos: pixelX };
    }
}
