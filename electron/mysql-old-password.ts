/**
 * MySQL Pre-4.1 legacy password authentication plugin ('mysql_old_password').
 * Supports connecting to legacy MySQL (e.g. MySQL 5.5, 5.1, 5.0) and accounts
 * created with old 16-character hashes or 'old_passwords = 1'.
 */

class MyRnd {
  private seed1: number;
  private seed2: number;
  private readonly maxVal = 0x3fffffff;

  constructor(seed1: number, seed2: number) {
    this.seed1 = (seed1 >>> 0) % this.maxVal;
    this.seed2 = (seed2 >>> 0) % this.maxVal;
  }

  nextByte(): number {
    this.seed1 = ((this.seed1 * 3) + this.seed2) % this.maxVal;
    this.seed2 = (this.seed1 + this.seed2 + 33) % this.maxVal;
    return Math.floor((this.seed1 * 31) / this.maxVal);
  }
}

function pwHash(buf: Uint8Array): [number, number] {
  let add = 7;
  let nr = 1345345333;
  let nr2 = 0x12345671;

  for (let i = 0; i < buf.length; i++) {
    const c = buf[i];
    if (c === 32 || c === 9) continue; // skip space and tab
    nr ^= (((nr & 63) + add) * c) + (nr << 8);
    nr2 = (nr2 + ((nr2 << 8) ^ nr)) >>> 0;
    add = (add + c) >>> 0;
  }

  return [
    (nr & 0x7fffffff) >>> 0,
    (nr2 & 0x7fffffff) >>> 0
  ];
}

export function scrambleOldPassword(scramble: Buffer | Uint8Array, password: string): Buffer {
  const scramble8 = scramble.subarray(0, 8);
  const hashPw = pwHash(Buffer.from(password, 'utf8'));
  const hashSc = pwHash(scramble8);

  const r = new MyRnd(hashPw[0] ^ hashSc[0], hashPw[1] ^ hashSc[1]);

  const out = Buffer.alloc(8);
  for (let i = 0; i < 8; i++) {
    out[i] = r.nextByte() + 64;
  }

  const mask = r.nextByte();
  for (let i = 0; i < 8; i++) {
    out[i] ^= mask;
  }

  return out;
}

export function createMysqlOldPasswordPlugin() {
  return ({ connection, command }: { connection: any; command: any }) => {
    const password = command?.password ?? connection?.config?.password ?? '';
    return (data: Buffer): Buffer => {
      if (!password) {
        return Buffer.from([0]);
      }
      let scramble = data;
      if (!scramble || scramble.length < 8) {
        scramble = command?.handshake?.authPluginData1 || connection?.authPluginData1 || Buffer.alloc(8);
      }
      const token = scrambleOldPassword(scramble, password);
      return Buffer.concat([token, Buffer.from([0])]);
    };
  };
}
