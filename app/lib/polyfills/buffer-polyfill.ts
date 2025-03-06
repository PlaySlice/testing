import { Buffer as BufferPolyfill } from 'buffer';

// Make Buffer available globally
globalThis.Buffer = BufferPolyfill;
