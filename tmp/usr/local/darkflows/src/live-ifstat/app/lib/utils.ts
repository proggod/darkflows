import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { promisify } from 'util';
import { exec } from 'child_process';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const execAsync = promisify(exec); 