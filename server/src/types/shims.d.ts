declare module 'pdf-parse' {
  export interface PdfParseResult {
    numpages: number;
    numrender: number;
    info: any;
    metadata: any;
    version: string;
    text: string;
  }
  export default function pdfParse(
    data: Buffer | Uint8Array | ArrayBuffer,
    options?: any
  ): Promise<PdfParseResult>;
}

declare module 'mammoth' {
  export function extractRawText(
    input: { buffer: Buffer } | { arrayBuffer: ArrayBuffer }
  ): Promise<{ value: string }>;
}
