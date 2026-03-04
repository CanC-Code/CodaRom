export class Patcher {
    static generateIPS(original, modified) {
        const header = new TextEncoder().encode("PATCH");
        const footer = new TextEncoder().encode("EOF");
        let chunks = [header];

        for (let i = 0; i < original.length; i++) {
            if (original[i] !== modified[i]) {
                // Address (3 bytes, Big-Endian)
                const addr = new Uint8Array([(i >> 16) & 0xFF, (i >> 8) & 0xFF, i & 0xFF]);
                
                // For simplicity, this tool creates 1-byte records. 
                // A pro tool would group adjacent changes into one record.
                const size = new Uint8Array([0x00, 0x01]);
                const data = new Uint8Array([modified[i]]);
                
                chunks.push(addr, size, data);
            }
        }

        chunks.push(footer);
        return new Blob(chunks, { type: "application/octet-stream" });
    }

    static downloadPatch(blob, filename = "upgrade.ips") {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
    }
}
