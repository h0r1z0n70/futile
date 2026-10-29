declare module "node:crypto" {
	export function randomBytes(n: number): buf;
	export function createCipheriv(alg: string, key: Uint8Array, iv: Uint8Array, opts?: object): {
		setAAD(b: Uint8Array): void;
		update(b: Uint8Array): buf;
		final(): buf;
		getAuthTag(): buf;
	};
	export function createDecipheriv(alg: string, key: Uint8Array, iv: Uint8Array, opts?: object): {
		setAAD(b: Uint8Array): void;
		setAuthTag(b: Uint8Array): void;
		update(b: Uint8Array): buf;
		final(): buf;
	};
}

interface buf extends Uint8Array {
	toString(enc?: string): string;
	subarray(start?: number, end?: number): buf;
}

declare var Buffer: {
	from(s: string | Uint8Array, enc?: string): buf;
	concat(list: Uint8Array[]): buf;
};
