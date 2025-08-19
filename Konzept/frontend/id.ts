// frontend/id.ts – UUIDv7 helper (Fallback v4)
// Empfohlen: 'uuid' >= 9.x mit v7:
//   import { v7 as uuidv7 } from 'uuid';
//   export const newId = () => uuidv7();
import { v4 as uuidv4 } from 'uuid';
export const newId = () => uuidv4();
