import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | string | null | undefined): string {
    if (amount === null || amount === undefined || isNaN(Number(amount))) return "0 đ";
    return Number(amount).toLocaleString('vi-VN') + ' đ';
}
