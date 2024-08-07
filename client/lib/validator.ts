import { z } from "zod";

export const userTypeSchema = z.object({
    role: z.enum(["tutor", "student"]),
})

export const signUpSchema = z.object({
    fullName: z.string()
        .min(1, { message: 'Name is required' })
        .max(20, { message: 'Name is too long' }),
    email: z.string().email().min(1, { message: "Email is required" }),
    password: z.string().min(8, { message: "Password must be at least 8 characters" }),
    confirmPassword: z.string().min(8, { message: "Confirm Password must be at least 8 characters" }),
    role: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
});

export const signInSchema = z.object({
    email: z.string().email().min(1, { message: "Email is required" }),
    password: z.string().min(8, { message: "Password must be at least 8 characters" }),
})


export const resetPasswordSchema = z.object({
    email: z.string().email().min(1, { message: "Email is required" }),
})

export const newPasswordSchema = z.object({
    password: z.string().min(8, { message: "Password must be at least 8 characters" }),
    confirmPassword: z.string().min(8, { message: "Confirm Password must be at least 8 characters" }),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
})

export const phoneAuthSchema = z.object({
    phone: z.string().min(10, { message: "Phone number must be at least 10 characters" }),
    role: z.string(),
})

export const searchBar = z.object({
    query: z.string(),
})