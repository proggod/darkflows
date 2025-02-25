declare module 'jose' {
  export interface JWTPayload {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  }
  
  export interface JWTVerifyOptions {
    algorithms?: string[];
  }
  
  export class SignJWT {
    constructor(payload: JWTPayload);
    setProtectedHeader(header: { alg: string }): this;
    setIssuedAt(): this;
    setExpirationTime(time: string): this;
    sign(key: Uint8Array): Promise<string>;
  }

  export function jwtVerify(
    token: string, 
    key: Uint8Array, 
    options?: JWTVerifyOptions
  ): Promise<{ payload: JWTPayload }>;
} 