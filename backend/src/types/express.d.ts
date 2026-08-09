declare namespace Express {
  export interface Request {
    user?: {
      id: string;
      name: string;
      email: string;
      role: 'ADMIN' | 'SALES' | 'WAREHOUSE' | 'ACCOUNTS';
    };
  }
}
