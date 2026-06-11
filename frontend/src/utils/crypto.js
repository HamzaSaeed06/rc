// frontend/src/utils/crypto.js

const getDerivedKey = async (passphrase) => {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode('CodeAlpha_E2EE_Salt_2026'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
};

export const encryptMessage = async (text, roomId) => {
  try {
    if (!window.crypto || !window.crypto.subtle) {
      console.warn('[Crypto] window.crypto.subtle is not available. Falling back to plain text.');
      return text;
    }
    const key = await getDerivedKey(roomId);
    const enc = new TextEncoder();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const cipherText = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      enc.encode(text)
    );

    // Convert to base64 for easy transport
    const ivBase64 = btoa(String.fromCharCode(...iv));
    const cipherBase64 = btoa(String.fromCharCode(...new Uint8Array(cipherText)));
    
    // Prefix with E2EE identifier so we know it's encrypted
    return `E2EE:${ivBase64}:${cipherBase64}`;
  } catch (error) {
    console.error('Encryption failed:', error);
    return text; // fallback
  }
};

export const decryptMessage = async (encryptedText, roomId) => {
  try {
    if (!encryptedText || typeof encryptedText !== 'string' || !encryptedText.startsWith('E2EE:')) {
      return encryptedText; // Legacy unencrypted message
    }

    if (!window.crypto || !window.crypto.subtle) {
      console.warn('[Crypto] window.crypto.subtle is not available. Cannot decrypt. Returning raw message.');
      return encryptedText;
    }

    const parts = encryptedText.split(':');
    if (parts.length !== 3) return 'Error: Corrupt encrypted message';

    const ivStr = atob(parts[1]);
    const iv = new Uint8Array(ivStr.length);
    for (let i = 0; i < ivStr.length; i++) iv[i] = ivStr.charCodeAt(i);

    const cipherStr = atob(parts[2]);
    const cipherBytes = new Uint8Array(cipherStr.length);
    for (let i = 0; i < cipherStr.length; i++) cipherBytes[i] = cipherStr.charCodeAt(i);

    const key = await getDerivedKey(roomId);
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      cipherBytes
    );

    const dec = new TextDecoder();
    return dec.decode(decryptedBuffer);
  } catch (error) {
    console.error('Decryption failed:', error);
    return 'Error: Could not decrypt message';
  }
};
