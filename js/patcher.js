export class Patcher {
    /**
     * Compares two buffers and returns a Blob containing an IPS patch.
     */
    static generateIPS(original, modified) {
        const header = new TextEncoder().encode("PATCH");
        const footer = new TextEncoder().encode("EOF");
        let chunks = [header];

        // IPS format: [Header][Address(3)][Size(2)][Data][Footer]
        for (let i = 0; i < original.length; i++) {
            if (original[i] !== modified[i]) {
                // 3-byte offset
                const addr = new Uint8Array([
                    (i >> 16) & 0xFF,
                    (i >> 8) & 0xFF,
                    i & 0xFF
                ]);
                
                // 2-byte size (0x0001 for a single byte change)
                const size = new Uint8Array([0x00, 0x01]);
                const data = new Uint8Array([modified[i]]);
                
                chunks.push(addr, size, data);
            }
        }

        chunks.push(footer);
        return new Blob(chunks, { type: "application/octet-stream" });
    }

    /**
     * Triggers a browser download of the generated patch.
     */
    static downloadPatch(blob, filename = "CodaRom_Upgrade.ips") {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}
